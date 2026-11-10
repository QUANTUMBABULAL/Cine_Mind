-- =============================================================================
-- CineMind 2.0 — 09_demo_queries.sql
-- DBMS demonstrations: DDL, DML, the 14 required queries, views, functions,
-- a stored procedure, triggers, transactions and authorization.
--
-- Safe to re-run: it creates and drops its own demo table, and every change
-- to real data is either rolled back or reversed in the same script.
--
-- Run everything:
--   psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/09_demo_queries.sql
-- Or copy any single query into an interactive psql session.
-- =============================================================================

\echo '=================== A. DDL ==================='

-- A1. CREATE TABLE with PK, FK, UNIQUE, CHECK and NOT NULL (a scratch object,
--     so the real schema is never dropped).
DROP TABLE IF EXISTS demo_watch_parties;
CREATE TABLE demo_watch_parties (
    party_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    host_id     INTEGER NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    title_id    INTEGER NOT NULL REFERENCES titles (title_id),
    party_name  VARCHAR(100) NOT NULL UNIQUE,
    max_guests  INTEGER NOT NULL CHECK (max_guests BETWEEN 2 AND 50)
);

-- A2. ALTER TABLE: add a column and a constraint.
ALTER TABLE demo_watch_parties ADD COLUMN scheduled_at TIMESTAMPTZ;
ALTER TABLE demo_watch_parties ADD CONSTRAINT chk_demo_future CHECK (scheduled_at > '2000-01-01');

-- A3. CREATE INDEX.
CREATE INDEX idx_demo_watch_parties_title ON demo_watch_parties (title_id);

\d demo_watch_parties

\echo '=================== B. DML ==================='

-- B1. INSERT
INSERT INTO demo_watch_parties (host_id, title_id, party_name, max_guests, scheduled_at)
SELECT u.user_id, t.title_id, 'Matrix Marathon', 6, now() + INTERVAL '7 days'
FROM users u, titles t
WHERE u.username = 'bob' AND t.name = 'The Matrix';

-- B2. SELECT
SELECT party_id, party_name, max_guests FROM demo_watch_parties;

-- B3. UPDATE
UPDATE demo_watch_parties SET max_guests = 10 WHERE party_name = 'Matrix Marathon';
SELECT party_name, max_guests FROM demo_watch_parties;

-- B4. DELETE
DELETE FROM demo_watch_parties WHERE party_name = 'Matrix Marathon';
SELECT COUNT(*) AS remaining_parties FROM demo_watch_parties;

-- A4. DROP TABLE (only the scratch table).
DROP TABLE demo_watch_parties;

\echo '=================== C. Constraint demonstrations ==================='
-- Each block attempts an invalid change and prints the error PostgreSQL raises.
DO $$
BEGIN
    INSERT INTO reviews (user_id, title_id, rating)
    SELECT u.user_id, t.title_id, 9 FROM users u, titles t
    WHERE u.username = 'bob' AND t.name = 'Naruto';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'CHECK rejected rating 9: %', SQLERRM;
END $$;

DO $$
BEGIN
    INSERT INTO reviews (user_id, title_id, rating)
    SELECT u.user_id, t.title_id, 2 FROM users u, titles t
    WHERE u.username = 'alice' AND t.name = 'Game of Thrones';
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'UNIQUE rejected a second review by the same user: %', SQLERRM;
END $$;

DO $$
BEGIN
    INSERT INTO character_appearances (character_id, title_id, character_role) VALUES (999999, 1, 'cameo');
EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'FOREIGN KEY rejected unknown character: %', SQLERRM;
END $$;

DO $$
BEGIN
    INSERT INTO character_relationships (source_character_id, target_character_id, relationship_type_id)
    SELECT c.character_id, c.character_id, rt.relationship_type_id
    FROM characters c, relationship_types rt
    WHERE c.name = 'Neo' AND rt.name = 'Rival Of';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'CHECK rejected a self-relationship: %', SQLERRM;
END $$;

DO $$
BEGIN
    INSERT INTO bookmarks (user_id, title_id, character_id)
    SELECT u.user_id, 1, 1 FROM users u WHERE u.username = 'bob';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'CHECK rejected a bookmark with two targets: %', SQLERRM;
END $$;

\echo '=================== D. Required queries ==================='

\echo 'Q1. Simple SELECT: all universes'
SELECT universe_id, name, origin_type FROM universes;

\echo 'Q2. WHERE + ORDER BY: titles released after 2005, newest first'
SELECT name, media_type, release_date
FROM titles
WHERE release_date > DATE '2005-01-01'
ORDER BY release_date DESC;

