<script>
/* ---------- small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
// Goes up whenever film details, averages or friends change, so the phone knows its saved results are stale.
let DATA_REV = 0;
// The made-up example diary shows only with ?example in the address, and only while nothing is imported (for
// the checks, or to show someone the app). Otherwise an empty browser gets an import screen.
const SHOW_EXAMPLE = /[?&]example\b/.test(location.search);
let LOAD_ERROR = ""; // why a saved diary couldn't be read, if it couldn't
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = (n) => Number(n || 0).toLocaleString("en-US");
const plural = (n, one, many = one + "s") => `${fmtN(n)} ${n === 1 ? one : many}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const fmtDate = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const stars = (r) => r ? "★".repeat(Math.floor(r)) + (r % 1 ? "½" : "") : "";
const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const filmKey = (name, year) => `${String(name).trim().toLowerCase()}|${year || ""}`;
// Character codes (&#039;, &amp;) turned back into characters.
const unescapeText = (s) => String(s).replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos));/gi, (m, dec, hex, name) =>
  dec ? String.fromCodePoint(+dec) : hex ? String.fromCodePoint(parseInt(hex, 16)) : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[name.toLowerCase()]);
// A title and year that ignore how the title is written (curly or straight apostrophes, codes, accents,
// punctuation, case) but keep the letters of every script, so one film always counts once.
const titleKey = (name, year) => `${unescapeText(name).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()}|${parseInt(year, 10) || ""}`;
// A quick number that's always the same for the same text (FNV-1a), for spreading things into groups.
const hash32 = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const personKey = (n) => String(n).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const dayIndex = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);
const weekdayOf = (iso) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0

// Pictures that fail to load are taken away, and a phone poster fades in once it has loaded. Done here, for the whole
// page, rather than with onerror/onload in the markup: the page's security policy runs no code written in the markup.
addEventListener("error", (e) => { const t = e.target; if (t && t.tagName === "IMG" && !t.closest("#share-img, .share-img")) t.remove(); }, true);
addEventListener("load", (e) => { const t = e.target; if (t && t.tagName === "IMG" && t.classList.contains("fade")) t.classList.add("in"); }, true);
const KEYS = { rows: "cr-rows-v1", meta: "cr-meta-v1", photos: "cr-photos-v1", tmdb: "cr-tmdb-key", omdb: "cr-omdb-key", apify: "cr-apify-key", lbx: "cr-letterboxd-v1", lbRun: "cr-letterboxd-run", friends: "cr-friends-v1", view: "cr-view-v1", filmo: "cr-filmo-v1" };
/* Small things (keys, the view) live in localStorage. The big ones (the export, film details, Letterboxd
   averages, friends' exports) live in IndexedDB, which holds far more than localStorage's few megabytes.
   store.init() reads them into memory once at start; after that reads are instant and writes go to the
   database in the background. Without IndexedDB everything stays in localStorage, as before. */
