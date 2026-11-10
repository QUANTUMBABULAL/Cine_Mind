import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db/pool.js";
import { idParam, notFound, parse, positiveId } from "../utils/http.js";

export const catalogueRouter = Router();

const MEDIA_TYPES = ["movie", "anime_series", "anime_movie", "tv_series", "web_series"] as const;

// GET /api/universes — every universe with title and character counts.
catalogueRouter.get("/universes", async (_req, res) => {
  const rows = await query(
    `SELECT u.universe_id, u.name, u.description, u.origin_type, u.cover_image_url,
            (SELECT COUNT(*) FROM titles t     WHERE t.universe_id = u.universe_id) AS title_count,
            (SELECT COUNT(*) FROM characters c WHERE c.universe_id = u.universe_id) AS character_count
     FROM universes u
     ORDER BY u.name`,
  );
  res.json(rows);
});

// GET /api/universes/:id — universe with its titles and characters.
catalogueRouter.get("/universes/:id", async (req, res) => {
  const id = idParam(req);
  const universe = await queryOne("SELECT * FROM universes WHERE universe_id = $1", [id]);
  if (!universe) throw notFound("Universe");

  const [titles, characters] = await Promise.all([
    query("SELECT * FROM v_title_catalogue WHERE universe_id = $1 ORDER BY release_date", [id]),
    query(
      `SELECT character_id, character_name, species, image_url, appearance_count, event_count
       FROM v_character_details WHERE universe_id = $1 ORDER BY character_name`,
      [id],
    ),
  ]);
  res.json({ ...universe, titles, characters });
});

// GET /api/genres
catalogueRouter.get("/genres", async (_req, res) => {
  res.json(
    await query(
      `SELECT g.genre_id, g.name, g.description, COUNT(tg.title_id) AS title_count
       FROM genres g LEFT JOIN title_genres tg ON tg.genre_id = g.genre_id
       GROUP BY g.genre_id ORDER BY g.name`,
    ),
  );
});

// GET /api/titles?q=&genre=&media_type=&universe_id=&sort=name|rating|release
const titleFilters = z.object({
  q: z.string().trim().max(100).optional(),
  genre: z.string().trim().max(50).optional(),
  media_type: z.enum(MEDIA_TYPES).optional(),
  universe_id: positiveId.optional(),
  sort: z.enum(["name", "rating", "release"]).default("name"),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

catalogueRouter.get("/titles", async (req, res) => {
  const f = parse(titleFilters, req.query);
  const orderBy = {
    name: "title_name",
    rating: "average_rating DESC NULLS LAST, review_count DESC, title_name",
    release: "release_date DESC NULLS LAST",
  }[f.sort];

  // Each filter is optional: "$n IS NULL OR condition" keeps a single parameterized query.
  const rows = await query(
    `SELECT * FROM v_title_catalogue
     WHERE ($1::TEXT IS NULL OR title_name ILIKE '%' || $1 || '%' OR synopsis ILIKE '%' || $1 || '%')
       AND ($2::TEXT IS NULL OR $2 = ANY (genres))
       AND ($3::TEXT IS NULL OR media_type = $3)
       AND ($4::INT  IS NULL OR universe_id = $4)
     ORDER BY ${orderBy}
     LIMIT $5`,
    [f.q || null, f.genre || null, f.media_type ?? null, f.universe_id ?? null, f.limit],
  );
  res.json(rows);
});

// GET /api/titles/:id — title with genres, cast and reviews.
catalogueRouter.get("/titles/:id", async (req, res) => {
  const id = idParam(req);
  const title = await queryOne(
    `SELECT c.*, t.banner_url
     FROM v_title_catalogue c JOIN titles t ON t.title_id = c.title_id
     WHERE c.title_id = $1`,
    [id],
  );
  if (!title) throw notFound("Title");

  const [characters, reviews, eventCount] = await Promise.all([
    query(
      `SELECT c.character_id, c.name, c.image_url, c.species, ca.character_role, ca.appearance_notes
       FROM character_appearances ca JOIN characters c ON c.character_id = ca.character_id
       WHERE ca.title_id = $1
       ORDER BY CASE ca.character_role WHEN 'protagonist' THEN 1 WHEN 'antagonist' THEN 2
                                       WHEN 'supporting' THEN 3 ELSE 4 END, c.name`,
      [id],
    ),
    query(
      `SELECT r.review_id, r.user_id, u.username, r.rating, r.review_text, r.created_at, r.updated_at
       FROM reviews r JOIN users u ON u.user_id = r.user_id
       WHERE r.title_id = $1 ORDER BY r.updated_at DESC`,
      [id],
    ),
    queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM story_events WHERE title_id = $1", [id]),
  ]);
  res.json({ ...title, characters, reviews, event_count: eventCount?.count ?? 0 });
});

// GET /api/search?q= — titles, characters and universes matching the text.
catalogueRouter.get("/search", async (req, res) => {
  const { q } = parse(z.object({ q: z.string().trim().min(1).max(100) }), req.query);
  const pattern = `%${q}%`;
  const [titles, characters, universes] = await Promise.all([
    query(
      `SELECT title_id, title_name, media_type, release_date, universe_name, poster_url
       FROM v_title_catalogue WHERE title_name ILIKE $1 ORDER BY title_name LIMIT 20`,
      [pattern],
    ),
    query(
      `SELECT character_id, character_name, universe_name, image_url
       FROM v_character_details WHERE character_name ILIKE $1 ORDER BY character_name LIMIT 20`,
      [pattern],
    ),
    query("SELECT universe_id, name FROM universes WHERE name ILIKE $1 ORDER BY name LIMIT 10", [pattern]),
  ]);
  res.json({ titles, characters, universes });
});