\echo 'Q3. INNER JOIN (4 tables): which characters appear in which title of which universe'
SELECT u.name AS universe, t.name AS title, c.name AS character, ca.character_role
FROM character_appearances ca
JOIN characters c ON c.character_id = ca.character_id
JOIN titles t     ON t.title_id = ca.title_id
JOIN universes u  ON u.universe_id = t.universe_id
WHERE u.name = 'Game of Thrones'
ORDER BY t.release_date, c.name;

\echo 'Q4. LEFT JOIN: every title with its number of reviews (titles with no reviews included)'
SELECT t.name, COUNT(r.review_id) AS reviews
FROM titles t
LEFT JOIN reviews r ON r.title_id = t.title_id
GROUP BY t.title_id, t.name
ORDER BY reviews DESC, t.name;

\echo 'Q5. GROUP BY + aggregates: titles and characters per universe'
SELECT COALESCE(u.name, '(standalone)') AS universe,
       COUNT(DISTINCT t.title_id)       AS titles,
       COUNT(DISTINCT ca.character_id)  AS characters
FROM titles t
LEFT JOIN universes u              ON u.universe_id = t.universe_id
LEFT JOIN character_appearances ca ON ca.title_id = t.title_id
GROUP BY u.name
ORDER BY titles DESC;

\echo 'Q6. HAVING: characters who took part in at least 3 story events'
SELECT c.name, COUNT(*) AS events
FROM event_participants ep
JOIN characters c ON c.character_id = ep.character_id
GROUP BY c.character_id, c.name
HAVING COUNT(*) >= 3
ORDER BY events DESC, c.name;

\echo 'Q7. UPDATE (inside a transaction, rolled back): bob finishes The Matrix Reloaded'
BEGIN;
UPDATE watch_progress wp
SET progress_status = 'completed', progress_percentage = 100
FROM users u, titles t
WHERE wp.user_id = u.user_id AND wp.title_id = t.title_id
  AND u.username = 'bob' AND t.name = 'The Matrix Reloaded'
RETURNING wp.progress_id, wp.progress_status, wp.progress_percentage, wp.updated_at;
ROLLBACK;

\echo 'Q8. DELETE (inside a transaction, rolled back): remove bob''s Inception bookmark'
BEGIN;
DELETE FROM bookmarks b
USING users u, titles t
WHERE b.user_id = u.user_id AND b.title_id = t.title_id
  AND u.username = 'bob' AND t.name = 'Inception'
RETURNING b.bookmark_id;
ROLLBACK;

\echo 'Q9. Nested query (IN): titles that contain at least one major-spoiler event'
SELECT name
FROM titles
WHERE title_id IN (SELECT title_id FROM story_events WHERE spoiler_level = 'major')
ORDER BY name;

\echo 'Q9b. Nested query (NOT EXISTS): characters who never took part in any event'
SELECT c.name
FROM characters c
WHERE NOT EXISTS (SELECT 1 FROM event_participants ep WHERE ep.character_id = c.character_id)
ORDER BY c.name;

\echo 'Q10. Correlated subquery: titles rated above the average of their own universe'
SELECT t.name, fn_title_average_rating(t.title_id) AS rating
FROM titles t
WHERE t.universe_id IS NOT NULL
  AND fn_title_average_rating(t.title_id) > (
        SELECT AVG(r2.rating)
        FROM reviews r2
        JOIN titles t2 ON t2.title_id = r2.title_id
        WHERE t2.universe_id = t.universe_id      -- refers to the outer row
  )
ORDER BY rating DESC;

\echo 'Q11. COUNT / AVG / MAX / MIN: overall review statistics'
SELECT COUNT(*)               AS total_reviews,
       ROUND(AVG(rating), 2)  AS average_rating,
       MAX(rating)            AS highest,
       MIN(rating)            AS lowest
FROM reviews;

\echo 'Q12. Character participation in story events (The Red Wedding)'
SELECT e.event_name, c.name AS character, ep.participation_type, ep.outcome
FROM story_events e
JOIN event_participants ep ON ep.event_id = e.event_id
JOIN characters c          ON c.character_id = ep.character_id
WHERE e.event_name = 'The Red Wedding'
ORDER BY ep.participation_type, c.name;

\echo 'Q13. Character arc progression: Jon Snow''s arcs step by step'
SELECT a.arc_name, ae.sequence_number AS step, e.event_name, ae.development_note
FROM character_arcs a
JOIN characters c  ON c.character_id = a.character_id
JOIN arc_events ae ON ae.arc_id = a.arc_id
JOIN story_events e ON e.event_id = ae.event_id
WHERE c.name = 'Jon Snow'
ORDER BY a.arc_name, ae.sequence_number;

