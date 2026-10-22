<script>
/* ---------- phone: the Insights screen, pushed from the nav bar or Profile ---------- */
function insightsScreen() {
  const lib = state.lib;
  if (!lib.entries.length) return `<div class="empty" style="padding-top:28px">Insights come from your diary dates, and this diary has none yet.</div>`;
  const ys = diaryYears(lib);
  if (state.insYear !== "all" && !ys.includes(state.insYear)) state.insYear = "all";
  const picker = `<div class="toggles yearpick">${["all", ...[...ys].reverse()].map((y) =>
    `<button class="toggle" type="button" data-insyear="${y}" aria-pressed="${y === state.insYear}">${y === "all" ? "All years" : y}</button>`).join("")}</div>`;
  if (state.insYear !== "all") return picker + mYearInsights(state.insYear);
  return picker + mAllInsights();
}
function mAllInsights() {
  const lib = state.lib;
  const I = computeInsights(lib, metaOf, state.crowd || defaultCrowd(lib, metaOf));
  const first = lib.entries[0].date, last = lib.entries[lib.entries.length - 1].date;
  const intro = `<p class="status" style="margin:16px 0 0">Patterns across ${dlink(D.entries("Your diary", entriesSub(lib.entries), lib.entries), plural(I.years.length, "year"))} of diary, ${fmtDate(first)} to ${fmtDate(last)}.</p>`;
  return intro + mGlance(I.glance, "At a glance") + mYears(I) + mTastes(I) + mGenres(I) + mPeople(I) + mCrowd(I) + mReviewInsights(lib, null) + mHabits(I.habits, "Habits");
}
const twoYears = (what) => `<div class="empty">${what} need diary entries from at least two years, with five or more films in each.</div>`;
const go = '<span class="go" aria-hidden="true"> ›</span>';
// a sentence that opens the data it describes
const mLines = (lines, mark) => lines.map((l) => `<div class="tline"><span class="mk ${l.dir || ""}" aria-hidden="true">${mark(l)}</span><span>${dline(l.to, esc(l.text))}</span></div>`).join("");
// a poster that opens its film
const mPosters = (items, cap) => `<div class="pgrid">${items.map((x) => `<button class="pitem" type="button" ${dl(D.film(x.f))}>${poster(x.f)}${cap(x)}</button>`).join("")}</div>`;

function mGlance(glance, title) {
  if (!glance.length) return "";
  return sh(title) + `<div class="icards">${glance.map((g) => { const inner = `<span class="k">${esc(g.k)}</span><span class="big">${esc(g.big)}</span><span class="p">${esc(g.text)}${g.to ? go : ""}</span>`;
    return g.to ? `<button class="icard" type="button" ${dl(g.to)}>${inner}</button>` : `<div class="icard">${inner}</div>`; }).join("")}</div>`;
}

