<script>
/* ---------- phone: Stats › Years and Stats › Crowd, and the numbers that used to be on the Insights tab ----------
   Year by year, genres year by year, people over the years, against the year before, what was new in a year,
   against the crowd, genres as you rate them, habits. Insights itself is now the study (m06). */
const allInsights = () => memo(`ins|${crowdKey()}`, () => computeInsights(state.lib, metaOf, crowdKey()));
const yearInsights = (Y) => memo(`yins|${Y}|${crowdKey()}`, () => computeYearInsights(state.lib, metaOf, Y, crowdKey(), allInsights()));
const twoYears = (what) => `<div class="empty">${what} need diary entries from at least two years, with five or more films in each.</div>`;

function yearsScreen(s) {
  const head = statsHead();
  if (!s.entries.length) return head + `<div class="empty">No diary entries in this period.</div>`;
  const G = memo(`months|${s.scope}`, () => monthGrid(state.lib, metaOf, s.scope === "all" ? null : s.scope));
  const SD = memo(`seasons|${s.scope}`, () => seasonData(state.lib, metaOf, s.scope === "all" ? null : s.scope));
  if (s.scope !== "all") return head + mVsPrev(yearInsights(s.scope)) + mMonths(G) + mSeasons(SD) + mNewIn(yearInsights(s.scope));
  const I = allInsights();
  return head + mYears(I) + mMonths(G) + mSeasons(SD) + (s.withMeta ? mGenreYears(I) + mPeopleYears(I) : needMeta());
}
// Seasons (06c-insights, `seasonData`): the clear biases, each season, then (all time) each year by season.
function mSeasons(SD) {
  if (!SD) return "";
  const Y = SD.Y, H = seasonHiLo(SD), title = (x) => `${x.name}${Y ? ` ${Y}` : ", every year"}`;
  const cell = (v, label, h = "") => `<span class="c${h}"><b>${v}</b><small>${label}</small></span>`;
  const finds = SD.finds.length ? mLines(SD.finds.map((f) => ({ ...f, dir: f.more ? "up" : "down" })), (f) => f.more ? "▲" : "▼")
    : `<p class="lead" style="margin:-4px 0 12px">No season pulls a genre clearly${Y ? ` in ${esc(Y)}` : ""}: you watch much the same mix all year.</p>`;
  const rows = SD.seasons.map((x, i) => `<div class="yrow sz"><span class="y">${esc(x.name)}<small>${x.when}</small></span>${cell(x.E.length ? dlink(seasonEnts(title(x), x.E), fmtN(x.E.length)) : "0", "films")}
    ${cell(x.days ? x.pace.toFixed(1) : "—", "a month", H.pace[i])}${cell(x.avg ? dlink(seasonEnts(`Rated, ${title(x)}`, x.rated), x.avg.toFixed(2)) : "—", "average", H.avg[i])}
    ${x.lean ? `<span class="x">Leans to ${seasonLeanHtml(x, Y)}</span>` : ""}</div>`).join("");
  let years = "";
  if (SD.years.length > 1) {
    const ys = [...SD.years].reverse(), HY = seasonYearsHiLo(ys);
    years = sh("Seasons, year by year") + `<div class="group">${ys.map((y, r) => `<div class="yrow y4"><span class="y">${y.year}</span>${y.by.map((es, i) =>
      cell(es.length ? dlink(seasonEnts(`${SEASONS[i].name} ${y.year}`, es), fmtN(es.length)) : "0", SEASONS[i].name.toLowerCase(), HY[i][r])).join("")}</div>`).join("")}</div>`;
  }
  return sh("Seasons") + finds + `<div class="group">${rows}</div>` + years
    + `<p class="note">${SEASON_NOTE} “A month” is how many you log in a month of that season. ${HILO_NOTE} Tap any number to see the films.</p>`;
}
// Month by month: the grid of every month, then each calendar month across the years (or, for a year, against usual).
function mMonths(G) {
  if (!G) return "";
  const cal = G.cal.filter((c) => c.years), H = monthHiLo(G, cal);
  const rows = cal.map((c, i) => {
    const title = G.Y ? `${c.name} ${G.Y}` : `${c.name}, every year`, rated = c.E.filter((e) => e.rating || e.film.rating);
    const cell = (v, label, h) => `<span class="c${h}"><b>${v}</b><small>${label}</small></span>`;
    return `<div class="yrow"><span class="y">${MONTHS[c.i]}</span>${cell(dlink(monthEnts(title, c.E), fmtN(c.E.length)), "films", H.films[i])}
      ${G.Y ? cell(c.usual != null ? dlink(monthEnts(`${c.name} in your other years`, c.usualE, plural(c.usualYears, "year")), c.usual.toFixed(1)) : "—", "usual", H.year[i])
        : cell(dlink(monthEnts(title, c.E, plural(c.years, "year")), c.perYear.toFixed(1)), "a year", H.year[i])}
      ${cell(c.avg ? dlink(monthEnts(`Rated in ${title}`, rated), c.avg.toFixed(2)) : "—", "average", H.avg[i])}
      ${c.lean ? `<span class="x">Leans to ${leanHtml(c, title)}</span>` : ""}</div>`;
  }).join("");
  const line = monthsLine(G);
  return sh("Month by month") + (line ? `<p class="lead" style="margin:-4px 0 12px">${line}</p>` : "") + `<div class="card mgrid-card">${monthGridHtml(G)}</div>` +
    sh(G.Y ? `Each month of ${esc(G.Y)}` : "Each month, across the years") + `<div class="group">${rows}</div><p class="note">Darker squares are busier months${G.Y ? "; “usual” is the same month in your other years" : ""}. ${HILO_NOTE} Tap any number to see the films.</p>`;
}
function crowdScreen(s) {
  const k = crowdKey();
  if (s.scope === "all") return statsHead() + mCrowd(crowdOf(k, state.lib.films));
  const R = yearInsights(s.scope);
  return statsHead() + mCrowd(crowdOf(k, R.S.films, R.ratingAt), s.scope);
}

