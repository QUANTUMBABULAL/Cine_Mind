import { Empty, PageHeader, UniverseCard } from "@/components/ui";
import { load } from "@/lib/server";
import type { Universe } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Universes" };

export default async function UniversesPage() {
  const universes = await load<Universe[]>("/universes");
  return (
    <>
      <PageHeader eyebrow="Discover" title="Universes">
        Shared worlds that connect several titles. Standalone films such as Inception live outside any universe.
      </PageHeader>
      {universes.length === 0 ? (
        <Empty>No universes yet.</Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {universes.map((u) => (
            <UniverseCard key={u.universe_id} universe={u} />
          ))}
        </div>
      )}
    </>
  );
}