function mYears(I) {
  if (I.years.length < 2) return sh("Year by year") + twoYears("Year-by-year trends");
  const mult = (title, what, value, tip, extra) => `<div class="mult"><p class="mt">${title}</p>${colChart(I.years.map((p) => ({ a: Math.max(0, value(p) || 0), b: extra ? extra(p) : 0, label: `’${p.year.slice(2)}`, tip: tip(p), to: p.entries ? yearDrill(p, what) : null })), title + " by year", "", 64)}</div>`;
  const anyPace = I.years.some((p) => p.pace && p.pace > p.films);
  const legend = anyPace ? `<div class="legend" style="margin-top:2px"><span><i style="background:var(--green-mark)"></i>Watched</span><span><i style="background:var(--blue-mark)"></i>Rest of this year at your pace</span></div>` : "";
  const rows = [...I.years].reverse().map((p) => { const cell = (what, v) => v == null ? "—" : dlink(yearDrill(p, what), v);
    return `<tr><td>${cell("entries", p.year)}</td><td class="n">${cell("films", fmtN(p.films))}${p.pace ? ` <span class="dim">→${fmtN(p.pace)}</span>` : ""}</td><td class="n">${cell("hours", fmtN(Math.round(p.hours)))}</td>
    <td class="n">${cell("rating", p.avgRating ? p.avgRating.toFixed(2) : null)}</td><td class="n">${cell("nonEnglish", p.nonEnglish != null ? p.nonEnglish + "%" : null)}</td>
    <td>${p.topGenre ? dlink(D.films(`${p.topGenre[0]} in ${p.year}`, filmsSub(p.F.filter(hasGenre(p.topGenre[0]))), p.F.filter(hasGenre(p.topGenre[0])), { scope: p.year }), esc(p.topGenre[0])) : "—"}</td>
    <td>${p.topDirector && p.topDirector[1] > 1 ? dlink(personDrill(state.lib, p.topDirector[0], "d", p.F), esc(p.topDirector[0])) : "—"}</td></tr>`; }).join("");
  return sh("Year by year") + legend + `<div class="mults">
    ${mult("Films", "films", (p) => p.films, (p) => `${p.year}: ${plural(p.films, "film")}${p.pace ? `, on pace for about ${fmtN(p.pace)}` : ""}`, (p) => p.pace && p.pace > p.films ? p.pace - p.films : 0)}
    ${mult("Hours", "hours", (p) => Math.round(p.hours), (p) => `${p.year}: ${fmtN(Math.round(p.hours))} hours`)}
    ${mult("Average rating", "rating", (p) => p.avgRating, (p) => `${p.year}: ${p.avgRating ? starsNum(p.avgRating) : "no ratings"}`)}
    ${mult("Film age when watched", "age", (p) => p.age, (p) => `${p.year}: ${p.age != null ? Math.round(p.age) + " years old on average" : "—"}`)}
    ${mult("Not in English (%)", "nonEnglish", (p) => p.nonEnglish, (p) => `${p.year}: ${p.nonEnglish != null ? p.nonEnglish + "%" : "not enough details"}`)}
    ${mult("Rewatches (%)", "rewatches", (p) => pctOf(p.rewatches, p.entries), (p) => `${p.year}: ${pctOf(p.rewatches, p.entries)}% of entries`)}</div>
    <div class="tscroll"><table class="mtable"><thead><tr><th>Year</th><th class="n">Films</th><th class="n">Hours</th><th class="n">Avg</th><th class="n">Not Eng.</th><th>Top genre</th><th>Top director</th></tr></thead><tbody>${rows}</tbody></table></div><p class="status">Tap any number to see what's behind it.</p>`;
}

