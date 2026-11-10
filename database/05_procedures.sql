-- =============================================================================
-- CineMind 2.0 — 05_procedures.sql
-- Stored procedures (CREATE PROCEDURE, invoked with CALL).
-- A CALL is atomic: if any statement inside raises an error, every change
-- made by the procedure is rolled back together with the calling statement.
-- Re-runnable: CREATE OR REPLACE.
-- Run:  psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/05_procedures.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- add_story_event: inserts a story event AND its participants atomically.
--   p_chronology_order / p_release_order: NULL = append after the last event.
--   p_character_ids and p_participation_types are parallel arrays.
--   p_event_id (INOUT) returns the new event's id.
-- Example:
--   CALL add_story_event(1, 'New event', 'Description', 'none', NULL, NULL,
--                        ARRAY[1,2], ARRAY['central','witness'], NULL);
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE add_story_event(
    p_title_id            INTEGER,
    p_event_name          VARCHAR,
    p_description         TEXT,
    p_spoiler_level       VARCHAR,
    p_chronology_order    INTEGER,
    p_release_order       INTEGER,
    p_character_ids       INTEGER[],
    p_participation_types VARCHAR[],
    INOUT p_event_id      INTEGER DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    i INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM titles WHERE title_id = p_title_id) THEN
        RAISE EXCEPTION 'Title % does not exist', p_title_id USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF COALESCE(array_length(p_character_ids, 1), 0)
       <> COALESCE(array_length(p_participation_types, 1), 0) THEN
        RAISE EXCEPTION 'p_character_ids and p_participation_types must have the same length'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    INSERT INTO story_events (title_id, event_name, description, spoiler_level,
                              chronology_order, release_order)
    VALUES (
        p_title_id, p_event_name, p_description, COALESCE(p_spoiler_level, 'none'),
        COALESCE(p_chronology_order,
                 (SELECT COALESCE(MAX(chronology_order), 0) + 1 FROM story_events WHERE title_id = p_title_id)),
        COALESCE(p_release_order,
                 (SELECT COALESCE(MAX(release_order), 0) + 1 FROM story_events WHERE title_id = p_title_id))
    )
    RETURNING event_id INTO p_event_id;

    -- Each participant row is validated by the event_participants trigger:
    -- the character must appear in this title, otherwise the whole CALL fails.
    FOR i IN 1 .. COALESCE(array_length(p_character_ids, 1), 0) LOOP
        INSERT INTO event_participants (event_id, character_id, participation_type)
        VALUES (p_event_id, p_character_ids[i], p_participation_types[i]);
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- assign_user_role: an administrator grants a role to another user.
--   Validates that the actor holds 'users.manage' and that nobody grants
--   Admin to themselves. The audit trigger on user_roles records the change.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE assign_user_role(
    p_actor_user_id  INTEGER,
    p_target_user_id INTEGER,
    p_role_name      VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_role_id INTEGER;
BEGIN
    IF NOT fn_user_has_permission(p_actor_user_id, 'users.manage') THEN
        RAISE EXCEPTION 'User % is not allowed to manage roles', p_actor_user_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT role_id INTO v_role_id FROM roles WHERE role_name = p_role_name;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % does not exist', p_role_name USING ERRCODE = 'no_data_found';
    END IF;

    IF p_role_name = 'Admin' AND p_actor_user_id = p_target_user_id THEN
        RAISE EXCEPTION 'Users cannot assign the Admin role to themselves'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_target_user_id) THEN
        RAISE EXCEPTION 'User % does not exist', p_target_user_id USING ERRCODE = 'no_data_found';
    END IF;

    INSERT INTO user_roles (user_id, role_id)
    VALUES (p_target_user_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
END;
$$;
