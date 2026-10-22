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
// Bump when matching or the stored fields change, so saved films are looked up again.
const TMDB_MATCH_VERSION = 3;
// Letterboxd dates a film by its first showing; TMDB often by a later release (Brick: 2005 vs 2006),
// and several films can share a title (a feature and a short called "Brick"). So allow a gap of a
// year or two, insist on the title, and let the number of TMDB votes pick the real film.
function pickHit(results, f, tolerance, needTitle) {
  if (!results || !results.length) return null;
  const want = personKey(f.name);
  const yearOf = (r) => parseInt((r.release_date || "").slice(0, 4), 10);
  const titled = (r) => personKey(r.title || "") === want || personKey(r.original_title || "") === want;
  const ranked = results
    .filter((r) => !f.year || !yearOf(r) || Math.abs(yearOf(r) - f.year) <= tolerance)
    .map((r) => ({ r, score: (titled(r) ? 1000 : 0) + Math.log10((r.vote_count || 0) + 1) * 100 + (yearOf(r) === f.year ? 50 : 0) - (r.video ? 100 : 0) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || (needTitle && !titled(best.r))) return null;
  return best.r;
}
async function tmdbFilm(f, key, signal) {
  let s = await tmdbGet("/search/movie", { query: f.name, year: f.year || "", include_adult: "false" }, key, signal);
  let hit = pickHit(s && s.results, f, 2, false);
  if (!hit && f.year) {
    s = await tmdbGet("/search/movie", { query: f.name, include_adult: "false" }, key, signal);
    hit = pickHit(s && s.results, f, 2, true);
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
    l: d.original_language, r: d.runtime, va: d.vote_average, vc: d.vote_count, im: d.imdb_id,
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
        else {
          // keep IMDb scores already fetched for the same film, so OMDb's daily allowance isn't spent twice
          const prev = META[f.key];
          if (prev && prev.om && prev.im === m.im) for (const k of ["ir", "iv", "mc", "rt", "om"]) m[k] = prev[k];
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
  if (tmdbKey() && needsLookup(lib, "tmdb").length) await runTmdb(lib, tmdbKey());
  if (omdbKey() && !imdbJob.badKey && needsImdb(lib).length) runOmdb(lib, omdbKey());
}

/* ----- IMDb, Metacritic and Rotten Tomatoes scores, through OMDb -----
   TMDB gives each film's IMDb id; OMDb turns it into scores. Its free key allows 1,000 films a day,
   so a big library fills in over a few days, picking up where it stopped each time the page opens. */
const omdbKey = () => store.get(KEYS.omdb, "");
const imdbJob = { running: false, ctl: null, done: 0, total: 0, note: "", err: false, badKey: false };
let editOmdb = false;
const needsImdb = (lib) => lib.films.filter((f) => { const m = META[f.key]; return m && !m.miss && m.im && !m.om; });
async function runOmdb(lib, key) {
  const queue = needsImdb(lib);
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
          m.om = today; // OMDb doesn't know this film; don't ask again
        } else {
          const rt = (d.Ratings || []).find((x) => x.Source === "Rotten Tomatoes");
          Object.assign(m, { ir: num(d.imdbRating), iv: num(d.imdbVotes), mc: num(d.Metascore), rt: rt ? num(rt.Value) : null, om: today });
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
function retryClaudeMisses(lib) {
  for (const f of lib.films) { const m = META[f.key]; if (m && m.miss && m.src === "claude") delete META[f.key]; }
  return runClaude(lib);
}
</script>
