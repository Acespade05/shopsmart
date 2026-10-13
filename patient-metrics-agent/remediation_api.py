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
import os

from flask import Blueprint, request, jsonify

AGENT_TOKEN = os.environ.get("AGENT_TOKEN", "")
DRY_RUN = os.environ.get("AGENT_DRY_RUN", "true").lower() == "true"

# Containers the agent is allowed to act on. Comma-separated; supports the old
# single REMEDIATION_TARGET too.
_targets = os.environ.get("REMEDIATION_TARGETS",
                          os.environ.get("REMEDIATION_TARGET", "shopsmart_app,shopsmart_nginx"))
TARGETS = {t.strip() for t in _targets.split(",") if t.strip()}
ALLOWED = {"restart": TARGETS, "stop": TARGETS, "start": TARGETS}

bp = Blueprint("remediation", __name__)


@bp.route("/actions/execute", methods=["POST"])
def execute():
    if not AGENT_TOKEN or request.headers.get("X-Agent-Token", "") != AGENT_TOKEN:
        return jsonify({"success": False, "output": "unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    atype, target = data.get("type"), data.get("target")

    if atype not in ALLOWED or target not in ALLOWED[atype]:
        return jsonify({"success": False,
                        "output": f"rejected: '{atype} {target}' not whitelisted"}), 200

    if DRY_RUN:
        return jsonify({"success": True, "output": f"DRY_RUN: would {atype} {target}"}), 200

    try:
        import docker
        container = docker.from_env().containers.get(target)
        getattr(container, atype)()      # restart() / stop() / start()
        return jsonify({"success": True, "output": f"{atype} {target} completed"}), 200
    except Exception as e:
        return jsonify({"success": False, "output": f"error: {e}"}), 200
