# Implementation Evidence

Real output from executing the project. Nothing here was written by hand. See
[`docs/TEST_RESULTS.md`](../docs/TEST_RESULTS.md) for the environment and
[`docs/REPORT_EVIDENCE_GUIDE.md`](../docs/REPORT_EVIDENCE_GUIDE.md) for which report chapter
uses which file.

| Path | Produced by | Content |
| --- | --- | --- |
| `logs/database_setup.log` | `database/setup.ps1 -Reset` | creation of `cinemind_db`, scripts 00–08, role output |
| `outputs/postgres_version.txt` | `SELECT version()` | server version |
| `outputs/schema_inspection.txt` | `database/11_inspect_schema.sql` | tables, views, functions, PK/FK/UNIQUE/CHECK, indexes, triggers, roles, grants, `\d` of key tables |
| `outputs/demo_queries_output.txt` | `database/09_demo_queries.sql` | DDL, DML, constraint errors, Q1–Q14, views, functions, procedure, triggers, transactions, authorization |
| `outputs/validation_output.txt` | `database/10_validation.sql` | 57 `PASS:` checks, ending with `ALL VALIDATION CHECKS PASSED` |
| `logs/api_tests.log` | `npm test` in `apps/api` | 27/27 API integration tests passing |
| `logs/web_build.log` | `npm run build` in `apps/web` | Next.js production build |
| `screenshots/01–09` | headless Chrome `--screenshot` | public pages |
| `screenshots/10–17` | `scripts/capture-screenshots.mjs` | logged-in workspace and admin pages |

The SQL scripts behind these outputs are in [`database/`](../database). They are not
copied here, to avoid duplicates.

In `demo_queries_output.txt`, the single `ERROR: Character … does not appear in title …`
is **intentional**. It shows that a failing `CALL add_story_event` rolls back completely.
