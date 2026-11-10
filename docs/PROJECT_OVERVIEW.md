# Project Overview

*Report chapter 1 (Introduction).*

**CineMind 2.0** is a fictional-universe intelligence and story exploration platform. It
stores anime, films and web/TV series as connected data: universes contain titles, titles
feature characters, characters relate to each other (directed), take part in story
events, and develop through character arcs. Visitors can explore all of this without an
account. Registered users can bookmark, review and track watch progress. Administrators
manage content and users.

The project serves two purposes:

1. a **university DBMS project**: normalized schema, constraints, SQL queries, views,
   functions, stored procedures, triggers, transactions and database roles, all in
   plain SQL that can be run from `psql`;
2. a **working web application** that uses that database through a REST API.

## Architecture

```
Browser ──► Next.js frontend (apps/web, port 3000)
               │  HTTP/JSON (+ JWT for protected routes)
               ▼
            Express + TypeScript API (apps/api, port 4000)
               │  pg connection pool, parameterized SQL,
               │  logged in as restricted role cinemind_app
               ▼
            PostgreSQL 18 — cinemind_db (database/*.sql)
```

The frontend never connects to PostgreSQL. All authorization decisions are made by the API
and the database.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Node.js 22, Express 5, TypeScript, `pg`, `bcryptjs`, `jsonwebtoken`, `zod` |
| Database | PostgreSQL 18 (native Windows service), extension `pgcrypto` |
| Tests | Node's built-in test runner (`node:test`) + SQL self-test script |

No ORM is used. The database is defined and queried with SQL written by hand.

## Demonstration data

| Universe | Titles |
| --- | --- |
| Game of Thrones *(main demo)* | Game of Thrones, House of the Dragon |
| Fullmetal Alchemist | Fullmetal Alchemist (2003), Fullmetal Alchemist: Brotherhood |
| Naruto | Naruto, Naruto Shippuden |
| The Matrix | The Matrix, The Matrix Reloaded, The Matrix Revolutions |
| *(standalone)* | Inception |

Totals: 4 universes · 10 titles · 8 genres · 25 characters · 25 directed relationships ·
15 story events · 39 event participations · 7 character arcs (Jon Snow has two in one
title) · 14 arc steps · 3 demo users with reviews, bookmarks and progress.

Game of Thrones events include Ned Stark's execution, the Red Wedding, the Battle of the
Bastards and Daenerys arriving in Westeros. *The Tower of Joy* is a flashback, so its
chronological position (1) differs from its release position (4).

## Repository layout

```
database/   ordered SQL scripts 00–11, setup.ps1, README (psql guide)
apps/api/   Express API (src/, test/)
apps/web/   Next.js frontend (src/app pages, src/components)
docs/       report-support documentation (this folder)
evidence/   real outputs: SQL runs, test logs, screenshots
scripts/    evidence and screenshot generators
```
