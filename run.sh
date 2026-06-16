#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

source .venv/bin/activate

PORT="${REPO_PORT:-8085}"
echo "k9x Continuum → http://localhost:${PORT}"

uvicorn backend.main:app --host 0.0.0.0 --port "$PORT" --reload
