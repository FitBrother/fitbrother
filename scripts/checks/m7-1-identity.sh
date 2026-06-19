#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── M7.1 identity checks ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m7-1-identity.sql
echo "── done ──"
