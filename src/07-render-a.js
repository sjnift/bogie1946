<script>
/* ---------- page state ---------- */
const state = {
  mode: "example", lib: null, scope: "all", page: "stats", crowd: null, wn: "any", insYear: "all", reviewQuery: "", cmp: null, cmpError: "", unfriend: null,
  tab: { cast: "most", voices: "most", directors: "most", crew: "w", crewSort: "most", cats: "most" },
  more: { cast: false, voices: false, directors: false },
};
let MY_LIB = null, EXAMPLE_LIB = null, STATS = null;
let IMG = imgBase(); // TMDB's picture server, or the relay where it can't be reached (05-core)
const showImages = !IN_VIEWER; // pages inside Claude can't load outside images

function metaOf(f) {
  if (state.mode === "example") return EXAMPLE_META[f.key] || null;
  const m = META[f.key];
  if (m && !m.miss) return m;
  return EXAMPLE_META[f.key] || null;
}
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}
function saveView() { store.set(KEYS.view, { scope: state.scope, mode: state.mode, page: state.page }); }

function render() {
  LISTS = new Map();
  state.lib = state.mode === "mine" && MY_LIB ? MY_LIB : EXAMPLE_LIB;
  if (state.mode === "mine" && !MY_LIB) state.mode = "example";
  // nothing imported: an import screen, not the made-up example (that needs ?example in the address)
  const empty = !MY_LIB && !SHOW_EXAMPLE;
  document.body.classList.toggle("empty", empty);
  siteRedraw();
  if (empty) { renderWelcome(); return; }
  const base = state.lib, page = state.page;
  const years = [...new Set(base.entries.map((e) => e.date.slice(0, 4)))].sort().reverse();
  if (state.scope !== "all" && !years.includes(state.scope)) state.scope = "all";
  if (page === "stats") state.lib = filteredLib(base, metaOf); // the filters narrow the stats, not Insights or Compare
  STATS = computeStats(state.lib, metaOf, state.scope);
  renderHero(STATS, years);
  for (const sel of ["#tiles", "#lookup-mini", "#ios-tip", "#sections", "#jump", ".scopes-row"]) $(sel).hidden = page !== "stats";
  $("#settings").hidden = page !== "settings";
  $("footer").hidden = page === "settings"; // Settings ends with its own About
  $("#btn-settings span").textContent = page === "settings" ? "Back to stats" : "Settings";
  $("#insights").hidden = page !== "insights";
  $("#compare").hidden = page !== "compare";
  $("#drillpage").hidden = page !== "drill";
  $("#btn-insights").textContent = page === "insights" ? "Back to stats" : "Insights";
  $("#btn-compare").textContent = page === "compare" ? "Back to stats" : "Compare";
  $("#backup").hidden = IN_VIEWER || !MY_LIB;
  if (page === "drill") { $(".scopes-row").hidden = true; renderDrillPage(); syncHash(); return; }
  if (page === "insights") { renderInsights(); return; }
  if (page === "compare") { renderCompare(); return; }
  if (page === "settings") { $(".scopes-row").hidden = true; renderSettings(); syncHash(); return; }
  renderTiles(STATS);
  const tip = $("#ios-tip");
  tip.hidden = !iosTipDue();
  if (!tip.hidden) tip.innerHTML = `${esc(IOS_TIP_TEXT)} <button class="linkish" type="button" data-iostip>Got it</button>`;
  renderLookup();
  renderSections(STATS);
  syncHash();
}
// Search opens over whatever is on screen.
function openSearch() {
  const top = DSTACK[DSTACK.length - 1];
  if ($("#dlg").open && top && top.kind === "search") { $("#search-q")?.focus(); return; }
  openDrill({ kind: "search", title: "Search your diary", sub: "", q: "" }, $("#dlg").open);
}

