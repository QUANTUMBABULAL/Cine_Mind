import { Router } from "express";
import { z } from "zod";
import { query, queryOne, withTransaction } from "../db/pool.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { HttpError, idParam, notFound, optionalText, parse, positiveId } from "../utils/http.js";

// Endpoints acting on the signed-in user's own data. user_id always comes from
// the verified token, never from the request body.
export const workspaceRouter = Router();
workspaceRouter.use(["/me", "/titles/:id/review"], requireAuth);

// ---------------- Bookmarks ----------------

workspaceRouter.get("/me/bookmarks", async (req, res) => {
  res.json(
    await query(
      `SELECT b.bookmark_id, b.created_at,
              CASE WHEN b.title_id IS NOT NULL THEN 'title' ELSE 'character' END AS target_type,
              b.title_id, t.name AS title_name, t.media_type, t.poster_url,
              b.character_id, c.name AS character_name, c.image_url
       FROM bookmarks b
       LEFT JOIN titles t     ON t.title_id = b.title_id
       LEFT JOIN characters c ON c.character_id = b.character_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user!.user_id],
    ),
  );
});

const bookmarkSchema = z
  .object({ title_id: positiveId.optional(), character_id: positiveId.optional() })
  .refine((b) => (b.title_id === undefined) !== (b.character_id === undefined), {
    message: "Provide exactly one of title_id or character_id",
  });

workspaceRouter.post("/me/bookmarks", requirePermission("bookmark.manage"), async (req, res) => {
  const body = parse(bookmarkSchema, req.body);
  const row = await queryOne(
    `INSERT INTO bookmarks (user_id, title_id, character_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [req.user!.user_id, body.title_id ?? null, body.character_id ?? null],
  );
  res.status(201).json(row);
});

workspaceRouter.delete("/me/bookmarks/:id", requirePermission("bookmark.manage"), async (req, res) => {
  const rows = await query("DELETE FROM bookmarks WHERE bookmark_id = $1 AND user_id = $2 RETURNING bookmark_id", [
    idParam(req),
    req.user!.user_id,
  ]);
  if (rows.length === 0) throw notFound("Bookmark");
  res.status(204).end();
});

// ---------------- Reviews ----------------

workspaceRouter.get("/me/reviews", async (req, res) => {
  res.json(
    await query(
      `SELECT r.*, t.name AS title_name
       FROM reviews r JOIN titles t ON t.title_id = r.title_id
       WHERE r.user_id = $1 ORDER BY r.updated_at DESC`,
      [req.user!.user_id],
    ),
  );
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  review_text: optionalText(5000),
});

// PUT /api/titles/:id/review — create or update the user's single review (UPSERT).
workspaceRouter.put("/titles/:id/review", requirePermission("review.write"), async (req, res) => {
  const titleId = idParam(req);
  const body = parse(reviewSchema, req.body);
  const review = await withTransaction(req.user!.user_id, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO reviews (user_id, title_id, rating, review_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, title_id)
       DO UPDATE SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text
       RETURNING *, (xmax = 0) AS created`,
      [req.user!.user_id, titleId, body.rating, body.review_text],
    );
    return rows[0];
  });
  res.status(review.created ? 201 : 200).json(review);
});

workspaceRouter.delete("/titles/:id/review", requirePermission("review.write"), async (req, res) => {
  const deleted = await withTransaction(req.user!.user_id, async (client) => {
    const { rowCount } = await client.query("DELETE FROM reviews WHERE title_id = $1 AND user_id = $2", [
      idParam(req),
      req.user!.user_id,
    ]);
    return rowCount;
  });
  if (!deleted) throw notFound("Review");
  res.status(204).end();
});

// ---------------- Watch progress ----------------

workspaceRouter.get("/me/progress", async (req, res) => {
  res.json(
    await query(
      `SELECT wp.*, t.name AS title_name, t.media_type, t.poster_url
       FROM watch_progress wp JOIN titles t ON t.title_id = wp.title_id
       WHERE wp.user_id = $1 ORDER BY wp.updated_at DESC`,
      [req.user!.user_id],
    ),
  );
});

const progressSchema = z
  .object({
    progress_status: z.enum(["planned", "watching", "completed", "dropped"]),
    progress_percentage: z.coerce.number().min(0).max(100),
  })
  .transform((p) => (p.progress_status === "completed" ? { ...p, progress_percentage: 100 } : p));

// PUT /api/me/progress/:titleId — add or update progress (UPSERT on user_id + title_id).
workspaceRouter.put("/me/progress/:titleId", requirePermission("progress.manage"), async (req, res) => {
  const titleId = idParam(req, "titleId");
  const body = parse(progressSchema, req.body);
  const row = await queryOne(
    `INSERT INTO watch_progress (user_id, title_id, progress_status, progress_percentage)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, title_id)
     DO UPDATE SET progress_status = EXCLUDED.progress_status,
                   progress_percentage = EXCLUDED.progress_percentage
     RETURNING *`,
    [req.user!.user_id, titleId, body.progress_status, body.progress_percentage],
  );
  res.json(row);
});

workspaceRouter.delete("/me/progress/:titleId", requirePermission("progress.manage"), async (req, res) => {
  const rows = await query("DELETE FROM watch_progress WHERE title_id = $1 AND user_id = $2 RETURNING 1", [
    idParam(req, "titleId"),
    req.user!.user_id,
  ]);
  if (rows.length === 0) throw notFound("Progress");
  res.status(204).end();
});

// ---------------- Activity summary ----------------

workspaceRouter.get("/me/activity", async (req, res) => {
  const userId = req.user!.user_id;
  const summary = await queryOne(
    `SELECT (SELECT COUNT(*) FROM bookmarks WHERE user_id = $1)                         AS bookmarks,
            (SELECT COUNT(*) FROM reviews WHERE user_id = $1)                           AS reviews,
            (SELECT ROUND(AVG(rating), 2) FROM reviews WHERE user_id = $1)              AS average_rating_given,
            (SELECT COUNT(*) FROM watch_progress WHERE user_id = $1 AND progress_status = 'completed') AS completed,
            (SELECT COUNT(*) FROM watch_progress WHERE user_id = $1 AND progress_status = 'watching')  AS watching`,
    [userId],
  );
  if (!summary) throw new HttpError(500, "Could not load activity");
  res.json(summary);
});
