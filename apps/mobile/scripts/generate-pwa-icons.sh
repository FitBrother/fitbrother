#!/bin/bash
# Gera os ícones do PWA a partir dos assets de marca em /assets/brand.
# Roda uma vez (ou sempre que a marca mudar) — não faz parte do build.
# Requer `sips` (nativo do macOS). Rodar a partir de apps/mobile/.
set -euo pipefail

BRAND="../../assets/brand"
OUT="public/icons"
MINT="06D59F" # colors.primary[400] (lib/colors.ts)

mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Ícones "any" (192/512), apple-touch-icon e favicons: achata o selo completo
# (com transparência) sobre o próprio menta antes de redimensionar.
sips -p 700 700 --padColor "$MINT" "$BRAND/app_icon.png" --out "$TMP/badge-flat.png" >/dev/null
sips -z 512 512 "$TMP/badge-flat.png" --out "$OUT/icon-512.png" >/dev/null
sips -z 192 192 "$TMP/badge-flat.png" --out "$OUT/icon-192.png" >/dev/null
sips -z 180 180 "$TMP/badge-flat.png" --out "$OUT/apple-touch-icon.png" >/dev/null
sips -z 32 32 "$TMP/badge-flat.png" --out "$OUT/favicon-32.png" >/dev/null
sips -z 16 16 "$TMP/badge-flat.png" --out "$OUT/favicon-16.png" >/dev/null

# Ícone maskable: mesmo selo (glifo escuro sobre mint, já tem contraste), com
# margem extra para caber na safe zone (~80%) de qualquer máscara do SO.
# (app_icon_no_bg.png não serve aqui: é o glifo mint sobre fundo transparente,
# ficaria invisível preenchido com a mesma cor mint.)
sips -p 900 900 --padColor "$MINT" "$BRAND/app_icon.png" --out "$TMP/badge-maskable.png" >/dev/null
sips -z 512 512 "$TMP/badge-maskable.png" --out "$OUT/icon-maskable-512.png" >/dev/null
sips -z 192 192 "$TMP/badge-maskable.png" --out "$OUT/icon-maskable-192.png" >/dev/null

echo "Ícones gerados em $OUT — revise visualmente antes de commitar."
