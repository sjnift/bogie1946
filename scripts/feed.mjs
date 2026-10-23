// Reads a Letterboxd member's public RSS feed (their latest diary entries) and adds them to
// docs/feed/<username>.json, which the site merges into that member's imported diary.
// The feed only shows about 50 recent entries, so each run keeps what earlier runs collected.
// Usage: node scripts/feed.mjs [<username> ...]   (with no names, the ones in feed-users.txt)
import { mkdir, readFile, writeFile } from "node:fs/promises";

const KEEP = 1000; // entries kept per member, newest first
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim() : "";
};
// Letterboxd writes some characters as codes: &amp;, and &#039; for an apostrophe.
const decode = (s) => s.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos));/gi, (m, dec, hex, name) =>
  dec ? String.fromCodePoint(+dec) : hex ? String.fromCodePoint(parseInt(hex, 16)) : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[name.toLowerCase()]);

// The description holds the poster, then the review, or just "Watched on <date>." when there is none.
function reviewOf(html) {
  const paras = (html.match(/<p>[\s\S]*?<\/p>/g) || [])
    .filter((p) => !/^<p>\s*<img\b/.test(p) && !/^<p>\s*Watched on [^<]*\.\s*<\/p>$/.test(p) && !/^<p>\s*<em>This review may contain spoilers\.<\/em>\s*<\/p>$/.test(p));
  return paras.join("");
}

function parse(xml) {
  const items = [];
  for (const [, it] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const guid = tag(it, "guid");
    if (!/letterboxd-(watch|review)-/.test(guid)) continue; // lists and other posts
    const watched = tag(it, "letterboxd:watchedDate");
    const title = decode(tag(it, "letterboxd:filmTitle"));
    if (!watched || !title) continue;
    const pub = new Date(tag(it, "pubDate"));
    items.push({
      guid, title, year: Number(tag(it, "letterboxd:filmYear")) || null, watched,
      logged: isNaN(pub) ? null : pub.toISOString().slice(0, 10),
      rating: Number(tag(it, "letterboxd:memberRating")) || null,
      rewatch: /^yes$/i.test(tag(it, "letterboxd:rewatch")),
      liked: /^yes$/i.test(tag(it, "letterboxd:memberLike")),
      tmdb: Number(tag(it, "tmdb:movieId")) || null,
      review: reviewOf(tag(it, "description")),
      link: tag(it, "link"),
    });
  }
  return items;
}

async function update(user) {
  const res = await fetch(`https://letterboxd.com/${encodeURIComponent(user)}/rss/`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CreditsRollFeed/1.0; +https://github.com/sjnift/credits-roll)", Accept: "application/rss+xml, application/xml" },
  });
  if (res.status === 404) throw new Error(`${user}: Letterboxd has no public profile with this username. Check the spelling in feed-users.txt.`);
  if (!res.ok) throw new Error(`${user}: Letterboxd answered ${res.status} ${res.statusText} (${res.headers.get("server") || "?"}, ${res.headers.get("cf-mitigated") || "no challenge"})`);
  const fresh = parse(await res.text());
  const file = `docs/feed/${user.toLowerCase()}.json`;
  let old = { items: [] };
  try { old = JSON.parse(await readFile(file, "utf8")); } catch {}
  const byGuid = new Map(old.items.map((x) => [x.guid, x]));
  let added = 0;
  for (const x of fresh) { if (!byGuid.has(x.guid)) added++; byGuid.set(x.guid, x); } // an edited entry replaces the old copy
  const items = [...byGuid.values()].sort((a, b) => (b.watched + (b.logged || "")).localeCompare(a.watched + (a.logged || ""))).slice(0, KEEP);
  await mkdir("docs/feed", { recursive: true });
  // the file only changes when the entries do, so a quiet day makes no commit
  const out = JSON.stringify({ user, items }, null, 1) + "\n";
  let before = "";
  try { before = await readFile(file, "utf8"); } catch {}
  if (out !== before) await writeFile(file, out);
  console.log(`${user}: ${fresh.length} entries in the feed, ${added} new, ${items.length} kept`);
}

let users = process.argv.slice(2);
if (!users.length) {
  try { users = (await readFile("feed-users.txt", "utf8")).split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean); } catch {}
}
if (!users.length) { console.log("No Letterboxd usernames in feed-users.txt yet."); process.exit(0); }
let failed = 0;
for (const u of users) {
  try { await update(u); } catch (e) {
    failed++;
    // in GitHub Actions an error line becomes an annotation, readable on the run's page
    console.error(`${process.env.GITHUB_ACTIONS ? "::error::" : ""}${String(e.message || e)}`);
  }
}
process.exit(failed ? 1 : 0);
