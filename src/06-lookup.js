<script>
/* ---------- cast & crew lookups ----------
   Opened as a file in a normal browser, the page calls TMDB with the viewer's own key.
   Inside the Claude app the page can't reach other sites, so Claude fills in the details. */
const IN_VIEWER = typeof window.claude === "object" && window.claude !== null;
let META = store.get(KEYS.meta, {});
let PHOTOS = store.get(KEYS.photos, {});
let EXAMPLE_META = {};
// A personal downloaded copy gets its owner's TMDB key written in here at build time; published pages leave it empty.
const BUILT_IN_TMDB_KEY = "" /*TMDB_KEY*/;
const ownTmdbKey = () => store.get(KEYS.tmdb, "") || BUILT_IN_TMDB_KEY;
// The site owner's TMDB key when they share it with visitors (share.json beside the pages, put there from their
// Settings), for anyone without a key of their own. Kept in memory only, never saved: when the owner stops sharing,
// visitors stop using it at their next visit.
let SHARED_TMDB = "", sharedKeyReady = Promise.resolve();
const tmdbKey = () => ownTmdbKey() || SHARED_TMDB;
function loadSharedKey() {
  if (IN_VIEWER || !/^https?:$/.test(location.protocol) || ownTmdbKey()) return sharedKeyReady;
  sharedKeyReady = fetch(`share.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null)
    .then((j) => { SHARED_TMDB = j && typeof j.tmdb === "string" && /^[A-Za-z0-9._-]{3,500}$/.test(j.tmdb) ? j.tmdb : ""; }).catch(() => {});
  return sharedKeyReady;
}
let editKey = false;
let sampleFn = null;
let sampleState = IN_VIEWER ? "pending" : "absent"; // pending | ready | off | absent
const job = { running: false, kind: null, ctl: null, done: 0, total: 0, failed: 0, note: "", err: false, saveFailed: false, badKey: false };

if (IN_VIEWER && typeof window.claude.use === "function") {
  window.claude.use("sample").then((s) => { sampleFn = s; sampleState = s ? "ready" : "absent"; renderLookup(); })
    .catch(() => { sampleState = "absent"; renderLookup(); });
}

function saveMeta() {
  const ok = store.set(KEYS.meta, META) && store.set(KEYS.photos, PHOTOS);
  job.saveFailed = !ok;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// TMDB ids known for sure: from the Letterboxd feed. A film matched to another id is looked up again.
let KNOWN_IDS = {};
// Films TMDB's search can't find by their Letterboxd title and year, found by hand (from the film data check).
const FILM_IDS = {
  "a cop|1972": 42741, // Melville's Un flic; TMDB knows no film called "A Cop" from 1972
  "the ear|1970": 88953, // Ucho: banned on completion, released in 1990
  // by IMDb id, which TMDB turns into its own: TMDB titles these differently from Letterboxd (from the film data check)
  "glass onion|2022": "tt11564570", // Glass Onion: A Knives Out Mystery
  "nathan for you finding frances|2017": "tt7277634", // the show's finale, a film on Letterboxd
  "the sorrow and the pity|1969": "tt0066904", // Le Chagrin et la Pitié
};
// Facts TMDB has wrong for a film, by its TMDB id, checked against the film itself (from the film data check).
const FILM_FIXES = {
  22985: { k: ["USA"], why: "an American film; TMDB lists it as British" }, // The Prowler (1951)
  145: { l: "English", why: "in English; TMDB gives Danish as its language" }, // Breaking the Waves (1996)
  17295: { l: "French", why: "in French and Arabic; TMDB gives Italian" }, // The Battle of Algiers (1966)
};
const knownId = (f) => KNOWN_IDS[f.key] || FILM_IDS[titleKey(f.name, f.year)];
// Whether a film's details came from the id it's pinned to (a TMDB id, or an IMDb id "tt…").
const fromKnownId = (f, m) => { const k = knownId(f); return !!(k && m && (m.id === k || m.im === k || m.via === k)); };
function needsLookup(lib, kind) {
  return lib.films.filter((f) => {
    const m = META[f.key];
    if (kind === "tmdb") {
      if (m && m.pin) return false;
      if (knownId(f) && !fromKnownId(f, m)) return true;
      if (!m) return true;
      if (m.src === "tmdb") return (m.v || 1) < (m.miss ? TMDB_MISS_VERSION : TMDB_MATCH_VERSION);
      return !(m.tmdbMiss >= TMDB_MISS_VERSION);
    }
    return !m && !EXAMPLE_META[f.key];
  });
}

/* ----- TMDB ----- */
async function tmdbGet(path, params, key, signal) {
  const url = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(params)) if (v !== "" && v != null) url.searchParams.set(k, v);
  const headers = { accept: "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key; else url.searchParams.set("api_key", key);
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers, signal });
    if (res.status === 429) { await sleep((Number(res.headers.get("retry-after")) || 2) * 1000 * (attempt + 1)); continue; }
    if (res.status === 401) throw { code: "auth" };
    if (res.status === 404) return null;
    if (!res.ok) throw { code: "http", status: res.status };
    return res.json();
  }
  throw { code: "busy" };
}
// Bump when matching or the stored fields change, so saved films are looked up again.
// 4: a film only matches a TMDB film with the same (or nearly the same) title; The Ear (1970) had been
// matched to When Dinosaurs Ruled the Earth, the most-voted film of 1970 that TMDB's search turned up.
// 5: TMDB's release year is kept too (`y`), for the film data check.
// 6: every country TMDB lists (it used to stop at 6), the language a film is spoken in, hand-checked fixes.
const TMDB_MATCH_VERSION = 6;
// Bump when matching finds films it used to miss, so only those are looked up again.
// 7: a title that is half of the other ("Glass Onion: A Knives Out Mystery" for Glass Onion).
const TMDB_MISS_VERSION = Math.max(TMDB_MATCH_VERSION, 7);
// The words of a title that matter, in any script: "The Ear" → ear, "Love & Mercy" → love, mercy.
const TITLE_SKIP = new Set(["the", "a", "an", "and", "of", "la", "le", "les", "el", "il", "der", "die", "das"]);
const titleWords = (s) => new Set(String(s || "").replace(/&/g, " and ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter((w) => w && !TITLE_SKIP.has(w)));
// How alike two titles are: 1 for the same words, 0 for none in common.
function titleLike(a, b) {
  const A = titleWords(a), B = titleWords(b);
  if (!A.size || !B.size) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase() ? 1 : 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return 2 * n / (A.size + B.size);
}
const NEAR_TITLE = 0.75;
// Letterboxd dates a film by its first showing; TMDB often by a later release (Brick: 2005 vs 2006), and
// several films can share a title (a feature and a short called "Brick"). So allow a gap of a year or two,
// insist on the title, and let the number of TMDB votes pick the real film.
function pickHit(results, f, tolerance) {
  if (!results || !results.length) return null;
  const yearOf = (r) => parseInt((r.release_date || "").slice(0, 4), 10);
  const ranked = results
    .filter((r) => !f.year || !yearOf(r) || Math.abs(yearOf(r) - f.year) <= tolerance)
    .map((r) => ({ r, like: Math.max(titleLike(f.name, r.title), titleLike(f.name, r.original_title)) }))
    .filter((x) => x.like >= NEAR_TITLE)
    .map((x) => ({ ...x, score: (x.like === 1 ? 2000 : x.like * 1000) + Math.log10((x.r.vote_count || 0) + 1) * 100 + (yearOf(x.r) === f.year ? 50 : 0) - (x.r.video ? 100 : 0) }))
    .sort((a, b) => b.score - a.score);
  return ranked.length ? ranked[0].r : null;
}
// A film TMDB dates years later than Letterboxd (The Ear: shot in 1970, banned, released in 1990): taken only
// when it is the one film with exactly that title.
function onlyTitled(results, f) {
  const yearOf = (r) => parseInt((r.release_date || "").slice(0, 4), 10);
  const same = (results || []).filter((r) => titleLike(f.name, r.title) === 1 || titleLike(f.name, r.original_title) === 1);
  // later only: a film can come out years after it was made, never years before (A Cop, 1972, isn't a 1947 film)
  return same.length === 1 && (!f.year || !yearOf(same[0]) || (yearOf(same[0]) >= f.year - 2 && yearOf(same[0]) - f.year <= 30)) ? same[0] : null;
}
// TMDB can title a film longer than Letterboxd ("Glass Onion: A Knives Out Mystery" for Glass Onion), or with
// only one half of Letterboxd's ("Finding Frances" for "Nathan for You: Finding Frances"). Taken only when that
// half is a whole title on its own and the year is within one; the most-voted such film wins.
const mainTitle = (t) => String(t || "").split(/:\s|\s[-–—]\s/)[0];
const titleHalves = (t) => (String(t).includes(":") ? String(t).split(/:\s*/).map((x) => x.trim()).filter(Boolean) : []);
function halfTitled(results, f) {
  const yearOf = (r) => parseInt((r.release_date || "").slice(0, 4), 10);
  const halves = titleHalves(f.name);
  const fits = (t) => !!t && (titleLike(f.name, mainTitle(t)) === 1 || halves.some((h) => titleLike(h, t) === 1));
  return (results || []).filter((r) => (!f.year || !yearOf(r) || Math.abs(yearOf(r) - f.year) <= 1) && (fits(r.title) || fits(r.original_title)))
    .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))[0] || null;
}
// The TMDB id for a pinned film: a TMDB id as it is, an IMDb id through TMDB's find.
async function tmdbIdFor(known, key, signal) {
  if (!/^tt\d+$/.test(String(known))) return known;
  const r = await tmdbGet(`/find/${known}`, { external_source: "imdb_id" }, key, signal);
  return (r && r.movie_results && r.movie_results[0] && r.movie_results[0].id) || null;
}
// `prev` is what the film was matched to before: when the match hasn't changed, its details are kept.
async function tmdbFilm(f, key, signal, prev) {
  const known = knownId(f);
  if (known) {
    const id = await tmdbIdFor(known, key, signal), m = id && await tmdbDetails(id, key, signal);
    if (m && !m.miss) return { ...m, via: known };
  }
  const search = async (query, year) => ((await tmdbGet("/search/movie", { query, year: year || "", include_adult: "false" }, key, signal)) || {}).results || [];
  const seen = await search(f.name, f.year);
  let hit = pickHit(seen, f, 2);
  if (!hit && f.year) {
    const all = await search(f.name);
    seen.push(...all);
    hit = pickHit(all, f, 2) || onlyTitled(all, f);
  }
  if (!hit) hit = halfTitled(seen, f);
  for (const half of hit ? [] : titleHalves(f.name)) if ((hit = halfTitled(await search(half, f.year), f))) break;
  // (a pinned film TMDB doesn't know keeps the pin, so it isn't asked for again every time)
  if (!hit) return { src: "tmdb", miss: true, v: TMDB_MISS_VERSION, ...(known ? { via: known } : {}) };
  if (prev && prev.src === "tmdb" && !prev.miss && prev.id === hit.id && prev.c && prev.v >= 6) return { ...prev, v: TMDB_MATCH_VERSION, y: parseInt((hit.release_date || "").slice(0, 4), 10) || prev.y || null };
  return tmdbDetails(hit.id, key, signal);
}
// One TMDB film's details and credits, by its id.
async function tmdbDetails(id, key, signal) {
  const d = await tmdbGet(`/movie/${id}`, { append_to_response: "credits" }, key, signal);
  if (!d) return { src: "tmdb", miss: true, v: TMDB_MISS_VERSION };
  const crew = (d.credits && d.credits.crew) || [];
  const cast = ((d.credits && d.credits.cast) || []).slice().sort((a, b) => a.order - b.order).slice(0, CAST_DEPTH);
  const names = (list) => [...new Set(list.map((x) => x.name))];
  for (const p of [...cast, ...crew.filter((c) => c.job === "Director")]) if (p.profile_path && !PHOTOS[personKey(p.name)]) PHOTOS[personKey(p.name)] = p.profile_path;
  return cleanMeta({
    src: "tmdb", v: TMDB_MATCH_VERSION, id: d.id, poster: d.poster_path, y: parseInt((d.release_date || "").slice(0, 4), 10),
    d: names(crew.filter((c) => c.job === "Director")),
    c: cast.map((c) => c.name),
    w: names(crew.filter((c) => ["Screenplay", "Writer", "Story"].includes(c.job))),
    p: names(crew.filter((c) => c.job === "Director of Photography")),
    m: names(crew.filter((c) => c.job === "Original Music Composer" || c.job === "Music")),
    g: (d.genres || []).map((g) => g.name),
    k: (d.production_countries || []).map((c) => c.name),
    l: spokenIn(d), r: d.runtime, va: d.vote_average, vc: d.vote_count, im: d.imdb_id, t: new Date().toISOString(),
    ...(FILM_FIXES[d.id] || {}),
  });
}
// A film's language: TMDB's original language, unless the film is spoken only in another one (Breaking the
// Waves: original language Danish, spoken in English). Cantonese and Mandarin are left as TMDB has them.
function spokenIn(d) {
  const spoken = (d.spoken_languages || []).map((x) => x.iso_639_1).filter((x) => x && x !== "xx");
  const chinese = ["cn", "zh"];
  return spoken.length === 1 && d.original_language && spoken[0] !== d.original_language && !(chinese.includes(spoken[0]) && chinese.includes(d.original_language)) ? spoken[0] : d.original_language;
}
async function runTmdb(lib, key) {
  const queue = needsLookup(lib, "tmdb");
  Object.assign(job, { running: true, kind: "tmdb", ctl: new AbortController(), done: 0, total: queue.length, failed: 0, note: "", err: false, badKey: false });
  renderLookup();
  const signal = job.ctl.signal;
  let fatal = null, sinceSave = 0;
  const worker = async () => {
    while (queue.length && !signal.aborted && !fatal) {
      const f = queue.shift();
      try {
        const m = await tmdbFilm(f, key, signal, META[f.key]);
        if (m.miss) { if (!META[f.key] || META[f.key].src === "tmdb") META[f.key] = m; else META[f.key].tmdbMiss = TMDB_MISS_VERSION; job.failed++; }
        else {
          // keep IMDb scores already fetched for the same film, so OMDb's daily allowance isn't spent twice
          const prev = META[f.key];
          if (prev && prev.om && prev.im === m.im) for (const k of IMDB_FIELDS) m[k] = prev[k];
          META[f.key] = m;
        }
      } catch (e) {
        if (signal.aborted) return;
        if (e && e.code === "auth") { job.badKey = true; fatal = "TMDB didn't accept that key. Copy the API Key (v3) or the API Read Access Token from your TMDB account settings and try again."; return; }
        if (e instanceof TypeError) { fatal = "Couldn't reach TMDB. Check your internet connection and try again."; return; }
        job.failed++;
      }
      job.done++;
      if (++sinceSave >= 25) { sinceSave = 0; saveMeta(); scheduleRender(); }
      renderLookupProgress();
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  saveMeta();
  job.running = false;
  if (fatal) { job.note = fatal; job.err = true; }
  else if (signal.aborted) job.note = `Stopped after ${plural(job.done, "film")}. Progress is saved.`;
  else job.note = job.failed ? "Done." : "Done. Every film has cast and crew.";
  scheduleRender();
}

// Uses a key typed into the page if there is one, otherwise the saved or built-in key.
function startTmdb(lib) {
  const input = $("#tmdb-key");
  const typed = input ? input.value.trim() : "";
  const key = typed || tmdbKey();
  if (!key) { job.note = "Paste your TMDB API key first."; job.err = true; editKey = true; renderLookup(); const i = $("#tmdb-key"); if (i) i.focus(); return; }
  if (typed && typed !== BUILT_IN_TMDB_KEY) store.set(KEYS.tmdb, typed);
  else if (typed) store.del(KEYS.tmdb);
  editKey = false;
  runTmdb(lib, key).then(() => { if (omdbKey()) runOmdb(lib, omdbKey()); });
}
// After an import, a copy that already knows a key looks films up without being asked.
async function autoLookup(lib) {
  if (IN_VIEWER) return;
  await sharedKeyReady;
  if (tmdbKey() && needsLookup(lib, "tmdb").length) await runTmdb(lib, tmdbKey());
  if (omdbKey() && !imdbJob.badKey && needsImdb(lib).length && siteLeadsLookups()) runOmdb(lib, omdbKey());
}

/* ----- IMDb, Metacritic and Rotten Tomatoes scores, through OMDb -----
   TMDB gives each film's IMDb id; OMDb turns it into scores. Its free key allows 1,000 films a day,
   so a big library fills in over a few days, picking up where it stopped each time the page opens. */
const omdbKey = () => store.get(KEYS.omdb, "");
const imdbJob = { running: false, ctl: null, done: 0, total: 0, note: "", err: false, badKey: false };
let editOmdb = false;
// What OMDb tells about a film: scores, and its year, countries and languages on IMDb (`inf`: IMDb doesn't know it).
const IMDB_FIELDS = ["ir", "iv", "mc", "rt", "om", "iy", "ik", "il", "inf"];
// Films with an IMDb id still to ask OMDb about, including ones asked before IMDb's countries were kept.
const needsImdb = (lib) => lib.films.filter((f) => { const m = META[f.key]; return m && !m.miss && m.im && (!m.om || (!m.ik && !m.inf)); });
// Each device goes through films in its own order, so two devices fetching on the same day mostly ask OMDb for
// different films (their results meet on the site) instead of spending the 1,000 a day twice on the same ones.
const deviceSeed = () => { let s = ls.get("cr-device", ""); if (!s) { s = Math.random().toString(36).slice(2); ls.set("cr-device", s); } return s; };
async function runOmdb(lib, key) {
  const seed = deviceSeed(), queue = needsImdb(lib).sort((a, b) => hash32(seed + a.key) - hash32(seed + b.key));
  if (!queue.length || imdbJob.running) return;
  Object.assign(imdbJob, { running: true, ctl: new AbortController(), done: 0, total: queue.length, note: "", err: false, badKey: false });
  renderLookup();
  const signal = imdbJob.ctl.signal, today = new Date().toISOString().slice(0, 10);
  const num = (s) => { const n = parseFloat(String(s || "").replace(/,/g, "")); return isFinite(n) ? n : null; };
  let stop = null, sinceSave = 0;
  const worker = async () => {
    while (queue.length && !signal.aborted && !stop) {
      const f = queue.shift(), m = META[f.key];
      try {
        const res = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(m.im)}&apikey=${encodeURIComponent(key)}`, { signal });
        const d = await res.json();
        if (d.Response === "False") {
          if (/limit/i.test(d.Error || "")) { stop = "limit"; return; }
          if (/api key/i.test(d.Error || "") || res.status === 401) { stop = "key"; return; }
          Object.assign(m, { om: today, inf: true, t: new Date().toISOString() }); // OMDb doesn't know this film; don't ask again
        } else {
          const rt = (d.Ratings || []).find((x) => x.Source === "Rotten Tomatoes");
          const names = (v) => String(v || "").split(/,\s*/).map((x) => x.trim()).filter((x) => x && x !== "N/A");
          Object.assign(m, { ir: num(d.imdbRating), iv: num(d.imdbVotes), mc: num(d.Metascore), rt: rt ? num(rt.Value) : null, om: today, t: new Date().toISOString(),
            iy: parseInt(d.Year, 10) || null, ik: names(d.Country).map(country), il: names(d.Language).map(language) });
        }
      } catch (e) {
        if (signal.aborted) return;
        stop = "network"; return;
      }
      imdbJob.done++;
      if (++sinceSave >= 25) { sinceSave = 0; saveMeta(); scheduleRender(); }
      renderLookupProgress();
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  saveMeta();
  const left = needsImdb(lib).length;
  imdbJob.running = false;
  imdbJob.badKey = stop === "key";
  imdbJob.err = stop === "key" || stop === "network";
  imdbJob.note = stop === "limit" ? `OMDb's free allowance of 1,000 films a day is used up. The other ${fmtN(left)} fill in when you open the page tomorrow.`
    : stop === "key" ? "OMDb didn't accept that key. Use the key from OMDb's email, after clicking the activation link in it."
    : stop === "network" ? "Couldn't reach OMDb. The rest fill in the next time you open the page."
    : signal.aborted ? "Stopped. Progress is saved." : "";
  scheduleRender();
}
function startOmdb(lib) {
  const input = $("#omdb-key");
  const key = input ? input.value.trim() : omdbKey();
  if (!key) { imdbJob.note = "Paste your OMDb key first."; imdbJob.err = true; renderLookup(); return; }
  store.set(KEYS.omdb, key);
  editOmdb = false; imdbJob.badKey = false;
  runOmdb(lib, key);
}
// The IMDb part of the Cast & crew box, for both layouts.
function imdbBlock(lib, phone) {
  if (IN_VIEWER || !lib) return "";
  const total = lib.films.length;
  const withId = lib.films.filter((f) => META[f.key] && META[f.key].im).length;
  const have = lib.films.filter((f) => META[f.key] && META[f.key].ir).length;
  const note = imdbJob.note ? `<p class="status${imdbJob.err ? " err" : ""}" role="status">${esc(imdbJob.note)}</p>` : "";
  const title = phone ? `<p class="title" style="margin-top:6px">IMDb scores</p>` : `<h3 class="sub-h">IMDb scores</h3>`;
  if (!withId) return title + `<p class="status">IMDb, Metacritic and Rotten Tomatoes scores can be added once films have TMDB details.</p>`;
  if (imdbJob.running) return title + `<p class="status" id="imdb-progress" role="status">${imdbProgressText()}</p>`;
  if (!omdbKey() || editOmdb || imdbJob.badKey) {
    const input = `<label class="sr-only" for="omdb-key">OMDb API key</label><input ${phone ? 'class="key" ' : ""}id="omdb-key" type="password" autocomplete="off" spellcheck="false" placeholder="OMDb key (optional)" value="${esc(omdbKey())}">`;
    const btn = phone ? `<button class="btn green block" type="button" data-act="omdb">Add IMDb scores</button>` : `<button class="btn" type="button" id="btn-omdb">Add IMDb scores</button>`;
    return title + (phone ? input + btn : `<div class="lookup-row">${input}${btn}</div>`) +
      `<p class="status">Adds IMDb, Metacritic and Rotten Tomatoes scores for comparing your ratings. Get a free key at <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener">omdbapi.com</a> (1,000 films a day) and click the activation link in its email.</p>` + note;
  }
  const change = phone ? `<button class="linkish" type="button" data-act="change-omdb">Change key</button>` : `<button class="linkish" type="button" id="btn-change-omdb">Change key</button>`;
  return title + `<p class="status">${fmtN(have)} of ${plural(total, "film")} have IMDb scores. ${change}</p>` + note;
}
const imdbProgressText = () => `Getting IMDb scores: ${fmtN(imdbJob.done)} of ${plural(imdbJob.total, "film")}…`;

