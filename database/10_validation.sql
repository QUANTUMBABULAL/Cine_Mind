-- =============================================================================
-- CineMind 2.0 — 10_validation.sql
-- Automated database self-test. Every check raises an EXCEPTION on failure,
-- so with ON_ERROR_STOP the script stops at the first failing check.
-- All test changes happen inside one transaction that is ROLLED BACK.
--
-- Run:  psql -U postgres -h localhost -p 5432 -d cinemind_db -v ON_ERROR_STOP=1 -f database/10_validation.sql
-- =============================================================================

\set ON_ERROR_STOP 1

BEGIN;

-- Helper: asserts a condition, printing PASS or raising FAIL.
CREATE OR REPLACE FUNCTION pg_temp.check(p_name TEXT, p_ok BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF p_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'FAIL: %', p_name;
    END IF;
    RAISE NOTICE 'PASS: %', p_name;
END $$;

-- Helper: asserts that a statement fails with the given SQLSTATE.
CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_name TEXT, p_sql TEXT, p_sqlstate TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = p_sqlstate THEN
            RAISE NOTICE 'PASS: % (SQLSTATE %)', p_name, SQLSTATE;
            RETURN;
        END IF;
        RAISE EXCEPTION 'FAIL: % — expected SQLSTATE % but got %: %', p_name, p_sqlstate, SQLSTATE, SQLERRM;
    END;
    RAISE EXCEPTION 'FAIL: % — statement succeeded but should have failed', p_name;
END $$;

-- ---------------- 1. Structure ----------------
SELECT pg_temp.check('21 application tables exist',
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE') = 21);

SELECT pg_temp.check('6 views exist',
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public'
       AND table_name IN ('v_title_catalogue', 'v_character_details', 'v_event_details',
                          'v_character_timeline', 'v_character_arc_progress', 'v_title_ratings')) = 6);

SELECT pg_temp.check('procedures add_story_event and assign_user_role exist',
    (SELECT COUNT(*) FROM pg_proc WHERE prokind = 'p'
       AND proname IN ('add_story_event', 'assign_user_role')) = 2);

SELECT pg_temp.check('composite primary keys on the 6 junction tables',
    (SELECT COUNT(*) FROM (
        SELECT tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage k
          ON k.constraint_name = tc.constraint_name AND k.table_name = tc.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
        GROUP BY tc.table_name HAVING COUNT(*) = 2) x) = 6);

-- ---------------- 2. Seed data minimums ----------------
SELECT pg_temp.check('>= 4 universes',  (SELECT COUNT(*) FROM universes) >= 4);
SELECT pg_temp.check('>= 8 titles',     (SELECT COUNT(*) FROM titles) >= 8);
SELECT pg_temp.check('>= 12 characters',(SELECT COUNT(*) FROM characters) >= 12);
SELECT pg_temp.check('>= 8 relationships', (SELECT COUNT(*) FROM character_relationships) >= 8);
SELECT pg_temp.check('>= 8 story events',  (SELECT COUNT(*) FROM story_events) >= 8);
SELECT pg_temp.check('>= 4 character arcs',(SELECT COUNT(*) FROM character_arcs) >= 4);
SELECT pg_temp.check('a standalone title exists (NULL universe)',
    EXISTS (SELECT 1 FROM titles WHERE universe_id IS NULL));
SELECT pg_temp.check('a character has multiple arcs in one title',
    EXISTS (SELECT 1 FROM character_arcs GROUP BY character_id, title_id HAVING COUNT(*) > 1));
SELECT pg_temp.check('every user has the Viewer role',
    NOT EXISTS (SELECT 1 FROM users u WHERE NOT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r USING (role_id)
        WHERE ur.user_id = u.user_id AND r.role_name = 'Viewer')));

-- ---------------- 3. Constraints ----------------
SELECT pg_temp.expect_error('rating must be 1..5',
    $q$INSERT INTO reviews (user_id, title_id, rating) VALUES (
        (SELECT user_id FROM users WHERE username='bob'), (SELECT title_id FROM titles WHERE name='Naruto'), 6)$q$,
    '23514');

