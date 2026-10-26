<script>
/* ---------- cast & crew lookups ----------
   Opened as a file in a normal browser, the page calls TMDB with the viewer's own key.
   Inside the Claude app the page can't reach other sites, so Claude fills in the details. */
const IN_VIEWER = typeof window.claude === "object" && window.claude !== null;
document.body.classList.toggle("viewer", IN_VIEWER); // things said only inside Claude
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
  META_REV++; // who's who may have changed (05-core, `peopleIndex`)
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
  "life and nothing more|1992": 83761, // Kiarostami's Zendegi va digar hich, "And Life Goes On" on TMDB (the owner's diary)
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
      if (m && m.pin) return !!rereadRef(m); // matched by hand: only read again, at the same place, when details change
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
// 7: the whole credited cast (it stopped at the top 15 billed) and every director; a film matched since 6 is only read
// again by its id (`rereadRef`), as its match hasn't changed.
// 8: who counts in a cast follows Letterboxd's rule role by role (`roleSkip`: cameos, archive footage, cut scenes).
// 9: each person's TMDB id beside their name (`ci`, `di`…), so two people of one name stay two (05-core, `peopleIndex`).
// 10: cameos sorted out of the cast with why, and voice roles apart (05-core, `sortCast`).
// 11: bit parts and people far better known than those billed around them, for small parts (05-core, `smallPart`).
const TMDB_MATCH_VERSION = 11;
// The last version that changed what's kept of a film: older details are read again, even when the match is the same.
const TMDB_DETAILS_V = 11;
// Bump when matching finds films it used to miss, so only those are looked up again.
// 7: a title that is half of the other ("Glass Onion: A Knives Out Mystery" for Glass Onion).
// 8: a pinned film TMDB keeps on its TV side (The Sorrow and the Pity, Nathan for You: Finding Frances).
const TMDB_MISS_VERSION = 8; // (9 changed nothing in matching: films missed before stay so)
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
// Where a pinned film is on TMDB: a TMDB film id as it is; an IMDb id through TMDB's find, which can land on TMDB's TV
// side as well (The Sorrow and the Pity is a two-part TV programme there, Nathan for You: Finding Frances an episode of
// the show; both had no match until Oct 2026 because only films were taken): { movie }, { tv } or { tv, se, ep }.
async function tmdbRefFor(known, key, signal) {
  if (!/^tt\d+$/.test(String(known))) return { movie: Number(known) };
  const r = (await tmdbGet(`/find/${known}`, { external_source: "imdb_id" }, key, signal)) || {};
  const first = (a) => (Array.isArray(a) && a[0]) || null, mv = first(r.movie_results), tv = first(r.tv_results), ep = first(r.tv_episode_results);
  if (mv && mv.id) return { movie: mv.id };
  if (tv && tv.id) return { tv: tv.id };
  if (ep && ep.show_id && ep.season_number != null && ep.episode_number) return { tv: ep.show_id, se: ep.season_number, ep: ep.episode_number };
  return null;
}
const tmdbFetch = (ref, key, signal) => (ref.movie ? tmdbDetails(ref.movie, key, signal) : tmdbTvDetails(ref, key, signal));
// A TMDB page for a film's details: its film page, or its TV programme or episode.
const tmdbHref = (m) => !m || m.src !== "tmdb" ? "" : Number(m.tv) ? `https://www.themoviedb.org/tv/${Number(m.tv)}${Number(m.ep) ? `/season/${Number(m.se)}/episode/${Number(m.ep)}` : ""}`
  : Number(m.id) ? `https://www.themoviedb.org/movie/${Number(m.id)}` : "";
