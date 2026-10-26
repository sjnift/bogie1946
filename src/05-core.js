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
// The footer's "Updated …": when this version was built (filled in by build.sh), in the time zone the site is viewed
// from, with its name ("25 Oct 2026, 18:17 IST"; asked Oct 2026). Only the footer: diary dates belong to no time zone.
const BUILT_ISO = "<!--BUILT-ISO-->";
function builtText() {
  const d = new Date(BUILT_ISO), p2 = (n) => String(n).padStart(2, "0");
  if (isNaN(d)) return "<!--BUILD-->";
  let zone = "";
  for (const loc of [undefined, "en-IN", "en-US"]) { // a short name like IST or PDT where the browser has one, else GMT+5:30
    try { const z = new Intl.DateTimeFormat(loc, { timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName");
      if (z && /^[A-Z]{2,5}$/.test(z.value)) { zone = z.value; break; } zone = zone || (z && z.value) || ""; } catch {}
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}${zone ? ` ${zone}` : ""}`;
}
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
// A person's name as a key: accents and case aside, letters of any script kept (a name with no Latin letters, 김청아,
// used to come out empty and its person went uncounted; Cem Yılmaz kept his ı).
const personKey = (n) => String(n).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
const dayIndex = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);
const weekdayOf = (iso) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0

// Posters and photos come from TMDB's picture server, image.tmdb.org. Where a device can't reach it (some internet
// providers in India block TMDB now and then; the owner lost every picture to it, Oct 2026), the same pictures come
// through wsrv.nl, a free image relay that fetches them from TMDB on its own servers. The app switches by itself when
// TMDB's pictures fail and none has loaded, or when a check at start finds TMDB silent (below), re-points the pictures
// on screen, and remembers it for a week.
const IMG_TMDB = "https://image.tmdb.org/t/p/", IMG_RELAY = "https://wsrv.nl/?url=image.tmdb.org/t/p/", IMG_VIA_KEY = "cr-img-via";
let IMG_VIA = (() => { try { const v = JSON.parse(localStorage.getItem(IMG_VIA_KEY) || "null"); return v && v.via === "relay" && Date.now() - v.at < 7 * 864e5 ? "relay" : "tmdb"; } catch { return "tmdb"; } })();
const imgBase = (size = "w185") => (IMG_VIA === "relay" ? IMG_RELAY : IMG_TMDB) + size;
const IMG_SEEN = { ok: 0, bad: 0, held: [], timer: null };
function imgUse(via) {
  if (IMG_VIA === via) return;
  const [from, to] = via === "relay" ? [IMG_TMDB, IMG_RELAY] : [IMG_RELAY, IMG_TMDB];
  IMG_VIA = via;
  try { if (via === "relay") localStorage.setItem(IMG_VIA_KEY, JSON.stringify({ via, at: Date.now() })); else localStorage.removeItem(IMG_VIA_KEY); } catch {}
  IMG = imgBase(); // the layouts' own base for pictures (07-render-a, m03-screens)
  for (const i of [...IMG_SEEN.held, ...document.querySelectorAll(`img[src^="${from}"]`)]) { i.style.visibility = ""; if (i.src.startsWith(from)) i.src = to + i.src.slice(from.length); }
  IMG_SEEN.held = [];
}
const imgRelay = () => imgUse("relay");
/* Some connections don't refuse TMDB but leave its pictures hanging, so none ever fails and the switch never comes
   (the owner's phone, Oct 2026). So at start one of the diary's own posters, picked at random so it's rarely one the
   browser kept, is asked of TMDB and of the relay at once: TMDB is used if it answers, the relay if it answers and
   TMDB hasn't within 5 seconds, or has failed. A device that used the relay last time starts with it (so pictures show
   at once) and goes back to TMDB if TMDB answers. `IMG_STATE` is what Settings says: "checking", "tmdb", "relay", or
   "none" when neither answered in 20 seconds; "Check again" there asks again. */
let IMG_STATE = "", IMG_TRIES = 0;
function imgProbe() {
  if (IMG_STATE === "checking") return;
  const paths = [];
  for (const m of Object.values(typeof META === "object" && META || {})) if (m && imagePath(m.poster)) paths.push(m.poster);
  if (!paths.length) { // nothing to show yet: look again once films have details (a first import), for a while
    if (IMG_TRIES++ < 80) setTimeout(imgProbe, 15000);
    return;
  }
  const path = paths[Math.floor(Math.random() * paths.length)];
  const got = {}, t0 = Date.now(), timers = [];
  const done = (via) => {
    IMG_STATE = via; timers.forEach(clearTimeout);
    if (via === "none") { for (const i of IMG_SEEN.held) i.remove(); IMG_SEEN.held = []; }
    else { if (via === "tmdb") IMG_SEEN.ok++; imgUse(via); } // TMDB answers: a picture that fails later is just missing
    for (const e of document.querySelectorAll("[data-img-status]")) e.innerHTML = imgStatusHtml();
  };
  const decide = () => {
    if (IMG_STATE !== "checking") return;
    if (got.tmdb) return done("tmdb");
    if (got.relay && (got.tmdb === false || Date.now() - t0 >= 5000)) return done("relay");
    if (got.tmdb === false && got.relay === false) return done("none");
    if (Date.now() - t0 >= 20000) done("none");
  };
  IMG_STATE = "checking";
  for (const via of ["tmdb", "relay"]) {
    const i = new Image();
    i.onload = () => { got[via] = i.naturalWidth > 0; decide(); };
    i.onerror = () => { got[via] = false; decide(); };
    i.src = (via === "relay" ? IMG_RELAY : IMG_TMDB) + "w92" + path;
  }
  timers.push(setTimeout(decide, 5000), setTimeout(decide, 20000));
}
function imgStatusHtml() {
  const again = ` <button type="button" class="linkish" data-img-check>Check again</button>`;
  if (IMG_STATE === "relay") return `TMDB's picture server can't be reached from this device (some internet providers block it), so posters and photos come through <b>wsrv.nl</b>, a free picture relay. TMDB is tried again each time the app opens.${again}`;
  if (IMG_STATE === "none") return `Neither TMDB's picture server nor the relay answered on this device, so films show title cards instead of posters. Another connection (Wi-Fi instead of mobile data, or the other way round) may bring them back.${again}`;
  if (IMG_STATE === "tmdb") return "Posters and photos come straight from TMDB.";
  if (IMG_STATE === "checking") return "Checking how this device reaches posters and photos…";
  return IMG_VIA === "relay" ? "Posters and photos come through wsrv.nl, a free picture relay, because TMDB's picture server couldn't be reached from this device." : "Posters and photos come from TMDB.";
}
document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-img-check]")) { IMG_TRIES = 0; imgProbe(); for (const x of document.querySelectorAll("[data-img-status]")) x.innerHTML = imgStatusHtml(); } });
// Pictures that fail to load are taken away (a title card or initials show instead), and a phone poster fades in once
// it has loaded. Done here, for the whole page, rather than with onerror/onload in the markup: the page's security
// policy runs no code written in the markup. On the document, not the window: a picture's "load" never reaches the
// window (browsers stop it at the document), so from 23 to 25 Oct 2026 no phone poster or photo ever faded in.
document.addEventListener("error", (e) => {
  const t = e.target;
  if (!t || t.tagName !== "IMG") return;
  // TMDB's server and nothing from it has loaded yet: held back (out of sight) until it's clear whether it's blocked
  if (t.src.startsWith(IMG_TMDB) && IMG_VIA === "tmdb" && !IMG_SEEN.ok) {
    IMG_SEEN.bad++; IMG_SEEN.held.push(t); t.style.visibility = "hidden";
    if (IMG_SEEN.bad >= 2) imgRelay();
    else if (!IMG_SEEN.timer) IMG_SEEN.timer = setTimeout(() => { if (!IMG_SEEN.ok) imgRelay(); }, 4000);
    return;
  }
  if (!t.closest("#share-img, .share-img")) t.remove();
}, true);
document.addEventListener("load", (e) => {
  const t = e.target;
  if (!t || t.tagName !== "IMG") return;
  if (t.src.startsWith(IMG_TMDB) && !IMG_SEEN.ok) { IMG_SEEN.ok++; for (const i of IMG_SEEN.held) i.remove(); IMG_SEEN.held = []; } // reachable: those were just missing
  if (t.classList.contains("fade")) t.classList.add("in");
}, true);
const KEYS = { rows: "cr-rows-v1", meta: "cr-meta-v1", photos: "cr-photos-v1", tmdb: "cr-tmdb-key", omdb: "cr-omdb-key", apify: "cr-apify-key", lbx: "cr-letterboxd-v1", lbRun: "cr-letterboxd-run", icRun: "cr-imdbcast-run", facts: "cr-people-v1", friends: "cr-friends-v1", view: "cr-view-v1", filmo: "cr-filmo-v1" };
/* Small things (keys, the view) live in localStorage. The big ones (the export, film details, Letterboxd
   averages, friends' exports) live in IndexedDB, which holds far more than localStorage's few megabytes.
   store.init() reads them into memory once at start; after that reads are instant and writes go to the
   database in the background. Without IndexedDB everything stays in localStorage, as before. */
const BIG_KEYS = new Set([KEYS.rows, KEYS.meta, KEYS.photos, KEYS.lbx, KEYS.friends, KEYS.filmo, KEYS.facts]);
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
/* ---------- how a film's cast is counted (rebuilt 26 Oct 2026) ----------
   The owner: "I don't want cameos to populate and take over the most watched list, which is the case of Stan Lee and
   Samuel Jackson. Take a tough stand on cameos, but keep in mind any extended roles, to not unjustly deny them", and
   voice roles in a tab of their own, "so they do not mix with live action acting". Stan Lee's Marvel cameos are
   credited bit parts on TMDB ("Bus Driver", "Hot Dog Vendor") or himself ("Stan Lee"); Samuel L. Jackson's Nick Fury
   in Avengers: Endgame is a credited role billed 53rd of 103. So, role by role, in billing order (`sortCast`):
   1. What `roleSkip` says doesn't count, doesn't: no character, uncredited, labelled a cameo, archive footage, cut.
   2. Additional voices, loop groups and the like (a studio's crowd of voices) don't count either.
   3. A voice role ("(voice)", or every role of an animated film where TMDB marks none) goes to Voices (`v`), apart
      from on-screen roles (`c`).
   4. A cameo, though credited, and listed with why (`x`, `xi`, `xw`):
      - "source": someone who also wrote what the film is based on (comic book, characters, novel, play…), billed
        below the top SOURCE_FROM: Stan Lee in Marvel films, Stephen King in his adaptations;
      - "self": someone playing themselves (Self, Himself, their own name) in a film that isn't a documentary, billed
        below the top SELF_FROM: Stan Lee as "Stan Lee", a star in a song; unless its leads play themselves too (This Is
        the End: two or more of its top three);
      - and, worked out over every film kept here (`peopleIndex`, `walkOn`): "star", a star at the time far down a
        cast: billed STAR_FROM or lower and in the lower half, where over their other films within STAR_YEARS either
        side (STAR_FILMS or more) they were billed near the top (a median place under STAR_TOP, or up to STAR_NEAR and
        here STAR_DEEP times lower): Samuel L. Jackson's Nick Fury in Endgame, 51st of 97 on screen (but not his Stacks
        Edwards in GoodFellas, from before he was a star, nor Drax and Star-Lord, mid-cast in Infinity War); and "habit",
        someone who mostly turns up in cameos (CAMEO_HABIT or more, and at least twice their other roles) in a role below
        the top SOURCE_FROM: Stan Lee where TMDB doesn't list him among the makers (X-Men, Deadpool).
   Never a cameo: the top SELF_FROM billed, and an extended cameo or special appearance that names its character
   ("Tiger (Extended Cameo)": a credited part of some length, kept in `ce`). A documentary's "Self" is its subject. */
const SOURCE_JOBS = new Set(["Characters", "Comic Book", "Novel", "Book", "Short Story", "Graphic Novel", "Author", "Play", "Theatre Play", "Musical", "Original Concept", "Creator"]);
const SOURCE_FROM = 5, SELF_FROM = 3, CAMEO_HABIT = 3;
const STAR_FROM = 20, STAR_YEARS = 5, STAR_FILMS = 3, STAR_TOP = 3, STAR_NEAR = 5, STAR_DEEP = 8;
const BACKGROUND_VOICES = /^\s*(?:additional|various|other|background|incidental|miscellaneous|extra)\s+voices?\b|\bloop\s*group\b|\bADR\b|\bwalla\b/i;
const VOICE = /\bvoices?\b/i;
const SELF_ROLE = /^\s*(?:self|him\s*self|her\s*self|them\s*selves|themself)\b/i;
const NAMED_APPEARANCE = /\b(?:extended\s+cameo|(?:special|guest|friendly)\s+appearances?)\b/i;
const playsSelf = (name, character) => SELF_ROLE.test(character) || personKey(String(character).replace(/\((?:voice|uncredited)\)/gi, "")) === personKey(name);
// `list`: the credits in billing order, each { name, id, character }; `crewJobs`: TMDB person id → the film's crew jobs.
function sortCast(list, { crewJobs = new Map(), documentary = false, animation = false } = {}) {
  const live = [], voice = [], cameos = [], extended = [];
  const tagged = list.some((c) => VOICE.test(c.character || ""));
  // a film whose leads play themselves (This Is the End): its other selves are its cast, not cameos
  const selfFilm = list.filter((c) => !roleSkip(c.character)).slice(0, 3).filter((c) => playsSelf(c.name, c.character || "")).length >= 2;
  for (const c of list) {
    const ch = String(c.character || "");
    const why = roleSkip(ch);
    if (why) { if (why === "cameo") cameos.push({ ...c, why: "cameo" }); continue; }
    if (BACKGROUND_VOICES.test(ch)) continue;
    const into = VOICE.test(ch) || (animation && !tagged) ? voice : live, place = into.length;
    if (NAMED_APPEARANCE.test(ch)) { extended.push(c.id); into.push(c); continue; }
    const job = [...(crewJobs.get(c.id) || [])].find((j) => SOURCE_JOBS.has(j));
    if (job && place >= SOURCE_FROM) { cameos.push({ ...c, why: `source:${job}` }); continue; }
    if (!documentary && !selfFilm && place >= SELF_FROM && playsSelf(c.name, ch)) { cameos.push({ ...c, why: "self" }); continue; }
    into.push(c);
  }
  // small parts that need TMDB's characters and popularity, found here and kept by id (`smallPart`, `walkOn`): bit
  // parts below the top BIT_FROM (not in a film whose top 5 are mostly credited so: 12 Angry Men's jurors), and people
  // below the top PRINCIPAL, in the upper half, STAND_OUT times as well known on TMDB as those billed around them
  const bits = [], standout = [], median = (a) => { a = [...a].sort((x, y) => x - y); return a.length ? (a[(a.length - 1) >> 1] + a[a.length >> 1]) / 2 : 0; };
  for (const into of [live, voice]) {
    if (into.slice(0, 5).filter((c) => bitPart(c.character)).length < 3) into.forEach((c, i) => { if (i >= BIT_FROM && c.id && bitPart(c.character)) bits.push(c.id); });
    const pop = into.map((c) => Number(c.popularity) || 0);
    into.forEach((c, i) => {
      if (i < PRINCIPAL || i >= into.length / 2 || !c.id) return;
      const near = median([...pop.slice(Math.max(0, i - 5), i), ...pop.slice(i + 1, i + 6)]);
      if (pop[i] >= 2 && pop[i] >= STAND_OUT * near) standout.push(c.id);
    });
  }
  return { live, voice, cameos, extended, bits, standout };
}
// What a cameo's reason reads as.
const cameoWhy = (w) => w === "self" ? "playing themselves" : w === "star" ? "a star far down the cast" : w === "habit" ? "mostly turns up in cameos" : w === "returning" ? "a lead earlier in the series, back in a small part" : /^source:/.test(w) ? `wrote the ${w.slice(7).toLowerCase()} it's based on` : "labelled a cameo";
// A film's people in a role with their TMDB person ids, kept in step (`ci` beside `c`, `di` beside `d`…): each
// person once, by id where TMDB gave one, since two people can share a name (see `peopleIndex`).
// Where each role is kept in a film's details: voices in `vo` (`v` is the details' version), ids beside each.
const ROLE_FIELD = { c: "c", v: "vo", d: "d", w: "w", p: "p", m: "m" };
const ROLE_IDS = { c: "ci", v: "voi", d: "di", w: "wi", p: "pi", m: "mi" };
function metaPeople(m, role, n) {
  const f = ROLE_FIELD[role], names = Array.isArray(m[f]) ? m[f] : [], ids = Array.isArray(m[ROLE_IDS[role]]) ? m[ROLE_IDS[role]] : [];
  const out = [], outIds = [], seen = new Set();
  names.forEach((x, i) => {
    const name = String(x).trim(), id = Number(ids[i]) || 0, k = id ? `#${id}` : `=${name.toLowerCase()}`;
    if (!name || seen.has(k) || out.length >= n) return;
    seen.add(k); out.push(name); outIds.push(id);
  });
  return { ...(out.length || role !== "v" ? { [f]: out } : {}), ...(outIds.some(Boolean) ? { [ROLE_IDS[role]]: outIds } : {}) };
}
// The cameos a film's cast had, with why: names, ids and reasons kept in step.
function cameoList(m) {
  const n = Array.isArray(m.x) ? m.x : [], i = Array.isArray(m.xi) ? m.xi : [], w = Array.isArray(m.xw) ? m.xw : [], out = { x: [], xi: [], xw: [] };
  n.forEach((name, k) => { const s = String(name).trim().slice(0, 120), why = String(w[k] || "cameo").slice(0, 40);
    if (s && out.x.length < 60 && /^(?:cameo|self|source:[\w ]{1,30})$/.test(why)) { out.x.push(s); out.xi.push(Number(i[k]) || 0); out.xw.push(why); } });
  return out.x.length ? out : {};
}
// IMDb person ids by TMDB person id or by name, as the IMDb cast check found them (06d)
const imdbOf = (o, keyOk) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([k, v]) => keyOk(k) && /^nm\d{1,10}$/.test(v)).slice(0, 400));
function cleanMeta(m) {
  const list = (a, n = 20) => [...new Set((Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter(Boolean))].slice(0, n);
  const genre = (g) => g === "Sci-Fi" ? "Science Fiction" : g;
  return {
    src: m.src, v: m.v || null, id: m.id || null, poster: m.poster || null,
    ...(Number(m.tv) ? { tv: Number(m.tv), ...(Number(m.ep) && m.se != null ? { se: Number(m.se) || 0, ep: Number(m.ep) } : {}) } : {}), // on TMDB's TV side (06-lookup)
    ...metaPeople(m, "d", 40), ...metaPeople(m, "c", 300), ...metaPeople(m, "v", 300), ...metaPeople(m, "w", 20), ...metaPeople(m, "p", 10), ...metaPeople(m, "m", 10),
    ...cameoList(m), ...(Array.isArray(m.ce) && m.ce.length ? { ce: m.ce.map(Number).filter(Boolean).slice(0, 40) } : {}),
    ...(Array.isArray(m.un) && m.un.length ? { un: m.un.map(Number).filter(Boolean).slice(0, 300) } : {}), // bit parts (`smallPart`)
    ...(Array.isArray(m.so) && m.so.length ? { so: m.so.map(Number).filter(Boolean).slice(0, 40) } : {}), // well known among unknowns (`walkOn`)
    g: list((m.g || []).map(genre).filter((g) => GENRES.includes(g)), 6),
    k: list((m.k || []).map(country), 20), l: language(m.l), why: m.why || undefined, r: Math.round(Number(m.r)) || null,
    va: Number(m.va) || null, vc: Number(m.vc) || null, // TMDB audience score out of 10, and how many votes
    im: /^tt\d+$/.test(m.im || "") ? m.im : null, // IMDb id, for IMDb scores from OMDb
    pin: m.pin || undefined, // matched by hand, so lookups leave it alone
    ir: Number(m.ir) || null, iv: Number(m.iv) || null, mc: Number(m.mc) || null, rt: Number(m.rt) || null, om: m.om || null, // IMDb, Metacritic, Rotten Tomatoes
    y: parseInt(m.y, 10) || null, // TMDB's release year
    ...(Number(m.cl) ? { cl: Number(m.cl) } : {}), // the series it's part of on TMDB (`walkOn`, "returning")
    iy: parseInt(m.iy, 10) || null, ik: Array.isArray(m.ik) ? m.ik : undefined, il: Array.isArray(m.il) ? m.il : undefined, inf: m.inf || undefined, // IMDb's year, countries, languages
    t: m.t || undefined, // when it was looked up: of two equally good copies on two devices, the newer is kept
    // the owner's cast checked on IMDb (06d, `castCheck`): when, added, taken off, and whether IMDb's list was partial
    ...(m.cq ? { cq: String(m.cq).slice(0, 10), ca: list(m.ca, 300), cr: list(m.cr, 300), ...(m.cp ? { cp: true } : {}),
      cn: imdbOf(m.cn, (k) => /^\d{1,9}$/.test(k)), can: imdbOf(m.can, (k) => k.length <= 120) } : {}),
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
    ...(x.tries != null ? { tries: Number(x.tries) || 0 } : {}), ...(x.v != null ? { v: Number(x.v) || 0 } : {}), ...(x.few ? { few: x.few === 2 ? 2 : true } : {}), ...(x.pv ? { pv: Number(x.pv) || 0 } : {}) }]));
