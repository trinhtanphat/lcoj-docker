#!/usr/bin/env bash
set -euo pipefail

echo "== system load =="
uptime || true
free -h || true
df -h / /var/lib/docker || true

echo "== top processes =="
ps -eo pid,ppid,stat,pcpu,pmem,cmd --sort=-pcpu | head -30 || true

echo "== stop only the new LCOJ/CPPRO deploy =="
pkill -TERM -f /opt/lcoj-cppro-restart.log || true
pkill -TERM -f /tmp/deploy-lcoj-cppro.sh || true

if [ -d /opt/lcoj-cppro/dmoj ]; then
  cd /opt/lcoj-cppro/dmoj
  docker compose -p lcojcppro -f docker-compose.yml -f docker-compose.override.yml down || true
fi

echo "== restart ssh =="
systemctl restart ssh || systemctl restart sshd || service ssh restart || service sshd restart || true

echo "== remaining containers =="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true

echo "== final load =="
uptime || true
free -h || true
