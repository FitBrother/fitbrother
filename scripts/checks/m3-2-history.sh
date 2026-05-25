#!/usr/bin/env bash
# M3.2 backend smoke checks — SQL via psql + HTTP via curl com JWT real.
# Pré-condições: supabase local up, server em :3000.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── M3.2 checks ──"

# Checks 1-2: SQL
echo "[1-2] SQL checks via psql..."
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m3-2-history.sql

# Check 3: 401 sem JWT.
echo "[3] GET /me/daily-summaries sem JWT..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/me/daily-summaries?from=2026-05-18&to=2026-05-24")
if [[ "$HTTP" != "401" ]]; then
  echo "  FAIL: expected 401, got $HTTP"; exit 1
fi
echo "  PASS"

JWT="${TEST_USER_JWT:-}"

# Check 4: range > 31d → 400.
echo "[4] range > 31 days → 400..."
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set"
else
  HTTP=$(curl -s -o /tmp/m32-resp4.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "http://localhost:3000/me/daily-summaries?from=2026-01-01&to=2026-03-01")
  if [[ "$HTTP" != "400" ]]; then
    echo "  FAIL: expected 400, got $HTTP"; cat /tmp/m32-resp4.json; exit 1
  fi
  if ! grep -q 'range_too_large' /tmp/m32-resp4.json; then
    echo "  FAIL: expected range_too_large error"; cat /tmp/m32-resp4.json; exit 1
  fi
  echo "  PASS"
fi

# Check 5: from > to → 400.
echo "[5] from > to → 400..."
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set"
else
  HTTP=$(curl -s -o /tmp/m32-resp5.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "http://localhost:3000/me/daily-summaries?from=2026-05-25&to=2026-05-20")
  if [[ "$HTTP" != "400" ]]; then
    echo "  FAIL: expected 400, got $HTTP"; cat /tmp/m32-resp5.json; exit 1
  fi
  if ! grep -q 'from_after_to' /tmp/m32-resp5.json; then
    echo "  FAIL: expected from_after_to error"; cat /tmp/m32-resp5.json; exit 1
  fi
  echo "  PASS"
fi

# Check 6: from inválido → 400.
echo "[6] from=invalid → 400..."
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set"
else
  HTTP=$(curl -s -o /tmp/m32-resp6.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "http://localhost:3000/me/daily-summaries?from=blah&to=2026-05-25")
  if [[ "$HTTP" != "400" ]]; then
    echo "  FAIL: expected 400, got $HTTP"; cat /tmp/m32-resp6.json; exit 1
  fi
  echo "  PASS"
fi

# Check 7: range válido → 200 + array.
echo "[7] GET /me/daily-summaries?from=...&to=... → 200..."
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set"
else
  HTTP=$(curl -s -o /tmp/m32-resp7.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "http://localhost:3000/me/daily-summaries?from=2026-05-18&to=2026-05-25")
  if [[ "$HTTP" != "200" ]]; then
    echo "  FAIL: expected 200, got $HTTP"; cat /tmp/m32-resp7.json; exit 1
  fi
  if ! grep -q '"summaries"' /tmp/m32-resp7.json; then
    echo "  FAIL: response missing summaries field"; cat /tmp/m32-resp7.json; exit 1
  fi
  echo "  PASS"
fi

echo "── all checks done ──"
