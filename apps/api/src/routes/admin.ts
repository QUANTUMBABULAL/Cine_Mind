import { Router } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { query, queryOne, withTransaction } from "../db/pool.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import {
  HttpError,
  idParam,
  notFound,
  optionalDate,
  optionalText,
  optionalUrl,
  parse,
  positiveId,
} from "../utils/http.js";

export const adminRouter = Router();
adminRouter.use(requireAuth);

const content = requirePermission("content.manage");
const users = requirePermission("users.manage");

// ---------------------------------------------------------------------------
// Small CRUD helpers. Column names come from the keys of a validated zod
// object (unknown keys are stripped), never from raw user input, and every
// value is passed as a $n parameter.
// ---------------------------------------------------------------------------
async function insertRow(client: PoolClient, table: string, data: Record<string, unknown>) {
  const cols = Object.keys(data);
  const params = cols.map((_, i) => `$${i + 1}`);
  const { rows } = await client.query(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${params.join(", ")}) RETURNING *`,
    Object.values(data),
  );
  return rows[0];
}

async function updateRow(client: PoolClient, table: string, pk: string, id: number, data: Record<string, unknown>) {
  const cols = Object.keys(data);
  const sets = cols.map((c, i) => `${c} = $${i + 1}`);
  const { rows } = await client.query(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE ${pk} = $${cols.length + 1} RETURNING *`,
    [...Object.values(data), id],
  );
  if (rows.length === 0) throw notFound(table);
  return rows[0];
}

async function deleteRow(client: PoolClient, table: string, pk: string, id: number) {
  const { rowCount } = await client.query(`DELETE FROM ${table} WHERE ${pk} = $1`, [id]);
  if (!rowCount) throw notFound(table);
}

