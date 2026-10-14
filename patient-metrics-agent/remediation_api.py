"""Patient remediation + chaos API (v3).

Exposes POST /actions/execute for the Doctor. Two kinds of action, both
token-guarded and whitelisted:

  container faults : restart | stop | start  on whitelisted containers
  resource inject  : inject  on  memory | cpu | disk   (bounded stress-ng)

Safety:
  - every call requires the shared X-Agent-Token.
  - only whitelisted (action, target) pairs run; nothing else.
  - AGENT_DRY_RUN=true  -> log the intended command, change nothing.
  - injected load is bounded by INJECT_SECONDS (default 90s) and self-expires.
"""
import json
import os
import random
import re
import shlex
import subprocess
import threading
import time

from flask import Blueprint, request, jsonify

bp = Blueprint("remediation", __name__)

# --- traffic telemetry (read nginx access log for RPS + error/429 rate) ---
NGINX_ACCESS_LOG = os.environ.get("NGINX_ACCESS_LOG", "/var/log/nginx/access.log")
# matches the shopsmart log_format: client_ip - user [time] "METHOD path HTTP/x" status ...
_LINE_RE = re.compile(r'^(\S+) \S+ \S+ \[[^\]]+\] "\S+ (\S+)[^"]*" (\d{3})')
_traffic = {"offset": 0, "last_time": None}

AGENT_TOKEN = os.environ.get("AGENT_TOKEN", "")
DRY_RUN = os.environ.get("AGENT_DRY_RUN", "true").lower() == "true"
INJECT_SECONDS = int(os.environ.get("INJECT_SECONDS", "90"))
# Tune these to your instance so the load actually crosses the Doctor's
# thresholds without OOM-killing the box. Defaults suit a ~2 GB instance.
INJECT_VM_BYTES = os.environ.get("INJECT_VM_BYTES", "1G")      # memory to hold
INJECT_CPU_WORKERS = os.environ.get("INJECT_CPU_WORKERS", "0") # 0 = all cores
INJECT_HDD_BYTES = os.environ.get("INJECT_HDD_BYTES", "1G")    # scratch file size

# --- dynamic IP blocking (edge mitigation beyond nginx's static rate limit) ---
# Uses a $client_ip map (not `deny`), so it blocks by the logical client — which
# catches BOTH real external attackers (port 443, client_ip = peer) AND internally
# generated button-attacks (port 8443 with X-Forwarded-For). Blocked clients get 403.
BLOCK_SECONDS = int(os.environ.get("BLOCK_SECONDS", "120"))   # auto-expire a block
NGINX_CONTAINER = os.environ.get("NGINX_CONTAINER", "shopsmart_nginx")
BLOCKMAP_PATH = os.environ.get("BLOCKMAP_PATH", "/etc/nginx/blockmap.conf")
_IP_RE = re.compile(r'^\d{1,3}(\.\d{1,3}){3}(/\d{1,2})?$')
_blocked = {}            # ip -> expiry epoch
_block_lock = threading.Lock()
# clear any stale blockmap left from a previous run (best effort)
try:
    open(BLOCKMAP_PATH, "w").close()
except OSError:
    pass


def _nginx_reload():
    import docker
    docker.from_env().containers.get(NGINX_CONTAINER).exec_run("nginx -s reload")


def _rewrite_blockmap():
    with open(BLOCKMAP_PATH, "w") as f:
        for ip in _blocked:
            f.write(f"{ip} 1;\n")


def _block_ip(ip):
    with _block_lock:
        _blocked[ip] = time.time() + BLOCK_SECONDS
        _rewrite_blockmap()
    _nginx_reload()

    def _expire():
        time.sleep(BLOCK_SECONDS)
        with _block_lock:
            if _blocked.get(ip, 0) <= time.time():
                _blocked.pop(ip, None)
                _rewrite_blockmap()
        try:
            _nginx_reload()
        except Exception:
            pass
    threading.Thread(target=_expire, daemon=True).start()
    return True, f"blocked {ip} at nginx for {BLOCK_SECONDS}s"


def _unblock_all():
    with _block_lock:
        _blocked.clear()
        _rewrite_blockmap()
    _nginx_reload()
    return True, "cleared all IP blocks"


# --- bad deployment (crash-loop): hold the app down so restart can't recover it ---
BAD_DEPLOY_SECONDS = int(os.environ.get("BAD_DEPLOY_SECONDS", "70"))
APP_CONTAINER = os.environ.get("APP_CONTAINER", "shopsmart_app")
_baddeploy = {"until": 0}


