import Link from "next/link";
import { Empty, Grid, PageHeader, TitleCard } from "@/components/ui";
import { MEDIA_LABELS } from "@/lib/api";
import { load } from "@/lib/server";
import type { TitleSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Titles" };

type Search = { q?: string; genre?: string; media_type?: string; sort?: string };

export default async function TitlesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const key of ["q", "genre", "media_type", "sort"] as const) {
    if (sp[key]) qs.set(key, sp[key]!);
  }
  const [titles, genres] = await Promise.all([
    load<TitleSummary[]>(`/titles?${qs}`),
    load<{ genre_id: number; name: string; title_count: number }[]>("/genres"),
  ]);

  return (
    <>
      <PageHeader eyebrow="Discover" title="Titles">
        Anime, films and series in the catalogue. Filter by genre and media type, or sort by rating.
      </PageHeader>

      {/* A plain GET form: filters become URL parameters and the server re-queries the API. */}
      <form className="card mb-8 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Title or synopsis" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="genre">Genre</label>
          <select id="genre" name="genre" defaultValue={sp.genre ?? ""} className="input">
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g.genre_id} value={g.name}>
                {g.name} ({g.title_count})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="media_type">Media type</label>
          <select id="media_type" name="media_type" defaultValue={sp.media_type ?? ""} className="input">
            <option value="">All types</option>
            {Object.entries(MEDIA_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sort">Sort</label>
          <select id="sort" name="sort" defaultValue={sp.sort ?? "name"} className="input">
            <option value="name">Name</option>
            <option value="rating">Highest rated</option>
            <option value="release">Newest</option>
          </select>
        </div>
        <button className="btn-primary">Apply</button>
      </form>

      <nav aria-label="Genres" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
        {[{ name: "", label: "All" }, ...genres.map((g) => ({ name: g.name, label: g.name }))].map((g) => {
          const params = new URLSearchParams(qs);
          if (g.name) params.set("genre", g.name);
          else params.delete("genre");
          const on = (sp.genre ?? "") === g.name;
          return (
            <Link
              key={g.label}
              href={`/titles?${params}`}
              aria-current={on ? "true" : undefined}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                on ? "bg-accent text-white" : "bg-panel-2 text-muted hover:text-ivory"
              }`}
            >
              {g.label}
            </Link>
          );
        })}
      </nav>

      <p className="mb-4 text-sm text-muted">{titles.length} result{titles.length === 1 ? "" : "s"}</p>
      {titles.length === 0 ? (
        <Empty>No titles match these filters.</Empty>
      ) : (
        <Grid>
          {titles.map((t) => (
            <TitleCard key={t.title_id} title={t} />
          ))}
        </Grid>
      )}
    </>
  );
}
