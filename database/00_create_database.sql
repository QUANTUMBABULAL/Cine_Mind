-- =============================================================================
-- CineMind 2.0 — 00_create_database.sql
-- Creates the application database. Run while connected to the default
-- "postgres" maintenance database as an administrator:
--
--   psql -U postgres -h localhost -p 5432 -d postgres -f database/00_create_database.sql
--
-- CREATE DATABASE cannot run inside a transaction or DO block, so the psql
-- \gexec meta-command is used to make this script safe to re-run: the
-- statement is generated (and executed) only if the database does not exist.
-- =============================================================================

SELECT 'CREATE DATABASE cinemind_db ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'cinemind_db')
\gexec

COMMENT ON DATABASE cinemind_db IS 'CineMind 2.0 — fictional universe intelligence and story exploration platform';

SELECT datname AS database, pg_encoding_to_char(encoding) AS encoding
FROM pg_database
WHERE datname = 'cinemind_db';
