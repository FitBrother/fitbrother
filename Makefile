# Invocado pelo `sam build` (Metadata.BuildMethod: makefile no template.yaml).
# CodeUri de cada função é ".sam-src/" — um diretório mínimo gerado por
# `scripts/sam-stage.sh` (rodar `npm run sam:stage` antes do build), com só
# apps/server + packages/shared + packages/db-types. O SAM copia o CodeUri
# inteiro pra um diretório isolado antes de rodar isto, sem nenhum filtro
# configurável (.samignore não é lido pelo CustomMakeBuilder — a exclusão é
# fixa, só .aws-sam/.git). Copiar a raiz do monorepo (node_modules +
# apps/mobile/ios ≈ 4-5GB) fazia essa cópia sozinha dominar o tempo de build;
# copiar só .sam-src/ (poucos MB) resolve isso.
#
# IMPORTANTE: não copiamos o node_modules do monorepo pro pacote final. Ele
# tem tudo hoisted junto — inclusive as dependências gigantes do apps/mobile
# (React Native/Expo) — e isso estoura o limite de 250MB descompactado da
# Lambda. Em vez disso, geramos um package.json isolado só com as
# dependências reais do apps/server e rodamos `npm install` limpo dentro do
# próprio pacote.
#
# Todas as funções apontam pro mesmo CodeUri; o SAM CLI faz esse build uma
# vez só e reaproveita pro resto (confirmado rodando `sam build` de verdade).
#
# `npm ci` é restrito aos workspaces que o servidor de fato usa (mesmo dentro
# de .sam-src/, onde apps/mobile nem existe — redundante mas inofensivo).
# `--ignore-scripts` evita o `prepare` (husky) do package.json raiz, que
# depende de um repo git que não existe dentro do build isolado.
# `--prefer-offline --no-audit --no-fund` evita round-trips de rede que não
# mudam o resultado do build.

build-ApiFunction build-StreakTickFunction build-StreakAlertFunction \
build-GoalReminderFunction build-DispatchNotificationFunction \
build-InsightsFunction build-MetricsDailyFunction build-PurgeAccountsFunction \
build-PurgeAudiosFunction:
	npm ci -w apps/server -w packages/shared -w packages/db-types --prefer-offline --no-audit --no-fund --ignore-scripts
	npm run build --workspace packages/shared
	npm run build --workspace apps/server
	mkdir -p "$(ARTIFACTS_DIR)/apps/server" "$(ARTIFACTS_DIR)/packages/shared" "$(ARTIFACTS_DIR)/packages/db-types"
	cp -R apps/server/dist "$(ARTIFACTS_DIR)/apps/server/dist"
	cp -R packages/shared/dist "$(ARTIFACTS_DIR)/packages/shared/dist"
	cp packages/shared/package.json "$(ARTIFACTS_DIR)/packages/shared/package.json"
	cp -R packages/db-types/. "$(ARTIFACTS_DIR)/packages/db-types/"
	node scripts/lambda-package-json.mjs apps/server/package.json "$(ARTIFACTS_DIR)/package.json"
	cd "$(ARTIFACTS_DIR)" && npm install --omit=dev --no-audit --no-fund --prefer-offline --ignore-scripts