// A film matched since version 6 whose details are older than TMDB_DETAILS_V: where it is on TMDB, to read it again
// there with one request instead of searching for it (its match, pinned by hand or not, stays).
function rereadRef(prev) {
  if (!prev || prev.src !== "tmdb" || prev.miss || !((prev.v || 0) >= 6 && (prev.v || 0) < TMDB_DETAILS_V)) return null;
  if (Number(prev.tv)) return { tv: Number(prev.tv), ...(Number(prev.ep) ? { se: Number(prev.se) || 0, ep: Number(prev.ep) } : {}) };
  return Number(prev.id) ? { movie: Number(prev.id) } : null;
}
// A film's cast sorted (05-core, `sortCast`) and kept: on screen, voices, cameos with why, extended appearances. Until
// Oct 2026 the top 15 billed counted, uncredited or not, which left out most supporting and voice actors.
function castParts(list, roleOf, crew, genres) {
  const crewJobs = new Map();
  for (const x of crew) { const j = x.jobs ? x.jobs.map((y) => y.job) : [x.job]; crewJobs.set(x.id, new Set([...(crewJobs.get(x.id) || []), ...j])); }
  const names = new Set((genres || []).map((g) => g.name || g));
  const s = sortCast(list.map((c) => ({ name: c.name, id: c.id, character: roleOf(c), profile_path: c.profile_path, popularity: c.popularity })), { crewJobs, documentary: names.has("Documentary"), animation: names.has("Animation") });
  return { s, kept: { ...credits("c", s.live), ...credits("v", s.voice), x: s.cameos.map((c) => c.name), xi: s.cameos.map((c) => Number(c.id) || 0), xw: s.cameos.map((c) => c.why), ce: s.extended, un: s.bits, so: s.standout } };
}
// What the people pages say of it (inside Claude, film details come from Claude, with each film's main cast).
const castRuleText = () => (IN_VIEWER ? "Counts each film's main cast."
  : "Each film's principal and supporting cast counts; voice roles are under Voices. Small parts don't (below the top 15 of a big cast, in its lower half or past the 30th, and parts like \"Guy at bar\" or \"Cop #2\" below the top 8), nor cameos: uncredited or labelled ones, people playing themselves, the author of the source in a walk-on, a star far down the cast. People who share a name are counted apart." + (castChecked() ? ` Checked against IMDb for ${plural(castChecked(), "film")}.` : ""));
