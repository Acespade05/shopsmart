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
import shlex
import subprocess
import threading
import time

from flask import Blueprint, request, jsonify

bp = Blueprint("remediation", __name__)

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