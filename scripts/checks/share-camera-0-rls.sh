#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── RLS: foto de refeição não vaza para seguidor ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/share-camera-0-rls.sql
echo "── done ──"
