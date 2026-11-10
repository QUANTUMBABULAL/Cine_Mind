"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AuditPanel,
  CharactersPanel,
  EventsPanel,
  GenresPanel,
  RelationshipsPanel,
  TitlesPanel,
  UniversesPanel,
  UsersPanel,
  useLookups,
} from "@/components/admin/panels";
import { Empty, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const TABS = [
  { id: "overview", label: "Overview", permission: "content.manage" },
  { id: "universes", label: "Universes", permission: "content.manage" },
  { id: "titles", label: "Titles", permission: "content.manage" },
  { id: "characters", label: "Characters", permission: "content.manage" },
  { id: "relationships", label: "Relationships", permission: "content.manage" },
  { id: "events", label: "Story events", permission: "content.manage" },
  { id: "genres", label: "Genres", permission: "content.manage" },
  { id: "users", label: "Users & roles", permission: "users.manage" },
  { id: "audit", label: "Audit log", permission: "audit.view" },
] as const;

export default function AdminPage() {
  const { user, ready, can, token } = useAuth();
  const allowed = TABS.filter((t) => can(t.permission));
  const [tab, setTab] = useState<string>("overview");
  const { lookups, reload } = useLookups();
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (token && can("content.manage") && tab === "overview") {
      apiFetch<Record<string, number>>("/admin/stats", { token }).then(setStats).catch(() => undefined);
    }
  }, [token, can, tab]);

  if (!ready) return null;
  if (!user) {
    return <Empty><Link href="/login" className="link">Log in</Link> with an administrator account.</Empty>;
  }
  // The UI hides admin tools from non-admins; the API independently returns 403.
  if (allowed.length === 0) {
    return <Empty>Access denied. The Admin role is required for this page.</Empty>;
  }
  const active = allowed.find((t) => t.id === tab) ?? allowed[0];

  return (
    <>
      <PageHeader eyebrow="Administration" title="Content & user management" />
      <div className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {allowed.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              active.id === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ivory"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!lookups && active.id !== "users" && active.id !== "audit" ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          {active.id === "overview" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats &&
                Object.entries(stats).map(([k, v]) => (
                  <div key={k} className="card p-4">
                    <p className="label">{k.replace("_", " ")}</p>
                    <p className="heading text-3xl text-accent">{v}</p>
                  </div>
                ))}
            </div>
          )}
          {active.id === "universes" && <UniversesPanel onChange={reload} />}
          {active.id === "titles" && lookups && <TitlesPanel lookups={lookups} onChange={reload} />}
          {active.id === "characters" && lookups && <CharactersPanel lookups={lookups} onChange={reload} />}
          {active.id === "relationships" && lookups && <RelationshipsPanel lookups={lookups} />}
          {active.id === "events" && lookups && <EventsPanel lookups={lookups} />}
          {active.id === "genres" && <GenresPanel />}
          {active.id === "users" && <UsersPanel />}
          {active.id === "audit" && <AuditPanel />}
        </>
      )}
    </>
  );
}
