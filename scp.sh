#!/usr/bin/env bash
# Deploy k9x_continnum to RHEL via SCP
# Usage: bash scp.sh
# Config: set RHEL_HOST and RHEL_DEPLOY_DIR in .env or export them
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env if present
[ -f "$SCRIPT_DIR/.env" ] && export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)

RHEL_HOST="${RHEL_HOST:-}"
DEPLOY_DIR="${RHEL_DEPLOY_DIR:-/home/k9x_ecosystem/k9x_continnum}"

if [ -z "$RHEL_HOST" ]; then
  echo "Set RHEL_HOST in .env or export it before running."
  exit 1
fi

TMP_TAR="/tmp/k9x_continnum.tar.gz"
PARENT_DIR="$(dirname "$DEPLOY_DIR")"

echo "==> Packing k9x_continnum..."
tar -czf "$TMP_TAR" \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  -C "$(dirname "$SCRIPT_DIR")" \
  k9x_continnum

echo "==> Copying to ${RHEL_HOST}:${DEPLOY_DIR}..."
ssh "$RHEL_HOST" "mkdir -p $DEPLOY_DIR"
scp "$TMP_TAR" "${RHEL_HOST}:/tmp/"
ssh "$RHEL_HOST" "tar -xzf /tmp/k9x_continnum.tar.gz -C $PARENT_DIR && rm /tmp/k9x_continnum.tar.gz"

echo "==> Copying .env..."
scp "$SCRIPT_DIR/.env" "${RHEL_HOST}:${DEPLOY_DIR}/.env"

echo "==> Setting up venv on RHEL..."
ssh "$RHEL_HOST" "cd $DEPLOY_DIR && python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt"

echo "==> Done. To start:"
echo "    ssh $RHEL_HOST 'cd $DEPLOY_DIR && bash run.sh'"
rm -f "$TMP_TAR"
