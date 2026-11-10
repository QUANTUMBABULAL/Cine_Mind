# Frontend Overview

*Report chapter 9.* Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
source: `apps/web/src`.

## Design

A deep navy background (`#17152B`) with soft white text. Electric violet (`#9B5CFF`) is the
primary accent for buttons, the selected navigation item and links. Coral (`#FF5576`), aqua
(`#20C9C3`) and amber (`#FFC857`) carry meaning: conflict and spoilers, support and
relationships, and ratings. The tokens are defined in `app/globals.css`. The layout is
responsive: a mobile menu appears below `lg`, and the homepage rows scroll horizontally.
It was checked at 390, 768 and 1440 px with no horizontal page scroll. Every page has
loading, empty and error states.

**Images.** The seed data has no image URLs. `lib/images.ts` therefore maps each record's
natural key to a local file in `public/images/{universes,titles,characters}`: the name, plus
the universe for characters. A URL stored in the database always takes precedence. The files
were downloaded by `scripts/fetch-images.mjs` from the lead images of English Wikipedia
articles. Sources and licences are listed in `public/images/ATTRIBUTION.md`. `Poster`
(`components/poster.tsx`) shows a placeholder with initials when there is no image or an
image fails to load (Walder Frey, Dom Cobb, Mal).

## How data flows

- **Public pages are server components.** They call the Express API at request time
  (`lib/server.ts` → `fetch`, `cache: "no-store"`). A 404 from the API renders the Not Found
  page; an unreachable API renders `app/error.tsx`.
- **Interactive parts are client components** (`"use client"`): login/register,
  bookmark button, review and progress controls, workspace, admin dashboard.
- **Authentication:** `lib/auth.tsx` keeps the JWT in `localStorage` and calls
  `/auth/me` on load. The UI hides admin links from users without permission, but the
  API enforces the rules independently and returns 403.
- **No demo content is hard-coded.** Everything shown comes from PostgreSQL through
  the API. The frontend only knows the API URL (`NEXT_PUBLIC_API_URL`).

## Pages

| Route | Type | Content | Screenshot |
| --- | --- | --- | --- |
| `/` | server | intro, search bar, featured universes, highest-rated titles | `01_home.png` |
| `/universes`, `/universes/[id]` | server | universe list; titles and characters of a universe | `02_universes.png` |
| `/titles` | server | catalogue with search, genre, media-type and sort filters (GET form) | `04_titles_filtered.png` |
| `/titles/[id]` | server + client actions | synopsis, genres, cast with roles, reviews and average; bookmark, progress and review form | `03_…`, `11_title_logged_in_alice.png` |
| `/characters`, `/characters/[id]` | server | grouped list; profile, directed relationships (outgoing/incoming), appearances, timeline with chronological/release toggle, arcs | `05_character_jon_snow.png` |
| `/story` | server | Story Explorer: pick a title, timeline with participants and outcomes, order toggle, arc progressions | `06_…`, `07_…` |
| `/search` | server | titles, characters and universes matching the query | `08_search.png` |
| `/login`, `/register` | client | forms with validation errors from the API | `09_login.png` |
| `/workspace` | client (auth) | activity counts, watch progress (edit/remove), bookmarks, own reviews | `10_workspace_alice.png` |
| `/admin` | client (Admin) | tabs: overview, universes, titles, characters + appearances, relationships, story events (via stored procedure), genres, users & roles, audit log | `12_…`–`17_…` |

## Components

| File | Purpose |
| --- | --- |
| `components/site-header.tsx` | navigation and auth state, mobile menu |
| `components/ui.tsx` | PageHeader, Section, TitleCard, CharacterCard, Stars, Badge, Empty, ErrorNote, SearchBar |
| `components/poster.tsx` | image with graceful placeholder |
| `components/story.tsx` | OrderToggle, SpoilerBadge, ArcCard (start → steps → end) |
| `components/title-actions.tsx`, `bookmark-button.tsx` | user actions on a title or character |
| `components/admin/crud-panel.tsx` | generic list + form + two-step delete |
| `components/admin/panels.tsx` | admin resources, events, users, audit |

## Run

```cmd
cd apps\web
npm install
npm run dev        :: http://localhost:3000
npm run build && npm run start   :: production
```
