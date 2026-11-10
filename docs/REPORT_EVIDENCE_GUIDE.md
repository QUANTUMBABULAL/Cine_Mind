# Report Evidence Guide

Maps each chapter of the university report to the implementation files and the real
evidence that support it. All evidence was produced by actually running the code (see
[TEST_RESULTS.md](TEST_RESULTS.md) for the environment).

| # | Chapter | Write it from | Implementation | Evidence to include |
| --- | --- | --- | --- | --- |
| 1 | Introduction | [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | whole repository | `evidence/screenshots/01_home.png` |
| 2 | Problem Definition | [PROBLEM_DEFINITION.md](PROBLEM_DEFINITION.md) | — | `06_story_explorer_chronology.png` vs `07_story_explorer_release.png` (ordering problem), `05_character_jon_snow.png` (directed relationships, multiple arcs) |
| 3 | ER Model | [ER_MODEL.md](ER_MODEL.md) (Mermaid diagram: render at https://mermaid.live or in VS Code/GitHub and export PNG) | `database/01_schema.sql` | rendered ER diagram |
| 4 | ER to Relational Mapping | [ER_TO_RELATIONAL_MAPPING.md](ER_TO_RELATIONAL_MAPPING.md), [DATABASE_DESIGN.md](DATABASE_DESIGN.md) | `01_schema.sql`, `02_constraints_indexes.sql` | `evidence/outputs/schema_inspection.txt` sections *Primary keys*, *Foreign keys*, *UNIQUE*, *CHECK* |
| 5 | DDL Statements | [DBMS_CONCEPTS.md § DDL](DBMS_CONCEPTS.md) | `00_create_database.sql`, `01_schema.sql`, `02_constraints_indexes.sql`, `06_views.sql`, `09_demo_queries.sql` §A | `evidence/logs/database_setup.log`; `demo_queries_output.txt` §A (the `\d demo_watch_parties` output); `schema_inspection.txt` (`\dt`, `\d characters`) |
| 6 | DML Statements | [DBMS_CONCEPTS.md § DML](DBMS_CONCEPTS.md) | `07_seed_data.sql`, `09_demo_queries.sql` §B | `demo_queries_output.txt` §B (INSERT → SELECT → UPDATE → DELETE results) |
| 7 | Queries (simple, update, delete, correlated, nested) | [DBMS_CONCEPTS.md § Queries](DBMS_CONCEPTS.md) | `09_demo_queries.sql` §D, Q1–Q14 | `demo_queries_output.txt` §D: Q1 simple, Q7 UPDATE, Q8 DELETE, Q9/Q9b nested, Q10 correlated, plus joins, GROUP BY/HAVING and aggregates |
| 8 | Stored Procedures, Functions and Triggers | [DBMS_CONCEPTS.md § Functions…](DBMS_CONCEPTS.md) | `03_functions.sql`, `04_triggers.sql`, `05_procedures.sql` | `demo_queries_output.txt` §F (functions), §G (CALL + atomic failure), §H (updated_at + audit row); `validation_output.txt` (PASS lines for triggers/procedures); `17_admin_audit_log.png` (trigger output seen in the app) |
| 9 | Front End Development | [FRONTEND_OVERVIEW.md](FRONTEND_OVERVIEW.md), [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | `apps/web/src`, `apps/api/src` | screenshots `01`–`17`; `evidence/logs/api_tests.log`; `evidence/logs/web_build.log` |
| 10 | References / Bibliography | [REFERENCES.md](REFERENCES.md) | — | — |
| 11 | Appendix A | [APPENDIX_A.md](APPENDIX_A.md) | — | — |

Transactions and database authorization are not separate chapters. Include them in
chapter 6 or 8:

- `demo_queries_output.txt` §I (BEGIN/COMMIT, ROLLBACK, SAVEPOINT) and §J (SET ROLE
  denied INSERT, `has_table_privilege` results);
- `database/08_roles_permissions.sql` (CREATE ROLE, GRANT, REVOKE);
- `schema_inspection.txt` sections *Database roles* and *Table privileges of
  cinemind_app*.

## Showing it live in the viva

```cmd
psql -U postgres -h localhost -p 5432 -d cinemind_db
\dt
\d character_relationships
SELECT * FROM v_character_timeline WHERE character_name = 'Arya Stark' ORDER BY chronology_order;
\i database/10_validation.sql
```

Then open http://localhost:3000. Show the Story Explorer order toggle, log in as
`alice@cinemind.local` (review → the average changes), then as `admin@cinemind.local`
(create an event → it appears in the Audit log tab).

## Regenerating evidence on your own machine

```cmd
powershell -ExecutionPolicy Bypass -File database\setup.ps1 -Demo
powershell -ExecutionPolicy Bypass -File scripts\generate-evidence.ps1
node scripts\capture-screenshots.mjs        :: API and web must be running
```
