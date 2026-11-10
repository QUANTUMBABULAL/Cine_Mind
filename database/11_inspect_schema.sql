-- =============================================================================
-- CineMind 2.0 — 11_inspect_schema.sql
-- Read-only inspection of the schema using psql meta-commands and the
-- information_schema / pg_catalog. Useful for the report and the viva.
-- Run:  psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/11_inspect_schema.sql
-- =============================================================================
\pset pager off

\echo '==================== Tables (\dt) ===================='
\dt

\echo '==================== Views (\dv) ===================='
\dv

\echo '==================== Functions and procedures (\df) ===================='
\df public.*

\echo '==================== Row counts ===================='
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables ORDER BY relname;

\echo '==================== Primary keys ===================='
SELECT tc.table_name, string_agg(k.column_name, ', ' ORDER BY k.ordinal_position) AS primary_key
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage k
  ON k.constraint_name = tc.constraint_name AND k.table_schema = tc.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
GROUP BY tc.table_name ORDER BY tc.table_name;

\echo '==================== Foreign keys (with ON DELETE rule) ===================='
SELECT con.conrelid::regclass AS child_table,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
ORDER BY 1, 2;

\echo '==================== UNIQUE constraints ===================='
SELECT con.conrelid::regclass AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.contype = 'u' AND con.connamespace = 'public'::regnamespace
ORDER BY 1, 2;

\echo '==================== CHECK constraints ===================='
SELECT con.conrelid::regclass AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.contype = 'c' AND con.connamespace = 'public'::regnamespace
ORDER BY 1, 2;

\echo '==================== Indexes ===================='
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;

\echo '==================== Triggers ===================='
SELECT event_object_table AS table_name, trigger_name,
       string_agg(event_manipulation, '/' ORDER BY event_manipulation) AS events,
       action_timing AS timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
GROUP BY 1, 2, 4 ORDER BY 1, 2;

\echo '==================== Database roles ===================='
SELECT rolname, rolsuper, rolcanlogin, rolcreatedb, rolcreaterole, rolconnlimit
FROM pg_roles WHERE rolname LIKE 'cinemind%' ORDER BY rolname;

\echo '==================== Table privileges of cinemind_app ===================='
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee = 'cinemind_app' AND table_schema = 'public'
GROUP BY table_name ORDER BY table_name;

\echo '==================== Structure of key tables (\d) ===================='
\d characters
\d character_relationships
\d story_events
\d bookmarks
\d arc_events
