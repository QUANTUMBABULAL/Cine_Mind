# CLAUDE.md — CineMind 2.0

CineMind 2.0 is a fictional-universe story exploration platform **and a university DBMS
project**. Database design, integrity and explainable SQL come first.

## Stack (fixed)

- Frontend: Next.js 16 + TypeScript + Tailwind CSS 4 (`apps/web`)
- Backend: Node.js + Express 5 + TypeScript (`apps/api`), `pg` connection pool
- Database: PostgreSQL 18, native on Windows, database `cinemind_db`
- Flow: Next.js → Express API → PostgreSQL. The frontend never touches the database.
- Not used: Neo4j, MongoDB, Prisma/any ORM or query builder, mandatory Docker.

## Database rules

- All schema objects live in ordered, **re-runnable** plain SQL scripts in `database/`
  (00–11). Apply them with `database/setup.ps1`. Never change the schema any other way.
- Triggers (04) run before the seed (07), so seed data is checked too. Seed rows are
  matched by natural keys with `ON CONFLICT DO NOTHING`; never hard-code ids.
- Constraints belong in the database (PK, FK, UNIQUE, CHECK, triggers). API validation
  complements them.
- Cross-table rules use the `trg_validate_story_links` trigger, not redundant composite-FK
  columns (to keep 2NF).
- The API connects as `cinemind_app` (DML only, not a superuser). It must not need extra
  privileges. If a new table is added, update `08_roles_permissions.sql`.
- After changing SQL, run `10_validation.sql`. It must end with
  `ALL VALIDATION CHECKS PASSED`. Add a check for any new rule.
- `CALL` arguments cannot be subqueries. Use psql `\gset` variables or parameters.

## API rules

- Hand-written, parameterized SQL only (`$1…`). Identifiers are never built from user input.
- Validate every input with zod (`parse()` in `utils/http.ts`).
- Protected routes: `requireAuth` + `requirePermission(code)`. Take `user_id` from the token.
- Writes that must be atomic or audited use `withTransaction(actingUserId, …)`. It sets
  `cinemind.current_user_id` for the audit trigger.
- Run `npm test` in `apps/api` (integration tests against the real DB).

## Secrets

- Only `.env.example` files are committed. `apps/api/.env` holds `DB_PASSWORD` and
  `JWT_SECRET`.
- Never print, commit or guess database passwords. The `postgres` admin password belongs
  to the user. `setup.ps1` prompts for it.

## Working style

- Keep changes small and explainable. Avoid new dependencies unless clearly needed.
- Never claim a test passed without running it. Record real outputs in `evidence/` and
  `docs/TEST_RESULTS.md`.
- Commit only when asked.

## Useful commands

```
npm run db:setup         # create/update cinemind_db (prompts for postgres password)
npm run api              # API on :4000
npm run web              # web on :3000
npm test                 # API integration tests
npm run typecheck        # both apps
npm run evidence         # regenerate evidence/outputs and api_tests.log
```
