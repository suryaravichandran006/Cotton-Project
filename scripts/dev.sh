#!/usr/bin/env bash
# Start backend (FastAPI, :8000) and frontend (Next.js, :3000) together.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
if [[ -z "${PYTHON:-}" ]]; then
  if [[ -x ".venv/bin/python" ]]; then
    PYTHON=".venv/bin/python"
  else
    PYTHON="python3"
  fi
fi

cleanup() {
  echo; echo "Stopping…"
  [[ -n "${BACK_PID:-}" ]] && kill "$BACK_PID" 2>/dev/null || true
  [[ -n "${FRONT_PID:-}" ]] && kill "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "▶ backend  http://localhost:${BACKEND_PORT}  (docs at /docs)"
"$PYTHON" -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT" &
BACK_PID=$!

echo "▶ frontend http://localhost:${FRONTEND_PORT}"
BACKEND_INTERNAL_URL="http://127.0.0.1:${BACKEND_PORT}" npm run dev -- --port "$FRONTEND_PORT" &
FRONT_PID=$!

if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 3) )); then
  wait -n "$BACK_PID" "$FRONT_PID"
else
  # macOS default Bash (3.2) lacks `wait -n`. Poll process liveness until one exits or interrupted.
  while kill -0 "$BACK_PID" 2>/dev/null && kill -0 "$FRONT_PID" 2>/dev/null; do
    sleep 1
  done
fi
