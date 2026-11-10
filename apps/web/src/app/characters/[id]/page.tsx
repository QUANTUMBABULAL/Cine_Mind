import Link from "next/link";
import { BookmarkButton } from "@/components/bookmark-button";
import { Backdrop, Poster } from "@/components/poster";
import {
  ArcCard,
  OUTCOME_TONES,
  OrderToggle,
  PARTICIPATION_TONES,
  RelationshipCard,
  SpoilerBadge,
  TONE_BG,
} from "@/components/story";
import { Badge, Empty, Section } from "@/components/ui";
import { MEDIA_LABELS, year } from "@/lib/api";
import { characterImage, titleImage } from "@/lib/images";
import { load } from "@/lib/server";
import type { CharacterDetail, TimelineEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CharacterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { id } = await params;
  const order = (await searchParams).order === "release" ? "release" : "chronology";
  const [c, timeline] = await Promise.all([
    load<CharacterDetail>(`/characters/${id}`),
    load<TimelineEntry[]>(`/characters/${id}/timeline?order=${order}`),
  ]);
  const portrait = characterImage(c.character_name, c.universe_name, c.image_url);
  const outgoing = c.relationships.filter((r) => r.direction === "outgoing");
  const incoming = c.relationships.filter((r) => r.direction === "incoming");

  return (
    <>
      <Backdrop src={portrait}>
        <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]">
          <div className="mx-auto w-52 md:w-full">
            <Poster src={portrait} label={c.character_name} ratio="portrait" rounded="rounded-2xl" />
          </div>
          <div className="flex flex-col">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">
              {c.universe_id ? (
                <Link href={`/universes/${c.universe_id}`} className="hover:text-ivory">
                  {c.universe_name} universe
                </Link>
              ) : (
                "Standalone"
              )}
            </p>
            <h1 className="heading text-4xl sm:text-5xl">{c.character_name}</h1>
            {c.biography && <p className="mt-4 max-w-2xl text-base leading-relaxed text-ivory/85">{c.biography}</p>}
            <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Species", c.species ?? "—", "text-ivory"],
                ["Gender", c.gender ?? "—", "text-ivory"],
                ["Appearances", String(c.appearance_count), "text-aqua"],
                ["Story events", String(c.event_count), "text-coral"],
              ].map(([k, v, tone]) => (
                <div key={k} className="rounded-xl bg-ink/60 p-3 ring-1 ring-line/60">
                  <dt className="label">{k}</dt>
                  <dd className={`truncate font-semibold ${tone}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-muted">First seen {c.first_appearance_date ?? "—"}</p>
            <div className="mt-5">
              <BookmarkButton characterId={c.character_id} />
            </div>
          </div>
        </div>
      </Backdrop>

      <Section title={`Appearances (${c.appearances.length})`}>
        {c.appearances.length === 0 ? (
          <Empty>No appearances recorded.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.appearances.map((a) => (
              <Link
                key={a.title_id}
                href={`/titles/${a.title_id}`}
                className="card group flex items-center gap-3 p-3 transition hover:ring-2 hover:ring-accent"
              >
                <div className="w-14 shrink-0">
                  <Poster src={titleImage(a.title_name)} label={a.title_name} rounded="rounded-md" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold group-hover:text-accent">{a.title_name}</p>
                  <p className="text-xs text-muted">
                    {year(a.release_date)} · {MEDIA_LABELS[a.media_type]}
                  </p>
                  <div className="mt-1.5">
                    <Badge tone={a.character_role === "protagonist" ? "accent" : a.character_role === "antagonist" ? "coral" : "aqua"}>
                      {a.character_role}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Relationships">
        <p className="mb-4 text-sm text-muted">
          Relationships are <strong className="text-ivory">directed</strong>: how {c.character_name} sees others can differ
          from how others see {c.character_name}.{" "}
          <span className="whitespace-nowrap">
            <span className="text-amber">● family</span> · <span className="text-aqua">● support</span> ·{" "}
            <span className="text-coral">● conflict</span> · <span className="text-accent">● other</span>
          </span>
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { label: `${c.character_name} → others`, rows: outgoing },
            { label: `Others → ${c.character_name}`, rows: incoming },
          ].map((group) => (
            <div key={group.label} className="min-w-0">
              <h3 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-accent">
                {group.label} <span className="chip">{group.rows.length}</span>
              </h3>
              {group.rows.length === 0 ? (
                <Empty>None recorded.</Empty>
              ) : (
                <ul className="space-y-2">
                  {group.rows.map((r) => (
                    <RelationshipCard key={r.relationship_id} r={r} universe={c.universe_name} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Story events" action={<OrderToggle basePath={`/characters/${c.character_id}`} order={order} />}>
        {timeline.length === 0 ? (
          <Empty>This character has not been linked to any story events yet.</Empty>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-line/70 pl-8">
            {timeline.map((e) => {
              const tone = PARTICIPATION_TONES[e.participation_type] ?? "default";
              return (
                <li key={e.event_id} className="relative">
                  <span
                    className={`absolute -left-[47px] top-3 grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-ink ring-4 ring-ink ${TONE_BG[tone]}`}
                  >
                    {order === "release" ? e.release_order : e.chronology_order}
                  </span>
                  <div className="card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{e.event_name}</p>
                      <SpoilerBadge level={e.spoiler_level} />
                    </div>
                    <p className="text-xs text-muted">{e.title_name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={tone}>{e.participation_type}</Badge>
                      {e.outcome && <Badge tone={OUTCOME_TONES[e.outcome] ?? "default"}>{e.outcome}</Badge>}
                    </div>
                    {e.involvement_description && <p className="mt-2 text-sm text-muted">{e.involvement_description}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title={`Character arcs (${c.arcs.length})`}>
        {c.arcs.length === 0 ? (
          <Empty>No arcs recorded.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {c.arcs.map((a) => (
              <ArcCard key={a.arc_id} arc={a} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
