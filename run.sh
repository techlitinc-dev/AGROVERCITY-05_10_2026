#!/usr/bin/env bash
# AGROVERCITY — run the complete project locally.
#
# Starts, in order:
#   1. Redis        :6379  (optional — weather/mandi cache, channel viewer
#                           counts and chat rate-limit need it; the API boots
#                           without it but those features degrade)
#   2. Backend API  :8000  FastAPI + real Firestore (agrovercity-bafec)
#   3. Website      :5173  React+Vite marketing site
#   4. Mobile app   :5174  Flutter app in Chrome (same codebase as Android app)
#   5. Admin portal :5175  Flutter superadmin portal
#
# Usage:
#   ./run.sh                  start everything
#   ./run.sh --no-mobile      backend + website only
#   ./run.sh --no-website     backend + mobile only
#   ./run.sh --backend-only   API (and Redis) only
#   ./run.sh --flutter-run    mobile/admin via `flutter run` (hot reload,
#                             skips the web build entirely)
#
# Web build freshness:
#   The mobile and admin apps are served from `flutter build web` output.
#   Before serving, a stamp inside build/web is compared against the app
#   sources (lib/, web/, assets/, pubspec files) and the Flutter SDK version.
#   If the bundle is missing or out of date it is rebuilt before serving.
#
# Logs: .run-logs/<component>.log — Ctrl+C stops everything.
# Optional: export GOOGLE_MAPS_API_KEY=<key> to enable the real Google Maps
# geofencing map on web (see geofence.md for how to obtain a key). Without it
# the farm-map step uses the built-in sample boundary UI.
# For the Android emulator instead of web, stop the mobile step and run:
#   cd apps/mobile && flutter run   # default API URL is http://10.0.2.2:8000/v1

set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
LOG_DIR="$ROOT/.run-logs"
mkdir -p "$LOG_DIR"

API_BASE="http://localhost:8000/v1"
MAPS_DEFINE=""
if [ -n "${GOOGLE_MAPS_API_KEY:-}" ]; then
  MAPS_DEFINE="--dart-define=GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY"
fi
WITH_REDIS=1
WITH_WEBSITE=1
WITH_MOBILE=1
WITH_ADMIN=1
USE_BUILD_WEB=1
FLUTTER_DEVICE="${FLUTTER_DEVICE:-chrome}"

for arg in "$@"; do
  case "$arg" in
    --no-redis)     WITH_REDIS=0 ;;
    --no-website)   WITH_WEBSITE=0 ;;
    --no-mobile)    WITH_MOBILE=0 ;;
    --no-admin)     WITH_ADMIN=0 ;;
    --flutter-run|--dev) USE_BUILD_WEB=0 ;;
    --headless)     FLUTTER_DEVICE="web-server" ;;
    --backend-only) WITH_WEBSITE=0; WITH_MOBILE=0; WITH_ADMIN=0 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg (try --help)" >&2; exit 2 ;;
  esac
done

# Each service runs via setsid in its own process group so cleanup can kill
# the whole tree (flutter.sh spawns dartvm/frontend_server grandchildren that
# would otherwise survive and keep holding port 5174).
PIDS=()
cleanup() {
  echo
  echo "Stopping..."
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] || continue
    kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM HUP

wait_for_port() { # port, name, timeout_s
  local port=$1 name=$2 n=${3:-60}
  for _ in $(seq "$n"); do
    (echo > "/dev/tcp/127.0.0.1/$port") 2>/dev/null && return 0
    sleep 1
  done
  echo "WARNING: $name did not open port $port within ${n}s — see $LOG_DIR/$name.log" >&2
  return 1
}

# --- Flutter web: build-if-stale, then serve -------------------------------
# A stamp file (.build_stamp + .build_stamp.sdk) is written into build/web
# after every successful build. A bundle is fresh when the stamp is newer
# than all sources that feed the build and the Flutter SDK version is
# unchanged. flutter build web wipes build/web first, so stamps are always
# rewritten after a build completes.
web_build_fresh() { # app-dir
  local dir=$1 stamp="$1/build/web/.build_stamp"
  [ -f "$stamp" ] || return 1

  # Flutter SDK upgraded since the stamped build?
  local sdk_now
  sdk_now=$(flutter --version 2>/dev/null | head -n 1 || true)
  if [ -n "$sdk_now" ] && [ "$sdk_now" != "$(cat "$stamp.sdk" 2>/dev/null || true)" ]; then
    return 1
  fi

  # Any source / asset / dependency-manifest change after the stamp?
  local p newer
  local paths=()
  for p in lib web assets; do
    [ -e "$dir/$p" ] && paths+=("$dir/$p")
  done
  paths+=("$dir/pubspec.yaml" "$dir/pubspec.lock")
  newer=$(find "${paths[@]}" -newer "$stamp" -print 2>/dev/null | head -n 1 || true)
  [ -z "$newer" ]
}

