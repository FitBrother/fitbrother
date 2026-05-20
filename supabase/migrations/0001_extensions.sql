-- M1 §database. Required extensions for the rest of the schema.
-- pgcrypto  -> gen_random_uuid() for PKs
-- pg_trgm   -> trigram similarity for fuzzy match on foods (M2)
-- unaccent  -> normalize "Açaí" / "Acai" before trigram match (M2)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
