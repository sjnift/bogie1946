<script>
/* ---------- Diary ---------- */
const fact = (k, v, f) => `<div class="fact"><span class="k">${k}</span><span class="v">${esc(v)}${tmdbLink(f)}</span></div>`;
function diaryScreen(s) {
  if (!s.entries.length) return `<div class="empty" style="padding-top:28px">No diary dates in ${s.scope === "all" ? "your export" : s.scope}. Films logged without a date still count on the other tabs.</div>`;
  const cols = timeline(s);
  const unit = s.scope !== "all" ? "week" : cols[0].key.length === 7 ? "month" : "year";
  const bm = s.busiestMonth, fav = s.weekday.indexOf(Math.max(...s.weekday));
  const facts = `<div class="facts">${[
    fact("Busiest month", bm ? `${MONTHS[+bm.key.slice(5, 7) - 1]} ${bm.key.slice(0, 4)} · ${plural(bm.count, "film")}` : "—"),
    fact("Longest streak", s.streak.days > 1 ? `${s.streak.days} days` : "1 day"),
    fact("Most in a day", s.busiestDay ? `${plural(s.busiestDay.count, "film")} · ${fmtDate(s.busiestDay.key).replace(/ \d{4}$/, s.scope === "all" ? "$&" : "")}` : "—"),
    fact("Favourite day", WEEKDAYS_LONG[fav]),
  ].join("")}</div>`;
  const legend = s.rewatches ? `<div class="legend"><span><i style="background:var(--green-mark)"></i>First watch</span><span><i style="background:var(--blue-mark)"></i>Rewatch</span></div>` : "";
  let chart = colChart(cols, `Diary entries by ${unit}`, legend, 110);
  if (cols.length > 24) chart = chart.replace('class="axis"', 'class="axis dense"');
  const wmax = Math.max(1, ...s.weekday);
  const weekdays = `<div class="weekdays" role="img" aria-label="Diary entries by day of the week">${s.weekday.map((n, i) =>
    `<div class="wd" data-tip="${WEEKDAYS_LONG[i]}: ${plural(n, "film")}"><span class="cnt">${n}</span><div class="bar-v"><span style="height:${(n / wmax * 100).toFixed(1)}%"></span></div><span class="lbl">${WEEKDAYS[i].slice(0, 1)}</span></div>`).join("")}</div>`;
  const list = [...s.entries].reverse().slice(0, state.diaryLimit);
  let rows = "", month = "";
  for (const e of list) {
    const m = e.date.slice(0, 7);
    if (m !== month) { month = m; rows += `<div class="month-h">${MONTHS_LONG[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}</div>`; }
    rows += `<div class="drow"><span class="day">${+e.date.slice(8, 10)}</span>${poster(e.film)}
      <span style="min-width:0"><span class="t" style="display:block">${esc(e.film.name)} <span>${e.film.year || ""}</span></span>
      <span class="m"><span class="stars">${stars(e.rating)}</span></span></span>
      <span class="icons">${e.rewatch ? '<span class="rewatch" title="Rewatch">↻</span>' : ""}${e.film.liked ? '<span class="heart" title="Liked">♥</span>' : ""}${e.review ? '<span title="Reviewed">≡</span>' : ""}</span></div>`;
  }
  const more = s.entries.length > state.diaryLimit ? `<button class="row" type="button" data-act="more-diary"><span>Show older entries</span><span class="count">${fmtN(s.entries.length - state.diaryLimit)} more</span>${CHEV}</button>` : "";
  return facts + sh(`Films by ${unit}`, `<span class="num">${fmtN(s.entries.length)}</span>`) + chart +
    sh("By day of the week") + weekdays +
    sh(s.scope === "all" ? "Last 12 months" : `Every day of ${s.scope}`) + heatmap(s).replace("Fewer", "Less") +
    sh("Diary", `<span class="num">${plural(s.entries.length, "entry", "entries")}</span>`) + `<div>${rows}</div>` + more;
}

