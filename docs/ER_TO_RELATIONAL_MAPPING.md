# ER to Relational Mapping

*Report chapter 4.* Each step follows the standard ER-to-relational mapping algorithm.
Notation: **PK** underlined in the report, FK → referenced table.

## Step 1 — Strong entities → tables

Each strong entity becomes a table with a surrogate key
`INTEGER GENERATED ALWAYS AS IDENTITY` (`audit_logs` uses `BIGINT`, because it grows fastest).

| Table | PK | Natural / candidate key (UNIQUE) |
| --- | --- | --- |
| users | user_id | email; lower(username) |
| roles | role_id | role_name |
| permissions | permission_id | permission_code |
| universes | universe_id | name |
| titles | title_id | (name, release_date) NULLS NOT DISTINCT |
| genres | genre_id | name |
| characters | character_id | (universe_id, name) NULLS NOT DISTINCT |
| relationship_types | relationship_type_id | name |
| story_events | event_id | (title_id, event_name), (title_id, chronology_order), (title_id, release_order) |
| character_arcs | arc_id | (character_id, title_id, arc_name) |
| reviews | review_id | (user_id, title_id) |
| watch_progress | progress_id | (user_id, title_id) |
| bookmarks | bookmark_id | (user_id, title_id), (user_id, character_id) |
| audit_logs | audit_id | — |

**Why surrogate keys?** Names change (an admin can rename a title), and the natural keys
are composite or nullable. Integer keys keep foreign keys small and stable. The natural
keys are still enforced with `UNIQUE`.

## Step 2 — Weak entities

There are **no weak entities in the strict sense**: every table has its own key. Two
entities are *existence-dependent*, and this is modelled with `NOT NULL` FKs plus
`ON DELETE CASCADE`:

- `story_events` depends on `titles` (deleting a title deletes its events).
- `character_arcs` depends on `characters` and `titles`.

We gave them surrogate keys rather than partial keys like `(title_id, event_seq)`. This
lets other tables (`event_participants`, `arc_events`) reference them with a single
column.

## Step 3 — 1:N relationships → FK on the "many" side

| Relationship | FK column | NULL? | ON DELETE | Reason |
| --- | --- | --- | --- | --- |
| Universe 1:N Title | titles.universe_id | **NULL** (standalone films) | RESTRICT | a universe with titles cannot be removed by accident |
| Universe 1:N Character | characters.universe_id | NULL | RESTRICT | same |
| Title 1:N StoryEvent | story_events.title_id | NOT NULL | CASCADE | events cannot exist without their title |
| Character 1:N CharacterArc | character_arcs.character_id | NOT NULL | CASCADE | |
| Title 1:N CharacterArc | character_arcs.title_id | NOT NULL | CASCADE | |
| RelationshipType 1:N CharacterRelationship | relationship_type_id | NOT NULL | RESTRICT | a type still in use cannot be deleted |
| User 1:N Bookmark / Review / WatchProgress | user_id | NOT NULL | CASCADE | personal data goes with the account |
| User 1:N AuditLog | audit_logs.user_id | NULL (system) | SET NULL | history survives user deletion |

## Step 4 — M:N relationships → junction tables with composite PKs

| Junction table | Composite PK | Relationship attributes |
| --- | --- | --- |
| user_roles | (user_id, role_id) | assigned_at |
| role_permissions | (role_id, permission_id) | — |
| title_genres | (title_id, genre_id) | — |
| character_appearances | (character_id, title_id) | character_role, appearance_notes |
| event_participants | (event_id, character_id) | participation_type, involvement_description, outcome |
| arc_events | (arc_id, event_id) | sequence_number (UNIQUE per arc), development_note |

Each composite PK prevents the same pair being stored twice. Each part is also an FK.
A secondary index on the second column (for example, `idx_title_genres_genre`) supports
lookups in the reverse direction.

Three M:N relationships use a **surrogate key + UNIQUE pair** instead of a composite PK:

- `reviews`, `watch_progress`: the row is an entity in its own right (it is updated, has
  timestamps and is referenced by the API by id). `UNIQUE (user_id, title_id)` keeps "at
  most one per user per title".
- `character_relationships`: the same two characters can be related in several ways
  (e.g. *Ally Of* and *Loves*). The key is `relationship_id`, and
  `UNIQUE (source, target, type)` prevents exact duplicates.

## Step 5 — Recursive relationship

Character RELATES TO Character becomes `character_relationships(source_character_id →
characters, target_character_id → characters)`, with `CHECK (source <> target)`.
Direction is meaningful, so no symmetric duplicate is created automatically.

## Step 6 — Exclusive (xor) relationship

Bookmark → Title **or** Character becomes two nullable FKs plus
`CHECK (num_nonnulls(title_id, character_id) = 1)`. We chose this over one polymorphic
`target_id`, which could not be a real foreign key.

## Step 7 — Multivalued attributes

None are stored as lists. Genres, roles, permissions and participants are rows in
junction tables, never comma-separated strings. Views build arrays (`array_agg`) only
**for output**.

## Normalization

| Normal form | How the design satisfies it |
| --- | --- |
| **1NF** | Atomic columns only; no repeating groups or CSV values; every table has a PK. |
| **2NF** | In junction tables with composite keys, every non-key attribute depends on the **whole** key. For example, `character_role` depends on (character, title), not on either alone. |
| **3NF / BCNF** | No transitive dependencies. Universe names live only in `universes`, genre names only in `genres`, role names only in `roles`. Every determinant is a candidate key. |

**Deliberate decision — no redundant `title_id` in `arc_events`.** A composite FK
`(arc_id, title_id)` could force an arc's events to belong to the arc's title. But
`title_id` would depend on `arc_id` alone, which is a partial dependency that violates
2NF. We keep the table normalized and enforce the rule with the trigger
`trg_validate_story_links` instead. The same reasoning applies to "a character must appear
in the title of its events and arcs" and "related characters share a universe".

**Derived values are not stored.** Average rating, appearance count and event count are
computed by functions and views (`fn_title_average_rating`, `v_title_catalogue`), so they
can never become stale.
