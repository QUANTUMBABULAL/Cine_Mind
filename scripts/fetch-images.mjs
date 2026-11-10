// Downloads the poster / portrait images used by the web app into
// apps/web/public/images and writes apps/web/public/images/ATTRIBUTION.md.
//
// Each image is the lead (infobox) image of a named English Wikipedia article,
// resolved through the public MediaWiki API (no API key). Nothing is scraped and
// no URL is guessed: if an article has no image, the entry is reported as missing
// and the UI shows its placeholder.
//
//   node scripts/fetch-images.mjs            # download missing files
//   node scripts/fetch-images.mjs --dry-run  # only resolve and print
//   node scripts/fetch-images.mjs --force    # re-download everything
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "apps", "web", "public", "images");
const API = "https://en.wikipedia.org/w/api.php";
const UA = "CineMindStudentProject/2.0 (university DBMS project; images used for education with attribution)";
const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

// [folder, slug, database name, Wikipedia article]
const ENTRIES = [
  ["universes", "game-of-thrones", "Game of Thrones", "A Song of Ice and Fire"],
  ["universes", "fullmetal-alchemist", "Fullmetal Alchemist", "Fullmetal Alchemist"],
  ["universes", "naruto", "Naruto", "Naruto"],
  ["universes", "the-matrix", "The Matrix", "The Matrix Resurrections"], // franchise article has no image,

  ["titles", "game-of-thrones", "Game of Thrones", "Game of Thrones season 1"], // series article shows a logo,
  ["titles", "house-of-the-dragon", "House of the Dragon", "House of the Dragon season 1"],
  ["titles", "fullmetal-alchemist", "Fullmetal Alchemist", "List of Fullmetal Alchemist episodes"],
  ["titles", "fullmetal-alchemist-brotherhood", "Fullmetal Alchemist: Brotherhood", "List of Fullmetal Alchemist: Brotherhood episodes"],
  ["titles", "naruto", "Naruto", "Naruto season 1"],
  ["titles", "naruto-shippuden", "Naruto Shippuden", "Naruto: Shippuden season 1"],
  ["titles", "the-matrix", "The Matrix", "The Matrix"],
  ["titles", "the-matrix-reloaded", "The Matrix Reloaded", "The Matrix Reloaded"],
  ["titles", "the-matrix-revolutions", "The Matrix Revolutions", "The Matrix Revolutions"],
  ["titles", "inception", "Inception", "Inception"],

  ["characters", "eddard-stark", "Eddard Stark", "Ned Stark"],
  ["characters", "catelyn-stark", "Catelyn Stark", "Catelyn Stark"],
  ["characters", "robb-stark", "Robb Stark", "Robb Stark"],
  ["characters", "sansa-stark", "Sansa Stark", "Sansa Stark"],
  ["characters", "arya-stark", "Arya Stark", "Arya Stark"],
  ["characters", "jon-snow", "Jon Snow", "Jon Snow (character)"],
  ["characters", "daenerys-targaryen", "Daenerys Targaryen", "Daenerys Targaryen"],
  ["characters", "tyrion-lannister", "Tyrion Lannister", "Tyrion Lannister"],
  ["characters", "joffrey-baratheon", "Joffrey Baratheon", "Joffrey Baratheon"],
  ["characters", "walder-frey", "Walder Frey", "Walder Frey"],
  ["characters", "ramsay-bolton", "Ramsay Bolton", "Ramsay Bolton"],
  ["characters", "rhaenyra-targaryen", "Rhaenyra Targaryen", "Rhaenyra Targaryen"],
  ["characters", "daemon-targaryen", "Daemon Targaryen", "Daemon Targaryen"],
  ["characters", "edward-elric", "Edward Elric", "Edward Elric"],
  ["characters", "alphonse-elric", "Alphonse Elric", "Alphonse Elric"],
  ["characters", "roy-mustang", "Roy Mustang", "Roy Mustang"],
  ["characters", "naruto-uzumaki", "Naruto Uzumaki", "Naruto Uzumaki"],
  ["characters", "sasuke-uchiha", "Sasuke Uchiha", "Sasuke Uchiha"],
  ["characters", "kakashi-hatake", "Kakashi Hatake", "Kakashi Hatake"],
  ["characters", "neo", "Neo", "Neo (The Matrix)"],
  ["characters", "trinity", "Trinity", "Trinity (The Matrix)"],
  ["characters", "morpheus", "Morpheus", "Morpheus (The Matrix)"],
  ["characters", "agent-smith", "Agent Smith", "Agent Smith"],
  ["characters", "dom-cobb", "Dom Cobb", null],
  ["characters", "mal", "Mal", null],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET with a polite retry on 429 (rate limited) / 5xx.
async function get(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(Number(res.headers.get("retry-after")) * 1000 || 3000 * attempt);
      continue;
    }
    return res;
  }
}

