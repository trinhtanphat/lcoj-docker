#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-lcojcppro}"
APP_DIR="${APP_DIR:-/opt/lcoj-cppro/dmoj}"
LOG="${LOG:-/opt/lcoj-cppro-safe-redeploy.log}"

cd "$APP_DIR"

compose() {
  docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.override.yml "$@"
}

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

  echo "== normalize scripts =="
  sed -i 's/\r$//' scripts/initialize scripts/copy_static repo/make_style.sh || true
  chmod +x scripts/initialize scripts/copy_static repo/make_style.sh || true
  bash scripts/initialize
  echo "== ensure static libraries =="
  ensure_static_libraries

  echo "== stop previous $PROJECT =="
  pkill -TERM -f /opt/lcoj-cppro-restart.log || true
  pkill -TERM -f /tmp/deploy-lcoj-cppro.sh || true
  compose down || true

  echo "== build images =="
  compose build base
  compose build site celery bridged wsevent

  echo "== start db and redis only =="
  compose up -d db redis
  sleep 45

  echo "== migrate in one-off site container =="
  compose run --rm --no-deps --entrypoint python3 site manage.py migrate --noinput

  echo "== start site for static build =="
  compose up -d site
  sleep 20

  echo "== collect static =="
  COMPOSE_EXEC_FLAGS=-T bash scripts/copy_static

  echo "== start remaining services =="
  compose up -d celery bridged wsevent nginx

  echo "== smoke =="
  compose ps
  smoke_spa / /tmp/lcojcppro-home.html
  smoke_spa /management /tmp/lcojcppro-management.html
  smoke_spa /accounts/login/ /tmp/lcojcppro-login.html
  smoke_spa /accounts/register/ /tmp/lcojcppro-register.html
  smoke_spa /accounts/logout/ /tmp/lcojcppro-logout.html

  echo "== finish $(date -Is) =="
  uptime || true
  free -h || true
} 2>&1 | tee "$LOG"
