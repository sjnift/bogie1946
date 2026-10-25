<script>
/* ---------- Diary ---------- */
// a fact that opens what it counts, or the film it names
const fact = (k, v, f, to) => { const inner = `<span class="k">${k}</span><span class="v">${esc(v)}${to || f ? '<span class="go" aria-hidden="true"> ›</span>' : ""}</span>`;
  return to || f ? `<button class="fact" type="button" ${dl(to || D.film(f))}>${inner}</button>` : `<div class="fact">${inner}</div>`; };
const cardH = (title, right = "") => `<div class="card-h"><h4>${title}</h4>${right ? `<span>${right}</span>` : ""}</div>`;
function diaryScreen(s) {
  const head = ltitle("Diary") + scopeBar();
  if (!s.entries.length) return head + `<div class="empty" style="padding-top:28px">No diary dates in ${s.scope === "all" ? "your export" : s.scope}. Films logged without a date still count on the other tabs.</div>`;
  const cols = memo(`timeline|${s.scope}`, () => timeline(s));
  const unit = s.scope !== "all" ? "week" : cols[0].key.length === 7 ? "month" : "year";
  const bm = s.busiestMonth, fav = s.weekday.indexOf(Math.max(...s.weekday));
  const facts = `<div class="facts">${[
    fact("Busiest month", bm ? `${MONTHS[+bm.key.slice(5, 7) - 1]} ${bm.key.slice(0, 4)} · ${plural(bm.count, "film")}` : "—", null, bm && DR.month(s.entries, bm.key)),
    fact("Longest streak", s.streak.days > 1 ? `${s.streak.days} days` : "1 day", null, DR.streak(s)),
    fact("Most in a day", s.busiestDay ? `${plural(s.busiestDay.count, "film")} · ${fmtDate(s.busiestDay.key).replace(/ \d{4}$/, s.scope === "all" ? "$&" : "")}` : "—", null, s.busiestDay && DR.day(s.entries, s.busiestDay.key)),
    fact("Favourite day", WEEKDAYS_LONG[fav], null, memo(`wd|${s.scope}`, () => s.weekday.map((n, i) => DR.weekday(s.entries, i)))[fav]),
  ].join("")}</div>`;
  const legend = s.rewatches ? `<div class="legend"><span><i style="background:var(--green-mark)"></i>First watch</span><span><i style="background:var(--blue-mark)"></i>Rewatch</span></div>` : "";
  let chart = colChart(cols, `Diary entries by ${unit}`, legend, 120, { unit: "films" });
  if (cols.length > 24) chart = chart.replace('class="axis"', 'class="axis dense"');
  const wmax = Math.max(1, ...s.weekday), byWeekday = memo(`wd|${s.scope}`, () => s.weekday.map((n, i) => DR.weekday(s.entries, i)));
  const weekdays = `<div class="weekdays" role="group" aria-label="Diary entries by day of the week">${s.weekday.map((n, i) =>
    `<button class="wd${i === fav ? " fav" : ""}" type="button" ${dl(byWeekday[i])} aria-label="${WEEKDAYS_LONG[i]}: ${plural(n, "film")}"><span class="cnt">${n}</span><span class="bar-v"><span style="height:${(n / wmax * 100).toFixed(1)}%"></span></span><span class="lbl">${WEEKDAYS[i].slice(0, 2)}</span></button>`).join("")}</div>`;
  const list = [...s.entries].reverse().slice(0, state.diaryLimit);
  let rows = "", month = "";
  for (const e of list) {
    const m = e.date.slice(0, 7);
    if (m !== month) { month = m; rows += `<div class="month-h" data-k="m${m}"><span>${MONTHS_LONG[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}</span><span>${fmtN(s.byMonth.get(m) || 0)}</span></div>`; }
    rows += `<button class="drow" type="button" data-k="${esc(e.film.key)}|${e.date}|${e.order}" ${dl(D.film(e.film, { entry: e }))}><span class="day"><b>${+e.date.slice(8, 10)}</b><small>${WEEKDAYS[weekdayOf(e.date)]}</small></span>${poster(e.film)}
      <span style="min-width:0"><span class="t">${esc(e.film.name)} <span>${e.film.year || ""}</span></span>
      <span class="m"><span class="stars">${stars(e.rating)}</span></span></span>
      <span class="icons">${e.rewatch ? '<span class="rewatch" title="Rewatch">↻</span>' : ""}${e.film.liked ? '<span class="heart" title="Liked">♥</span>' : ""}${e.review ? '<span title="Reviewed">≡</span>' : ""}</span></button>`;
  }
  const more = s.entries.length > state.diaryLimit ? `<button class="row" type="button" data-act="more-diary" data-auto style="padding-inline:0"><span>Show older entries</span><span class="count">${fmtN(s.entries.length - state.diaryLimit)} more</span>${CHEV}</button>` : "";
  return head + facts +
    sh(`Films by ${unit}`, `<span class="count">${plural(s.entries.length, "entry", "entries")}</span>`) + `<div class="card">${chart}</div>` +
    sh("Days of the week") + `<div class="card">${weekdays}</div>` +
    sh(s.scope === "all" ? "Last 12 months" : `Every day of ${s.scope}`) + `<div class="card">${heatmap(s).replace("Fewer", "Less")}</div>` +
    sh("Entries") + `<div>${rows}</div>` + more;
}

