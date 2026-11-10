"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, errorText, MEDIA_LABELS, year } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CharacterSummary, StoryEvent, TitleDetail, TitleSummary, Universe } from "@/lib/types";
import { Badge, Empty, ErrorNote } from "../ui";
import { CrudPanel, type CrudConfig, FieldInput } from "./crud-panel";

// ---------------------------------------------------------------------------
// Lookup data shared by the forms (universes, titles, genres, characters, types).
// ---------------------------------------------------------------------------
interface Lookups {
  universes: Universe[];
  titles: TitleSummary[];
  genres: { genre_id: number; name: string }[];
  characters: CharacterSummary[];
  relationshipTypes: { relationship_type_id: number; name: string }[];
}

export function useLookups() {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    Promise.all([
      apiFetch<Universe[]>("/universes"),
      apiFetch<TitleSummary[]>("/titles?sort=name"),
      apiFetch<Lookups["genres"]>("/genres"),
      apiFetch<CharacterSummary[]>("/characters"),
      apiFetch<Lookups["relationshipTypes"]>("/relationship-types"),
    ]).then(([universes, titles, genres, characters, relationshipTypes]) =>
      setLookups({ universes, titles, genres, characters, relationshipTypes }),
    );
  }, [version]);
  return { lookups, reload: useCallback(() => setVersion((v) => v + 1), []) };
}

const opts = <T,>(rows: T[], value: (r: T) => number | string, label: (r: T) => string) =>
  rows.map((r) => ({ value: value(r), label: label(r) }));

const characterLabel = (c: CharacterSummary) => `${c.character_name} (${c.universe_name ?? "Standalone"})`;

// ---------------------------------------------------------------------------
// Simple CRUD resources
// ---------------------------------------------------------------------------
export function UniversesPanel({ onChange }: { onChange: () => void }) {
  const config = useMemo<CrudConfig<Universe>>(
    () => ({
      endpoint: "/admin/universes",
      idKey: "universe_id",
      load: () => apiFetch<Universe[]>("/universes"),
      onSaved: onChange,
      columns: [
        { label: "Name", render: (u) => <Link href={`/universes/${u.universe_id}`} className="link">{u.name}</Link> },
        { label: "Origin", render: (u) => u.origin_type },
        { label: "Titles", render: (u) => u.title_count },
        { label: "Characters", render: (u) => u.character_count },
      ],
      fields: [
        { name: "name", label: "Name", required: true },
        {
          name: "origin_type",
          label: "Origin",
          type: "select",
          required: true,
          options: ["manga", "novel", "film", "tv", "comic", "game", "original"].map((v) => ({ value: v, label: v })),
        },
        { name: "description", label: "Description", type: "textarea" },
        { name: "cover_image_url", label: "Cover image URL", placeholder: "https://…" },
      ],
      emptyForm: { origin_type: "original" },
    }),
    [onChange],
  );
  return <CrudPanel config={config} />;
}

export function GenresPanel() {
  const config = useMemo<CrudConfig<{ genre_id: number; name: string; description: string | null; title_count: number }>>(
    () => ({
      endpoint: "/admin/genres",
      idKey: "genre_id",
      load: () => apiFetch("/genres"),
      columns: [
        { label: "Name", render: (g) => g.name },
        { label: "Description", render: (g) => <span className="text-muted">{g.description}</span> },
        { label: "Titles", render: (g) => g.title_count },
      ],
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "description", label: "Description", type: "textarea" },
      ],
    }),
    [],
  );
  return <CrudPanel config={config} />;
}