/* ---------- title band ---------- */
// The page with nothing imported: what to do, and why the diary isn't showing if the browser lost hold of it.
function renderWelcome() {
  $("#example-notice").hidden = false;
  // plain and short: what to do, nothing else (the owner's call, Oct 2026)
  $("#hero-eyebrow").textContent = "";
  $("#hero-title").innerHTML = "Import your <span class=\"accent\">diary</span>";
  $("#hero-sub").innerHTML = "";
  $("#notice-text").innerHTML = (LOAD_ERROR ? `<p><strong>Your saved diary couldn't be read</strong> (${esc(LOAD_ERROR)}). Import your export again.</p>` : store.failed
    ? `<p><strong>This browser's saved data couldn't be opened just now</strong>, so your diary isn't showing. Close the page and open it again; if it still isn't there, import your export or a backup file again.</p>` : "") +
    `<ol class="steps"><li>On <a href="https://letterboxd.com/settings/data/" target="_blank" rel="noopener">letterboxd.com → Settings → Data</a>, choose <em>Export your data</em>.</li>
    <li>Import the ZIP here.</li></ol>`;
  $("#btn-import-2").classList.add("primary");
  $("#btn-import-2").textContent = "Import export";
  $("#backup").hidden = true;
  for (const sel of ["#insights", "#compare", "#drillpage"]) $(sel).hidden = true;
}
function renderHero(s, years) {
  const lib = state.lib, ex = state.mode === "example";
  $("#example-notice").hidden = !ex;
  if (ex) $("#notice-text").innerHTML = `<p><strong>This is a made-up example diary.</strong> To see your own stats, import your Letterboxd export (Letterboxd → Settings → Data → Export your data).</p>`;
  $("#btn-import-2").classList.remove("primary");
  $("#btn-import-2").textContent = "Import export";
  const who = ex ? "Example diary" : lib.profile.username ? `@${lib.profile.username}` : "Your diary";
  const since = !ex && lib.profile.joined ? ` · member since ${MONTHS[+lib.profile.joined.slice(5, 7) - 1]} ${lib.profile.joined.slice(0, 4)}` : "";
  $("#hero-eyebrow").textContent = who + since;
  $("#hero-title").innerHTML = state.scope === "all" ? "All <span class=\"accent\">time</span>" : `<span class="accent">${esc(state.scope)}</span> in film`;
  const hours = Math.round(s.minutes / 60);
  let line = (filterOn() && state.page === "stats" ? `<span class="fnote">${esc(filterText())}:</span> ` : "") + dlink(DR.films(s), plural(s.films.length, "film"));
  if (s.timed) line += ` and ${dlink(DR.runtime(s), plural(hours, "hour"))} in front of the screen`;
  line += ".";
  const star = s.cast.most[0], dir = s.directors.most[0];
  if (star && star.count > 1) line += ` ${dlink(DR.person(star), esc(star.name))} turns up most, in ${star.count} of them.`;
  if (dir && dir.count > 1) line += ` ${dlink(DR.person(dir), esc(dir.name))} directed the most, with ${dir.count}.`;
  if (!s.withMeta && s.films.length) line += " Look up cast and crew below to see who you watch most.";
  // the year (or all time) as a story and a picture, always of the whole diary
  if (state.page === "stats" && state.lib.entries.length) line += ` <span class="hero-acts">${dlink(D.story(state.scope), `▶ Play ${state.scope === "all" ? "all time" : state.scope} as a story`)} · ${dlink(D.share(state.scope), "share it as a picture")}</span>`;
  $("#hero-sub").innerHTML = line;
  $("#scopes").innerHTML = ["all", ...years].map((y) =>
    `<button class="chip" type="button" data-scope="${y}" aria-pressed="${y === state.scope}">${y === "all" ? "All time" : y}</button>`).join("");
}