/* ---------- Stats › Films ---------- */
function filmsScreen(s) {
  const views = (f) => s.scope === "all" ? f.entries.length : f.entries.filter((e) => e.date.startsWith(s.scope)).length;
  const rated = s.films.filter((f) => f.rating).sort((a, b) => b.rating - a.rating || views(b) - views(a) || (b.year || 0) - (a.year || 0));
  let html = statsHead();
  if (!s.films.length) return html + `<div class="empty">No films in this period.</div>`;

  const E = s.entries;
  if (E.length) {
    const marks = s.scope === "all" ? [50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000] : [25, 50, 100, 150, 200, 250, 300, 365, 400, 500];
    const items = [["First film", E[0], 1], ...marks.filter((n) => n < E.length).slice(-5).map((n) => [`${ordinal(n)} film`, E[n - 1], n])];
    if (E.length > 1) items.push(["Latest", E[E.length - 1], E.length]);
    html += sh("Milestones") + `<div class="scroller">${items.map(([k, e, n]) => `<button class="pitem" type="button" ${dl(D.film(e.film, { entry: e, badge: `${k}: diary entry ${fmtN(n)} of ${fmtN(E.length)}${s.scope === "all" ? "" : ` in ${s.scope}`}, ${fmtDate(e.date)}` }))} title="${esc(e.film.name)}${e.film.year ? ` (${e.film.year})` : ""}">
      <span class="mlabel">${k}</span>${poster(e.film)}
      <span class="pmeta"><span class="stars">${stars(e.rating)}</span>${e.rewatch ? '<span class="rewatch" aria-label="rewatch">↻</span>' : ""}</span>
      <span class="mdate">${fmtDate(e.date)}</span></button>`).join("")}</div>`;
  }

  const re = s.films.filter((f) => views(f) > 1).sort((a, b) => views(b) - views(a) || (b.rating || 0) - (a.rating || 0)).slice(0, 8);
  if (re.length) html += sh("Most rewatched") + `<div>${re.map((f) => `<button class="drow plain" type="button" data-k="${esc(f.key)}" ${dl(D.film(f))}>${poster(f)}
    <span style="min-width:0"><span class="t">${esc(f.name)} <span>${f.year || ""}</span></span><span class="m"><span class="stars">${stars(f.rating)}</span>${likeMark(f)}</span></span>
    <span class="val num">${views(f)}×</span></button>`).join("")}</div>`;

  const timed = s.films.filter((f) => metaOf(f) && metaOf(f).r);
  const longest = timed.reduce((a, f) => !a || metaOf(f).r > metaOf(a).r ? f : a, null);
  const shortest = timed.reduce((a, f) => !a || metaOf(f).r < metaOf(a).r ? f : a, null);
  const dated = s.films.filter((f) => f.year);
  const oldest = dated.reduce((a, f) => !a || f.year < a.year ? f : a, null);
  const newest = dated.reduce((a, f) => !a || f.year > a.year ? f : a, null);
  const rec = [
    longest && fact("Longest", `${longest.name} · ${metaOf(longest).r} min`, longest), shortest && fact("Shortest", `${shortest.name} · ${metaOf(shortest).r} min`, shortest),
    oldest && fact("Oldest", `${oldest.name} · ${oldest.year}`, oldest), newest && fact("Newest", `${newest.name} · ${newest.year}`, newest),
  ].filter(Boolean).join("");
  if (rec) html += sh("Records") + `<div class="facts" style="margin-top:0">${rec}</div>`;
  // highest and lowest rated, further down than they were (the owner's call, Oct 2026)
  if (rated.length) html += sh("Highest rated", seeAll(`data-act="all-rated"`)) + posterGrid(rated.slice(0, 8));
  const low = rated.filter((f) => f.rating <= 2.5).reverse();
  if (low.length) html += sh("Lowest rated", low.length > 8 ? seeAll(dl(D.films("Lowest rated", filmsSub(low, "2½★ and under"), low, { scope: s.scope, sort: "given" }))) : "") + posterGrid(low.slice(0, 8));
  const habits = s.scope === "all" ? allInsights().habits : yearInsights(s.scope).habits.filter((h) => !["Longest streak", "Biggest day", "Oldest film"].includes(h.k));
  if (habits.length) html += mHabits(habits, "Habits");
  if (!s.withMeta) html += needMeta();
  return html + (mReviewInsights(state.lib, s.scope === "all" ? null : s.scope) || "");
}

