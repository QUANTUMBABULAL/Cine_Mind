# Test Results

Run date: 2026-11-03 · Windows 11 · Node.js 22.18.0 · PostgreSQL 18.6 (x86_64-windows).

> **Environment note.** Everything below was executed against a **separate local
> PostgreSQL 18.6 cluster on port 5433**, created with the same installed binaries
> (`C:\Program Files\PostgreSQL\18\bin`). This was needed because the main service on port
> 5432 needs the `postgres` password, which only its owner has. The scripts are identical.
> To repeat on port 5432, run `database\setup.ps1 -Demo`, then
> `scripts\generate-evidence.ps1`; this overwrites `evidence/outputs` with your own run.

## 1. Database

| Check | Command | Result | Evidence |
| --- | --- | --- | --- |
| Full setup from an empty cluster (00–08) | `setup.ps1 -Reset` | exit 0, no errors | `evidence/logs/database_setup.log` |
| Re-running 01–08 on a populated DB | psql -f each script | row counts unchanged (4/10/25/25/15/39/7/14 …): idempotent | — (console check) |
| Self-test | `10_validation.sql` | **57 checks PASS, 0 FAIL**, all changes rolled back | `evidence/outputs/validation_output.txt` |
| Demonstration script | `09_demo_queries.sql` | completes; 1 *intentional* error (invalid crossover CALL, shows atomic rollback) | `evidence/outputs/demo_queries_output.txt` |
| Schema inspection | `11_inspect_schema.sql` | 21 tables, 6 views, 21 PK, 28 FK, 19 UNIQUE, 21 CHECK, 17 triggers | `evidence/outputs/schema_inspection.txt` |

What the 57 validation checks cover:

- **Structure:** 21 tables, 6 views, 2 procedures, 6 composite PKs.
- **Seed minimums:** ≥4 universes, ≥8 titles, ≥12 characters, ≥8 relationships, ≥8 events,
  ≥4 arcs; a standalone title; multiple arcs per character per title; everyone has the
  Viewer role.
- **Constraints, by SQLSTATE:**
  - rating range;
  - one review per title;
  - progress 0–100, and completed ⇒ 100;
  - bookmark xor (none and both);
  - duplicate bookmark;
  - self-relationship;
  - duplicate name in a universe, but the same name allowed in a different universe;
  - FK (unknown universe);
  - RESTRICT delete (23001);
  - invalid media type;
  - duplicate event order;
  - lower-case email.
- **Triggers:**
  - cross-universe appearance;
  - participant not in title;
  - arc event in another title;
  - cross-universe relationship;
  - `updated_at` refresh;
  - audit row with acting user and old/new values;
  - no `password_hash` in the audit log;
  - Admin self-assignment blocked (42501).
- **Functions:** average rating (5.00 and NULL), appearance count, event count, permission
  check.
- **Procedures:**
  - event + participants inserted and appended at order 3;
  - an invalid participant aborts the whole CALL, leaving no event behind;
  - an admin can grant a role, and a viewer cannot (42501).
- **Views:** all six return data.
- **Authorization:** `cinemind_app` can log in, is not superuser/createrole/createdb, has
  DML on reviews, has no UPDATE/DELETE on `audit_logs`, no INSERT on `roles`; readonly
  cannot read `password_hash`.

## 2. Backend API

| Check | Command | Result | Evidence |
| --- | --- | --- | --- |
| Type check | `npm run typecheck` (apps/api) | 0 errors | — |
| Compile | `npm run build` | `dist/` produced | — |
| Server start (compiled) | `npm start` | "Connected to PostgreSQL database cinemind_db as cinemind_app" | — |
| Health | `GET /api/health` | `{"status":"ok","database":"cinemind_db","db_user":"cinemind_app"}` | — |
| Unknown route / malformed JSON | curl | 404 / 400 | — |
| Integration tests | `npm test` | **27 tests, 27 pass, 0 fail** (5 suites) | `evidence/logs/api_tests.log` |
| Dependency audit | `npm audit` | 0 vulnerabilities (after upgrading zod to 4.6.6) | — |

The integration tests start the real app and call it over HTTP against the database:

- **Health and discovery:** the health endpoint runs as `cinemind_app`; universe counts;
  universe detail; genre + media-type filter; rating sort; standalone title; search;
  400 for an invalid filter; 404/400 for a bad id.
- **Story:** directed relationships in both directions; two arcs for Jon Snow;
  chronology vs release timeline (Tower of Joy first vs King Robert first); Red Wedding
  participants; Eddard's execution outcome.
- **Auth:** register gives the Viewer role and lower-cases the email; duplicate email →
  409; weak input → 400; wrong password → 401; `/me` without or with a bad token → 401.
- **Workspace:** 401 without a token; bookmark add / duplicate 409 / two targets 400 /
  list / delete; review create 201 → update 200 with a newer `updated_at` (trigger) →
  invalid rating 400 → delete; progress upsert and 400 above 100; activity summary.
- **Admin:**
  - a viewer gets 403 and an anonymous user 401;
  - full CRUD: universe, title with genres, character, appearance;
  - an event via the procedure, rejected (400) until the character appears in the title;
  - RESTRICT delete → 409;
  - audit rows show the acting admin;
  - self-grant of Admin → 403;
  - grant Admin to another user → access gained; revoke → 403; suspend → existing token
    rejected (403).

## 3. Frontend

| Check | Command | Result | Evidence |
| --- | --- | --- | --- |
| Type check | `npm run typecheck` (apps/web) | 0 errors | — |
| Production build | `npm run build` | compiled, 14 routes | `evidence/logs/web_build.log` |
| Page smoke test (production server + API) | curl 20 URLs | all 200; each page contained the expected database content (e.g. `/story` contains "The Red Wedding"; filtered titles contain "Inception"); unknown/invalid ids render Not Found | console check |
| Rendered pages, public | headless Chrome | 9 screenshots | `evidence/screenshots/01–09` |
| Rendered pages, logged in | `node scripts/capture-screenshots.mjs` (DevTools protocol, real login through the API) | workspace with alice's data, logged-in title page, admin denied for a viewer, admin overview/titles/events/users/audit | `evidence/screenshots/10–17` |

Defects found and fixed during testing:

| Defect | Fix |
| --- | --- |
| Integrity trigger fired before the FK check and reported "different universes" for a non-existent character | trigger skips rows whose parents don't exist, so the FK reports it |
| `CALL` with subquery arguments is not allowed in PostgreSQL | demo/validation use psql `\gset` variables |
| Data-modifying CTE inside a subquery in validation | rewritten as plain INSERT + check |
| RESTRICT raises 23001, not 23503 | expected code corrected; API maps 23001 → 409 |
| Unscoped `requireAuth` in the workspace router would turn unknown `/api` routes into 401 | scoped to `/me` and review routes |
| Admin panels reloaded lookups on every load (render loop) | lookups reload only after a save or delete |
| `pg` pool crashed the process when the server closed an idle connection | `pool.on("error")` handler |
| Placeholder initials "HO" for "House of the Dragon" | initials from capitalised words only |

## 4. Not verified / limitations

- **Your main PostgreSQL service (port 5432)** has not been set up by this run. Run
  `database\setup.ps1 -Demo` there (it asks for the `postgres` password).
- **No browser-automation test suite** for the frontend. The frontend was verified by build,
  type checking, HTTP smoke tests and the screenshots above.
- **Mobile layout** is implemented (responsive classes, mobile menu) but was only captured
  at 1366 px width.
- **External images:** the seed data has no image URLs, so the placeholder path is what
  was exercised. A broken URL falls back to the same placeholder (`onError`).
