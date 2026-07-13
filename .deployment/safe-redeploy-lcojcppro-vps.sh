#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT="${PROJECT:-dmoj}"
APP_DIR="${APP_DIR:-/opt/lcoj-cppro/dmoj}"
LOG="${LOG:-/opt/lcoj-cppro-safe-redeploy.log}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/lcoj-cppro/backups}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
RUN_BACKUP_DIR="$BACKUP_ROOT/$RUN_ID"
DB_BACKUP="$RUN_BACKUP_DIR/dmoj.sql.gz"
RECOVERY_ARMED=0
DEPLOY_SUCCEEDED=0

cd "$APP_DIR"
mkdir -p "$(dirname "$LOG")"
touch "$LOG"
chmod 600 "$LOG"
exec > >(tee -a "$LOG") 2>&1

compose() {
  docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.override.yml "$@"
}

preflight() {
  local command_name service container actual_project

  [[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || {
    echo "Invalid Compose project name: $PROJECT" >&2
    return 1
  }
  for command_name in docker curl tar gzip tee; do
    command -v "$command_name" >/dev/null || {
      echo "Required command is unavailable: $command_name" >&2
      return 1
    }
  done
  for service in docker-compose.yml docker-compose.override.yml environment/mysql.env environment/mysql-admin.env environment/site.env; do
    [[ -f "$service" ]] || {
      echo "Required deploy file is missing: $APP_DIR/$service" >&2
      return 1
    }
  done

  # Quiet mode validates interpolation without printing resolved environment
  # values (including secrets) into the deploy log.
  compose config --quiet
  for service in db redis site celery bridged judge wsevent nginx; do
    compose config --services | grep -Fxq "$service" || {
      echo "Required Compose service is missing: $service" >&2
      return 1
    }
  done

  # All services use fixed lcoj_* container names. Refuse to cross project
  # boundaries because `down`/`up` would otherwise target different volumes
  # while colliding with the live containers.
  for container in lcoj_mysql lcoj_redis lcoj_site lcoj_celery lcoj_bridged lcoj_judge lcoj_wsevent lcoj_nginx; do
    if docker container inspect "$container" >/dev/null 2>&1; then
      actual_project="$(docker container inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$container")"
      if [[ -z "$actual_project" || "$actual_project" != "$PROJECT" ]]; then
        echo "Container $container belongs to Compose project '${actual_project:-unknown}', expected '$PROJECT'." >&2
        return 1
      fi
    fi
  done
}

wait_for_database() {
  local attempt
  for attempt in $(seq 1 30); do
    if compose exec -T db sh -ec 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mariadb-admin ping -uroot --silent' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "MariaDB did not become ready for backup." >&2
  return 1
}

backup_database() {
  local temporary_backup="$DB_BACKUP.tmp"

  mkdir -p "$RUN_BACKUP_DIR"
  chmod 700 "$BACKUP_ROOT" "$RUN_BACKUP_DIR"
  compose exec -T db sh -ec '
    test -n "${MYSQL_ROOT_PASSWORD:-}" && test -n "${MYSQL_DATABASE:-}"
    dump_bin="$(command -v mariadb-dump || command -v mysqldump)"
    MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec "$dump_bin" \
      --single-transaction --quick --routines --events --triggers --hex-blob \
      -uroot --databases "$MYSQL_DATABASE"
  ' | gzip -9 >"$temporary_backup"
  [[ -s "$temporary_backup" ]] || {
    rm -f "$temporary_backup"
    echo "Database backup is empty." >&2
    return 1
  }
  mv "$temporary_backup" "$DB_BACKUP"
  chmod 600 "$DB_BACKUP"
  echo "Database backup ready: $DB_BACKUP"
}

recover_on_exit() {
  local status=$?
  trap - EXIT INT TERM
  if (( status != 0 && RECOVERY_ARMED == 1 && DEPLOY_SUCCEEDED == 0 )); then
    set +e
    echo "Deploy failed with status $status; restarting the existing Compose stack." >&2
    compose up -d db redis site celery bridged judge wsevent nginx
    compose ps
    echo "Automatic restart attempted. Database backup remains at: $DB_BACKUP" >&2
  fi
  exit "$status"
}

trap recover_on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

smoke_spa() {
  local path="$1"
  local output="$2"
  local attempt

  for attempt in $(seq 1 30); do
    if curl -fsSL --max-time 10 "http://127.0.0.1:${NGINX_PORT:-18083}${path}" >"$output" && \
      grep -Fq '<div id="root"></div>' "$output"; then
      echo "OK http://127.0.0.1:${NGINX_PORT:-18083}${path}"
      return 0
    fi
    sleep 2
  done

  echo "SPA smoke failed for ${path}" >&2
  return 1
}

ensure_static_libraries() {
  download_asset_archive "https://github.com/trinhtanphat/site-assets/archive/refs/heads/master.tar.gz" \
    "repo/resources/libs" \
    ".codex-site-assets-ready"
  download_asset_archive "https://github.com/trinhtanphat/vnoj-static/archive/refs/heads/master.tar.gz" \
    "repo/resources/vnoj" \
    ".codex-vnoj-assets-ready"
}

download_asset_archive() {
  local url="$1"
  local target="$2"
  local marker="$3"
  local tmp

  if [ -f "$target/$marker" ]; then
    return
  fi

  tmp="$(mktemp -d)"
  curl -fsSL "$url" -o "$tmp/assets.tar.gz"
  rm -rf "$target"
  mkdir -p "$target"
  tar -xzf "$tmp/assets.tar.gz" --strip-components=1 -C "$target"
  touch "$target/$marker"
  rm -rf "$tmp"
}

{
  echo "== start $(date -Is) =="
  uptime || true
  free -h || true

  echo "== preflight =="
  preflight

  echo "== prepare database backup =="
  compose up -d db redis
  wait_for_database
  backup_database
  RECOVERY_ARMED=1

  echo "== normalize scripts =="
  sed -i 's/\r$//' scripts/initialize scripts/copy_static repo/make_style.sh || true
  chmod +x scripts/initialize scripts/copy_static repo/make_style.sh || true
  bash scripts/initialize
  echo "== ensure static libraries =="
  ensure_static_libraries

  echo "== build images while the current stack remains available =="
  compose build base
  compose build site celery bridged wsevent

  echo "== stop application services for migration =="
  pkill -TERM -f /opt/lcoj-cppro-restart.log || true
  pkill -TERM -f /tmp/deploy-lcoj-cppro.sh || true
  compose stop nginx celery bridged judge wsevent site

  echo "== migrate in one-off site container =="
  compose run --rm --no-deps --entrypoint python3 site manage.py migrate --noinput

  echo "== start site for static build =="
  compose up -d site
  sleep 20

  echo "== collect static =="
  COMPOSE_EXEC_FLAGS=-T bash scripts/copy_static

  echo "== start remaining services =="
  # The bridge accepts submission jobs, but the judge process consumes them.
  # Keep both services in the standard deploy so submissions never remain QU.
  compose up -d celery bridged judge wsevent nginx

  echo "== smoke =="
  compose ps
  smoke_spa / /tmp/lcojcppro-home.html
  smoke_spa /management /tmp/lcojcppro-management.html
  smoke_spa /accounts/login/ /tmp/lcojcppro-login.html
  smoke_spa /accounts/register/ /tmp/lcojcppro-register.html
  smoke_spa /accounts/logout/ /tmp/lcojcppro-logout.html

  DEPLOY_SUCCEEDED=1
  echo "== finish $(date -Is) =="
  uptime || true
  free -h || true
}