/* ---------- Stats › Breakdown: the best decade, genres, countries, languages, decades ---------- */
// Decades with three or more rated films, best average first.
const rankedDecades = (s) => s.decades.filter((x) => x.ratings.length >= 3).sort((a, b) => b.avg - a.avg || b.count - a.count);
// The best-rated decade, up front, with its best films' posters.
function bestDecadeCard(x, scope) {
  const pics = showImages ? x.top.filter((f) => metaOf(f) && metaOf(f).poster).slice(0, 3) : [];
  return `<section class="card decade-hero"><div class="dh-bg" aria-hidden="true">${pics.map((f) => `<img src="${IMG}${esc(metaOf(f).poster)}" alt="" decoding="async">`).join("")}</div>
    <p class="dh-k">Best-rated decade${scope === "all" ? "" : ` · watched in ${esc(scope)}`}</p>
    <button class="dh-title" type="button" ${dl(DR.decade(x))}><span class="dh-dec">The ${x.decade}s</span>
      <span class="dh-sub"><span class="stars">★</span> ${x.avg.toFixed(2)} average from ${plural(x.ratings.length, "rated film")}${CHEV}</span></button>
    <div class="scroller">${x.top.map((f) => posterItem(f)).join("")}</div></section>`;
}
// A decade in the ranking: its average and its three best posters.
const decadeRow = (x, i) => `<button class="drank" type="button" data-k="d${x.decade}" ${dl(DR.decade(x))}><span class="rk">${i + 1}</span>
  <span style="min-width:0"><span class="nm">${x.decade}s</span><span class="sub"><span class="stars">★</span> ${x.avg.toFixed(2)} average · ${plural(x.count, "film")}</span></span>
  <span class="mposters" aria-hidden="true">${x.top.slice(0, 3).map(poster).join("")}</span>${CHEV}</button>`;
