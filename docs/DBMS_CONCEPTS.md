# DBMS Concepts — Where Each One Is Implemented

*Report chapters 5–8.* Every item below exists in the scripts and was executed. Output is
in [`evidence/outputs/`](../evidence/outputs).

## DDL (chapter 5)

| Concept | Where |
| --- | --- |
| CREATE DATABASE | `database/00_create_database.sql` (made re-runnable with `\gexec`) |
| CREATE TABLE (21 tables) | `database/01_schema.sql` |
| PRIMARY KEY (single + composite) | `01_schema.sql` (e.g. `PRIMARY KEY (user_id, role_id)`) |
| FOREIGN KEY with ON DELETE CASCADE / RESTRICT / SET NULL | `01_schema.sql` |
| ALTER TABLE … ADD CONSTRAINT (UNIQUE, CHECK) | `database/02_constraints_indexes.sql` |
| UNIQUE NULLS NOT DISTINCT (PostgreSQL 15+) | `02_…sql`: `uq_characters_universe_name`, `uq_titles_name_release` |
| CREATE INDEX / expression index / unique index | `02_…sql` (e.g. `idx_titles_name_lower ON titles (lower(name))`) |
| CREATE TABLE / ALTER TABLE ADD COLUMN / CREATE INDEX / DROP TABLE on a scratch table | `09_demo_queries.sql` §A (lines 14–56) |
| CREATE VIEW | `database/06_views.sql` |
| CREATE ROLE | `database/08_roles_permissions.sql` |

## DML (chapter 6)

| Concept | Where |
| --- | --- |
| INSERT … SELECT … ON CONFLICT DO NOTHING (idempotent seed) | `database/07_seed_data.sql` |
| INSERT / SELECT / UPDATE / DELETE walkthrough | `09_demo_queries.sql` §B (lines 36–56) |
| UPDATE … FROM … RETURNING | `09_…sql` Q7 |
| DELETE … USING … RETURNING | `09_…sql` Q8 |
| UPSERT (`ON CONFLICT … DO UPDATE`) | API: `apps/api/src/routes/workspace.ts` (reviews, watch progress) |

## Queries (chapter 7) — `database/09_demo_queries.sql` §D

| # | Required query | Line |
| --- | --- | --- |
| 1 | Simple SELECT | 105 |
| 2 | WHERE + ORDER BY | 108 |
| 3 | INNER JOIN across 4 tables | 114 |
| 4 | LEFT JOIN | 123 |
| 5 | GROUP BY with aggregates | 130 |
| 6 | HAVING | 140 |
| 7 | UPDATE | 148 |
| 8 | DELETE | 158 |
| 9 | Nested query with IN (+ NOT EXISTS variant) | 167, 173 |
| 10 | Correlated subquery | 179 |
| 11 | COUNT / AVG / MAX / MIN | 191 |
| 12 | Character participation in story events | 198 |
| 13 | Character arc progression | 206 |
| 14 | Popular / highly rated titles | 215 |
| + | Chronological vs release ordering; directed relationships | 223, 229 |

## Views — `database/06_views.sql`

| View | Purpose | Techniques |
| --- | --- | --- |
| v_title_catalogue | titles with universe, genres, rating, cast size | LEFT JOIN LATERAL, array_agg, scalar subquery |
| v_character_details | character with counts | calls functions |
| v_event_details | event with participant names | GROUP BY, FILTER |
| v_character_timeline | one row per participation | 4-table join |
| v_character_arc_progress | arc steps with total | window function `COUNT(*) OVER (PARTITION BY …)` |
| v_title_ratings | rating statistics | LEFT JOIN + aggregates + FILTER |

The API reads several of these views directly, for example `SELECT * FROM v_title_catalogue …`.

## Functions, stored procedures and triggers (chapter 8)

### Functions — `database/03_functions.sql`

