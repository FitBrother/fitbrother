-- Extensões usadas pela plataforma Supabase (auth/storage/rest), extraídas do
-- Postgres local deste projeto (docker exec supabase_db_fitbrother psql -c
-- "select extname from pg_extension"). Rode isto ANTES de platform-schema.sql.
--
-- DELIBERADAMENTE OMITIDAS (não suportadas no Neon, confirmado em
-- https://neon.com/docs/extensions/pg-extensions):
--   - pg_net          (usada só por Database Webhooks — este app não usa)
--   - supabase_vault  (usada só pelo recurso Vault — este app não usa;
--                      depende de pgsodium, que também não está disponível)
-- Se algum dia precisar de Vault ou Webhooks, isso NÃO é possível hoje num
-- Postgres externo ao Supabase (Neon incluso) — teria que voltar pro Supabase
-- Cloud gerenciado pra essas duas features específicas.
--
-- pg_graphql é opcional: só é preciso se você for consumir a API GraphQL do
-- Supabase. O app (mobile + server) usa supabase-js (.from()/.storage/.auth),
-- não GraphQL — se o Neon não tiver pg_graphql disponível, pule essa linha
-- sem medo.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Opcional (ver nota acima) — comente se o Neon recusar:
CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;
