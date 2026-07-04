#!/usr/bin/env bash
# Office — server-side deploy script.
# Runs on the production server. Pulls from GitHub, rebuilds Docker images,
# applies Prisma migrations, seeds data, restarts the stack.
#
# This script is intentionally pull-only. It NEVER pushes back to GitHub.
# It NEVER runs `docker compose down -v` and NEVER runs `prisma migrate dev`.
#
# Usage:
#   ./deploy/server-deploy.sh \
#       --repo-url git@github.com:vengelst/office.git \
#       --branch main \
#       --path /opt/office
#
# Optional:
#   --force-reset    Discard local server-side changes (git reset --hard)
#   --skip-build     Skip `docker compose build`.
#   --skip-migrate   Skip `prisma migrate deploy` + `prisma db seed`.

set -euo pipefail

# ---------- Defaults ----------
REPO_URL=""
BRANCH="main"
APP_PATH="/opt/office"
FORCE_RESET=0
SKIP_BUILD=0
SKIP_MIGRATE=0

# ---------- Argparse ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-url)     REPO_URL="$2"; shift 2 ;;
    --branch)       BRANCH="$2"; shift 2 ;;
    --path)         APP_PATH="$2"; shift 2 ;;
    --force-reset)  FORCE_RESET=1; shift ;;
    --skip-build)   SKIP_BUILD=1; shift ;;
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$REPO_URL" ]]; then
  echo "ERROR: --repo-url is required" >&2
  exit 2
fi

# ---------- Helpers ----------
log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31m[deploy]\033[0m %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

require_cmd git
require_cmd docker
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin not available (need 'docker compose')"

# ---------- 1. Prepare directory ----------
if [[ ! -d "$APP_PATH" ]]; then
  log "Creating $APP_PATH"
  mkdir -p "$APP_PATH"
fi

# ---------- 2. Clone or fetch ----------
if [[ ! -d "$APP_PATH/.git" ]]; then
  log "Cloning $REPO_URL → $APP_PATH (branch $BRANCH)"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_PATH"
else
  log "Fetching $BRANCH from $REPO_URL"
  cd "$APP_PATH"
  git remote set-url origin "$REPO_URL"
  git fetch origin "$BRANCH"

  DIRTY="$(git status --porcelain | grep -v '^?? .env\.production$' || true)"
  if [[ -n "$DIRTY" ]]; then
    if [[ "$FORCE_RESET" -eq 1 ]]; then
      warn "Local changes detected — discarding because --force-reset was passed:"
      echo "$DIRTY" | sed 's/^/    /'
      git reset --hard "origin/$BRANCH"
      git clean -fd -e .env.production -e .env.local
    else
      warn "Local changes detected on the server. The server is pull-only —"
      warn "either revert them by hand, or re-run with --force-reset to discard:"
      echo "$DIRTY" | sed 's/^/    /' >&2
      fail "Aborting deploy."
    fi
  fi

  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

cd "$APP_PATH"

# ---------- 3. Verify .env.production ----------
if [[ ! -f "$APP_PATH/.env.production" ]]; then
  warn ".env.production is missing on the server."
  warn "Copy the template and fill real values:"
  warn "    cp $APP_PATH/.env.production.example $APP_PATH/.env.production"
  warn "    nano $APP_PATH/.env.production"
  warn "    chmod 600 $APP_PATH/.env.production"
  fail "Cannot deploy without .env.production."
fi

chmod 600 "$APP_PATH/.env.production" || true

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.production)

# ---------- 4. Build images ----------
if [[ "$SKIP_BUILD" -eq 0 ]]; then
  log "Building Docker images"
  "${COMPOSE[@]}" build
else
  log "Skipping image build (--skip-build)"
fi

# ---------- 5. Start infrastructure (DB + MinIO) ----------
log "Starting database and MinIO services"
"${COMPOSE[@]}" up -d postgres minio

log "Waiting for database to be healthy"
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" ps postgres | grep -q "(healthy)"; then
    break
  fi
  sleep 2
done

# ---------- 6. Start API (runs migrations + seed on startup) ----------
log "Starting API service (runs migrations + seed automatically)"
"${COMPOSE[@]}" up -d api

log "Waiting for API container to stabilize (30s)"
sleep 30

# ---------- 7. Start Web ----------
log "Starting Web service"
"${COMPOSE[@]}" up -d web

# ---------- 8. Status ----------
log "Container status"
"${COMPOSE[@]}" ps

log "Recent API logs (last 40 lines):"
"${COMPOSE[@]}" logs --tail=40 api || true

log "Recent Web logs (last 20 lines):"
"${COMPOSE[@]}" logs --tail=20 web || true

log "Deploy finished. Public URL: https://office.vivahome.de"
