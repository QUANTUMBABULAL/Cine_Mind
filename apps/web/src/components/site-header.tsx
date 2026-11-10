"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/universes", label: "Universes" },
  { href: "/titles", label: "Titles" },
  { href: "/characters", label: "Characters" },
  { href: "/story", label: "Story Explorer" },
];

export function SiteHeader() {
  const { user, ready, logout, can } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    ...NAV,
    ...(user ? [{ href: "/workspace", label: "My Workspace" }] : []),
    ...(can("content.manage") || can("users.manage") ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  const active = (href: string) => pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:gap-6">
        <Link href="/" className="heading flex items-center gap-2 text-xl">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-base text-white">
            ✦
          </span>
          <span>
            Cine<span className="text-accent">Mind</span>
          </span>
        </Link>
        <nav className="hidden flex-1 gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active(l.href) ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active(l.href) ? "bg-accent text-white" : "text-muted hover:bg-panel-2 hover:text-ivory"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link
            href="/search"
            aria-label="Search"
            className={`grid h-9 w-9 place-items-center rounded-full text-lg transition ${
              active("/search") ? "bg-accent text-white" : "bg-panel-2 text-muted hover:text-ivory"
            }`}
          >
            ⌕
          </Link>
          {!ready ? null : user ? (
            <>
              <span className="flex items-center gap-2 rounded-full bg-panel-2 py-1 pl-1 pr-3 text-sm">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-aqua/20 text-xs font-bold uppercase text-aqua">
                  {user.username.slice(0, 1)}
                </span>
                {user.username}
                {user.roles.includes("Admin") && (
                  <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber">Admin</span>
                )}
              </span>
              <button onClick={logout} className="btn-ghost py-1.5">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:text-ivory">
                Log in
              </Link>
              <Link href="/register" className="btn-primary py-1.5">
                Register
              </Link>
            </>
          )}
        </div>
        <button
          className="btn-ghost ml-auto px-4 py-1.5 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="flex flex-col gap-1 border-t border-line/60 px-4 py-3 lg:hidden" onClick={() => setOpen(false)}>
          {[...links, { href: "/search", label: "Search" }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${active(l.href) ? "bg-accent/15 text-accent" : "text-muted hover:text-ivory"}`}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <button onClick={logout} className="rounded-lg px-3 py-2 text-left text-sm text-muted">
              Log out ({user.username})
            </button>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-muted">Log in</Link>
              <Link href="/register" className="rounded-lg px-3 py-2 text-sm font-semibold text-accent">Register</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
