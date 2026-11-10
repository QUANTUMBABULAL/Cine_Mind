"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Target = { titleId: number; characterId?: never } | { characterId: number; titleId?: never };

export function BookmarkButton(props: Target) {
  const { user, token, ready } = useAuth();
  const [bookmarkId, setBookmarkId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch<{ bookmark_id: number; title_id: number | null; character_id: number | null }[]>("/me/bookmarks", { token })
      .then((rows) => {
        const match = rows.find((b) =>
          props.titleId ? b.title_id === props.titleId : b.character_id === props.characterId,
        );
        setBookmarkId(match?.bookmark_id ?? null);
      })
      .catch(() => undefined);
  }, [token, props.titleId, props.characterId]);

  if (!ready) return null;
  if (!user) {
    return (
      <Link href="/login" className="btn-ghost">
        Log in to bookmark
      </Link>
    );
  }

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (bookmarkId) {
        await apiFetch(`/me/bookmarks/${bookmarkId}`, { method: "DELETE", token });
        setBookmarkId(null);
      } else {
        const body = props.titleId ? { title_id: props.titleId } : { character_id: props.characterId };
        const row = await apiFetch<{ bookmark_id: number }>("/me/bookmarks", { method: "POST", token, body });
        setBookmarkId(row.bookmark_id);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button onClick={toggle} disabled={busy} className={bookmarkId ? "btn-primary" : "btn-ghost"}>
        {bookmarkId ? "★ Bookmarked" : "☆ Bookmark"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