/* ----- Claude ----- */
const CLAUDE_BATCH = 40;
function claudePrompt(batch) {
  return `You are filling in film credits for someone's Letterboxd diary. For each film below (title and release year as listed on Letterboxd), give what you know:
- d: director(s)
- c: up to 8 top-billed cast, in billing order (for animation, the original-language voice cast)
- w: screenwriter(s)
- p: director(s) of photography
- m: original score composer(s), or [] if none
- g: genres, using only these names: ${GENRES.join(", ")}
- k: production countries, short names (USA, UK, France, South Korea)
- l: original language (English, Korean, Cantonese, Mandarin, French...)
- r: runtime in minutes, as an integer
Spell names the way TMDB credits them, and spell each person the same way every time. If you don't recognise a film with confidence, return {"i": <index>, "x": 1} for it instead of guessing.
Reply with only a JSON array with one object per film, in the same order, like:
[{"i":0,"d":["Bong Joon-ho"],"c":["Song Kang-ho","Lee Sun-kyun"],"w":["Bong Joon-ho","Han Jin-won"],"p":["Hong Kyung-pyo"],"m":["Jung Jae-il"],"g":["Comedy","Thriller","Drama"],"k":["South Korea"],"l":"Korean","r":133}]

Films:
${batch.map((f, i) => `${i}. ${f.name}${f.year ? ` (${f.year})` : ""}`).join("\n")}`;
}
async function runClaude(lib) {
  const films = needsLookup(lib, "claude");
  const batches = [];
  for (let i = 0; i < films.length; i += CLAUDE_BATCH) batches.push(films.slice(i, i + CLAUDE_BATCH));
  Object.assign(job, { running: true, kind: "claude", ctl: new AbortController(), done: 0, total: films.length, failed: 0, note: "", err: false });
  renderLookup();
  const signal = job.ctl.signal;
  let stop = null;
  const worker = async () => {
    while (batches.length && !signal.aborted && !stop) {
      const batch = batches.shift();
      try {
        const out = await sampleFn.json(claudePrompt(batch), { signal, modelTier: "default", effort: "low" });
        if (!Array.isArray(out)) throw { code: "invalid_json" };
        const answered = new Set();
        for (const item of out) {
          const f = batch[Number(item && item.i)];
          if (!f || answered.has(f)) continue;
          answered.add(f);
          META[f.key] = item.x ? { src: "claude", miss: true } : cleanMeta({ ...item, src: "claude" });
          if (item.x) job.failed++;
        }
        job.failed += batch.length - answered.size;
      } catch (e) {
        const code = e && e.code;
        if (code === "cancelled") return;
        if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(code)) {
          sampleState = "off"; stop = "Claude lookups aren't allowed for this page, so cast and crew stay blank. You can still use the page with a TMDB key in your own browser."; return;
        }
        if (code === "rate_limited") { stop = "Claude is limiting requests right now. Progress is saved; look up the rest in a few minutes."; return; }
        if (code === "session_expired") { stop = "Your Claude session expired. Sign in again, then look up the rest."; return; }
        job.failed += batch.length;
      }
      job.done += batch.length;
      saveMeta(); scheduleRender(); renderLookupProgress();
    }
  };
  await Promise.all([worker(), worker()]);
  job.running = false;
  if (stop) { job.note = stop; job.err = true; }
  else if (signal.aborted) job.note = `Stopped after ${plural(job.done, "film")}. Progress is saved.`;
  else job.note = job.failed ? `Done. ${plural(job.failed, "film")} came back without details. Try those again, or use TMDB.` : "Done. Every film has cast and crew.";
  scheduleRender();
}
/* ----- putting right a wrong match ----- */
// A TMDB or IMDb link (or bare id) for the film this one really is. The match is then kept, whatever later lookups find.
async function fixMatch(f, text) {
  const key = tmdbKey();
  if (!key) throw new Error("Add your TMDB key in Settings → Film details first.");
  const t = String(text || "").trim();
  let id = (t.match(/themoviedb\.org\/movie\/(\d+)/) || t.match(/^(\d+)$/) || [])[1];
  const imdb = (t.match(/\b(tt\d{5,})\b/) || [])[1];
  if (!id && imdb) {
    id = await tmdbIdFor(imdb, key);
    if (!id) throw new Error("TMDB doesn't know a film with that IMDb link.");
  }
  if (!id) throw new Error("Paste a link to the film on themoviedb.org or imdb.com.");
  const m = await tmdbDetails(id, key);
  if (!m || m.miss) throw new Error("TMDB has no film with that id.");
  m.pin = true;
  META[f.key] = m;
  saveMeta();
  if (omdbKey() && needsImdb({ films: [f] }).length) runOmdb({ films: [f] }, omdbKey());
  return m;
}

function retryClaudeMisses(lib) {
  for (const f of lib.films) { const m = META[f.key]; if (m && m.miss && m.src === "claude") delete META[f.key]; }
  return runClaude(lib);
}
</script>
