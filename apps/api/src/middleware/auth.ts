import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { queryOne } from "../db/pool.js";
import { HttpError } from "../utils/http.js";

export interface AuthUser {
  user_id: number;
  username: string;
  email: string;
  account_status: string;
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Loads the user with roles and permissions from the database on every request,
 * so role changes and suspensions take effect immediately (the JWT only
 * carries the user id).
 */
export async function loadUser(userId: number): Promise<AuthUser | null> {
  return queryOne<AuthUser>(
    `SELECT u.user_id, u.username, u.email, u.account_status,
            COALESCE(array_agg(DISTINCT r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles,
            COALESCE(array_agg(DISTINCT p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL), '{}') AS permissions
     FROM users u
     LEFT JOIN user_roles ur       ON ur.user_id = u.user_id
     LEFT JOIN roles r             ON r.role_id = ur.role_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
     LEFT JOIN permissions p       ON p.permission_id = rp.permission_id
     WHERE u.user_id = $1
     GROUP BY u.user_id`,
    [userId],
  );
}

async function resolveUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
  const user = await loadUser(Number(payload.sub));
  if (!user) throw new HttpError(401, "User no longer exists");
  if (user.account_status !== "active") throw new HttpError(403, "Account is suspended");
  return user;
}

/** Attaches req.user if a valid token is present; public routes still work without one. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = (await resolveUser(req)) ?? undefined;
  next();
}

/** Rejects the request with 401 unless a valid token is present. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await resolveUser(req);
  if (!user) throw new HttpError(401, "Authentication required");
  req.user = user;
  next();
}

/** Rejects with 403 unless the user's roles grant the permission (run after requireAuth). */
export function requirePermission(code: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.permissions.includes(code)) {
      throw new HttpError(403, `Permission '${code}' required`);
    }
    next();
  };
}
