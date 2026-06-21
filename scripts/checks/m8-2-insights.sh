#!/usr/bin/env bash
# M8.2 insights — checks SQL via psql. Pré: supabase local up.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
echo "── M8.2 insights checks ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m8-2-insights.sql
echo "── done ──"
