import Link from "next/link";
import { Poster } from "@/components/poster";
import { Empty, PageHeader, SearchBar, Section } from "@/components/ui";
import { MEDIA_LABELS, year } from "@/lib/api";
import { characterImage, titleImage, universeImage, universeTone } from "@/lib/images";
import { load } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

interface Results {
  titles: { title_id: number; title_name: string; media_type: string; release_date: string | null; universe_name: string | null }[];
  characters: { character_id: number; character_name: string; universe_name: string | null }[];
  universes: { universe_id: number; name: string }[];
}

function ResultRow({ href, image, label, ratio, sub, subClass = "text-muted" }: {
  href: string;
  image: string | null;
  label: string;
  ratio: "poster" | "square";
  sub: string;
  subClass?: string;
}) {
  return (
    <li>
      <Link href={href} className="card group flex items-center gap-3 p-2.5 transition hover:ring-2 hover:ring-accent">
        <div className="w-11 shrink-0">
          <Poster src={image} label={label} ratio={ratio} rounded={ratio === "square" ? "rounded-full" : "rounded-md"} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold group-hover:text-accent">{label}</p>
          <p className={`truncate text-xs ${subClass}`}>{sub}</p>
        </div>
      </Link>
    </li>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const results = q ? await load<Results>(`/search?q=${encodeURIComponent(q)}`) : null;
  const total = results ? results.titles.length + results.characters.length + results.universes.length : 0;

  return (
    <>
      <PageHeader eyebrow="Search" title={q ? `Results for “${q}”` : "Search"}>
        {results && `${total} match${total === 1 ? "" : "es"} across titles, characters and universes.`}
      </PageHeader>
      <div className="mb-10">
        <SearchBar defaultValue={q} large />
      </div>
      {!results ? (
        <Empty>Type a title, character or universe name.</Empty>
      ) : total === 0 ? (
        <Empty>Nothing matched “{q}”. Try a shorter word, such as “Stark” or “Matrix”.</Empty>
      ) : (
        <div className="grid gap-8 md:grid-cols-3">
          <Section title={`Titles (${results.titles.length})`}>
            <ul className="space-y-2">
              {results.titles.map((t) => (
                <ResultRow
                  key={t.title_id}
                  href={`/titles/${t.title_id}`}
                  image={titleImage(t.title_name)}
                  label={t.title_name}
                  ratio="poster"
                  sub={`${year(t.release_date)} · ${MEDIA_LABELS[t.media_type]} · ${t.universe_name ?? "Standalone"}`}
                />
              ))}
            </ul>
          </Section>
          <Section title={`Characters (${results.characters.length})`}>
            <ul className="space-y-2">
              {results.characters.map((c) => (
                <ResultRow
                  key={c.character_id}
                  href={`/characters/${c.character_id}`}
                  image={characterImage(c.character_name, c.universe_name)}
                  label={c.character_name}
                  ratio="square"
                  sub={c.universe_name ?? "Standalone"}
                  subClass={universeTone(c.universe_name)}
                />
              ))}
            </ul>
          </Section>
          <Section title={`Universes (${results.universes.length})`}>
            <ul className="space-y-2">
              {results.universes.map((u) => (
                <ResultRow
                  key={u.universe_id}
                  href={`/universes/${u.universe_id}`}
                  image={universeImage(u.name)}
                  label={u.name}
                  ratio="poster"
                  sub="Universe"
                />
              ))}
            </ul>
          </Section>
        </div>
      )}
    </>
  );
}
