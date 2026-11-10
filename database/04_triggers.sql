-- =============================================================================
-- CineMind 2.0 — 04_triggers.sql
-- Trigger functions and triggers:
--   1. updated_at maintenance (reviews, watch_progress)
--   2. generic audit logging into audit_logs
--   3. cross-table story integrity (same universe / same title rules)
--   4. no self-assignment of the Admin role
-- Re-runnable: CREATE OR REPLACE FUNCTION + CREATE OR REPLACE TRIGGER (PG14+).
-- Run:  psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/04_triggers.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Keep updated_at current on every UPDATE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER reviews_set_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE OR REPLACE TRIGGER watch_progress_set_updated_at
    BEFORE UPDATE ON watch_progress
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Generic audit trigger.
--    Trigger arguments (TG_ARGV) are the primary-key column names, so one
--    function serves tables with single or composite keys.
--    password_hash is never copied into the audit log.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_old JSONB;
    v_new JSONB;
    v_row JSONB;
    v_id  TEXT := '';
    i     INTEGER;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD) - 'password_hash'; END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW) - 'password_hash'; END IF;

    -- Skip UPDATEs that changed nothing.
    IF TG_OP = 'UPDATE' AND v_old = v_new THEN
        RETURN NEW;
    END IF;

    v_row := COALESCE(v_new, v_old);
    FOR i IN 0 .. TG_NARGS - 1 LOOP
        v_id := v_id || CASE WHEN i > 0 THEN ':' ELSE '' END || (v_row ->> TG_ARGV[i]);
    END LOOP;

    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (fn_current_app_user(), TG_OP, TG_TABLE_NAME, v_id, v_old, v_new);

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION trg_audit_row_change('user_id');

CREATE OR REPLACE TRIGGER audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION trg_audit_row_change('user_id', 'role_id');

CREATE OR REPLACE TRIGGER audit_universes
    AFTER INSERT OR UPDATE OR DELETE ON universes
    FOR EACH ROW EXECUTE FUNCTION trg_audit_row_change('universe_id');

CREATE OR REPLACE TRIGGER audit_titles
    AFTER INSERT OR UPDATE OR DELETE ON titles
    FOR EACH ROW EXECUTE FUNCTION trg_audit_row_change('title_id');

CREATE OR REPLACE TRIGGER audit_genres
    AFTER INSERT OR UPDATE OR DELETE ON genres
    FOR EACH ROW EXECUTE FUNCTION trg_audit_row_change('genre_id');

CREATE OR REPLACE TRIGGER audit_characters
    AFTER INSERT OR UPDATE OR DELETE ON characters
    FOR EACH ROW EXECUTE FUNCTION trg_audit_row_change('character_id');

CREATE OR REPLACE TRIGGER audit_character_relationships
    AFTER INSERT OR UPDATE OR DELETE ON character_relationships
    FOR EACH ROW EXECUTE FUNCTION trg_audit_row_change('relationship_id');

CREATE OR REPLACE TRIGGER audit_story_events
    AFTER INSERT OR UPDATE OR DELETE ON story_events
    FOR EACH ROW EXECUTE FUNCTION trg_audit_row_change('event_id');

CREATE OR REPLACE TRIGGER audit_reviews
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_audit_row_change('review_id');

