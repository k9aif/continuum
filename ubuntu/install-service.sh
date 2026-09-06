#!/usr/bin/env bash
# Run this script on the Podman host (as root or with sudo) to install
# and enable the k9-continuum-pod systemd service.
#
# NOTE: this is the podman-pod deployment path (ubuntu/continuum-pod.yaml).
# A separate bare-metal systemd service (../k9x-continuum.service, running
# uvicorn directly from a venv) also exists in this repo as an alternative
# deployment option — don't install both at once, they'd both bind :8085.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/k9-continuum-pod.service"
TARGET="/etc/systemd/system/k9-continuum-pod.service"

echo "Installing k9-continuum-pod.service ..."
cp "$SERVICE_FILE" "$TARGET"
chmod 644 "$TARGET"

systemctl daemon-reload
systemctl enable k9-continuum-pod.service
systemctl start  k9-continuum-pod.service

echo ""
systemctl status k9-continuum-pod.service --no-pager
echo ""
echo "Done. k9-continuum-pod will now auto-start on every boot."