build_web_bundle() { # app-dir, component (log name)
  local dir=$1 name=$2
  echo "==> $name web build missing or out of date — rebuilding (flutter build web)"
  echo "    (this takes a few minutes — full output: $LOG_DIR/$name.log)"
  if (cd "$dir" && flutter build web --dart-define=API_BASE_URL="$API_BASE" $MAPS_DEFINE) \
      > "$LOG_DIR/$name.log" 2>&1; then
    touch "$dir/build/web/.build_stamp"
    flutter --version 2>/dev/null | head -n 1 > "$dir/build/web/.build_stamp.sdk" || true
    echo "    build complete ($(du -sh "$dir/build/web" 2>/dev/null | cut -f1))"
  else
    echo "ERROR: web build failed for ${dir#"$ROOT"/} — see $LOG_DIR/$name.log" >&2
    exit 1
  fi
}

run_flutter_web() { # app-dir, component, port
  local dir=$1 name=$2 port=$3

  if [ "$USE_BUILD_WEB" = 0 ]; then
    echo "==> Starting $name (flutter run, dev mode) on http://localhost:$port"
    echo "    (logs: $LOG_DIR/$name.log — device: $FLUTTER_DEVICE)"
    setsid bash -c 'cd "$1" && exec flutter run -d "$2" --web-port "$3" \
      --dart-define=API_BASE_URL="$4" $5 < /dev/null' \
      _ "$dir" "$FLUTTER_DEVICE" "$port" "$API_BASE" "$MAPS_DEFINE" > "$LOG_DIR/$name.log" 2>&1 &
    PIDS+=($!)
    wait_for_port "$port" "$name" 300 || true
    return
  fi

  if web_build_fresh "$dir"; then
    echo "==> Serving $name (web build is up to date) on http://localhost:$port"
  else
    build_web_bundle "$dir" "$name"
    echo "==> Serving $name (fresh web build) on http://localhost:$port"
  fi
  setsid bash -c 'cd "$1" && exec python3 -m http.server "$2" --directory build/web' \
    _ "$dir" "$port" > "$LOG_DIR/$name.log" 2>&1 &
  PIDS+=($!)
  wait_for_port "$port" "$name" 15 || true
}

# --- 1. Redis ---------------------------------------------------------------
if [ "$WITH_REDIS" = 1 ]; then
  if (echo > /dev/tcp/127.0.0.1/6379) 2>/dev/null; then
    echo "==> Redis already running on :6379"
  elif command -v redis-server >/dev/null; then
    redis-server --daemonize yes --port 6379
    echo "==> Redis started (system binary)"
  elif [ -x /tmp/redis-local/usr/bin/redis-server ]; then
    LD_LIBRARY_PATH=/tmp/redis-local/usr/lib/x86_64-linux-gnu \
      /tmp/redis-local/usr/bin/redis-server --daemonize yes --port 6379 --dir /tmp/redis-local
    echo "==> Redis started (/tmp/redis-local)"
  else
    echo "==> WARNING: no redis-server found — continuing without it" >&2
    echo "    (weather/mandi cache, live-channel viewer counts and chat" >&2
    echo "     rate-limit will not work; restore via scripts or apt)" >&2
  fi
fi

# --- 2. Backend API ---------------------------------------------------------
echo "==> Starting backend API on http://localhost:8000 (logs: .run-logs/backend.log)"
setsid bash -c 'cd "$1" && exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000' \
  _ "$ROOT/backend" > "$LOG_DIR/backend.log" 2>&1 &
PIDS+=($!)
# NOTE: real Firestore — do NOT set FIRESTORE_EMULATOR_HOST here.
if wait_for_port 8000 backend 60; then
  curl -sf http://localhost:8000/v1/health > /dev/null \
    && echo "    API healthy: http://localhost:8000/v1/health" \
    || echo "    port open, /v1/health not OK yet (startup seeds still running)"
fi

# --- 3. Website -------------------------------------------------------------
if [ "$WITH_WEBSITE" = 1 ]; then
  echo "==> Starting website on http://localhost:5173 (logs: .run-logs/website.log)"
  # --strictPort: vite otherwise auto-increments to 5174 when 5173 is busy
  # and collides with the Flutter app's port
  setsid bash -c 'cd "$1" && exec npm run dev -- --port 5173 --strictPort' \
    _ "$ROOT/website" > "$LOG_DIR/website.log" 2>&1 &
  PIDS+=($!)
  wait_for_port 5173 website 60 || true
fi

# --- 4. Flutter mobile app -------------------------------------------------
if [ "$WITH_MOBILE" = 1 ]; then
  run_flutter_web "$ROOT/apps/mobile" mobile 5174
fi

# --- 5. Flutter admin portal -----------------------------------------------
if [ "$WITH_ADMIN" = 1 ]; then
  run_flutter_web "$ROOT/apps/admin" admin 5175
fi

echo
echo "================================================================"
echo "AGROVERCITY / Kisan Setu — All Ecosystem Services Running"
echo "================================================================"
echo "  Backend API:      http://localhost:8000/docs"
echo "  Backend Health:   http://localhost:8000/v1/health"
[ "$WITH_WEBSITE" = 1 ] && echo "  Marketing Site:   http://localhost:5173"
[ "$WITH_MOBILE" = 1 ]  && echo "  Mobile App (Web): http://localhost:5174"
[ "$WITH_ADMIN" = 1 ]   && echo "  Admin Portal:     http://localhost:5175"
echo "================================================================"
echo
echo "Tailing logs (Ctrl+C stops all services)..."
tail -f "$LOG_DIR"/*.log &
PIDS+=($!)
wait