// Photos kept from a film's credits: its directors, its top billed, and anyone already met in another film, so a
// supporting actor whose films add up has a face, without photos of thousands of one-off players. `CAST_SEEN` is
// everyone in the films looked up so far (worked out again at the start of each run of lookups).
let CAST_SEEN = null;
function keepPhotos(cast, directors) {
  if (!CAST_SEEN) { CAST_SEEN = new Set(); for (const m of Object.values(META)) for (const n of (m && m.c) || []) CAST_SEEN.add(personKey(n)); }
  cast.forEach((p, i) => { const k = personKey(p.name); if (k && p.profile_path && !PHOTOS[k] && (i < CAST_BILLED || CAST_SEEN.has(k))) PHOTOS[k] = p.profile_path; });
  for (const p of directors) { const k = personKey(p.name); if (k && p.profile_path && !PHOTOS[k]) PHOTOS[k] = p.profile_path; }
  for (const p of cast) CAST_SEEN.add(personKey(p.name));
}
// `prev` is what the film was matched to before: when the match hasn't changed, its details are kept.
async function tmdbFilm(f, key, signal, prev) {
  const again = rereadRef(prev);
  if (again && (prev.pin || !knownId(f) || fromKnownId(f, prev))) {
    const m = await tmdbFetch(again, key, signal);
    if (m && !m.miss) return { ...m, ...(prev.via ? { via: prev.via } : {}), ...(prev.pin ? { pin: prev.pin } : {}) };
    if (prev.pin) return { ...prev, v: TMDB_DETAILS_V }; // gone from TMDB: a match made by hand stays as it was
  }
  const known = knownId(f);
  if (known) {
    const ref = await tmdbRefFor(known, key, signal), m = ref && await tmdbFetch(ref, key, signal);
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
  if (prev && prev.src === "tmdb" && !prev.miss && prev.id === hit.id && prev.c && prev.v >= TMDB_DETAILS_V) return { ...prev, v: TMDB_MATCH_VERSION, y: parseInt((hit.release_date || "").slice(0, 4), 10) || prev.y || null };
  return tmdbDetails(hit.id, key, signal);
}
// A role's people as kept: their names, and their TMDB person ids beside them (`c` and `ci`…).
const credits = (role, list) => ({ [ROLE_FIELD[role]]: list.map((x) => x.name), [ROLE_IDS[role]]: list.map((x) => Number(x.id) || 0) });
// One TMDB film's details and credits, by its id.
async function tmdbDetails(id, key, signal) {
  const d = await tmdbGet(`/movie/${id}`, { append_to_response: "credits" }, key, signal);
  if (!d) return { src: "tmdb", miss: true, v: TMDB_MISS_VERSION };
  const crew = (d.credits && d.credits.crew) || [];
  const parts = castParts(((d.credits && d.credits.cast) || []).slice().sort((a, b) => a.order - b.order), (c) => c.character, crew, d.genres), cast = [...parts.s.live, ...parts.s.voice];
  keepPhotos(cast, crew.filter((c) => c.job === "Director"));
  return cleanMeta({
    src: "tmdb", v: TMDB_MATCH_VERSION, id: d.id, poster: d.poster_path, y: parseInt((d.release_date || "").slice(0, 4), 10),
    ...credits("d", crew.filter((c) => c.job === "Director")), ...parts.kept,
    ...credits("w", crew.filter((c) => ["Screenplay", "Writer", "Story"].includes(c.job))),
    ...credits("p", crew.filter((c) => c.job === "Director of Photography")),
    ...credits("m", crew.filter((c) => c.job === "Original Music Composer" || c.job === "Music")),
    g: (d.genres || []).map((g) => g.name),
    k: (d.production_countries || []).map((c) => c.name),
    l: spokenIn(d), r: d.runtime, va: d.vote_average, vc: d.vote_count, im: d.imdb_id, t: new Date().toISOString(),
    ...(FILM_FIXES[d.id] || {}),
  });
}
// TMDB's TV genres in the film genres the rest of the app counts.
const TV_GENRES = { "Action & Adventure": ["Action", "Adventure"], "Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"], "War & Politics": ["War"], Kids: ["Family"] };
// The details of something TMDB keeps on its TV side that Letterboxd has as a film: a whole programme (its directors,
// cast and crew across its episodes, its length the episodes added up) or one episode (its own crew, cast and guests,
// with the show's genres, countries and language, and its season's poster). It carries `tv` (and `se`, `ep`), not a
// film `id`, so it's never taken for the TMDB film with the same number.
async function tmdbTvDetails(ref, key, signal) {
  const miss = { src: "tmdb", miss: true, v: TMDB_MISS_VERSION }, episode = ref.ep != null;
  const show = await tmdbGet(`/tv/${Number(ref.tv)}`, { append_to_response: episode ? "" : "aggregate_credits,external_ids" }, key, signal);
  if (!show) return miss;
  let crew, cast, r, y, va, vc, im, poster;
  if (episode) {
    const e = await tmdbGet(`/tv/${Number(ref.tv)}/season/${Number(ref.se)}/episode/${Number(ref.ep)}`, { append_to_response: "credits,external_ids" }, key, signal);
    if (!e) return miss;
    const byOrder = (a) => (a || []).slice().sort((x, z) => (x.order || 0) - (z.order || 0));
    crew = e.crew || []; cast = [...byOrder(e.credits && e.credits.cast), ...byOrder(e.guest_stars)];
    r = e.runtime; y = e.air_date; va = e.vote_average; vc = e.vote_count; im = e.external_ids && e.external_ids.imdb_id;
    poster = ((show.seasons || []).find((s) => s.season_number === Number(ref.se)) || {}).poster_path || show.poster_path;
  } else {
    const ac = show.aggregate_credits || {};
    crew = ac.crew || []; cast = (ac.cast || []).slice().sort((x, z) => (x.order || 0) - (z.order || 0));
    r = 0; // the whole programme: every episode of its seasons, specials left out
    for (const s of (show.seasons || []).filter((s) => s.season_number > 0).slice(0, 3)) {
      const sd = await tmdbGet(`/tv/${Number(ref.tv)}/season/${Number(s.season_number)}`, {}, key, signal);
      for (const x of (sd && sd.episodes) || []) r += Number(x.runtime) || 0;
    }
    y = show.first_air_date; va = show.vote_average; vc = show.vote_count; im = show.external_ids && show.external_ids.imdb_id; poster = show.poster_path;
  }
  const did = (c, jobs) => (c.jobs ? c.jobs.map((j) => j.job) : [c.job]).some((j) => jobs.includes(j));
  const directors = crew.filter((c) => did(c, ["Director"]));
  // a programme's cast has each person's roles across its episodes; credited if any of them is
  const roleOf = (c) => c.roles ? ((c.roles.find((x) => !roleSkip(x.character)) || c.roles[0] || {}).character) : c.character;
  const parts = castParts(cast.filter((c, i) => cast.findIndex((x) => x.name === c.name) === i), roleOf, crew, (show.genres || []).flatMap((g) => TV_GENRES[g.name] || [g.name]));
  cast = [...parts.s.live, ...parts.s.voice];
  keepPhotos(cast, directors);
  return cleanMeta({
    src: "tmdb", v: TMDB_MATCH_VERSION, tv: show.id, ...(episode ? { se: Number(ref.se), ep: Number(ref.ep) } : {}), poster, y: parseInt(String(y || "").slice(0, 4), 10),
    ...credits("d", directors), ...parts.kept,
    ...credits("w", crew.filter((c) => did(c, ["Screenplay", "Writer", "Story"]))),
    ...credits("p", crew.filter((c) => did(c, ["Director of Photography"]))),
    ...credits("m", crew.filter((c) => did(c, ["Original Music Composer", "Music"]))),
    g: [...new Set((show.genres || []).flatMap((g) => TV_GENRES[g.name] || [g.name]))],
    k: (show.production_countries || []).map((c) => c.name), l: spokenIn(show), r: r || null, va, vc, im, t: new Date().toISOString(),
  });
}
// A film's language: TMDB's original language, unless the film is spoken only in another one (Breaking the
// Waves: original language Danish, spoken in English). Cantonese and Mandarin are left as TMDB has them.
function spokenIn(d) {
  const spoken = (d.spoken_languages || []).map((x) => x.iso_639_1).filter((x) => x && x !== "xx");
  const chinese = ["cn", "zh"];
  return spoken.length === 1 && d.original_language && spoken[0] !== d.original_language && !(chinese.includes(spoken[0]) && chinese.includes(d.original_language)) ? spoken[0] : d.original_language;
}
// Background lookups save as they go but redraw the page at most every LOOKUP_REDRAW ms (each redraw works every stat
// out again, which on a big diary keeps a phone busy for a second or more), and once when they finish; the progress
// line updates by itself in between. Owner's report, Oct 2026: the site was slow after opening the diary on a device,
// because IMDb scores being fetched redrew everything every 25 films.
const LOOKUP_REDRAW = 15000;
let lookupRedrawAt = 0, lookupRedrawTimer = null;
function lookupRender() {
  const wait = lookupRedrawAt + LOOKUP_REDRAW - Date.now();
  if (wait <= 0) { lookupRedrawAt = Date.now(); scheduleRender(); return; }
  if (!lookupRedrawTimer) lookupRedrawTimer = setTimeout(() => { lookupRedrawTimer = null; lookupRedrawAt = Date.now(); scheduleRender(); }, wait);
}
async function runTmdb(lib, key) {
  const queue = needsLookup(lib, "tmdb");
  Object.assign(job, { running: true, kind: "tmdb", ctl: new AbortController(), done: 0, total: queue.length, failed: 0, note: "", err: false, badKey: false });
  CAST_SEEN = null;
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
          // and what IMDb's cast list said of it (06d, `castCheck`)
          if (prev && prev.cq && prev.im === m.im) for (const k of CAST_CHECK_FIELDS) if (prev[k] !== undefined) m[k] = prev[k];
          META[f.key] = m;
        }
      } catch (e) {
        if (signal.aborted) return;
        if (e && e.code === "auth") { job.badKey = true; fatal = "TMDB didn't accept that key. Copy the API Key (v3) or the API Read Access Token from your TMDB account settings and try again."; return; }
        if (e instanceof TypeError) { fatal = "Couldn't reach TMDB. Check your internet connection and try again."; return; }
        job.failed++;
      }
      job.done++;
      if (++sinceSave >= 50) { sinceSave = 0; saveMeta(); lookupRender(); }
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
  runTmdb(lib, key).then(() => { runFacts(lib, key); if (omdbKey()) runOmdb(lib, omdbKey()); });
}
// After an import, a copy that already knows a key looks films up without being asked.
async function autoLookup(lib) {
  if (IN_VIEWER) return;
  await sharedKeyReady;
  if (tmdbKey() && needsLookup(lib, "tmdb").length) await runTmdb(lib, tmdbKey());
  if (tmdbKey()) runFacts(lib, tmdbKey());
  if (omdbKey() && !imdbJob.badKey && needsImdb(lib).length && siteLeadsLookups()) runOmdb(lib, omdbKey());
}

