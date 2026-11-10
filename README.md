# CineMind 2.0

**A fictional-universe intelligence and story exploration platform** for anime, films and
series, built as a university DBMS project.

Explore universes and titles, character profiles, **directed** character relationships,
story events in **chronological or release order**, who took part in each event, and how
characters develop through **arcs**. Registered users bookmark, review and track progress.
Administrators manage content and users. Every change is audited by a database trigger.

```
Next.js + Tailwind (apps/web :3000) ──► Express + TypeScript API (apps/api :4000) ──► PostgreSQL 18 (cinemind_db)
```

No ORM: the schema, seed data, views, functions, procedures, triggers and roles are plain
SQL in [`database/`](database), runnable from CMD with `psql`.

## Prerequisites

- Windows with **PostgreSQL 15+** running as a service (tested on **18.6**), plus the
  `postgres` password
- **Node.js 20.6+** (tested on 22.18) and npm

## Setup (Windows CMD, from the repository root)

**1. Install dependencies**

```cmd
npm run install:all
```

**2. Configure the API.** Copy the template and set two secrets:

```cmd
copy apps\api\.env.example apps\api\.env
notepad apps\api\.env
```

`DB_PASSWORD` is the password the setup gives the restricted database role `cinemind_app`.
`JWT_SECRET` must be at least 32 random characters. You can generate one with:

```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**3. Create the database** (asks for the `postgres` password once, hidden):

```cmd
npm run db:setup
```

This runs `database/setup.ps1`: 00–08 in order, sets the `cinemind_app` password from
`apps/api/.env`, and runs the 10_validation self-test. Use `npm run db:setup:demo` to also
run the demo queries, or `npm run db:reset` to rebuild from scratch.

**4. Start the API** (terminal 1):

```cmd
npm run api
```

Check http://localhost:4000/api/health; it should show `"db_user":"cinemind_app"`.

**5. Start the frontend** (terminal 2):

```cmd
npm run web
```

Open http://localhost:3000.

Demo accounts (seed data, local demonstration only):

| Email | Password | Roles |
| --- | --- | --- |
| admin@cinemind.local | Admin@123 | Admin, Viewer |
| alice@cinemind.local | Viewer@123 | Viewer |
| bob@cinemind.local | Viewer@123 | Viewer |

## Commands

| Task | Command |
| --- | --- |
| API tests (needs the DB) | `npm test` |
| Type-check both apps | `npm run typecheck` |
| Production build | `npm run build`, then `npm --prefix apps/api start` and `npm --prefix apps/web start` |
| Regenerate SQL/test evidence | `npm run evidence` |
| Regenerate screenshots (apps running) | `npm run screenshots` |

## Using SQL directly in CMD

```cmd
psql -U postgres -h localhost -p 5432 -d cinemind_db
psql -U postgres -h localhost -p 5432 -d cinemind_db -c "SELECT * FROM universes;"
psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/09_demo_queries.sql
```

Inside psql: `\dt` (tables), `\d characters` (describe), `\l` (databases), `\q` (quit).
If `psql` is not recognised, use `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`. See
[`database/README.md`](database/README.md) for the complete guide.

## What is in the database

21 tables · 6 views · 6 functions · 2 stored procedures · 17 triggers · 28 foreign keys ·
21 CHECK and 19 UNIQUE constraints · 3 database roles (`cinemind_app` is the
least-privilege runtime login and is never a superuser).

Seed data: 4 universes (Game of Thrones, Fullmetal Alchemist, Naruto, The Matrix) plus
standalone *Inception*, 10 titles, 25 characters, 25 relationships, 15 story events,
7 arcs.

## Documentation

| Report chapter | Document |
| --- | --- |
| Introduction | [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) |
| Problem definition | [docs/PROBLEM_DEFINITION.md](docs/PROBLEM_DEFINITION.md) |
| ER model (Mermaid diagram) | [docs/ER_MODEL.md](docs/ER_MODEL.md) |
| ER → relational mapping, normalization | [docs/ER_TO_RELATIONAL_MAPPING.md](docs/ER_TO_RELATIONAL_MAPPING.md) |
| Database design | [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) |
| DDL, DML, queries, procedures, functions, triggers | [docs/DBMS_CONCEPTS.md](docs/DBMS_CONCEPTS.md) |
| API | [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) |
| Front end | [docs/FRONTEND_OVERVIEW.md](docs/FRONTEND_OVERVIEW.md) |
| Test results | [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) |
| References, Appendix A | [docs/REFERENCES.md](docs/REFERENCES.md), [docs/APPENDIX_A.md](docs/APPENDIX_A.md) |
| Chapter → evidence map | [docs/REPORT_EVIDENCE_GUIDE.md](docs/REPORT_EVIDENCE_GUIDE.md) |

Evidence (SQL outputs, test logs, screenshots): [`evidence/`](evidence).

## Security notes

- Secrets live only in git-ignored `.env` files. The frontend gets only the public API URL.
- The API connects as `cinemind_app`, which has DML only. It cannot alter `audit_logs` or
  the role tables.
- Passwords are hashed with bcrypt. All SQL is parameterized. All input is validated with
  zod.
- Authorization is checked by the API on every request, against roles loaded from the
  database. Admin self-assignment is blocked in the API, the stored procedure and a
  trigger.
- JWTs are stored in `localStorage` for simplicity. Logout discards the token, and
  suspending a user invalidates their access immediately.