function mTastes(I) {
  if (!I.tastes.table) return sh("Changing tastes") + twoYears("Changes in taste");
  const lines = I.tastes.lines.length ? mLines(I.tastes.lines, (l) => l.dir === "up" ? "▲" : "▼")
    : `<p style="margin:0">Your taste has held steady between your earliest and latest years.</p>`;
  const t = I.tastes.table;
  const heat = `<div class="tscroll"><table class="mtable heat"><thead><tr><th>Genre</th>${t.years.map((y) => `<th class="n">’${y.year.slice(2)}</th>`).join("")}</tr></thead>
    <tbody>${t.genres.map((g, gi) => `<tr><td>${dlink(catDrill(state.lib, g, "g"), esc(g))}</td>${t.years.map((y) => { const v = y.shares[gi], fs = y.p.F.filter(hasGenre(g));
      return `<td class="n" style="background:color-mix(in srgb, var(--green-mark) ${v == null ? 0 : Math.min(65, v * 1.5)}%, transparent)">${v == null ? "—" : dlink(fs.length && D.films(`${g} in ${y.year}`, filmsSub(fs, `${v}% of the year's films`), fs, { scope: y.year }), v)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="status">Percent of each year's films in the genre. Tap one to see those films.</p>`;
  return sh("Changing tastes") + lines + heat;
}

function mGenres(I) {
  if (!I.genres.length) return sh("Genres") + needMeta();
  const max = Math.max(0.5, ...I.genres.map((g) => Math.abs(g.vsCrowd || 0)), ...I.genres.map((g) => Math.abs(g.vsMe)));
  const bar = (d) => d == null ? `<span class="dim">—</span>` : `<span class="dbar" aria-hidden="true"><span class="mid"></span><span class="fill ${d >= 0 ? "pos" : "neg"}" style="width:${Math.min(50, Math.abs(d) / max * 50).toFixed(1)}%"></span></span>`;
  const lines = mLines(I.genreLines, () => "●");
  const rows = I.genres.map((g) => `<button class="grow" type="button" data-list="${reg(g.name, `${plural(g.count, "film")} · ${g.mine.toFixed(2)} average`, g.films)}">
    <span style="min-width:0"><span class="nm">${esc(g.name)}</span><span class="sub">${plural(g.count, "film")} · ★ ${g.mine.toFixed(2)}</span></span>
    <span class="gcol">${bar(g.vsMe)}<span class="v">${signed(g.vsMe)}</span></span><span class="gcol">${bar(g.vsCrowd)}<span class="v">${g.vsCrowd == null ? "" : signed(g.vsCrowd)}</span></span>${CHEV}</button>`).join("");
  return sh("Genres") + lines + `<div class="ghead"><span></span><span>vs your avg</span><span>vs ${esc(I.crowd.short)}</span><span></span></div>${rows}
    <div class="legend" style="margin-top:8px"><span><i style="background:var(--green-mark)"></i>Higher</span><span><i style="background:var(--blue-mark)"></i>Lower</span><span>in stars</span></div>`;
}

function mPeople(I) {
  const P = I.people;
  const row = (p, i, value, sub, to) => `<button class="prow" type="button" data-list="${to ? drill(to) : reg(p.name, sub(p), p.films, p)}">
    <span class="rk">${i + 1}</span>${avatar(p, "md")}<span style="min-width:0"><span class="nm" style="display:block">${esc(p.name)}</span><span class="sub">${esc(sub(p))}</span></span>
    <span class="val">${value}</span>${CHEV}</button>`;
  const obs = [...P.obsDirectors.map((p) => ({ ...p, role: "Director" })), ...P.obsActors.map((p) => ({ ...p, role: "Actor" }))].sort((a, b) => b.inLatest - a.inLatest).slice(0, 6);
  const comp = [...P.compDirectors.map((p) => ({ ...p, role: "Director" })), ...P.compActors.map((p) => ({ ...p, role: "Actor" }))].sort((a, b) => b.years.size - a.years.size || b.count - a.count).slice(0, 6);
  if (!obs.length && !comp.length && !P.binges.length) return sh("People") + `<div class="empty">People trends need cast &amp; crew details and a few years of diary.</div>`;
  let html = "";
  if (obs.length) html += sh(`New in ${I.latest}`) + obs.map((p, i) => row(p, i, `${p.inLatest}`, (q) => `${q.role} · ${plural(q.inLatest, "film")} in ${I.latest}, none before`)).join("");
  if (comp.length) html += sh("Long-time companions") + comp.map((p, i) => row(p, i, `${p.years.size}y`, (q) => `${q.role} · ${plural(q.years.size, "year")} of your diary`)).join("");
  if (P.binges.length) html += sh("Director binges") + P.binges.map((p, i) => row(p, i, `${p.binge.n}`, (q) => `${q.binge.n} films, ${fmtDate(q.binge.from)} – ${fmtDate(q.binge.to)}`,
    D.entries(`${p.name} binge`, `${p.binge.n} films, ${fmtDate(p.binge.from)} – ${fmtDate(p.binge.to)}`, p.binge.entries, { order: "asc", person: p }))).join("");
  if (P.discoveries.length >= 2) html += sh("Directors discovered each year") +
    colChart(P.discoveries.map((d) => ({ a: d.count, b: 0, label: `’${d.year.slice(2)}`, tip: `${d.year}: ${plural(d.count, "new director")}`,
      to: d.count && D.names(`Directors new in ${d.year}`, plural(d.count, "director"), d.people, { faces: true }) })), "New directors by year", "", 64);
  return html;
}

function mCrowd(I) {
  const C = I.crowd;
  const toggles = `<div class="toggles">${Object.entries(CROWDS).map(([k, c]) => (C.available[k] || 0) >= 5 || k === C.key
    ? `<button class="toggle" type="button" data-crowdsel="${k}" aria-pressed="${k === C.key}">${c.short}</button>` : "").join("")}</div>`;
  if (C.n < 5) {
    const why = IN_VIEWER ? `Crowd scores come from TMDB and OMDb, which pages inside Claude can't reach. Open <a href="https://sjnift.github.io/credits-roll/" target="_blank" rel="noopener">the web version</a>.`
      : C.key === "tmdb" ? "Crowd scores come with TMDB details. Look your films up in the Import tab."
      : C.key === "letterboxd" ? "Letterboxd averages need an Apify token, added in the Import tab." : "IMDb and critics' scores need a free OMDb key, added in the Import tab.";
    return sh("Against the crowd") + toggles + `<div class="empty">${why}</div>`;
  }
  const cap = (p) => `<span class="pmeta"><span class="stars">${stars(p.you)}</span></span><span class="mdate">${C.short} ${crowdScore(C.key, p.crowd)} · <b class="dv">${signed(p.diff)}★</b></span>`;
  let html = sh("Against the crowd") + toggles + `<p class="lead">You give ${Math.abs(C.meanDiff).toFixed(2)}★ ${C.meanDiff >= 0 ? "more" : "less"} than ${esc(C.label)} on average${followText(C.r)}, across ${dlink(C.to, plural(C.n, "film"))}.</p>`;
  html += sh(`Liked more than ${esc(C.short)}`) + (C.higher.length ? mPosters(C.higher, cap) : `<div class="empty">No film you rated ¾★ or more above them.</div>`);
  html += sh(`Liked less than ${esc(C.short)}`) + (C.lower.length ? mPosters(C.lower, cap) : `<div class="empty">No film you rated ¾★ or more below them.</div>`);
  if (C.gems.length) html += sh("Hidden gems") + `<p class="status" style="margin:-2px 0 10px">Rated 4½★ or more by you, and by few others.</p>` +
    mPosters(C.gems, (g) => `<span class="pmeta"><span class="stars">${stars(g.f.rating)}</span></span><span class="mdate">${fmtN(g.pop.n)} ${g.pop.src} votes</span>`);
  return html;
}

function mHabits(habits, title) {
  if (!habits.length) return "";
  return sh(title) + `<div class="facts" style="margin-top:0">${habits.map((h) => { const inner = `<span class="k">${esc(h.k)}</span><span class="v">${esc(h.v)}</span><span class="t">${esc(h.text)}${h.to ? go : ""}</span>`;
    return h.to ? `<button class="fact" type="button" ${dl(h.to)}>${inner}</button>` : `<div class="fact">${inner}</div>`; }).join("")}</div>`;
}

/* ----- one year ----- */
function mYearInsights(Y) {
  const lib = state.lib;
  const R = computeYearInsights(lib, metaOf, Y, state.crowd || defaultCrowd(lib, metaOf));
  const prevY = String(+Y - 1), first = R.firstYear === Y;
  let h = `<p class="status" style="margin:14px 0 0">${dlink(DR.films(R.S), plural(R.S.films.length, "film"))} and ${dlink(DR.diary(R.S), plural(R.S.entries.length, "diary entry", "diary entries"))} in ${esc(Y)}.</p>` +
    (R.S.entries.length ? `<button class="btn block" type="button" ${dl(D.share(Y))} style="margin-top:12px">Share ${esc(Y)} as an image</button>` : "");
  h += mGlance(R.glance, `${esc(Y)} at a glance`);
  h += sh(`Against ${prevY}`) + (R.changes.length ? `<div class="tscroll" style="margin-top:0"><table class="mtable"><thead><tr><th></th><th class="n">${esc(Y)}</th><th class="n">${prevY}</th><th class="n"></th></tr></thead>
    <tbody>${R.changes.map((c) => `<tr><td>${dlink(c.to, c.label)}</td><td class="n">${dlink(c.to.groups[0], c.now)}</td><td class="n">${dlink(c.to.groups[1], c.before)}</td><td class="n dim">${Math.abs(c.d) < 1e-9 ? "=" : c.d > 0 ? "▲" : "▼"}</td></tr>`).join("")}</tbody></table></div><p class="status">Tap any number to see what's behind it.</p>` +
    mLines(R.genreLines, (l) => l.dir === "up" ? "▲" : "▼")
    : `<div class="empty">No diary entries in ${prevY} to compare with.</div>`);
  const months = MONTHS.map((m, i) => {
    const key = `${Y}-${String(i + 1).padStart(2, "0")}`, es = R.S.entries.filter((e) => e.date.startsWith(key)), b = es.filter((e) => e.rewatch).length;
    return { a: es.length - b, b, label: m[0], tip: `${MONTHS_LONG[i]}: ${plural(es.length, "film")}`, to: es.length && DR.month(R.S.entries, key) };
  });
  h += sh("Month by month") + colChart(months, `Films each month of ${Y}`, "", 80);
  const cap = (x) => `<span class="pmeta"><span class="stars">${stars(x.r)}</span>${x.f.liked ? '<span class="heart">♥</span>' : ""}</span>`;
  if (R.best.length) h += sh(`Best of ${esc(Y)}`) + mPosters(R.best, cap);
  if (R.worst.length) h += sh("Lowest rated") + mPosters(R.worst, cap);
  const prow = (items, sub) => items.map((p, i) => `<button class="prow" type="button" data-list="${reg(p.name, filmsTitle(p), p.films, p)}"><span class="rk">${i + 1}</span>${avatar(p, "md")}
    <span style="min-width:0"><span class="nm" style="display:block">${esc(p.name)}</span><span class="sub">${sub}</span></span><span class="val">${p.count}</span>${CHEV}</button>`).join("");
  if (R.topDirectors.length) h += sh(`Directors of ${esc(Y)}`) + prow(R.topDirectors.slice(0, 5), `films in ${esc(Y)}`);
  if (R.topActors.length) h += sh(`Actors of ${esc(Y)}`) + prow(R.topActors.slice(0, 5), `films in ${esc(Y)}`);
  if (!first && R.discDirectors.length) h += sh(`New directors in ${esc(Y)}`) + prow(R.discDirectors.slice(0, 5), "first time in your diary");
  const newOnes = (label, list, field) => list.length ? `${label}: ${list.map((v) => { const fs = R.S.films.filter((f) => { const m = metaOf(f); return m && (field === "l" ? m.l === v : m[field].includes(v)); });
    return dlink(D.films(`${v} in ${Y}`, filmsSub(fs), fs, { scope: Y }), esc(v)); }).join(", ")}.` : "";
  if (!first && (R.newCountries.length || R.newLangs.length)) h += `<p class="lead">${newOnes("New countries", R.newCountries, "k")} ${newOnes("New languages", R.newLangs, "l")}</p>`;
  const C = R.crowd;
  if (C.n >= 3) {
    const ccap = (p) => `<span class="pmeta"><span class="stars">${stars(p.you)}</span></span><span class="mdate">${C.short} ${crowdScore(C.key, p.crowd)} · <b class="dv">${signed(p.diff)}★</b></span>`;
    const cg = (items) => items.length ? mPosters(items, ccap) : `<div class="empty">None.</div>`;
    const crowdTo = crowdDrill(R.rated.map((x) => x.f), C.key, `${Y} against ${C.label}`, R.ratingAt);
    h += sh(`You vs ${esc(C.short)} in ${esc(Y)}`) + `<p class="lead">You gave ${Math.abs(C.meanDiff).toFixed(2)}★ ${C.meanDiff >= 0 ? "more" : "less"} than ${esc(C.label)} on average, across ${dlink(crowdTo, plural(C.n, "film"))}.</p>` +
      `<p class="status" style="margin:10px 0 6px">You liked more</p>` + cg(C.higher) + `<p class="status" style="margin:14px 0 6px">You liked less</p>` + cg(C.lower);
  }
  h += mReviewInsights(lib, Y);
  h += mHabits(R.habits, `Habits in ${esc(Y)}`);
  return h;
}
</script>