/* ----- People's dates, from TMDB: the people check (asked 26 Oct 2026, after Paul Guilfoyle, born 1949, was shown in
   1940s films: "how can I trust the cast data at all? I would like a complete fact check of all the actors and crew")
   For everyone in two or more of the diary's films, and everyone whose name another person shares, TMDB's person page
   gives their birth and death years, IMDb id and photo (`FACTS`, by TMDB person id, kept on this device, looked up
   again after half a year). They label namesakes, leave out credits the dates make impossible, and let the IMDb cast
   check see a role TMDB gave to the wrong person of that name (05-core, `peopleIndex`, `badCredit`, `rolePeople`). */
let FACTS = store.get(KEYS.facts, {});
const factsJob = { running: false, done: 0, total: 0 };
const FACTS_DAYS = 180;
function factsWanted(lib) {
  const P = peopleIndex(), want = new Set(P.namesakes.map((x) => x.id)), count = new Map(), now = Date.now();
  for (const f of lib.films) {
    const m = META[f.key];
    if (!m || m.miss) continue;
    for (const ir of Object.values(ROLE_IDS)) for (const id of new Set(m[ir] || [])) if (id) count.set(id, (count.get(id) || 0) + 1);
  }
  for (const [id, n] of count) if (n >= 2) want.add(id);
  return [...want].filter((id) => !FACTS[id] || now - Date.parse(FACTS[id].t || 0) > FACTS_DAYS * 864e5);
}
async function runFacts(lib, key) {
  if (factsJob.running || !key || IN_VIEWER || !lib) return;
  const queue = factsWanted(lib);
  if (!queue.length) return;
  Object.assign(factsJob, { running: true, done: 0, total: queue.length });
  renderLookup();
  const today = new Date().toISOString().slice(0, 10), year = (s) => parseInt(String(s || "").slice(0, 4), 10) || 0;
  let stop = false, since = 0;
  const worker = async () => {
    while (queue.length && !stop) {
      const id = queue.shift();
      try {
        const d = await tmdbGet(`/person/${Number(id)}`, {}, key);
        FACTS[id] = d ? { b: year(d.birthday), d: year(d.deathday), im: /^nm\d+$/.test(d.imdb_id || "") ? d.imdb_id : "", p: imagePath(d.profile_path) || "", t: today } : { t: today };
      } catch (e) { if (e && (e.code === "auth" || e instanceof TypeError)) { stop = true; return; } }
      factsJob.done++;
      if (++since >= 250) { since = 0; store.set(KEYS.facts, FACTS); META_REV++; }
      renderLookupProgress();
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  store.set(KEYS.facts, FACTS);
  META_REV++;
  factsJob.running = false;
  scheduleRender();
}
const safeFacts = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k, f]) => /^\d{1,9}$/.test(k) && f && typeof f === "object")
  .map(([k, f]) => [k, { b: Number(f.b) || 0, d: Number(f.d) || 0, im: /^nm\d+$/.test(f.im || "") ? f.im : "", p: imagePath(f.p) || "", t: String(f.t || "").slice(0, 10) }]));
