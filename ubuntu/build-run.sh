#!/usr/bin/env bash
# k9x_continuum — Podman build and deploy helper
# Run from any directory on the Podman host (no sudo needed — script handles it).
#
# Commands:
#   build   — build the k9x-continuum container image
#   secret  — store the Postgres password as a Podman secret
#   up      — deploy k9-continuum-pod (1 container)
#   down    — stop and remove the pod
#   status  — show pod and container status
#   logs    — tail app-backend logs
#   all     — build + secret + up in one step

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE="k9x-continuum:latest"
POD_NAME="k9-continuum-pod"

cmd="${1:-help}"

case "$cmd" in

  build)
    echo "Building $IMAGE ..."
    cd "$PROJECT_DIR"
    sudo podman build -t "$IMAGE" -f ubuntu/Containerfile .
    echo "Build complete: $IMAGE"
    ;;

  secret)
    ENV_FILE="$PROJECT_DIR/.env"
    [[ -f "$ENV_FILE" ]] || { echo "Error: $ENV_FILE not found."; exit 1; }
    PG_PW=$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')
    if [[ -z "$PG_PW" ]]; then
      echo "Error: POSTGRES_PASSWORD not found in .env"; exit 1
    fi
    if sudo podman secret exists continuum-pg-password 2>/dev/null; then
      sudo podman secret rm continuum-pg-password
    fi
    printf '%s' "$PG_PW" | sudo podman secret create continuum-pg-password -
    echo "Secret 'continuum-pg-password' stored."
    ;;

  up)
    echo "Deploying pod: $POD_NAME (1 container) ..."
    sudo podman play kube "$SCRIPT_DIR/continuum-pod.yaml" --replace
    echo ""
    echo "Pod running. Containers:"
    sudo podman ps --filter "pod=$POD_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Command}}"
    echo ""
    HOST_IP=$(hostname -I | awk '{print $1}')
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  k9x_continuum"
    echo "  Web UI:  http://${HOST_IP}:8085/"
    echo "  Health:  http://${HOST_IP}:8085/health"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Logs:"
    echo "  sudo podman logs -f ${POD_NAME}-app-backend"
    ;;

  down)
    echo "Stopping pod: $POD_NAME ..."
    sudo podman play kube "$SCRIPT_DIR/continuum-pod.yaml" --down || true
    echo "Pod stopped."
    ;;

  status)
    echo "=== Pod ==="
    sudo podman pod ps --filter "name=$POD_NAME"
    echo ""
    echo "=== Containers ==="
    sudo podman ps -a --filter "pod=$POD_NAME" \
      --format "table {{.Names}}\t{{.Status}}\t{{.RestartCount}}\t{{.Command}}"
    ;;

  logs)
    sudo podman logs -f "${POD_NAME}-app-backend"
    ;;

  all)
    "$0" build
    "$0" secret
    "$0" up
    ;;

  help|*)
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  build   — build the Podman image ($IMAGE)"
    echo "  secret  — store the Postgres password as a Podman secret"
    echo "  up      — deploy $POD_NAME (1 container)"
    echo "  down    — stop and remove the pod"
    echo "  status  — show pod and container status"
    echo "  logs    — tail app-backend logs"
    echo "  all     — build + secret + up in one step"
    ;;

esac
