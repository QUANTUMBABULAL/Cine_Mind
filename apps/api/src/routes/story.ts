import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db/pool.js";
import { idParam, notFound, parse, positiveId } from "../utils/http.js";

// Characters, relationships, story events, timelines and arcs (all public).
export const storyRouter = Router();

const orderQuery = z.object({ order: z.enum(["chronology", "release"]).default("chronology") });

async function requireCharacter(id: number) {
  const character = await queryOne("SELECT * FROM v_character_details WHERE character_id = $1", [id]);
  if (!character) throw notFound("Character");
  return character;
}

function relationshipsOf(characterId: number) {
  // Directed: "outgoing" = this character is the source; "incoming" = the target.
  return query(
    `SELECT cr.relationship_id,
            CASE WHEN cr.source_character_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
            rt.name AS relationship_type, cr.description,
            s.character_id AS source_id, s.name AS source_name,
            t.character_id AS target_id, t.name AS target_name
     FROM character_relationships cr
     JOIN relationship_types rt ON rt.relationship_type_id = cr.relationship_type_id
     JOIN characters s ON s.character_id = cr.source_character_id
     JOIN characters t ON t.character_id = cr.target_character_id
     WHERE $1 IN (cr.source_character_id, cr.target_character_id)
     ORDER BY direction DESC, rt.name, s.name, t.name`,
    [characterId],
  );
}

function appearancesOf(characterId: number) {
  return query(
    `SELECT t.title_id, t.name AS title_name, t.media_type, t.release_date, t.poster_url,
            ca.character_role, ca.appearance_notes
     FROM character_appearances ca JOIN titles t ON t.title_id = ca.title_id
     WHERE ca.character_id = $1
     ORDER BY t.release_date NULLS LAST`,
    [characterId],
  );
}

/** Arcs with their ordered steps as a JSON array (one row per arc). */
function arcsWhere(column: "a.character_id" | "a.title_id", id: number) {
  return query(
    `SELECT a.arc_id, a.arc_name, a.description, a.starting_state, a.ending_state, a.arc_status,
            c.character_id, c.name AS character_name, t.title_id, t.name AS title_name,
            COALESCE(json_agg(json_build_object(
                'sequence_number', ae.sequence_number,
                'event_id', e.event_id,
                'event_name', e.event_name,
                'development_note', ae.development_note)
              ORDER BY ae.sequence_number) FILTER (WHERE e.event_id IS NOT NULL), '[]') AS steps
     FROM character_arcs a
     JOIN characters c ON c.character_id = a.character_id
     JOIN titles t     ON t.title_id = a.title_id
     LEFT JOIN arc_events ae  ON ae.arc_id = a.arc_id
     LEFT JOIN story_events e ON e.event_id = ae.event_id
     WHERE ${column} = $1
     GROUP BY a.arc_id, c.character_id, t.title_id
     ORDER BY t.release_date, c.name, a.arc_name`,
    [id],
  );
}

// GET /api/characters?q=&universe_id=
storyRouter.get("/characters", async (req, res) => {
  const f = parse(
    z.object({ q: z.string().trim().max(100).optional(), universe_id: positiveId.optional() }),
    req.query,
  );
  res.json(
    await query(
      `SELECT character_id, character_name, universe_id, universe_name, species, gender, image_url,
              appearance_count, event_count
       FROM v_character_details
       WHERE ($1::TEXT IS NULL OR character_name ILIKE '%' || $1 || '%')
         AND ($2::INT IS NULL OR universe_id = $2)
       ORDER BY universe_name NULLS LAST, character_name`,
      [f.q || null, f.universe_id ?? null],
    ),
  );
});

// GET /api/characters/:id — full profile.
storyRouter.get("/characters/:id", async (req, res) => {
  const id = idParam(req);
  const character = await requireCharacter(id);
  const [appearances, relationships, arcs] = await Promise.all([
    appearancesOf(id),
    relationshipsOf(id),
    arcsWhere("a.character_id", id),
  ]);
  res.json({ ...character, appearances, relationships, arcs });
});

