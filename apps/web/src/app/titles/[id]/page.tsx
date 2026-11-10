import Link from "next/link";
import { Backdrop, Poster } from "@/components/poster";
import { TitleActions } from "@/components/title-actions";
import { Badge, CharacterGrid, Empty, GenreBadge, Section, Stars } from "@/components/ui";
import { MEDIA_LABELS } from "@/lib/api";
import { characterImage, titleImage } from "@/lib/images";
import { load } from "@/lib/server";
import type { TitleDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLE_TONE = { protagonist: "accent", antagonist: "coral", supporting: "aqua" } as const;

export default async function TitleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await load<TitleDetail>(`/titles/${id}`);
  const poster = titleImage(t.title_name, t.poster_url);

  return (
    <>
      <Backdrop src={t.banner_url || poster}>
        <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]">
          <div className="mx-auto w-48 md:w-full">
            <Poster src={poster} label={t.title_name} sub={MEDIA_LABELS[t.media_type]} rounded="rounded-xl" />
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">
              {t.universe_name ? (
                <Link href={`/universes/${t.universe_id}`} className="hover:text-ivory">
                  {t.universe_name} universe
                </Link>
              ) : (
                "Standalone title"
              )}
            </p>
            <h1 className="heading text-4xl sm:text-5xl">{t.title_name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone="accent">{MEDIA_LABELS[t.media_type]}</Badge>
              <span>{t.release_date ?? "Release date unknown"}</span>
              <Badge tone={t.status === "ongoing" ? "aqua" : "default"}>{t.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.genres.map((g) => (
                <GenreBadge key={g} name={g} href={`/titles?genre=${encodeURIComponent(g)}`} />
              ))}
            </div>
            <p className="mt-4 max-w-2xl leading-relaxed text-ivory/85">{t.synopsis}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Stars value={t.average_rating} />
              <span className="text-sm text-muted">{t.review_count} reviews</span>
              {t.event_count > 0 && (
                <Link href={`/story?title_id=${t.title_id}`} className="btn-primary">
                  Explore {t.event_count} story events →
                </Link>
              )}
            </div>
            <div className="mt-6 rounded-xl bg-ink/60 p-4 ring-1 ring-line/60">
              <TitleActions titleId={t.title_id} />
            </div>
          </div>
        </div>
      </Backdrop>

      <Section title={`Characters (${t.characters.length})`}>
        {t.characters.length === 0 ? (
          <Empty>No characters recorded for this title.</Empty>
        ) : (
          <CharacterGrid>
            {t.characters.map((c) => (
              <Link key={c.character_id} href={`/characters/${c.character_id}`} className="group block">
                <div className="relative overflow-hidden rounded-xl ring-aqua transition group-hover:-translate-y-1 group-hover:ring-2">
                  <Poster
                    src={characterImage(c.name, t.universe_name, c.image_url)}
                    label={c.name}
                    ratio="portrait"
                    rounded="rounded-xl"
                    zoom
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-ink/90 backdrop-blur">
                    <Badge tone={ROLE_TONE[c.character_role as keyof typeof ROLE_TONE] ?? "default"}>{c.character_role}</Badge>
                  </span>
                </div>
                <p className="mt-2 truncate font-semibold group-hover:text-accent">{c.name}</p>
                {c.species && <p className="truncate text-xs text-muted">{c.species}</p>}
              </Link>
            ))}
          </CharacterGrid>
        )}
      </Section>

      <Section title={`Reviews (${t.reviews.length})`}>
        {t.reviews.length === 0 ? (
          <Empty>No reviews yet. Be the first to review this title.</Empty>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {t.reviews.map((r) => (
              <li key={r.review_id} className="card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 text-xs font-bold uppercase text-accent">
                      {r.username.slice(0, 1)}
                    </span>
                    {r.username}
                  </span>
                  <Stars value={r.rating} />
                </div>
                {r.review_text && <p className="text-sm leading-relaxed text-ivory/80">{r.review_text}</p>}
                <p className="mt-2 text-xs text-muted/70">Updated {new Date(r.updated_at).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
