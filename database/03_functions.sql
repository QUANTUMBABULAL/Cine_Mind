-- =============================================================================
-- CineMind 2.0 — 03_functions.sql
-- Scalar and set-returning SQL functions used by views, the API and demos.
-- Re-runnable: CREATE OR REPLACE.
-- Run:  psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/03_functions.sql
-- =============================================================================

-- Average rating of a title rounded to 2 decimals; NULL when it has no reviews.
CREATE OR REPLACE FUNCTION fn_title_average_rating(p_title_id INTEGER)
RETURNS NUMERIC(3,2)
LANGUAGE sql STABLE
AS $$
    SELECT ROUND(AVG(rating), 2)::NUMERIC(3,2)
    FROM reviews
    WHERE title_id = p_title_id;
$$;

-- Number of titles a character appears in.
CREATE OR REPLACE FUNCTION fn_character_appearance_count(p_character_id INTEGER)
RETURNS INTEGER
LANGUAGE sql STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM character_appearances
    WHERE character_id = p_character_id;
$$;

-- Number of story events a character participated in.
CREATE OR REPLACE FUNCTION fn_character_event_count(p_character_id INTEGER)
RETURNS INTEGER
LANGUAGE sql STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM event_participants
    WHERE character_id = p_character_id;
$$;

-- TRUE if any of the user's roles grants the permission code.
-- Used by the API for authorization and by procedures for validation.
CREATE OR REPLACE FUNCTION fn_user_has_permission(p_user_id INTEGER, p_permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p       ON p.permission_id = rp.permission_id
        JOIN users u             ON u.user_id = ur.user_id
        WHERE ur.user_id = p_user_id
          AND p.permission_code = p_permission_code
          AND u.account_status = 'active'
    );
$$;

-- Set-returning function: a character's events in chronological or release order.
CREATE OR REPLACE FUNCTION fn_character_timeline(p_character_id INTEGER, p_order TEXT DEFAULT 'chronology')
RETURNS TABLE (
    title_name         VARCHAR,
    event_name         VARCHAR,
    chronology_order   INTEGER,
    release_order      INTEGER,
    participation_type VARCHAR,
    outcome            VARCHAR
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    IF p_order NOT IN ('chronology', 'release') THEN
        RAISE EXCEPTION 'p_order must be chronology or release, got %', p_order;
    END IF;

    RETURN QUERY
    SELECT t.name, e.event_name, e.chronology_order, e.release_order,
           ep.participation_type, ep.outcome
    FROM event_participants ep
    JOIN story_events e ON e.event_id = ep.event_id
    JOIN titles t       ON t.title_id = e.title_id
    WHERE ep.character_id = p_character_id
    ORDER BY t.release_date NULLS LAST, t.title_id,
             CASE WHEN p_order = 'chronology' THEN e.chronology_order ELSE e.release_order END;
END;
$$;

-- Reads the application user stored for the current transaction by the API
-- (SET LOCAL cinemind.current_user_id = '<id>'). NULL when not set (psql, seed).
CREATE OR REPLACE FUNCTION fn_current_app_user()
RETURNS INTEGER
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(current_setting('cinemind.current_user_id', true), '')::INTEGER;
$$;