/* ---------- Films ---------- */
function filmsScreen(s) {
  const views = (f) => s.scope === "all" ? f.entries.length : f.entries.filter((e) => e.date.startsWith(s.scope)).length;
  const rated = s.films.filter((f) => f.rating).sort((a, b) => b.rating - a.rating || views(b) - views(a) || (b.year || 0) - (a.year || 0));
  let html = rated.length ? sh("Highest rated", `<button class="more" type="button" data-act="all-rated">See all</button>`) + posterGrid(rated.slice(0, 8)) : "";
  const best = state.catSort === "best";
  if (s.withMeta) {
    html += `<div class="toggles" style="margin-top:22px">${[["most", "Most watched"], ["best", "Highest rated"]].map(([v, l]) =>
      `<button class="toggle" type="button" data-catsort="${v}" aria-pressed="${v === state.catSort}">${l}</button>`).join("")}</div>`;
    for (const [label, data, field] of [["Genres", s.genres, "genres"], ["Countries", s.countries, "countries"], ["Languages", s.languages, "languages"]]) {
      const list = (best ? data.best : data.most);
      html += sh(label, list.length > 6 ? `<button class="more" type="button" data-act="cat" data-field="${field}">See all</button>` : "") +
        (list.length ? list.slice(0, 6).map((c) => catRow(c, list[0].count, best)).join("") : `<div class="empty">${best ? "Needs 3 or more rated films each." : "Nothing yet."}</div>`);
    }
  } else html += needMeta();

  if (s.decades.length) {
    const all = s.decades, cols = [];
    for (let d = all[0].decade; d <= all[all.length - 1].decade; d += 10) {
      const x = all.find((y) => y.decade === d);
      cols.push({ a: x ? x.count : 0, b: 0, label: `’${String(d).slice(2)}`, tip: `${d}s: ${plural(x ? x.count : 0, "film")}${x && x.avg ? ` · ${x.avg.toFixed(2)} average` : ""}` });
    }
    const ranked = all.filter((x) => x.ratings.length >= 3).sort((a, b) => b.avg - a.avg).slice(0, 5)
      .map((x) => ({ name: `${x.decade}s`, films: x.films, count: x.count, avg: x.avg }));
    html += sh("Decades") + colChart(cols, "Films by decade of release", "", 90) +
      (ranked.length ? `<p class="status" style="margin:14px 0 0">Highest-rated decades</p>` + ranked.map((c) => catRow(c, 1, true)).join("") : "");
  }

  const re = s.films.filter((f) => views(f) > 1).sort((a, b) => views(b) - views(a) || (b.rating || 0) - (a.rating || 0)).slice(0, 8);
  if (re.length) html += sh("Most rewatched") + re.map((f) => `<div class="drow" style="grid-template-columns:34px minmax(0,1fr) auto">${poster(f)}
    <span style="min-width:0"><span class="t" style="display:block">${esc(f.name)} <span>${f.year || ""}</span></span><span class="m"><span class="stars">${stars(f.rating)}</span></span></span>
    <span class="val num">${views(f)}×</span></div>`).join("");

  const E = s.entries;
  if (E.length) {
    const marks = s.scope === "all" ? [50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000] : [25, 50, 100, 150, 200, 250, 300, 365, 400, 500];
    const items = [["First film", E[0]], ...marks.filter((n) => n < E.length).slice(-5).map((n) => [`${ordinal(n)} film`, E[n - 1]])];
    if (E.length > 1) items.push(["Latest", E[E.length - 1]]);
    html += sh("Milestones") + `<div class="pgrid">${items.map(([k, e]) => `<div class="pitem" title="${esc(e.film.name)}${e.film.year ? ` (${e.film.year})` : ""}">
      <span class="mlabel">${k}</span>${poster(e.film)}
      <span class="pmeta"><span class="stars">${stars(e.rating)}</span>${e.rewatch ? '<span class="rewatch" aria-label="rewatch">↻</span>' : ""}</span>
      <span class="mdate">${fmtDate(e.date)}</span></div>`).join("")}</div>`;
  }

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
  return html || `<div class="empty">No films in this period.</div>`;
}

