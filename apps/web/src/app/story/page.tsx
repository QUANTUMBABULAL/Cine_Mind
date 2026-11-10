import Link from "next/link";
import { Poster } from "@/components/poster";
import {
  ArcCard,
  Avatar,
  OUTCOME_TONES,
  OrderToggle,
  PARTICIPATION_TONES,
  SpoilerBadge,
  TONE_BG,
  TONE_TEXT,
} from "@/components/story";
import { Badge, Empty, PageHeader, Section } from "@/components/ui";
import { MEDIA_LABELS, year } from "@/lib/api";
import { titleImage } from "@/lib/images";
import { load } from "@/lib/server";
import type { Arc, StoryEvent, TitleSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Story Explorer" };

// Timeline markers cycle through the accent colours so neighbouring events are easy to tell apart.
const MARKERS = ["accent", "coral", "aqua", "amber"] as const;

export default async function StoryExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ title_id?: string; order?: string }>;
}) {
  const sp = await searchParams;
  const order = sp.order === "release" ? "release" : "chronology";
  const titles = (await load<TitleSummary[]>("/titles?sort=release")).filter((t) => t.character_count > 0);

  // Default to Game of Thrones, the main demonstration universe.
  const selected =
    titles.find((t) => String(t.title_id) === sp.title_id) ??
    titles.find((t) => t.title_name === "Game of Thrones") ??
    titles[0];

  const [events, arcs] = selected
    ? await Promise.all([
        load<StoryEvent[]>(`/titles/${selected.title_id}/events?order=${order}`),
        load<Arc[]>(`/titles/${selected.title_id}/arcs`),
      ])
    : [[], []];
  const universe = selected?.universe_name ?? null;

  // Everyone who takes part in at least one event, most involved first.
  const cast = new Map<number, { id: number; name: string; count: number }>();
  for (const e of events)
    for (const p of e.participants) {
      const row = cast.get(p.character_id) ?? { id: p.character_id, name: p.name, count: 0 };
      row.count++;
      cast.set(p.character_id, row);
    }
  const castList = [...cast.values()].sort((a, b) => b.count - a.count);

  return (
    <>
      <PageHeader eyebrow="Story Explorer" title="Follow the story">
        Follow the key events of a title in the order they happen in-universe, or in the order the audience sees them,
        and see who took part and how each character arc develops.
      </PageHeader>

      <form className="card mb-8 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-60 flex-1">
          <label className="label" htmlFor="title_id">Title</label>
          <select id="title_id" name="title_id" defaultValue={selected?.title_id} className="input">
            {titles.map((t) => (
              <option key={t.title_id} value={t.title_id}>
                {t.title_name}
                {t.universe_name ? ` — ${t.universe_name}` : ""}
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="order" value={order} />
        <button className="btn-primary">Explore</button>
        {selected && <OrderToggle basePath="/story" order={order} extra={{ title_id: String(selected.title_id) }} />}
      </form>

      {selected && (
        <section className="card mb-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <Link href={`/titles/${selected.title_id}`} className="w-24 shrink-0 self-start sm:self-auto">
            <Poster src={titleImage(selected.title_name, selected.poster_url)} label={selected.title_name} rounded="rounded-lg" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              {universe ?? "Standalone"} · {MEDIA_LABELS[selected.media_type]} · {year(selected.release_date)}
            </p>
            <h2 className="heading mt-1 text-2xl sm:text-3xl">{selected.title_name}</h2>
            <p className="mt-1 text-sm text-muted">
              <strong className="text-coral">{events.length}</strong> events ·{" "}
              <strong className="text-aqua">{castList.length}</strong> characters involved ·{" "}
              <strong className="text-amber">{arcs.length}</strong> arcs
            </p>
            {castList.length > 0 && (
              <ul className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1" aria-label="Characters in these events">
                {castList.map((p, i) => (
                  <li key={p.id}>
                    <Link href={`/characters/${p.id}`} className="group flex w-16 flex-col items-center gap-1 text-center">
                      <Avatar name={p.name} universe={universe} size="h-12 w-12" tone={MARKERS[i % MARKERS.length]} />
                      <span className="line-clamp-2 text-[11px] leading-tight text-muted group-hover:text-ivory">{p.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <Section title={order === "release" ? "Timeline · release order" : "Timeline · chronological order"}>
        <p className="-mt-2 mb-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>Participation:</span>
          {Object.entries(PARTICIPATION_TONES).map(([type, tone]) => (
            <span key={type} className={`capitalize ${TONE_TEXT[tone]}`}>● {type}</span>
          ))}
        </p>
        {events.length === 0 ? (
          <Empty>No story events have been recorded for this title yet.</Empty>
        ) : (
          <ol className="relative space-y-6 border-l-2 border-line/70 pl-8 sm:pl-10">
            {events.map((e, i) => {
              const marker = MARKERS[i % MARKERS.length];
              return (
                <li key={e.event_id} className="relative">
                  <span
                    className={`absolute -left-[49px] top-3 grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-ink ring-4 ring-ink sm:-left-[57px] ${TONE_BG[marker]}`}
                  >
                    {order === "release" ? e.release_order : e.chronology_order}
                  </span>
                  <article className="card p-5">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="heading text-lg">{e.event_name}</h3>
                      <SpoilerBadge level={e.spoiler_level} />
                    </div>
                    <p className="mb-2 text-xs text-muted">
                      <span className={order === "chronology" ? "font-semibold text-ivory" : ""}>Chronology #{e.chronology_order}</span>
                      {" · "}
                      <span className={order === "release" ? "font-semibold text-ivory" : ""}>Release #{e.release_order}</span>
                    </p>
                    {e.description && <p className="mb-4 text-sm leading-relaxed text-ivory/80">{e.description}</p>}
                    {e.participants.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {e.participants.map((p) => {
                          const tone = PARTICIPATION_TONES[p.participation_type] ?? "default";
                          return (
                            <li key={p.character_id}>
                              <Link
                                href={`/characters/${p.character_id}`}
                                className="flex items-center gap-2 rounded-full bg-ink-2 py-1 pl-1 pr-3 ring-1 ring-line/60 transition hover:ring-accent"
                                title={p.involvement_description ?? undefined}
                              >
                                <Avatar name={p.name} universe={universe} size="h-8 w-8" tone={tone} />
                                <span className="text-sm font-medium">{p.name}</span>
                                <span className={`text-xs capitalize ${TONE_TEXT[tone]}`}>{p.participation_type}</span>
                                {p.outcome && <Badge tone={OUTCOME_TONES[p.outcome] ?? "default"}>{p.outcome}</Badge>}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title={`Character arcs (${arcs.length})`}>
        {arcs.length === 0 ? (
          <Empty>No character arcs recorded for this title.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {arcs.map((a) => (
              <ArcCard key={a.arc_id} arc={a} showCharacter universe={universe} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
