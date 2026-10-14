AI-SRE — Phase 2b: shopsmart side (agent block action + nginx denylist)
=======================================================================
Extract INTO your shopsmart repo, overwriting:
  nginx/nginx.conf                       -> adds  include /etc/nginx/blocklist.conf;
  nginx/blocklist.conf                   -> NEW empty denylist (the agent writes here)
  patient-metrics-agent/remediation_api.py -> block_ip / unblock_all / /blocks + auto-expire

  cd ~/Desktop/shopsmart
  unzip -o ~/Downloads/shopsmart-phase2b.zip -d .

ONE MORE EDIT — docker-compose.yml (mount the denylist so nginx reads it and the
agent writes it). Add ONE line to EACH service's volumes:

  nginx:
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./logs/nginx:/var/log/nginx
      - ./nginx/blocklist.conf:/etc/nginx/blocklist.conf:ro     # <-- ADD

  patient-metrics-agent:
    volumes:
      - metrics_data:/data
      - /var/run/docker.sock:/var/run/docker.sock
      - ./logs/nginx:/var/log/nginx:ro
      - ./nginx/blocklist.conf:/etc/nginx/blocklist.conf:rw     # <-- ADD

Then git-flow it:
  git add nginx/nginx.conf nginx/blocklist.conf patient-metrics-agent/remediation_api.py docker-compose.yml
  git commit -m "agent: dynamic IP block_ip at nginx denylist"
  git push
  # on the VM:
  git pull && docker compose up -d --build

VERIFY on the VM:  curl -s localhost:8080/blocks   ->  {"blocks":{}}

SAFETY: a block auto-expires after BLOCK_SECONDS (default 120s), so nobody is
banned permanently. The dashboard Chaos Lab also has a "Clear IP blocks" button.
Because your Doctor runs on the same laptop you attack from, during a block the
Founder business numbers may briefly show "unreachable" (your probe IP is the one
blocked) — cosmetic, clears when the block lifts. On a separate Doctor VM this
doesn't happen.
