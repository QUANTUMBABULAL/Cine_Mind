"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BookmarkButton } from "./bookmark-button";
import { ErrorNote } from "./ui";

interface Progress {
  title_id: number;
  progress_status: string;
  progress_percentage: number;
}
interface OwnReview {
  title_id: number;
  rating: number;
  review_text: string | null;
}

// Bookmark, watch progress and the user's own review for one title.
export function TitleActions({ titleId }: { titleId: number }) {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>({ title_id: titleId, progress_status: "planned", progress_percentage: 0 });
  const [hasProgress, setHasProgress] = useState(false);
  const [review, setReview] = useState<OwnReview | null>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<Progress[]>("/me/progress", { token }),
      apiFetch<OwnReview[]>("/me/reviews", { token }),
    ])
      .then(([p, r]) => {
        const mine = p.find((x) => x.title_id === titleId);
        if (mine) {
          setProgress(mine);
          setHasProgress(true);
        }
        const own = r.find((x) => x.title_id === titleId);
        if (own) {
          setReview(own);
          setRating(own.rating);
          setText(own.review_text ?? "");
        }
      })
      .catch((err) => setError(errorText(err)));
  }, [token, titleId]);

  if (!ready) return null;
  if (!user) {
    return (
      <p className="text-sm text-muted">
        <Link href="/login" className="link">Log in</Link> to bookmark this title, track progress or write a review.
      </p>
    );
  }

  async function run(action: () => Promise<void>, done: string) {
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(done);
      router.refresh(); // re-render server data (reviews, average rating)
    } catch (err) {
      setError(errorText(err));
    }
  }

  const saveProgress = () =>
    run(async () => {
      const row = await apiFetch<Progress>(`/me/progress/${titleId}`, {
        method: "PUT",
        token,
        body: { progress_status: progress.progress_status, progress_percentage: progress.progress_percentage },
      });
      setProgress(row);
      setHasProgress(true);
    }, "Progress saved.");

  const saveReview = () =>
    run(async () => {
      const row = await apiFetch<OwnReview>(`/titles/${titleId}/review`, {
        method: "PUT",
        token,
        body: { rating, review_text: text },
      });
      setReview(row);
    }, review ? "Review updated." : "Review published.");

  const deleteReview = () =>
    run(async () => {
      await apiFetch(`/titles/${titleId}/review`, { method: "DELETE", token });
      setReview(null);
      setText("");
      setRating(5);
    }, "Review deleted.");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <BookmarkButton titleId={titleId} />
        <div>
          <label className="label" htmlFor="status">Watch status</label>
          <select
            id="status"
            className="input w-36"
            value={progress.progress_status}
            onChange={(e) =>
              setProgress({
                ...progress,
                progress_status: e.target.value,
                progress_percentage: e.target.value === "completed" ? 100 : progress.progress_percentage,
              })
            }
          >
            <option value="planned">Planned</option>
            <option value="watching">Watching</option>
            <option value="completed">Completed</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pct">Progress %</label>
          <input
            id="pct"
            type="number"
            min={0}
            max={100}
            className="input w-24"
            value={progress.progress_percentage}
            onChange={(e) => setProgress({ ...progress, progress_percentage: Number(e.target.value) })}
          />
        </div>
        <button onClick={saveProgress} className="btn-ghost">
          {hasProgress ? "Update progress" : "Track progress"}
        </button>
      </div>

      <div className="card space-y-3 p-4">
        <p className="text-sm font-medium">{review ? "Your review" : "Write a review"}</p>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              onClick={() => setRating(n)}
              className={`text-2xl ${n <= rating ? "text-accent" : "text-line"}`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-sm text-muted">{rating}/5</span>
        </div>
        <textarea
          className="input min-h-20"
          maxLength={5000}
          placeholder="What did you think? (optional)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={saveReview} className="btn-primary">
            {review ? "Update review" : "Publish review"}
          </button>
          {review && (
            <button onClick={deleteReview} className="btn-danger">
              Delete
            </button>
          )}
        </div>
      </div>
      {message && <p className="text-sm text-success">{message}</p>}
      {error && <ErrorNote message={error} />}
    </div>
  );
}
