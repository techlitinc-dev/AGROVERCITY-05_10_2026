#!/usr/bin/env bash
#
# Create a timestamped zip backup of the entire codebase.
# Output: AGROVERCITY_YYYY-MM-DD_HH-MM-SS.zip in ./backups/
#
# The archive contains a single top-level AGROVERCITY/ folder, so it can be
# copied to a server and unpacked cleanly:
#   scp backups/AGROVERCITY_*.zip user@server:~
#   ssh user@server 'unzip ~/AGROVERCITY_*.zip && cd AGROVERCITY && ./install.sh --server'
# (install.sh auto-detects secrets and generates a JWT secret; see its --help)
#
# Backups are COMPLETE: every project file is included — source, docs, config,
# .git history, local uploads and secrets (backend/.env, backend/secrets/,
# *firebase-adminsdk*.json, *.pem, *.key, ...). Only regenerable dependencies
# and build output (node_modules, .venv, dist/, build/, __pycache__, ...) plus
# throwaway local state (logs, OS/editor junk, the backups/ output itself) are
# skipped, so the archive can restore a fully working project.
#
# Usage:
#   ./backup.sh [output-dir] [--keep N] [--no-secrets]
#   ./backup.sh --keep 5    create a backup, then prune all but the 5 newest
#
# Use --no-secrets for an archive that is safe to share or upload; it is
# written as AGROVERCITY_<timestamp>_safe.zip so it can't be confused with
# a secrets-containing complete backup.
#
# Requires: zip, unzip (sudo apt install zip unzip — or run ./install.sh)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUTPUT_DIR="$PROJECT_ROOT/backups"
KEEP=""
NO_SECRETS=0

while [ $# -gt 0 ]; do
  case "$1" in
    --keep)        KEEP="${2:---keep requires a number}"; shift 2 ;;
    --no-secrets)  NO_SECRETS=1; shift ;;
    -h|--help)     sed -n '2,27p' "$0"; exit 0 ;;
    *)             OUTPUT_DIR="$1"; shift ;;
  esac
done

