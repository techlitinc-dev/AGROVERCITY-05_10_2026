#!/usr/bin/env bash
# AGROVERCITY — start backend (FastAPI) + website (Vite) on the server.
#
# Usage:
#   ./run.sh          # dev mode: uvicorn --reload + vite dev server
#   ./run.sh prod     # prod mode: build the site once, serve it with vite preview
#
# Env overrides: IP, BACKEND_PORT, WEBSITE_PORT, MODE
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
WEBSITE_DIR="$ROOT_DIR/website"
SUPERADMIN_DIR="$ROOT_DIR/superadmin"

IP="${IP:-65.20.92.22}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
WEBSITE_PORT="${WEBSITE_PORT:-5173}"
SUPERADMIN_PORT="${SUPERADMIN_PORT:-5174}"
MODE="${1:-${MODE:-dev}}"

mkdir -p "$ROOT_DIR/logs"
BACKEND_LOG="$ROOT_DIR/logs/backend.log"
WEBSITE_LOG="$ROOT_DIR/logs/website.log"
SUPERADMIN_LOG="$ROOT_DIR/logs/superadmin.log"

PID_BACKEND=""
PID_WEBSITE=""
PID_SUPERADMIN=""
CLEANED_UP=0

cleanup() {
  [ "$CLEANED_UP" = "1" ] && return
  CLEANED_UP=1
  echo ""
  echo "Stopping services ..."
  # Each service runs in its own process group (setsid), so kill the whole
  # group — this takes down wrapper-spawned children (pnpm->vite, uvicorn reload).
  [ -n "$PID_BACKEND" ] && kill -- "-$PID_BACKEND" 2>/dev/null || true
  [ -n "$PID_WEBSITE" ] && kill -- "-$PID_WEBSITE" 2>/dev/null || true
  [ -n "$PID_SUPERADMIN" ] && kill -- "-$PID_SUPERADMIN" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "Stopped."
}
trap cleanup INT TERM EXIT

# --- preflight ---
if [ ! -d "$BACKEND_DIR/.venv" ] || [ ! -d "$WEBSITE_DIR/node_modules" ] || [ ! -d "$SUPERADMIN_DIR/node_modules" ]; then
  echo "Dependencies missing — run ./install.sh first." >&2
  exit 1
fi

echo "=== AGROVERCITY ($MODE mode) ==="
echo "Backend    : 0.0.0.0:$BACKEND_PORT   (log: $BACKEND_LOG)"
echo "Website    : 0.0.0.0:$WEBSITE_PORT   (log: $WEBSITE_LOG)"
echo "Superadmin : 0.0.0.0:$SUPERADMIN_PORT   (log: $SUPERADMIN_LOG)"

# --- backend ---
# shellcheck disable=SC1091
source "$BACKEND_DIR/.venv/bin/activate"
cd "$BACKEND_DIR"
if [ "$MODE" = "prod" ]; then
  setsid uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" >"$BACKEND_LOG" 2>&1 &
else
  setsid uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload >"$BACKEND_LOG" 2>&1 &
fi
PID_BACKEND=$!
cd "$ROOT_DIR"

# --- website ---
cd "$WEBSITE_DIR"
if [ "$MODE" = "prod" ]; then
  echo "Building website ..."
  pnpm build >>"$WEBSITE_LOG" 2>&1
  setsid pnpm preview --host 0.0.0.0 --port "$WEBSITE_PORT" >>"$WEBSITE_LOG" 2>&1 &
else
  setsid pnpm dev --host 0.0.0.0 --port "$WEBSITE_PORT" >>"$WEBSITE_LOG" 2>&1 &
fi
PID_WEBSITE=$!
cd "$ROOT_DIR"

# --- superadmin ---
cd "$SUPERADMIN_DIR"
if [ "$MODE" = "prod" ]; then
  echo "Building superadmin ..."
  pnpm build >>"$SUPERADMIN_LOG" 2>&1
  setsid pnpm preview --host 0.0.0.0 --port "$SUPERADMIN_PORT" >>"$SUPERADMIN_LOG" 2>&1 &
else
  setsid pnpm dev --host 0.0.0.0 --port "$SUPERADMIN_PORT" >>"$SUPERADMIN_LOG" 2>&1 &
fi
PID_SUPERADMIN=$!
cd "$ROOT_DIR"

# --- health check / early failure detection ---
sleep 3
if ! kill -0 "$PID_BACKEND" 2>/dev/null; then
  echo "ERROR: backend failed to start — last log lines:" >&2
  tail -n 20 "$BACKEND_LOG" >&2 || true
  exit 1
fi
if ! kill -0 "$PID_WEBSITE" 2>/dev/null; then
  echo "ERROR: website failed to start — last log lines:" >&2
  tail -n 20 "$WEBSITE_LOG" >&2 || true
  exit 1
fi
if ! kill -0 "$PID_SUPERADMIN" 2>/dev/null; then
  echo "ERROR: superadmin failed to start — last log lines:" >&2
  tail -n 20 "$SUPERADMIN_LOG" >&2 || true
  exit 1
fi

echo ""
echo "Up and running:"
echo "  Website    : http://$IP:$WEBSITE_PORT"
echo "  Superadmin : http://$IP:$SUPERADMIN_PORT"
echo "  API        : http://$IP:$BACKEND_PORT"
echo "  API docs   : http://$IP:$BACKEND_PORT/docs"
echo ""
echo "Press Ctrl+C to stop all services."
echo "(If you backgrounded this script, stop it with: kill -TERM $$)"
echo ""
echo "run.sh PID: $$"

# wait on any process; if one dies, report it
wait -n "$PID_BACKEND" "$PID_WEBSITE" "$PID_SUPERADMIN"
FAILED=$?
echo ""
echo "A service exited (code $FAILED). Recent logs:"
echo "--- backend ---"; tail -n 10 "$BACKEND_LOG" || true
echo "--- website ---"; tail -n 10 "$WEBSITE_LOG" || true
echo "--- superadmin ---"; tail -n 10 "$SUPERADMIN_LOG" || true
exit "$FAILED"
