#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── meals.image_path ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/share-camera-1-image-path.sql
echo "── done ──"