| Function | Returns | Used by |
| --- | --- | --- |
| `fn_title_average_rating(title_id)` | NUMERIC(3,2) | demo, correlated query |
| `fn_character_appearance_count(character_id)` | INTEGER | `v_character_details` |
| `fn_character_event_count(character_id)` | INTEGER | `v_character_details` |
| `fn_user_has_permission(user_id, code)` | BOOLEAN | procedure `assign_user_role` |
| `fn_character_timeline(character_id, order)` | TABLE (set-returning, PL/pgSQL) | demo |
| `fn_current_app_user()` | INTEGER | audit and admin triggers |

### Stored procedures — `database/05_procedures.sql` (true `CREATE PROCEDURE`, invoked with `CALL`)

| Procedure | What it shows |
| --- | --- |
| `add_story_event(...)` | Inserts an event **and** its participants atomically, validates input, appends to both orderings, returns the new id through an `INOUT` parameter. If any participant is invalid, the whole CALL fails and nothing is kept (demonstrated in `09` §G and tested in `10`). Used by the admin API. |
| `assign_user_role(actor, target, role)` | Permission check plus the "no Admin self-assignment" rule inside the database. Used by the admin API. |

### Triggers — `database/04_triggers.sql`

| Trigger function | Timing | Tables | Purpose |
| --- | --- | --- | --- |
| `trg_set_updated_at` | BEFORE UPDATE | reviews, watch_progress | maintain `updated_at` |
| `trg_audit_row_change` | AFTER INSERT/UPDATE/DELETE | 9 tables | write JSONB old/new snapshots and the acting user to `audit_logs`; strips `password_hash` |
| `trg_validate_story_links` | BEFORE INSERT/UPDATE | 5 link tables | cross-table integrity (same universe, character appears in title, event in arc's title) |
| `trg_prevent_admin_self_assignment` | BEFORE INSERT/UPDATE | user_roles | defence in depth for the Admin rule |

## Transactions

| Concept | Where |
| --- | --- |
| BEGIN / COMMIT | `07_seed_data.sql` (whole seed is one transaction); `09_…sql` §I |
| ROLLBACK | `09_…sql` §I, Q7, Q8, §G, §H; `10_validation.sql` (entire test rolled back) |
| SAVEPOINT / ROLLBACK TO SAVEPOINT | `09_…sql` §I |
| Atomic multi-statement write in the application | `withTransaction()` in `apps/api/src/db/pool.ts` (register = user + Viewer role; title + genres) |
| Atomicity of a procedure call | `add_story_event` failure case |

## Database authorization — `database/08_roles_permissions.sql`

- `CREATE ROLE` for `cinemind_admin` (NOLOGIN), `cinemind_app` (LOGIN) and
  `cinemind_readonly` (NOLOGIN).
- `GRANT` at database, schema, table, column, sequence, function and procedure level.
  `ALTER DEFAULT PRIVILEGES` covers future tables.
- `REVOKE`: `ALL ON DATABASE FROM PUBLIC`; `CREATE ON SCHEMA public FROM PUBLIC`;
  `UPDATE, DELETE, TRUNCATE ON audit_logs FROM cinemind_app` (append-only);
  DML on role tables; `SELECT(password_hash)` from readonly.
- The runtime role is explicitly `NOSUPERUSER NOCREATEDB NOCREATEROLE` with a connection
  limit.
- Demonstrated with `SET ROLE` and `has_table_privilege` in `09_…sql` §J. Asserted in
  `10_validation.sql` §8.
- **Requires the installation superuser (`postgres`)**: `CREATE DATABASE`, `CREATE ROLE`
  and `CREATE EXTENSION pgcrypto`.

Database roles are separate from **application** roles (`roles` / `user_roles` /
`role_permissions`). The API enforces application roles with `requireAuth` and
`requirePermission`.

## Integrity enforcement summary

| Layer | Examples |
| --- | --- |
| Column | NOT NULL, data types, lengths |
| Table | PK, UNIQUE, CHECK |
| Between tables | FK with CASCADE/RESTRICT/SET NULL |
| Across several tables | triggers |
| Business process | stored procedures |
| Access | database GRANT/REVOKE + application RBAC |