\echo 'Q14. Popular / highly rated titles: at least 2 reviews, best average first'
SELECT t.name, COUNT(r.review_id) AS reviews, ROUND(AVG(r.rating), 2) AS average_rating
FROM titles t
JOIN reviews r ON r.title_id = t.title_id
GROUP BY t.title_id, t.name
HAVING COUNT(r.review_id) >= 2
ORDER BY average_rating DESC, reviews DESC;

\echo 'Extra: chronological vs release order of Game of Thrones events'
SELECT event_name, chronology_order, release_order
FROM story_events e JOIN titles t ON t.title_id = e.title_id
WHERE t.name = 'Game of Thrones'
ORDER BY chronology_order;

\echo 'Extra: directed relationships — both directions shown separately'
SELECT s.name AS source, rt.name AS relationship, tg.name AS target
FROM character_relationships cr
JOIN characters s          ON s.character_id = cr.source_character_id
JOIN characters tg         ON tg.character_id = cr.target_character_id
JOIN relationship_types rt ON rt.relationship_type_id = cr.relationship_type_id
WHERE 'Jon Snow' IN (s.name, tg.name)
ORDER BY source, target;

\echo '=================== E. Views ==================='
SELECT title_name, universe_name, genres, average_rating, review_count FROM v_title_catalogue ORDER BY title_name;
SELECT character_name, universe_name, appearance_count, event_count FROM v_character_details ORDER BY event_count DESC, character_name LIMIT 8;
SELECT event_name, title_name, participant_count, participant_names FROM v_event_details WHERE title_name = 'Game of Thrones' ORDER BY chronology_order;
SELECT character_name, title_name, event_name, chronology_order, outcome FROM v_character_timeline WHERE character_name = 'Arya Stark' ORDER BY chronology_order;
SELECT character_name, arc_name, sequence_number, total_steps, event_name FROM v_character_arc_progress WHERE character_name = 'Edward Elric' ORDER BY sequence_number;
SELECT title_name, review_count, average_rating, highest_rating, lowest_rating FROM v_title_ratings WHERE review_count > 0 ORDER BY average_rating DESC;

\echo '=================== F. Functions ==================='
SELECT t.name,
       fn_title_average_rating(t.title_id) AS average_rating
FROM titles t ORDER BY t.name;

SELECT c.name,
       fn_character_appearance_count(c.character_id) AS appearances,
       fn_character_event_count(c.character_id)      AS events
FROM characters c WHERE c.name IN ('Eddard Stark', 'Neo', 'Edward Elric');

SELECT u.username,
       fn_user_has_permission(u.user_id, 'content.manage') AS can_manage_content
FROM users u ORDER BY u.username;

SELECT * FROM fn_character_timeline(
    (SELECT character_id FROM characters WHERE name = 'Arya Stark'), 'release');

\echo '=================== G. Stored procedure (CALL) ==================='
-- CALL arguments cannot contain subqueries, so the ids are looked up first
-- and stored in psql variables with \gset.
SELECT title_id AS matrix_title_id FROM titles WHERE name = 'The Matrix' \gset
SELECT array_agg(character_id ORDER BY name)::TEXT AS neo_and_trinity
FROM characters WHERE name IN ('Neo', 'Trinity') \gset
SELECT character_id AS daenerys_id FROM characters WHERE name = 'Daenerys Targaryen' \gset

-- Atomic insert of an event + participants, then rolled back to keep data clean.
BEGIN;
CALL add_story_event(
    :matrix_title_id,
    'Demo: rooftop rescue', 'Demo event created by the stored procedure.', 'minor',
    NULL, NULL,
    :'neo_and_trinity'::INTEGER[],
    ARRAY['central', 'supporting']::VARCHAR[],
    NULL);
SELECT event_name, chronology_order, release_order, participant_names
FROM v_event_details WHERE event_name = 'Demo: rooftop rescue';
ROLLBACK;

-- Failure case: Daenerys does not appear in The Matrix, so the trigger raises
-- an error and NOTHING from the CALL is kept (the event is not created either).
-- ON_ERROR_STOP is switched off for this one statement, because the error is the point.
\set ON_ERROR_STOP 0
CALL add_story_event(
    :matrix_title_id, 'Demo: invalid crossover', NULL, 'none', NULL, NULL,
    ARRAY[:daenerys_id], ARRAY['central']::VARCHAR[], NULL);
\set ON_ERROR_STOP 1
SELECT COUNT(*) AS invalid_events_saved FROM story_events WHERE event_name = 'Demo: invalid crossover';