const safeFriends = (a) => (Array.isArray(a) ? a : []).filter((f) => f && f.rows && typeof f.name === "string")
  .map((f) => ({ id: String(f.id || "").replace(/[^\w-]/g, "").slice(0, 40) || `f${hash32(f.name)}`, name: f.name.slice(0, 100), rows: f.rows }));

/* ---------- stats ---------- */
// The top billed of a film, whose photos are always kept (06-lookup, `keepPhotos`).
const CAST_BILLED = 15;
/* Whether a role counts in "Most watched", by Letterboxd's rule: roles it marks as cameos don't, "for instance if
   there is no character name associated with the role or it is listed as uncredited" (its help centre, the "Stan Lee
   rule"). TMDB, where Letterboxd's cast comes from, writes what a role is in its character (its bible: "(uncredited)",
   "(archive footage)", "(voice)"), and Indian films often credit a cameo as one. So, role by role (asked 26 Oct 2026,
   "finely treading the line"), a role doesn't count when it
   - has no character name (nothing, or only punctuation), or is uncredited;
   - is a cameo: "Cameo", "Cameo Appearance", "Dancer (cameo appearance)", "Self - Cameo";
   - is a special, guest or friendly appearance with no character of its own ("Special Appearance", "Guest Appearance",
     "Special Appearance in 'Maahi Ve' Song"); one that names its character ("Mohan Bhargav (Special Appearance)")
     is a credited part, and counts;
   - is archive footage or sound (filmed for something else: Elvis in Forrest Gump), a deleted scene, or credit only.
   An extended cameo that names its character ("Tiger (Extended Cameo)") counts: a credited part of some length, which
   is what sets it apart from a cameo; a bare "Extended Cameo" doesn't. Voice roles, "Self" and narrators count.
   Letterboxd also marks some cameos by hand (Stan Lee's in Avengers: Endgame is "Driver (1970)" on TMDB), which no
   outside data shows. Returns why a role doesn't count, or "" when it does. */