SELECT pg_temp.expect_error('one review per user per title',
    $q$INSERT INTO reviews (user_id, title_id, rating) VALUES (
        (SELECT user_id FROM users WHERE username='alice'), (SELECT title_id FROM titles WHERE name='Game of Thrones'), 3)$q$,
    '23505');

SELECT pg_temp.expect_error('progress percentage must be 0..100',
    $q$UPDATE watch_progress SET progress_percentage = 120$q$, '23514');

SELECT pg_temp.expect_error('completed progress must be 100%',
    $q$UPDATE watch_progress SET progress_status = 'completed', progress_percentage = 50$q$, '23514');

SELECT pg_temp.expect_error('bookmark needs exactly one target (none)',
    $q$INSERT INTO bookmarks (user_id) VALUES ((SELECT user_id FROM users WHERE username='bob'))$q$, '23514');

SELECT pg_temp.expect_error('bookmark needs exactly one target (two)',
    $q$INSERT INTO bookmarks (user_id, title_id, character_id) VALUES (
        (SELECT user_id FROM users WHERE username='bob'), 1, 1)$q$, '23514');

SELECT pg_temp.expect_error('duplicate title bookmark rejected',
    $q$INSERT INTO bookmarks (user_id, title_id) VALUES (
        (SELECT user_id FROM users WHERE username='bob'), (SELECT title_id FROM titles WHERE name='Inception'))$q$,
    '23505');

SELECT pg_temp.expect_error('self relationship rejected',
    $q$INSERT INTO character_relationships (source_character_id, target_character_id, relationship_type_id)
       SELECT character_id, character_id, 1 FROM characters WHERE name='Neo'$q$, '23514');

SELECT pg_temp.expect_error('duplicate character name within a universe rejected',
    $q$INSERT INTO characters (universe_id, name) SELECT universe_id, 'Jon Snow' FROM universes WHERE name='Game of Thrones'$q$,
    '23505');

INSERT INTO characters (universe_id, name)
SELECT universe_id, 'Jon Snow' FROM universes WHERE name = 'Naruto';
SELECT pg_temp.check('same character name allowed in a different universe',
    (SELECT COUNT(*) FROM characters WHERE name = 'Jon Snow') = 2);

SELECT pg_temp.expect_error('foreign key: unknown universe rejected',
    $q$INSERT INTO titles (universe_id, name, media_type) VALUES (999999, 'Ghost', 'movie')$q$, '23503');

SELECT pg_temp.expect_error('RESTRICT: universe with titles cannot be deleted',
    $q$DELETE FROM universes WHERE name = 'The Matrix'$q$, '23001');

SELECT pg_temp.expect_error('invalid media type rejected',
    $q$INSERT INTO titles (name, media_type) VALUES ('Bad', 'podcast')$q$, '23514');

SELECT pg_temp.expect_error('event order must be unique within a title',
    $q$INSERT INTO story_events (title_id, event_name, chronology_order, release_order)
       SELECT title_id, 'Duplicate order', 1, 99 FROM titles WHERE name='Game of Thrones'$q$, '23505');

SELECT pg_temp.expect_error('email must be lower case',
    $q$INSERT INTO users (username, email, password_hash) VALUES ('casey', 'Casey@Example.com', 'x')$q$, '23514');

-- ---------------- 4. Triggers ----------------
SELECT pg_temp.expect_error('trigger: character from another universe cannot appear in a title',
    $q$INSERT INTO character_appearances (character_id, title_id, character_role)
       SELECT c.character_id, t.title_id, 'cameo' FROM characters c, titles t
       WHERE c.name='Neo' AND t.name='Naruto'$q$, '23514');

