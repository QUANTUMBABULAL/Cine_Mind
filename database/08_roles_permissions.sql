-- =============================================================================
-- CineMind 2.0 — 08_roles_permissions.sql
-- PostgreSQL DATABASE roles (not application roles).
--
--   cinemind_admin     NOLOGIN group: full DDL/DML rights — migrations/admin work.
--   cinemind_app       LOGIN: the API's runtime account. DML only, least privilege.
--   cinemind_readonly  NOLOGIN group: SELECT only — reporting / viva demos.
--
-- Application users (admin, alice, bob) live in the users table and are NOT
-- PostgreSQL logins. Application roles (Viewer, Admin) live in roles/user_roles.
--
-- Must be run by a superuser or a role with CREATEROLE (e.g. "postgres"),
-- because CREATE ROLE is a cluster-level operation.
--
-- NO PASSWORDS ARE STORED HERE. setup.ps1 sets cinemind_app's password
-- separately (from apps/api/.env), or run manually:   \password cinemind_app
--
-- Re-runnable.
-- Run:  psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/08_roles_permissions.sql
-- =============================================================================

-- ---------------- CREATE ROLE (only if missing) ----------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cinemind_admin') THEN
        CREATE ROLE cinemind_admin NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cinemind_readonly') THEN
        CREATE ROLE cinemind_readonly NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cinemind_app') THEN
        CREATE ROLE cinemind_app LOGIN;
    END IF;
END;
$$;

-- The runtime role must never be privileged. Limit its connections too.
ALTER ROLE cinemind_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
    CONNECTION LIMIT 20;

-- ---------------- Database and schema level ----------------
-- Nobody connects unless explicitly granted.
REVOKE ALL ON DATABASE cinemind_db FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE cinemind_db TO cinemind_app;
GRANT CONNECT ON DATABASE cinemind_db TO cinemind_readonly;
GRANT ALL PRIVILEGES ON DATABASE cinemind_db TO cinemind_admin;

-- Only the admin group may create objects in the schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cinemind_app, cinemind_readonly;
GRANT USAGE, CREATE ON SCHEMA public TO cinemind_admin;

-- ---------------- Admin group ----------------
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO cinemind_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cinemind_admin;

-- ---------------- Read-only group ----------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cinemind_readonly;   -- includes views
-- Password hashes are not readable by reporting users (column-level REVOKE
-- does not override a table-level grant, so re-grant columns explicitly).
REVOKE SELECT ON users FROM cinemind_readonly;
GRANT SELECT (user_id, username, email, account_status, created_at) ON users TO cinemind_readonly;

-- ---------------- Runtime application role ----------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cinemind_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cinemind_app;
GRANT EXECUTE ON ALL FUNCTIONS  IN SCHEMA public TO cinemind_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO cinemind_app;

-- Audit log is APPEND-ONLY for the application: it may insert (via triggers)
-- and read, but never change or remove history.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM cinemind_app;

-- Lookup data managed only by administrators through migrations/scripts.
REVOKE INSERT, UPDATE, DELETE ON roles, permissions, role_permissions FROM cinemind_app;

-- No TRUNCATE / REFERENCES / TRIGGER rights for the runtime role.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM cinemind_app;

-- ---------------- Future objects ----------------
-- Tables created later by the current user get the same grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cinemind_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO cinemind_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO cinemind_readonly;

-- ---------------- Show the result ----------------
SELECT rolname, rolsuper, rolcanlogin, rolcreatedb, rolcreaterole, rolconnlimit
FROM pg_roles
WHERE rolname LIKE 'cinemind%'
ORDER BY rolname;

SELECT grantee, table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee = 'cinemind_app' AND table_name IN ('audit_logs', 'roles', 'reviews')
GROUP BY grantee, table_name
ORDER BY table_name;
