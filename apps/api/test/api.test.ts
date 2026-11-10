// Integration tests: start the real Express app on a random port and call it
// over HTTP against the seeded PostgreSQL database (cinemind_db).
// Run: npm test   (requires database/setup.ps1 to have been run)
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";

let base = "";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
const suffix = Date.now().toString(36);

async function api(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(base + path, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function login(email: string, password: string) {
  const res = await api("/api/auth/login", { method: "POST", body: { email, password } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.token as string;
}

let adminToken = "";
let aliceToken = "";

before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  adminToken = await login("admin@cinemind.local", "Admin@123");
  aliceToken = await login("alice@cinemind.local", "Viewer@123");
});

after(async () => {
  server.close();
  await pool.end();
});

describe("health and public discovery", () => {
  test("health endpoint reaches PostgreSQL as the runtime role", async () => {
    const res = await api("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.database, "cinemind_db");
    assert.equal(res.body.db_user, "cinemind_app");
  });

  test("lists universes with counts", async () => {
    const res = await api("/api/universes");
    assert.equal(res.status, 200);
    const got = res.body.find((u: any) => u.name === "Game of Thrones");
    assert.equal(got.title_count, 2);
  });

  test("universe detail includes titles and characters", async () => {
    const list = await api("/api/universes");
    const id = list.body.find((u: any) => u.name === "The Matrix").universe_id;
    const res = await api(`/api/universes/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.titles.length, 3);
    assert.ok(res.body.characters.some((c: any) => c.character_name === "Neo"));
  });

  test("filters titles by genre and media type", async () => {
    const res = await api("/api/titles?genre=Science%20Fiction&media_type=movie");
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((t: any) => t.title_name).sort(),
      ["Inception", "The Matrix", "The Matrix Reloaded", "The Matrix Revolutions"],
    );
  });

  test("sorts titles by rating", async () => {
    const res = await api("/api/titles?sort=rating");
    assert.equal(res.status, 200);
    assert.equal(res.body[0].average_rating, 5);
  });

  test("standalone title has no universe", async () => {
    const res = await api("/api/titles?q=Inception");
    assert.equal(res.body[0].universe_id, null);
  });

  test("search finds titles and characters", async () => {
    const res = await api("/api/search?q=stark");
    assert.equal(res.status, 200);
    assert.ok(res.body.characters.length >= 5);
  });

  test("invalid query parameter returns 400 with details", async () => {
    const res = await api("/api/titles?media_type=podcast");
    assert.equal(res.status, 400);
    assert.ok(res.body.details.media_type);
  });

  test("unknown id returns 404 and malformed id returns 400", async () => {
    assert.equal((await api("/api/titles/999999")).status, 404);
    assert.equal((await api("/api/titles/abc")).status, 400);
  });
});

describe("characters and story", () => {
  let jonId = 0;
  let gotId = 0;

  before(async () => {
    jonId = (await api("/api/characters?q=Jon%20Snow")).body[0].character_id;
    gotId = (await api("/api/titles?q=Game%20of%20Thrones")).body[0].title_id;
  });

  test("character profile has directed relationships and two arcs", async () => {
    const res = await api(`/api/characters/${jonId}`);
    assert.equal(res.status, 200);
    const directions = new Set(res.body.relationships.map((r: any) => r.direction));
    assert.deepEqual([...directions].sort(), ["incoming", "outgoing"]);
    assert.equal(res.body.arcs.length, 2);
  });

  test("timeline differs between chronology and release order", async () => {
    const eddard = (await api("/api/characters?q=Eddard")).body[0].character_id;
    const chrono = await api(`/api/characters/${eddard}/timeline?order=chronology`);
    const release = await api(`/api/characters/${eddard}/timeline?order=release`);
    assert.equal(chrono.body[0].event_name, "The Tower of Joy");
    assert.equal(release.body[0].event_name, "King Robert visits Winterfell");
  });

  test("title events include participants", async () => {
    const res = await api(`/api/titles/${gotId}/events?order=release`);
    assert.equal(res.status, 200);
    const redWedding = res.body.find((e: any) => e.event_name === "The Red Wedding");
    assert.equal(redWedding.participants.length, 4);
  });

  test("event participants endpoint", async () => {
    const events = await api(`/api/titles/${gotId}/events`);
    const id = events.body.find((e: any) => e.event_name === "Execution of Eddard Stark").event_id;
    const res = await api(`/api/events/${id}/participants`);
    assert.ok(res.body.some((p: any) => p.name === "Eddard Stark" && p.outcome === "died"));
  });
});

describe("authentication", () => {
  const email = `tester_${suffix}@example.com`;
  let token = "";

  test("register assigns the Viewer role", async () => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: { username: `tester_${suffix}`, email: email.toUpperCase(), password: "Secret#123" },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.user.roles, ["Viewer"]);
    assert.equal(res.body.user.email, email); // stored lower-case
    token = res.body.token;
  });

  test("duplicate email is rejected with 409", async () => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: { username: `other_${suffix}`, email, password: "Secret#123" },
    });
    assert.equal(res.status, 409);
  });

  test("weak input is rejected with 400", async () => {
    const res = await api("/api/auth/register", { method: "POST", body: { username: "x", email: "bad", password: "1" } });
    assert.equal(res.status, 400);
  });

  test("wrong password is rejected with 401", async () => {
    const res = await api("/api/auth/login", { method: "POST", body: { email, password: "wrong-password" } });
    assert.equal(res.status, 401);
  });

  test("me returns the current user; missing or bad token returns 401", async () => {
    assert.equal((await api("/api/auth/me", { token })).body.user.email, email);
    assert.equal((await api("/api/auth/me")).status, 401);
    assert.equal((await api("/api/auth/me", { token: "not-a-jwt" })).status, 401);
  });
});

describe("user workspace", () => {
  let titleId = 0;
  let characterId = 0;

  before(async () => {
    titleId = (await api("/api/titles?q=Naruto%20Shippuden")).body[0].title_id;
    characterId = (await api("/api/characters?q=Kakashi")).body[0].character_id;
  });

  test("workspace requires authentication", async () => {
    assert.equal((await api("/api/me/bookmarks")).status, 401);
  });

  test("bookmark add, duplicate, list and remove", async () => {
    const add = await api("/api/me/bookmarks", { method: "POST", token: aliceToken, body: { character_id: characterId } });
    assert.equal(add.status, 201);
    const dup = await api("/api/me/bookmarks", { method: "POST", token: aliceToken, body: { character_id: characterId } });
    assert.equal(dup.status, 409);
    const both = await api("/api/me/bookmarks", {
      method: "POST",
      token: aliceToken,
      body: { character_id: characterId, title_id: titleId },
    });
    assert.equal(both.status, 400);
    const list = await api("/api/me/bookmarks", { token: aliceToken });
    assert.ok(list.body.some((b: any) => b.character_name === "Kakashi Hatake"));
    const del = await api(`/api/me/bookmarks/${add.body.bookmark_id}`, { method: "DELETE", token: aliceToken });
    assert.equal(del.status, 204);
  });

  test("review create, update (trigger refreshes updated_at), invalid rating, delete", async () => {
    const created = await api(`/api/titles/${titleId}/review`, {
      method: "PUT",
      token: aliceToken,
      body: { rating: 4, review_text: "Test review" },
    });
    assert.equal(created.status, 201);
    const updated = await api(`/api/titles/${titleId}/review`, { method: "PUT", token: aliceToken, body: { rating: 5 } });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.review_id, created.body.review_id);
    assert.ok(new Date(updated.body.updated_at) > new Date(created.body.updated_at));
    const bad = await api(`/api/titles/${titleId}/review`, { method: "PUT", token: aliceToken, body: { rating: 7 } });
    assert.equal(bad.status, 400);
    const del = await api(`/api/titles/${titleId}/review`, { method: "DELETE", token: aliceToken });
    assert.equal(del.status, 204);
  });

  test("watch progress upsert and validation", async () => {
    const res = await api(`/api/me/progress/${titleId}`, {
      method: "PUT",
      token: aliceToken,
      body: { progress_status: "watching", progress_percentage: 50 },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.progress_percentage, 50);
    const bad = await api(`/api/me/progress/${titleId}`, {
      method: "PUT",
      token: aliceToken,
      body: { progress_status: "watching", progress_percentage: 150 },
    });
    assert.equal(bad.status, 400);
    // restore seed value
    await api(`/api/me/progress/${titleId}`, {
      method: "PUT",
      token: aliceToken,
      body: { progress_status: "watching", progress_percentage: 45 },
    });
  });

  test("activity summary", async () => {
    const res = await api("/api/me/activity", { token: aliceToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.reviews >= 3);
  });
});

describe("administration and authorization", () => {
  test("viewer is forbidden from admin routes; anonymous is unauthorized", async () => {
    assert.equal((await api("/api/admin/users", { token: aliceToken })).status, 403);
    assert.equal((await api("/api/admin/universes", { method: "POST", body: {} })).status, 401);
  });

  test("admin content CRUD with audit trail", async () => {
    const universe = await api("/api/admin/universes", {
      method: "POST",
      token: adminToken,
      body: { name: `Test Universe ${suffix}`, origin_type: "original", description: "temp" },
    });
    assert.equal(universe.status, 201, JSON.stringify(universe.body));
    const uid = universe.body.universe_id;

    const genres = (await api("/api/genres")).body;
    const title = await api("/api/admin/titles", {
      method: "POST",
      token: adminToken,
      body: {
        universe_id: uid,
        name: `Test Title ${suffix}`,
        media_type: "web_series",
        status: "ongoing",
        genre_ids: [genres[0].genre_id],
      },
    });
    assert.equal(title.status, 201, JSON.stringify(title.body));
    const tid = title.body.title_id;

    const ch = await api("/api/admin/characters", {
      method: "POST",
      token: adminToken,
      body: { universe_id: uid, name: "Test Hero" },
    });
    assert.equal(ch.status, 201);
    const cid = ch.body.character_id;

    // Not yet in the title: the procedure + trigger reject the participant.
    const rejected = await api("/api/admin/events", {
      method: "POST",
      token: adminToken,
      body: { title_id: tid, event_name: "Pilot", participants: [{ character_id: cid, participation_type: "central" }] },
    });
    assert.equal(rejected.status, 400);

    const app = await api("/api/admin/appearances", {
      method: "POST",
      token: adminToken,
      body: { character_id: cid, title_id: tid, character_role: "protagonist" },
    });
    assert.equal(app.status, 201);

    const event = await api("/api/admin/events", {
      method: "POST",
      token: adminToken,
      body: { title_id: tid, event_name: "Pilot", participants: [{ character_id: cid, participation_type: "central" }] },
    });
    assert.equal(event.status, 201, JSON.stringify(event.body));
    assert.equal(event.body.participant_count, 1);
    assert.equal(event.body.chronology_order, 1);

    // RESTRICT: the universe cannot be deleted while it has titles.
    assert.equal((await api(`/api/admin/universes/${uid}`, { method: "DELETE", token: adminToken })).status, 409);

    const audit = await api("/api/admin/audit?limit=20", { token: adminToken });
    assert.ok(audit.body.some((a: any) => a.entity_type === "story_events" && a.username === "admin"));

    // Clean up (titles cascade to events/appearances).
    assert.equal((await api(`/api/admin/titles/${tid}`, { method: "DELETE", token: adminToken })).status, 204);
    assert.equal((await api(`/api/admin/characters/${cid}`, { method: "DELETE", token: adminToken })).status, 204);
    assert.equal((await api(`/api/admin/universes/${uid}`, { method: "DELETE", token: adminToken })).status, 204);
  });

  test("admin cannot assign Admin to themselves", async () => {
    const me = (await api("/api/auth/me", { token: adminToken })).body.user;
    const res = await api(`/api/admin/users/${me.user_id}/roles`, {
      method: "POST",
      token: adminToken,
      body: { role_name: "Admin" },
    });
    assert.equal(res.status, 403);
  });

  test("admin grants and revokes a role; suspension blocks login immediately", async () => {
    const email = `promoted_${suffix}@example.com`;
    const reg = await api("/api/auth/register", {
      method: "POST",
      body: { username: `promoted_${suffix}`, email, password: "Secret#123" },
    });
    const uid = reg.body.user.user_id;
    const userToken = reg.body.token;

    assert.equal(
      (await api(`/api/admin/users/${uid}/roles`, { method: "POST", token: adminToken, body: { role_name: "Admin" } }))
        .status,
      201,
    );
    assert.equal((await api("/api/admin/users", { token: userToken })).status, 200);
    assert.equal(
      (await api(`/api/admin/users/${uid}/roles/Admin`, { method: "DELETE", token: adminToken })).status,
      204,
    );
    assert.equal((await api("/api/admin/users", { token: userToken })).status, 403);

    const suspend = await api(`/api/admin/users/${uid}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { account_status: "suspended" },
    });
    assert.equal(suspend.status, 200);
    assert.equal((await api("/api/auth/me", { token: userToken })).status, 403);
  });
});