SELECT pg_temp.expect_error('trigger: participant must appear in the event title',
    $q$INSERT INTO event_participants (event_id, character_id, participation_type)
       SELECT e.event_id, c.character_id, 'witness' FROM story_events e, characters c
       WHERE e.event_name='The Red Wedding' AND c.name='Rhaenyra Targaryen'$q$, '23514');

SELECT pg_temp.expect_error('trigger: arc event must belong to the arc title',
    $q$INSERT INTO arc_events (arc_id, event_id, sequence_number)
       SELECT a.arc_id, e.event_id, 9 FROM character_arcs a, story_events e
       WHERE a.arc_name='Becoming The One' AND e.event_name='The Red Wedding'$q$, '23514');

SELECT pg_temp.expect_error('trigger: cross-universe relationship rejected',
    $q$INSERT INTO character_relationships (source_character_id, target_character_id, relationship_type_id)
       SELECT a.character_id, b.character_id, 1 FROM characters a, characters b
       WHERE a.name='Neo' AND b.name='Naruto Uzumaki'$q$, '23514');

-- updated_at trigger
CREATE TEMP TABLE before_ts AS
    SELECT review_id, updated_at FROM reviews ORDER BY review_id LIMIT 1;
UPDATE reviews SET review_text = 'validation edit'
WHERE review_id = (SELECT review_id FROM before_ts);
SELECT pg_temp.check('trigger: updated_at refreshed on UPDATE',
    (SELECT r.updated_at > b.updated_at FROM reviews r JOIN before_ts b USING (review_id)));

-- audit trigger with acting user
SELECT set_config('cinemind.current_user_id', (SELECT user_id::TEXT FROM users WHERE username='admin'), true);
UPDATE titles SET status = 'completed' WHERE name = 'House of the Dragon';
SELECT pg_temp.check('trigger: audit row written with acting user and old/new data', EXISTS (
    SELECT 1 FROM audit_logs a JOIN users u ON u.user_id = a.user_id
    WHERE a.entity_type = 'titles' AND a.action = 'UPDATE' AND u.username = 'admin'
      AND a.old_data ->> 'status' = 'ongoing' AND a.new_data ->> 'status' = 'completed'));

SELECT pg_temp.check('trigger: password_hash never copied into audit_logs',
    NOT EXISTS (SELECT 1 FROM audit_logs WHERE old_data ? 'password_hash' OR new_data ? 'password_hash'));

SELECT pg_temp.expect_error('trigger: admin cannot self-assign Admin',
    $q$INSERT INTO user_roles (user_id, role_id)
       SELECT (SELECT user_id FROM users WHERE username='admin'), role_id FROM roles WHERE role_name='Admin'
       ON CONFLICT DO NOTHING$q$, '42501');
SELECT set_config('cinemind.current_user_id', '', true);

-- ---------------- 5. Functions ----------------
SELECT pg_temp.check('fn_title_average_rating(FMA:B) = 5.00',
    fn_title_average_rating((SELECT title_id FROM titles WHERE name='Fullmetal Alchemist: Brotherhood')) = 5.00);
SELECT pg_temp.check('fn_title_average_rating returns NULL without reviews',
    fn_title_average_rating((SELECT title_id FROM titles WHERE name='Fullmetal Alchemist')) IS NULL);
SELECT pg_temp.check('fn_character_appearance_count(Neo) = 3',
    fn_character_appearance_count((SELECT character_id FROM characters WHERE name='Neo')) = 3);
SELECT pg_temp.check('fn_character_event_count(Eddard Stark) = 3',
    fn_character_event_count((SELECT character_id FROM characters WHERE name='Eddard Stark')) = 3);
SELECT pg_temp.check('fn_user_has_permission: admin can manage content, alice cannot',
    fn_user_has_permission((SELECT user_id FROM users WHERE username='admin'), 'content.manage')
    AND NOT fn_user_has_permission((SELECT user_id FROM users WHERE username='alice'), 'content.manage'));

