<script>
/* ---------- small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
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
const personKey = (n) => String(n).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const dayIndex = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);
const weekdayOf = (iso) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0

const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const KEYS = { rows: "cr-rows-v1", meta: "cr-meta-v1", photos: "cr-photos-v1", tmdb: "cr-tmdb-key", omdb: "cr-omdb-key", apify: "cr-apify-key", lbx: "cr-letterboxd-v1", lbRun: "cr-letterboxd-run", friends: "cr-friends-v1", view: "cr-view-v1" };

/* ---------- reading a Letterboxd export ---------- */
const WANTED = {
  diary: /(^|\/)diary\.csv$/i, watched: /(^|\/)watched\.csv$/i, ratings: /(^|\/)ratings\.csv$/i,
  reviews: /(^|\/)reviews\.csv$/i, likes: /(^|\/)likes\/films\.csv$/i, watchlist: /(^|\/)watchlist\.csv$/i,
  profile: /(^|\/)profile\.csv$/i,
};
const LOOSE_LIKES = /^films\.csv$/i; // likes/films.csv dropped on its own

function parseCsv(text) {
  const out = Papa.parse(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  return out.data.filter((r) => r && r.Name);
}
// Keep only the columns the stats use, so the saved copy stays small.
function slim(kind, rows) {
  const pick = (r, cols) => Object.fromEntries(cols.map((c) => [c, r[c] ?? ""]));
  const base = ["Name", "Year"];
  switch (kind) {
    case "diary": return rows.map((r) => pick(r, [...base, "Date", "Watched Date", "Rating", "Rewatch", "Tags"]));
    case "watched": return rows.map((r) => pick(r, [...base, "Date", "Letterboxd URI"]));
    case "ratings": return rows.map((r) => pick(r, [...base, "Rating"]));
    case "reviews": return rows.map((r) => pick(r, [...base, "Date", "Watched Date"]));
    case "likes": case "watchlist": return rows.map((r) => pick(r, base));
    default: return rows;
  }
}

async function readExport(fileList) {
  if (!window.Papa) throw new Error("The CSV reader didn't load. Check your internet connection and reload the page.");
  const rows = { diary: [], watched: [], ratings: [], reviews: [], likes: [], watchlist: [], profile: [] };
  let found = 0;
  const take = (path, text) => {
    if (/(^|\/)(deleted|orphaned)\//i.test(path)) return;
    for (const [kind, re] of Object.entries(WANTED)) {
      if (re.test(path) || (kind === "likes" && LOOSE_LIKES.test(path))) {
        const parsed = kind === "profile" ? Papa.parse(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true }).data : parseCsv(text);
        rows[kind] = slim(kind, parsed); found++; return;
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
  if (!rows.watched.length && !rows.diary.length && !rows.ratings.length) {
    throw new Error(found
      ? "Those files have no films in them. Import the whole export ZIP, or at least diary.csv and watched.csv."
      : "That doesn't look like a Letterboxd export. Import the ZIP you get from Settings → Data → Export your data.");
  }
  return rows;
}

/* ---------- the library: one record per film, one per diary entry ---------- */
function buildLibrary(input) {
  const rows = { diary: [], watched: [], ratings: [], reviews: [], likes: [], watchlist: [], profile: [], ...input };
  const films = new Map();
  const get = (r) => {
    const k = filmKey(r.Name, r.Year);
    let f = films.get(k);
    if (!f) { f = { key: k, name: String(r.Name).trim(), year: parseInt(r.Year, 10) || null, rating: null, liked: false, entries: [], reviews: 0 }; films.set(k, f); }
    return f;
  };
  // Watched films and diary entries decide what counts as seen. Likes and reviews only mark films
  // already in it: Letterboxd lets you like a film you never logged.
  const find = (r) => films.get(filmKey(r.Name, r.Year));
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
  for (const r of rows.reviews) {
    const f = find(r);
    if (!f) continue;
    f.reviews++;
    const d = r["Watched Date"] || r.Date;
    const e = f.entries.find((x) => x.date === d) || f.entries[f.entries.length - 1];
    if (e) e.review = true;
  }
  entries.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order);
  for (const f of films.values()) {
    f.entries.sort((a, b) => a.date < b.date ? -1 : 1);
    if (!f.rating) { const rated = f.entries.filter((e) => e.rating); if (rated.length) f.rating = rated[rated.length - 1].rating; }
  }
  const p = rows.profile[0] || {};
  return {
    films: [...films.values()], entries,
    profile: { username: p.Username || "", joined: (p["Date Joined"] || "").slice(0, 10), name: [p["Given Name"], p["Family Name"]].filter(Boolean).join(" ") },
    watchlist: rows.watchlist.length,
    watchlistFilms: rows.watchlist.map((r) => ({ key: filmKey(r.Name, r.Year), name: String(r.Name).trim(), year: parseInt(r.Year, 10) || null })),
  };
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
    k: list((m.k || []).map(country), 6), l: language(m.l), r: Math.round(Number(m.r)) || null,
    va: Number(m.va) || null, vc: Number(m.vc) || null, // TMDB audience score out of 10, and how many votes
    im: /^tt\d+$/.test(m.im || "") ? m.im : null, // IMDb id, for IMDb scores from OMDb
    ir: Number(m.ir) || null, iv: Number(m.iv) || null, mc: Number(m.mc) || null, rt: Number(m.rt) || null, om: m.om || null, // IMDb, Metacritic, Rotten Tomatoes
  };
}

/* ---------- stats ---------- */
const CAST_DEPTH = 15; // top-billed cast counted per film

function inScope(lib, scope) {
  if (scope === "all") return { films: lib.films, entries: lib.entries };
  const entries = lib.entries.filter((e) => e.date.startsWith(scope));
  return { films: [...new Set(entries.map((e) => e.film))], entries };
}

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
    const vals = field === "l" ? (m.l ? [m.l] : []) : m[field] || [];
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
    top: [...x.films].filter((f) => f.rating).sort((a, b) => b.rating - a.rating || b.entries.length - a.entries.length).slice(0, 5) }))
    .sort((a, b) => a.decade - b.decade);

  const minRated = films.length >= 150 ? 3 : 2;
  return {
    scope, films, entries, withMeta: withMeta.length, minRated,
    minutes, timed,
    avgRating: avg(rated.map((f) => f.rating)), rated: rated.length, spread,
    rewatches: entries.filter((e) => e.rewatch).length,
    reviews: scope === "all" ? films.reduce((s, f) => s + f.reviews, 0) : entries.filter((e) => e.review).length,
    likes: films.filter((f) => f.liked).length,
    byDay, byMonth, weekday, busiestMonth, busiestDay, streak: longestStreak(entries),
    decades,
    cast: rankPeople(films, metaOf, "c", minRated), directors: rankPeople(films, metaOf, "d", minRated),
    writers: rankPeople(films, metaOf, "w", minRated), dop: rankPeople(films, metaOf, "p", minRated), music: rankPeople(films, metaOf, "m", minRated),
    genres: rankCategory(films, metaOf, "g"), countries: rankCategory(films, metaOf, "k"), languages: rankCategory(films, metaOf, "l"),
    newReleases: scope === "all" ? null : films.filter((f) => String(f.year) === scope).length,
  };
}
</script>