const TRENDS = {
  films: { label: "Films", unit: "films", value: (p) => p.films, tip: (p) => `${p.year}: ${plural(p.films, "film")}${p.pace ? `, on pace for about ${fmtN(p.pace)}` : ""}`, extra: (p) => p.pace && p.pace > p.films ? p.pace - p.films : 0 },
  hours: { label: "Hours", unit: "h", value: (p) => Math.round(p.hours), tip: (p) => `${p.year}: ${fmtN(Math.round(p.hours))} hours` },
  rating: { label: "Rating", value: (p) => p.avgRating, tip: (p) => `${p.year}: ${p.avgRating ? starsNum(p.avgRating) : "no ratings"}` },
  age: { label: "Film age", unit: "yrs", value: (p) => p.age, tip: (p) => `${p.year}: ${p.age != null ? Math.round(p.age) + " years old on average" : "—"}` },
  nonEnglish: { label: "Not English", unit: "%", value: (p) => p.nonEnglish, tip: (p) => `${p.year}: ${p.nonEnglish != null ? p.nonEnglish + "% not in English" : "not enough details"}` },
  rewatches: { label: "Rewatches", unit: "%", value: (p) => pctOf(p.rewatches, p.entries), tip: (p) => `${p.year}: ${pctOf(p.rewatches, p.entries)}% of entries were rewatches` },
};
function mYears(I) {
  if (I.years.length < 2) return sh("Year by year") + twoYears("Year-by-year trends");
  const t = TRENDS[state.trend] ? state.trend : "films", T = TRENDS[t];
  const anyPace = t === "films" && I.years.some((p) => p.pace && p.pace > p.films);
  const legend = anyPace ? `<div class="legend"><span><i style="background:var(--green-mark)"></i>Watched</span><span><i style="background:var(--blue-mark)"></i>Rest of this year at your pace</span></div>` : "";
  const chart = colChart(I.years.map((p, i) => ({ a: Math.max(0, T.value(p) || 0), b: T.extra ? T.extra(p) : 0, label: yearTick(i, I.years.length, p.year), year: p.year, tip: T.tip(p), to: p.entries ? yearDrill(p, t) : null })), `${T.label} by year`, legend, 130,
    t === "rating" ? avgYearsChart(I.years) : { unit: T.unit });
  const ys = [...I.years].reverse(), H = yearsHiLo(ys);
  const rows = ys.map((p, i) => {
    const cell = (what, v, label) => `<span class="c${(H[what] || [])[i] || ""}"><b>${v == null ? "—" : dlink(yearDrill(p, what), v)}</b><small>${label}</small></span>`;
    const g = p.topGenre, gf = g && p.F.filter(hasGenre(g[0]));
    const extra = [g ? dlink(D.films(`${g[0]} in ${p.year}`, filmsSub(gf), gf, { scope: p.year }), esc(g[0])) : "",
      p.topDirector && p.topDirector[1] > 1 ? dlink(personDrill(state.lib, p.topDirector[0], "d", p.F), esc(p.topDirector[0])) : "",
      p.nonEnglish != null ? dlink(yearDrill(p, "nonEnglish"), `${p.nonEnglish}% not English`) : ""].filter(Boolean).join(" · ");
    return `<div class="yrow"><span class="y">${dlink(yearDrill(p, "entries"), p.year)}</span>${cell("films", fmtN(p.films) + (p.pace ? `<span class="dim" style="font-weight:500"> →${fmtN(p.pace)}</span>` : ""), "films")}
      ${cell("hours", fmtN(Math.round(p.hours)), "hours")}${cell("rating", p.avgRating ? p.avgRating.toFixed(2) : null, "average")}${extra ? `<span class="x">${extra}</span>` : ""}</div>`;
  }).join("");
  return sh("Year by year") + chipBar("trend", Object.entries(TRENDS).map(([k, x]) => [k, x.label]), t) + `<div class="card" style="margin-top:12px">${chart}</div>` +
    sh("Every year") + `<div class="group">${rows}</div><p class="note">${HILO_NOTE}${ys.some((p) => p.pace) ? " A year still under way isn't marked for its counts." : ""} Tap any number to see what's behind it.</p>`;
}