const BIG_KEYS = new Set([KEYS.rows, KEYS.meta, KEYS.photos, KEYS.lbx, KEYS.friends, KEYS.filmo]);
const MEM = new Map();
let IDB = null, idbFailed = false;
const ls = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function idbReq(mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = IDB.transaction("kv", mode), req = fn(tx.objectStore("kv"));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
const pending = new Map();
async function idbWriteNow(k) {
  try { MEM.has(k) ? await idbReq("readwrite", (s) => s.put(MEM.get(k), k)) : await idbReq("readwrite", (s) => s.delete(k)); idbFailed = false; }
  catch { idbFailed = true; if (MEM.has(k)) ls.set(k, MEM.get(k)); }
}
// Writes for one key are coalesced, so a lookup saving every few films writes once.
function idbWrite(k) {
  if (pending.has(k)) return;
  pending.set(k, setTimeout(() => { pending.delete(k); idbWriteNow(k); }, 250));
}
// Told about every saved change (the diary on the site uses it to know what to send).
let STORE_HOOK = null;
const store = {
  get(k, fallback) { return IDB && BIG_KEYS.has(k) ? (MEM.has(k) ? MEM.get(k) : fallback) : ls.get(k, fallback); },
  set(k, v) {
    if (STORE_HOOK) STORE_HOOK(k);
    if (!(IDB && BIG_KEYS.has(k))) return ls.set(k, v);
    MEM.set(k, v); idbWrite(k);
    return !idbFailed;
  },
  del(k) { if (IDB && BIG_KEYS.has(k)) { MEM.delete(k); idbWrite(k); } ls.del(k); },
  // Writes anything waiting at once: after an import, and when the app goes into the background, so closing it
  // straight away can't lose what was just saved.
  flush() { const ks = [...pending.keys()]; for (const k of ks) { clearTimeout(pending.get(k)); pending.delete(k); } return Promise.all(ks.map(idbWriteNow)); },
  // True when this browser's saved data couldn't be opened at start (so an empty page doesn't mean nothing was imported).
  failed: false,
  // Opens the database and moves anything still in localStorage into it.
  async init() {
    try {
      IDB = await new Promise((resolve, reject) => {
        const req = indexedDB.open("credits-roll", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("kv");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        setTimeout(() => reject(new Error("timeout")), 12000);
      });
      for (const k of BIG_KEYS) {
        let v = await idbReq("readonly", (s) => s.get(k));
        // a copy in localStorage is newer: only an older version of the page (or a failed write) puts one there
        const old = ls.get(k, undefined);
        if (old !== undefined) { await idbReq("readwrite", (s) => s.put(old, k)); v = old; ls.del(k); }
        if (v !== undefined) MEM.set(k, v);
      }
      // ask the browser not to clear the database when space runs short (Safari otherwise can after a week away)
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch {
      // put back anything already moved, and carry on with localStorage
      for (const [k, v] of MEM) ls.set(k, v);
      MEM.clear(); IDB = null;
      store.failed = typeof indexedDB !== "undefined" && !ls.get(KEYS.rows, null);
    }
  },
};
for (const ev of ["pagehide", "visibilitychange"]) addEventListener(ev, () => { if (ev === "pagehide" || document.visibilityState === "hidden") store.flush(); });

/* ---------- reading a Letterboxd export ---------- */
const WANTED = {
  diary: /(^|\/)diary\.csv$/i, watched: /(^|\/)watched\.csv$/i, ratings: /(^|\/)ratings\.csv$/i,
  reviews: /(^|\/)reviews\.csv$/i, likes: /(^|\/)likes\/films\.csv$/i, watchlist: /(^|\/)watchlist\.csv$/i,
  profile: /(^|\/)profile\.csv$/i,
};
const LOOSE_LIKES = /^films\.csv$/i; // likes/films.csv dropped on its own

function parseCsv(text) {
  // column names as Letterboxd writes them, give or take spaces and capitals ("review " is still the Review)
  const out = Papa.parse(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true, transformHeader: (h) => { const t = String(h).trim(); return /^review$/i.test(t) ? "Review" : t; } });
  const rows = out.data.filter((r) => r && r.Name);
  rows.fields = (out.meta && out.meta.fields) || Object.keys(out.data[0] || {});
  return rows;
}
// Keep only the columns the stats use, so the saved copy stays small.
function slim(kind, rows) {
  const pick = (r, cols) => Object.fromEntries(cols.map((c) => [c, r[c] ?? ""]));
  const base = ["Name", "Year"];
  switch (kind) {
    case "diary": return rows.map((r) => pick(r, [...base, "Date", "Watched Date", "Rating", "Rewatch", "Tags"]));
    case "watched": return rows.map((r) => pick(r, [...base, "Date", "Letterboxd URI"]));
    case "ratings": return rows.map((r) => pick(r, [...base, "Rating"]));
    case "reviews": return rows.map((r) => pick(r, [...base, "Date", "Watched Date", "Rating", "Rewatch", "Review", "Tags"]));
    case "likes": return rows.map((r) => pick(r, base));
    case "watchlist": return rows.map((r) => pick(r, [...base, "Letterboxd URI"]));
    default: return rows;
  }
}

async function readExport(fileList) {
  if (!window.Papa) throw new Error("The CSV reader didn't load. Check your internet connection and reload the page.");
  const rows = { diary: [], watched: [], ratings: [], reviews: [], likes: [], watchlist: [], profile: [], files: [] };
  let found = 0;
  // Besides the files at the top, an export has lists/, deleted/, orphaned/ and likes/ folders, and
  // likes/ holds a reviews.csv of other people's reviews you liked. Only likes/films.csv counts from those.
  const take = (path, text) => {
    if (/(^|\/)(deleted|orphaned|lists)\//i.test(path)) return;
    const inLikes = /(^|\/)likes\//i.test(path);
    for (const [kind, re] of Object.entries(WANTED)) {
      if (inLikes && kind !== "likes") continue;
      if (re.test(path) || (kind === "likes" && LOOSE_LIKES.test(path))) {
        const parsed = kind === "profile" ? Papa.parse(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true }).data : parseCsv(text);
        if (kind === "reviews" && !parsed.fields.includes("Review")) return; // not your own reviews
        if (!parsed.length && rows[kind].length) return; // keep what an earlier copy of the file had
        rows[kind] = slim(kind, parsed); found++;
        rows.files.push((inLikes ? "likes/" : "") + path.split("/").pop().toLowerCase());
        return;
      }
    }
  };
  for (const file of fileList) {
    if (/\.zip$/i.test(file.name) || file.type.includes("zip")) {
      if (!window.JSZip) throw new Error("The ZIP reader didn't load. Check your connection, or unzip the export and import diary.csv, watched.csv and ratings.csv.");
      const zip = await JSZip.loadAsync(file);
      for (const entry of Object.values(zip.files)) {
        if (!entry.dir && /\.csv$/i.test(entry.name)) take(entry.name, await entry.async("string"));
      }
    } else if (/\.csv$/i.test(file.name)) {
      take(file.name, await file.text());
    }
  }
  rows.importedAt = new Date().toISOString(); // the newest import wins between this device and the site
  if (!rows.watched.length && !rows.diary.length && !rows.ratings.length) {
    throw new Error(found
      ? "Those files have no films in them. Import the whole export ZIP, or at least diary.csv and watched.csv."
      : "That doesn't look like a Letterboxd export. Import the ZIP you get from Settings → Data → Export your data.");
  }
  return rows;
}

// Letterboxd keeps reviews with some HTML. Keep the formatting people use (paragraphs, line breaks,
// italics, bold, quotes, lists, links) and drop everything else but its text, so a review shows as
// written and nothing in it can run. A plain-text copy is kept for search and word counts.
const REVIEW_TAGS = new Set(["P", "BR", "I", "EM", "B", "STRONG", "U", "S", "STRIKE", "BLOCKQUOTE", "UL", "OL", "LI", "A"]);
function reviewParts(raw) {
  if (!raw) return { html: "", text: "" };
  const doc = new DOMParser().parseFromString(String(raw).replace(/\r\n?/g, "\n"), "text/html");
  const clean = (node) => {
    let out = "";
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { out += esc(n.nodeValue).replace(/\n/g, "<br>"); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") continue;
      const inner = clean(n);
      if (tag === "BR") out += "<br>";
      else if (!REVIEW_TAGS.has(tag)) out += inner;
      else if (tag === "A") { const href = n.getAttribute("href") || ""; out += /^https?:\/\//i.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener nofollow">${inner}</a>` : inner; }
      else { const t = tag === "STRIKE" ? "s" : tag.toLowerCase(); out += `<${t}>${inner}</${t}>`; }
    }
    return out;
  };
  const html = clean(doc.body).replace(/^(<br>)+|(<br>)+$/g, "").trim();
  const text = html.replace(/<br>/g, "\n").replace(/<\/(p|blockquote|li)>/g, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e])).replace(/\n{3,}/g, "\n\n").trim();
  return { html, text };
}

/* ---------- the library: one record per film, one per diary entry ---------- */
function buildLibrary(input) {
  const rows = { diary: [], watched: [], ratings: [], reviews: [], likes: [], watchlist: [], profile: [], ...input };
  const films = new Map();
  // every spelling of a title in the export (and the feed) leads to the same film: the first spelling seen
  const spelling = new Map();
  const keyOf = (r) => { const t = titleKey(r.Name, r.Year); if (!spelling.has(t)) spelling.set(t, filmKey(r.Name, r.Year)); return spelling.get(t); };
  const get = (r) => {
    const k = keyOf(r);
    let f = films.get(k);
    if (!f) { f = { key: k, name: String(r.Name).trim(), year: parseInt(r.Year, 10) || null, rating: null, liked: false, entries: [], reviews: 0, uri: "" }; films.set(k, f); }
    if (!f.uri && /^https?:\/\//.test(r["Letterboxd URI"] || "")) f.uri = r["Letterboxd URI"];
    return f;
  };
  // Watched films and diary entries decide what counts as seen. Likes and reviews only mark films
  // already in it: Letterboxd lets you like a film you never logged.
  const find = (r) => films.get(keyOf(r));
  rows.watched.forEach(get);
  const rated = rows.watched.length ? find : get; // without watched.csv, a rating is the only sign of a watch
  for (const r of rows.ratings) { const v = parseFloat(r.Rating); const f = v && rated(r); if (f) f.rating = v; }
  const entries = [];
  rows.diary.forEach((r, i) => {
    const date = r["Watched Date"] || r.Date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return;
    const f = get(r);
    const logged = /^\d{4}-\d{2}-\d{2}$/.test(r.Date || "") ? r.Date : null;
    const e = { film: f, date, logged, rating: parseFloat(r.Rating) || null, rewatch: /^yes$/i.test(r.Rewatch || ""), order: i, review: false };
    f.entries.push(e); entries.push(e);
  });
  for (const r of rows.likes) { const f = find(r); if (f) f.liked = true; }
  const reviews = [];
  for (const r of rows.reviews) {
    const f = find(r);
    if (!f) continue;
    f.reviews++;
    const d = r["Watched Date"] || r.Date;
    const e = f.entries.find((x) => x.date === d) || f.entries[f.entries.length - 1];
    if (e) e.review = true;
    const { html, text } = reviewParts(r.Review);
    reviews.push({ film: f, date: /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : null, rating: parseFloat(r.Rating) || f.rating || null,
      html, text, words: text ? text.split(/\s+/).length : 0, tags: r.Tags || "", rewatch: /^yes$/i.test(r.Rewatch || ""), feed: !!r.feed });
  }
  reviews.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  entries.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order);
  for (const f of films.values()) {
    f.entries.sort((a, b) => a.date < b.date ? -1 : 1);
    if (!f.rating) { const rated = f.entries.filter((e) => e.rating); if (rated.length) f.rating = rated[rated.length - 1].rating; }
  }
  const p = rows.profile[0] || {};
  return {
    films: [...films.values()], entries, reviews,
    // a saved import from before review text was kept: the export's reviews are counted but their words are
    // missing (reviews from the daily feed have words, so they don't count here)
    reviewTextMissing: reviews.some((r) => !r.feed) && reviews.every((r) => r.feed || !r.text),
    profile: { username: p.Username || "", joined: (p["Date Joined"] || "").slice(0, 10), name: [p["Given Name"], p["Family Name"]].filter(Boolean).join(" ") },
    watchlist: rows.watchlist.length,
    // a film still on the watchlist after it was watched isn't something to watch next
    watchlistFilms: rows.watchlist.filter((r) => !films.has(keyOf(r))).map((r) => ({ key: filmKey(r.Name, r.Year), name: String(r.Name).trim(), year: parseInt(r.Year, 10) || null,
      rating: null, liked: false, entries: [], reviews: 0, uri: /^https?:\/\//.test(r["Letterboxd URI"] || "") ? r["Letterboxd URI"] : "", watchlist: true })),
  };
}

// One line saying what an import brought in, so a missing part (say, reviews) is easy to spot.
function importSummary(rows, lib) {
  const skipped = rows.reviews.length - lib.reviews.length;
  const files = rows.files || [];
  const reviews = !rows.reviews.length ? (files.includes("reviews.csv") ? "no reviews (reviews.csv in this export is empty)"
      : `no reviews, because there was no reviews.csv among the files read (${files.join(", ")})`)
    : `${plural(lib.reviews.length, "review")}${skipped > 0 ? ` (${plural(skipped, "review")} for films not in your watched list left out)` : ""}`;
  return `Imported ${plural(lib.films.length, "film")}, ${plural(lib.entries.length, "diary entry", "diary entries")} and ${reviews}.`;
}

/* ---------- metadata: one shape whether it came from TMDB, Claude or the example ---------- */
const COUNTRY_ALIASES = {
  "united states of america": "USA", "united states": "USA", "us": "USA", "u.s.": "USA", "u.s.a.": "USA", "america": "USA",
  "united kingdom": "UK", "great britain": "UK", "england": "UK", "u.k.": "UK", "britain": "UK",
  "korea, republic of": "South Korea", "republic of korea": "South Korea", "korea": "South Korea",
  "russian federation": "Russia", "czech republic": "Czechia", "hong kong sar china": "Hong Kong",
  "people's republic of china": "China", "iran, islamic republic of": "Iran", "west germany": "Germany",
};
const country = (c) => { const t = String(c).trim(); return COUNTRY_ALIASES[t.toLowerCase()] || t; };
let langNames = null;
try { langNames = new Intl.DisplayNames(["en"], { type: "language" }); } catch {}
const LANG_FIX = { cn: "Cantonese", zh: "Mandarin", xx: "No language" };
function language(l) {
  const t = String(l || "").trim();
  if (!t) return "";
  if (/^[a-z]{2}$/i.test(t)) return LANG_FIX[t.toLowerCase()] || (langNames ? langNames.of(t.toLowerCase()) : t);
  return t === "Chinese" ? "Mandarin" : t;
}
const GENRES = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction", "Thriller", "TV Movie", "War", "Western"];
function cleanMeta(m) {
  const list = (a, n = 20) => [...new Set((Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter(Boolean))].slice(0, n);
  const genre = (g) => g === "Sci-Fi" ? "Science Fiction" : g;
  return {
    src: m.src, v: m.v || null, id: m.id || null, poster: m.poster || null,
    d: list(m.d, 6), c: list(m.c, 15), w: list(m.w, 6), p: list(m.p, 4), m: list(m.m, 4),
    g: list((m.g || []).map(genre).filter((g) => GENRES.includes(g)), 6),
    k: list((m.k || []).map(country), 20), l: language(m.l), why: m.why || undefined, r: Math.round(Number(m.r)) || null,
    va: Number(m.va) || null, vc: Number(m.vc) || null, // TMDB audience score out of 10, and how many votes
    im: /^tt\d+$/.test(m.im || "") ? m.im : null, // IMDb id, for IMDb scores from OMDb
    pin: m.pin || undefined, // matched by hand, so lookups leave it alone
    ir: Number(m.ir) || null, iv: Number(m.iv) || null, mc: Number(m.mc) || null, rt: Number(m.rt) || null, om: m.om || null, // IMDb, Metacritic, Rotten Tomatoes
    y: parseInt(m.y, 10) || null, // TMDB's release year
    iy: parseInt(m.iy, 10) || null, ik: Array.isArray(m.ik) ? m.ik : undefined, il: Array.isArray(m.il) ? m.il : undefined, inf: m.inf || undefined, // IMDb's year, countries, languages
    t: m.t || undefined, // when it was looked up: of two equally good copies on two devices, the newer is kept
  };
}
// Film details, people's photos, Letterboxd averages and friends that arrive from outside this device (the diary on
// the site, a backup file) pass through these before they're kept: names stay plain text, numbers numbers, ids and
// picture paths in their expected shape. (Everything is escaped when shown as well; this is a second lock.)
const imagePath = (p) => (typeof p === "string" && /^\/[\w.-]+$/.test(p) ? p : null);
function safeMeta(m) {
  if (!m || typeof m !== "object") return null;
  const keep = { src: m.src === "claude" ? "claude" : "tmdb", ...(m.via != null ? { via: String(m.via) } : {}), ...(m.tmdbMiss ? { tmdbMiss: Number(m.tmdbMiss) || 0 } : {}) };
  if (m.miss) return { ...keep, miss: true, v: Number(m.v) || null };
  const c = cleanMeta(m);
  return { ...c, ...keep, poster: imagePath(c.poster), id: Number(c.id) || null, t: typeof m.t === "string" ? m.t.slice(0, 30) : undefined };
}
const safeMetaMap = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, m]) => [k, safeMeta(m)]).filter(([, m]) => m));
const safePhotos = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, p]) => [k, imagePath(p)]).filter(([, p]) => p));
const safeLbx = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, x]) => x && typeof x === "object").map(([k, x]) =>
  [k, { ...(x.r != null ? { r: Number(x.r) || null } : {}), ...(x.n != null ? { n: Number(x.n) || 0 } : {}), ...(typeof x.slug === "string" && /^[a-z0-9-]+$/.test(x.slug) ? { slug: x.slug } : {}),
    ...(x.tries != null ? { tries: Number(x.tries) || 0 } : {}), ...(x.v != null ? { v: Number(x.v) || 0 } : {}) }]));