function genresScreen(s) {
  const ranked = rankedDecades(s);
  let html = statsHead() + (ranked.length ? bestDecadeCard(ranked[0], s.scope) : "") + segBar("catsort", [["most", "Most watched"], ["best", "Highest rated"]], state.catSort, "small");
  const best = state.catSort === "best";
  if (s.withMeta) {
    for (const [label, data, field] of [["Genres", s.genres, "genres"], ["Countries", s.countries, "countries"], ["Languages", s.languages, "languages"]]) {
      const list = best ? data.best : data.most;
      html += sh(label, list.length > 6 ? seeAll(`data-act="cat" data-field="${field}"`, `All ${fmtN(list.length)}`) : "") +
        (list.length ? `<div class="group">${list.slice(0, 6).map((c) => catRow(c, list[0].count, best)).join("")}</div>` : `<div class="empty">${best ? "Needs 3 or more rated films each." : "Nothing yet."}</div>`);
    }
  } else html += needMeta();
  if (s.decades.length) {
    const all = s.decades, cols = [];
    for (let d = all[0].decade; d <= all[all.length - 1].decade; d += 10) {
      const x = all.find((y) => y.decade === d);
      cols.push({ a: x ? x.count : 0, b: 0, label: `’${String(d).slice(2)}`, tip: `${d}s: ${plural(x ? x.count : 0, "film")}${x && x.avg ? ` · ${x.avg.toFixed(2)} average` : ""}`, to: x && DR.decade(x) });
    }
    html += (ranked.length ? sh("Decades, best rated first") + `<div class="group">${ranked.map(decadeRow).join("")}</div>` : "") +
      sh("Films by decade of release") + `<div class="card">${colChart(cols, "Films by decade of release", "", 100, { unit: "films" })}</div>`;
  }
  if (s.scope === "all" && s.withMeta) html += mGenres(allInsights());
  return html;
}

