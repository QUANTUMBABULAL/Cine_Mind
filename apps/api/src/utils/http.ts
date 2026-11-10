import type { Request } from "express";
import { z } from "zod";

/** An error with an HTTP status, turned into a JSON response by the error handler. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);

/** Validates data with a zod schema, throwing a 400 with field errors on failure. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, "Invalid request", z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

/** Parses a positive integer route parameter such as :id. */
export function idParam(req: Request, name = "id"): number {
  const value = Number(req.params[name]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  return value;
}

// Reusable field schemas.
export const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v === "" ? null : v ?? null));
export const optionalUrl = z
  .union([z.url({ protocol: /^https?$/ }), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
export const optionalDate = z
  .union([z.iso.date(), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
export const positiveId = z.coerce.number().int().positive();
