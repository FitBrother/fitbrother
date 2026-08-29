# Invocado pelo `sam build` (Metadata.BuildMethod: makefile no template.yaml).
# CodeUri de cada função é "./" (raiz do repo) — o SAM copia o monorepo
# inteiro pra um diretório isolado antes de rodar isto, o que dá acesso a
# packages/shared e packages/db-types (dependências de workspace do
# apps/server). Mesma lógica de build do apps/server/Dockerfile, só que
# empacotando um zip em vez de uma imagem.
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
	npm prune --omit=dev
	mkdir -p "$(ARTIFACTS_DIR)/apps/server" "$(ARTIFACTS_DIR)/packages/shared" "$(ARTIFACTS_DIR)/packages/db-types"
	cp -R apps/server/dist "$(ARTIFACTS_DIR)/apps/server/dist"
	cp apps/server/package.json "$(ARTIFACTS_DIR)/apps/server/package.json"
	cp -R packages/shared/dist "$(ARTIFACTS_DIR)/packages/shared/dist"
	cp packages/shared/package.json "$(ARTIFACTS_DIR)/packages/shared/package.json"
	cp -R packages/db-types/. "$(ARTIFACTS_DIR)/packages/db-types/"
	cp -R node_modules "$(ARTIFACTS_DIR)/node_modules"
	cp package.json "$(ARTIFACTS_DIR)/package.json"
	# npm workspaces às vezes instala uma dep aninhada dentro do próprio
	# workspace em vez de subir pra raiz (foi o caso do "openai" — ver
	# apps/server/Dockerfile) — copia isso também se existir.
	if [ -d apps/server/node_modules ]; then \
		mkdir -p "$(ARTIFACTS_DIR)/apps/server/node_modules"; \
		cp -R apps/server/node_modules/. "$(ARTIFACTS_DIR)/apps/server/node_modules/"; \
	fi
	# node_modules/@fitbrother/mobile é um symlink dos workspaces do npm
	# apontando pro apps/mobile — de propósito não empacotamos apps/mobile
	# aqui (server não depende dele), então esse link fica quebrado. O
	# `sam build` não liga, mas o `sam deploy` trava tentando zipar um
	# symlink morto. Remove qualquer symlink quebrado do pacote final.
	find "$(ARTIFACTS_DIR)" -type l | while read -r link; do \
		if [ ! -e "$$link" ]; then rm -f "$$link"; fi; \
	done
