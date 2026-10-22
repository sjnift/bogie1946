<script>
/* ---------- desktop: the Insights report ---------- */
function renderInsights() {
  const lib = state.lib;
  const ys = diaryYears(lib);
  if (state.insYear !== "all" && !ys.includes(state.insYear)) state.insYear = "all";
  $(".scopes-row").hidden = !ys.length;
  $("#scopes").innerHTML = ["all", ...[...ys].reverse()].map((y) =>
    `<button class="chip" type="button" data-insyear="${y}" aria-pressed="${y === state.insYear}">${y === "all" ? "All years" : y}</button>`).join("");
  if (state.insYear !== "all") return renderYearInsights(state.insYear);
  const I = computeInsights(lib, metaOf, state.crowd || defaultCrowd(lib, metaOf));
  const first = lib.entries[0], last = lib.entries[lib.entries.length - 1];
  $("#hero-title").innerHTML = `Your <span class="accent">insights</span>`;
  $("#hero-sub").innerHTML = first ? `Patterns across ${dlink(D.entries("Your diary", entriesSub(lib.entries), lib.entries), plural(I.years.length, "year"))} of your diary, ${fmtDate(first.date)} to ${fmtDate(last.date)}, and every film you've logged.` : "Insights come from your diary dates, and this diary has none yet.";
  $("#insights").innerHTML = [
    section("i-glance", "At a glance", "The strongest patterns in your diary.", glanceBlock(I.glance)),
    section("i-years", "Year by year", "By the year you watched, from diary dates.", yearsBlock(I)),
    section("i-tastes", "Changing tastes", I.usable.length >= 2 ? `Your earliest years against your latest.` : "", tastesBlock(I)),
    section("i-genres", "Genres", "How much you watch each genre, and how you rate it.", genresBlock(I)),
    section("i-people", "People", "Directors and actors across your years of watching.", peopleInsights(I)),
    section("i-crowd", "Against the crowd", "Where your ratings part ways with everyone else's.", crowdBlock(I)),
    section("i-reviews", "Your reviews", "What you write, and when you bother.", reviewInsightsBlock(lib, null)),
    section("i-habits", "Habits", "When and how you watch.", habitsBlock(I.habits)),
  ].join("");
  syncHash();
}
const needYears = (what) => `<div class="empty">${what} need diary entries from at least two years, with five or more films in each.</div>`;
// a sentence that opens the data it describes
const lineItems = (lines, mark) => `<ul class="trend-lines">${lines.map((l) => `<li><span class="mk" aria-hidden="true">${mark(l)}</span><span>${dline(l.to, esc(l.text))}</span></li>`).join("")}</ul>`;
// a poster that opens its film
const posterBtn = (f, cap) => `<button class="poster" type="button" ${dl(D.film(f))}>${artHtml(f)}${cap}</button>`;

function glanceBlock(glance, empty = "Not enough diary entries for insights yet.") {
  if (!glance.length) return `<div class="empty">${empty}</div>`;
  return `<div class="glance">${glance.map((g) => { const inner = `<span class="k">${esc(g.k)}</span><span class="big">${esc(g.big)}</span><span class="gp">${esc(g.text)}${g.to ? '<span class="go" aria-hidden="true"> ›</span>' : ""}</span>`;
    return g.to ? `<button class="gcard" type="button" ${dl(g.to)}>${inner}</button>` : `<div class="gcard">${inner}</div>`; }).join("")}</div>`;
}

