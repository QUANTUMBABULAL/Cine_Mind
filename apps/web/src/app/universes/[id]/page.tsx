import Link from "next/link";
import { Backdrop, Poster } from "@/components/poster";
import { CharacterCard, CharacterGrid, Empty, GenreBadge, Grid, Section, TitleCard } from "@/components/ui";
import { universeImage } from "@/lib/images";
import { load } from "@/lib/server";
import type { CharacterSummary, TitleSummary, Universe } from "@/lib/types";

export const dynamic = "force-dynamic";

type UniverseDetail = Universe & {
  titles: TitleSummary[];
  characters: (Omit<CharacterSummary, "universe_name" | "universe_id" | "gender">)[];
};

export default async function UniverseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await load<UniverseDetail>(`/universes/${id}`);
  const cover = universeImage(u.name, u.cover_image_url);
  const genres = [...new Set(u.titles.flatMap((t) => t.genres))];
  // Most connected characters first: they are the "important" ones of this world.
  const characters = [...u.characters].sort(
    (a, b) => b.appearance_count + b.event_count - (a.appearance_count + a.event_count),
  );

  return (
    <>
      <Backdrop src={cover}>
        <div className="grid items-center gap-6 p-6 sm:grid-cols-[180px_1fr] sm:p-10 lg:grid-cols-[220px_1fr]">
          <div className="mx-auto w-40 sm:w-full">
            <Poster src={cover} label={u.name} rounded="rounded-xl" />
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">
              Universe · from {u.origin_type}
            </p>
            <h1 className="heading text-4xl sm:text-5xl">{u.name}</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-ivory/80">{u.description}</p>
            {genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <GenreBadge key={g} name={g} href={`/titles?genre=${encodeURIComponent(g)}`} />
                ))}
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <span>
                <strong className="text-2xl text-aqua">{u.titles.length}</strong> <span className="text-muted">titles</span>
              </span>
              <span>
                <strong className="text-2xl text-coral">{u.characters.length}</strong>{" "}
                <span className="text-muted">characters</span>
              </span>
              {u.titles[0] && (
                <Link href={`/story?title_id=${u.titles[0].title_id}`} className="btn-primary">
                  Open in Story Explorer
                </Link>
              )}
            </div>
          </div>
        </div>
      </Backdrop>

      <Section title={`Titles (${u.titles.length})`}>
        {u.titles.length === 0 ? (
          <Empty>No titles in this universe yet.</Empty>
        ) : (
          <Grid>
            {u.titles.map((t) => (
              <TitleCard key={t.title_id} title={t} />
            ))}
          </Grid>
        )}
      </Section>

      <Section title={`Characters (${u.characters.length})`}>
        {characters.length === 0 ? (
          <Empty>No characters yet.</Empty>
        ) : (
          <CharacterGrid>
            {characters.map((c) => (
              <CharacterCard
                key={c.character_id}
                character={{ ...c, universe_id: u.universe_id, universe_name: u.name, gender: null }}
              />
            ))}
          </CharacterGrid>
        )}
      </Section>
    </>
  );
}
