import Link from "next/link";
import { characterImage } from "@/lib/images";
import type { Arc, Relationship } from "@/lib/types";
import { Poster } from "./poster";
import { Badge } from "./ui";

type Tone = "default" | "accent" | "coral" | "aqua" | "amber";

/** Toggle between in-universe (chronological) and release (narrative) order via the URL. */
export function OrderToggle({ basePath, order, extra = {} }: { basePath: string; order: string; extra?: Record<string, string> }) {
  const href = (o: string) => `${basePath}?${new URLSearchParams({ ...extra, order: o })}`;
  return (
    <div className="inline-flex rounded-full bg-ink-2 p-1 text-sm ring-1 ring-line/60" role="group" aria-label="Event order">
      {[
        ["chronology", "Chronological"],
        ["release", "Release order"],
      ].map(([value, label]) => (
        <Link
          key={value}
          href={href(value)}
          scroll={false}
          aria-current={order === value ? "true" : undefined}
          className={`rounded-full px-4 py-1.5 font-medium transition ${
            order === value ? "bg-accent text-white" : "text-muted hover:text-ivory"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function SpoilerBadge({ level }: { level: string }) {
  if (level === "none") return null;
  return <Badge tone={level === "major" ? "coral" : "amber"}>{level} spoiler</Badge>;
}

// Relationship colours: family amber, support aqua, conflict coral, everything else violet.
const RELATION_TONES: Record<string, Tone> = {
  "Parent Of": "amber",
  "Guardian Of": "amber",
  "Sibling Of": "amber",
  "Mentor Of": "aqua",
  "Ally Of": "aqua",
  Serves: "aqua",
  "Rival Of": "coral",
  "Enemy Of": "coral",
  Betrayed: "coral",
  Loves: "accent",
};
export const relationTone = (type: string): Tone => RELATION_TONES[type] ?? "accent";

const RING: Record<Tone, string> = {
  default: "ring-line",
  accent: "ring-accent",
  coral: "ring-coral",
  aqua: "ring-aqua",
  amber: "ring-amber",
};
const TEXT: Record<Tone, string> = {
  default: "text-muted",
  accent: "text-accent",
  coral: "text-coral",
  aqua: "text-aqua",
  amber: "text-amber",
};

export const PARTICIPATION_TONES: Record<string, Tone> = {
  central: "accent",
  supporting: "aqua",
  perpetrator: "coral",
  victim: "amber",
  witness: "default",
};
export const OUTCOME_TONES: Record<string, Tone> = {
  died: "coral",
  injured: "coral",
  defeated: "coral",
  victorious: "amber",
  survived: "aqua",
  escaped: "aqua",
  transformed: "accent",
};

/** Round character portrait with a coloured ring. */
export function Avatar({ name, universe, size = "h-10 w-10", tone = "default" }: { name: string; universe: string | null; size?: string; tone?: Tone }) {
  return (
    <span className={`block shrink-0 overflow-hidden rounded-full ring-2 ${RING[tone]} ${size}`}>
      <Poster src={characterImage(name, universe)} label={name} ratio="square" rounded="rounded-full" initialsClass="text-xs" />
    </span>
  );
}

/** One directed relationship: source → type → target, with both portraits. */
export function RelationshipCard({ r, universe }: { r: Relationship; universe: string | null }) {
  const tone = relationTone(r.relationship_type);
  return (
    <li className="card p-3">
      <div className="flex items-center gap-2">
        <Link href={`/characters/${r.source_id}`} className="flex min-w-0 items-center gap-2 hover:text-accent">
          <Avatar name={r.source_name} universe={universe} size="h-9 w-9" tone={tone} />
          <span className="truncate text-sm font-medium">{r.source_name}</span>
        </Link>
        <span className={`flex shrink-0 flex-col items-center px-1 text-[10px] font-bold uppercase tracking-wide ${TEXT[tone]}`}>
          {r.relationship_type}
          <span aria-hidden className="text-base leading-none">⟶</span>
        </span>
        <Link href={`/characters/${r.target_id}`} className="ml-auto flex min-w-0 items-center gap-2 hover:text-accent">
          <span className="truncate text-right text-sm font-medium">{r.target_name}</span>
          <Avatar name={r.target_name} universe={universe} size="h-9 w-9" tone={tone} />
        </Link>
      </div>
      {r.description && <p className="mt-2 text-xs text-muted">{r.description}</p>}
    </li>
  );
}

/** An arc drawn as a start state → ordered events → end state, with a progress bar. */
export function ArcCard({ arc, showCharacter = false, universe = null }: { arc: Arc; showCharacter?: boolean; universe?: string | null }) {
  const done = arc.arc_status === "completed";
  // One segment per recorded step plus the ending; the ending fills only when the arc is completed.
  const segments = arc.steps.length + 1;
  const filled = arc.steps.length + (done ? 1 : 0);
  return (
    <article className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {showCharacter && <Avatar name={arc.character_name} universe={universe} size="h-11 w-11" tone="accent" />}
          <div className="min-w-0">
            <h3 className="heading text-lg">{arc.arc_name}</h3>
            <p className="text-xs text-muted">
              {showCharacter && (
                <>
                  <Link href={`/characters/${arc.character_id}`} className="link">{arc.character_name}</Link> ·{" "}
                </>
              )}
              <Link href={`/titles/${arc.title_id}`} className="hover:text-ivory">{arc.title_name}</Link>
            </p>
          </div>
        </div>
        <Badge tone={done ? "aqua" : "amber"}>{arc.arc_status}</Badge>
      </div>

      <div className="mb-4" aria-label={`${filled} of ${segments} arc stages reached`}>
        <div className="flex gap-1">
          {Array.from({ length: segments }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < filled ? (done ? "bg-aqua" : "bg-accent") : "bg-line"}`} />
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {filled} of {segments} stages{done ? " · arc complete" : " · in progress"}
        </p>
      </div>

      {arc.description && <p className="mb-4 text-sm text-muted">{arc.description}</p>}
      <ol className="relative space-y-3 border-l-2 border-line pl-5">
        <li>
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-line" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Starting state</p>
          <p className="text-sm">{arc.starting_state ?? "—"}</p>
        </li>
        {arc.steps.map((s) => (
          <li key={s.event_id}>
            <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-accent" />
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Step {s.sequence_number}</p>
            <p className="text-sm font-medium">{s.event_name}</p>
            {s.development_note && <p className="text-sm text-muted">{s.development_note}</p>}
          </li>
        ))}
        <li>
          <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ${done ? "bg-aqua" : "border-2 border-aqua bg-ink"}`} />
          <p className="text-xs font-semibold uppercase tracking-wide text-aqua">Ending state</p>
          <p className="text-sm">{arc.ending_state ?? "—"}</p>
        </li>
      </ol>
    </article>
  );
}

export const TONE_BG: Record<Tone, string> = {
  default: "bg-muted",
  accent: "bg-accent",
  coral: "bg-coral",
  aqua: "bg-aqua",
  amber: "bg-amber",
};
export { TEXT as TONE_TEXT };
