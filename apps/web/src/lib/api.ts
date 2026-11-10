// Shared API access. The browser and the Next.js server both talk to the
// Express API only — never to PostgreSQL.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Cannot reach the CineMind API. Is the backend running on port 4000?");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.details);
  }
  return data as T;
}

/** Turns an ApiError into readable text, including field-level validation errors. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const fields = err.details ? Object.entries(err.details).map(([k, v]) => `${k}: ${v.join(", ")}`) : [];
    return [err.message, ...fields].join(" — ");
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

export const MEDIA_LABELS: Record<string, string> = {
  movie: "Movie",
  anime_series: "Anime series",
  anime_movie: "Anime movie",
  tv_series: "TV series",
  web_series: "Web series",
};

export function year(date: string | null | undefined) {
  return date ? date.slice(0, 4) : "—";
}
