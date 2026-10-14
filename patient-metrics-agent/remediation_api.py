"""Remediation + chaos endpoint for the ShopSmart patient agent.

Drop this file into `patient-metrics-agent/` and register it in collector.py:
    from remediation_api import bp as remediation_bp
    app.register_blueprint(remediation_bp)

The Doctor calls POST /actions/execute with {"type","target"} to run a
whitelisted container action. Supported actions: restart, stop, start.
Used both for self-healing (restart) and for the dashboard Chaos Lab
(stop/start to inject and clear a real outage).

Safety, layered:
  - X-Agent-Token must match AGENT_TOKEN (no token set -> everything rejected).
  - Only whitelisted (action, target) pairs run; anything else is refused.
  - AGENT_DRY_RUN=true logs the action and returns success WITHOUT touching
    Docker — for safe end-to-end testing.
  - Port 8080 should be firewalled to the Doctor's IP only.
"""

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
import os
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
    reqs = s5xx = s429 = 0
    ips = {}
    try:
        with open(NGINX_ACCESS_LOG, "r", errors="ignore") as f:
            f.seek(_traffic["offset"])
            for line in f:
                m = _LINE_RE.match(line)
                if not m:
                    continue
                ip, _path, status = m.group(1), m.group(2), int(m.group(3))
                reqs += 1
                if status >= 500:
                    s5xx += 1
                if status == 429:
                    s429 += 1
                ips[ip] = ips.get(ip, 0) + 1
            _traffic["offset"] = f.tell()
    except OSError as e:
        return jsonify({"available": False, "reason": str(e)}), 200
    _traffic["last_time"] = now

    top_ip, top_cnt = (max(ips.items(), key=lambda x: x[1]) if ips else (None, 0))
    return jsonify({
        "available": True,
        "requests_per_sec": round(reqs / elapsed, 1),
        "error_rate": round(s5xx / reqs, 3) if reqs else 0.0,
        "rate_limited_rate": round(s429 / reqs, 3) if reqs else 0.0,
        "requests": reqs, "window_s": round(elapsed, 1),
        "top_ip": top_ip, "top_ip_count": top_cnt,
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
    if not (is_container or is_inject):
        return jsonify({"success": False,
                        "output": f"not whitelisted: {atype} {target}"}), 200

    if DRY_RUN:
        verb = _STRESS[target].format(t=INJECT_SECONDS) if is_inject else f"{atype} {target}"
        return jsonify({"success": True, "output": f"DRY_RUN: would {verb}"}), 200

    try:
        if is_container:
            out = _run_container_action(atype, target)
        else:
            ok, out = _run_injection(target)
            return jsonify({"success": ok, "output": out}), 200
        return jsonify({"success": True, "output": out}), 200
    except Exception as e:
        return jsonify({"success": False, "output": f"error: {e}"}), 200