function yearsBlock(I) {
  if (I.years.length < 2) return needYears("Year-by-year trends");
  const yr = (p) => `’${p.year.slice(2)}`;
  const mult = (title, what, value, tip, extra) => {
    const cols = I.years.map((p) => ({ a: Math.max(0, value(p) || 0), b: extra ? extra(p) : 0, label: yr(p), tip: tip(p), to: p.entries ? yearDrill(p, what) : null }));
    return `<div class="mult"><h3>${title}</h3>${colChart(cols, title + " by year", "", 90)}</div>`;
  };
  const anyPace = I.years.some((p) => p.pace && p.pace > p.films);
  const legend = anyPace ? `<div class="legend"><span><i style="background:var(--gold)"></i>Watched</span><span><i style="background:var(--lilac)"></i>Rest of this year at your current pace</span></div>` : "";
  const charts = `<div class="mults">
    ${mult("Films", "films", (p) => p.films, (p) => `${p.year}: ${plural(p.films, "film")}${p.pace ? `, on pace for about ${fmtN(p.pace)}` : ""}`, (p) => p.pace && p.pace > p.films ? p.pace - p.films : 0)}
    ${mult("Hours", "hours", (p) => Math.round(p.hours), (p) => `${p.year}: ${fmtN(Math.round(p.hours))} hours`)}
    ${mult("Average rating", "rating", (p) => p.avgRating, (p) => `${p.year}: ${p.avgRating ? starsNum(p.avgRating) : "no ratings"}`)}
    ${mult("Film age when watched (years)", "age", (p) => p.age, (p) => `${p.year}: films were ${p.age != null ? Math.round(p.age) : "—"} years old on average`)}
    ${mult("Not in English (%)", "nonEnglish", (p) => p.nonEnglish, (p) => `${p.year}: ${p.nonEnglish != null ? p.nonEnglish + "%" : "not enough details"}`)}
    ${mult("Rewatches (%)", "rewatches", (p) => pctOf(p.rewatches, p.entries), (p) => `${p.year}: ${pctOf(p.rewatches, p.entries)}% of entries`)}
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

function tastesBlock(I) {
  if (!I.tastes.table) return needYears("Changes in taste");
  const lines = I.tastes.lines.length ? lineItems(I.tastes.lines, (l) => l.dir === "up" ? "▲" : "▼")
    : `<p class="lead">Your taste has held steady: no genre, language or rating habit moved much between your earliest and latest years.</p>`;
  const t = I.tastes.table;
  const heat = `<div class="tbl-wrap"><table class="data heat"><caption class="sr-only">Share of each year's films in each genre</caption>
    <thead><tr><th>Genre</th>${t.years.map((y) => `<th class="n">${y.year}</th>`).join("")}</tr></thead>
    <tbody>${t.genres.map((g, gi) => `<tr><td>${dlink(catDrill(state.lib, g, "g"), esc(g))}</td>${t.years.map((y) => { const v = y.shares[gi], fs = y.p.F.filter(hasGenre(g));
      return `<td class="n cell" style="background:color-mix(in srgb, var(--gold) ${v == null ? 0 : Math.min(70, v * 1.6)}%, transparent)">${v == null ? "—" : dlink(fs.length && D.films(`${g} in ${y.year}`, filmsSub(fs, `${v}% of the year's films`), fs, { scope: y.year }), v + "%")}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="status">Share of each year's films in the genre. A film can have several genres. Click a share to see those films.</p>`;
  return lines + heat;
}

function divBar(d, max) {
  if (d == null) return `<span class="muted">—</span>`;
  const w = Math.min(50, Math.abs(d) / max * 50);
  return `<span class="div-bar" aria-hidden="true"><span class="mid"></span><span class="fill ${d >= 0 ? "pos" : "neg"}" style="width:${w.toFixed(1)}%"></span></span> <span class="num">${signed(d, 2)}</span>`;
}
function genresBlock(I) {
  if (!I.genres.length) return `<div class="empty">Genres come from cast &amp; crew details. Look your films up to see this.</div>`;
  const max = Math.max(0.5, ...I.genres.map((g) => Math.max(Math.abs(g.vsMe), Math.abs(g.vsCrowd || 0))));
  const lines = I.genreLines.length ? lineItems(I.genreLines, () => "●") : "";
  const rows = I.genres.map((g) => { const to = D.films(g.name, `${plural(g.count, "film")} · ${g.mine.toFixed(2)} average`, g.films);
    return `<tr><td>${dlink(to, esc(g.name))}</td><td class="n">${dlink(to, fmtN(g.count))}</td><td class="n">${dlink(to, g.share + "%")}</td><td class="n">${dlink(to, g.mine.toFixed(2))}</td>
    <td>${dlink(to, divBar(g.vsMe, max))}</td><td>${g.vsCrowd == null ? divBar(null) : dlink(crowdDrill(g.films, I.crowd.key, `${g.name} against ${I.crowd.label}`), divBar(g.vsCrowd, max))}</td></tr>`; }).join("");
  return lines + `<div class="legend"><span><i style="background:var(--gold)"></i>Higher</span><span><i style="background:var(--lilac)"></i>Lower</span></div>
    <div class="tbl-wrap"><table class="data"><thead><tr><th>Genre</th><th class="n">Films</th><th class="n">Share</th><th class="n">Your avg ★</th>
    <th>Against your average</th><th>Against ${esc(I.crowd.label)}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="status">Genres with three or more rated films. Differences are in stars.</p>`;
}

function peopleInsights(I) {
  const P = I.people;
  if (!P.compDirectors.length && !P.obsDirectors.length && !P.binges.length && !P.compActors.length) return `<div class="empty">People trends need cast &amp; crew details and a few years of diary entries.</div>`;
  const list = (items, value, sub) => items.length ? rankRows(items, value, (p) => p.width, 1, sub) : `<div class="empty">Nobody yet.</div>`;
  const widthBy = (items, f) => { const m = Math.max(1, ...items.map(f)); items.forEach((p) => { p.width = f(p) / m; }); return items; };
  const obs = widthBy([...P.obsDirectors.map((p) => ({ ...p, role: "director" })), ...P.obsActors.map((p) => ({ ...p, role: "actor" }))]
    .sort((a, b) => b.inLatest - a.inLatest).slice(0, 8), (p) => p.inLatest);
  const comp = widthBy([...P.compDirectors.map((p) => ({ ...p, role: "director" })), ...P.compActors.map((p) => ({ ...p, role: "actor" }))]
    .sort((a, b) => b.years.size - a.years.size || b.count - a.count).slice(0, 8), (p) => p.years.size);
  const binge = widthBy(P.binges.map((p) => ({ ...p, to: D.entries(`${p.name} binge`, `${p.binge.n} films between ${fmtDate(p.binge.from)} and ${fmtDate(p.binge.to)}`, p.binge.entries, { order: "asc", person: p }) })), (p) => p.binge.n);
  const disc = P.discoveries.length >= 2 ? `<div><h3>Directors discovered each year</h3>${colChart(P.discoveries.map((d) => ({ a: d.count, b: 0, label: `’${d.year.slice(2)}`, tip: `${d.year}: ${plural(d.count, "new director")}`,
      to: d.count && D.names(`Directors new in ${d.year}`, plural(d.count, "director"), d.people, { faces: true }) })), "New directors by year", "", 90)}
    <p class="status">Directors whose first film in your diary came that year. Your first diary year is left out.</p></div>` : "";
  return `<div class="ins-grid">
    <div><h3>New in ${esc(I.latest)}</h3>${list(obs, (p) => plural(p.inLatest, "film"), (p) => `${p.role === "director" ? "Director" : "Actor"} · ${plural(p.inLatest, "film")} in ${I.latest}, none before`)}</div>
    <div><h3>Long-time companions</h3>${list(comp, (p) => plural(p.years.size, "year"), (p) => `${p.role === "director" ? "Director" : "Actor"} · in your diary in ${[...p.years].sort().join(", ")}`)}</div>
    <div><h3>Director binges</h3>${list(binge, (p) => `${p.binge.n} in ${dayIndex(p.binge.to) - dayIndex(p.binge.from) + 1}d`, (p) => `${p.binge.n} films between ${fmtDate(p.binge.from)} and ${fmtDate(p.binge.to)}`)}
      <p class="status">Three or more films by one director within 30 days.</p></div>
    ${disc}</div>`;
}

function crowdBlock(I) {
  const C = I.crowd;
  const tabs = `<div class="tabs" role="tablist">${Object.entries(CROWDS).map(([k, c]) => {
    const n = C.available[k] || 0;
    return `<button class="tab" role="tab" type="button" data-crowd="${k}" aria-selected="${k === C.key}" ${n < 5 ? "disabled" : ""} title="${n} rated films have this score">${c.label}</button>`; }).join("")}</div>`;
  if (C.n < 5) {
    const why = IN_VIEWER ? `Crowd scores come from TMDB and OMDb, which pages inside Claude can't reach. Open <a href="https://sjnift.github.io/credits-roll/" target="_blank" rel="noopener">the web version</a> with your keys.`
      : C.key === "letterboxd" ? "Letterboxd averages come through Apify. Add your Apify token in the Cast &amp; crew box on the stats page."
      : C.key === "imdb" || C.key === "critics" ? "IMDb and critics' scores come from OMDb. Add a free OMDb key in the Cast &amp; crew box on the stats page."
      : "Crowd scores come with TMDB details. Look your films up from the Cast &amp; crew box on the stats page.";
    return tabs + `<div class="empty">${why}</div>`;
  }
  const lead = `<p class="lead">Across ${dlink(C.to, plural(C.n, "film"))} you rated, you give ${Math.abs(C.meanDiff).toFixed(2)}★ ${C.meanDiff >= 0 ? "more" : "less"} than ${esc(C.label)} on average${followText(C.r)}.</p>`;
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

function habitsBlock(habits, empty = "Habits come from diary dates.") {
  if (!habits.length) return `<div class="empty">${empty}</div>`;
  return `<div class="habits">${habits.map((h) => { const inner = `<span class="k">${esc(h.k)}</span><span class="v">${esc(h.v)}</span><span class="t">${esc(h.text)}${h.to ? '<span class="go" aria-hidden="true"> ›</span>' : ""}</span>`;
    return h.to ? `<button class="habit" type="button" ${dl(h.to)}>${inner}</button>` : `<div class="habit">${inner}</div>`; }).join("")}</div>`;
}

/* ----- one year ----- */
function renderYearInsights(Y) {
  const lib = state.lib;
  const R = computeYearInsights(lib, metaOf, Y, state.crowd || defaultCrowd(lib, metaOf));
  const prevY = String(+Y - 1);
  $("#hero-title").innerHTML = `<span class="accent">${esc(Y)}</span> insights`;
  $("#hero-sub").innerHTML = `${dlink(DR.films(R.S), plural(R.S.films.length, "film"))} and ${dlink(DR.diary(R.S), plural(R.S.entries.length, "diary entry", "diary entries"))} in ${Y}, against ${prevY} and against your whole diary.`;
  const arrow = (c) => Math.abs(c.d) < 1e-9 ? `<span class="muted">same</span>` : `<span aria-hidden="true">${c.d > 0 ? "▲" : "▼"}</span> <span class="sr-only">${c.d > 0 ? "up" : "down"}</span>`;
  const vsPrev = R.changes.length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th></th><th class="n">${esc(Y)}</th><th class="n">${prevY}</th><th class="n">Change</th></tr></thead>
      <tbody>${R.changes.map((c) => `<tr><td>${dlink(c.to, c.label)}</td><td class="n">${dlink(c.to.groups[0], c.now)}</td><td class="n">${dlink(c.to.groups[1], c.before)}</td><td class="n">${arrow(c)}</td></tr>`).join("")}</tbody></table></div><p class="status">Click any number to see the films or diary entries behind it.</p>` +
      (R.genreLines.length ? lineItems(R.genreLines, (l) => l.dir === "up" ? "▲" : "▼") : "")
    : `<div class="empty">No diary entries in ${prevY} to compare with.</div>`;
  const months = MONTHS.map((m, i) => {
    const key = `${Y}-${String(i + 1).padStart(2, "0")}`, es = R.S.entries.filter((e) => e.date.startsWith(key)), b = es.filter((e) => e.rewatch).length;
    return { a: es.length - b, b, label: m, tip: `${MONTHS_LONG[i]} ${Y}: ${plural(es.length, "film")}${b ? ` (${plural(b, "rewatch", "rewatches")})` : ""}`, to: es.length && DR.month(R.S.entries, key) };
  });
  const monthChart = R.S.entries.length ? colChart(months, `Films each month of ${Y}`, R.S.rewatches ? `<div class="legend"><span><i style="background:var(--gold)"></i>First watch</span><span><i style="background:var(--lilac)"></i>Rewatch</span></div>` : "") : `<div class="empty">No diary entries.</div>`;
  const posterRow = (items, empty) => items.length ? `<div class="posters">${items.map((x) => posterBtn(x.f, `<span class="cap"><span class="stars">${stars(x.r)}</span>${x.f.liked ? ' <span class="muted">♥</span>' : ""}</span>`)).join("")}</div>` : `<div class="empty">${empty}</div>`;
  const plist = (title, items, val) => `<div><h3>${title}</h3>${items.length ? rankRows(items.map((p) => ({ ...p, width: p.count / Math.max(...items.map((q) => q.count)) })), val, (p) => p.width, 1, personSub) : `<p class="status">Nobody.</p>`}</div>`;
  const first = R.firstYear === Y;
  const newOnes = (label, list, field) => list.length ? `${label}: ${list.map((v) => { const fs = R.S.films.filter((f) => { const m = metaOf(f); return m && (field === "l" ? m.l === v : m[field].includes(v)); });
    return dlink(D.films(`${v} in ${Y}`, filmsSub(fs), fs, { scope: Y }), esc(v)); }).join(", ")}.` : "";
  const people = `<div class="ins-grid">
    ${plist(`Most watched directors in ${Y}`, R.topDirectors, (p) => plural(p.count, "film"))}
    ${plist(`Most watched actors in ${Y}`, R.topActors, (p) => plural(p.count, "film"))}
    ${first ? "" : plist(`Directors new to your diary in ${Y}`, R.discDirectors, (p) => plural(p.count, "film"))}
    ${first ? "" : plist(`Actors new to your diary in ${Y}`, R.discActors, (p) => plural(p.count, "film"))}</div>
    ${!first && (R.newCountries.length || R.newLangs.length) ? `<p class="lead" style="margin-top:6px">${newOnes(`New countries in ${Y}`, R.newCountries, "k")} ${newOnes("New languages", R.newLangs, "l")}</p>` : ""}`;
  const C = R.crowd;
  const tabs = `<div class="tabs" role="tablist">${Object.entries(CROWDS).map(([k, c]) => {
    const n = R.rated.filter((x) => c.score(metaOf(x.f), x.f)).length;
    return `<button class="tab" role="tab" type="button" data-crowd="${k}" aria-selected="${k === C.key}" ${n < 3 ? "disabled" : ""}>${c.label}</button>`; }).join("")}</div>`;
  const cap = (p) => `<span class="cap"><span class="stars">${stars(p.you)}</span><span class="muted">${esc(C.short)} ${crowdScore(C.key, p.crowd)} · <b class="diff">${signed(p.diff)}★</b></span></span>`;
  const prow = (items, empty) => items.length ? `<div class="posters">${items.map((p) => posterBtn(p.f, cap(p))).join("")}</div>` : `<div class="empty">${empty}</div>`;
  const crowdTo = crowdDrill(R.rated.map((x) => x.f), C.key, `${Y} against ${C.label}`, R.ratingAt);
  const crowd = tabs + (C.n >= 3 ? `<p class="lead">On the ${dlink(crowdTo, plural(C.n, "film"))} you rated in ${Y}, you gave ${Math.abs(C.meanDiff).toFixed(2)}★ ${C.meanDiff >= 0 ? "more" : "less"} than ${esc(C.label)} on average.</p>
    <div class="crowd"><h3>You liked more</h3>${prow(C.higher, "Nothing ¾★ or more above them.")}<h3>You liked less</h3>${prow(C.lower, "Nothing ¾★ or more below them.")}</div>`
    : `<div class="empty">Not enough crowd scores for ${Y}'s films yet.</div>`);
  $("#insights").innerHTML = [
    section("y-glance", `${esc(Y)} at a glance`, `The year's headlines. ${dlink(R.S.entries.length && D.share(Y), "Share them as an image")}`, glanceBlock(R.glance, `Not enough diary entries in ${Y}.`)),
    section("y-prev", `Against ${prevY}`, "This year next to the one before.", vsPrev),
    section("y-months", "Month by month", `Diary entries through ${esc(Y)}.`, monthChart),
    section("y-best", `Best of ${esc(Y)}`, "Your highest-rated films that year.", posterRow(R.best, "No rated films.") +
      (R.worst.length ? `<h3 class="sub-h" style="margin-top:6px">Lowest rated</h3>` + posterRow(R.worst, "") : "")),
    section("y-people", `People of ${esc(Y)}`, first ? "Your first diary year, so everyone is new." : "Who you watched most, and who was new.", people),
    section("y-crowd", "Against the crowd", `Films you rated in ${esc(Y)}.`, crowd),
    section("y-reviews", `Reviews in ${esc(Y)}`, "What you wrote that year.", reviewInsightsBlock(lib, Y)),
    section("y-habits", `Habits in ${esc(Y)}`, "When and how you watched.", habitsBlock(R.habits, "No diary entries.")),
  ].join("");
  syncHash();
}
</script>
