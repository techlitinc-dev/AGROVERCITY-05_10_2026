#!/usr/bin/env bash
# AGROVERCITY — install all dependencies for local development.
#
# Installs, in order:
#   1. System toolchain (apt): python3 + venv, git, curl, zip/unzip
#      Node.js 22 (only if missing or older than v18), Flutter via snap
#      (only if missing) — plus optional Redis and Firebase CLI
#   2. Backend : python venv at backend/.venv + pip requirements,
#                copies backend/.env.example -> backend/.env on first run,
#                places any root-level *firebase-adminsdk*.json into
#                backend/secrets/, and replaces the dev JWT_SECRET with a
#                freshly generated one
#   3. Website : npm packages (website/node_modules)
#   4. Mobile  : flutter pub get (apps/mobile)
#   5. Admin   : flutter pub get (apps/admin)
#
# Usage:
#   ./install.sh                 system toolchain + all project dependencies
#   ./install.sh --skip-system   only venv/pip/npm/pub — no apt/snap/npm -g
#   ./install.sh --server        server setup: backend + website only (no
#                                Flutter/mobile/admin) — then ./run.sh
#                                --backend-only starts the API on :8000
#   ./install.sh --with-redis    also install redis-server (apt)
#   ./install.sh --with-firebase also install the Firebase CLI (npm -g)
#
# Server flow (backup from dev machine -> run on server):
#   scp backups/AGROVERCITY_*.zip user@server:~
#   ssh user@server 'unzip ~/AGROVERCITY_*.zip && cd AGROVERCITY && ./install.sh --server --with-redis'
#   ssh user@server 'cd AGROVERCITY && ./run.sh --backend-only'
# If the backup was made WITHOUT --with-secrets, drop your
# *firebase-adminsdk*.json next to install.sh (or set
# FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env) — install.sh places it.
#
# System steps target apt-based Linux (Ubuntu/Debian). On other systems the
# script still installs all project-level dependencies — install Python 3.10+,
# Node 18+ and the Flutter SDK yourself first, then use --skip-system.
#
# Secrets are never downloaded here. The backend boots only with
# backend/secrets/firebase-service-account.json present — see backend/.env.

set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"

SKIP_SYSTEM=0
WITH_REDIS=0
WITH_FIREBASE=0
SERVER=0
for arg in "$@"; do
  case "$arg" in
    --skip-system) SKIP_SYSTEM=1 ;;
    --server)      SERVER=1 ;;
    --with-redis)  WITH_REDIS=1 ;;
    --with-firebase) WITH_FIREBASE=1 ;;
    -h|--help)     sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg (try --help)" >&2; exit 2 ;;
  esac
done

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null; then
  SUDO="sudo"
fi

HAVE_APT=0
command -v apt-get >/dev/null && HAVE_APT=1

warn() { echo "WARNING: $*" >&2; }

# --- 1. System toolchain -----------------------------------------------------
if [ "$SKIP_SYSTEM" = 0 ]; then
  if [ "$HAVE_APT" = 1 ] && [ -n "$SUDO" ]; then
    echo "==> System packages (apt)"
    $SUDO apt-get update
    $SUDO apt-get install -y python3 python3-venv python3-pip git curl zip unzip
  else
    warn "apt/sudo unavailable — skipping system packages (python3, zip, ...)"
  fi

  # Node.js: Vite 6 needs Node 18+; this repo is pinned to Node 22 elsewhere.
  node_major=0
  if command -v node >/dev/null; then
    node_major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  fi
  if [ "$node_major" -lt 18 ]; then
    if [ "$HAVE_APT" = 1 ] && [ -n "$SUDO" ]; then
      echo "==> Node.js (NodeSource 22.x)"
      curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
      $SUDO apt-get install -y nodejs
    else
      warn "Node.js missing or < v18 — install Node 18+ yourself (https://nodejs.org)"
    fi
  else
    echo "==> Node.js $(node -v) — OK (>= 18)"
  fi

  # Flutter SDK (snap is how this repo's dev machine installs it).
  # Servers never build the Flutter apps — skip it in --server mode.
  if [ "$SERVER" = 0 ] && ! command -v flutter >/dev/null; then
    if command -v snap >/dev/null && [ -n "$SUDO" ]; then
      echo "==> Flutter (snap, classic)"
      $SUDO snap install flutter --classic
    else
      warn "flutter not found and snap unavailable — install the Flutter SDK"
      warn "manually (https://docs.flutter.dev/get-started/install/linux),"
      warn "then re-run: ./install.sh --skip-system"
    fi
  else
    echo "==> $(flutter --version 2>/dev/null | head -n 1) — OK"
  fi

  if [ "$WITH_REDIS" = 1 ]; then
    if [ "$HAVE_APT" = 1 ] && [ -n "$SUDO" ]; then
      echo "==> Redis (apt)"
      $SUDO apt-get install -y redis-server
    else
      warn "--with-redis requested but apt/sudo unavailable — skipping"
    fi
  fi

  if [ "$WITH_FIREBASE" = 1 ]; then
    echo "==> Firebase CLI (npm -g)"
    npm install -g firebase-tools || warn "firebase-tools install failed — optional, continuing"
  fi