-- ---------------- 6. Procedures ----------------
-- CALL arguments cannot be subqueries, so ids are looked up into psql variables.
SELECT title_id AS naruto_title_id FROM titles WHERE name = 'Naruto' \gset
SELECT array_agg(character_id ORDER BY name)::TEXT AS naruto_kakashi
FROM characters WHERE name IN ('Naruto Uzumaki', 'Kakashi Hatake') \gset
SELECT character_id AS neo_id FROM characters WHERE name = 'Neo' \gset
SELECT user_id AS admin_id FROM users WHERE username = 'admin' \gset
SELECT user_id AS alice_id FROM users WHERE username = 'alice' \gset
SELECT user_id AS bob_id   FROM users WHERE username = 'bob' \gset

CALL add_story_event(:naruto_title_id, 'Validation event', NULL, 'none', NULL, NULL,
                     :'naruto_kakashi'::INTEGER[], ARRAY['supporting','central']::VARCHAR[], NULL);
SELECT pg_temp.check('procedure: event + 2 participants inserted, appended at order 3',
    (SELECT participant_count = 2 AND chronology_order = 3 AND release_order = 3
     FROM v_event_details WHERE event_name = 'Validation event'));

SELECT pg_temp.expect_error('procedure: invalid participant aborts the whole CALL',
    format($q$CALL add_story_event(%s, 'Atomic failure', NULL, 'none', NULL, NULL,
                                   ARRAY[%s], ARRAY['central']::VARCHAR[], NULL)$q$,
           :naruto_title_id, :neo_id),
    '23514');
SELECT pg_temp.check('procedure: failed CALL left no event behind',
    NOT EXISTS (SELECT 1 FROM story_events WHERE event_name = 'Atomic failure'));

CALL assign_user_role(:admin_id, :bob_id, 'Admin');
SELECT pg_temp.check('procedure: admin assigns Admin to bob',
    fn_user_has_permission(:bob_id, 'users.manage'));

SELECT pg_temp.expect_error('procedure: viewer cannot assign roles',
    format('CALL assign_user_role(%s, %s, %L)', :alice_id, :alice_id, 'Admin'), '42501');

-- ---------------- 7. Views return data ----------------
SELECT pg_temp.check('v_title_catalogue has every title',
    (SELECT COUNT(*) FROM v_title_catalogue) = (SELECT COUNT(*) FROM titles));
SELECT pg_temp.check('v_character_details returns rows', EXISTS (SELECT 1 FROM v_character_details));
SELECT pg_temp.check('v_event_details returns rows',      EXISTS (SELECT 1 FROM v_event_details));
SELECT pg_temp.check('v_character_timeline returns rows', EXISTS (SELECT 1 FROM v_character_timeline));
SELECT pg_temp.check('v_character_arc_progress returns rows', EXISTS (SELECT 1 FROM v_character_arc_progress));
SELECT pg_temp.check('v_title_ratings returns rows',      EXISTS (SELECT 1 FROM v_title_ratings));

-- ---------------- 8. Authorization ----------------
SELECT pg_temp.check('cinemind_app exists, can log in, is not superuser',
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cinemind_app' AND rolcanlogin AND NOT rolsuper
            AND NOT rolcreaterole AND NOT rolcreatedb));
SELECT pg_temp.check('cinemind_app can read/write reviews',
    has_table_privilege('cinemind_app', 'reviews', 'SELECT,INSERT,UPDATE,DELETE'));
SELECT pg_temp.check('cinemind_app cannot UPDATE or DELETE audit_logs',
    NOT has_table_privilege('cinemind_app', 'audit_logs', 'UPDATE')
    AND NOT has_table_privilege('cinemind_app', 'audit_logs', 'DELETE'));
SELECT pg_temp.check('cinemind_app cannot change roles table',
    NOT has_table_privilege('cinemind_app', 'roles', 'INSERT'));
SELECT pg_temp.check('cinemind_readonly cannot read password_hash',
    NOT has_column_privilege('cinemind_readonly', 'users', 'password_hash', 'SELECT'));

ROLLBACK;

\echo 'ALL VALIDATION CHECKS PASSED'
