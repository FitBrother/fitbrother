#!/usr/bin/env bash
# M8.1 feedback — checks SQL via psql. Pré: supabase local up.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
echo "── M8.1 feedback checks ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m8-1-feedback.sql
echo "── done ──"
