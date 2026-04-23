#!/usr/bin/env bash
# Boots the full local dev loop in one command:
#   1) surfpool (local validator + auto-deploy via txtx)
#   2) wait for RPC + program to be live
#   3) seed-local.ts (mints dummy regions/listings/boosts, writes .env.local)
#   4) Vite dev server
# Ctrl+C cleanly tears everything down.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROGRAM_ID="SBaMPg4GAto7N7LRv7vXKsS4FiNz3R9aCyVSEE2cQPa"
RPC_URL="http://127.0.0.1:8899"

SURFPOOL_PID=""
DEV_PID=""

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "==> Shutting down…"
  if [[ -n "$DEV_PID" ]] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill -TERM "$DEV_PID" 2>/dev/null || true
  fi
  if [[ -n "$SURFPOOL_PID" ]] && kill -0 "$SURFPOOL_PID" 2>/dev/null; then
    kill -TERM "$SURFPOOL_PID" 2>/dev/null || true
  fi
  sleep 0.5
  if [[ -n "$DEV_PID" ]] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill -KILL "$DEV_PID" 2>/dev/null || true
  fi
  if [[ -n "$SURFPOOL_PID" ]] && kill -0 "$SURFPOOL_PID" 2>/dev/null; then
    kill -KILL "$SURFPOOL_PID" 2>/dev/null || true
  fi
  # Catch any stragglers
  pkill -f "surfpool start" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# --- preflight ---
for bin in surfpool curl npx npm; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "! required command not found: $bin" >&2
    exit 1
  fi
done
if pgrep -f "surfpool start" >/dev/null 2>&1; then
  echo "! another surfpool instance is already running." >&2
  echo "  kill it first:  pkill -f 'surfpool start'" >&2
  exit 1
fi

# --- 1. surfpool ---
echo "==> Starting surfpool (local validator + auto-deploy)…"
(
  cd solana-space
  NO_DNA=1 exec surfpool start \
    --no-tui \
) &
SURFPOOL_PID=$!

# --- 2. wait for RPC ---
echo "==> Waiting for RPC at $RPC_URL…"
for _ in $(seq 1 60); do
  if curl -fsS -X POST -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
    "$RPC_URL" 2>/dev/null | grep -q '"result":"ok"'; then
    break
  fi
  if ! kill -0 "$SURFPOOL_PID" 2>/dev/null; then
    echo "! surfpool exited before RPC came up" >&2
    exit 1
  fi
  sleep 1
done

echo "==> Waiting for program $PROGRAM_ID to be deployed…"
for _ in $(seq 1 60); do
  if curl -fsS -X POST -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getAccountInfo\",\"params\":[\"$PROGRAM_ID\",{\"encoding\":\"base64\"}]}" \
    "$RPC_URL" 2>/dev/null | grep -q '"executable":true'; then
    break
  fi
  if ! kill -0 "$SURFPOOL_PID" 2>/dev/null; then
    echo "! surfpool exited before program was deployed" >&2
    exit 1
  fi
  sleep 1
done

# --- 3. seed ---
echo "==> Seeding dummy regions/listings/boosts…"
npx tsx solana-space/scripts/seed-local.ts

# --- 4. frontend ---
echo "==> Starting Vite dev server on http://localhost:8080 …"
npm run dev &
DEV_PID=$!

# Wait for either child to exit → triggers cleanup trap.
wait -n "$SURFPOOL_PID" "$DEV_PID" 2>/dev/null || true