\echo '=================== H. Triggers ==================='
BEGIN;
-- updated_at trigger: the timestamp changes on UPDATE.
SELECT review_id, rating, updated_at AS before_update
FROM reviews r JOIN users u USING (user_id) JOIN titles t USING (title_id)
WHERE u.username = 'bob' AND t.name = 'Game of Thrones';

-- The API stores the acting user for the transaction (like SET LOCAL);
-- the audit trigger reads it through fn_current_app_user().
SELECT set_config('cinemind.current_user_id',
                  (SELECT user_id::TEXT FROM users WHERE username = 'bob'), true) AS acting_user_id;

UPDATE reviews r SET rating = 4
FROM users u, titles t
WHERE r.user_id = u.user_id AND r.title_id = t.title_id
  AND u.username = 'bob' AND t.name = 'Game of Thrones'
RETURNING r.review_id, r.rating, r.updated_at AS after_update;

-- Audit trigger: the UPDATE above produced an audit row with old/new values.
SELECT action, entity_type, entity_id, user_id,
       old_data ->> 'rating' AS old_rating, new_data ->> 'rating' AS new_rating
FROM audit_logs
WHERE entity_type = 'reviews'
ORDER BY audit_id DESC LIMIT 1;
ROLLBACK;

\echo '=================== I. Transactions ==================='
-- COMMIT: a genre and its title links are added atomically, then removed again.
BEGIN;
INSERT INTO genres (name, description) VALUES ('Cyberpunk', 'High tech, low life');
INSERT INTO title_genres (title_id, genre_id)
SELECT t.title_id, g.genre_id FROM titles t, genres g
WHERE t.name LIKE 'The Matrix%' AND g.name = 'Cyberpunk';
COMMIT;
SELECT g.name, COUNT(*) AS linked_titles FROM genres g JOIN title_genres tg USING (genre_id)
WHERE g.name = 'Cyberpunk' GROUP BY g.name;
DELETE FROM genres WHERE name = 'Cyberpunk';   -- cascades to title_genres

-- ROLLBACK: a half-finished change is undone completely.
BEGIN;
INSERT INTO universes (name, description, origin_type) VALUES ('Demo Universe', 'Temporary', 'original');
SELECT COUNT(*) AS inside_transaction FROM universes WHERE name = 'Demo Universe';
ROLLBACK;
SELECT COUNT(*) AS after_rollback FROM universes WHERE name = 'Demo Universe';

-- SAVEPOINT: undo only part of a transaction.
BEGIN;
INSERT INTO relationship_types (name, description) VALUES ('Demo Kept', 'kept until rollback');
SAVEPOINT before_second;
INSERT INTO relationship_types (name, description) VALUES ('Demo Discarded', 'undone by savepoint');
ROLLBACK TO SAVEPOINT before_second;
SELECT name FROM relationship_types WHERE name LIKE 'Demo%';
ROLLBACK;

\echo '=================== J. Authorization ==================='
-- Database roles and their attributes.
SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname LIKE 'cinemind%' ORDER BY rolname;

-- Privilege checks for the runtime role (no login needed: has_*_privilege).
SELECT 'cinemind_app' AS role,
       has_table_privilege('cinemind_app', 'reviews', 'INSERT')    AS can_insert_reviews,
       has_table_privilege('cinemind_app', 'audit_logs', 'INSERT') AS can_insert_audit,
       has_table_privilege('cinemind_app', 'audit_logs', 'DELETE') AS can_delete_audit,
       has_table_privilege('cinemind_app', 'roles', 'UPDATE')      AS can_update_roles;

SELECT 'cinemind_readonly' AS role,
       has_table_privilege('cinemind_readonly', 'titles', 'SELECT')        AS can_read_titles,
       has_table_privilege('cinemind_readonly', 'titles', 'INSERT')        AS can_insert_titles,
       has_column_privilege('cinemind_readonly', 'users', 'password_hash', 'SELECT') AS can_read_password_hash;

-- GRANT / REVOKE in action, using SET ROLE inside a rolled-back transaction.
BEGIN;
SET LOCAL ROLE cinemind_readonly;
SELECT current_user, COUNT(*) AS readable_titles FROM titles;
DO $$
BEGIN
    INSERT INTO genres (name) VALUES ('Not allowed');
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'cinemind_readonly cannot INSERT: %', SQLERRM;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE cinemind_app;
DO $$
BEGIN
    DELETE FROM audit_logs;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'cinemind_app cannot DELETE audit history: %', SQLERRM;
END $$;
ROLLBACK;
