#!/usr/bin/env bash
# M5.3 social smoke checks — SQL via psql. Pré: supabase local up.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
echo "── M5.3 social checks ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m5-3-social.sql
echo "── done ──"
