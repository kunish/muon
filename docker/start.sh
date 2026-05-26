#!/bin/bash
set -e

compose() {
  docker compose -f docker/docker-compose.yml "$@"
}

echo "Starting Muon services..."
compose up -d postgres conduit livekit minio
echo "Waiting for Conduit to be ready..."
until curl -sf http://127.0.0.1:6167/_matrix/client/versions > /dev/null 2>&1; do
  sleep 1
done
echo "Conduit ready."
echo "Creating MinIO bucket..."
compose exec -T minio mc alias set local http://localhost:9000 muon muon12345 2>/dev/null || true
compose exec -T minio mc mb local/muon-media 2>/dev/null || true
compose exec -T minio mc anonymous set download local/muon-media 2>/dev/null || true
if [ "${MUON_SKIP_SEED:-0}" != "1" ]; then
  echo "Seeding Conduit mock data..."
  pnpm services:seed
else
  echo "Skipping Conduit mock data seed."
fi
echo "All services ready!"
echo "  Matrix:  http://127.0.0.1:6167"
echo "  Postgres: 127.0.0.1:5432"
echo "  LiveKit: ws://localhost:7881"
echo "  MinIO:   http://localhost:9001 (console)"
