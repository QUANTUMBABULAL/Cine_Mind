# Database Design

PostgreSQL 18 · database `cinemind_db` · schema `public`.

## Object summary (counted from the live database)

| Object | Count |
| --- | --- |
| Tables | 21 |
| Views | 6 |
| Functions (excluding the pgcrypto extension) | 6 |
| Trigger functions / triggers | 4 / 17 |
| Stored procedures | 2 |
| Primary keys | 21 (6 of them composite) |
| Foreign keys | 28 |
| UNIQUE constraints | 19 (+ 1 unique expression index) |
| CHECK constraints | 21 |
| Indexes (all, incl. PK/UNIQUE) | 55 |
| Database roles | 3 (`cinemind_admin`, `cinemind_app`, `cinemind_readonly`) |

## Tables by group

| Group | Tables |
| --- | --- |
| Authentication & authorization | users, roles, permissions, user_roles, role_permissions, audit_logs |
| Universes & titles | universes, titles, genres, title_genres |
| Characters | characters, character_appearances, relationship_types, character_relationships |
| Story | story_events, event_participants, character_arcs, arc_events |
| User activity | bookmarks, reviews, watch_progress |

The full column list is in [ER_MODEL.md](ER_MODEL.md). For the live definitions, run
`psql … -f database/11_inspect_schema.sql`; its output is saved in
[`evidence/outputs/schema_inspection.txt`](../evidence/outputs/schema_inspection.txt).

## Data types

| Use | Type | Reason |
| --- | --- | --- |
| Keys | `INTEGER GENERATED ALWAYS AS IDENTITY` (`BIGINT` for audit) | SQL-standard identity; values cannot be inserted by mistake |
| Names | `VARCHAR(n)` | documents and enforces a maximum length |
| Long text | `TEXT` | biographies, synopses (review_text capped at 5000 by CHECK) |
| Dates | `DATE` (release, first appearance) | no time zone needed |
| Timestamps | `TIMESTAMPTZ DEFAULT now()` | unambiguous across time zones |
| Rating | `SMALLINT` + `CHECK 1..5` | |
| Percentage | `NUMERIC(5,2)` + `CHECK 0..100` | exact decimal |
| Audit snapshots | `JSONB` | one column stores rows from any table |
| Enumerations | `VARCHAR` + `CHECK (… IN (…))` | easy to read and to change with `ALTER TABLE` |

## Key business rules and where they are enforced

| Rule | Mechanism |
| --- | --- |
| Email unique (case-insensitive) | `UNIQUE(email)` + `CHECK (email = lower(email))` |
| Username unique (case-insensitive) | unique index on `lower(username)` |
| Character name unique **within** a universe | `UNIQUE NULLS NOT DISTINCT (universe_id, name)` |
| Standalone titles | `titles.universe_id` nullable |
| Relationships directed, no self-relation | separate source/target FKs; `CHECK (source <> target)`; `UNIQUE (source, target, type)` |
| Event order unique within a title (both orderings) | `UNIQUE (title_id, chronology_order)`, `UNIQUE (title_id, release_order)` |
| Several arcs per character per title | key `arc_id`; `UNIQUE (character_id, title_id, arc_name)` |
| Arc steps ordered | `UNIQUE (arc_id, sequence_number)`, `CHECK > 0` |
| Bookmark has exactly one target | `CHECK (num_nonnulls(title_id, character_id) = 1)` |
| One review / one progress row per user per title | `UNIQUE (user_id, title_id)` |
| Rating 1–5; progress 0–100; completed ⇒ 100 | CHECK constraints |
| Same-universe / appears-in-title / same-title rules | trigger `trg_validate_story_links` |
| updated_at maintained | trigger `trg_set_updated_at` |
| Changes audited with acting user | trigger `trg_audit_row_change` (9 tables) |
| No Admin self-assignment | API check + procedure `assign_user_role` + trigger `trg_prevent_admin_self_assignment` |
| Universe with titles not deletable | `ON DELETE RESTRICT` |
| Audit history immutable for the app | `REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM cinemind_app` |

## Indexes

PK and UNIQUE constraints create indexes automatically. These indexes were added for
real query patterns:

| Index | Supports |
| --- | --- |
| idx_titles_universe, idx_titles_media_type | universe pages, media-type filter |
| idx_titles_name_lower, idx_characters_name_lower | case-insensitive search |
| idx_title_genres_genre | genre filter (reverse side of the composite PK) |
| idx_appearances_title, idx_participants_character, idx_arc_events_event, idx_arcs_title | reverse lookups on junction tables |
| idx_relationships_target | "incoming" relationships |
| idx_reviews_title | ratings per title |
| idx_audit_entity, idx_audit_user, idx_audit_time | audit browsing |

## How the API uses the database

- The API connects as **`cinemind_app`** (never `postgres`), through a `pg` connection
  pool.
- Every query is **hand-written, parameterized SQL** (`$1, $2 …`). There is no ORM.
- Writes that must be atomic use `BEGIN … COMMIT/ROLLBACK` on one pooled client
  (`withTransaction` in `apps/api/src/db/pool.ts`).
- The acting user is passed to triggers with
  `set_config('cinemind.current_user_id', <id>, true)`, which is transaction-local, like
  `SET LOCAL`. The audit trigger reads it through `fn_current_app_user()`.
- Event creation calls the stored procedure `CALL add_story_event(...)`. Role grants call
  `CALL assign_user_role(...)`.
- PostgreSQL error codes are translated to HTTP responses: 23505 → 409, 23514 → 400,
  23503/23001 → 409, 42501 → 403.

## Design decisions (short)

| Decision | Alternative rejected | Why |
| --- | --- | --- |
| CHECK-constrained VARCHAR for enumerations | `CREATE TYPE … AS ENUM` | simpler to explain and to alter |
| Triggers for cross-table integrity | composite FKs with redundant columns | keeps the schema in 2NF/3NF |
| Separate `bookmarks` FKs + xor CHECK | polymorphic target_type/target_id | real referential integrity |
| Polymorphic `audit_logs.entity_id` | one audit table per entity | one generic trigger audits 9 tables |
| No soft deletion | `deleted_at` columns | not required; FKs with CASCADE/RESTRICT keep data consistent |
| No seasons/episodes | episode tables | out of scope for this version; ordering is numeric within a title |
| Natural-key lookups in seed | hard-coded ids | idempotent, order-independent seeding |
