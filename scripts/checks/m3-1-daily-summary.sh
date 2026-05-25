#!/usr/bin/env bash
# M3.1 backend smoke checks — SQL via psql + HTTP via curl com JWT real.
# Pré-condições: supabase local up, server em :3000, ao menos 1 user em auth.users.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── M3.1 checks ──"

# Checks 1-6: SQL
echo "[1-6] SQL checks via psql..."
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m3-1-daily-summary.sql

# Check 7: GET /me/daily-summary sem query → resolve "hoje".
echo "[7] GET /me/daily-summary (server resolves today)..."
JWT="${TEST_USER_JWT:-}"
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set (export it from app's signed-in session)"
else
  HTTP=$(curl -s -o /tmp/m31-resp1.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    http://localhost:3000/me/daily-summary)
  if [[ "$HTTP" != "200" ]]; then
    echo "  FAIL: status $HTTP"; cat /tmp/m31-resp1.json; exit 1
  fi
  if ! grep -q '"day":"[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}"' /tmp/m31-resp1.json; then
    echo "  FAIL: response missing day field"; cat /tmp/m31-resp1.json; exit 1
  fi
  echo "  PASS"
fi

# Check 8: GET /me/daily-summary?day=2026-05-20 → row específica.
echo "[8] GET /me/daily-summary?day=2026-05-20 (past day)..."
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set"
else
  HTTP=$(curl -s -o /tmp/m31-resp2.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "http://localhost:3000/me/daily-summary?day=2026-05-20")
  if [[ "$HTTP" != "200" ]]; then
    echo "  FAIL: status $HTTP"; cat /tmp/m31-resp2.json; exit 1
  fi
  if ! grep -q '"day":"2026-05-20"' /tmp/m31-resp2.json; then
    echo "  FAIL: response day != 2026-05-20"; cat /tmp/m31-resp2.json; exit 1
  fi
  echo "  PASS"
fi

echo "── all checks done ──"