/* ---------- overview tiles ---------- */
function tile(label, value, foot, to, footTo) {
  const main = `<span class="label">${label}</span><span class="value">${value}</span>`;
  return `<div class="tile">${to ? `<button class="tile-main" type="button" ${dl(to)}>${main}</button>` : `<div class="tile-main">${main}</div>`}
    <span class="foot">${foot ? dlink(footTo, foot) : "&nbsp;"}</span></div>`;
}
function renderTiles(s) {
  const films = s.films.length;
  const hours = s.minutes / 60;
  const lib = state.lib;
  const [filmFoot, filmFootTo] = s.newReleases != null ? [`${fmtN(s.newReleases)} released in ${s.scope}`, DR.released(s, s.scope)] :
    lib.watchlist ? [`${fmtN(lib.watchlist)} on watchlist`, DR.watchlist(lib)] : [`${fmtN(s.films.filter((f) => f.entries.length).length)} in your diary`, DR.inDiary(s)];
  const hoursVal = s.timed ? `${fmtN(Math.round(hours))}<small>h</small>` : "—";
  const hoursFoot = !s.timed ? "after cast &amp; crew lookup" : s.timed < films ? `length known for ${plural(s.timed, "film")}` : `${fmtN(s.minutes)} min`;
  const pct = s.entries.length ? Math.round(s.rewatches / s.entries.length * 100) : 0;
  const reviews = lib.reviews.filter((r) => s.scope === "all" || (r.date || "").startsWith(s.scope));
  $("#tiles").innerHTML = [
    tile("Films", fmtN(films), filmFoot, films && DR.films(s), filmFootTo),
    tile("Hours", hoursVal, hoursFoot, s.timed && DR.runtime(s), s.timed && DR.runtime(s)),
    tile("Diary entries", fmtN(s.entries.length), s.streak.days > 1 ? `longest streak ${s.streak.days} days` : "", s.entries.length && DR.diary(s), s.streak.days > 1 && DR.streak(s)),
    tile("Average rating", s.avgRating ? s.avgRating.toFixed(2) + "<small>/ 5</small>" : "—", `${fmtN(s.rated)} rated`, s.rated && DR.rated(s), s.rated && DR.rated(s)),
    tile("Rewatches", fmtN(s.rewatches), s.entries.length ? `${pct}% of entries` : "", s.rewatches && DR.rewatches(s), s.rewatches && DR.rewatches(s)),
    tile("Reviews", fmtN(s.reviews), `${fmtN(s.likes)} liked`, reviews.length && D.reviews(s.scope === "all" ? "Your reviews" : `Reviews of ${s.scope}`, plural(reviews.length, "review"), reviews), s.likes && DR.liked(s)),
  ].join("");
}

