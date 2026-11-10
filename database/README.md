# CineMind database — PostgreSQL on Windows

Database name: **`cinemind_db`** · PostgreSQL **18** (tested with 18.6; 15+ required for `UNIQUE NULLS NOT DISTINCT`).

All commands below work in **Windows CMD** (`cmd.exe`). Run them from the repository root
(`C:\Users\<you>\Desktop\DBMS_2.0`).

## 1. Check PostgreSQL

```cmd
psql --version
```

**If you see `'psql' is not recognized`**, psql is not on your PATH. Either:

- use the full path:
  ```cmd
  "C:\Program Files\PostgreSQL\18\bin\psql.exe" --version
  ```
- or add it to PATH for the current CMD window:
  ```cmd
  set PATH=%PATH%;C:\Program Files\PostgreSQL\18\bin
  ```
- or open **SQL Shell (psql)** from the Start menu (press Enter to accept defaults, then
  type the password of `postgres`).

Check the PostgreSQL service is running: `services.msc` → **postgresql-x64-18** → *Running*.

## 2. Set up everything (recommended)

One command creates the database, runs every script in order, sets the runtime role
password and runs the self-test:

```cmd
powershell -ExecutionPolicy Bypass -File database\setup.ps1
```

| Option | Effect |
| --- | --- |
| `-Demo` | also runs `09_demo_queries.sql` |
| `-Reset` | **drops** `cinemind_db` first and rebuilds it (deletes all data) |
| `-Port <n>` / `-AdminUser <name>` | non-default connection (defaults: `localhost`, `5432`, `postgres`) |

The script asks once for the `postgres` password (hidden input) and keeps it only in its
own process; it is never written to disk. It takes the `cinemind_app` password from
`apps/api/.env` (`DB_PASSWORD`). If that value is still a placeholder or shorter than 12
characters, the script stops before connecting.

Equivalent from the repo root: `npm run db:setup`.

## 3. Run the scripts manually, in order

```cmd
psql -U postgres -h localhost -p 5432 -d postgres    -f database/00_create_database.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/01_schema.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/02_constraints_indexes.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/03_functions.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/04_triggers.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/05_procedures.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/06_views.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/07_seed_data.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/08_roles_permissions.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -c "\password cinemind_app"
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/09_demo_queries.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/10_validation.sql
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/11_inspect_schema.sql
```

For `\password cinemind_app`, enter the same value as `DB_PASSWORD` in `apps/api/.env`.

| Script | Purpose |
| --- | --- |
| `00_create_database.sql` | `CREATE DATABASE cinemind_db` (run against `postgres`) |
| `01_schema.sql` | 21 tables: PK, FK, NOT NULL |
| `02_constraints_indexes.sql` | `ALTER TABLE … ADD CONSTRAINT` (CHECK/UNIQUE) + indexes |
| `03_functions.sql` | SQL / PL/pgSQL functions |
| `04_triggers.sql` | updated_at, audit, integrity and admin-protection triggers |
| `05_procedures.sql` | `add_story_event`, `assign_user_role` (CREATE PROCEDURE) |
| `06_views.sql` | 6 views |
| `07_seed_data.sql` | idempotent demo data (one transaction) |
| `08_roles_permissions.sql` | database roles, GRANT / REVOKE |
| `09_demo_queries.sql` | DDL, DML, required queries, views, functions, procedure, triggers, transactions, authorization |
| `10_validation.sql` | automated self-test (all changes rolled back) |
| `11_inspect_schema.sql` | read-only listing of tables, keys, constraints, indexes, triggers, grants |

Scripts 01–08 are **safe to re-run** (no duplicates). Script 00 is safe to re-run as well.
Script 07 matches rows by name, so re-running inserts nothing new.

Why does 04 (triggers) run before 07 (seed)? So that the seed data itself is checked by the
integrity triggers.

## 4. Everyday psql commands

Connect:

```cmd
psql -U postgres -h localhost -p 5432 -d cinemind_db
```

Run a single query without opening the shell:

```cmd
psql -U postgres -h localhost -p 5432 -d cinemind_db -c "SELECT * FROM universes;"
```

Inside the `psql` shell:

| Command | Meaning |
| --- | --- |
| `\l` | list databases |
| `\c cinemind_db` | connect to a database |
| `\dt` | list tables |
| `\dv` | list views |
| `\df` | list functions and procedures |
| `\d characters` | describe a table (columns, keys, constraints, indexes, triggers) |
| `\du` | list database roles |
| `\dp reviews` | show privileges on a table |
| `\x` | toggle expanded output for wide rows |
| `\i database/09_demo_queries.sql` | run a script file |
| `\q` | exit |

## 5. Queries to try

```sql
SELECT * FROM v_title_catalogue ORDER BY average_rating DESC NULLS LAST;
SELECT * FROM v_character_timeline WHERE character_name = 'Arya Stark' ORDER BY chronology_order;
SELECT * FROM fn_character_timeline((SELECT character_id FROM characters WHERE name = 'Eddard Stark'), 'release');
SELECT fn_title_average_rating(title_id), name FROM titles;

-- Stored procedure inside a transaction you can undo.
-- CALL arguments cannot be subqueries, so store the id in a psql variable first.
SELECT title_id AS inception_id FROM titles WHERE name = 'Inception' \gset
BEGIN;
CALL add_story_event(:inception_id, 'The kick', 'Demo event', 'none', NULL, NULL,
                     ARRAY[]::INT[], ARRAY[]::VARCHAR[], NULL);
SELECT event_name, chronology_order FROM story_events WHERE title_id = :inception_id;
ROLLBACK;
```

## 6. Database roles (security)

| Role | Login | Purpose |
| --- | --- | --- |
| `postgres` | yes | installation superuser: runs these scripts (CREATE DATABASE / CREATE ROLE need it) |
| `cinemind_admin` | no | group role with full rights on the schema (migrations/administration) |
| `cinemind_app` | yes | **API runtime account**: SELECT/INSERT/UPDATE/DELETE only, not a superuser, cannot alter `audit_logs` or the role tables |
| `cinemind_readonly` | no | SELECT only; cannot read `users.password_hash` |

Application users (admin, alice, bob…) are rows in `users`, **not** PostgreSQL logins.

Demo application accounts from the seed: `admin@cinemind.local / Admin@123`,
`alice@cinemind.local / Viewer@123`, `bob@cinemind.local / Viewer@123`.

## 7. Troubleshooting

| Problem | Fix |
| --- | --- |
| `password authentication failed for user "postgres"` | Use the password chosen during PostgreSQL installation. |
| `connection refused` | Start the service `postgresql-x64-18`; check the port (`-p`). |
| `database "cinemind_db" does not exist` | Run `00_create_database.sql` against `-d postgres` first. |
| `permission denied` when running 08 | Run it as `postgres` (CREATE ROLE needs superuser or CREATEROLE). |
| Text looks garbled in CMD | Run `chcp 65001` first (UTF-8 code page). |
