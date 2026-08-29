# Build a partir da RAIZ do monorepo (necessário pro npm workspaces resolver
# @fitbrother/shared e @fitbrother/db-types). Rodar com:
#   docker build -f apps/server/Dockerfile -t fitbrother-server .
# (contexto = raiz do repo, não apps/server)

FROM node:20-slim AS base
WORKDIR /app
ENV HUSKY=0

# --- deps: instala com o grafo completo de workspaces (o lockfile exige) ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db-types/package.json packages/db-types/package.json
RUN npm ci

# --- build: compila packages/shared antes de apps/server (mesma ordem do
# script "build:server" da raiz) ---
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db-types packages/db-types
COPY apps/server apps/server
RUN npm run build --workspace packages/shared \
 && npm run build --workspace apps/server

# --- prune: remove devDependencies de todos os workspaces pro node_modules
# final ficar menor ---
FROM build AS prod-deps
RUN npm prune --omit=dev

# --- runtime: só o que apps/server precisa pra rodar ---
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/package.json package.json
# npm workspaces às vezes instala uma dependência aninhada dentro do próprio
# workspace (em vez de subir pra raiz) quando há conflito de versão — foi o
# caso do "openai" aqui. Copiar isso também garante que resolve em runtime.
COPY --from=prod-deps /app/apps/server/node_modules apps/server/node_modules
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/server/package.json apps/server/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/db-types packages/db-types

EXPOSE 3000
CMD ["node", "apps/server/dist/server.js"]
