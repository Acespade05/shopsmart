#!/usr/bin/env bash
# Deploy the latest code from GitHub to this server.
#
#   ./deploy.sh            pull, rebuild, migrate, restart nginx, health-check
#   ./deploy.sh --force    same, even if there are no new commits
#   ./deploy.sh --seed     also run the catalog seed (only when a release says so)
#
# Stops at the first failure and says what went wrong.
set -euo pipefail

DOMAIN="shopsmart-aisre.duckdns.org"
FORCE=false
SEED=false
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --seed) SEED=true ;;
    *) echo "Unknown option: $arg (use --force or --seed)"; exit 2 ;;
  esac
done

cd "$(dirname "$0")"

step() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }
ok()   { printf '\033[0;32m    ✓ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

step "Checking configuration"
[ -f .env ] || fail ".env is missing. Create it first (see .env.example)."
grep -Eq '^JWT_SECRET=.{16,}' .env || fail "JWT_SECRET in .env is missing or too short."
grep -Eq '^SYNTHETIC_BOT_PASSWORD=.{12,}' .env || echo "    ! SYNTHETIC_BOT_PASSWORD is not set in .env — traffic bots will browse but never sign in or buy."
ok ".env looks good"

step "Pulling latest code from GitHub"
BEFORE=$(git rev-parse --short HEAD)
# nginx writes logs/nginx/error.log; older checkouts tracked it, which blocks pulls.
if git ls-files --error-unmatch logs/nginx/error.log >/dev/null 2>&1 && ! git diff --quiet -- logs/nginx/error.log; then
  cp logs/nginx/error.log /tmp/nginx-error.log.bak
  git checkout -- logs/nginx/error.log
fi
if ! git pull --ff-only; then
  fail "git pull failed. Run 'git status' to see what is blocking it."
fi
AFTER=$(git rev-parse --short HEAD)
if [ -f /tmp/nginx-error.log.bak ] && [ ! -f logs/nginx/error.log ]; then
  mkdir -p logs/nginx && mv /tmp/nginx-error.log.bak logs/nginx/error.log
fi
if [ "$BEFORE" = "$AFTER" ] && [ "$FORCE" = false ]; then
  ok "Already up to date at $AFTER: $(git log -1 --format=%s)"
  echo "    Nothing new on GitHub. Did you push from your laptop? (Use --force to rebuild anyway.)"
  exit 0
fi
ok "$BEFORE → $AFTER: $(git log -1 --format=%s)"

step "Building and starting containers"
docker compose up -d --build
ok "Containers started"

step "Waiting for the backend"
for i in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    ok "Backend is up"
    break
  fi
  [ "$i" = 30 ] && { docker compose logs app --tail 30; fail "Backend did not start (logs above)."; }
  sleep 2
done

step "Running database migrations"
docker compose exec -T app npm run migrate
ok "Migrations done"

if [ "$SEED" = true ]; then
  step "Running catalog seed"
  docker compose exec -T app npm run seed
  ok "Seed done"
fi

step "Restarting nginx"
docker compose restart nginx
sleep 3
ok "nginx restarted"

step "Checking the live site"
CODE=$(curl -s -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/categories" || true)
[ "$CODE" = "200" ] || { docker compose ps; fail "https://$DOMAIN/api/categories returned $CODE"; }
ok "https://$DOMAIN is serving (API 200)"

docker compose ps --format 'table {{.Service}}\t{{.Status}}'
printf '\n\033[1;32mDeployed %s: %s\033[0m\n' "$AFTER" "$(git log -1 --format=%s)"
