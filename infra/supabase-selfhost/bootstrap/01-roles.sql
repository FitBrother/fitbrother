--
-- PostgreSQL database cluster dump
--
-- Extraído com `docker exec supabase_db_fitbrother pg_dumpall -U postgres
-- --roles-only` do Postgres local deste projeto (não é um arquivo genérico
-- baixado da internet) — é a lista exata de papéis que o self-hosted
-- Supabase espera encontrar no banco.
--
-- IMPORTANTE:
-- 1. Rode com `psql`, não com um executor de SQL genérico — usa os
--    meta-comandos \restrict/\unrestrict do psql 17 (não são SQL padrão).
-- 2. As senhas SCRAM abaixo são do Postgres LOCAL de desenvolvimento
--    (postgres/postgres) — inofensivas, mas troque-as no Neon logo em
--    seguida com ALTER ROLE ... WITH PASSWORD 'sua-senha-de-verdade', pelo
--    menos para authenticator, pgbouncer, supabase_auth_admin,
--    supabase_storage_admin e postgres (os papéis que os serviços usam pra
--    logar). Use a MESMA senha em todos e é ela que vai em POSTGRES_PASSWORD
--    no .env do compose.
--

\restrict nDrZsME313Y0PdsIMlFbOYa6zgVMbdYeAnKk5za7Rsb8oCaMufSnMEz8xKKtHy2

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE anon;
ALTER ROLE anon WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticated;
ALTER ROLE authenticated WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticator;
ALTER ROLE authenticator WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:8YBOok5xIwNilMI2Y5+9/g==$DOjw2QQyCD0vXiITZLm7QKIeSKmiJZlOwc/bddEUYN0=:/TYbVsKqZO2cEG1zaTRuLzOjo9NEuvywOCrxP5QKecQ=';
CREATE ROLE dashboard_user;
ALTER ROLE dashboard_user WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB NOLOGIN REPLICATION NOBYPASSRLS;
CREATE ROLE pgbouncer;
ALTER ROLE pgbouncer WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:QbNl/4lM5zI8pUx0XiiGBg==$vBxyDplR3tPr5aj094/VqDc84dbxgRbLNAJV0HD74AA=:XkS8EfmgYKtSiQkgGQ51RUAmT9CDfiJ4cE2beB0MTFE=';
CREATE ROLE postgres;
ALTER ROLE postgres WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:CPzGlpE4hIuu/HuXV88wyA==$ik8rgq8FOK2u6dA/XnJ18hT53oa9XEohET7mcjV1ERA=:m72ttM/9x32S7qpIHzAebB18NFSGXZcx6ABJ/mK7LAk=';
CREATE ROLE service_role;
ALTER ROLE service_role WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION BYPASSRLS;
CREATE ROLE supabase_admin;
ALTER ROLE supabase_admin WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:pFpFhVnJpdktGZkh5cA73w==$InHe1s83rcErXUMtuomFeyc/nd/jbzz8I0Q3Yv5DV9A=:lb/72iJfp5kTjLLE0oUwsAAWPdZgaqYy533HU+Z963s=';
CREATE ROLE supabase_auth_admin;
ALTER ROLE supabase_auth_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:OLO92NAsxMhXnIdxL7MlHQ==$d45Y+yz1QDsq3UJC1lbpW+BYv4HE3DbZOvCLMtybQMQ=:0F9R4z+A/GvpWwC8lZWOzvC+fYQERdNNJVdzHyDoUY4=';
CREATE ROLE supabase_etl_admin;
ALTER ROLE supabase_etl_admin WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION BYPASSRLS;
CREATE ROLE supabase_functions_admin;
ALTER ROLE supabase_functions_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_privileged_role;
ALTER ROLE supabase_privileged_role WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_read_only_user;
ALTER ROLE supabase_read_only_user WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:WgrrtRbZG4fn1a6stVdBNg==$3NSSsmFFssnM8HOpCJlbUuF3oQ3x8ORnIO06+VtAH74=:ptS9+gu3rcUIhm7ZcDc7ynWe4pT3eSkfNrV/YnCdyto=';
CREATE ROLE supabase_realtime_admin;
ALTER ROLE supabase_realtime_admin WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_replication_admin;
ALTER ROLE supabase_replication_admin WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:bThzi8mKVwdqe1VmUXeT6g==$csY8kkQ7bTQonl5E8mKrcKH/XLSCq4rtk4NUbA7K8yo=:dvKQ7megDtsxHST2SebW/oFnlmA3dh4D6pffA4wrAls=';
CREATE ROLE supabase_storage_admin;
ALTER ROLE supabase_storage_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:ApYqvxo/MTQUlDiW0Bo6hA==$j+NtcPfKf+fjgrPozf2zkmK1d1VDzdAhEcGhW+e4Tfo=:qV+aOBlofUdGK0XRRd2tz/38W6gufQwM0/8x29bxiTI=';

--
-- User Configurations
--

--
-- User Config "anon"
--

ALTER ROLE anon SET statement_timeout TO '3s';

--
-- User Config "authenticated"
--

ALTER ROLE authenticated SET statement_timeout TO '8s';

--
-- User Config "authenticator"
--

ALTER ROLE authenticator SET session_preload_libraries TO 'safeupdate';
ALTER ROLE authenticator SET statement_timeout TO '8s';
ALTER ROLE authenticator SET lock_timeout TO '8s';

--
-- User Config "postgres"
--

ALTER ROLE postgres SET search_path TO E'\\$user', 'public', 'extensions';

--
-- User Config "supabase_admin"
--

ALTER ROLE supabase_admin SET search_path TO E'\\$user', 'public', 'auth', 'extensions';
ALTER ROLE supabase_admin SET log_statement TO 'none';

--
-- User Config "supabase_auth_admin"
--

ALTER ROLE supabase_auth_admin SET search_path TO 'auth';
ALTER ROLE supabase_auth_admin SET idle_in_transaction_session_timeout TO '60000';
ALTER ROLE supabase_auth_admin SET log_statement TO 'none';

--
-- User Config "supabase_functions_admin"
--

ALTER ROLE supabase_functions_admin SET search_path TO 'supabase_functions';

--
-- User Config "supabase_read_only_user"
--

ALTER ROLE supabase_read_only_user SET default_transaction_read_only TO 'on';

--
-- User Config "supabase_storage_admin"
--

ALTER ROLE supabase_storage_admin SET search_path TO 'storage';
ALTER ROLE supabase_storage_admin SET log_statement TO 'none';


--
-- Role memberships
--

GRANT anon TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT anon TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT authenticated TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT authenticated TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT authenticator TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT authenticator TO supabase_storage_admin WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT pg_create_subscription TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_monitor TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_monitor TO supabase_etl_admin WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_monitor TO supabase_read_only_user WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_read_all_data TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_read_all_data TO supabase_etl_admin WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_read_all_data TO supabase_read_only_user WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_signal_backend TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT service_role TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT service_role TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT supabase_functions_admin TO postgres WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT supabase_privileged_role TO postgres WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT supabase_privileged_role TO supabase_etl_admin WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT supabase_realtime_admin TO postgres WITH INHERIT TRUE GRANTED BY supabase_admin;




\unrestrict nDrZsME313Y0PdsIMlFbOYa6zgVMbdYeAnKk5za7Rsb8oCaMufSnMEz8xKKtHy2

--
-- PostgreSQL database cluster dump complete
--