function mGenreYears(I) {
  if (!I.tastes.table) return sh("Genres year by year") + twoYears("Genres year by year");
  const t = I.tastes.table, years = t.years.slice(-8);
  const max = Math.max(1, ...t.genres.flatMap((g, gi) => years.map((y) => y.shares[gi] || 0)));
  const rows = t.genres.map((g, gi) => `<div class="gshare"><span class="gname">${dlink(catDrill(state.lib, g, "g"), esc(g))}</span><span class="spark">${years.map((y) => {
    const v = y.shares[gi], fs = y.p.F.filter(hasGenre(g)), h = `<span style="height:${v == null ? 0 : Math.max(4, v / max * 100).toFixed(1)}%"></span>`;
    return fs.length ? `<button type="button" ${dl(D.films(`${g} in ${y.year}`, filmsSub(fs, `${v}% of the year's films`), fs, { scope: y.year }))} aria-label="${esc(g)} in ${y.year}: ${v}%" data-tip="${y.year}: ${v}%">${h}</button>` : `<i aria-hidden="true">${h}</i>`; }).join("")}</span></div>`).join("");
  const axis = `<div class="spark-axis"><span></span><div>${years.map((y) => `<span>’${y.year.slice(2)}</span>`).join("")}</div></div>`;
  return sh("Genres year by year") + `<div class="group">${rows}${axis}</div><p class="note">Each bar is the share of that year's films in the genre. Tap one to see those films.</p>`;
}

function mGenres(I) {
  if (!I.genres.length) return "";
  const max = Math.max(0.5, ...I.genres.map((g) => Math.abs(g.vsCrowd || 0)), ...I.genres.map((g) => Math.abs(g.vsMe)));
  const bar = (d) => d == null ? `<span class="dim">—</span>` : `<span class="dbar" aria-hidden="true"><span class="mid"></span><span class="fill ${d >= 0 ? "pos" : "neg"}" style="width:${Math.min(50, Math.abs(d) / max * 50).toFixed(1)}%"></span></span>`;
  const H = genresHiLo(I.genres);
  const rows = I.genres.map((g, i) => `<button class="grow" type="button" data-list="${reg(g.name, `${plural(g.count, "film")} · ${g.mine.toFixed(2)} average`, g.films)}">
    <span style="min-width:0"><span class="nm">${esc(g.name)}</span><span class="sub"><span class="${H.count[i].trim()}">${plural(g.count, "film")}</span> · <span class="${H.mine[i].trim()}">★ ${g.mine.toFixed(2)}</span></span></span>
    <span class="gcol">${bar(g.vsMe)}<span class="v${H.vsMe[i]}">${signed(g.vsMe, 2)}</span></span><span class="gcol">${bar(g.vsCrowd)}<span class="v${H.vsCrowd[i]}">${g.vsCrowd == null ? "" : signed(g.vsCrowd, 2)}</span></span>${CHEV}</button>`).join("");
  return sh("Genres as you rate them") + `<div class="ghead"><span></span><span>vs your avg</span><span>vs ${esc(I.crowd.short)}</span><span></span></div><div class="group">${rows}</div>
    <div class="legend" style="margin-top:10px"><span><i style="background:var(--green-mark)"></i>Higher</span><span><i style="background:var(--blue-mark)"></i>Lower</span><span>in stars</span></div><p class="note">${HILO_NOTE}</p>`;
}