export function TitlesPanel({ lookups, onChange }: { lookups: Lookups; onChange: () => void }) {
  const config = useMemo<CrudConfig<TitleSummary>>(
    () => ({
      endpoint: "/admin/titles",
      idKey: "title_id",
      load: () => apiFetch<TitleSummary[]>("/titles?sort=name"),
      onSaved: onChange,
      columns: [
        { label: "Title", render: (t) => <Link href={`/titles/${t.title_id}`} className="link">{t.title_name}</Link> },
        { label: "Type", render: (t) => MEDIA_LABELS[t.media_type] },
        { label: "Universe", render: (t) => t.universe_name ?? <span className="text-muted">Standalone</span> },
        { label: "Year", render: (t) => year(t.release_date) },
        { label: "Genres", render: (t) => <span className="text-muted">{t.genres.join(", ")}</span> },
      ],
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "universe_id", label: "Universe (empty = standalone)", type: "select", options: opts(lookups.universes, (u) => u.universe_id, (u) => u.name) },
        { name: "media_type", label: "Media type", type: "select", required: true, options: Object.entries(MEDIA_LABELS).map(([value, label]) => ({ value, label })) },
        { name: "status", label: "Status", type: "select", required: true, options: ["upcoming", "released", "ongoing", "completed"].map((v) => ({ value: v, label: v })) },
        { name: "release_date", label: "Release date", type: "date" },
        { name: "poster_url", label: "Poster URL", placeholder: "https://…" },
        { name: "banner_url", label: "Banner URL", placeholder: "https://…" },
        { name: "synopsis", label: "Synopsis", type: "textarea" },
        { name: "genre_ids", label: "Genres", type: "checkboxes", options: opts(lookups.genres, (g) => g.genre_id, (g) => g.name) },
      ],
      emptyForm: { media_type: "movie", status: "released", genre_ids: [] },
      toForm: async (t) => {
        const full = await apiFetch<TitleDetail>(`/titles/${t.title_id}`);
        return {
          ...full,
          name: full.title_name,
          genre_ids: lookups.genres.filter((g) => full.genres.includes(g.name)).map((g) => g.genre_id),
        };
      },
    }),
    [lookups, onChange],
  );
  return <CrudPanel config={config} />;
}

export function CharactersPanel({ lookups, onChange }: { lookups: Lookups; onChange: () => void }) {
  const config = useMemo<CrudConfig<CharacterSummary>>(
    () => ({
      endpoint: "/admin/characters",
      idKey: "character_id",
      load: () => apiFetch<CharacterSummary[]>("/characters"),
      onSaved: onChange,
      columns: [
        { label: "Name", render: (c) => <Link href={`/characters/${c.character_id}`} className="link">{c.character_name}</Link> },
        { label: "Universe", render: (c) => c.universe_name ?? <span className="text-muted">Standalone</span> },
        { label: "Titles", render: (c) => c.appearance_count },
        { label: "Events", render: (c) => c.event_count },
      ],
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "universe_id", label: "Universe (empty = standalone)", type: "select", options: opts(lookups.universes, (u) => u.universe_id, (u) => u.name) },
        { name: "species", label: "Species" },
        { name: "gender", label: "Gender" },
        { name: "first_appearance_date", label: "First appearance", type: "date" },
        { name: "image_url", label: "Image URL", placeholder: "https://…" },
        { name: "biography", label: "Biography", type: "textarea" },
      ],
      toForm: async (c) => {
        const full = await apiFetch<Record<string, unknown>>(`/characters/${c.character_id}`);
        return { ...full, name: full.character_name };
      },
    }),
    [lookups, onChange],
  );
  return (
    <div className="space-y-10">
      <CrudPanel config={config} />
      <AppearancesPanel lookups={lookups} />
    </div>
  );
}

interface RelRow {
  relationship_id: number;
  source_character_id: number;
  source_name: string;
  target_character_id: number;
  target_name: string;
  relationship_type_id: number;
  relationship_type: string;
  description: string | null;
  universe_name: string | null;
}

