# Appendix A — Definitions, Acronyms and Abbreviations

## Acronyms

| Term | Meaning |
| --- | --- |
| DBMS | Database Management System |
| RDBMS | Relational Database Management System |
| SQL | Structured Query Language |
| DDL | Data Definition Language (CREATE, ALTER, DROP) |
| DML | Data Manipulation Language (INSERT, UPDATE, DELETE, SELECT) |
| DCL | Data Control Language (GRANT, REVOKE) |
| TCL | Transaction Control Language (BEGIN, COMMIT, ROLLBACK, SAVEPOINT) |
| ER / ERD | Entity–Relationship (Diagram) |
| PK | Primary Key |
| FK | Foreign Key |
| UK | Unique Key |
| 1NF / 2NF / 3NF / BCNF | First / Second / Third / Boyce–Codd Normal Form |
| ACID | Atomicity, Consistency, Isolation, Durability |
| RBAC | Role-Based Access Control |
| API | Application Programming Interface |
| REST | Representational State Transfer |
| JSON / JSONB | JavaScript Object Notation / PostgreSQL binary JSON type |
| JWT | JSON Web Token |
| CRUD | Create, Read, Update, Delete |
| CTE | Common Table Expression (`WITH …`) |
| PL/pgSQL | PostgreSQL's procedural language |
| SQLSTATE | Five-character standard SQL error code (e.g. 23505) |
| UPSERT | Insert, or update when the row exists (`ON CONFLICT DO UPDATE`) |
| CORS | Cross-Origin Resource Sharing |
| UI / UX | User Interface / User Experience |
| CMD | Windows Command Prompt |

## Definitions

| Term | Definition |
| --- | --- |
| Entity | A real-world object stored as a table row (e.g. a character). |
| Strong entity | An entity identified by its own key. |
| Weak entity | An entity identified only together with an owner entity. (None in this schema; see the mapping document.) |
| Relationship | An association between entities; cardinality 1:1, 1:N or M:N. |
| Recursive relationship | A relationship between rows of the same entity (character ↔ character). |
| Directed relationship | A relationship whose meaning depends on direction (A → B ≠ B → A). |
| Junction (associative) table | A table that implements an M:N relationship, usually with a composite PK. |
| Composite key | A key made of more than one column. |
| Surrogate key | A system-generated key with no business meaning (identity column). |
| Candidate / natural key | A set of business columns that uniquely identifies a row (enforced with UNIQUE). |
| Referential integrity | Every FK value matches an existing PK value (or is NULL). |
| ON DELETE CASCADE / RESTRICT / SET NULL | What happens to child rows when the parent row is deleted. |
| CHECK constraint | A row-level condition every row must satisfy. |
| NULLS NOT DISTINCT | PostgreSQL 15+ option that treats NULLs as equal in a UNIQUE constraint. |
| Index | A structure that speeds up lookups on columns or expressions. |
| View | A stored query that behaves like a virtual table. |
| Function | A named routine returning a value or a set of rows, usable inside SQL. |
| Stored procedure | A routine invoked with `CALL`. It can return values through INOUT parameters and runs as one atomic statement. |
| Trigger | A routine executed automatically BEFORE/AFTER INSERT, UPDATE or DELETE. |
| Transaction | A unit of work that is committed or rolled back as a whole. |
| Savepoint | A marker inside a transaction that can be rolled back to. |
| Database role | A PostgreSQL account or group that holds privileges (e.g. `cinemind_app`). |
| Application role | A row in `roles` (Viewer, Admin) that controls what a website user may do. |
| Least privilege | Granting only the rights an account actually needs. |
| Audit log | An append-only record of who changed what and when. |
| Polymorphic reference | A column that identifies rows in different tables (`audit_logs.entity_id`). |
| Idempotent script | A script that can be run repeatedly with the same final result. |
| Parameterized query | SQL with placeholders (`$1`) whose values are sent separately, preventing SQL injection. |
| Connection pool | A set of reusable database connections kept open by the API. |
| Chronology order | Position of an event in the story's internal timeline. |
| Release order | Position of an event in the order it was shown to the audience. |
| Character arc | A character's development from a starting state to an ending state through events. |
| Universe | A shared fictional world containing one or more titles. |
| Standalone title | A title that belongs to no universe (`universe_id` is NULL). |