function mPeopleYears(I) {
  const P = I.people;
  const row = (p, i, value, sub) => `<button class="prow" type="button" data-list="${reg(p.name, sub(p), p.films, p)}">
    <span class="rk">${i + 1}</span>${avatar(p, "md")}<span style="min-width:0"><span class="nm">${esc(p.name)}</span><span class="sub">${esc(sub(p))}</span></span>
    <span class="val">${value}</span>${CHEV}</button>`;
  const obs = [...P.obsDirectors.map((p) => ({ ...p, role: "Director" })), ...P.obsActors.map((p) => ({ ...p, role: "Actor" }))].sort((a, b) => b.inLatest - a.inLatest).slice(0, 6);
  const comp = [...P.compDirectors.map((p) => ({ ...p, role: "Director" })), ...P.compActors.map((p) => ({ ...p, role: "Actor" }))].sort((a, b) => b.years.size - a.years.size || b.count - a.count).slice(0, 6);
  let html = "";
  if (obs.length) html += sh(`New in ${I.latest}`) + `<div class="group">${obs.map((p, i) => row(p, i, `${p.inLatest}`, (q) => `${q.role} · ${plural(q.inLatest, "film")} in ${I.latest}, none before`)).join("")}</div>`;
  if (comp.length) html += sh("Long-time companions") + `<div class="group">${comp.map((p, i) => row(p, i, `${p.years.size}y`, (q) => `${q.role} · ${plural(q.years.size, "year")} of your diary`)).join("")}</div>`;
  if (P.discoveries.length >= 2) html += sh("Directors discovered each year") + `<div class="card">` +
    colChart(P.discoveries.map((d, i) => ({ a: d.count, b: 0, label: yearTick(i, P.discoveries.length, d.year), tip: `${d.year}: ${plural(d.count, "new director")}`,
      to: d.count && D.names(`Directors new in ${d.year}`, plural(d.count, "director"), d.people, { faces: true }) })), "New directors by year", "", 80, { unit: "new" }) + `</div>`;
  return html;
}

function mHabits(habits, title) {
  if (!habits.length) return "";
  const go = '<span class="go" aria-hidden="true">&nbsp;›</span>';
  return sh(title) + `<div class="facts" style="margin-top:0">${habits.map((h) => { const inner = `<span class="k">${esc(h.k)}</span><span class="v">${esc(h.v)}</span><span class="t">${esc(h.text)}${h.to ? go : ""}</span>`;
    return h.to ? `<button class="fact" type="button" ${dl(h.to)}>${inner}</button>` : `<div class="fact">${inner}</div>`; }).join("")}</div>`;
}

