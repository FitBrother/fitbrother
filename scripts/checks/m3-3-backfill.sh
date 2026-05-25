#!/usr/bin/env bash
# M3.3 backfill smoke checks — janela de 7 dias.
# Pré-condições: supabase local up, server em :3000, TEST_USER_JWT setado.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── M3.3 checks ──"

JWT="${TEST_USER_JWT:-}"
if [[ -z "$JWT" ]]; then
  echo "ERROR: TEST_USER_JWT not set"; exit 1
fi

TODAY=$(date -u +%Y-%m-%d)
DAY_MINUS_3="$(date -u -d "$TODAY -3 days" +%Y-%m-%d)"
DAY_MINUS_8="$(date -u -d "$TODAY -8 days" +%Y-%m-%d)"

# Check 1: consumed_at = today-8d → 400 backfill_window_exceeded
echo "[1] POST /meals/text consumed_at=${DAY_MINUS_8}T12:00:00Z → 400..."
HTTP=$(curl -s -o /tmp/m33-resp1.json -w "%{http_code}" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3000/meals/text \
  -d "{\"client_meal_id\":\"$(uuidgen)\",\"text\":\"1 banana\",\"consumed_at\":\"${DAY_MINUS_8}T12:00:00Z\",\"locale\":\"pt-BR\"}")
if [[ "$HTTP" != "400" ]]; then
  echo "  FAIL: expected 400, got $HTTP"; cat /tmp/m33-resp1.json; exit 1
fi
if ! grep -q 'backfill_window_exceeded' /tmp/m33-resp1.json; then
  echo "  FAIL: expected backfill_window_exceeded"; cat /tmp/m33-resp1.json; exit 1
fi
echo "  PASS"

# Check 2: consumed_at = today-3d → 201 + meal criado
echo "[2] POST /meals/text consumed_at=${DAY_MINUS_3}T12:00:00Z → 201..."
HTTP=$(curl -s -o /tmp/m33-resp2.json -w "%{http_code}" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3000/meals/text \
  -d "{\"client_meal_id\":\"$(uuidgen)\",\"text\":\"1 banana\",\"consumed_at\":\"${DAY_MINUS_3}T12:00:00Z\",\"locale\":\"pt-BR\"}")
if [[ "$HTTP" != "201" ]]; then
  echo "  FAIL: expected 201, got $HTTP"; cat /tmp/m33-resp2.json; exit 1
fi
echo "  PASS"

# Check 3: sem consumed_at → 201 (regressão happy path)
echo "[3] POST /meals/text sem consumed_at → 201..."
HTTP=$(curl -s -o /tmp/m33-resp3.json -w "%{http_code}" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3000/meals/text \
  -d "{\"client_meal_id\":\"$(uuidgen)\",\"text\":\"1 banana\",\"locale\":\"pt-BR\"}")
if [[ "$HTTP" != "201" ]]; then
  echo "  FAIL: expected 201, got $HTTP"; cat /tmp/m33-resp3.json; exit 1
fi
echo "  PASS"

# Check 4: GET /meals?day=today-3d → contém meal do check 2
echo "[4] GET /meals?day=${DAY_MINUS_3} → 200 + meal presente..."
HTTP=$(curl -s -o /tmp/m33-resp4.json -w "%{http_code}" \
  -H "Authorization: Bearer $JWT" \
  "http://localhost:3000/meals?day=${DAY_MINUS_3}")
if [[ "$HTTP" != "200" ]]; then
  echo "  FAIL: expected 200, got $HTTP"; cat /tmp/m33-resp4.json; exit 1
fi
if ! grep -q '"banana"' /tmp/m33-resp4.json; then
  echo "  FAIL: meal não encontrado"; cat /tmp/m33-resp4.json; exit 1
fi
echo "  PASS"

# Check 5: GET /me/daily-summaries cobrindo today-3d tem kcal>0
echo "[5] GET /me/daily-summaries?from=${DAY_MINUS_3}&to=${TODAY} → kcal>0..."
HTTP=$(curl -s -o /tmp/m33-resp5.json -w "%{http_code}" \
  -H "Authorization: Bearer $JWT" \
  "http://localhost:3000/me/daily-summaries?from=${DAY_MINUS_3}&to=${TODAY}")
if [[ "$HTTP" != "200" ]]; then
  echo "  FAIL: expected 200, got $HTTP"; cat /tmp/m33-resp5.json; exit 1
fi
# extrai a summary do dia backfillado e checa kcal > 0 via node
KCAL=$(node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/m33-resp5.json','utf8')); const s=d.summaries.find(x=>x.day==='${DAY_MINUS_3}'); console.log(s ? s.kcal : 0);")
if [[ "$KCAL" == "0" ]]; then
  echo "  FAIL: kcal do dia backfillado é 0"; cat /tmp/m33-resp5.json; exit 1
fi
echo "  PASS (kcal=$KCAL)"

echo "── all checks done ──"