/* ---------- cast & crew lookup panel ---------- */
// Settings: the export, film details, the diary on this site, backups and the small print, away from the stats.
function renderSettings() {
  $("#hero-title").innerHTML = `<span class="accent">Settings</span>`;
  $("#hero-sub").textContent = "Your export, film details, your diary on this site, and backups.";
  const lib = MY_LIB;
  $("#set-export").innerHTML = lib ? `${plural(lib.films.length, "film")}, ${plural(lib.entries.length, "diary entry", "diary entries")} and ${plural(lib.reviews.length, "review")} imported${lib.profile.username ? ` for @${esc(lib.profile.username)}` : ""}.${lib.reviewTextMissing ? " The review text is missing, so import the export again." : ""}`
    : "Nothing imported yet: this is the example diary.";
  $("#set-site").hidden = !SITE_ON;
  renderLookup();
  siteRedraw();
}
const goSettings = () => { closePanelThen(() => { state.page = "settings"; render(); window.scrollTo(0, 0); }); };
// On the stats page, one line while films are being looked up, or while they still need cast and crew.
function renderLookupMini() {
  const el = $("#lookup-mini");
  if (!el) return;
  let html = "";
  if (state.page === "stats" && state.mode === "mine" && state.lib) {
    // films still to look up (not ones TMDB has no match for: nothing more can be done about those here)
    const todo = IN_VIEWER ? null : new Set(needsLookup(state.lib, "tmdb"));
    const without = state.lib.films.filter((f) => !metaOf(f) && (!todo || todo.has(f))).length;
    if (job.running) html = `<span id="lookup-mini-progress">${progressText()}</span> <button class="linkish" type="button" data-goto="settings">See it in Settings</button>`;
    else if (without && (IN_VIEWER || !tmdbKey())) html = `${plural(without, "film")} ${without === 1 ? "has" : "have"} no cast and crew yet. <button class="linkish" type="button" data-goto="settings">Fill them in from Settings</button>`;
    else if (MY_LIB && partsToCheck(MY_LIB).length) { const n = partsToCheck(MY_LIB).length; html = `${plural(n, "part")} to check: ${n === 1 ? "a famous name" : "famous names"} far down a big cast, left out as ${n === 1 ? "a walk-on" : "walk-ons"}. <button class="linkish" type="button" data-goto="settings">Check in Settings</button>`; }
  }
  if (el.innerHTML !== html) el.innerHTML = html;
  el.hidden = !html;
}
function renderLookup() { renderLookupBox(); renderLookupMini(); }
function renderLookupBox() {
  const el = $("#lookup");
  if (!state.lib) return;
  if (state.mode === "example") {
    el.innerHTML = `<div class="lookup-head"><h2 id="lookup-title">Cast &amp; crew</h2><span class="src-tag">Example data</span></div>
      <p>Letterboxd's export lists your films, dates and ratings, but not who's in them. The example comes with cast and crew filled in.
      After you import your own export, you can fill yours in from TMDB with your API key, or from Claude.</p>`;
    return;
  }
  const lib = state.lib;
  const total = lib.films.length;
  const have = lib.films.filter((f) => metaOf(f)).length;
  const fromTmdb = lib.films.filter((f) => META[f.key] && META[f.key].src === "tmdb" && !META[f.key].miss).length;
  const pctHave = total ? Math.round(have / total * 100) : 0;
  const head = `<div class="lookup-head"><h2 id="lookup-title">Cast &amp; crew</h2>
    <span class="src-tag">${fromTmdb ? (fromTmdb === have ? "TMDB" : "TMDB + Claude") : have ? "Claude's film knowledge" : "Not looked up yet"}</span></div>`;
  const meter = `<div class="meter" role="progressbar" aria-label="Films with cast and crew" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pctHave}"><span id="lookup-meter" style="width:${pctHave}%"></span></div>`;
  const note = job.note ? `<div class="status${job.err ? " err" : ""}" role="status">${esc(job.note)}</div>` : "";
  const saveNote = job.saveFailed ? `<div class="status err">This browser wouldn't save the results, so they'll be gone when you close the page.</div>` : "";

  if (job.running) {
    el.innerHTML = head + meter + `<div class="lookup-row"><span class="status" id="lookup-progress" role="status">${progressText()}</span>
      <button class="btn small" type="button" id="btn-stop">Stop</button></div>`;
    return;
  }
  const withMeta = lib.films.filter((f) => metaOf(f)), without = lib.films.filter((f) => !metaOf(f));
  const coverage = `<p><strong>${dlink(D.films("With cast & crew", filmsSub(withMeta), withMeta, { sort: "name" }), fmtN(have))} of ${plural(total, "film")}</strong> ${total === 1 ? "has" : "have"} cast and crew${without.length ? ` (${dlink(D.films("Without cast & crew", "Films with no details yet, or no match on TMDB", without, { sort: "name" }), `${fmtN(without.length)} without`)})` : ""}. `;
  let body = "";
  if (!IN_VIEWER) {
    const key = tmdbKey();
    const askKey = !key || editKey || job.badKey;
    const todo = needsLookup(lib, "tmdb").length;
    const missing = total - have, replace = Math.max(0, todo - missing);
    body = coverage + (!todo ? (have < total ? `TMDB had no match for the other ${fmtN(total - have)}.</p>` : "All of them come from TMDB.</p>") :
      `TMDB can fill in ${missing ? `the missing ${fmtN(missing)}` : ""}${missing && replace ? " and " : ""}${replace ? `replace Claude's details for ${plural(replace, "film")}` : ""}.</p>`) +
      (todo && !askKey ? `<div class="lookup-row"><button class="btn primary" type="button" id="btn-tmdb">Look up ${plural(todo, "film")} on TMDB</button>
        <span class="status">${ownTmdbKey() ? "Using your saved TMDB key." : "Using this site's shared TMDB key."} <button class="linkish" type="button" id="btn-change-key">${ownTmdbKey() ? "Change key" : "Use your own key"}</button></span></div>` :
      todo ? `<div class="lookup-row">
        <label class="sr-only" for="tmdb-key">TMDB API key or read access token</label>
        <input id="tmdb-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your TMDB API key or read access token" value="${esc(ownTmdbKey())}">
        <button class="btn primary" type="button" id="btn-tmdb">Look up ${plural(todo, "film")}</button>
      </div>
      <p class="status">Get a free key from <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a>. The key is saved in this browser (and in your locked diary on this site, if it's there) and sent only to TMDB.</p>` : "");
  } else {
    const todo = needsLookup(lib, "claude").length;
    const misses = lib.films.filter((f) => META[f.key] && META[f.key].miss && META[f.key].src === "claude").length;
    const calls = Math.ceil(todo / CLAUDE_BATCH);
    if (sampleState === "ready") {
      body = coverage + `Pages inside Claude can't reach TMDB, so Claude fills in each film from what it knows.
        That works well for most films, but can miss or confuse obscure ones. For TMDB's data, open the downloadable copy of this page in your browser.</p>` +
        (todo ? `<div class="lookup-row"><button class="btn primary" type="button" id="btn-claude">Look up ${plural(todo, "film")} with Claude</button>
          <span class="status">About ${plural(calls, "request")} on your Claude plan.</span></div>` :
        misses ? `<div class="lookup-row"><button class="btn" type="button" id="btn-claude-retry">Try the ${plural(misses, "film")} Claude didn't recognise</button></div>` : "");
    } else if (sampleState === "pending") {
      body = coverage + "Connecting to Claude…</p>";
    } else {
      body = coverage + `Lookups aren't available in this view. Open the downloadable copy of this page in your browser and use a TMDB key instead.</p>`;
    }
  }
  el.innerHTML = head + meter + body + note + saveNote + imdbBlock(lib, false) + letterboxdBlock(lib, false) + castCheckBlock(lib, false) + peopleCheckBlock(lib, false) + feedBlock(lib, false) + dataCheckBlock(lib, false) + picturesBlock(false);
}
function progressText() {
  const what = job.kind === "tmdb" ? "on TMDB" : "with Claude";
  return job.kind === "claude" && job.done === 0 ? `Asking Claude about ${plural(job.total, "film")}… the first batch takes up to a minute.`
    : `Looked up ${fmtN(job.done)} of ${plural(job.total, "film")} ${what}…`;
}
function renderLookupProgress() {
  const p = $("#lookup-progress");
  if (p) p.textContent = progressText();
  const mp = $("#lookup-mini-progress");
  if (mp) mp.textContent = progressText();
  const ip = $("#imdb-progress");
  if (ip) ip.textContent = imdbProgressText();
  const lp = $("#lb-progress");
  if (lp) lp.textContent = lbProgressText();
  const cp = $("#ic-progress");
  if (cp) cp.textContent = castProgressText();
  const fp = $("#facts-progress");
  if (fp) fp.textContent = factsProgressText();
  const m = $("#lookup-meter");
  if (m && state.lib) {
    const have = state.lib.films.filter((f) => metaOf(f)).length;
    m.style.width = `${state.lib.films.length ? Math.round(have / state.lib.films.length * 100) : 0}%`;
  }
}
</script>
