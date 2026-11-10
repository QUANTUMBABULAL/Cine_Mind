# API Documentation

Base URL: `http://localhost:4000/api` · JSON in and out · source: `apps/api/src`.

**Authentication:** `Authorization: Bearer <JWT>`. Get a token from `/auth/register` or
`/auth/login`. The token holds only the user id. Roles, permissions and account status are
read from PostgreSQL on **every** request, so revoking a role or suspending a user takes
effect immediately.

**Errors:** `{ "error": "message", "details"?: { field: [messages] }, "constraint"?, "code"? }`

| Status | When |
| --- | --- |
| 400 | validation failure (zod), malformed JSON, CHECK violation (23514), bad id |
| 401 | missing, invalid or expired token; wrong credentials |
| 403 | missing permission; suspended account; Admin self-assignment (42501) |
| 404 | unknown record or route |
| 409 | UNIQUE violation (23505); FK / RESTRICT violation (23503 / 23001) |

## Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | — | API status + `current_database()` and `current_user` (shows `cinemind_app`) |

## Authentication

| Method | Path | Auth | Body | Notes |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | — | `{ username, email, password }` | One transaction: insert user (bcrypt hash) + Viewer role. 201 → `{ token, user }` |
| POST | `/auth/login` | — | `{ email, password }` | 200 → `{ token, user }`; 401 with the same message for unknown email or wrong password |
| GET | `/auth/me` | token | — | current user with roles and permissions |
| POST | `/auth/logout` | — | — | 204. JWTs are stateless: the client deletes the token; tokens expire (`JWT_EXPIRES_IN`, default 8h) |

## Discovery (public)

| Method | Path | Query | Description |
| --- | --- | --- | --- |
| GET | `/universes` | — | universes with title and character counts |
| GET | `/universes/:id` | — | universe + titles + characters |
| GET | `/titles` | `q, genre, media_type, universe_id, sort=name\|rating\|release, limit` | catalogue (from `v_title_catalogue`) |
| GET | `/titles/:id` | — | title + genres + cast + reviews + event count |
| GET | `/genres` | — | genres with title counts |
| GET | `/search` | `q` (required) | matching titles, characters, universes |

## Characters and story (public)

| Method | Path | Query | Description |
| --- | --- | --- | --- |
| GET | `/characters` | `q, universe_id` | character list (from `v_character_details`) |
| GET | `/characters/:id` | — | profile + appearances + directed relationships + arcs |
| GET | `/characters/:id/relationships` | — | `direction: outgoing \| incoming` |
| GET | `/characters/:id/appearances` | — | titles and roles |
| GET | `/characters/:id/timeline` | `order=chronology\|release` | events the character took part in |
| GET | `/characters/:id/arcs` | — | arcs with ordered steps |
| GET | `/titles/:id/events` | `order=chronology\|release` | events with participants |
| GET | `/titles/:id/arcs` | — | all arcs in a title |
| GET | `/events/:id` | — | event + participants |
| GET | `/events/:id/participants` | — | participants |
| GET | `/relationship-types` | — | lookup list |

## User workspace (token required)

`user_id` always comes from the token, never from the request.

| Method | Path | Permission | Body | Description |
| --- | --- | --- | --- | --- |
| GET | `/me/bookmarks` | — | — | own bookmarks |
| POST | `/me/bookmarks` | bookmark.manage | `{ title_id }` **or** `{ character_id }` | 201; duplicate → 409; both/none → 400 |
| DELETE | `/me/bookmarks/:id` | bookmark.manage | — | 204 (only own) |
| GET | `/me/reviews` | — | — | own reviews |
| PUT | `/titles/:id/review` | review.write | `{ rating 1–5, review_text? }` | create (201) or update (200). One per user per title (UPSERT) |
| DELETE | `/titles/:id/review` | review.write | — | 204 |
| GET | `/me/progress` | — | — | own watch progress |
| PUT | `/me/progress/:titleId` | progress.manage | `{ progress_status, progress_percentage 0–100 }` | UPSERT; "completed" forces 100 |
| DELETE | `/me/progress/:titleId` | progress.manage | — | 204 |
| GET | `/me/activity` | — | — | counts and average rating given |

## Administration (token + permission)

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| POST, PUT `/:id`, DELETE `/:id` | `/admin/universes` | content.manage | RESTRICT: deleting a universe that has titles → 409 |
| POST, PUT, DELETE | `/admin/genres` | content.manage | |
| POST, PUT, DELETE | `/admin/titles` | content.manage | body includes `genre_ids[]`; title + genre links in one transaction |
| POST, PUT, DELETE | `/admin/characters` | content.manage | `universe_id` null = standalone |
| GET, POST, PUT, DELETE | `/admin/relationships` | content.manage | directed; DB rejects self- or cross-universe relations |
| POST / DELETE `/:characterId/:titleId` | `/admin/appearances` | content.manage | needed before a character can join a title's events |
| POST | `/admin/events` | content.manage | `{ title_id, event_name, description?, spoiler_level, chronology_order?, release_order?, participants: [{ character_id, participation_type }] }` → `CALL add_story_event(...)` |
| PUT, DELETE | `/admin/events/:id` | content.manage | |
| GET | `/admin/stats` | content.manage | dashboard counts |
| GET | `/admin/users` | users.manage | users with roles |
| GET | `/admin/roles` | users.manage | roles with permissions |
| PATCH | `/admin/users/:id/status` | users.manage | `{ account_status: active\|suspended }`; not on yourself |
| POST | `/admin/users/:id/roles` | users.manage | `{ role_name }` → `CALL assign_user_role(...)`; Admin to yourself → 403 |
| DELETE | `/admin/users/:id/roles/:roleName` | users.manage | cannot remove your own Admin role |
| GET | `/admin/audit` | audit.view | `limit` (default 100) |

Every admin write runs in a transaction that sets `cinemind.current_user_id`, so the audit
trigger records which administrator made the change.

## Example (curl)

```cmd
curl http://localhost:4000/api/titles?genre=Fantasy^&sort=rating
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"alice@cinemind.local\",\"password\":\"Viewer@123\"}"
curl http://localhost:4000/api/me/bookmarks -H "Authorization: Bearer <token>"
```

(In CMD, `^&` escapes `&` inside a URL.)
