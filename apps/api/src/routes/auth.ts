import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { queryOne, withTransaction } from "../db/pool.js";
import { loadUser, requireAuth, signToken } from "../middleware/auth.js";
import { HttpError, parse } from "../utils/http.js";

export const authRouter = Router();

const registerSchema = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,50}$/, "3-50 letters, digits or underscores"),
  email: z.email().trim().toLowerCase().max(255),
  password: z.string().min(8, "At least 8 characters").max(72, "At most 72 characters"),
});

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(72),
});

// POST /api/auth/register — creates the user and assigns the Viewer role atomically.
authRouter.post("/register", async (req, res) => {
  const body = parse(registerSchema, req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);

  const userId = await withTransaction(null, async (client) => {
    const { rows } = await client.query<{ user_id: number }>(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id`,
      [body.username, body.email, passwordHash],
    );
    const newUserId = rows[0].user_id;
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, role_id FROM roles WHERE role_name = 'Viewer'`,
      [newUserId],
    );
    return newUserId;
  });

  res.status(201).json({ token: signToken(userId), user: await loadUser(userId) });
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  const body = parse(loginSchema, req.body);
  const row = await queryOne<{ user_id: number; password_hash: string; account_status: string }>(
    "SELECT user_id, password_hash, account_status FROM users WHERE email = $1",
    [body.email],
  );
  // Same message for unknown email and wrong password (no account enumeration).
  if (!row || !(await bcrypt.compare(body.password, row.password_hash))) {
    throw new HttpError(401, "Invalid email or password");
  }
  if (row.account_status !== "active") throw new HttpError(403, "Account is suspended");

  res.json({ token: signToken(row.user_id), user: await loadUser(row.user_id) });
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout — JWTs are stateless: the client discards its token.
// Tokens expire after JWT_EXPIRES_IN; suspending a user blocks them immediately
// because every request re-checks account_status in the database.
authRouter.post("/logout", (_req, res) => {
  res.status(204).end();
});