/* ---------- Settings: import, lookups, this browser ---------- */
function lookupInner() {
  if (state.mode === "example" || !MY_LIB) {
    return `<p class="title">Cast &amp; crew</p><p class="status">Letterboxd's export lists your films, dates and ratings, but not who's in them.
      After you import yours, you can fill them in${IN_VIEWER ? " with Claude" : " from TMDB with your API key"}. The example has them filled in already.</p>`;
  }
  const lib = MY_LIB, total = lib.films.length;
  const have = lib.films.filter((f) => metaOf(f)).length;
  const fromTmdb = lib.films.filter((f) => META[f.key] && META[f.key].src === "tmdb" && !META[f.key].miss).length;
  const pct = total ? Math.round(have / total * 100) : 0;
  const src = fromTmdb ? (fromTmdb === have ? "From TMDB" : "From TMDB and Claude") : have ? "From Claude's film knowledge" : "Not looked up yet";
  const head = `<p class="title">Cast &amp; crew</p><div class="meter" role="progressbar" aria-label="Films with cast and crew" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span id="lookup-meter" style="width:${pct}%"></span></div>
    <p class="status">${fmtN(have)} of ${plural(total, "film")} · ${src}</p>`;
  const note = job.note ? `<p class="status${job.err ? " err" : ""}" role="status">${esc(job.note)}</p>` : "";
  const saveNote = job.saveFailed ? `<p class="status err">This browser wouldn't save the results, so they'll be gone when you close the page.</p>` : "";
  if (job.running) return head + `<p class="status" id="lookup-progress" role="status">${progressText()}</p><button class="btn block" type="button" data-act="stop">Stop</button>`;
  let body;
  if (!IN_VIEWER) {
    const todo = needsLookup(lib, "tmdb").length;
    const askKey = !tmdbKey() || editKey || job.badKey;
    body = todo && !askKey ? `<button class="btn green block" type="button" data-act="tmdb">Look up ${plural(todo, "film")} on TMDB</button>
      <p class="status">${ownTmdbKey() ? "Using your saved TMDB key." : "Using this site's shared TMDB key."} <button class="linkish" type="button" data-act="change-key">${ownTmdbKey() ? "Change key" : "Use your own key"}</button></p>` :
      todo ? `<label class="sr-only" for="tmdb-key">TMDB API key or read access token</label>
      <input class="key" id="tmdb-key" type="password" autocomplete="off" spellcheck="false" placeholder="TMDB API key or read access token" value="${esc(ownTmdbKey())}">
      <button class="btn green block" type="button" data-act="tmdb">Look up ${plural(todo, "film")} on TMDB</button>
      <p class="status">Get a free key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a>. It's saved in this browser (and in your locked diary on this site, if it's there) and sent only to TMDB.</p>` : have < total ? `<p class="status">TMDB had no match for ${plural(total - have, "film")}.</p>` : `<p class="status">Every film has details from TMDB.</p>`;
  } else if (sampleState === "ready") {
    const todo = needsLookup(lib, "claude").length;
    const misses = lib.films.filter((f) => META[f.key] && META[f.key].miss && META[f.key].src === "claude").length;
    body = `<p class="status">Pages inside Claude can't reach TMDB, so Claude fills in each film from what it knows. Obscure films can come back wrong or empty.</p>` +
      (todo ? `<button class="btn green block" type="button" data-act="claude">Look up ${plural(todo, "film")} with Claude</button>
        <p class="status">About ${plural(Math.ceil(todo / CLAUDE_BATCH), "request")} on your Claude plan.</p>` :
      misses ? `<button class="btn block" type="button" data-act="claude-retry">Try the ${plural(misses, "film")} Claude didn't recognise</button>` : "");
  } else if (sampleState === "pending") {
    body = `<p class="status">Connecting to Claude…</p>`;
  } else {
    body = `<p class="status">Lookups aren't available in this view. Open the downloadable copy of this page in a browser and use a TMDB key.</p>`;
  }
  const extra = [imdbBlock(MY_LIB, true), letterboxdBlock(MY_LIB, true), feedBlock(MY_LIB, true), dataCheckBlock(MY_LIB, true)].filter(Boolean).map((h) => `</div><div class="card">${h}`).join("");
  return head + body + note + saveNote + extra;
}
function progressText() {
  return job.kind === "claude" && job.done === 0 ? `Asking Claude about ${plural(job.total, "film")}… the first batch takes up to a minute.`
    : `Looked up ${fmtN(job.done)} of ${plural(job.total, "film")} ${job.kind === "tmdb" ? "on TMDB" : "with Claude"}…`;
}
function renderLookup() { const el = $("#lookup"); if (el) { el.outerHTML = `<div id="lookup"><div class="card">${lookupInner()}</div></div>`; } }
function renderLookupProgress() {
  const p = $("#lookup-progress");
  if (p) p.textContent = progressText();
  const ip = $("#imdb-progress");
  if (ip) ip.textContent = imdbProgressText();
  const lp = $("#lb-progress");
  if (lp) lp.textContent = lbProgressText();
  const m = $("#lookup-meter");
  if (m && MY_LIB) m.style.width = `${Math.round(MY_LIB.films.filter((f) => metaOf(f)).length / Math.max(1, MY_LIB.films.length) * 100)}%`;
}
function dataScreen() {
  const lib = MY_LIB;
  const status = lib ? `${plural(lib.films.length, "film")}, ${plural(lib.entries.length, "diary entry", "diary entries")} and ${plural(lib.reviews.length, "review")} imported${lib.profile.username ? ` for @${esc(lib.profile.username)}` : ""}.${lib.reviewTextMissing ? " The review text is missing, so import the export again." : ""}` : "Nothing imported yet.";
  const rows = [];
  if (lib && !IN_VIEWER) {
    rows.push(`<button class="row" type="button" data-act="backup"><span>Back up to a file</span><span class="count">for another device</span>${CHEV}</button>`);
    rows.push(`<button class="row switch" type="button" data-act="backup-keys" role="switch" aria-checked="${!!state.backupKeys}"><span>Include API keys in the backup</span><span class="toggle-ui" aria-hidden="true"></span></button>`);
  }
  rows.push(`<button class="row danger" type="button" data-act="forget"><span>${state.forgetArmed ? "Tap again to delete" : "Delete saved data from this browser"}</span></button>`);
  return `<div class="card glow" style="margin-top:12px"><div style="display:flex;gap:12px;align-items:center"><span class="ico g">${ICON.upload}</span><p class="title">Your Letterboxd export</p></div>
      <p class="status">${status}</p>
      <ol class="steps"><li>On <a href="https://letterboxd.com/settings/data/" target="_blank" rel="noopener">letterboxd.com</a>, open Settings → Data.</li>
        <li>Choose Export your data and download the ZIP.</li><li>Import the ZIP here. It stays in this browser.</li></ol>
      <button class="btn green block" type="button" data-act="import">${lib ? "Import a newer export" : "Import export"}</button>
      ${state.importError ? `<p class="status err" role="alert">${esc(state.importError)}</p>` : ""}</div>
    <div data-sitebox="publish">${siteBox("publish")}</div>
    ${sh("Film details")}<div id="lookup"><div class="card">${lookupInner()}</div></div>
    ${sh("This browser")}<div class="group">${rows.join("")}</div>
    ${state.forgetArmed ? `<p class="note">Removes your imported export and looked-up details, plus any keys you typed in. A copy of your diary on the site stays there.</p>` : ""}
    ${lib && !IN_VIEWER ? `<p class="note">A backup file also carries your diary to another device: import it there the same way as an export.</p>` : ""}
    <div class="foot"><p>Credits Roll reads the CSV files in a Letterboxd data export. It is not made by or affiliated with Letterboxd.</p>
      <p>Film details come from The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB.${IN_VIEWER ? `
      Inside the Claude app, details come from Claude's knowledge of each film instead, so check anything surprising.` : ""}</p>
      <p>Your diary stays in this browser: only film titles and years go to TMDB, to find cast and crew.</p>
      <p>On a computer? <a href="https://claude.ai/artifact/52oE5x53dcjUZgBYQMfPjR" target="_blank" rel="noopener">Open the desktop version</a>. It keeps its own copy of your import.</p>
      <p class="stamp">Updated <!--BUILD--></p></div>`;
}

/* ---------- pushed screens ---------- */
function detailScreen(d, s) {
  if (d.type === "data") return dataScreen();
  if (d.type === "reviews") return reviewsScreen();
  if (d.type === "drill") return drillScreen(d.d);
  if (d.type === "watchnext") return watchNextScreen();
  if (d.type === "cat") {
    const data = s[d.field], best = state.catSort === "best";
    const list = best ? data.best : data.most;
    return segBar("catsort", [["most", "Most watched"], ["best", "Highest rated"]], state.catSort, "small") +
      sh(`${fmtN(list.length)} ${d.title.toLowerCase()}`, `<span class="count">${state.scope === "all" ? "All time" : state.scope}</span>`) +
      (list.length ? `<div class="group">${list.map((c) => catRow(c, list[0].count, best)).join("")}</div>` : `<div class="empty">Nothing to show for this period.</div>`);
  }
  return "";
}

// The watchlist, likeliest favourites first, with why.
function watchNextScreen() {
  const W = memo("watchnext", () => watchNext(state.lib));
  if (!W) return `<div class="empty" style="padding-top:28px">Watch next needs a watchlist in your export and five or more rated films.</div>`;
  const list = W.picks.filter((p) => p.known && wnFits(p, state.wn));
  const rows = list.length ? drillBody(wnDrill(list, "Watch next"), 60).html : `<div class="empty">${W.picks.some((p) => p.known) ? "Nothing on your watchlist fits that length." : "Your watchlist films need cast &amp; crew details first, looked up in Settings."}</div>`;
  return chipBar("wn", WN_LENGTHS, state.wn) + `<p class="note">Best bets first: a guess at your rating from how you rate each film's director, leads and genres, and its crowd score.</p>` + rows +
    (W.missing ? `<p class="note">${plural(W.missing, "film")} on your watchlist ${W.missing === 1 ? "has" : "have"} no details yet.</p>` : "");
}
const SCREENS = { profile: profileScreen, diary: diaryScreen, films: filmsScreen, people: peopleScreen, genres: genresScreen, years: (s) => yearsScreen(s), crowd: (s) => crowdScreen(s), insights: () => insightsScreen(), compare: () => compareScreen() };
</script>
