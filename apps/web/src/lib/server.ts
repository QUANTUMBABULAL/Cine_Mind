import { notFound } from "next/navigation";
import { ApiError, apiFetch } from "./api";

/** Server-side GET; a 404/400 from the API renders the Not Found page. */
export async function load<T>(path: string): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
}
