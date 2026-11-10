import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http.js";

// PostgreSQL SQLSTATE codes -> HTTP responses. The database constraints are the
// final authority; this maps their errors to useful client messages.
const PG_ERRORS: Record<string, { status: number; message: string }> = {
  "23505": { status: 409, message: "A record with these values already exists" },
  "23503": { status: 409, message: "Referenced record does not exist or is still in use" },
  "23001": { status: 409, message: "Record is still referenced by other records" },
  "23514": { status: 400, message: "Value violates a data rule" },
  "23502": { status: 400, message: "A required value is missing" },
  "22P02": { status: 400, message: "Invalid value format" },
  "22001": { status: 400, message: "Value is too long" },
  "42501": { status: 403, message: "Operation not permitted" },
  P0002: { status: 404, message: "Record not found" },
};

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }
  const mapped = typeof err?.code === "string" ? PG_ERRORS[err.code] : undefined;
  if (mapped) {
    // Custom RAISE EXCEPTION messages from our triggers/procedures are safe to show;
    // constraint errors include the constraint name for clarity.
    res.status(mapped.status).json({
      error: err.message || mapped.message,
      constraint: err.constraint,
      code: err.code,
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