export function RelationshipsPanel({ lookups }: { lookups: Lookups }) {
  const { token } = useAuth();
  const config = useMemo<CrudConfig<RelRow>>(
    () => ({
      endpoint: "/admin/relationships",
      idKey: "relationship_id",
      load: () => apiFetch<RelRow[]>("/admin/relationships", { token }),
      columns: [
        { label: "Source", render: (r) => r.source_name },
        { label: "Relationship", render: (r) => <span className="text-accent">→ {r.relationship_type} →</span> },
        { label: "Target", render: (r) => r.target_name },
        { label: "Universe", render: (r) => <span className="text-muted">{r.universe_name ?? "Standalone"}</span> },
      ],
      fields: [
        { name: "source_character_id", label: "Source character", type: "select", required: true, options: opts(lookups.characters, (c) => c.character_id, characterLabel) },
        { name: "relationship_type_id", label: "Relationship type", type: "select", required: true, options: opts(lookups.relationshipTypes, (t) => t.relationship_type_id, (t) => t.name) },
        { name: "target_character_id", label: "Target character", type: "select", required: true, options: opts(lookups.characters, (c) => c.character_id, characterLabel) },
        { name: "description", label: "Description", type: "textarea" },
      ],
    }),
    [lookups, token],
  );
  return (
    <>
      <p className="mb-4 text-sm text-muted">
        Relationships are directed (source → target). Both characters must belong to the same universe, and a
        character cannot relate to itself — the database rejects violations.
      </p>
      <CrudPanel config={config} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Appearances (character ↔ title)
// ---------------------------------------------------------------------------
function AppearancesPanel({ lookups }: { lookups: Lookups }) {
  const { token } = useAuth();
  const [characterId, setCharacterId] = useState("");
  const [rows, setRows] = useState<{ title_id: number; title_name: string; character_role: string }[]>([]);
  const [form, setForm] = useState({ title_id: "", character_role: "supporting", appearance_notes: "" });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!characterId) return setRows([]);
    apiFetch(`/characters/${characterId}/appearances`).then(setRows).catch((e) => setError(errorText(e)));
  }, [characterId]);
  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/admin/appearances", {
        method: "POST",
        token,
        body: { character_id: Number(characterId), title_id: Number(form.title_id), character_role: form.character_role, appearance_notes: form.appearance_notes },
      });
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function remove(titleId: number) {
    setError("");
    try {
      await apiFetch(`/admin/appearances/${characterId}/${titleId}`, { method: "DELETE", token });
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <section>
      <h3 className="heading mb-2 text-lg">Character appearances</h3>
      <p className="mb-3 text-sm text-muted">
        A character must appear in a title before it can take part in that title&apos;s events or arcs.
      </p>
      <div className="card space-y-4 p-4">
        <select className="input max-w-md" value={characterId} onChange={(e) => setCharacterId(e.target.value)} aria-label="Character">
          <option value="">Select a character…</option>
          {lookups.characters.map((c) => (
            <option key={c.character_id} value={c.character_id}>{characterLabel(c)}</option>
          ))}
        </select>
        {characterId && (
          <>
            <ul className="space-y-1 text-sm">
              {rows.length === 0 && <li className="text-muted">No appearances yet.</li>}
              {rows.map((r) => (
                <li key={r.title_id} className="flex items-center gap-3">
                  <span>{r.title_name}</span>
                  <Badge>{r.character_role}</Badge>
                  <button className="text-xs text-danger" onClick={() => remove(r.title_id)}>Remove</button>
                </li>
              ))}
            </ul>
            <form onSubmit={add} className="flex flex-wrap items-end gap-2">
              <select className="input w-64" required value={form.title_id} onChange={(e) => setForm({ ...form, title_id: e.target.value })} aria-label="Title">
                <option value="">Title…</option>
                {lookups.titles.map((t) => (
                  <option key={t.title_id} value={t.title_id}>{t.title_name}</option>
                ))}
              </select>
              <select className="input w-40" value={form.character_role} onChange={(e) => setForm({ ...form, character_role: e.target.value })} aria-label="Role">
                {["protagonist", "antagonist", "supporting", "minor", "cameo"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <input className="input w-60" placeholder="Notes (optional)" value={form.appearance_notes} onChange={(e) => setForm({ ...form, appearance_notes: e.target.value })} />
              <button className="btn-primary">Add appearance</button>
            </form>
          </>
        )}
        {error && <ErrorNote message={error} />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Story events (created via the add_story_event stored procedure)
// ---------------------------------------------------------------------------
const PARTICIPATION = ["central", "supporting", "victim", "perpetrator", "witness"];

export function EventsPanel({ lookups }: { lookups: Lookups }) {
  const { token } = useAuth();
  const titlesWithCast = lookups.titles.filter((t) => t.character_count > 0);
  const defaultTitle = titlesWithCast.find((t) => t.title_name === "Game of Thrones") ?? titlesWithCast[0];
  const [titleId, setTitleId] = useState(String(defaultTitle?.title_id ?? ""));
  const [events, setEvents] = useState<StoryEvent[]>([]);
  const [cast, setCast] = useState<TitleDetail["characters"]>([]);
  const [editing, setEditing] = useState<{ id: number | null; values: Record<string, unknown> } | null>(null);
  const [participants, setParticipants] = useState<Record<number, string>>({});
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!titleId) return;
    Promise.all([apiFetch<StoryEvent[]>(`/titles/${titleId}/events`), apiFetch<TitleDetail>(`/titles/${titleId}`)])
      .then(([ev, t]) => {
        setEvents(ev);
        setCast(t.characters);
      })
      .catch((e) => setError(errorText(e)));
  }, [titleId]);
  useEffect(load, [load]);

  const fields = [
    { name: "event_name", label: "Event name", required: true },
    { name: "spoiler_level", label: "Spoiler level", type: "select" as const, required: true, options: ["none", "minor", "major"].map((v) => ({ value: v, label: v })) },
    { name: "chronology_order", label: "Chronology order (empty = append)", type: "number" as const },
    { name: "release_order", label: "Release order (empty = append)", type: "number" as const },
    { name: "description", label: "Description", type: "textarea" as const },
  ];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    const v = editing.values;
    const num = (x: unknown) => (x === "" || x === null || x === undefined ? null : Number(x));
    try {
      if (editing.id) {
        await apiFetch(`/admin/events/${editing.id}`, {
          method: "PUT",
          token,
          body: { event_name: v.event_name, description: v.description, spoiler_level: v.spoiler_level, chronology_order: num(v.chronology_order), release_order: num(v.release_order) },
        });
      } else {
        await apiFetch("/admin/events", {
          method: "POST",
          token,
          body: {
            title_id: Number(titleId),
            event_name: v.event_name,
            description: v.description,
            spoiler_level: v.spoiler_level,
            chronology_order: num(v.chronology_order),
            release_order: num(v.release_order),
            participants: Object.entries(participants).map(([id, type]) => ({ character_id: Number(id), participation_type: type })),
          },
        });
      }
      setEditing(null);
      setParticipants({});
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function remove(id: number) {
    try {
      await apiFetch(`/admin/events/${id}`, { method: "DELETE", token });
      setConfirmId(null);
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64">
          <label className="label" htmlFor="ev-title">Title</label>
          <select id="ev-title" className="input" value={titleId} onChange={(e) => { setTitleId(e.target.value); setEditing(null); }}>
            {titlesWithCast.map((t) => (
              <option key={t.title_id} value={t.title_id}>{t.title_name}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={() => { setEditing({ id: null, values: { spoiler_level: "none" } }); setParticipants({}); }}>
          + New event
        </button>
      </div>
      {error && <ErrorNote message={error} />}

      {editing && (
        <form onSubmit={save} className="card grid gap-4 border-accent/50 p-5 sm:grid-cols-2">
          <p className="heading text-lg sm:col-span-2">
            {editing.id ? `Edit event #${editing.id}` : "New event — saved with CALL add_story_event(...)"}
          </p>
          {fields.map((f) => (
            <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className="label" htmlFor={`f-${f.name}`}>{f.label}</label>
              <FieldInput field={f} value={editing.values[f.name]} onChange={(val) => setEditing({ ...editing, values: { ...editing.values, [f.name]: val } })} />
            </div>
          ))}
          {!editing.id && (
            <div className="sm:col-span-2">
              <p className="label">Participants (only characters appearing in this title)</p>
              {cast.length === 0 ? (
                <p className="text-sm text-muted">Add appearances for this title first.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {cast.map((c) => (
                    <div key={c.character_id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-accent"
                        id={`p-${c.character_id}`}
                        checked={c.character_id in participants}
                        onChange={(e) => {
                          const next = { ...participants };
                          if (e.target.checked) next[c.character_id] = "central";
                          else delete next[c.character_id];
                          setParticipants(next);
                        }}
                      />
                      <label htmlFor={`p-${c.character_id}`} className="flex-1">{c.name}</label>
                      {c.character_id in participants && (
                        <select
                          className="input w-32 py-1"
                          aria-label={`Participation of ${c.name}`}
                          value={participants[c.character_id]}
                          onChange={(e) => setParticipants({ ...participants, [c.character_id]: e.target.value })}
                        >
                          {PARTICIPATION.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary">{editing.id ? "Save changes" : "Create event"}</button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <Empty>No events for this title.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Chrono</th>
                <th className="px-3 py-2">Release</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Participants</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.event_id} className="border-b border-line/50 last:border-0">
                  <td className="px-3 py-2">{e.chronology_order}</td>
                  <td className="px-3 py-2">{e.release_order}</td>
                  <td className="px-3 py-2">{e.event_name}</td>
                  <td className="px-3 py-2 text-muted">{e.participants.map((p) => p.name).join(", ")}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button className="link mr-3 text-xs" onClick={() => setEditing({ id: e.event_id, values: { ...e } })}>Edit</button>
                    {confirmId === e.event_id ? (
                      <button className="text-xs text-danger" onClick={() => remove(e.event_id)}>Confirm delete</button>
                    ) : (
                      <button className="text-xs text-danger" onClick={() => setConfirmId(e.event_id)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------
interface AdminUser {
  user_id: number;
  username: string;
  email: string;
  account_status: string;
  roles: string[];
  created_at: string;
}

export function UsersPanel() {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiFetch<AdminUser[]>("/admin/users", { token }).then(setUsers).catch((e) => setError(errorText(e)));
  }, [token]);
  useEffect(load, [load]);

  async function act(path: string, method: string, body?: unknown) {
    setError("");
    try {
      await apiFetch(path, { method, token, body });
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Role grants go through the <code>assign_user_role</code> stored procedure. Nobody can grant Admin to themselves —
        the API, the procedure and a database trigger all enforce this.
      </p>
      {error && <ErrorNote message={error} />}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.user_id === me?.user_id;
              const isAdmin = u.roles.includes("Admin");
              return (
                <tr key={u.user_id} className="border-b border-line/50 last:border-0">
                  <td className="px-3 py-2">
                    {u.username} {self && <span className="text-xs text-accent">(you)</span>}
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} tone={r === "Admin" ? "accent" : "default"}>{r}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={u.account_status === "active" ? "default" : "danger"}>{u.account_status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {self ? (
                      <span className="text-xs text-muted">Cannot modify own account</span>
                    ) : (
                      <>
                        {isAdmin ? (
                          <button className="link mr-3 text-xs" onClick={() => act(`/admin/users/${u.user_id}/roles/Admin`, "DELETE")}>
                            Revoke Admin
                          </button>
                        ) : (
                          <button className="link mr-3 text-xs" onClick={() => act(`/admin/users/${u.user_id}/roles`, "POST", { role_name: "Admin" })}>
                            Grant Admin
                          </button>
                        )}
                        <button
                          className={`text-xs ${u.account_status === "active" ? "text-danger" : "text-success"}`}
                          onClick={() =>
                            act(`/admin/users/${u.user_id}/status`, "PATCH", {
                              account_status: u.account_status === "active" ? "suspended" : "active",
                            })
                          }
                        >
                          {u.account_status === "active" ? "Suspend" : "Reactivate"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
interface AuditRow {
  audit_id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  username: string | null;
  created_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

function changedFields(a: AuditRow) {
  if (a.action !== "UPDATE" || !a.old_data || !a.new_data) return "";
  return Object.keys(a.new_data)
    .filter((k) => JSON.stringify(a.old_data![k]) !== JSON.stringify(a.new_data![k]) && k !== "updated_at")
    .map((k) => `${k}: ${JSON.stringify(a.old_data![k])} → ${JSON.stringify(a.new_data![k])}`)
    .join("; ");
}

export function AuditPanel() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    apiFetch<AuditRow[]>("/admin/audit?limit=100", { token }).then(setRows).catch((e) => setError(errorText(e)));
  }, [token]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Written automatically by the <code>trg_audit_row_change</code> trigger. The runtime database role can insert into
        this table but cannot update or delete it.
      </p>
      {error && <ErrorNote message={error} />}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Changes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.audit_id} className="border-b border-line/50 align-top last:border-0">
                <td className="px-3 py-2 text-muted">{a.audit_id}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{new Date(a.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{a.username ?? <span className="text-muted">system</span>}</td>
                <td className="px-3 py-2">
                  <Badge tone={a.action === "DELETE" ? "danger" : a.action === "INSERT" ? "accent" : "default"}>{a.action}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {a.entity_type} <span className="text-muted">#{a.entity_id}</span>
                </td>
                <td className="max-w-md px-3 py-2 text-xs text-muted">
                  {changedFields(a) || String((a.new_data ?? a.old_data)?.name ?? (a.new_data ?? a.old_data)?.event_name ?? "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
