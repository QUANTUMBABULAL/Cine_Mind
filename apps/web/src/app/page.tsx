import Link from "next/link";
import { Backdrop, Poster } from "@/components/poster";
import { CharacterCard, GenreBadge, SearchBar, Section, Shelf, TitleCard, UniverseCard } from "@/components/ui";
import { universeImage } from "@/lib/images";
import { load } from "@/lib/server";
import type { CharacterSummary, TitleSummary, Universe } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const [universes, topRated, latest, characters] = await Promise.all([
    load<Universe[]>("/universes"),
    load<TitleSummary[]>("/titles?sort=rating&limit=10"),
    load<TitleSummary[]>("/titles?sort=release&limit=10"),
    load<CharacterSummary[]>("/characters"),
  ]);

  // Game of Thrones is the main demonstration universe; fall back to the largest one.
  const featured =
    universes.find((u) => u.name === "Game of Thrones") ??
    [...universes].sort((a, b) => (b.title_count ?? 0) - (a.title_count ?? 0))[0];
  const featuredTitles = featured ? topRated.filter((t) => t.universe_id === featured.universe_id) : [];
  const featuredGenres = [...new Set(featuredTitles.flatMap((t) => t.genres))];
  const storyTitle = featuredTitles.find((t) => t.title_name === featured?.name) ?? featuredTitles[0];

  // "Popular" = most connected in the database: appearances plus story events.
  const popular = [...characters]
    .sort((a, b) => b.appearance_count + b.event_count - (a.appearance_count + a.event_count))
    .slice(0, 12);

  return (
    <>
      {featured && (
        <Backdrop src={universeImage(featured.name, featured.cover_image_url)}>
          <div className="grid items-center gap-8 p-6 sm:p-10 md:grid-cols-[1fr_220px] lg:grid-cols-[1fr_260px]">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-coral/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-coral">
                Featured universe
              </p>
              <h1 className="heading text-4xl leading-tight sm:text-6xl">{featured.name}</h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-ivory/80 sm:text-lg">{featured.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {featuredGenres.map((g) => (
                  <GenreBadge key={g} name={g} href={`/titles?genre=${encodeURIComponent(g)}`} />
                ))}
              </div>
              <p className="mt-4 text-sm text-muted">
                <strong className="text-aqua">{featured.title_count}</strong> titles ·{" "}
                <strong className="text-coral">{featured.character_count}</strong> characters
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/universes/${featured.universe_id}`} className="btn-primary px-6 py-2.5">
                  Explore universe
                </Link>
                <Link
                  href={storyTitle ? `/story?title_id=${storyTitle.title_id}` : "/story"}
                  className="btn-ghost px-6 py-2.5"
                >
                  Open Story Explorer →
                </Link>
              </div>
            </div>
            <div className="mx-auto hidden w-48 rotate-2 shadow-2xl shadow-accent/20 md:block md:w-full">
              <Poster src={universeImage(featured.name, featured.cover_image_url)} label={featured.name} rounded="rounded-xl" />
            </div>
          </div>
        </Backdrop>
      )}

      <section className="mb-12 flex flex-col items-start gap-4 rounded-2xl bg-panel p-6 ring-1 ring-line/60 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="heading text-xl">Find any story, character or world</h2>
          <p className="text-sm text-muted">Search across titles, characters and universes in the CineMind database.</p>
        </div>
        <SearchBar large />
      </section>

      <Section title="Popular universes" action={<Link href="/universes" className="link text-sm">All universes →</Link>}>
        <Shelf wide>
          {universes.map((u) => (
            <UniverseCard key={u.universe_id} universe={u} />
          ))}
        </Shelf>
      </Section>

      <Section title="Trending titles" action={<Link href="/titles?sort=rating" className="link text-sm">Highest rated →</Link>}>
        <Shelf>
          {topRated.map((t) => (
            <TitleCard key={t.title_id} title={t} />
          ))}
        </Shelf>
      </Section>

      <Section title="Popular characters" action={<Link href="/characters" className="link text-sm">All characters →</Link>}>
        <Shelf>
          {popular.map((c) => (
            <CharacterCard key={c.character_id} character={c} />
          ))}
        </Shelf>
      </Section>

      <Section title="Latest releases" action={<Link href="/titles?sort=release" className="link text-sm">Newest first →</Link>}>
        <Shelf>
          {latest.map((t) => (
            <TitleCard key={t.title_id} title={t} />
          ))}
        </Shelf>
      </Section>

      <section className="mb-4 grid items-center gap-6 rounded-2xl bg-gradient-to-r from-accent/25 via-panel to-aqua/15 p-6 ring-1 ring-line/60 sm:p-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-aqua">Story Explorer</p>
          <h2 className="heading text-2xl sm:text-3xl">Follow every turning point, in the order you choose.</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Switch between in-universe chronology and release order, see who took part in each event, and follow how
            characters change along their arcs.
          </p>
        </div>
        <Link href="/story" className="btn-primary px-6 py-3">
          Start exploring →
        </Link>
      </section>
    </>
  );
}
