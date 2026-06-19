#!/usr/bin/env bash
# M7.3 engajamento — checks SQL via psql. Pré: supabase local up.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
echo "── M7.3 engagement checks ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m7-3-engagement.sql
echo "── done ──"