def _bad_deploy():
    import docker
    client = docker.from_env()
    _baddeploy["until"] = time.time() + BAD_DEPLOY_SECONDS

    def _loop():
        while time.time() < _baddeploy["until"]:
            try:
                c = client.containers.get(APP_CONTAINER)
                if c.status == "running":
                    c.stop(timeout=1)  # knock it back down -> simulates a crash-loop
            except Exception:
                pass
            time.sleep(2)
    threading.Thread(target=_loop, daemon=True).start()
    return True, (f"bad deployment: {APP_CONTAINER} will crash-loop for "
                  f"{BAD_DEPLOY_SECONDS}s (restart won't stick -> escalation)")


# --- button attack generation (real requests via internal 8443 + X-Forwarded-For) ---
# Generates REAL load so nginx rate-limits / 404s for real; only the source IP is a
# chosen (documentation-range) value, so the Doctor blocks THAT ip, not the agent.
ATTACK_SITE = os.environ.get("ATTACK_SITE", "https://shopsmart-aisre.duckdns.org:8443")
ATTACK_SRC_IP = os.environ.get("ATTACK_SRC_IP", "203.0.113.66")  # TEST-NET-3, clearly fake
ATTACK_SECONDS = int(os.environ.get("ATTACK_SECONDS", "20"))
ATTACK_WORKERS = int(os.environ.get("ATTACK_WORKERS", "12"))
ATTACK_KINDS = {"flood", "brute_force", "scan"}


