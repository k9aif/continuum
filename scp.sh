#!/usr/bin/env bash
# Deploy k9x_continuum to RHEL via SCP
# Usage: bash scp.sh
# Config: set RHEL_HOST and RHEL_DEPLOY_DIR in .env or export them
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -f "$SCRIPT_DIR/.env" ] && export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)

RHEL_HOST="${RHEL_HOST:-}"
DEPLOY_DIR="${RHEL_DEPLOY_DIR:-/home/k9x_ecosystem/k9x_continuum}"

if [ -z "$RHEL_HOST" ]; then
  echo "ERROR: Set RHEL_HOST in .env or export it before running."
  exit 1
fi

if [ ! -d "$SCRIPT_DIR" ]; then
  echo "ERROR: Source folder not found: $SCRIPT_DIR"
  exit 1
fi

TMP_TAR="/tmp/k9x_continuum.tar.gz"
PARENT_DIR="$(dirname "$DEPLOY_DIR")"

echo "==> Packing k9x_continuum..."
tar -czf "$TMP_TAR" \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  -C "$(dirname "$SCRIPT_DIR")" \
  k9x_continuum

echo "==> Copying to ${RHEL_HOST}:${DEPLOY_DIR}..."
ssh "$RHEL_HOST" "mkdir -p $DEPLOY_DIR"
scp "$TMP_TAR" "${RHEL_HOST}:/tmp/"
ssh "$RHEL_HOST" "tar -xzf /tmp/k9x_continuum.tar.gz -C $PARENT_DIR && rm /tmp/k9x_continuum.tar.gz"

rm -f "$TMP_TAR"

echo ""
echo "  k9x Continuum deployed"
echo "  Internal  →  http://127.0.0.1:8085"
echo "  Public    →  https://continuum.k9x.ai"
echo ""
echo "  Logs:  ssh ${RHEL_HOST} 'journalctl -u k9x-continuum -f'"
echo "  Stop:  ssh ${RHEL_HOST} 'sudo systemctl stop k9x-continuum'"
