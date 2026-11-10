-- =============================================================================
-- CineMind 2.0 — 06_views.sql
-- Views that package frequent multi-table queries.
-- Re-runnable: DROP VIEW IF EXISTS + CREATE (CREATE OR REPLACE VIEW cannot
-- change column lists, so dropping keeps the script safe after edits).
-- Run:  psql -U postgres -h localhost -p 5432 -d cinemind_db -f database/06_views.sql
-- =============================================================================

DROP VIEW IF EXISTS v_title_catalogue, v_character_details, v_event_details,
                    v_character_timeline, v_character_arc_progress, v_title_ratings;

-- One row per title with its universe, genres and rating summary.
CREATE VIEW v_title_catalogue AS
SELECT t.title_id,
       t.name                                   AS title_name,
       t.media_type,
       t.status,
       t.release_date,
       t.synopsis,
       t.poster_url,
       t.universe_id,
       u.name                                   AS universe_name,
       COALESCE(g.genres, '{}')                 AS genres,
       r.average_rating,
       COALESCE(r.review_count, 0)              AS review_count,
       (SELECT COUNT(*) FROM character_appearances ca
         WHERE ca.title_id = t.title_id)::INT   AS character_count
FROM titles t
LEFT JOIN universes u ON u.universe_id = t.universe_id
LEFT JOIN LATERAL (
    SELECT array_agg(gn.name ORDER BY gn.name) AS genres
    FROM title_genres tg JOIN genres gn ON gn.genre_id = tg.genre_id
    WHERE tg.title_id = t.title_id
) g ON TRUE
LEFT JOIN LATERAL (
    SELECT ROUND(AVG(rv.rating), 2) AS average_rating, COUNT(*)::INT AS review_count
    FROM reviews rv WHERE rv.title_id = t.title_id
) r ON TRUE;

-- One row per character with universe and activity counts.
CREATE VIEW v_character_details AS
SELECT c.character_id,
       c.name                                    AS character_name,
       c.universe_id,
       u.name                                    AS universe_name,
       c.gender,
       c.species,
       c.biography,
       c.image_url,
       c.first_appearance_date,
       fn_character_appearance_count(c.character_id) AS appearance_count,
       fn_character_event_count(c.character_id)      AS event_count,
       (SELECT COUNT(*) FROM character_relationships cr
         WHERE cr.source_character_id = c.character_id)::INT AS outgoing_relationships,
       (SELECT COUNT(*) FROM character_relationships cr
         WHERE cr.target_character_id = c.character_id)::INT AS incoming_relationships
FROM characters c
LEFT JOIN universes u ON u.universe_id = c.universe_id;

-- One row per story event with its title, universe and participants.
CREATE VIEW v_event_details AS
SELECT e.event_id,
       e.event_name,
       e.description,
       e.chronology_order,
       e.release_order,
       e.spoiler_level,
       t.title_id,
       t.name            AS title_name,
       u.name            AS universe_name,
       COUNT(ep.character_id)::INT AS participant_count,
       COALESCE(array_agg(c.name ORDER BY c.name) FILTER (WHERE c.name IS NOT NULL), '{}')
                         AS participant_names
FROM story_events e
JOIN titles t                    ON t.title_id = e.title_id
LEFT JOIN universes u            ON u.universe_id = t.universe_id
LEFT JOIN event_participants ep  ON ep.event_id = e.event_id
LEFT JOIN characters c           ON c.character_id = ep.character_id
GROUP BY e.event_id, t.title_id, u.name;

-- One row per (character, event) participation, with both orderings.
CREATE VIEW v_character_timeline AS
SELECT c.character_id,
       c.name               AS character_name,
       t.title_id,
       t.name               AS title_name,
       t.release_date       AS title_release_date,
       e.event_id,
       e.event_name,
       e.chronology_order,
       e.release_order,
       e.spoiler_level,
       ep.participation_type,
       ep.involvement_description,
       ep.outcome
FROM event_participants ep
JOIN characters c   ON c.character_id = ep.character_id
JOIN story_events e ON e.event_id = ep.event_id
JOIN titles t       ON t.title_id = e.title_id;

-- One row per step of each character arc, with progress position.
CREATE VIEW v_character_arc_progress AS
SELECT a.arc_id,
       a.arc_name,
       a.arc_status,
       a.starting_state,
       a.ending_state,
       c.character_id,
       c.name               AS character_name,
       t.title_id,
       t.name               AS title_name,
       ae.sequence_number,
       COUNT(*) OVER (PARTITION BY a.arc_id)::INT AS total_steps,
       e.event_id,
       e.event_name,
       e.chronology_order,
       ae.development_note
FROM character_arcs a
JOIN characters c   ON c.character_id = a.character_id
JOIN titles t       ON t.title_id = a.title_id
JOIN arc_events ae  ON ae.arc_id = a.arc_id
JOIN story_events e ON e.event_id = ae.event_id;

-- Rating statistics per title (titles without reviews included).
CREATE VIEW v_title_ratings AS
SELECT t.title_id,
       t.name                                         AS title_name,
       COUNT(r.review_id)::INT                        AS review_count,
       ROUND(AVG(r.rating), 2)                        AS average_rating,
       MAX(r.rating)                                  AS highest_rating,
       MIN(r.rating)                                  AS lowest_rating,
       COUNT(*) FILTER (WHERE r.rating >= 4)::INT     AS positive_reviews
FROM titles t
LEFT JOIN reviews r ON r.title_id = t.title_id
GROUP BY t.title_id, t.name;
