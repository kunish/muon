#!/bin/bash
set -e

pids=()

start() {
  echo "Starting $1..."
  shift
  "$@" &
  pids+=("$!")
}

cleanup() {
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}

trap cleanup EXIT INT TERM

echo "Preparing local infrastructure..."
pnpm services:up

start "enterprise API" pnpm dev:api
start "Admin Web" pnpm dev:admin
start "Electron desktop" pnpm dev:desktop

while true; do
  for pid in "${pids[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid"
      exit $?
    fi
  done
  sleep 1
done