const safeFriends = (a) => (Array.isArray(a) ? a : []).filter((f) => f && f.rows && typeof f.name === "string")
  .map((f) => ({ id: String(f.id || "").replace(/[^\w-]/g, "").slice(0, 40) || `f${hash32(f.name)}`, name: f.name.slice(0, 100), rows: f.rows }));

/* ---------- stats ---------- */
const CAST_DEPTH = 15; // top-billed cast counted per film

function inScope(lib, scope) {
  if (scope === "all") return { films: lib.films, entries: lib.entries };
  const entries = lib.entries.filter((e) => e.date.startsWith(scope));
  return { films: [...new Set(entries.map((e) => e.film))], entries };
}

// Highest-rated actors over all time need this many rated films each, so one great film doesn't top the list (the
// owner's call); a single year keeps the usual minimum.
const CAST_MIN_RATED = 6;
function rankPeople(films, metaOf, role, minRated) {
  const map = new Map();
  for (const f of films) {
    const m = metaOf(f);
    if (!m || !m[role]) continue;
    const names = role === "c" ? m.c.slice(0, CAST_DEPTH) : m[role];
    const seen = new Set();
    for (const name of names) {
      const k = personKey(name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      let p = map.get(k);
      if (!p) { p = { key: k, name, films: [], ratings: [] }; map.set(k, p); }
      p.films.push(f);
      if (f.rating) p.ratings.push(f.rating);
    }
  }
  const all = [...map.values()].map((p) => ({ ...p, count: p.films.length, avg: avg(p.ratings) }));
  const most = [...all].sort((a, b) => b.count - a.count || (b.avg || 0) - (a.avg || 0) || a.name.localeCompare(b.name));
  const best = all.filter((p) => p.ratings.length >= minRated)
    .sort((a, b) => b.avg - a.avg || b.ratings.length - a.ratings.length || a.name.localeCompare(b.name));
  return { most, best, total: all.length };
}

function rankCategory(films, metaOf, field) {
  const map = new Map();
  for (const f of films) {
    const m = metaOf(f);
    if (!m) continue;
    const vals = field === "l" ? (m.l ? [m.l] : []) : [...new Set(m[field] || [])];
    for (const v of vals) {
      let c = map.get(v);
      if (!c) { c = { key: v, name: v, films: [], ratings: [] }; map.set(v, c); }
      c.films.push(f); if (f.rating) c.ratings.push(f.rating);
    }
  }
  const all = [...map.values()].map((c) => ({ ...c, count: c.films.length, avg: avg(c.ratings) }));
  return {
    most: [...all].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    best: all.filter((c) => c.ratings.length >= 3).sort((a, b) => b.avg - a.avg || b.count - a.count),
  };
}

function longestStreak(entries) {
  const days = [...new Set(entries.map((e) => dayIndex(e.date)))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = null, endDay = null;
  for (const d of days) { run = prev !== null && d === prev + 1 ? run + 1 : 1; if (run > best) { best = run; endDay = d; } prev = d; }
  return { days: best, end: endDay };
}

function computeStats(lib, metaOf, scope) {
  const { films, entries } = inScope(lib, scope);
  const viewsOf = (f) => Math.max(1, scope === "all" ? f.entries.length : f.entries.filter((e) => e.date.startsWith(scope)).length);
  const withMeta = films.filter((f) => metaOf(f));
  let minutes = 0, timed = 0;
  for (const f of films) { const m = metaOf(f); if (m && m.r) { minutes += m.r * viewsOf(f); timed++; } }
  const rated = films.filter((f) => f.rating);
  const spread = Array.from({ length: 10 }, (_, i) => ({ r: (i + 1) / 2, count: 0 }));
  for (const f of rated) { const i = Math.round(f.rating * 2) - 1; if (spread[i]) spread[i].count++; }

  // activity
  const byDay = new Map();
  for (const e of entries) byDay.set(e.date, (byDay.get(e.date) || 0) + 1);
  const weekday = Array(7).fill(0);
  for (const e of entries) weekday[weekdayOf(e.date)]++;
  const byMonth = new Map();
  for (const e of entries) byMonth.set(e.date.slice(0, 7), (byMonth.get(e.date.slice(0, 7)) || 0) + 1);
  let busiestMonth = null;
  for (const [k, v] of byMonth) if (!busiestMonth || v > busiestMonth.count) busiestMonth = { key: k, count: v };
  let busiestDay = null;
  for (const [k, v] of byDay) if (!busiestDay || v > busiestDay.count) busiestDay = { key: k, count: v };

  // release decades
  const dec = new Map();
  for (const f of films) {
    if (!f.year) continue;
    const d = Math.floor(f.year / 10) * 10;
    let x = dec.get(d); if (!x) { x = { decade: d, films: [], ratings: [] }; dec.set(d, x); }
    x.films.push(f); if (f.rating) x.ratings.push(f.rating);
  }
  const decades = [...dec.values()].map((x) => ({ ...x, count: x.films.length, avg: avg(x.ratings),
    top: [...x.films].filter((f) => f.rating).sort((a, b) => b.rating - a.rating || b.entries.length - a.entries.length).slice(0, 8) }))
    .sort((a, b) => a.decade - b.decade);

  const minRated = films.length >= 150 ? 3 : 2;
  return {
    scope, films, entries, withMeta: withMeta.length, minRated, castMinRated: scope === "all" ? CAST_MIN_RATED : minRated,
    minutes, timed,
    avgRating: avg(rated.map((f) => f.rating)), rated: rated.length, spread,
    rewatches: entries.filter((e) => e.rewatch).length,
    reviews: scope === "all" ? films.reduce((s, f) => s + f.reviews, 0) : entries.filter((e) => e.review).length,
    likes: films.filter((f) => f.liked).length,
    byDay, byMonth, weekday, busiestMonth, busiestDay, streak: longestStreak(entries),
    decades,
    cast: rankPeople(films, metaOf, "c", scope === "all" ? CAST_MIN_RATED : minRated), directors: rankPeople(films, metaOf, "d", minRated),
    writers: rankPeople(films, metaOf, "w", minRated), dop: rankPeople(films, metaOf, "p", minRated), music: rankPeople(films, metaOf, "m", minRated),
    genres: rankCategory(films, metaOf, "g"), countries: rankCategory(films, metaOf, "k"), languages: rankCategory(films, metaOf, "l"),
    newReleases: scope === "all" ? null : films.filter((f) => String(f.year) === scope).length,
  };
}
</script>
