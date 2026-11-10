# Problem Definition

*Report chapter 2.*

## Problem

Fans of long-running franchises (for example, *Game of Thrones* with its prequel, or
*Fullmetal Alchemist* with two adaptations) struggle to keep track of:

- which titles belong to the same fictional universe, and which stand alone;
- which characters appear in which titles, and in what role;
- how characters relate to each other. These relationships are often **one-sided**: Arya
  regards Joffrey as an enemy, and Walder Frey betrayed Robb;
- what happened in key story events, who was involved and with what outcome;
- the order of events, which can be **chronological** (in-universe) or the **release**
  order in which the audience saw them (flashbacks);
- how a character develops across those events (character arcs), sometimes along several
  arcs at once.

General-purpose sites store this as unstructured text, so it cannot be queried, checked
for consistency or explored as connected data.

## Objectives

1. Design a **normalized relational database** that models universes, titles, genres,
   characters, directed relationships, story events, participation and arcs, with integrity
   enforced by the DBMS itself.
2. Support **user accounts** with role-based access control (Viewer, Admin) and user
   activity (bookmarks, one review per title, watch progress).
3. Demonstrate core DBMS concepts in plain, executable SQL: DDL, DML, joins, nested and
   correlated queries, aggregation, views, functions, stored procedures, triggers,
   transactions and database privileges.
4. Provide a web interface for exploration and administration that uses only that
   database, through a secure API.

## Scope

**In scope:** discovery of universes and titles, genre and media filters, search,
character profiles, directed relationships, story timelines with both orderings,
participation, character arcs, registration and login, bookmarks, reviews, watch
progress, admin content CRUD, user and role management, audit log.

**Out of scope (this version):** seasons and episodes, per-episode spoiler control
(spoiler level is per event within a title), review moderation (reviews publish
immediately), media uploads, recommendations, graph databases.

## Constraints and assumptions

- PostgreSQL runs natively on Windows; no Docker required.
- Character names are unique **within a universe**. Characters of standalone titles have
  no universe and are unique among themselves.
- A story event belongs to exactly one title. Its ordering numbers are unique within that
  title.
- New users always receive the Viewer role. Only an existing administrator can grant
  Admin, and never to themselves.
