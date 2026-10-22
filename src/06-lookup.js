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
const tmdbKey = () => store.get(KEYS.tmdb, "") || BUILT_IN_TMDB_KEY;
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

function needsLookup(lib, kind) {
  return lib.films.filter((f) => {
    const m = META[f.key];
    if (kind === "tmdb") {
      if (!m) return true;
      if (m.src === "tmdb") return (m.v || 1) < TMDB_MATCH_VERSION;
      return !(m.tmdbMiss >= TMDB_MATCH_VERSION);
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
// Bump when matching changes, so films matched the old way are looked up again.
const TMDB_MATCH_VERSION = 2;
// Several films can share a title and year (a feature and a short called "Brick", say).
// Prefer an exact title in the right year, then the film most people on TMDB have rated.
function pickHit(results, f, tolerance) {
  if (!results || !results.length) return null;
  const want = personKey(f.name);
  const yearOf = (r) => parseInt((r.release_date || "").slice(0, 4), 10);
  const titled = (r) => personKey(r.title || "") === want || personKey(r.original_title || "") === want;
  const ranked = results
    .filter((r) => !f.year || (yearOf(r) && Math.abs(yearOf(r) - f.year) <= tolerance))
    .map((r) => ({ r, score: (titled(r) ? 4 : 0) + (yearOf(r) === f.year ? 2 : 0) - (r.video ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || (b.r.vote_count || 0) - (a.r.vote_count || 0) || (b.r.popularity || 0) - (a.r.popularity || 0));
  const best = ranked[0];
  if (!best) return null;
  return titled(best.r) || tolerance === 0 ? best.r : null;
}
async function tmdbFilm(f, key, signal) {
  let s = await tmdbGet("/search/movie", { query: f.name, year: f.year || "", include_adult: "false" }, key, signal);
  let hit = pickHit(s && s.results, f, 0);
  if (!hit && f.year) {
    s = await tmdbGet("/search/movie", { query: f.name, include_adult: "false" }, key, signal);
    hit = pickHit(s && s.results, f, 1);
  }
  if (!hit) return { src: "tmdb", miss: true, v: TMDB_MATCH_VERSION };
  const d = await tmdbGet(`/movie/${hit.id}`, { append_to_response: "credits" }, key, signal);
  if (!d) return { src: "tmdb", miss: true, v: TMDB_MATCH_VERSION };
  const crew = (d.credits && d.credits.crew) || [];
  const cast = ((d.credits && d.credits.cast) || []).slice().sort((a, b) => a.order - b.order).slice(0, CAST_DEPTH);
  const names = (list) => [...new Set(list.map((x) => x.name))];
  for (const p of [...cast, ...crew.filter((c) => c.job === "Director")]) if (p.profile_path && !PHOTOS[personKey(p.name)]) PHOTOS[personKey(p.name)] = p.profile_path;
  return cleanMeta({
    src: "tmdb", v: TMDB_MATCH_VERSION, id: d.id, poster: d.poster_path,
    d: names(crew.filter((c) => c.job === "Director")),
    c: cast.map((c) => c.name),
    w: names(crew.filter((c) => ["Screenplay", "Writer", "Story"].includes(c.job))),
    p: names(crew.filter((c) => c.job === "Director of Photography")),
    m: names(crew.filter((c) => c.job === "Original Music Composer" || c.job === "Music")),
    g: (d.genres || []).map((g) => g.name),
    k: (d.production_countries || []).map((c) => c.name),
    l: d.original_language, r: d.runtime,
  });
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
        const m = await tmdbFilm(f, key, signal);
        if (m.miss) { if (!META[f.key] || META[f.key].src === "tmdb") META[f.key] = m; else META[f.key].tmdbMiss = TMDB_MATCH_VERSION; job.failed++; }
        else META[f.key] = m;
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
  runTmdb(lib, key);
}
// After an import, a copy that already knows a key looks films up without being asked.
function autoLookup(lib) {
  if (!IN_VIEWER && tmdbKey() && needsLookup(lib, "tmdb").length) runTmdb(lib, tmdbKey());
}

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
function retryClaudeMisses(lib) {
  for (const f of lib.films) { const m = META[f.key]; if (m && m.miss && m.src === "claude") delete META[f.key]; }
  return runClaude(lib);
}
</script>
