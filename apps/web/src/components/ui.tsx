import Link from "next/link";
import { MEDIA_LABELS, year } from "@/lib/api";
import { characterImage, titleImage, universeImage, universeTone } from "@/lib/images";
import type { CharacterSummary, TitleSummary, Universe } from "@/lib/types";
import { Poster } from "./poster";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>}
      <h1 className="heading text-3xl sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 max-w-3xl leading-relaxed text-muted">{children}</div>}
    </header>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="heading text-xl sm:text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A horizontally scrolling row of cards (snap scrolling, scrollbar hidden). */
export function Shelf({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div key={i} className={`shrink-0 snap-start ${wide ? "w-72 sm:w-80" : "w-36 sm:w-44"}`}>
              {child}
            </div>
          ))
        : children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-panel/60 p-8 text-center text-sm text-muted">
      <span aria-hidden className="text-2xl text-accent/70">✦</span>
      <p>{children}</p>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/40">
      {message}
    </p>
  );
}

export function Stars({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-sm text-muted">No ratings yet</span>;
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${value} out of 5`}>
      <span className="tracking-tight text-amber">{"★".repeat(rounded)}</span>
      <span className="tracking-tight text-line">{"★".repeat(5 - rounded)}</span>
      <span className="ml-1 font-medium text-ivory/80">{Number(value).toFixed(1)}</span>
    </span>
  );
}

/** Small rating pill shown on top of a poster. */
function RatingPill({ value }: { value: number | null }) {
  if (value === null || value === undefined) return null;
  return (
    <span className="absolute right-2 top-2 rounded-full bg-ink/85 px-2 py-0.5 text-xs font-semibold text-amber backdrop-blur">
      ★ {Number(value).toFixed(1)}
    </span>
  );
}

export function TitleCard({ title }: { title: TitleSummary }) {
  const media = MEDIA_LABELS[title.media_type] ?? title.media_type;
  return (
    <Link href={`/titles/${title.title_id}`} className="group block focus-visible:outline-none">
      <div className="relative rounded-lg ring-accent transition group-hover:-translate-y-1 group-hover:ring-2 group-focus-visible:ring-2">
        <Poster src={titleImage(title.title_name, title.poster_url)} label={title.title_name} sub={media} zoom />
        <RatingPill value={title.average_rating} />
        <span className="absolute bottom-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {media}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-2 font-semibold leading-snug group-hover:text-accent">{title.title_name}</h3>
      <p className="text-xs text-muted">
        {year(title.release_date)} · {title.universe_name ?? "Standalone"}
      </p>
      {title.genres?.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {title.genres.slice(0, 2).map((g) => (
            <GenreBadge key={g} name={g} />
          ))}
        </div>
      )}
    </Link>
  );
}

export function CharacterCard({ character }: { character: CharacterSummary }) {
  return (
    <Link href={`/characters/${character.character_id}`} className="group block focus-visible:outline-none">
      <div className="relative overflow-hidden rounded-xl ring-aqua transition group-hover:-translate-y-1 group-hover:ring-2 group-focus-visible:ring-2">
        <Poster
          src={characterImage(character.character_name, character.universe_name, character.image_url)}
          label={character.character_name}
          ratio="portrait"
          rounded="rounded-xl"
          zoom
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/80 to-transparent px-3 pb-2.5 pt-8">
          <h3 className="truncate font-semibold leading-tight">{character.character_name}</h3>
          <p className={`truncate text-xs font-medium ${universeTone(character.universe_name)}`}>
            {character.universe_name ?? "Standalone"}
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {character.appearance_count} title{character.appearance_count === 1 ? "" : "s"} · {character.event_count} events
      </p>
    </Link>
  );
}

export function UniverseCard({ universe }: { universe: Universe }) {
  const img = universeImage(universe.name, universe.cover_image_url);
  return (
    <Link
      href={`/universes/${universe.universe_id}`}
      className="group relative flex h-full gap-4 overflow-hidden rounded-xl bg-panel p-4 ring-1 ring-line/60 transition hover:ring-2 hover:ring-accent"
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-xl" />
      )}
      <div className="relative w-24 shrink-0 sm:w-28">
        <Poster src={img} label={universe.name} rounded="rounded-lg" zoom />
      </div>
      <div className="relative flex min-w-0 flex-col">
        <span className="chip mb-2 self-start capitalize">From {universe.origin_type}</span>
        <h3 className="heading text-xl group-hover:text-accent">{universe.name}</h3>
        <p className="mt-1 line-clamp-3 text-sm text-muted">{universe.description}</p>
        <p className="mt-auto pt-3 text-sm">
          <strong className="text-aqua">{universe.title_count}</strong> <span className="text-muted">titles</span>
          <span className="mx-2 text-line">•</span>
          <strong className="text-coral">{universe.character_count}</strong> <span className="text-muted">characters</span>
        </p>
      </div>
    </Link>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{children}</div>;
}

export function CharacterGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{children}</div>;
}

export function SearchBar({ defaultValue = "", large = false }: { defaultValue?: string; large?: boolean }) {
  return (
    <form action="/search" className="flex w-full max-w-xl items-center gap-2" role="search">
      <div className="relative flex-1">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          ⌕
        </span>
        <input
          name="q"
          defaultValue={defaultValue}
          placeholder="Search titles, characters, universes…"
          className={`input rounded-full pl-10 ${large ? "py-3 text-base" : ""}`}
          aria-label="Search"
          required
        />
      </div>
      <button className={`btn-primary ${large ? "py-3" : ""}`}>Search</button>
    </form>
  );
}

type Tone = "default" | "accent" | "coral" | "aqua" | "amber" | "danger";
const TONES: Record<Tone, string> = {
  default: "bg-panel-2 text-muted",
  accent: "bg-accent/15 text-accent",
  coral: "bg-coral/15 text-coral",
  aqua: "bg-aqua/15 text-aqua",
  amber: "bg-amber/15 text-amber",
  danger: "bg-coral/15 text-coral",
};

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TONES[tone]}`}>{children}</span>;
}

// Each genre keeps the same colour everywhere.
const GENRE_TONES: Record<string, Tone> = {
  Action: "coral",
  Adventure: "amber",
  Drama: "accent",
  Fantasy: "accent",
  "Science Fiction": "aqua",
  Thriller: "coral",
  Political: "amber",
  "Coming-of-Age": "aqua",
};

export function GenreBadge({ name, href }: { name: string; href?: string }) {
  const badge = <Badge tone={GENRE_TONES[name] ?? "default"}>{name}</Badge>;
  return href ? (
    <Link href={href} className="transition hover:brightness-125">
      {badge}
    </Link>
  ) : (
    badge
  );
}