def _attack(kind):
    import requests as rq
    until = time.time() + ATTACK_SECONDS
    hdr = {"X-Forwarded-For": ATTACK_SRC_IP, "User-Agent": "ai-sre-redteam/own-site"}

    def worker():
        s = rq.Session()
        s.verify = False
        while time.time() < until:
            try:
                if kind == "flood":
                    s.get(f"{ATTACK_SITE}/api/products", headers=hdr, timeout=4)
                elif kind == "brute_force":
                    s.post(f"{ATTACK_SITE}/api/auth/login", headers=hdr,
                           json={"email": "admin@shopsmart.com", "password": "guess"}, timeout=4)
                elif kind == "scan":
                    p = "".join(random.choice("abcdefghijklmnop") for _ in range(8))
                    s.get(f"{ATTACK_SITE}/api/{p}", headers=hdr, timeout=4)
            except Exception:
                pass
    workers = ATTACK_WORKERS if kind == "flood" else max(3, ATTACK_WORKERS // 3)
    for _ in range(workers):
        threading.Thread(target=worker, daemon=True).start()
    return True, f"{kind} attack from {ATTACK_SRC_IP} for {ATTACK_SECONDS}s"


# --- security scan: real npm audit (dependency CVEs) in the app container ---
# The app's package.json / package-lock.json live at its WORKDIR (default
# /usr/src/app for the ShopSmart backend image); npm audit must run there.
APP_WORKDIR = os.environ.get("APP_WORKDIR", "/usr/src/app")


def _security_scan():
    import docker
    client = docker.from_env()
    out = {}
    try:
        r = client.containers.get(APP_CONTAINER).exec_run(
            "npm audit --json", workdir=APP_WORKDIR)
        data = json.loads(r.output.decode(errors="ignore") or "{}")
        v = (data.get("metadata") or {}).get("vulnerabilities") or {}
        out["npm_audit"] = {"critical": v.get("critical", 0), "high": v.get("high", 0),
                            "moderate": v.get("moderate", 0), "low": v.get("low", 0),
                            "total": v.get("total", sum(v.values()) if v else 0)}
    except Exception as e:
        out["npm_audit"] = {"error": str(e)[:150]}
    out["scanned_at"] = time.time()
    return out


_last_scan = {"result": None}

# containers the Doctor may act on + report status for
_targets_env = os.environ.get("REMEDIATION_TARGETS") or os.environ.get(
    "REMEDIATION_TARGET",
    "shopsmart_app,shopsmart_nginx,shopsmart_postgres,shopsmart_redis")
CONTAINER_TARGETS = {t.strip() for t in _targets_env.split(",") if t.strip()}
CONTAINER_ACTIONS = {"restart", "stop", "start"}
INJECT_TARGETS = {"memory", "cpu", "disk"}

# bounded stress-ng recipes (each self-terminates after --timeout)
_STRESS = {
    "memory": f"stress-ng --vm 2 --vm-bytes {INJECT_VM_BYTES} --vm-keep --timeout {{t}}s",
    "cpu":    f"stress-ng --cpu {INJECT_CPU_WORKERS} --timeout {{t}}s",
    "disk":   f"stress-ng --hdd 1 --hdd-bytes {INJECT_HDD_BYTES} --timeout {{t}}s",
}

# only one injection at a time
_inject_lock = threading.Lock()
_inject_active = {"target": None, "until": 0}


def _run_container_action(action, target):
    import docker  # lazy: only needed for real runs
    client = docker.from_env()
    c = client.containers.get(target)
    getattr(c, action)()  # restart() / stop() / start()
    return f"{action} {target} issued"


def _run_injection(target):
    cmd = _STRESS[target].format(t=INJECT_SECONDS)

    def _worker():
        try:
            subprocess.run(shlex.split(cmd), timeout=INJECT_SECONDS + 15)
        except Exception:
            pass
        finally:
            with _inject_lock:
                _inject_active["target"] = None
                _inject_active["until"] = 0

    with _inject_lock:
        if _inject_active["target"]:
            return False, f"inject busy: {_inject_active['target']} until {int(_inject_active['until'])}"
        _inject_active["target"] = target
        _inject_active["until"] = time.time() + INJECT_SECONDS
    threading.Thread(target=_worker, daemon=True).start()
    return True, f"injecting {target} load for {INJECT_SECONDS}s"


@bp.route("/containers", methods=["GET"])
def containers():
    """Report the real docker status of the monitored containers so the Doctor
    can raise precise incidents (db_down, redis_down) and draw a true service map.
    Read-only; no state change, so no token required."""
    out = {}
    try:
        import docker
        client = docker.from_env()
        for name in CONTAINER_TARGETS:
            try:
                out[name] = client.containers.get(name).status  # running / exited / ...
            except Exception:
                out[name] = "missing"
    except Exception as e:
        return jsonify({"containers": {}, "error": str(e)}), 200
    return jsonify({"containers": out}), 200


@bp.route("/traffic", methods=["GET"])
def traffic():
    """Requests/sec + 5xx-rate + 429-rate since the last call, read from the nginx
    access log. The 429-rate is the attack signature — nginx's own rate limit
    shedding load. Read-only; no token needed. Returns available:false if the log
    isn't mounted into the agent."""
    try:
        size = os.stat(NGINX_ACCESS_LOG).st_size
    except OSError:
        return jsonify({"available": False, "reason": "access log not readable"}), 200

    now = time.time()
    # first call, or the log was rotated/truncated -> re-anchor, report nothing yet
    if _traffic["last_time"] is None or size < _traffic["offset"]:
        _traffic["offset"] = size
        _traffic["last_time"] = now
        return jsonify({"available": True, "requests_per_sec": 0.0, "error_rate": 0.0,
                        "rate_limited_rate": 0.0, "requests": 0, "window_s": 0,
                        "top_ip": None, "top_ip_count": 0}), 200

    elapsed = max(now - _traffic["last_time"], 0.001)
    reqs = s5xx = s429 = s404 = login429 = 0
    ips = {}           # overall top requester
    login_ips = {}     # top source of login-429s (brute-force)
    scan_ips = {}      # top source of 404s (scanner)
    try:
        with open(NGINX_ACCESS_LOG, "r", errors="ignore") as f:
            f.seek(_traffic["offset"])
            for line in f:
                m = _LINE_RE.match(line)
                if not m:
                    continue
                ip, path, status = m.group(1), m.group(2), int(m.group(3))
                reqs += 1
                ips[ip] = ips.get(ip, 0) + 1
                if status >= 500:
                    s5xx += 1
                if status == 429:
                    s429 += 1
                    if path.startswith("/api/auth/login"):
                        login429 += 1
                        login_ips[ip] = login_ips.get(ip, 0) + 1
                if status == 404:
                    s404 += 1
                    scan_ips[ip] = scan_ips.get(ip, 0) + 1
            _traffic["offset"] = f.tell()
    except OSError as e:
        return jsonify({"available": False, "reason": str(e)}), 200
    _traffic["last_time"] = now

    def _top(d):
        return max(d.items(), key=lambda x: x[1]) if d else (None, 0)
    top_ip, top_cnt = _top(ips)
    login_ip, _ = _top(login_ips)
    scan_ip, _ = _top(scan_ips)
    return jsonify({
        "available": True,
        "requests_per_sec": round(reqs / elapsed, 1),
        "error_rate": round(s5xx / reqs, 3) if reqs else 0.0,
        "rate_limited_rate": round(s429 / reqs, 3) if reqs else 0.0,
        "not_found_rate": round(s404 / reqs, 3) if reqs else 0.0,
        "login_429": login429,
        "requests": reqs, "window_s": round(elapsed, 1),
        "top_ip": top_ip, "top_ip_count": top_cnt,
        "login_top_ip": login_ip, "scan_top_ip": scan_ip,
    }), 200


@bp.route("/actions/execute", methods=["POST"])
def execute():
    # auth
    if not AGENT_TOKEN or request.headers.get("X-Agent-Token") != AGENT_TOKEN:
        return jsonify({"success": False, "output": "unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    atype = (data.get("type") or "").strip()
    target = (data.get("target") or "").strip()

    # validate whitelist
    is_container = atype in CONTAINER_ACTIONS and target in CONTAINER_TARGETS
    is_inject = atype == "inject" and target in INJECT_TARGETS
    is_block = atype == "block_ip" and bool(_IP_RE.match(target))
    is_unblock = atype == "unblock_all"
    # demo-only chaos triggers (invoked from the Chaos Lab, not by remediation):
    is_baddeploy = atype == "bad_deploy"                       # crash-loop -> escalation
    is_attack = atype == "attack" and target in ATTACK_KINDS   # flood / brute_force / scan
    is_scan = atype == "security_scan"                         # run npm audit now
    if not (is_container or is_inject or is_block or is_unblock
            or is_baddeploy or is_attack or is_scan):
        return jsonify({"success": False,
                        "output": f"not whitelisted: {atype} {target}"}), 200

    if DRY_RUN:
        if is_inject:
            verb = _STRESS[target].format(t=INJECT_SECONDS)
        elif is_block:
            verb = f"block {target} at nginx for {BLOCK_SECONDS}s"
        elif is_unblock:
            verb = "clear all IP blocks"
        elif is_baddeploy:
            verb = f"crash-loop {APP_CONTAINER} for {BAD_DEPLOY_SECONDS}s"
        elif is_attack:
            verb = f"generate {target} traffic from {ATTACK_SRC_IP} for {ATTACK_SECONDS}s"
        elif is_scan:
            verb = "run npm audit in the app container"
        else:
            verb = f"{atype} {target}"
        return jsonify({"success": True, "output": f"DRY_RUN: would {verb}"}), 200

    try:
        if is_container:
            out = _run_container_action(atype, target)
        elif is_inject:
            ok, out = _run_injection(target)
            return jsonify({"success": ok, "output": out}), 200
        elif is_block:
            ok, out = _block_ip(target)
            return jsonify({"success": ok, "output": out}), 200
        elif is_unblock:
            ok, out = _unblock_all()
            return jsonify({"success": ok, "output": out}), 200
        elif is_baddeploy:
            ok, out = _bad_deploy()
            return jsonify({"success": ok, "output": out}), 200
        elif is_attack:
            ok, out = _attack(target)
            return jsonify({"success": ok, "output": out}), 200
        else:  # security_scan
            _last_scan["result"] = _security_scan()
            return jsonify({"success": True, "output": "security scan complete",
                            "result": _last_scan["result"]}), 200
        return jsonify({"success": True, "output": out}), 200
    except Exception as e:
        return jsonify({"success": False, "output": f"error: {e}"}), 200


@bp.route("/blocks", methods=["GET"])
def blocks():
    """Currently active IP blocks (ip -> seconds remaining). Read-only."""
    now = time.time()
    with _block_lock:
        out = {ip: max(0, round(exp - now)) for ip, exp in _blocked.items()}
    return jsonify({"blocks": out}), 200


@bp.route("/security", methods=["GET"])
def security():
    """Latest dependency-vulnerability scan (real `npm audit` in the app container).
    Returns the cached result; pass ?refresh=1 to run a fresh scan now. Read-only
    (scanning changes nothing), so no token required."""
    if request.args.get("refresh") == "1" or _last_scan["result"] is None:
        _last_scan["result"] = _security_scan()
    return jsonify(_last_scan["result"]), 200
