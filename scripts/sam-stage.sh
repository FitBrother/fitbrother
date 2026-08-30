#!/usr/bin/env bash
set -euo pipefail

# Monta um diretório de build mínimo (.sam-src/) só com o que o apps/server
# precisa pra compilar. Sem isso, `sam build` (CustomMakeBuilder) copia o
# CodeUri inteiro pra um diretório isolado antes de rodar o Makefile — e
# CodeUri sendo a raiz do monorepo (node_modules + apps/mobile/ios, ~4-5GB)
# fazia essa cópia sozinha consumir a maior parte dos 6+ minutos de build.
# O CustomMakeBuilder do SAM não lê .samignore nem nenhum filtro
# configurável — a exclusão é fixa (só .aws-sam/.git, hardcoded em
# aws_lambda_builders/workflows/custom_make/workflow.py). A única forma de
# reduzir a cópia é reduzir o CodeUri em si, por isso template.yaml aponta
# pra este diretório em vez da raiz do repo.
#
# Rodar antes de `sam build`/`sam deploy` sempre que algo em apps/server,
# packages/shared ou packages/db-types mudar (é incremental via rsync, então
# reexecuções ficam rápidas).

cd "$(dirname "$0")/.."

STAGE_DIR=".sam-src"
mkdir -p "$STAGE_DIR"

rsync -a package.json package-lock.json tsconfig.base.json Makefile "$STAGE_DIR/"

mkdir -p "$STAGE_DIR/scripts"
rsync -a scripts/lambda-package-json.mjs "$STAGE_DIR/scripts/"

for pkg in apps/server packages/shared packages/db-types; do
  mkdir -p "$STAGE_DIR/$pkg"
  rsync -a --delete --exclude 'node_modules' --exclude 'dist' "$pkg/" "$STAGE_DIR/$pkg/"
done

echo "Staged em $STAGE_DIR ($(du -sh "$STAGE_DIR" | cut -f1))"