async function api(params) {
  const res = await get(`${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`);
  if (!res.ok) throw new Error(`MediaWiki API ${res.status}`);
  return res.json();
}

const exists = (p) => access(p).then(() => true, () => false);
const strip = (html) => (html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// Resolves every article in two batched requests: lead images, then file licences.
async function resolveAll(articles) {
  const q = (await api({
    action: "query", titles: articles.join("|"), redirects: "1",
    prop: "pageimages", piprop: "thumbnail|name", pithumbsize: "600", pilicense: "any",
  })).query;
  const follow = (t) => {
    t = q.normalized?.find((n) => n.from === t)?.to ?? t;
    return q.redirects?.find((r) => r.from === t)?.to ?? t;
  };
  const pages = new Map(q.pages.map((p) => [p.title, p]));
  const files = [...new Set(q.pages.filter((p) => p.pageimage).map((p) => `File:${p.pageimage}`))];
  const fq = (await api({ action: "query", titles: files.join("|"), prop: "imageinfo", iiprop: "extmetadata|url" })).query;
  const fileInfo = new Map();
  for (const f of fq.pages) {
    const name = f.title.replace(/^File:/, "").replace(/ /g, "_");
    fileInfo.set(name, f.imageinfo?.[0] ?? {});
  }
  const out = new Map();
  for (const a of articles) {
    const page = pages.get(follow(a));
    if (!page || page.missing || !page.thumbnail) continue;
    const info = fileInfo.get(page.pageimage) ?? {};
    const meta = info.extmetadata ?? {};
    out.set(a, {
      article: page.title,
      file: page.pageimage,
      thumb: page.thumbnail.source,
      filePage: info.descriptionurl ?? `https://en.wikipedia.org/wiki/File:${page.pageimage}`,
      license: strip(meta.LicenseShortName?.value) || "see file page",
      credit: strip(meta.Artist?.value) || strip(meta.Credit?.value) || "see file page",
    });
  }
  return out;
}

const resolved = await resolveAll([...new Set(ENTRIES.map((e) => e[3]).filter(Boolean))]);
const rows = [];
const missing = [];
for (const [folder, slug, name, article] of ENTRIES) {
  const r = article ? resolved.get(article) : null;
  if (!r) {
    missing.push(`${folder}/${name}${article ? ` (no image on "${article}")` : " (no dedicated article)"}`);
    continue;
  }
  const ext = path.extname(new URL(r.thumb).pathname).toLowerCase() || ".jpg";
  const rel = `${folder}/${slug}${ext}`;
  const dest = path.join(OUT, folder, `${slug}${ext}`);
  let status = "resolved";
  if (!DRY) {
    if (FORCE || !(await exists(dest))) {
      const res = await get(r.thumb);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) {
        missing.push(`${folder}/${name} (download failed: ${res.status} ${type})`);
        continue;
      }
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      status = "downloaded";
      await sleep(400);
    } else status = "kept";
  }
  rows.push({ folder, name, rel, ...r });
  console.log(`${status.padEnd(10)} ${rel.padEnd(48)} <- ${r.article} [${r.file}] ${r.license}`);
}

if (missing.length) console.log(`\nMissing (${missing.length}):\n  ${missing.join("\n  ")}`);

if (!DRY) {
  const esc = (s) => String(s).replace(/\|/g, "\\|");
  const table = rows.map((r) =>
    `| \`${r.rel}\` | ${esc(r.name)} | [${esc(r.article)}](https://en.wikipedia.org/wiki/${encodeURIComponent(r.article.replace(/ /g, "_"))}) | [${esc(r.file)}](${r.filePage}) | ${esc(r.license)} | ${esc(r.credit)} |`,
  );
  const md = `# Image attribution

Generated by \`scripts/fetch-images.mjs\`. Each image is the lead image of the listed English
Wikipedia article, downloaded as a resized thumbnail through the MediaWiki API.

Most posters and character images are copyrighted by their studios or publishers and are
hosted on Wikipedia as non-free content. They are used here only for a non-commercial
university DBMS project, to identify the work or character. Check the file page before
reusing any image elsewhere.

| Local file | Used for | Article | Source file | License | Credit |
| --- | --- | --- | --- | --- | --- |
${table.join("\n")}

## Missing images (placeholder shown)

${missing.length ? missing.map((m) => `- ${m}`).join("\n") : "- none"}
`;
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "ATTRIBUTION.md"), md);
  console.log(`\nwrote apps/web/public/images/ATTRIBUTION.md (${rows.length} images)`);
}
