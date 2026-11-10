"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Empty, ErrorNote } from "../ui";

export interface Field {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "date" | "number" | "checkboxes";
  options?: { value: string | number; label: string }[];
  required?: boolean;
  placeholder?: string;
}

export interface CrudConfig<T> {
  endpoint: string; // e.g. "/admin/universes"
  idKey: keyof T & string;
  load: () => Promise<T[]>;
  columns: { label: string; render: (row: T) => React.ReactNode }[];
  fields: Field[];
  /** Values for the edit form (may fetch the full record). */
  toForm?: (row: T) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** Converts form values to the request body. */
  toBody?: (values: Record<string, unknown>) => Record<string, unknown>;
  emptyForm?: Record<string, unknown>;
  /** Called after a successful create, update or delete (e.g. to reload lookups). */
  onSaved?: () => void;
}

/** Generic list + create/edit form + delete for one admin resource. */
export function CrudPanel<T>({ config }: { config: CrudConfig<T> }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<T[] | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; values: Record<string, unknown> } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(() => {
    config.load().then(setRows).catch((err) => setError(errorText(err)));
  }, [config]);

  useEffect(refresh, [refresh]);

  async function openEdit(row: T) {
    setError("");
    try {
      const values = config.toForm ? await config.toForm(row) : (row as Record<string, unknown>);
      setEditing({ id: Number(row[config.idKey]), values: { ...values } });
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    const raw = Object.fromEntries(config.fields.map((f) => [f.name, editing.values[f.name] ?? ""]));
    const body = config.toBody ? config.toBody(raw) : raw;
    try {
      await apiFetch(editing.id ? `${config.endpoint}/${editing.id}` : config.endpoint, {
        method: editing.id ? "PUT" : "POST",
        token,
        body,
      });
      setNotice(editing.id ? "Saved." : "Created.");
      setEditing(null);
      refresh();
      config.onSaved?.();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function remove(id: number) {
    setError("");
    try {
      await apiFetch(`${config.endpoint}/${id}`, { method: "DELETE", token });
      setNotice("Deleted.");
      setConfirmId(null);
      refresh();
      config.onSaved?.();
    } catch (err) {
      setError(errorText(err));
      setConfirmId(null);
    }
  }

  const set = (name: string, value: unknown) =>
    setEditing((cur) => (cur ? { ...cur, values: { ...cur.values, [name]: value } } : cur));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{rows ? `${rows.length} records` : "Loading…"}</p>
        <button className="btn-primary" onClick={() => setEditing({ id: null, values: { ...(config.emptyForm ?? {}) } })}>
          + New
        </button>
      </div>
      {notice && !error && <p className="text-sm text-success">{notice}</p>}
      {error && <ErrorNote message={error} />}

      {editing && (
        <form onSubmit={save} className="card grid gap-4 border-accent/50 p-5 sm:grid-cols-2">
          <p className="heading text-lg sm:col-span-2">{editing.id ? `Edit #${editing.id}` : "New record"}</p>
          {config.fields.map((f) => (
            <div key={f.name} className={f.type === "textarea" || f.type === "checkboxes" ? "sm:col-span-2" : ""}>
              <label className="label" htmlFor={`f-${f.name}`}>
                {f.label}
                {f.required && " *"}
              </label>
              <FieldInput field={f} value={editing.values[f.name]} onChange={(v) => set(f.name, v)} />
            </div>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary">{editing.id ? "Save changes" : "Create"}</button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {rows && rows.length === 0 ? (
        <Empty>No records.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                {config.columns.map((c) => (
                  <th key={c.label} className="px-3 py-2 font-medium">{c.label}</th>
                ))}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows?.map((row) => {
                const id = Number(row[config.idKey]);
                return (
                  <tr key={id} className="border-b border-line/50 last:border-0">
                    {config.columns.map((c) => (
                      <td key={c.label} className="px-3 py-2 align-top">{c.render(row)}</td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button className="link mr-3 text-xs" onClick={() => openEdit(row)}>Edit</button>
                      {confirmId === id ? (
                        <>
                          <button className="mr-2 text-xs text-danger" onClick={() => remove(id)}>Confirm delete</button>
                          <button className="text-xs text-muted" onClick={() => setConfirmId(null)}>Cancel</button>
                        </>
                      ) : (
                        <button className="text-xs text-danger" onClick={() => setConfirmId(id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const id = `f-${field.name}`;
  const str = value === null || value === undefined ? "" : String(value);
  switch (field.type) {
    case "textarea":
      return <textarea id={id} className="input min-h-20" value={str} onChange={(e) => onChange(e.target.value)} required={field.required} />;
    case "select":
      return (
        <select id={id} className="input" value={str} onChange={(e) => onChange(e.target.value)} required={field.required}>
          {!field.required && <option value="">—</option>}
          {field.required && str === "" && <option value="">Select…</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case "checkboxes": {
      const selected = new Set(((value as (string | number)[]) ?? []).map(String));
      return (
        <div id={id} className="flex flex-wrap gap-3">
          {field.options?.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="accent-accent"
                checked={selected.has(String(o.value))}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(String(o.value));
                  else next.delete(String(o.value));
                  onChange([...next].map(Number));
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    }
    default:
      return (
        <input
          id={id}
          type={field.type ?? "text"}
          className="input"
          value={str}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
  }
}