if [ -n "$KEEP" ] && ! [[ "$KEEP" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --keep requires a whole number (got '$KEEP')" >&2
  exit 1
fi

for tool in zip unzip; do
  command -v "$tool" >/dev/null \
    || { echo "ERROR: '$tool' not found — install it (sudo apt install $tool) or run ./install.sh" >&2; exit 1; }
done

mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"

if [ "$NO_SECRETS" = 1 ]; then
  ARCHIVE="$OUTPUT_DIR/${PROJECT_NAME}_${TIMESTAMP}_safe.zip"
else
  ARCHIVE="$OUTPUT_DIR/${PROJECT_NAME}_${TIMESTAMP}.zip"
fi

# Zip from the parent directory so the archive contains one top-level
# AGROVERCITY/ folder instead of loose ./ paths (unzip on the server then
# yields a clean project directory).
PARENT_DIR="$(dirname "$PROJECT_ROOT")"

# Complete backup: everything goes in (including .git, secrets and local
# uploads) except regenerable dependencies/build output and throwaway local
# state. zip's '*' matches across '/' here, so each pattern covers any depth.
EXCLUDES=(
  # Backup output — never nest old backups inside a new one
  "$PROJECT_NAME/backups/*"
  "$PROJECT_NAME/${PROJECT_NAME}_*.zip"

  # Dependencies (regenerate with install.sh / package managers)
  "$PROJECT_NAME/*/node_modules/*"
  "$PROJECT_NAME/*/.venv/*"
  "$PROJECT_NAME/*/venv/*"
  "$PROJECT_NAME/*/.dart_tool/*"
  "$PROJECT_NAME/*/.pub-cache/*"
  "$PROJECT_NAME/*/.gradle/*"
  "$PROJECT_NAME/*/Pods/*"
  "$PROJECT_NAME/*/*.egg-info/*"
  "$PROJECT_NAME/*/.eggs/*"
  "$PROJECT_NAME/*/.tox/*"
  "$PROJECT_NAME/*/target/*"

  # Build output and caches
  "$PROJECT_NAME/*/dist/*"
  "$PROJECT_NAME/*/build/*"
  "$PROJECT_NAME/*/out/*"
  "$PROJECT_NAME/*/.next/*"
  "$PROJECT_NAME/*/.nuxt/*"
  "$PROJECT_NAME/*/.output/*"
  "$PROJECT_NAME/*/.svelte-kit/*"
  "$PROJECT_NAME/*/coverage/*"
  "$PROJECT_NAME/*/.nyc_output/*"
  "$PROJECT_NAME/*/.turbo/*"
  "$PROJECT_NAME/*/.parcel-cache/*"
  "$PROJECT_NAME/*/.cache/*"
  "$PROJECT_NAME/*/.sass-cache/*"
  "$PROJECT_NAME/*/.firebase/*"
  "$PROJECT_NAME/*/.terraform/*"
  "$PROJECT_NAME/*/__pycache__/*"
  "$PROJECT_NAME/*/.pytest_cache/*"
  "$PROJECT_NAME/*/.mypy_cache/*"
  "$PROJECT_NAME/*/.ruff_cache/*"
  "$PROJECT_NAME/*/*.pyc"
  "$PROJECT_NAME/*/*.pyo"
  "$PROJECT_NAME/*/*.tsbuildinfo"
  "$PROJECT_NAME/*/.eslintcache"
  "$PROJECT_NAME/*/.stylelintcache"
  "$PROJECT_NAME/*/.flutter-plugins*"

  # Local state, logs and OS/editor junk
  "$PROJECT_NAME/.run-logs/*"
  "$PROJECT_NAME/*.log"
  "$PROJECT_NAME/.DS_Store"
  "$PROJECT_NAME/*/.DS_Store"
  "$PROJECT_NAME/*/.idea/*"
)

if [ "$NO_SECRETS" = 1 ]; then
  EXCLUDES+=(
    # Secrets and machine credentials
    "$PROJECT_NAME/.env"
    "$PROJECT_NAME/.env.*"
    "$PROJECT_NAME/*/.env"
    "$PROJECT_NAME/*/.env.*"
    "$PROJECT_NAME/*/secrets/*"
    "$PROJECT_NAME/*firebase-adminsdk*.json"
    "$PROJECT_NAME/*service-account*.json"
    "$PROJECT_NAME/*/local.properties"
    "$PROJECT_NAME/*.pem"
    "$PROJECT_NAME/*.key"
    "$PROJECT_NAME/*.p12"
    "$PROJECT_NAME/*.jks"
    "$PROJECT_NAME/*.keystore"
  )
  echo "NOTE: safe backup — secrets, credentials and .env files are excluded." >&2
else
  echo "NOTE: complete backup — archive includes secrets (backend/.env," >&2
  echo "      backend/secrets/, firebase service-account keys) and .git history." >&2
  echo "      Treat it like a private key; share only the *_safe.zip variant." >&2
fi

cd "$PARENT_DIR"
zip -r "$ARCHIVE" "$PROJECT_NAME" -x "${EXCLUDES[@]}"

echo "Backup created: $ARCHIVE"
unzip -l "$ARCHIVE" | tail -1
du -h "$ARCHIVE" | cut -f1 | xargs echo "Size:"

if [ -n "$KEEP" ]; then
  # Prune archives older than the newest $KEEP (rotation only touches this
  # project's own timestamped archives in the output dir).
  ls -1t "$OUTPUT_DIR"/"${PROJECT_NAME}"_*.zip 2>/dev/null \
    | tail -n +"$((KEEP + 1))" \
    | xargs -r rm -f || true
  echo "Pruned old backups (kept newest $KEEP)"
fi