// What the people check found in a diary: people of one name told apart, credits TMDB's dates make impossible (not
// counted), roles TMDB gave to another person of that name than IMDb does (owner's checked films), and roles long
// long after a death (a role TMDB gave to the wrong person of that name; not counted).
function peopleCheck(lib) {
  const P = peopleIndex(), shownNs = new Map(), impossible = [], wrong = [], late = [], cameos = [], small = [], films = new Map(), roleWord = { c: "acting", v: "voice", d: "directing", w: "writing", p: "camera", m: "music" };
  for (const f of lib.films) {
    const m = META[f.key];
    if (!m || m.miss) continue;
    const y = Number(m.y) || 0;
    for (const c of cameosOf(m)) cameos.push({ key: `${f.key}|${c.name}`, name: `${c.name} in ${f.name} (${f.year || "?"})`, films: [f], note: `Not counted: ${cameoWhy(c.why)}` });
    for (const p of smallPartsOf(m)) small.push({ key: `${f.key}|${p.name}`, name: `${p.name} in ${f.name} (${f.year || "?"})`, films: [f], note: `Not counted: ${smallWhy(p)}`, who: p.name, role: p.role });
    for (const role of Object.keys(ROLE_IDS)) {
      for (const p of rolePeople(m, role)) {
        if (!p.id) continue;
        films.set(p.id, (films.get(p.id) || new Set()).add(f.key));
        const fx = FACTS[p.id], label = P.label.get(P.canon.get(p.id) || p.id);
        if (label) (shownNs.get(label) || shownNs.set(label, { key: personKey(label), name: label, films: [] }).get(label)).films.push(f);
        const bad = badCredit(m, p.id, role, p.place);
        if (bad === "born") impossible.push({ key: `${f.key}|${p.id}`, name: `${p.name} in ${f.name} (${f.year || "?"})`, films: [f],
          note: `TMDB: born ${fx.b}, ${roleWord[role]} in a film of ${y}` });
        else if (bad === "died") late.push({ key: `${f.key}|${p.id}`, name: `${p.name} in ${f.name} (${f.year || "?"})`, films: [f], note: `TMDB: died ${fx.d}, film of ${y}; not counted` });
        if (p.moved) wrong.push({ key: `${f.key}|${p.moved}`, name: `${p.name} in ${f.name} (${f.year || "?"})`, films: [f], note: "IMDb has this role as another person of that name" });
      }
    }
  }
  // the people whose dates are asked for (`factsWanted`): in two or more films, or sharing a name
  const wanted = [...films].filter(([id, s]) => s.size >= 2 || P.label.has(id)).map(([id]) => id);
  // small parts of people counted in SMALL_KNOWN or more films: the ones worth seeing
  const known = small.filter((p) => (countedIn(lib, p.role).get(personKey(p.who)) || 0) >= SMALL_KNOWN);
  return { namesakes: [...shownNs.values()].sort((a, b) => a.name.localeCompare(b.name)), impossible, wrong, late, cameos, small: small.length, smallKnown: known, dated: wanted.filter((id) => FACTS[id]).length, wanted: wanted.length };
}
const SMALL_KNOWN = 3;
function factsProgressText() { return `Checking people's dates on TMDB: ${fmtN(factsJob.done)} of ${fmtN(factsJob.total)}.`; }
// In the Cast & crew box on both layouts, for any diary with cast and crew from TMDB.
function peopleCheckBlock(lib, phone) {
  if (IN_VIEWER || !lib || !lib.films.some((f) => META[f.key] && META[f.key].ci)) return "";
  const title = phone ? `<p class="title" style="margin-top:6px">People check</p>` : `<h3 class="sub-h">People check</h3>`;
  if (factsJob.running) return title + `<p class="status" id="facts-progress" role="status">${factsProgressText()}</p>`;
  const r = peopleCheck(lib), list = (items, t, s) => dlink(D.names(t, s, items), plural(items.length, "credit"));
  const lines = [`Everyone in your films is TMDB's person, told apart by TMDB's own id, so two people who share a name are never counted as one, and each credit is checked against that person's dates on TMDB.`];
  lines.push(r.cameos.length ? `${dlink(D.names("Cameos, not counted", "Labelled cameos, people playing themselves, authors in a walk-on, stars far down the cast", r.cameos), plural(r.cameos.length, "cameo"))} in your films ${r.cameos.length === 1 ? "isn't" : "aren't"} counted: labelled cameos, people playing themselves, the author of the source in a walk-on, and stars far down the cast (an extended cameo that names its character still counts).` : "No cameos found in your films.");
  if (r.small) lines.push(`${plural(r.small, "small part")} in your films ${r.small === 1 ? "isn't" : "aren't"} counted either: below the top ${PRINCIPAL} of a cast of more than ${BIG_CAST}, in its lower half or past the ${ordinal(BIG_CAST)}, and bit parts ("Guy at bar", "Cop #2") below the top ${BIT_FROM}.${r.smallKnown.length ? ` ${dlink(D.names("Small parts, not counted", `Of people counted in ${SMALL_KNOWN} or more of your films`, r.smallKnown), plural(r.smallKnown.length, "of them", "of them").replace(/^1 of them/, "One"))} ${r.smallKnown.length === 1 ? "is" : "are"} by people counted in ${SMALL_KNOWN} or more of your other films.` : ""}`);
  if (r.namesakes.length) lines.push(`${dlink(D.names("People who share a name", "Each counted apart, with their own films", r.namesakes), plural(r.namesakes.length, "person", "people"))} in your diary share a name with someone else there, so each is shown with their years, like ${esc(r.namesakes[0].name)}.`);
  else lines.push("No two people in your diary share a name.");
  lines.push(r.impossible.length ? `${list(r.impossible, "Not counted: impossible by TMDB's dates", "Credited in a film made before they were born (or too young to make it)")} ${r.impossible.length === 1 ? "is" : "are"} impossible by TMDB's own dates (a film made before the person was born), so ${r.impossible.length === 1 ? "it isn't" : "they aren't"} counted.`
    : "No credit is impossible by TMDB's own dates.");
  if (r.wrong.length) lines.push(`${list(r.wrong, "Given to the right person by IMDb", "TMDB gave these roles to another person of the same name")} TMDB gave to the wrong person of that name, by IMDb's cast lists; they're counted for the right one.`);
  if (r.late.length) lines.push(`${list(r.late, "Not counted: long after a death", "Small roles credited more than five years after the person died: TMDB gave them to the wrong person of that name")} ${r.late.length === 1 ? "is a small role" : "are small roles"} credited more than five years after the person died: TMDB gave ${r.late.length === 1 ? "it" : "them"} to the wrong person of that name, so ${r.late.length === 1 ? "it isn't" : "they aren't"} counted (a lead in a film released long after still is).`);
  lines.push(`Dates checked for ${fmtN(r.dated)} of ${plural(r.wanted, "person", "people")}: everyone in two or more of your films, and everyone who shares a name.`);
  return title + lines.map((t) => `<p class="status">${t}</p>`).join("");
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
      if (++sinceSave >= 100) { sinceSave = 0; saveMeta(); } // scores only: the page redraws once, at the end
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
  const id = (t.match(/themoviedb\.org\/movie\/(\d+)/) || t.match(/^(\d+)$/) || [])[1];
  const ep = t.match(/themoviedb\.org\/tv\/(\d+)[^/\s]*\/season\/(\d+)\/episode\/(\d+)/), tv = t.match(/themoviedb\.org\/tv\/(\d+)/);
  const imdb = (t.match(/\b(tt\d{5,})\b/) || [])[1];
  let ref = id ? { movie: Number(id) } : ep ? { tv: Number(ep[1]), se: Number(ep[2]), ep: Number(ep[3]) } : tv ? { tv: Number(tv[1]) } : null;
  if (!ref && imdb) {
    ref = await tmdbRefFor(imdb, key);
    if (!ref) throw new Error("TMDB doesn't know a film with that IMDb link.");
  }
  if (!ref) throw new Error("Paste a link to the film on themoviedb.org or imdb.com.");
  const m = await tmdbFetch(ref, key);
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
