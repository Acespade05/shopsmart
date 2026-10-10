# Enable real self-healing (Doctor actually restarts the site)

This adds ONE endpoint to the ShopSmart agent so the Doctor can run
`docker restart shopsmart_app`. After this, a real outage is auto-recovered.

The file `patient-metrics-agent/remediation_api.py` goes in the **ShopSmart
repo**. Deploy order: test in dry-run first, then flip to live.

---

## Step 1 — add the file
Copy `remediation_api.py` into `patient-metrics-agent/` (next to `collector.py`)
in your ShopSmart repo.

## Step 2 — register it in `patient-metrics-agent/collector.py`
Right after the line `app = Flask(__name__)`, add:
```python
from remediation_api import bp as remediation_bp
app.register_blueprint(remediation_bp)
```

## Step 3 — add the dependency in `patient-metrics-agent/requirements.txt`
Append:
```
docker==7.1.0
```

## Step 4 — give the agent Docker access + config in `docker-compose.yml`
Under the `patient-metrics-agent` service, add the socket mount and env
(keep DRY_RUN **true** for the first deploy):
```yaml
  patient-metrics-agent:
    build: ./patient-metrics-agent
    container_name: shopsmart_metrics_agent
    restart: unless-stopped
    logging: *default-logging
    ports:
      - "8080:8080"
    volumes:
      - metrics_data:/data
      - /var/run/docker.sock:/var/run/docker.sock      # lets it restart containers
    environment:
      AGENT_TOKEN: ${AGENT_TOKEN}
      AGENT_DRY_RUN: "true"          # <-- true = test; set "false" for real restarts
      REMEDIATION_TARGET: shopsmart_app
```

## Step 5 — set the shared secret in ShopSmart `.env`
Use the SAME value as the Doctor's `.env` `AGENT_TOKEN`:
```
AGENT_TOKEN=<the-same-long-random-secret-as-the-doctor>
```
Generate one: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
(Put this exact value in the Doctor's `.env` AGENT_TOKEN too.)

## Step 6 — deploy on the VM
```bash
git pull
docker compose up -d --build
```

## Step 7 — open 8080 to the Doctor
In the AWS security group, port 8080 must be reachable from wherever the Doctor
runs (your laptop IP for now, or the Doctor VM's IP later). You already opened
this earlier for metrics.

---

## Step 8 — DRY-RUN test (nothing really restarts yet)
With the Doctor running and `AGENT_DRY_RUN: "true"`:
```bash
docker stop shopsmart_app        # real outage: site is 502 for everyone
```
Watch the dashboard: Doctor detects `site_down`, diagnoses it, and the
remediation action now shows **done — DRY_RUN: would restart shopsmart_app**
(no more 404). Because it's dry-run, the site stays down → after 2 attempts it
escalates. Then bring it back yourself: `docker start shopsmart_app`.

If the action shows `done` (not 404, not failed), the pipeline is wired.

## Step 9 — GO LIVE (real self-healing)
In `docker-compose.yml`, change `AGENT_DRY_RUN: "false"`, then:
```bash
docker compose up -d --build
```
Make sure the Doctor's `.env` has `AUTO_REMEDIATE=true` (it does by default).

Now the real test:
```bash
docker stop shopsmart_app        # site goes down for everyone
```
- Within ~10s the Doctor detects + diagnoses.
- It calls the agent → agent runs `docker restart shopsmart_app`.
- The site comes **back on its own** — check from your phone.
- The incident flips to **resolved · auto-remediated** with a duration (MTTR).

That is end-to-end self-healing: real outage → AI restores it → verified.

---

## Safety recap
- Agent runs ONLY whitelisted `(restart, shopsmart_app)` — no arbitrary commands.
- Token required on every call; 8080 firewalled to the Doctor only.
- The Docker socket is powerful — that's why it's gated by token + whitelist +
  firewall, and why you test in dry-run first.
- To pause auto-healing at any time: set the Doctor's `AUTO_REMEDIATE=false`
  (it will then only recommend + escalate), or set the agent back to dry-run.
