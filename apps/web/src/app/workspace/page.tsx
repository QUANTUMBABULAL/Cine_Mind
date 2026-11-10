"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Poster } from "@/components/poster";
import { Empty, ErrorNote, PageHeader, Section, Stars } from "@/components/ui";
import { apiFetch, errorText, MEDIA_LABELS } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { characterImage, titleImage } from "@/lib/images";

const STAT_TONES = ["text-accent", "text-coral", "text-amber", "text-aqua", "text-accent"];

interface Bookmark {
  bookmark_id: number;
  target_type: "title" | "character";
  title_id: number | null;
  title_name: string | null;
  media_type: string | null;
  character_id: number | null;
  character_name: string | null;
}
interface MyReview {
  review_id: number;
  title_id: number;
  title_name: string;
  rating: number;
  review_text: string | null;
  updated_at: string;
}
interface MyProgress {
  progress_id: number;
  title_id: number;
  title_name: string;
  progress_status: string;
  progress_percentage: number;
  updated_at: string;
}
interface Activity {
  bookmarks: number;
  reviews: number;
  average_rating_given: number | null;
  completed: number;
  watching: number;
}

export default function WorkspacePage() {
  const { user, token, ready } = useAuth();
  const [data, setData] = useState<{ bookmarks: Bookmark[]; reviews: MyReview[]; progress: MyProgress[]; activity: Activity } | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [bookmarks, reviews, progress, activity] = await Promise.all([
        apiFetch<Bookmark[]>("/me/bookmarks", { token }),
        apiFetch<MyReview[]>("/me/reviews", { token }),
        apiFetch<MyProgress[]>("/me/progress", { token }),
        apiFetch<Activity>("/me/activity", { token }),
      ]);
      setData({ bookmarks, reviews, progress, activity });
    } catch (err) {
      setError(errorText(err));
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!ready) return null;
  if (!user) {
    return (
      <Empty>
        <Link href="/login" className="link">Log in</Link> to see your bookmarks, reviews and watch progress.
      </Empty>
    );
  }

  async function act(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(errorText(err));
    }
  }

  const removeBookmark = (id: number) => act(() => apiFetch(`/me/bookmarks/${id}`, { method: "DELETE", token }));
  const deleteReview = (titleId: number) => act(() => apiFetch(`/titles/${titleId}/review`, { method: "DELETE", token }));
  const updateProgress = (p: MyProgress, status: string, pct: number) =>
    act(() =>
      apiFetch(`/me/progress/${p.title_id}`, {
        method: "PUT",
        token,
        body: { progress_status: status, progress_percentage: status === "completed" ? 100 : pct },
      }),
    );
  const removeProgress = (titleId: number) => act(() => apiFetch(`/me/progress/${titleId}`, { method: "DELETE", token }));

  return (
    <>
      <PageHeader eyebrow="My workspace" title={`Welcome, ${user.username}`}>
        Roles: {user.roles.join(", ")}
      </PageHeader>
      {error && <div className="mb-6"><ErrorNote message={error} /></div>}
      {!data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Bookmarks", data.activity.bookmarks],
              ["Reviews", data.activity.reviews],
              ["Avg. rating given", data.activity.average_rating_given ?? "—"],
              ["Watching", data.activity.watching],
              ["Completed", data.activity.completed],
            ].map(([label, value], i) => (
              <div key={label} className="card p-4">
                <p className="label">{label}</p>
                <p className={`heading text-3xl ${STAT_TONES[i]}`}>{value}</p>
              </div>
            ))}
          </div>

          <Section title="Watch progress">
            {data.progress.length === 0 ? (
              <Empty>Track a title from its page to see it here.</Empty>
            ) : (
              <ul className="space-y-3">
                {data.progress.map((p) => (
                  <li key={p.progress_id} className="card flex flex-wrap items-center gap-4 p-4">
                    <Link href={`/titles/${p.title_id}`} className="w-12 shrink-0">
                      <Poster src={titleImage(p.title_name)} label={p.title_name} rounded="rounded-md" />
                    </Link>
                    <div className="min-w-48 flex-1">
                      <Link href={`/titles/${p.title_id}`} className="link font-medium">{p.title_name}</Link>
                      <div className="mt-2 h-2 rounded-full bg-panel-2">
                        <div className="h-2 rounded-full bg-accent" style={{ width: `${p.progress_percentage}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {p.progress_percentage}% · {p.progress_status}
                      </p>
                    </div>
                    <select
                      aria-label={`Status for ${p.title_name}`}
                      className="input w-36"
                      value={p.progress_status}
                      onChange={(e) => updateProgress(p, e.target.value, p.progress_percentage)}
                    >
                      <option value="planned">Planned</option>
                      <option value="watching">Watching</option>
                      <option value="completed">Completed</option>
                      <option value="dropped">Dropped</option>
                    </select>
                    <input
                      aria-label={`Percentage for ${p.title_name}`}
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={p.progress_percentage}
                      onBlur={(e) => {
                        const pct = Number(e.target.value);
                        if (pct !== p.progress_percentage) updateProgress(p, p.progress_status, pct);
                      }}
                      className="input w-20"
                    />
                    <button onClick={() => removeProgress(p.title_id)} className="btn-ghost">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Bookmarks">
            {data.bookmarks.length === 0 ? (
              <Empty>No bookmarks yet.</Empty>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.bookmarks.map((b) => (
                  <li key={b.bookmark_id} className="card flex items-center gap-3 p-3">
                    <div className="w-11 shrink-0">
                      {b.target_type === "title" ? (
                        <Poster src={titleImage(b.title_name ?? "")} label={b.title_name ?? "Title"} rounded="rounded-md" />
                      ) : (
                        <Poster
                          src={characterImage(b.character_name ?? "", undefined)}
                          label={b.character_name ?? "Character"}
                          ratio="square"
                          rounded="rounded-full"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="label">{b.target_type}</p>
                      {b.target_type === "title" ? (
                        <Link href={`/titles/${b.title_id}`} className="link">
                          {b.title_name} <span className="text-xs text-muted">({MEDIA_LABELS[b.media_type ?? ""]})</span>
                        </Link>
                      ) : (
                        <Link href={`/characters/${b.character_id}`} className="link">{b.character_name}</Link>
                      )}
                    </div>
                    <button onClick={() => removeBookmark(b.bookmark_id)} className="btn-ghost">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="My reviews">
            {data.reviews.length === 0 ? (
              <Empty>You have not reviewed anything yet.</Empty>
            ) : (
              <ul className="space-y-3">
                {data.reviews.map((r) => (
                  <li key={r.review_id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/titles/${r.title_id}`} className="link font-medium">{r.title_name}</Link>
                      <Stars value={r.rating} />
                    </div>
                    {r.review_text && <p className="mt-1 text-sm text-muted">{r.review_text}</p>}
                    <div className="mt-3 flex gap-2">
                      <Link href={`/titles/${r.title_id}`} className="btn-ghost">Edit</Link>
                      <button onClick={() => deleteReview(r.title_id)} className="btn-danger">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </>
  );
}
