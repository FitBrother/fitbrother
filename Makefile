# Invocado pelo `sam build` (Metadata.BuildMethod: makefile no template.yaml).
# CodeUri de cada função é "./" (raiz do repo) — o SAM copia o monorepo
# inteiro pra um diretório isolado antes de rodar isto, o que dá acesso a
# packages/shared e packages/db-types (dependências de workspace do
# apps/server).
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

build-ApiFunction build-StreakTickFunction build-StreakAlertFunction \
build-GoalReminderFunction build-DispatchNotificationFunction \
build-InsightsFunction build-MetricsDailyFunction build-PurgeAccountsFunction \
build-PurgeAudiosFunction:
	npm ci
	npm run build --workspace packages/shared
	npm run build --workspace apps/server
	mkdir -p "$(ARTIFACTS_DIR)/apps/server" "$(ARTIFACTS_DIR)/packages/shared" "$(ARTIFACTS_DIR)/packages/db-types"
	cp -R apps/server/dist "$(ARTIFACTS_DIR)/apps/server/dist"
	cp -R packages/shared/dist "$(ARTIFACTS_DIR)/packages/shared/dist"
	cp packages/shared/package.json "$(ARTIFACTS_DIR)/packages/shared/package.json"
	cp -R packages/db-types/. "$(ARTIFACTS_DIR)/packages/db-types/"
	node scripts/lambda-package-json.mjs apps/server/package.json "$(ARTIFACTS_DIR)/package.json"
	cd "$(ARTIFACTS_DIR)" && npm install --omit=dev --no-audit --no-fund