const ROLE_SKIP = [
  [/\buncredited\b/i, "uncredited"], [/\barchiv(?:e|al)\s+(?:footage|sound|audio|material|recordings?|photos?|images?|clips?)\b/i, "archive footage"],
  [/\b(scenes?\s+deleted|deleted\s+scenes?|credit\s+only)\b/i, "not in the film"],
];
// "cameo" as a label, not a word in a character's name ("Man in Cameo Shop")
const CAMEO_LABEL = /\(\s*cameo\b[^)]*\)|(?:^|[-–—:|,/]\s*)cameo(?:\s+(?:appearance|role))?\s*$|^\s*cameo\b/i;
const APPEARANCE = /\b(?:extended\s+cameo(?:\s+(?:appearance|role))?|(?:special|guest|friendly)\s+appearances?(?:\s+in\b.*)?)/gi;
function roleSkip(character) {
  const s = String(character == null ? "" : character).trim();
  if (!/[\p{L}\p{N}]/u.test(s)) return "no character";
  for (const [re, why] of ROLE_SKIP) if (re.test(s)) return why;
  if (CAMEO_LABEL.test(s.replace(APPEARANCE, " ").trim())) return "cameo"; // a cameo, other than an extended one
  // what's left of the character once the appearance is taken out: a name of its own, or nothing
  const own = s.replace(APPEARANCE, " ").replace(/\(\s*\)|\[\s*\]/g, " ").replace(/[\s()[\]\-–—:,;/|"'“”‘’]+/g, " ").trim();
  return /[\p{L}\p{N}]/u.test(own) ? "" : "cameo";
}
/* ---------- people, as TMDB knows them: by id ----------
   Two people can share a name: the owner found Paul Guilfoyle, born 1949, credited with 1940s films (26 Oct 2026); those
   were Paul Guilfoyle, 1902–1961. TMDB keeps them apart; the site had matched people by name, so it put them together
   (and showed one face for both). Now each name in a film goes with its TMDB person id (`ci` beside `c`…), and a name
   that belongs to two or more people in the films kept here is shown, counted, pictured and looked up apart for each:
   "Paul Guilfoyle (1902–1961)", "Paul Guilfoyle (born 1949)", from TMDB's dates (`FACTS`, 06-lookup), or the years of
   their films until those come. Everything that counts or shows a person goes through `roleNames`. TMDB's dates also
   catch a credit given to the wrong person on TMDB itself: one in a film made before the person was born (or, for
   directing, writing, camera and music, before they were 8) isn't counted (`badCredit`); the people check in Settings
   lists both (06-lookup, `peopleCheck`). */
let META_REV = 0, PEOPLE = null;
function peopleIndex() {
  if (PEOPLE && PEOPLE.meta === META && PEOPLE.rev === META_REV) return PEOPLE;
  const facts = typeof FACTS === "object" && FACTS ? FACTS : {};
  // TMDB sometimes keeps one person twice; two entries with the same IMDb id are one person, under the first
  const byName = new Map(), byImdb = new Map(), canon = new Map(), nameOf = new Map();
  for (const [id, f] of Object.entries(facts)) if (f && f.im) { if (byImdb.has(f.im)) canon.set(Number(id), byImdb.get(f.im)); else byImdb.set(f.im, Number(id)); }
  for (const m of Object.values(META)) {
    if (!m || m.miss) continue;
    const y = Number(m.y) || 0;
    for (const [role, ir] of Object.entries(ROLE_IDS)) {
      const ids = m[ir];
      if (!Array.isArray(ids)) continue;
      (m[ROLE_FIELD[role]] || []).forEach((n, i) => {
        const id = canon.get(Number(ids[i])) || Number(ids[i]);
        if (!id) return;
        if (!nameOf.has(id)) nameOf.set(id, n);
        n = nameOf.get(id);
        const k = personKey(n), g = byName.get(k) || byName.set(k, new Map()).get(k), p = g.get(id) || g.set(id, { name: n, lo: 9999, hi: 0 }).get(id);
        if (y) { p.lo = Math.min(p.lo, y); p.hi = Math.max(p.hi, y); }
      });
    }
  }
  // where each person is billed, on screen and in voice roles: their place in each film's counted cast, by year
  const usual = { c: new Map(), v: new Map() };
  for (const m of Object.values(META)) {
    if (!m || m.miss) continue;
    const y = Number(m.y) || 0;
    for (const role of ["c", "v"]) (m[ROLE_IDS[role]] || []).forEach((id, i) => { id = canon.get(Number(id)) || Number(id); if (id) (usual[role].get(id) || usual[role].set(id, []).get(id)).push({ y, i, m }); });
  }
  // who mostly turns up in cameos: cameos found at lookup against roles counted
  const cameoN = new Map(), habit = new Set();
  for (const m of Object.values(META)) if (m && !m.miss) for (const id of new Set(m.xi || [])) { const k = canon.get(Number(id)) || Number(id); if (k) cameoN.set(k, (cameoN.get(k) || 0) + 1); }
  for (const [id, n] of cameoN) { const roles = (usual.c.get(id) || []).length + (usual.v.get(id) || []).length; if (n >= CAMEO_HABIT && n >= 2 * roles) habit.add(id); }
  const label = new Map(), idOf = new Map(), namesakes = [];
  for (const [k, g] of byName) {
    if (g.size < 2) { idOf.set(k, [...g.keys()][0]); continue; }
    const used = new Set();
    for (const [id, p] of g) {
      const f = facts[id];
      let tag = f && f.b ? (f.d ? `${f.b}–${f.d}` : `born ${f.b}`) : p.hi ? (p.lo === p.hi ? `film of ${p.lo}` : `films ${p.lo}–${p.hi}`) : `TMDB ${id}`;
      if (used.has(tag)) tag += `, TMDB ${id}`;
      used.add(tag);
      const name = `${p.name} (${tag})`, nk = personKey(name);
      label.set(id, name); idOf.set(nk, id); namesakes.push({ key: k, id, name });
      if (f && f.p && !PHOTOS[nk]) PHOTOS[nk] = f.p;
    }
  }
  // a person TMDB keeps twice is shown under one name, the first met
  const twice = new Set(canon.values());
  for (const id of canon.keys()) nameOf.set(id, nameOf.get(canon.get(id)));
  for (const id of [...nameOf.keys()]) if (!canon.has(id) && !twice.has(id)) nameOf.delete(id);
  return (PEOPLE = { meta: META, rev: META_REV, label, idOf, byImdb, canon, nameOf, namesakes, usual, habit });
}
// The TMDB person id behind a name as shown (a namesake's label included), when there's one.
const personIdOf = (name) => peopleIndex().idOf.get(personKey(name)) || 0;
// A cameo worked out over all the films kept here: "star", a star far down a cast (usually billed near the top over
// enough films, here at STAR_FROM or lower); "habit", someone who mostly turns up in cameos, below the top SOURCE_FROM.
// A documentary's people, there as themselves, are listed in no order of size (Spielberg, 2017: Leonardo DiCaprio 7th,
// Tom Cruise 33rd of 54 interviewed; the owner asked why one counted and not the other, 26 Oct 2026), so billing says
// nothing about a walk-on or a small part there: everyone credited on screen counts.
const isDocumentary = (m) => (m.g || []).includes("Documentary");
function walkOn(m, role, place, id) {
  if (!id || (role !== "c" && role !== "v") || (m.ce || []).includes(id) || isDocumentary(m)) return "";
  const P = peopleIndex(), cid = P.canon.get(id) || id;
  // far down and in the lower half; or below the top PRINCIPAL and far better known than those around (`so`, at lookup:
  // Brad Pitt's Vanisher in Deadpool 2, 19th of 54 among bit players; not Chris Pratt, 24th of 49 in Infinity War)
  const deep = place >= STAR_FROM && place >= (m[ROLE_FIELD[role]] || []).length / 2, standsOut = place >= PRINCIPAL && (m.so || []).includes(id);
  if (deep || standsOut) {
    const y = Number(m.y) || 0, then = (P.usual[role].get(cid) || []).filter((x) => x.m !== m && y && x.y && Math.abs(x.y - y) <= STAR_YEARS).map((x) => x.i).sort((a, b) => a - b);
    const md = then.length >= STAR_FILMS ? then[Math.floor((then.length - 1) / 2)] : null;
    if (md != null && (md < STAR_TOP || (deep && md < STAR_NEAR && place >= STAR_DEEP * (md + 1)))) return "star";
  }
  // a lead of an earlier film of the same series (TMDB's collection, `cl`) back far down the cast: Willem Dafoe's
  // Norman Osborn, 2nd in Spider-Man, 13th and 17th in Spider-Man 2 and 3 (asked 26 Oct 2026)
  const y = Number(m.y) || 0;
  if (m.cl && y && place >= RETURN_FROM && (P.usual[role].get(cid) || []).some((x) => x.m !== m && x.m.cl === m.cl && x.y && x.y < y && x.i < RETURN_LEAD)) return "returning";
  return P.habit.has(cid) && place >= SOURCE_FROM ? "habit" : "";
}
// "returning": billed below the top RETURN_FROM here, in the top RETURN_LEAD of an earlier film of the series. On the
// owner's films (26 Oct 2026) it took only walk-ons: Dafoe in Spider-Man 2 and 3, Peggy Carter in The Winter Soldier,
// O-Ren in Kill Bill: Vol. 2, Zod in Batman v Superman, Blofeld in No Time to Die, the earlier Moral Tales' heroines in
// Love in the Afternoon's dream; the top 5 would also have taken real parts (Stellan Skarsgård in Dune: Part Two).
const RETURN_FROM = 10, RETURN_LEAD = 3;
/* ---------- small parts ----------
   Asked 26 Oct 2026, the owner: Brad Pitt in Deadpool 2, Leonardo DiCaprio in Poison Ivy, Willem Dafoe in The French
   Dispatch, Samuel L. Jackson in A Shock to the System, "not undercounted support parts but really minor, sometimes not
   even on the screen for a minute. Should these parts really count?" Letterboxd counts every credited role; here a
   film's principal and supporting cast count, its small parts don't. TMDB has no screen time, so a small part is read
   from where it's billed and how it's credited, role by role (`smallPart`):
   - "deep": billed below the top PRINCIPAL of a cast of more than BIG_CAST, in its lower half or from the BIG_CAST+1st
     on (Dafoe, 33rd of 300; Jackson, 32nd of 46). Gosford Park's downstairs (Helen Mirren 20th of 59, Emily Watson
     22nd) and Do the Right Thing's block (Jackson's Love Daddy, 16th of 42) are in the upper half, and count. A film
     that bills its cast alphabetically from the top (Nashville, Radio Days: `alphaBilled`) counts that run in full.
     A cast of BIG_CAST or fewer counts down to its last credited part: TMDB's order there is sometimes wrong (Peter
     Sellers 20th of 20 in Lolita, John Vernon last in Charley Varrick).
   - "bit": below the top BIT_FROM, credited only as one of the people there (`bitPart`, 05b-parts, worked out at
     lookup into `un`): "Guy" (DiCaprio, 9th of 24), "Man in Black Suit", "Wedding Guest", "Cop #2".
   And a star walk-on is a cameo (`walkOn`, "star"; Pitt). An extended cameo that names its character (`ce`) counts.
   On the owner's 1,559 films (26 Oct 2026): 21,850 of 49,728 credits are small parts, 1,341 of them bit parts; the
   top 30 actors stay the top 30, and all four of their examples are out. */
const PRINCIPAL = 15, BIG_CAST = 30, BIT_FROM = 8, STAND_OUT = 4;
// Where a film's alphabetical billing ends: a run of 10 or more surnames in order from the first or second billed.
const ALPHA = new WeakMap();
function alphaBilled(m, role) {
  let a = ALPHA.get(m);
  if (!a) ALPHA.set(m, (a = {}));
  if (a[role] != null) return a[role];
  const names = m[ROLE_FIELD[role]] || [], last = (n) => (String(n).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+(?:jr\.?|sr\.?|ii|iii)$/i, "").trim().split(/\s+/).pop() || "").toLowerCase();
  let end = 0;
  for (const s of [0, 1]) { let e = s + 1; while (e < names.length && last(names[e]) >= last(names[e - 1])) e++; if (e - s >= 10) end = Math.max(end, e); }
  return (a[role] = end);
}
function smallPart(m, role, place, id) {
  if ((role !== "c" && role !== "v") || place == null || (id && (m.ce || []).includes(id)) || isDocumentary(m)) return "";
  const n = (m[ROLE_FIELD[role]] || []).length;
  if (place >= PRINCIPAL && n > BIG_CAST && (place >= n / 2 || place >= BIG_CAST) && place >= alphaBilled(m, role)) return "deep";
  return place >= BIT_FROM && id && (m.un || []).includes(id) ? "bit" : "";
}
// A credit TMDB's own dates make impossible: "born", before the person was born, or before they were 8 behind the
// camera; "died", a role more than LATE_YEARS after they died, below a film's top SELF_FROM billed (TMDB gave it to the
// wrong person of that name: a Jim Smith who died in 1994 credited as a reporter in Mystic River, 2003, the owner's
// diary, 26 Oct 2026). A lead in a film released long after (John Huston in The Other Side of the Wind, 2018) counts.
const LATE_YEARS = 5;
function badCredit(m, id, role, place) {
  const f = typeof FACTS === "object" && FACTS && FACTS[id], y = Number(m && m.y) || 0;
  if (!f || !y) return "";
  if (f.b && y < f.b + (role === "c" || role === "v" ? 0 : 8)) return "born";
  return (role === "c" || role === "v") && f.d && y > f.d + LATE_YEARS && place != null && place >= SELF_FROM ? "died" : "";
}
// A film's people in a role, with their ids: the cast as counted (TMDB's roles that count, 06-lookup), put right by
// IMDb's cast list where the owner's films were checked there (06d, `castCheck`): `cr` those IMDb says don't count,
// `ca` those IMDb credits and TMDB doesn't (`can` their IMDb ids), and `cn` the IMDb id IMDb's page gives each of
// TMDB's people: when TMDB's person has another IMDb id, TMDB gave the role to the wrong person of that name, and it
// goes to the right one when TMDB's dates for them are here (`byImdb`), else to nobody.
function rolePeople(m, role) {
  const ids = m[ROLE_IDS[role]] || [], base = (m[ROLE_FIELD[role]] || []).map((name, i) => ({ name, id: Number(ids[i]) || 0, place: i }));
  if (role !== "c" || !m.cq) return base;
  const P = peopleIndex(), facts = typeof FACTS === "object" && FACTS ? FACTS : {}, off = new Set((m.cr || []).map(personKey)), out = [];
  for (const p of base) {
    if (off.has(personKey(p.name))) continue;
    const nm = m.cn && p.id && m.cn[p.id], mine = p.id && facts[p.id] && facts[p.id].im;
    if (nm && mine && mine !== nm) { const right = P.byImdb.get(nm); if (right) out.push({ name: p.name, id: right, moved: p.id }); continue; }
    out.push(p);
  }
  for (const n of m.ca || []) { const nm = m.can && m.can[n]; out.push({ name: n, id: (nm && P.byImdb.get(nm)) || 0 }); }
  return out;
}
// The people of a film in a role as shown and counted everywhere: by TMDB person, a namesake under their label,
// impossible credits left out. Kept per film until the people index changes.
const ROLE_NAMES = new WeakMap();
function roleNames(m, role) {
  if (!m) return [];
  const P = peopleIndex();
  let c = ROLE_NAMES.get(m);
  if (!c || c.P !== P) ROLE_NAMES.set(m, (c = { P, lists: {} }));
  if (c.lists[role]) return c.lists[role];
  const out = [], have = new Set(), lead = new Set();
  for (const { name, id, place } of rolePeople(m, role)) {
    if (id && badCredit(m, id, role, place)) continue;
    if (place != null && (walkOn(m, role, place, id) || smallPart(m, role, place, id))) continue;
    const cid = (id && P.canon.get(id)) || id, shown = (cid && (P.label.get(cid) || P.nameOf.get(cid))) || name, k = personKey(shown);
    if (!k || have.has(k)) continue;
    have.add(k); out.push(shown);
    if (place != null && place < LEAD_TOP) lead.add(k);
  }
  c.leads = c.leads || {};
  c.leads[role] = lead;
  return (c.lists[role] = out);
}
// The people of a film billed in its top LEAD_TOP, by `personKey` (for "Highest rated", `rankPeople`).
const LEAD_TOP = 8;
const roleLeads = (m, role) => { roleNames(m, role); const c = m && ROLE_NAMES.get(m); return (c && c.leads && c.leads[role]) || new Set(); };
const castOf = (m) => roleNames(m, "c");
// Every cameo of a film, as shown (not counted): from its lookup, and stars far down its cast.
function cameosOf(m) {
  if (!m) return [];
  const P = peopleIndex(), out = (m.x || []).map((name, k) => ({ name: P.label.get(P.canon.get((m.xi || [])[k]) || (m.xi || [])[k]) || name, why: (m.xw || [])[k] || "cameo" }));
  for (const role of ["c", "v"]) (m[ROLE_FIELD[role]] || []).forEach((name, i) => { const id = Number((m[ROLE_IDS[role]] || [])[i]) || 0;
    const w = walkOn(m, role, i, id); if (w) out.push({ name: P.label.get(P.canon.get(id) || id) || name, why: w }); });
  return out;
}
// A film's small parts, as shown (not counted), in billing order: { name, why, place, of }.
function smallPartsOf(m) {
  if (!m) return [];
  const P = peopleIndex(), out = [];
  for (const role of ["c", "v"]) {
    const of = (m[ROLE_FIELD[role]] || []).length;
    for (const { name, id, place } of rolePeople(m, role)) {
      if (place == null || (id && badCredit(m, id, role, place)) || walkOn(m, role, place, id)) continue;
      const why = smallPart(m, role, place, id);
      if (why) out.push({ name: P.label.get(P.canon.get(id) || id) || P.nameOf.get(P.canon.get(id) || id) || name, why, place: place + 1, of, role });
    }
  }
  return out;
}
const smallWhy = (p) => p.why === "bit" ? `a bit part, billed ${ordinal(p.place)}` : `billed ${ordinal(p.place)} of ${fmtN(p.of)}`;

function inScope(lib, scope) {
  if (scope === "all") return { films: lib.films, entries: lib.entries };
  const entries = lib.entries.filter((e) => e.date.startsWith(scope));
  return { films: [...new Set(entries.map((e) => e.film))], entries };
}

// Highest-rated actors over all time need this many rated films each, so one great film doesn't top the list (the
// owner's call). In a single year the bar follows that year (asked Oct 2026): the most rated films that still lists
// CAST_TOP actors, never above CAST_MIN_RATED; a quieter year comes down to 2 (one film each would only rank films).
// And some of those films must be ones they're billed in the top LEAD_TOP of (asked 26 Oct 2026, then eased the same
// day from 3 in the top 5): CAST_LEAD over all time, one in a year, so a character actor's many good films in small
// parts don't top the list.
const CAST_MIN_RATED = 6, CAST_TOP = 10, CAST_LEAD = 2;
function castBar(rated) {
  for (let t = CAST_MIN_RATED; t > 2; t--) if (rated.filter((p) => p.ratings.length >= t).length >= CAST_TOP) return t;
  return 2;
}
function rankPeople(films, metaOf, role, minRated, leadMin = 0) {
  const map = new Map();
  for (const f of films) {
    const m = metaOf(f);
    if (!m || !Array.isArray(m[ROLE_FIELD[role]])) continue;
    const names = roleNames(m, role), leads = roleLeads(m, role);
    const seen = new Set();
    for (const name of names) {
      const k = personKey(name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      let p = map.get(k);
      if (!p) { p = { key: k, name, films: [], ratings: [], lead: 0 }; map.set(k, p); }
      p.films.push(f);
      if (f.rating) { p.ratings.push(f.rating); if (leads.has(k)) p.lead++; }
    }
  }
  const all = [...map.values()].map((p) => ({ ...p, count: p.films.length, avg: avg(p.ratings) }));
  const most = [...all].sort((a, b) => b.count - a.count || (b.avg || 0) - (a.avg || 0) || a.name.localeCompare(b.name));
  const best = all.filter((p) => p.ratings.length >= minRated && p.lead >= leadMin)
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
  const cast = rankPeople(films, metaOf, "c", scope === "all" ? CAST_MIN_RATED : 1, scope === "all" ? CAST_LEAD : 1);
  const castMinRated = scope === "all" ? CAST_MIN_RATED : castBar(cast.best);
  if (scope !== "all") cast.best = cast.best.filter((p) => p.ratings.length >= castMinRated);
  return {
    scope, films, entries, withMeta: withMeta.length, minRated, castMinRated, castTop: scope !== "all" && castMinRated < CAST_MIN_RATED && cast.best.length >= CAST_TOP,
    minutes, timed,
    avgRating: avg(rated.map((f) => f.rating)), rated: rated.length, spread,
    rewatches: entries.filter((e) => e.rewatch).length,
    reviews: scope === "all" ? films.reduce((s, f) => s + f.reviews, 0) : entries.filter((e) => e.review).length,
    likes: films.filter((f) => f.liked).length,
    byDay, byMonth, weekday, busiestMonth, busiestDay, streak: longestStreak(entries),
    decades,
    cast, voice: rankPeople(films, metaOf, "v", minRated), directors: rankPeople(films, metaOf, "d", minRated),
    writers: rankPeople(films, metaOf, "w", minRated), dop: rankPeople(films, metaOf, "p", minRated), music: rankPeople(films, metaOf, "m", minRated),
    genres: rankCategory(films, metaOf, "g"), countries: rankCategory(films, metaOf, "k"), languages: rankCategory(films, metaOf, "l"),
    newReleases: scope === "all" ? null : films.filter((f) => String(f.year) === scope).length,
  };
}
</script>
