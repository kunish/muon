#!/bin/bash
set -euo pipefail

pids=()
names=()

start() {
  echo "Starting $1..."
  names+=("$1")
  shift
  "$@" &
  pids+=("$!")
}

cleanup() {
  trap - EXIT INT TERM
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

echo "Preparing local infrastructure..."
pnpm services:up

start "enterprise API" pnpm --filter @muon/api exec tsx src/server.ts
start "Admin Web" pnpm --filter @muon/admin exec vite --host 0.0.0.0 --port 4174
start "Electron desktop" pnpm exec electron-vite dev

while true; do
  for index in "${!pids[@]}"; do
    pid="${pids[$index]}"
    if ! kill -0 "$pid" 2>/dev/null; then
      set +e
      wait "$pid"
      status=$?
      set -e
      echo "${names[$index]} exited with status $status"
      exit "$status"
    fi
  done
  sleep 1
done
