#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.production.compose}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/docker-compose.prod.yml}"

cd "$REPO_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

get_env_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true
}

APP_DOMAIN="${APP_DOMAIN:-$(get_env_value APP_DOMAIN)}"
APP_URL="${APP_URL:-}"

if [[ -z "$APP_URL" && -n "$APP_DOMAIN" ]]; then
  APP_URL="https://${APP_DOMAIN}"
fi

print_usage() {
  cat <<EOF
Usage: ./deploy/scripts/prod-ops.sh <command> [args]

Commands:
  status              Show container status and public health checks
  ps                  Show docker compose status only
  up                  Start production stack
  rebuild             Rebuild and start production stack
  restart [service]   Restart all services or one service
  logs [service] [n]  Show recent logs, default service=all, n=100
  follow [service]    Follow logs, default service=backend
  migrate             Run prisma migrate job once
  health              Check public frontend and backend health URLs
  help                Show this help

Examples:
  ./deploy/scripts/prod-ops.sh status
  ./deploy/scripts/prod-ops.sh up
  ./deploy/scripts/prod-ops.sh rebuild
  ./deploy/scripts/prod-ops.sh logs backend 200
  ./deploy/scripts/prod-ops.sh follow caddy
EOF
}

require_app_url() {
  if [[ -z "$APP_URL" ]]; then
    echo "APP_DOMAIN is not set in $ENV_FILE, cannot run public health check." >&2
    exit 1
  fi
}

show_public_health() {
  require_app_url

  echo "==> Frontend HEAD: ${APP_URL}"
  curl -fsSI "$APP_URL" || return 1
  echo

  echo "==> Backend health: ${APP_URL}/api/v1/health"
  curl -fsS "${APP_URL}/api/v1/health" || return 1
  echo
}

cmd="${1:-status}"

case "$cmd" in
  status)
    compose ps
    echo
    show_public_health
    ;;
  ps)
    compose ps
    ;;
  up)
    compose up -d
    ;;
  rebuild)
    compose up -d --build
    ;;
  restart)
    if [[ $# -ge 2 ]]; then
      compose restart "$2"
    else
      compose restart
    fi
    ;;
  logs)
    service="${2:-}"
    lines="${3:-100}"
    if [[ -n "$service" ]]; then
      compose logs --tail="$lines" "$service"
    else
      compose logs --tail="$lines"
    fi
    ;;
  follow)
    service="${2:-backend}"
    compose logs -f "$service"
    ;;
  migrate)
    compose run --rm migrate
    ;;
  health)
    show_public_health
    ;;
  help|-h|--help)
    print_usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    echo
    print_usage
    exit 1
    ;;
esac