/* ----- one year ----- */
function mVsPrev(R) {
  const prevY = String(+R.Y - 1);
  if (!R.changes.length) return sh(`Against ${prevY}`) + `<div class="empty">No diary entries in ${prevY} to compare with.</div>`;
  return sh(`${esc(R.Y)} against ${prevY}`) + `<div class="group"><div class="crow head"><span></span><span class="n">${esc(R.Y)}</span><span class="n">${prevY}</span><span></span></div>${R.changes.map((c) =>
    `<div class="crow"><span>${dlink(c.to, c.label)}</span><span class="n">${dlink(c.to.groups[0], c.now)}</span><span class="n dim">${dlink(c.to.groups[1], c.before)}</span><span class="d ${Math.abs(c.d) < 1e-9 ? "" : c.d > 0 ? "up" : "down"}">${Math.abs(c.d) < 1e-9 ? "=" : c.d > 0 ? "▲" : "▼"}</span></div>`).join("")}</div>
    <p class="note">Tap any number to see what's behind it.</p>` + (R.genreLines.length ? sh("Genres") + mLines(R.genreLines, (l) => l.dir === "up" ? "▲" : "▼") : "");
}
function mNewIn(R) {
  const Y = R.Y;
  if (R.firstYear === Y) return "";
  const prow = (items) => `<div class="group">${items.map((p, i) => `<button class="prow" type="button" data-list="${reg(p.name, filmsTitle(p), p.films, p)}"><span class="rk">${i + 1}</span>${avatar(p, "md")}
    <span style="min-width:0"><span class="nm">${esc(p.name)}</span><span class="sub">first time in your diary</span></span><span class="val">${p.count}</span>${CHEV}</button>`).join("")}</div>`;
  let h = "";
  if (R.discDirectors.length) h += sh(`New directors in ${esc(Y)}`) + prow(R.discDirectors.slice(0, 5));
  if (R.discActors.length) h += sh(`New actors in ${esc(Y)}`) + prow(R.discActors.slice(0, 5));
  const newOnes = (label, list, field) => list.length ? `${label}: ${list.map((v) => { const fs = R.S.films.filter((f) => { const m = metaOf(f); return m && (field === "l" ? m.l === v : m[field].includes(v)); });
    return dlink(D.films(`${v} in ${Y}`, filmsSub(fs), fs, { scope: Y }), esc(v)); }).join(", ")}.` : "";
  if (R.newCountries.length || R.newLangs.length) h += sh("New places and languages") + `<p class="lead">${newOnes("Countries", R.newCountries, "k")} ${newOnes("Languages", R.newLangs, "l")}</p>`;
  return h;
}

function mCrowd(C, Y) {
  // only the crowds this diary has scores from, and no switch at all when there's just one
  const crowds = Object.entries(CROWDS).filter(([k]) => (C.available[k] || 0) >= (Y ? 3 : 5) || k === C.key);
  const toggles = crowds.length > 1 ? chipBar("crowdsel", crowds.map(([k, c]) => [k, c.short]), C.key) : "";
  if (C.n < (Y ? 3 : 5)) {
    const why = Y ? `Comparing with the crowd needs three or more rated films with crowd scores in ${esc(Y)}.`
      : IN_VIEWER ? `Crowd scores come from TMDB and OMDb, which pages inside Claude can't reach. Open <a href="https://sjnift.github.io/bogie1946/" target="_blank" rel="noopener">the web version</a>.`
      : C.key === "tmdb" ? "Crowd scores come with TMDB details. Look your films up in Settings."
      : C.key === "letterboxd" ? "Letterboxd averages need an Apify token, added in Settings." : "IMDb and critics' scores need a free OMDb key, added in Settings.";
    return toggles + `<div class="empty">${why}</div>` + lbHint(true);
  }
  const cap = (p) => `<span class="pmeta"><span class="stars">${stars(p.you)}</span></span><span class="mdate">${C.short} ${crowdScore(C.key, p.crowd)} · <b class="dv">${signed(p.diff)}★</b></span>`;
  let html = toggles + `<div class="card glow" style="margin-top:12px"><p class="lead" style="margin:0">${Y ? `In ${esc(Y)} you gave` : "You give"} <b class="dv">${Math.abs(C.meanDiff).toFixed(2)}★ ${C.meanDiff >= 0 ? "more" : "less"}</b> than ${esc(C.label)} on average${Y ? "" : followText(C.r)}, across ${dlink(C.to, plural(C.n, "film"))}.</p>${apartLine(C).replace('<p class="status">', '<p class="note" style="margin:8px 0 0">')}</div>`;
  html += sh(`Liked more than ${esc(C.short)}`) + (C.higher.length ? mPosters(C.higher, cap) : `<div class="empty">No film you rated ${starPart(crowdAbove())} or more above them.</div>`);
  html += sh(`Liked less than ${esc(C.short)}`) + (C.lower.length ? mPosters(C.lower, cap) : `<div class="empty">No film you rated ¾★ or more below them.</div>`);
  if (C.gems.length) html += sh("Hidden gems") + `<p class="note" style="margin:-4px 0 12px">Rated 4½★ or more by you, and by few others.</p>` +
    mPosters(C.gems, (g) => `<span class="pmeta"><span class="stars">${stars(g.f.rating)}</span></span><span class="mdate">${fmtN(g.pop.n)} ${g.pop.src} votes</span>`);
  return lbHint(true) + html;
}
</script>
