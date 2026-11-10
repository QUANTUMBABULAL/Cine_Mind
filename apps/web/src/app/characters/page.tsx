import { CharacterCard, CharacterGrid, Empty, PageHeader } from "@/components/ui";
import { universeTone } from "@/lib/images";
import { load } from "@/lib/server";
import type { CharacterSummary, Universe } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Characters" };

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; universe_id?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.universe_id) qs.set("universe_id", sp.universe_id);
  const [characters, universes] = await Promise.all([
    load<CharacterSummary[]>(`/characters?${qs}`),
    load<Universe[]>("/universes"),
  ]);

  // Group by universe for readability.
  const groups = new Map<string, CharacterSummary[]>();
  for (const c of characters) {
    const key = c.universe_name ?? "Standalone titles";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Characters">
        Names are unique within a universe, so the same name may exist in different worlds.
      </PageHeader>
      <form className="card mb-8 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="q">Name</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" placeholder="e.g. Stark" />
        </div>
        <div>
          <label className="label" htmlFor="universe_id">Universe</label>
          <select id="universe_id" name="universe_id" defaultValue={sp.universe_id ?? ""} className="input">
            <option value="">All universes</option>
            {universes.map((u) => (
              <option key={u.universe_id} value={u.universe_id}>{u.name}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Filter</button>
      </form>

      {characters.length === 0 ? (
        <Empty>No characters match.</Empty>
      ) : (
        [...groups.entries()].map(([universe, list]) => (
          <section key={universe} className="mb-10">
            <h2 className="heading mb-4 flex items-center gap-3 text-xl">
              <span aria-hidden className={`text-base ${universeTone(list[0].universe_name)}`}>●</span>
              {universe}
              <span className="chip">{list.length}</span>
            </h2>
            <CharacterGrid>
              {list.map((c) => (
                <CharacterCard key={c.character_id} character={c} />
              ))}
            </CharacterGrid>
          </section>
        ))
      )}
    </>
  );
}
