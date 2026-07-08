#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-lcojcppro}"
APP_DIR="${APP_DIR:-/opt/lcoj-cppro/dmoj}"
LOG="${LOG:-/opt/lcoj-cppro-safe-redeploy.log}"

cd "$APP_DIR"

compose() {
  docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.override.yml "$@"
}

ensure_static_libraries() {
  local font_dir="repo/resources/libs/latinmodernmath"
  local base_url="https://raw.githubusercontent.com/luyencode/site-assets/master/latinmodernmath"
  local file

  mkdir -p "$font_dir"
  for file in latinmodern-math.eot latinmodern-math.ttf latinmodern-math.woff latinmodern-math.woff2; do
    if [ ! -s "$font_dir/$file" ]; then
      curl -fsSL "$base_url/$file" -o "$font_dir/$file"
    fi
  done
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
  curl -fsS --max-time 30 http://127.0.0.1:${NGINX_PORT:-18083}/ >/tmp/lcojcppro-home.html
  grep -q 'cppro-public-shell' /tmp/lcojcppro-home.html
  echo "OK http://127.0.0.1:${NGINX_PORT:-18083}/"

  echo "== finish $(date -Is) =="
  uptime || true
  free -h || true
} 2>&1 | tee "$LOG"
