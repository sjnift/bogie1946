<script>
/* ---------- desktop: more Stats sections, the numbers that used to be on the Insights page ----------
   Year by year, genres year by year and as you rate them, people over the years, against the crowd, habits, and
   for one year: against the year before and who and what was new. Insights itself is now the study (07c). */
// Worked out again only when the diary, its film details or the crowd change.
let HOME_INS = null;
function homeInsights(Y) {
  const k = state.crowd || defaultCrowd(state.lib, metaOf), sig = `${DATA_REV}|${k}|${Object.keys(META).length}|${Object.keys(LBX).length}`;
  if (!HOME_INS || HOME_INS.lib !== state.lib || HOME_INS.sig !== sig) HOME_INS = { lib: state.lib, sig, k, I: computeInsights(state.lib, metaOf, k), years: new Map() };
  if (!Y) return HOME_INS.I;
  if (!HOME_INS.years.has(Y)) HOME_INS.years.set(Y, computeYearInsights(state.lib, metaOf, Y, k, HOME_INS.I));
  return HOME_INS.years.get(Y);
}
const needYears = (what) => `<div class="empty">${what} need diary entries from at least two years, with five or more films in each.</div>`;
// The sections this file adds to the Stats page, by name, for renderSections to place.
function moreSections(s) {
  const all = s.scope === "all", I = homeInsights(), R = all ? null : homeInsights(s.scope);
  const k = HOME_INS.k, noMeta = !s.withMeta;
  const crowd = all ? crowdOf(k, state.lib.films) : crowdOf(k, R.S.films, R.ratingAt);
  const prevY = all ? "" : String(+s.scope - 1);
  return {
    months: (() => { const G = monthGrid(state.lib, metaOf, all ? null : s.scope); return card("months", "Month by month", monthsLine(G), monthGridBlock(G)); })(),
    years: all ? card("years", "Year by year", "By the year you watched, from diary dates.", yearsBlock(I)) : "",
    vsprev: all ? "" : card("vsprev", `Against ${prevY}`, `${esc(s.scope)} next to the year before.`, vsPrevBlock(R, prevY)),
    habits: card("habits", "Habits", all ? "When and how you watch." : `When and how you watched in ${esc(s.scope)}.`,
      habitsBlock(all ? I.habits : R.habits.filter((h) => !["Longest streak", "Biggest day", "Oldest film"].includes(h.k)), "Habits come from diary dates.")),
    crowd: card("crowd", "Against the crowd", all ? "Where your ratings part ways with everyone else's." : `Films you rated in ${esc(s.scope)}.`, crowdBlock(crowd, all ? null : s.scope)),
    peopleYears: all ? card("people-years", "People over the years", "Who's new, who stays, and how many directors each year brought.", noMeta ? emptyMeta() : peopleYearsBlock(I)) : "",
    newIn: !all && R.firstYear !== s.scope ? card("new-in", `New in ${esc(s.scope)}`, "Directors, actors, countries and languages that first turned up in your diary this year.", noMeta ? emptyMeta() : newInBlock(R)) : "",
    genreYears: all ? card("genre-years", "Genres year by year", "The share of each year's films in each genre.", noMeta ? emptyMeta() : genreYearsBlock(I)) : "",
    genreRates: all ? card("genre-rates", "Genres as you rate them", "Each genre against your own average and against the crowd.", noMeta ? emptyMeta() : genresBlock(I)) : "",
    reviewStats: card("review-stats", all ? "Your reviews in numbers" : `Your ${esc(s.scope)} reviews in numbers`, "What you write, and when you bother.", reviewInsightsBlock(state.lib, all ? null : s.scope)),
  };
}

