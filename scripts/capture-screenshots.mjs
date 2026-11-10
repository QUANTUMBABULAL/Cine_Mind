// Captures screenshots of the running CineMind app (including logged-in pages)
// into evidence/screenshots, using headless Chrome's DevTools protocol and
// Node's built-in fetch/WebSocket (Node 22+). No extra dependencies.
//
// Prerequisites: API on :4000 and web app on :3000 are running.
// Usage:  node scripts/capture-screenshots.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WEB = "http://localhost:3000";
const API = "http://localhost:4000/api";
const OUT = path.resolve("evidence/screenshots");
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
if (!CHROME) throw new Error("Chrome or Edge not found");
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  return (await res.json()).token;
}

const port = 9333;
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "cinemind-shots-"))}`,
  "about:blank",
]);

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    target = await fetch(`http://127.0.0.1:${port}/json/list`)
      .then((r) => r.json())
      .then((list) => list.find((t) => t.type === "page"))
      .catch(() => undefined);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });

  async function shot(url, name, height = 1200, token = null) {
    await send("Emulation.setDeviceMetricsOverride", { width: 1366, height, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: WEB + "/login" });
    await sleep(1200);
    await send("Runtime.evaluate", {
      expression: token ? `localStorage.setItem("cinemind_token", ${JSON.stringify(token)})` : `localStorage.clear()`,
    });
    await send("Page.navigate", { url: WEB + url });
    await sleep(3500); // let client components fetch their data
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
    console.log(`saved ${name}.png`);
  }

  async function clickTab(label) {
    await send("Runtime.evaluate", {
      expression: `[...document.querySelectorAll("button")].find(b => b.textContent.trim() === ${JSON.stringify(label)})?.click()`,
    });
    await sleep(2000);
  }

  const admin = await login("admin@cinemind.local", "Admin@123");
  const alice = await login("alice@cinemind.local", "Viewer@123");

  await shot("/workspace", "10_workspace_alice", 1500, alice);
  await shot("/titles/" + (await titleId("Fullmetal Alchemist: Brotherhood")), "11_title_logged_in_alice", 1500, alice);
  await shot("/admin", "12_admin_denied_for_viewer", 600, alice);
  await shot("/admin", "13_admin_overview", 800, admin);

  for (const [tab, name, h] of [
    ["Titles", "14_admin_titles", 1300],
    ["Story events", "15_admin_events", 1100],
    ["Users & roles", "16_admin_users", 800],
    ["Audit log", "17_admin_audit_log", 1400],
  ]) {
    await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: h, deviceScaleFactor: 1, mobile: false });
    await clickTab(tab);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
    console.log(`saved ${name}.png`);
  }
  ws.close();
} finally {
  chrome.kill();
}

async function titleId(name) {
  const rows = await fetch(`${API}/titles?q=${encodeURIComponent(name)}`).then((r) => r.json());
  return rows.find((t) => t.title_name === name).title_id;
}