/* ---------- Import ---------- */
function lookupInner() {
  if (state.mode === "example" || !MY_LIB) {
    return `<p class="title">Cast &amp; crew</p><p>Letterboxd's export lists your films, dates and ratings, but not who's in them.
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
      <p class="status">Using your saved TMDB key. <button class="linkish" type="button" data-act="change-key">Change key</button></p>` :
      todo ? `<label class="sr-only" for="tmdb-key">TMDB API key or read access token</label>
      <input class="key" id="tmdb-key" type="password" autocomplete="off" spellcheck="false" placeholder="TMDB API key or read access token" value="${esc(tmdbKey())}">
      <button class="btn green block" type="button" data-act="tmdb">Look up ${plural(todo, "film")} on TMDB</button>
      <p class="status">Get a free key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a>. It's saved in this browser and sent only to TMDB.</p>` : have < total ? `<p>TMDB had no match for ${plural(total - have, "film")}.</p>` : `<p>Every film has details from TMDB.</p>`;
  } else if (sampleState === "ready") {
    const todo = needsLookup(lib, "claude").length;
    const misses = lib.films.filter((f) => META[f.key] && META[f.key].miss && META[f.key].src === "claude").length;
    body = `<p>Pages inside Claude can't reach TMDB, so Claude fills in each film from what it knows. Obscure films can come back wrong or empty.</p>` +
      (todo ? `<button class="btn green block" type="button" data-act="claude">Look up ${plural(todo, "film")} with Claude</button>
        <p class="status">About ${plural(Math.ceil(todo / CLAUDE_BATCH), "request")} on your Claude plan.</p>` :
      misses ? `<button class="btn block" type="button" data-act="claude-retry">Try the ${plural(misses, "film")} Claude didn't recognise</button>` : "");
  } else if (sampleState === "pending") {
    body = `<p class="status">Connecting to Claude…</p>`;
  } else {
    body = `<p>Lookups aren't available in this view. Open the downloadable copy of this page in a browser and use a TMDB key.</p>`;
  }
  return head + body + note + saveNote + imdbBlock(MY_LIB, true) + letterboxdBlock(MY_LIB, true);
}
function progressText() {
  return job.kind === "claude" && job.done === 0 ? `Asking Claude about ${plural(job.total, "film")}… the first batch takes up to a minute.`
    : `Looked up ${fmtN(job.done)} of ${plural(job.total, "film")} ${job.kind === "tmdb" ? "on TMDB" : "with Claude"}…`;
}
function renderLookup() { const el = $("#lookup"); if (el) el.innerHTML = lookupInner(); }
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
  const status = lib ? `${plural(lib.films.length, "film")} and ${plural(lib.entries.length, "diary entry", "diary entries")} imported${lib.profile.username ? ` for @${esc(lib.profile.username)}` : ""}.` : "Nothing imported yet.";
  const rows = [];
  if (state.mode === "mine") rows.push(`<li><button class="row" type="button" data-act="example"><span>View the example diary</span>${CHEV}</button></li>`);
  else if (lib) rows.push(`<li><button class="row" type="button" data-act="mine"><span>Back to my diary</span>${CHEV}</button></li>`);
  rows.push(`<li><button class="row danger" type="button" data-act="forget"><span>${state.forgetArmed ? "Tap again to delete" : "Delete saved data from this browser"}</span></button></li>`);
  return `<div class="card" style="margin-top:18px"><p class="title">Your Letterboxd export</p><p>${status}</p>
      <ol style="margin:0; padding-left:18px; display:grid; gap:4px">
        <li>On <a href="https://letterboxd.com/settings/data/" target="_blank" rel="noopener">letterboxd.com</a>, open Settings → Data.</li>
        <li>Choose Export your data and download the ZIP.</li>
        <li>Import the ZIP here. It stays in this browser.</li></ol>
      <button class="btn green block" type="button" data-act="import">${lib ? "Import a newer export" : "Import export"}</button>
      ${state.importError ? `<p class="status err" role="alert">${esc(state.importError)}</p>` : ""}</div>
    <div class="card" id="lookup" style="margin-top:12px">${lookupInner()}</div>
    ${sh("This browser")}<ul class="menu">${rows.join("")}</ul>
    ${state.forgetArmed ? `<p class="status">Removes your imported export and looked-up details, plus any keys you typed in.</p>` : ""}
    <div class="foot"><p>Credits Roll reads the CSV files in a Letterboxd data export. It is not made by or affiliated with Letterboxd.</p>
      <p>With your own TMDB key, film details come from The Movie Database. This product uses the TMDB API but is not endorsed or certified by TMDB.
      Inside the Claude app, details come from Claude's knowledge of each film instead, so check anything surprising.</p>
      <p>On a computer? <a href="https://claude.ai/artifact/52oE5x53dcjUZgBYQMfPjR" target="_blank" rel="noopener">Open the desktop version</a>. It keeps its own copy of your import.</p>
      <p>Updated <!--BUILD--></p></div>`;
}

/* ---------- pushed detail screens ---------- */
function detailScreen(d, s) {
  if (d.type === "insights") return insightsScreen();
  if (d.type === "compare") return compareScreen();
  if (d.type === "cat") {
    const data = s[d.field], best = state.catSort === "best";
    const list = best ? data.best : data.most;
    return `<div class="toggles" style="margin-top:16px">${[["most", "Most watched"], ["best", "Highest rated"]].map(([v, l]) =>
      `<button class="toggle" type="button" data-catsort="${v}" aria-pressed="${v === state.catSort}">${l}</button>`).join("")}</div>` +
      sh(`${fmtN(list.length)} ${d.title.toLowerCase()}`) + (list.map((c) => catRow(c, list[0].count, best)).join("") || `<div class="empty">Nothing to show for this period.</div>`);
  }
  const films = [...d.films].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.year || 0) - (a.year || 0));
  return `<div class="dhead">${d.person && d.person.key ? avatar(d.person, "xl") : ""}<div class="name">${esc(d.title)}</div><div class="sub">${esc(d.sub)}</div></div>` +
    sh("Films", `<span class="num">${fmtN(films.length)}</span>`) + posterGrid(films);
}

const SCREENS = { profile: profileScreen, people: peopleScreen, diary: diaryScreen, films: filmsScreen, data: dataScreen };
</script>