// Month by month: the grid, then each calendar month across the years (or, for a year, against your usual).
function monthGridBlock(G) {
  if (!G) return `<div class="empty">Months come from diary dates, and there are none in this period.</div>`;
  const rows = G.cal.filter((c) => c.years).map((c) => {
    const rated = c.E.filter((e) => e.rating || e.film.rating), title = G.Y ? `${c.name} ${G.Y}` : `${c.name}, every year`;
    return `<tr><td>${esc(c.name)}</td><td class="n">${dlink(monthEnts(title, c.E), fmtN(c.E.length))}</td>
      <td class="n">${G.Y ? (c.usual != null ? dlink(monthEnts(`${c.name} in your other years`, c.usualE, plural(c.usualYears, "year")), c.usual.toFixed(1)) : "—") : dlink(monthEnts(title, c.E, plural(c.years, "year")), c.perYear.toFixed(1))}</td>
      <td class="n">${c.avg ? dlink(monthEnts(`Rated in ${title}`, rated), c.avg.toFixed(2)) : "—"}</td>
      <td>${leanHtml(c, title)}</td></tr>`;
  }).join("");
  return monthGridHtml(G) + `<div class="scroll"><table class="data"><thead><tr><th>Month</th><th class="n">Films</th><th class="n">${G.Y ? "Usual" : "A year"}</th><th class="n">Your average</th><th>Leans to</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="status">Each square is the films you watched that month, darker for more${G.Y ? "; “usual” is the same month in your other years" : ""}. “Leans to” is the genre that month has most more of than the rest of ${G.Y ? "the year" : "your diary"}. Click any number to see the films.</p>`;
}
function yearsBlock(I) {
  if (I.years.length < 2) return needYears("Year-by-year trends");
  const yr = (p) => `’${p.year.slice(2)}`;
  const mult = (title, what, value, tip, extra, opts = {}) => {
    const cols = I.years.map((p) => ({ a: Math.max(0, value(p) || 0), b: extra ? extra(p) : 0, label: yr(p), tip: tip(p), to: p.entries ? yearDrill(p, what) : null }));
    return `<div class="mult"><h3>${title}</h3>${colChart(cols, title + " by year", "", 90, opts)}</div>`;
  };
  // averages read as numbers over their columns, which start a little below the lowest
  const ratingOpts = { values: (c) => c.a.toFixed(2), base: valuesBase(I.years.map((p) => p.avgRating), 0.25) };
  const anyPace = I.years.some((p) => p.pace && p.pace > p.films);
  const legend = anyPace ? `<div class="legend"><span><i style="background:var(--gold)"></i>Watched</span><span><i style="background:var(--lilac)"></i>Rest of this year at your current pace</span></div>` : "";
  const charts = `<div class="mults">
    ${mult("Films", "films", (p) => p.films, (p) => `${p.year}: ${plural(p.films, "film")}${p.pace ? `, on pace for about ${fmtN(p.pace)}` : ""}`, (p) => p.pace && p.pace > p.films ? p.pace - p.films : 0, { unit: "films" })}
    ${mult("Hours", "hours", (p) => Math.round(p.hours), (p) => `${p.year}: ${fmtN(Math.round(p.hours))} hours`, null, { unit: "h" })}
    ${mult("Average rating", "rating", (p) => p.avgRating, (p) => `${p.year}: ${p.avgRating ? starsNum(p.avgRating) : "no ratings"}`, null, ratingOpts)}
    ${mult("Film age when watched (years)", "age", (p) => p.age, (p) => `${p.year}: films were ${p.age != null ? Math.round(p.age) : "—"} years old on average`, null, { unit: "yrs" })}
    ${mult("Not in English (%)", "nonEnglish", (p) => p.nonEnglish, (p) => `${p.year}: ${p.nonEnglish != null ? p.nonEnglish + "%" : "not enough details"}`, null, { unit: "%" })}
    ${mult("Rewatches (%)", "rewatches", (p) => pctOf(p.rewatches, p.entries), (p) => `${p.year}: ${pctOf(p.rewatches, p.entries)}% of entries`, null, { unit: "%" })}
  </div>`;
  const top = (p, pair, role) => pair && pair[1] > 1 ? `${dlink(personDrill(state.lib, pair[0], role, p.F), esc(pair[0]))} <span class="muted">${pair[1]}</span>` : "—";
  const rows = [...I.years].reverse().map((p) => { const cell = (what, v) => v == null || v === "—" ? "—" : dlink(yearDrill(p, what), v);
    return `<tr><td>${cell("entries", p.year)}${p.pace ? ` <span class="muted">(pace ${fmtN(p.pace)})</span>` : ""}</td>
    <td class="n">${cell("films", fmtN(p.films))}</td><td class="n">${cell("hours", fmtN(Math.round(p.hours)))}</td><td class="n">${cell("rating", p.avgRating ? p.avgRating.toFixed(2) : null)}</td>
    <td class="n">${cell("new", p.newShare != null ? p.newShare + "%" : null)}</td><td class="n">${cell("nonEnglish", p.nonEnglish != null ? p.nonEnglish + "%" : null)}</td><td class="n">${cell("countries", p.countries || null)}</td>
    <td>${p.topGenre ? dlink(D.films(`${p.topGenre[0]} in ${p.year}`, filmsSub(p.F.filter(hasGenre(p.topGenre[0]))), p.F.filter(hasGenre(p.topGenre[0])), { scope: p.year }), esc(p.topGenre[0])) : "—"}</td>
    <td>${top(p, p.topDirector, "d")}</td><td>${top(p, p.topActor, "c")}</td></tr>`; }).join("");
  return legend + charts + `<div class="tbl-wrap"><table class="data"><thead><tr><th>Year</th><th class="n">Films</th><th class="n">Hours</th><th class="n">Avg ★</th>
    <th class="n">New releases</th><th class="n">Not English</th><th class="n">Countries</th><th>Top genre</th><th>Top director</th><th>Top actor</th></tr></thead><tbody>${rows}</tbody></table></div><p class="status">Click any number to see the films or diary entries behind it.</p>`;
}