/** Registers POST, PUT /:id and DELETE /:id for a simple table. */
function crud(path: string, table: string, pk: string, schema: z.ZodObject<any>) {
  adminRouter.post(path, content, async (req, res) => {
    const data = parse(schema, req.body);
    res.status(201).json(await withTransaction(req.user!.user_id, (c) => insertRow(c, table, data)));
  });
  adminRouter.put(`${path}/:id`, content, async (req, res) => {
    const data = parse(schema, req.body);
    res.json(await withTransaction(req.user!.user_id, (c) => updateRow(c, table, pk, idParam(req), data)));
  });
  adminRouter.delete(`${path}/:id`, content, async (req, res) => {
    await withTransaction(req.user!.user_id, (c) => deleteRow(c, table, pk, idParam(req)));
    res.status(204).end();
  });
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
const nullableId = z.union([positiveId, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));

crud(
  "/universes",
  "universes",
  "universe_id",
  z.object({
    name: z.string().trim().min(1).max(150),
    description: optionalText(5000),
    origin_type: z.enum(["manga", "novel", "film", "tv", "comic", "game", "original"]),
    cover_image_url: optionalUrl,
  }),
);

crud(
  "/genres",
  "genres",
  "genre_id",
  z.object({ name: z.string().trim().min(1).max(50), description: optionalText(1000) }),
);

crud(
  "/characters",
  "characters",
  "character_id",
  z.object({
    universe_id: nullableId,
    name: z.string().trim().min(1).max(150),
    biography: optionalText(5000),
    gender: optionalText(30),
    species: optionalText(60),
    image_url: optionalUrl,
    first_appearance_date: optionalDate,
  }),
);

crud(
  "/relationships",
  "character_relationships",
  "relationship_id",
  z.object({
    source_character_id: positiveId,
    target_character_id: positiveId,
    relationship_type_id: positiveId,
    description: optionalText(1000),
  }),
);

adminRouter.get("/relationships", content, async (_req, res) => {
  res.json(
    await query(
      `SELECT cr.relationship_id, cr.description,
              s.character_id AS source_character_id, s.name AS source_name,
              t.character_id AS target_character_id, t.name AS target_name,
              rt.relationship_type_id, rt.name AS relationship_type,
              u.name AS universe_name
       FROM character_relationships cr
       JOIN characters s          ON s.character_id = cr.source_character_id
       JOIN characters t          ON t.character_id = cr.target_character_id
       JOIN relationship_types rt ON rt.relationship_type_id = cr.relationship_type_id
       LEFT JOIN universes u      ON u.universe_id = s.universe_id
       ORDER BY u.name NULLS LAST, s.name, rt.name, t.name`,
    ),
  );
});

// Titles: genre links (M:N) are replaced in the same transaction as the title row.
const titleSchema = z.object({
  universe_id: nullableId,
  name: z.string().trim().min(1).max(200),
  media_type: z.enum(["movie", "anime_series", "anime_movie", "tv_series", "web_series"]),
  synopsis: optionalText(5000),
  release_date: optionalDate,
  status: z.enum(["upcoming", "released", "ongoing", "completed"]),
  poster_url: optionalUrl,
  banner_url: optionalUrl,
  genre_ids: z.array(positiveId).max(20).default([]),
});

async function setTitleGenres(client: PoolClient, titleId: number, genreIds: number[]) {
  await client.query("DELETE FROM title_genres WHERE title_id = $1", [titleId]);
  await client.query(
    "INSERT INTO title_genres (title_id, genre_id) SELECT $1, unnest($2::INT[]) ON CONFLICT DO NOTHING",
    [titleId, genreIds],
  );
}

adminRouter.post("/titles", content, async (req, res) => {
  const { genre_ids, ...data } = parse(titleSchema, req.body);
  const title = await withTransaction(req.user!.user_id, async (c) => {
    const row = await insertRow(c, "titles", data);
    await setTitleGenres(c, row.title_id, genre_ids);
    return row;
  });
  res.status(201).json(title);
});

adminRouter.put("/titles/:id", content, async (req, res) => {
  const { genre_ids, ...data } = parse(titleSchema, req.body);
  const id = idParam(req);
  const title = await withTransaction(req.user!.user_id, async (c) => {
    const row = await updateRow(c, "titles", "title_id", id, data);
    await setTitleGenres(c, id, genre_ids);
    return row;
  });
  res.json(title);
});

adminRouter.delete("/titles/:id", content, async (req, res) => {
  await withTransaction(req.user!.user_id, (c) => deleteRow(c, "titles", "title_id", idParam(req)));
  res.status(204).end();
});

// Character appearances (M:N with attributes).
adminRouter.post("/appearances", content, async (req, res) => {
  const data = parse(
    z.object({
      character_id: positiveId,
      title_id: positiveId,
      character_role: z.enum(["protagonist", "antagonist", "supporting", "minor", "cameo"]),
      appearance_notes: optionalText(1000),
    }),
    req.body,
  );
  res.status(201).json(await withTransaction(req.user!.user_id, (c) => insertRow(c, "character_appearances", data)));
});

adminRouter.delete("/appearances/:characterId/:titleId", content, async (req, res) => {
  const rows = await query(
    "DELETE FROM character_appearances WHERE character_id = $1 AND title_id = $2 RETURNING 1",
    [idParam(req, "characterId"), idParam(req, "titleId")],
  );
  if (rows.length === 0) throw notFound("Appearance");
  res.status(204).end();
});

// Story events: created through the add_story_event stored procedure, which
// inserts the event and all participants atomically.
const eventFields = {
  event_name: z.string().trim().min(1).max(200),
  description: optionalText(5000),
  spoiler_level: z.enum(["none", "minor", "major"]).default("none"),
  chronology_order: z.coerce.number().int().positive().optional().nullable(),
  release_order: z.coerce.number().int().positive().optional().nullable(),
};

adminRouter.post("/events", content, async (req, res) => {
  const body = parse(
    z.object({
      title_id: positiveId,
      ...eventFields,
      participants: z
        .array(
          z.object({
            character_id: positiveId,
            participation_type: z.enum(["central", "supporting", "victim", "perpetrator", "witness"]),
          }),
        )
        .max(50)
        .default([]),
    }),
    req.body,
  );
  const eventId = await withTransaction(req.user!.user_id, async (c) => {
    const { rows } = await c.query<{ p_event_id: number }>(
      "CALL add_story_event($1, $2, $3, $4, $5, $6, $7::INT[], $8::VARCHAR[], NULL)",
      [
        body.title_id,
        body.event_name,
        body.description,
        body.spoiler_level,
        body.chronology_order ?? null,
        body.release_order ?? null,
        body.participants.map((p) => p.character_id),
        body.participants.map((p) => p.participation_type),
      ],
    );
    return rows[0].p_event_id;
  });
  res.status(201).json(await queryOne("SELECT * FROM v_event_details WHERE event_id = $1", [eventId]));
});

adminRouter.put("/events/:id", content, async (req, res) => {
  const body = parse(
    z.object({
      ...eventFields,
      chronology_order: z.coerce.number().int().positive(),
      release_order: z.coerce.number().int().positive(),
    }),
    req.body,
  );
  res.json(await withTransaction(req.user!.user_id, (c) => updateRow(c, "story_events", "event_id", idParam(req), body)));
});

adminRouter.delete("/events/:id", content, async (req, res) => {
  await withTransaction(req.user!.user_id, (c) => deleteRow(c, "story_events", "event_id", idParam(req)));
  res.status(204).end();
});

// Dashboard counts.
adminRouter.get("/stats", content, async (_req, res) => {
  res.json(
    await queryOne(
      `SELECT (SELECT COUNT(*) FROM universes) AS universes, (SELECT COUNT(*) FROM titles) AS titles,
              (SELECT COUNT(*) FROM characters) AS characters, (SELECT COUNT(*) FROM story_events) AS events,
              (SELECT COUNT(*) FROM character_relationships) AS relationships,
              (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM reviews) AS reviews,
              (SELECT COUNT(*) FROM audit_logs) AS audit_entries`,
    ),
  );
});

// ---------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------
adminRouter.get("/users", users, async (_req, res) => {
  res.json(
    await query(
      `SELECT u.user_id, u.username, u.email, u.account_status, u.created_at,
              COALESCE(array_agg(r.role_name ORDER BY r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN roles r       ON r.role_id = ur.role_id
       GROUP BY u.user_id
       ORDER BY u.user_id`,
    ),
  );
});

adminRouter.get("/roles", users, async (_req, res) => {
  res.json(
    await query(
      `SELECT r.role_id, r.role_name, r.description,
              COALESCE(array_agg(p.permission_code ORDER BY p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL), '{}') AS permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
       LEFT JOIN permissions p       ON p.permission_id = rp.permission_id
       GROUP BY r.role_id ORDER BY r.role_id`,
    ),
  );
});

adminRouter.patch("/users/:id/status", users, async (req, res) => {
  const id = idParam(req);
  const { account_status } = parse(z.object({ account_status: z.enum(["active", "suspended"]) }), req.body);
  if (id === req.user!.user_id) throw new HttpError(400, "You cannot change your own account status");
  const row = await withTransaction(req.user!.user_id, (c) =>
    updateRow(c, "users", "user_id", id, { account_status }),
  );
  res.json({ user_id: row.user_id, account_status: row.account_status });
});

// Role assignment goes through the assign_user_role procedure, which re-checks
// the actor's permission and blocks Admin self-assignment inside the database.
adminRouter.post("/users/:id/roles", users, async (req, res) => {
  const id = idParam(req);
  const { role_name } = parse(z.object({ role_name: z.string().trim().min(1).max(30) }), req.body);
  if (id === req.user!.user_id && role_name === "Admin") {
    throw new HttpError(403, "Users cannot assign the Admin role to themselves");
  }
  await withTransaction(req.user!.user_id, (c) =>
    c.query("CALL assign_user_role($1, $2, $3)", [req.user!.user_id, id, role_name]),
  );
  res.status(201).json({ user_id: id, role_name });
});

adminRouter.delete("/users/:id/roles/:roleName", users, async (req, res) => {
  const id = idParam(req);
  const roleName = String(req.params.roleName);
  if (id === req.user!.user_id && roleName === "Admin") {
    throw new HttpError(400, "You cannot remove your own Admin role");
  }
  const removed = await withTransaction(req.user!.user_id, async (c) => {
    const { rowCount } = await c.query(
      `DELETE FROM user_roles ur USING roles r
       WHERE ur.role_id = r.role_id AND ur.user_id = $1 AND r.role_name = $2`,
      [id, roleName],
    );
    return rowCount;
  });
  if (!removed) throw notFound("Role assignment");
  res.status(204).end();
});

// Audit log (most recent first).
adminRouter.get("/audit", requirePermission("audit.view"), async (req, res) => {
  const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }), req.query);
  res.json(
    await query(
      `SELECT a.audit_id, a.action, a.entity_type, a.entity_id, a.old_data, a.new_data, a.created_at,
              a.user_id, u.username
       FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id
       ORDER BY a.audit_id DESC LIMIT $1`,
      [limit],
    ),
  );
});