-- -----------------------------------------------------------------------------
-- 3. Cross-table story integrity.
--    These rules span several tables, so CHECK constraints cannot express them.
--    (Composite FKs could, but would need a redundant title_id/universe_id
--    column in each link table — a partial dependency that breaks 2NF.)
--
--    character_appearances / character_relationships:
--        both characters (or character and title) belong to the same universe.
--    event_participants / character_arcs:
--        the character must appear in the event's / arc's title.
--    arc_events:
--        the event must belong to the same title as the arc.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_validate_story_links()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_title_id INTEGER;
BEGIN
    -- Each check only fires when the referenced rows exist; a missing row is
    -- left for the foreign key to report (BEFORE triggers run before FK checks).
    IF TG_TABLE_NAME = 'character_appearances' THEN
        IF EXISTS (
            SELECT 1 FROM characters c, titles t
            WHERE c.character_id = NEW.character_id
              AND t.title_id = NEW.title_id
              AND c.universe_id IS DISTINCT FROM t.universe_id
        ) THEN
            RAISE EXCEPTION 'Character % and title % belong to different universes',
                NEW.character_id, NEW.title_id
                USING ERRCODE = 'check_violation';
        END IF;

    ELSIF TG_TABLE_NAME = 'character_relationships' THEN
        IF EXISTS (
            SELECT 1 FROM characters a, characters b
            WHERE a.character_id = NEW.source_character_id
              AND b.character_id = NEW.target_character_id
              AND a.universe_id IS DISTINCT FROM b.universe_id
        ) THEN
            RAISE EXCEPTION 'Characters % and % belong to different universes',
                NEW.source_character_id, NEW.target_character_id
                USING ERRCODE = 'check_violation';
        END IF;

    ELSIF TG_TABLE_NAME IN ('event_participants', 'character_arcs') THEN
        IF TG_TABLE_NAME = 'event_participants' THEN
            SELECT title_id INTO v_title_id FROM story_events WHERE event_id = NEW.event_id;
        ELSE
            v_title_id := NEW.title_id;
        END IF;

        IF v_title_id IS NOT NULL
           AND EXISTS (SELECT 1 FROM characters WHERE character_id = NEW.character_id)
           AND NOT EXISTS (
               SELECT 1 FROM character_appearances
               WHERE character_id = NEW.character_id AND title_id = v_title_id
           ) THEN
            RAISE EXCEPTION 'Character % does not appear in title %', NEW.character_id, v_title_id
                USING ERRCODE = 'check_violation';
        END IF;

    ELSIF TG_TABLE_NAME = 'arc_events' THEN
        IF EXISTS (
            SELECT 1 FROM character_arcs a, story_events e
            WHERE a.arc_id = NEW.arc_id
              AND e.event_id = NEW.event_id
              AND a.title_id <> e.title_id
        ) THEN
            RAISE EXCEPTION 'Event % does not belong to the title of arc %', NEW.event_id, NEW.arc_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER validate_character_appearances
    BEFORE INSERT OR UPDATE ON character_appearances
    FOR EACH ROW EXECUTE FUNCTION trg_validate_story_links();

CREATE OR REPLACE TRIGGER validate_character_relationships
    BEFORE INSERT OR UPDATE ON character_relationships
    FOR EACH ROW EXECUTE FUNCTION trg_validate_story_links();

CREATE OR REPLACE TRIGGER validate_event_participants
    BEFORE INSERT OR UPDATE ON event_participants
    FOR EACH ROW EXECUTE FUNCTION trg_validate_story_links();

CREATE OR REPLACE TRIGGER validate_character_arcs
    BEFORE INSERT OR UPDATE ON character_arcs
    FOR EACH ROW EXECUTE FUNCTION trg_validate_story_links();

CREATE OR REPLACE TRIGGER validate_arc_events
    BEFORE INSERT OR UPDATE ON arc_events
    FOR EACH ROW EXECUTE FUNCTION trg_validate_story_links();

-- -----------------------------------------------------------------------------
-- 4. Defence in depth: a user can never grant the Admin role to themselves.
--    The API also checks this; the trigger protects against any other path.
--    The acting user is read from the transaction setting written by the API.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_prevent_admin_self_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.user_id = fn_current_app_user()
       AND EXISTS (SELECT 1 FROM roles WHERE role_id = NEW.role_id AND role_name = 'Admin') THEN
        RAISE EXCEPTION 'Users cannot assign the Admin role to themselves'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER user_roles_no_admin_self_assignment
    BEFORE INSERT OR UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION trg_prevent_admin_self_assignment();
