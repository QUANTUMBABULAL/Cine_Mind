-- =============================================================================
-- CineMind 2.0 — 01_schema.sql
-- Creates all 21 tables with primary keys, foreign keys and NOT NULL rules.
-- Additional CHECK / UNIQUE constraints and indexes are added in
-- 02_constraints_indexes.sql (demonstrating ALTER TABLE).
--
-- Re-runnable: every statement uses IF NOT EXISTS.
-- Run:  psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/01_schema.sql
-- =============================================================================

-- Hide the harmless "does not exist, skipping" notices of the re-runnable statements.
SET client_min_messages = warning;

-- pgcrypto provides crypt()/gen_salt() used to create bcrypt hashes for seed users.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- A. Authentication and authorization
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    user_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT         NOT NULL,
    account_status  VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
    role_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name    VARCHAR(30) NOT NULL UNIQUE,
    description  TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
    permission_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    permission_code  VARCHAR(50) NOT NULL UNIQUE,
    description      TEXT
);

-- M:N users <-> roles. Composite PK prevents assigning the same role twice.
CREATE TABLE IF NOT EXISTS user_roles (
    user_id      INTEGER     NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    role_id      INTEGER     NOT NULL REFERENCES roles (role_id) ON DELETE RESTRICT,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

-- M:N roles <-> permissions.
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id        INTEGER NOT NULL REFERENCES roles (role_id) ON DELETE CASCADE,
    permission_id  INTEGER NOT NULL REFERENCES permissions (permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Polymorphic audit trail: entity_type names the table and entity_id holds the
-- row's key as text (composite keys are written as "a:b"). A normal FK is not
-- possible because one column would have to reference many tables, and audit
-- rows must survive deletion of the audited row.
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER REFERENCES users (user_id) ON DELETE SET NULL,  -- NULL = system / seed
    action       VARCHAR(10) NOT NULL,
    entity_type  VARCHAR(50) NOT NULL,
    entity_id    TEXT        NOT NULL,
    old_data     JSONB,
    new_data     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- B. Universes and titles
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS universes (
    universe_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             VARCHAR(150) NOT NULL UNIQUE,
    description      TEXT,
    origin_type      VARCHAR(20)  NOT NULL,
    cover_image_url  TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 1:N universe -> titles. universe_id is NULLABLE for standalone titles.
-- RESTRICT: a universe that still has titles cannot be deleted.
CREATE TABLE IF NOT EXISTS titles (
    title_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    universe_id   INTEGER REFERENCES universes (universe_id) ON DELETE RESTRICT,
    name          VARCHAR(200) NOT NULL,
    media_type    VARCHAR(20)  NOT NULL,
    synopsis      TEXT,
    release_date  DATE,
    status        VARCHAR(20)  NOT NULL DEFAULT 'released',
    poster_url    TEXT,
    banner_url    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS genres (
    genre_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(50) NOT NULL UNIQUE,
    description  TEXT
);

-- M:N titles <-> genres.
CREATE TABLE IF NOT EXISTS title_genres (
    title_id  INTEGER NOT NULL REFERENCES titles (title_id) ON DELETE CASCADE,
    genre_id  INTEGER NOT NULL REFERENCES genres (genre_id) ON DELETE CASCADE,
    PRIMARY KEY (title_id, genre_id)
);

-- -----------------------------------------------------------------------------
-- C. Characters
-- -----------------------------------------------------------------------------

-- universe_id is NULLABLE so characters of standalone titles (e.g. Inception)
-- can exist. Name uniqueness within a universe is added in 02.
CREATE TABLE IF NOT EXISTS characters (
    character_id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    universe_id            INTEGER REFERENCES universes (universe_id) ON DELETE RESTRICT,
    name                   VARCHAR(150) NOT NULL,
    biography              TEXT,
    gender                 VARCHAR(30),
    species                VARCHAR(60),
    image_url              TEXT,
    first_appearance_date  DATE,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- M:N characters <-> titles.
CREATE TABLE IF NOT EXISTS character_appearances (
    character_id      INTEGER     NOT NULL REFERENCES characters (character_id) ON DELETE CASCADE,
    title_id          INTEGER     NOT NULL REFERENCES titles (title_id) ON DELETE CASCADE,
    character_role    VARCHAR(20) NOT NULL,
    appearance_notes  TEXT,
    PRIMARY KEY (character_id, title_id)
);

CREATE TABLE IF NOT EXISTS relationship_types (
    relationship_type_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                  VARCHAR(50) NOT NULL UNIQUE,
    description           TEXT
);

-- DIRECTED relationship: source --(type)--> target. A -> B does not imply B -> A.
-- Two FKs to the same table (characters) — a recursive M:N relationship.
CREATE TABLE IF NOT EXISTS character_relationships (
    relationship_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_character_id   INTEGER NOT NULL REFERENCES characters (character_id) ON DELETE CASCADE,
    target_character_id   INTEGER NOT NULL REFERENCES characters (character_id) ON DELETE CASCADE,
    relationship_type_id  INTEGER NOT NULL REFERENCES relationship_types (relationship_type_id) ON DELETE RESTRICT,
    description           TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- D. Story events and character arcs
-- -----------------------------------------------------------------------------

-- Each event belongs to exactly one title (1:N). chronology_order is the
-- in-universe order; release_order is the order the audience sees it.
CREATE TABLE IF NOT EXISTS story_events (
    event_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title_id          INTEGER      NOT NULL REFERENCES titles (title_id) ON DELETE CASCADE,
    event_name        VARCHAR(200) NOT NULL,
    description       TEXT,
    chronology_order  INTEGER      NOT NULL,
    release_order     INTEGER      NOT NULL,
    spoiler_level     VARCHAR(10)  NOT NULL DEFAULT 'none',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- M:N story_events <-> characters (with relationship attributes).
CREATE TABLE IF NOT EXISTS event_participants (
    event_id                 INTEGER     NOT NULL REFERENCES story_events (event_id) ON DELETE CASCADE,
    character_id             INTEGER     NOT NULL REFERENCES characters (character_id) ON DELETE CASCADE,
    participation_type       VARCHAR(20) NOT NULL,
    involvement_description  TEXT,
    outcome                  VARCHAR(20),
    PRIMARY KEY (event_id, character_id)
);

-- A character may have MULTIPLE arcs in the same title, so (character_id,
-- title_id) is intentionally not unique; arc_name distinguishes them (see 02).
CREATE TABLE IF NOT EXISTS character_arcs (
    arc_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    character_id    INTEGER      NOT NULL REFERENCES characters (character_id) ON DELETE CASCADE,
    title_id        INTEGER      NOT NULL REFERENCES titles (title_id) ON DELETE CASCADE,
    arc_name        VARCHAR(150) NOT NULL,
    description     TEXT,
    starting_state  TEXT,
    ending_state    TEXT,
    arc_status      VARCHAR(20)  NOT NULL DEFAULT 'ongoing',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- M:N character_arcs <-> story_events, ordered by sequence_number.
CREATE TABLE IF NOT EXISTS arc_events (
    arc_id            INTEGER NOT NULL REFERENCES character_arcs (arc_id) ON DELETE CASCADE,
    event_id          INTEGER NOT NULL REFERENCES story_events (event_id) ON DELETE CASCADE,
    sequence_number   INTEGER NOT NULL,
    development_note  TEXT,
    PRIMARY KEY (arc_id, event_id)
);

-- -----------------------------------------------------------------------------
-- E. User activity
-- -----------------------------------------------------------------------------

-- Exactly one of title_id / character_id is set (CHECK added in 02).
CREATE TABLE IF NOT EXISTS bookmarks (
    bookmark_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       INTEGER     NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    title_id      INTEGER     REFERENCES titles (title_id) ON DELETE CASCADE,
    character_id  INTEGER     REFERENCES characters (character_id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
    review_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INTEGER     NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    title_id     INTEGER     NOT NULL REFERENCES titles (title_id) ON DELETE CASCADE,
    rating       SMALLINT    NOT NULL,
    review_text  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watch_progress (
    progress_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              INTEGER      NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    title_id             INTEGER      NOT NULL REFERENCES titles (title_id) ON DELETE CASCADE,
    progress_status      VARCHAR(20)  NOT NULL DEFAULT 'planned',
    progress_percentage  NUMERIC(5,2) NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
