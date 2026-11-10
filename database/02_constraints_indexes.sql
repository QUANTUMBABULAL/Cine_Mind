-- =============================================================================
-- CineMind 2.0 — 02_constraints_indexes.sql
-- Adds CHECK and UNIQUE constraints with ALTER TABLE, then creates indexes.
--
-- Re-runnable: each constraint is dropped (IF EXISTS) and re-added, and
-- indexes use IF NOT EXISTS.
-- Run:  psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/02_constraints_indexes.sql
-- =============================================================================

-- Hide the harmless "does not exist, skipping" notices of the re-runnable statements.
SET client_min_messages = warning;

-- ---------------- users ----------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_status;
ALTER TABLE users ADD  CONSTRAINT chk_users_status
    CHECK (account_status IN ('active', 'suspended'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_username;
ALTER TABLE users ADD  CONSTRAINT chk_users_username
    CHECK (username ~ '^[A-Za-z0-9_]{3,50}$');

-- Emails are stored in lower case so the UNIQUE constraint is case-insensitive.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_email;
ALTER TABLE users ADD  CONSTRAINT chk_users_email
    CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Usernames must also be unique ignoring case ("Alice" vs "alice").
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (lower(username));

-- ---------------- audit_logs ----------------
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS chk_audit_action;
ALTER TABLE audit_logs ADD  CONSTRAINT chk_audit_action
    CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'));

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time   ON audit_logs (created_at DESC);

-- ---------------- universes ----------------
ALTER TABLE universes DROP CONSTRAINT IF EXISTS chk_universes_origin;
ALTER TABLE universes ADD  CONSTRAINT chk_universes_origin
    CHECK (origin_type IN ('manga', 'novel', 'film', 'tv', 'comic', 'game', 'original'));

-- ---------------- titles ----------------
ALTER TABLE titles DROP CONSTRAINT IF EXISTS chk_titles_media_type;
ALTER TABLE titles ADD  CONSTRAINT chk_titles_media_type
    CHECK (media_type IN ('movie', 'anime_series', 'anime_movie', 'tv_series', 'web_series'));

ALTER TABLE titles DROP CONSTRAINT IF EXISTS chk_titles_status;
ALTER TABLE titles ADD  CONSTRAINT chk_titles_status
    CHECK (status IN ('upcoming', 'released', 'ongoing', 'completed'));

-- Two titles may share a name only if released on different dates (remakes).
-- NULLS NOT DISTINCT (PostgreSQL 15+) also blocks duplicates with no date.
ALTER TABLE titles DROP CONSTRAINT IF EXISTS uq_titles_name_release;
ALTER TABLE titles ADD  CONSTRAINT uq_titles_name_release
    UNIQUE NULLS NOT DISTINCT (name, release_date);

CREATE INDEX IF NOT EXISTS idx_titles_universe   ON titles (universe_id);
CREATE INDEX IF NOT EXISTS idx_titles_media_type ON titles (media_type);
CREATE INDEX IF NOT EXISTS idx_titles_name_lower ON titles (lower(name));

-- ---------------- title_genres ----------------
-- The PK (title_id, genre_id) already indexes title_id; add the reverse lookup.
CREATE INDEX IF NOT EXISTS idx_title_genres_genre ON title_genres (genre_id);

-- ---------------- characters ----------------
-- Character names are unique WITHIN a universe, not globally.
-- NULLS NOT DISTINCT: standalone characters (universe_id NULL) are also unique by name.
ALTER TABLE characters DROP CONSTRAINT IF EXISTS uq_characters_universe_name;
ALTER TABLE characters ADD  CONSTRAINT uq_characters_universe_name
    UNIQUE NULLS NOT DISTINCT (universe_id, name);

CREATE INDEX IF NOT EXISTS idx_characters_name_lower ON characters (lower(name));

-- ---------------- character_appearances ----------------
ALTER TABLE character_appearances DROP CONSTRAINT IF EXISTS chk_appearances_role;
ALTER TABLE character_appearances ADD  CONSTRAINT chk_appearances_role
    CHECK (character_role IN ('protagonist', 'antagonist', 'supporting', 'minor', 'cameo'));

CREATE INDEX IF NOT EXISTS idx_appearances_title ON character_appearances (title_id);

-- ---------------- character_relationships ----------------
ALTER TABLE character_relationships DROP CONSTRAINT IF EXISTS chk_relationships_not_self;
ALTER TABLE character_relationships ADD  CONSTRAINT chk_relationships_not_self
    CHECK (source_character_id <> target_character_id);

-- The same directed relationship of the same type cannot be recorded twice.
ALTER TABLE character_relationships DROP CONSTRAINT IF EXISTS uq_relationships_directed;
ALTER TABLE character_relationships ADD  CONSTRAINT uq_relationships_directed
    UNIQUE (source_character_id, target_character_id, relationship_type_id);

CREATE INDEX IF NOT EXISTS idx_relationships_target ON character_relationships (target_character_id);

-- ---------------- story_events ----------------
ALTER TABLE story_events DROP CONSTRAINT IF EXISTS chk_events_orders_positive;
ALTER TABLE story_events ADD  CONSTRAINT chk_events_orders_positive
    CHECK (chronology_order > 0 AND release_order > 0);

ALTER TABLE story_events DROP CONSTRAINT IF EXISTS chk_events_spoiler;
ALTER TABLE story_events ADD  CONSTRAINT chk_events_spoiler
    CHECK (spoiler_level IN ('none', 'minor', 'major'));

-- Both orderings are positions WITHIN a title, so each must be unique per title.
ALTER TABLE story_events DROP CONSTRAINT IF EXISTS uq_events_title_chronology;
ALTER TABLE story_events ADD  CONSTRAINT uq_events_title_chronology UNIQUE (title_id, chronology_order);

ALTER TABLE story_events DROP CONSTRAINT IF EXISTS uq_events_title_release;
ALTER TABLE story_events ADD  CONSTRAINT uq_events_title_release UNIQUE (title_id, release_order);

ALTER TABLE story_events DROP CONSTRAINT IF EXISTS uq_events_title_name;
ALTER TABLE story_events ADD  CONSTRAINT uq_events_title_name UNIQUE (title_id, event_name);

-- ---------------- event_participants ----------------
ALTER TABLE event_participants DROP CONSTRAINT IF EXISTS chk_participants_type;
ALTER TABLE event_participants ADD  CONSTRAINT chk_participants_type
    CHECK (participation_type IN ('central', 'supporting', 'victim', 'perpetrator', 'witness'));

ALTER TABLE event_participants DROP CONSTRAINT IF EXISTS chk_participants_outcome;
ALTER TABLE event_participants ADD  CONSTRAINT chk_participants_outcome
    CHECK (outcome IS NULL OR outcome IN ('survived', 'died', 'injured', 'victorious',
                                          'defeated', 'escaped', 'transformed'));

CREATE INDEX IF NOT EXISTS idx_participants_character ON event_participants (character_id);

-- ---------------- character_arcs ----------------
ALTER TABLE character_arcs DROP CONSTRAINT IF EXISTS chk_arcs_status;
ALTER TABLE character_arcs ADD  CONSTRAINT chk_arcs_status
    CHECK (arc_status IN ('ongoing', 'completed', 'abandoned'));

-- Multiple arcs per (character, title) are allowed, but each needs its own name.
ALTER TABLE character_arcs DROP CONSTRAINT IF EXISTS uq_arcs_character_title_name;
ALTER TABLE character_arcs ADD  CONSTRAINT uq_arcs_character_title_name
    UNIQUE (character_id, title_id, arc_name);

CREATE INDEX IF NOT EXISTS idx_arcs_title ON character_arcs (title_id);

-- ---------------- arc_events ----------------
ALTER TABLE arc_events DROP CONSTRAINT IF EXISTS chk_arc_events_sequence;
ALTER TABLE arc_events ADD  CONSTRAINT chk_arc_events_sequence CHECK (sequence_number > 0);

-- Each step of an arc has a distinct position.
ALTER TABLE arc_events DROP CONSTRAINT IF EXISTS uq_arc_events_sequence;
ALTER TABLE arc_events ADD  CONSTRAINT uq_arc_events_sequence UNIQUE (arc_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_arc_events_event ON arc_events (event_id);

-- ---------------- bookmarks ----------------
-- Exactly one target: a title OR a character (num_nonnulls counts non-NULL args).
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS chk_bookmarks_one_target;
ALTER TABLE bookmarks ADD  CONSTRAINT chk_bookmarks_one_target
    CHECK (num_nonnulls(title_id, character_id) = 1);

-- A user bookmarks a given title / character at most once. Rows whose target
-- column is NULL never conflict, because NULLs are distinct in UNIQUE.
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS uq_bookmarks_user_title;
ALTER TABLE bookmarks ADD  CONSTRAINT uq_bookmarks_user_title UNIQUE (user_id, title_id);

ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS uq_bookmarks_user_character;
ALTER TABLE bookmarks ADD  CONSTRAINT uq_bookmarks_user_character UNIQUE (user_id, character_id);

-- ---------------- reviews ----------------
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS chk_reviews_rating;
ALTER TABLE reviews ADD  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS chk_reviews_text_length;
ALTER TABLE reviews ADD  CONSTRAINT chk_reviews_text_length
    CHECK (review_text IS NULL OR char_length(review_text) <= 5000);

-- At most one review per user per title.
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS uq_reviews_user_title;
ALTER TABLE reviews ADD  CONSTRAINT uq_reviews_user_title UNIQUE (user_id, title_id);

CREATE INDEX IF NOT EXISTS idx_reviews_title ON reviews (title_id);

-- ---------------- watch_progress ----------------
ALTER TABLE watch_progress DROP CONSTRAINT IF EXISTS chk_progress_status;
ALTER TABLE watch_progress ADD  CONSTRAINT chk_progress_status
    CHECK (progress_status IN ('planned', 'watching', 'completed', 'dropped'));

ALTER TABLE watch_progress DROP CONSTRAINT IF EXISTS chk_progress_percentage;
ALTER TABLE watch_progress ADD  CONSTRAINT chk_progress_percentage
    CHECK (progress_percentage BETWEEN 0 AND 100);

-- A "completed" title must be at 100 %.
ALTER TABLE watch_progress DROP CONSTRAINT IF EXISTS chk_progress_completed_full;
ALTER TABLE watch_progress ADD  CONSTRAINT chk_progress_completed_full
    CHECK (progress_status <> 'completed' OR progress_percentage = 100);

ALTER TABLE watch_progress DROP CONSTRAINT IF EXISTS uq_progress_user_title;
ALTER TABLE watch_progress ADD  CONSTRAINT uq_progress_user_title UNIQUE (user_id, title_id);
