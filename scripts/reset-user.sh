#!/usr/bin/env bash
# Deleta usuários do Supabase local pra testar onboarding do zero.
# Uso:
#   ./scripts/reset-user.sh                  # apaga TODOS os usuários
#   ./scripts/reset-user.sh you@example.com  # apaga só esse email
#
# Cascade FK em auth.users.id limpa profiles / anthropometrics /
# nutrition_goals / subscriptions / consent_log automaticamente.

set -euo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_fitbrother}"
EMAIL="${1:-}"

if [[ -n "$EMAIL" ]]; then
  SQL="DELETE FROM auth.users WHERE email = '${EMAIL}' RETURNING email;"
  echo "→ Deletando $EMAIL..."
else
  SQL="DELETE FROM auth.users RETURNING email;"
  echo "→ Deletando TODOS os usuários..."
fi

docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$SQL"
echo "✓ Pronto."