function genreYearsBlock(I) {
  if (!I.tastes.table) return needYears("Genres year by year");
  const t = I.tastes.table;
  return `<div class="tbl-wrap"><table class="data heat"><caption class="sr-only">Share of each year's films in each genre</caption>
    <thead><tr><th>Genre</th>${t.years.map((y) => `<th class="n">${y.year}</th>`).join("")}</tr></thead>
    <tbody>${t.genres.map((g, gi) => `<tr><td>${dlink(catDrill(state.lib, g, "g"), esc(g))}</td>${t.years.map((y) => { const v = y.shares[gi], fs = y.p.F.filter(hasGenre(g));
      return `<td class="n cell" style="background:color-mix(in srgb, var(--gold) ${v == null ? 0 : Math.min(70, v * 1.6)}%, transparent)">${v == null ? "—" : dlink(fs.length && D.films(`${g} in ${y.year}`, filmsSub(fs, `${v}% of the year's films`), fs, { scope: y.year }), v + "%")}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="status">Share of each year's films in the genre. A film can have several genres. Click a share to see those films.</p>`;
}

function divBar(d, max) {
  if (d == null) return `<span class="muted">—</span>`;
  const w = Math.min(50, Math.abs(d) / max * 50);
  return `<span class="div-bar" aria-hidden="true"><span class="mid"></span><span class="fill ${d >= 0 ? "pos" : "neg"}" style="width:${w.toFixed(1)}%"></span></span> <span class="num">${signed(d, 2)}</span>`;
}
function genresBlock(I) {
  if (!I.genres.length) return `<div class="empty">Needs genres with three or more rated films.</div>`;
  const max = Math.max(0.5, ...I.genres.map((g) => Math.max(Math.abs(g.vsMe), Math.abs(g.vsCrowd || 0))));
  const rows = I.genres.map((g) => { const to = D.films(g.name, `${plural(g.count, "film")} · ${g.mine.toFixed(2)} average`, g.films);
    return `<tr><td>${dlink(to, esc(g.name))}</td><td class="n">${dlink(to, fmtN(g.count))}</td><td class="n">${dlink(to, g.share + "%")}</td><td class="n">${dlink(to, g.mine.toFixed(2))}</td>
    <td>${dlink(to, divBar(g.vsMe, max))}</td><td>${g.vsCrowd == null ? divBar(null) : dlink(crowdDrill(g.films, I.crowd.key, `${g.name} against ${I.crowd.label}`), divBar(g.vsCrowd, max))}</td></tr>`; }).join("");
  return `<div class="legend"><span><i style="background:var(--gold)"></i>Higher</span><span><i style="background:var(--lilac)"></i>Lower</span></div>
    <div class="tbl-wrap"><table class="data"><thead><tr><th>Genre</th><th class="n">Films</th><th class="n">Share</th><th class="n">Your avg ★</th>
    <th>Against your average</th><th>Against ${esc(I.crowd.label)}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="status">Genres with three or more rated films. Differences are in stars. Click any number to see the films.</p>`;
}

function peopleYearsBlock(I) {
  const P = I.people;
  if (!P.compDirectors.length && !P.obsDirectors.length && !P.compActors.length && P.discoveries.length < 2) return `<div class="empty">This needs cast &amp; crew details and a few years of diary entries.</div>`;
  const list = (items, value, sub) => items.length ? rankRows(items, value, (p) => p.width, 1, sub) : `<div class="empty">Nobody yet.</div>`;
  const widthBy = (items, f) => { const m = Math.max(1, ...items.map(f)); items.forEach((p) => { p.width = f(p) / m; }); return items; };
  const obs = widthBy([...P.obsDirectors.map((p) => ({ ...p, role: "director" })), ...P.obsActors.map((p) => ({ ...p, role: "actor" }))]
    .sort((a, b) => b.inLatest - a.inLatest).slice(0, 8), (p) => p.inLatest);
  const comp = widthBy([...P.compDirectors.map((p) => ({ ...p, role: "director" })), ...P.compActors.map((p) => ({ ...p, role: "actor" }))]
    .sort((a, b) => b.years.size - a.years.size || b.count - a.count).slice(0, 8), (p) => p.years.size);
  const disc = P.discoveries.length >= 2 ? `<div><h3>Directors discovered each year</h3>${colChart(P.discoveries.map((d) => ({ a: d.count, b: 0, label: `’${d.year.slice(2)}`, tip: `${d.year}: ${plural(d.count, "new director")}`,
      to: d.count && D.names(`Directors new in ${d.year}`, plural(d.count, "director"), d.people, { faces: true }) })), "New directors by year", "", 90, { unit: "new" })}
    <p class="status">Directors whose first film in your diary came that year. Your first diary year is left out.</p></div>` : "";
  return `<div class="ins-grid">
    <div><h3>New in ${esc(I.latest)}</h3>${list(obs, (p) => plural(p.inLatest, "film"), (p) => `${p.role === "director" ? "Director" : "Actor"} · ${plural(p.inLatest, "film")} in ${I.latest}, none before`)}</div>
    <div><h3>Long-time companions</h3>${list(comp, (p) => plural(p.years.size, "year"), (p) => `${p.role === "director" ? "Director" : "Actor"} · in your diary in ${[...p.years].sort().join(", ")}`)}</div>
    ${disc}</div>`;
}

function crowdBlock(C, Y) {
  // only the crowds this diary has scores from (no greyed-out ones), and no tabs at all when there's just one
  const crowds = Object.entries(CROWDS).filter(([k]) => (C.available[k] || 0) >= (Y ? 3 : 5) || k === C.key);
  const tabs = crowds.length > 1 ? `<div class="tabs" role="tablist">${crowds.map(([k, c]) =>
    `<button class="tab" role="tab" type="button" data-crowd="${k}" aria-selected="${k === C.key}" title="${C.available[k] || 0} rated films have this score">${c.label}</button>`).join("")}</div>` : "";
  if (C.n < (Y ? 3 : 5)) {
    const why = Y ? `Not enough crowd scores for ${Y}'s films yet.`
      : IN_VIEWER ? `Crowd scores come from TMDB and OMDb, which pages inside Claude can't reach. Open <a href="https://sjnift.github.io/bogie1946/" target="_blank" rel="noopener">the web version</a> with your keys.`
      : C.key === "letterboxd" ? "Letterboxd averages come through Apify. Add your Apify token in Settings → Film details."
      : C.key === "imdb" || C.key === "critics" ? "IMDb and critics' scores come from OMDb. Add a free OMDb key in Settings → Film details."
      : "Crowd scores come with TMDB details. Look your films up from Settings → Film details.";
    return tabs + `<div class="empty">${why}</div>`;
  }
  const lead = `<p class="lead">${Y ? `On the ${dlink(C.to, plural(C.n, "film"))} you rated in ${esc(Y)}, you gave` : `Across ${dlink(C.to, plural(C.n, "film"))} you rated, you give`} ${Math.abs(C.meanDiff).toFixed(2)}★ ${C.meanDiff >= 0 ? "more" : "less"} than ${esc(C.label)} on average${Y ? "" : followText(C.r)}.</p>`;
  const cap = (p) => `<span class="cap"><span class="stars">${stars(p.you)}</span>
    <span class="muted">${esc(C.short)} ${crowdScore(C.key, p.crowd)} · <b class="diff">${signed(p.diff)}★</b></span></span>`;
  const row = (items, empty) => items && items.length ? `<div class="posters">${items.map((p) => posterBtn(p.f, cap(p))).join("")}</div>` : `<div class="empty">${empty}</div>`;
  const gemsTo = C.gems.length && D.films("Hidden gems", "Films you rated 4½★ or more that few people have rated", C.gems.map((g) => g.f), { sort: "given", note: (f) => { const g = C.gems.find((x) => x.f === f); return `${fmtN(g.pop.n)} ${g.pop.src} votes`; } });
  const gems = C.gems.length ? `<h3>${dlink(gemsTo, "Hidden gems")}</h3><p class="status">Films you rated 4½★ or more that few people have rated.</p>
    <div class="posters">${C.gems.map((g) => posterBtn(g.f, `<span class="cap"><span class="stars">${stars(g.f.rating)}</span><span class="muted">${fmtN(g.pop.n)} ${g.pop.src} votes</span></span>`)).join("")}</div>` : "";
  return tabs + lead + `<div class="crowd">
    <h3>You liked more than ${esc(C.label)}</h3>${row(C.higher, "No film you rated ¾★ or more above them.")}
    <h3>You liked less than ${esc(C.label)}</h3>${row(C.lower, "No film you rated ¾★ or more below them.")}
    ${gems}</div>`;
}

function habitsBlock(habits, empty) {
  if (!habits.length) return `<div class="empty">${empty}</div>`;
  return `<div class="habits">${habits.map((h) => { const inner = `<span class="k">${esc(h.k)}</span><span class="v">${esc(h.v)}</span><span class="t">${esc(h.text)}${h.to ? '<span class="go" aria-hidden="true"> ›</span>' : ""}</span>`;
    return h.to ? `<button class="habit" type="button" ${dl(h.to)}>${inner}</button>` : `<div class="habit">${inner}</div>`; }).join("")}</div>`;
}

/* ----- one year ----- */
function vsPrevBlock(R, prevY) {
  if (!R.changes.length) return `<div class="empty">No diary entries in ${prevY} to compare with.</div>`;
  const arrow = (c) => Math.abs(c.d) < 1e-9 ? `<span class="muted">same</span>` : `<span aria-hidden="true">${c.d > 0 ? "▲" : "▼"}</span> <span class="sr-only">${c.d > 0 ? "up" : "down"}</span>`;
  return `<div class="tbl-wrap"><table class="data"><thead><tr><th></th><th class="n">${esc(R.Y)}</th><th class="n">${prevY}</th><th class="n">Change</th></tr></thead>
    <tbody>${R.changes.map((c) => `<tr><td>${dlink(c.to, c.label)}</td><td class="n">${dlink(c.to.groups[0], c.now)}</td><td class="n">${dlink(c.to.groups[1], c.before)}</td><td class="n">${arrow(c)}</td></tr>`).join("")}</tbody></table></div>
    <p class="status">Click any number to see the films or diary entries behind it.</p>` + (R.genreLines.length ? lineItems(R.genreLines, (l) => l.dir === "up" ? "▲" : "▼") : "");
}
function newInBlock(R) {
  const Y = R.Y;
  const plist = (title, items) => `<div><h3>${title}</h3>${items.length ? rankRows(items.map((p) => ({ ...p, width: p.count / Math.max(...items.map((q) => q.count)) })), (p) => plural(p.count, "film"), (p) => p.width, 1, personSub) : `<p class="status">Nobody.</p>`}</div>`;
  const newOnes = (label, list, field) => list.length ? `<p class="lead" style="margin-top:6px">${label}: ${list.map((v) => { const fs = R.S.films.filter((f) => { const m = metaOf(f); return m && (field === "l" ? m.l === v : m[field].includes(v)); });
    return dlink(D.films(`${v} in ${Y}`, filmsSub(fs), fs, { scope: Y }), esc(v)); }).join(", ")}.</p>` : "";
  return `<div class="ins-grid">${plist(`Directors new to your diary`, R.discDirectors)}${plist(`Actors new to your diary`, R.discActors)}</div>` +
    newOnes("Countries", R.newCountries, "k") + newOnes("Languages", R.newLangs, "l");
}
</script>
