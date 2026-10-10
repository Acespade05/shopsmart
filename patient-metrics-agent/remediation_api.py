"""Remediation endpoint for the ShopSmart patient agent.

Drop this file into `patient-metrics-agent/` and register it in collector.py
(two lines — see REMEDIATION_SETUP.md). It adds ONE token-protected endpoint
that the Doctor calls to run a whitelisted action (restart shopsmart_app).

Safety, layered:
  - X-Agent-Token must match AGENT_TOKEN (no token set -> everything rejected).
  - Only whitelisted (type, target) pairs run; anything else is refused.
  - AGENT_DRY_RUN=true (default) logs the action and returns success WITHOUT
    touching Docker — so the full pipeline can be tested on prod safely.
  - Port 8080 should be firewalled to the Doctor's IP only (AWS security group).
"""
import os

from flask import Blueprint, request, jsonify

AGENT_TOKEN = os.environ.get("AGENT_TOKEN", "")
DRY_RUN = os.environ.get("AGENT_DRY_RUN", "true").lower() == "true"
# Whitelist: action type -> allowed container names. Nothing else can run.
ALLOWED = {"restart": {os.environ.get("REMEDIATION_TARGET", "shopsmart_app")}}

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
        docker.from_env().containers.get(target).restart()
        return jsonify({"success": True, "output": f"{atype} {target} completed"}), 200
    except Exception as e:
        return jsonify({"success": False, "output": f"error: {e}"}), 200
