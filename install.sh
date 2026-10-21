#!/usr/bin/env bash
# AGROVERCITY — one-time dependency installer for backend + website.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
WEBSITE_DIR="$ROOT_DIR/website"

echo "=== AGROVERCITY install ==="

# --- Backend (Python) ---
echo ""
echo "[1/2] Backend (Python)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found. Install Python 3.11+ first." >&2
  exit 1
fi
echo "python3: $(python3 --version)"

if [ ! -d "$BACKEND_DIR/.venv" ]; then
  echo "Creating virtualenv at backend/.venv ..."
  python3 -m venv "$BACKEND_DIR/.venv"
fi

# shellcheck disable=SC1091
source "$BACKEND_DIR/.venv/bin/activate"
pip install --upgrade pip
pip install -r "$BACKEND_DIR/requirements.txt"

# --- Website (Node/pnpm) ---
echo ""
echo "[2/2] Website (Node)"
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Install Node.js 20+ first." >&2
  exit 1
fi
echo "node: $(node --version)"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found; installing via corepack ..."
  corepack enable
  corepack prepare pnpm@latest --activate
fi
echo "pnpm: $(pnpm --version)"

cd "$WEBSITE_DIR"
pnpm install

echo ""
echo "=== Install complete ==="
echo "Backend deps : $BACKEND_DIR/.venv"
echo "Website deps : $WEBSITE_DIR/node_modules"
echo ""
echo "Next: copy backend/.env.example -> backend/.env (if not done) and website/.env.example -> website/.env,"
echo "then start everything with: ./run.sh"