storyRouter.get("/characters/:id/relationships", async (req, res) => {
  const id = idParam(req);
  await requireCharacter(id);
  res.json(await relationshipsOf(id));
});

storyRouter.get("/characters/:id/appearances", async (req, res) => {
  const id = idParam(req);
  await requireCharacter(id);
  res.json(await appearancesOf(id));
});

// GET /api/characters/:id/timeline?order=chronology|release
storyRouter.get("/characters/:id/timeline", async (req, res) => {
  const id = idParam(req);
  const { order } = parse(orderQuery, req.query);
  await requireCharacter(id);
  const orderColumn = order === "release" ? "release_order" : "chronology_order";
  res.json(
    await query(
      `SELECT * FROM v_character_timeline
       WHERE character_id = $1
       ORDER BY title_release_date NULLS LAST, title_id, ${orderColumn}`,
      [id],
    ),
  );
});

storyRouter.get("/characters/:id/arcs", async (req, res) => {
  const id = idParam(req);
  await requireCharacter(id);
  res.json(await arcsWhere("a.character_id", id));
});

// GET /api/titles/:id/events?order=chronology|release — events with participants.
storyRouter.get("/titles/:id/events", async (req, res) => {
  const id = idParam(req);
  const { order } = parse(orderQuery, req.query);
  if (!(await queryOne("SELECT 1 FROM titles WHERE title_id = $1", [id]))) throw notFound("Title");
  const orderColumn = order === "release" ? "e.release_order" : "e.chronology_order";
  res.json(
    await query(
      `SELECT e.event_id, e.event_name, e.description, e.chronology_order, e.release_order, e.spoiler_level,
              COALESCE(json_agg(json_build_object(
                  'character_id', c.character_id, 'name', c.name,
                  'participation_type', ep.participation_type, 'outcome', ep.outcome,
                  'involvement_description', ep.involvement_description)
                ORDER BY c.name) FILTER (WHERE c.character_id IS NOT NULL), '[]') AS participants
       FROM story_events e
       LEFT JOIN event_participants ep ON ep.event_id = e.event_id
       LEFT JOIN characters c          ON c.character_id = ep.character_id
       WHERE e.title_id = $1
       GROUP BY e.event_id
       ORDER BY ${orderColumn}`,
      [id],
    ),
  );
});

storyRouter.get("/titles/:id/arcs", async (req, res) => {
  const id = idParam(req);
  if (!(await queryOne("SELECT 1 FROM titles WHERE title_id = $1", [id]))) throw notFound("Title");
  res.json(await arcsWhere("a.title_id", id));
});

// GET /api/events/:id — event with its participants.
storyRouter.get("/events/:id", async (req, res) => {
  const id = idParam(req);
  const event = await queryOne("SELECT * FROM v_event_details WHERE event_id = $1", [id]);
  if (!event) throw notFound("Event");
  const participants = await participantsOf(id);
  res.json({ ...event, participants });
});

storyRouter.get("/events/:id/participants", async (req, res) => {
  const id = idParam(req);
  if (!(await queryOne("SELECT 1 FROM story_events WHERE event_id = $1", [id]))) throw notFound("Event");
  res.json(await participantsOf(id));
});

function participantsOf(eventId: number) {
  return query(
    `SELECT c.character_id, c.name, c.image_url, ep.participation_type, ep.involvement_description, ep.outcome
     FROM event_participants ep JOIN characters c ON c.character_id = ep.character_id
     WHERE ep.event_id = $1 ORDER BY ep.participation_type, c.name`,
    [eventId],
  );
}

// GET /api/relationship-types — used by the admin form.
storyRouter.get("/relationship-types", async (_req, res) => {
  res.json(await query("SELECT * FROM relationship_types ORDER BY name"));
});
