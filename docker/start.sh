#!/bin/bash
set -e
echo "Starting Muon services..."
docker compose -f docker/docker-compose.yml up -d
echo "Waiting for Conduit to be ready..."
until curl -sf http://localhost:6167/_matrix/client/versions > /dev/null 2>&1; do
  sleep 1
done
echo "Conduit ready."
echo "Creating MinIO bucket..."
docker compose -f docker/docker-compose.yml exec -T minio \
  mc alias set local http://localhost:9000 muon muon12345 2>/dev/null || true
docker compose -f docker/docker-compose.yml exec -T minio \
  mc mb local/muon-media 2>/dev/null || true
echo "All services ready!"
echo "  Matrix:  http://localhost:6167"
echo "  LiveKit: ws://localhost:7881"
echo "  MinIO:   http://localhost:9001 (console)"