fi

# --- 2. Backend ---------------------------------------------------------------
echo "==> Backend: python venv + requirements"
cd "$ROOT/backend"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    created backend/.env from .env.example"
fi
if [ ! -f secrets/firebase-service-account.json ]; then
  # Server flow: a *firebase-adminsdk*.json dropped next to install.sh (or at
  # the project root) is placed where the backend expects it.
  sa_candidate="$(ls "$ROOT"/*firebase-adminsdk*.json "$ROOT"/firebase-service-account.json 2>/dev/null | head -n 1 || true)"
  if [ -n "$sa_candidate" ]; then
    mkdir -p secrets
    cp "$sa_candidate" secrets/firebase-service-account.json
    echo "    placed $(basename "$sa_candidate") -> backend/secrets/firebase-service-account.json"
  else
    warn "backend/secrets/firebase-service-account.json is missing — the API will"
    warn "not boot without it (see FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env)."
  fi
fi
# A freshly copied .env still carries the public dev secret — rotate it once
# so tokens on this machine are actually signed by a private key.
if [ -f .env ] && grep -q '^JWT_SECRET=dev-secret-change-me$' .env; then
  new_secret="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  sed -i "s/^JWT_SECRET=dev-secret-change-me$/JWT_SECRET=$new_secret/" .env
  echo "    generated a fresh JWT_SECRET in backend/.env (was the dev default)"
fi
cd "$ROOT"

# --- 3. Website ---------------------------------------------------------------
echo "==> Website: npm packages"
(cd website && npm install)

# --- 4+5. Flutter apps ---------------------------------------------------------
if [ "$SERVER" = 1 ]; then
  echo "==> --server: skipping Flutter apps (mobile, admin)"
elif command -v flutter >/dev/null; then
  echo "==> Mobile app: flutter pub get"
  (cd apps/mobile && flutter pub get)
  echo "==> Admin portal: flutter pub get"
  (cd apps/admin && flutter pub get)
  # Fetch web artifacts now so the first `flutter build web` in run.sh is fast.
  flutter precache --web > /dev/null 2>&1 || true
else
  warn "flutter not on PATH — skipping pub get for apps/mobile and apps/admin"
fi

# --- Summary -------------------------------------------------------------------
echo
echo "================================================================"
echo "Install complete"
echo "================================================================"
python3 --version | xargs echo "  Python:   "
command -v node >/dev/null && node --version | xargs echo "  Node:     "
command -v flutter >/dev/null && flutter --version 2>/dev/null | head -n 1 | sed 's/^/  /'
command -v redis-server >/dev/null && redis-server --version | cut -d' ' -f1-3 | xargs echo "  Redis:    "
echo "================================================================"
if [ "$SERVER" = 1 ]; then
  echo "Next: ./run.sh --backend-only   (API + Redis on :8000)"
  echo "      docker compose -f infra/docker-compose.yml up -d --build   (alt.)"
else
  echo "Next: ./run.sh   (starts API :8000, website :5173, mobile :5174, admin :5175)"
fi
