"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ErrorNote } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.username, form.email, form.password);
      router.push("/workspace");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const field = (name: keyof typeof form, label: string, type: string, extra: Record<string, unknown> = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input
        id={name}
        type={type}
        required
        className="input"
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        {...extra}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="heading mb-1 text-3xl">{mode === "login" ? "Log in" : "Create an account"}</h1>
      <p className="mb-6 text-sm text-muted">
        {mode === "login"
          ? "Welcome back to CineMind."
          : "New accounts receive the Viewer role: bookmarks, reviews and watch progress."}
      </p>
      <form onSubmit={submit} className="card space-y-4 p-6">
        {mode === "register" &&
          field("username", "Username", "text", { pattern: "[A-Za-z0-9_]{3,50}", title: "3–50 letters, digits or underscores", autoComplete: "username" })}
        {field("email", "Email", "email", { autoComplete: "email" })}
        {field("password", "Password", "password", {
          minLength: mode === "register" ? 8 : 1,
          maxLength: 72,
          autoComplete: mode === "login" ? "current-password" : "new-password",
        })}
        {error && <ErrorNote message={error} />}
        <button disabled={busy} className="btn-primary w-full">
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Register"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? (
          <>No account? <Link href="/register" className="link">Register</Link></>
        ) : (
          <>Already registered? <Link href="/login" className="link">Log in</Link></>
        )}
      </p>
      {mode === "login" && (
        <p className="mt-6 rounded-md border border-line p-3 text-xs text-muted">
          Demo accounts (seed data): <code>admin@cinemind.local</code> / <code>Admin@123</code> ·{" "}
          <code>alice@cinemind.local</code> / <code>Viewer@123</code>
        </p>
      )}
    </div>
  );
}
