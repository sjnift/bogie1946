<script>
/* ---------- phone: the Insights screen, pushed from the nav bar or Profile ---------- */
function insightsScreen() {
  const lib = state.lib;
  const I = computeInsights(lib, metaOf, state.crowd || defaultCrowd(lib, metaOf));
  if (!lib.entries.length) return `<div class="empty" style="padding-top:28px">Insights come from your diary dates, and this diary has none yet.</div>`;
  const first = lib.entries[0].date, last = lib.entries[lib.entries.length - 1].date;
  const intro = `<p class="status" style="margin:16px 0 0">Patterns across ${plural(I.years.length, "year")} of diary, ${fmtDate(first)} to ${fmtDate(last)}.</p>`;
  return intro + mGlance(I) + mYears(I) + mTastes(I) + mGenres(I) + mPeople(I) + mCrowd(I) + mHabits(I);
}
const twoYears = (what) => `<div class="empty">${what} need diary entries from at least two years, with five or more films in each.</div>`;

function mGlance(I) {
  if (!I.glance.length) return "";
  return sh("At a glance") + `<div class="icards">${I.glance.map((g) => `<div class="icard"><span class="k">${esc(g.k)}</span><span class="big">${esc(g.big)}</span><p>${esc(g.text)}</p></div>`).join("")}</div>`;
}

function mYears(I) {
  if (I.years.length < 2) return sh("Year by year") + twoYears("Year-by-year trends");
  const mult = (title, value, tip, extra) => `<div class="mult"><p class="mt">${title}</p>${colChart(I.years.map((p) => ({ a: Math.max(0, value(p) || 0), b: extra ? extra(p) : 0, label: `’${p.year.slice(2)}`, tip: tip(p) })), title + " by year", "", 64)}</div>`;
  const anyPace = I.years.some((p) => p.pace && p.pace > p.films);
  const legend = anyPace ? `<div class="legend" style="margin-top:2px"><span><i style="background:var(--green-mark)"></i>Watched</span><span><i style="background:var(--blue-mark)"></i>Rest of this year at your pace</span></div>` : "";
  const rows = [...I.years].reverse().map((p) => `<tr><td>${p.year}</td><td class="n">${fmtN(p.films)}${p.pace ? ` <span class="dim">→${fmtN(p.pace)}</span>` : ""}</td><td class="n">${fmtN(Math.round(p.hours))}</td>
    <td class="n">${p.avgRating ? p.avgRating.toFixed(2) : "—"}</td><td class="n">${p.nonEnglish != null ? p.nonEnglish + "%" : "—"}</td>
    <td>${p.topGenre ? esc(p.topGenre[0]) : "—"}</td><td>${p.topDirector && p.topDirector[1] > 1 ? esc(p.topDirector[0]) : "—"}</td></tr>`).join("");
  return sh("Year by year") + legend + `<div class="mults">
    ${mult("Films", (p) => p.films, (p) => `${p.year}: ${plural(p.films, "film")}${p.pace ? `, on pace for about ${fmtN(p.pace)}` : ""}`, (p) => p.pace && p.pace > p.films ? p.pace - p.films : 0)}
    ${mult("Hours", (p) => Math.round(p.hours), (p) => `${p.year}: ${fmtN(Math.round(p.hours))} hours`)}
    ${mult("Average rating", (p) => p.avgRating, (p) => `${p.year}: ${p.avgRating ? starsNum(p.avgRating) : "no ratings"}`)}
    ${mult("Film age when watched", (p) => p.age, (p) => `${p.year}: ${p.age != null ? Math.round(p.age) + " years old on average" : "—"}`)}
    ${mult("Not in English (%)", (p) => p.nonEnglish, (p) => `${p.year}: ${p.nonEnglish != null ? p.nonEnglish + "%" : "not enough details"}`)}
    ${mult("Rewatches (%)", (p) => pctOf(p.rewatches, p.entries), (p) => `${p.year}: ${pctOf(p.rewatches, p.entries)}% of entries`)}</div>
    <div class="tscroll"><table class="mtable"><thead><tr><th>Year</th><th class="n">Films</th><th class="n">Hours</th><th class="n">Avg</th><th class="n">Not Eng.</th><th>Top genre</th><th>Top director</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function mTastes(I) {
  if (!I.tastes.table) return sh("Changing tastes") + twoYears("Changes in taste");
  const lines = I.tastes.lines.length ? I.tastes.lines.map((l) => `<div class="tline"><span class="mk ${l.dir}" aria-hidden="true">${l.dir === "up" ? "▲" : "▼"}</span><span>${esc(l.text)}</span></div>`).join("")
    : `<p style="margin:0">Your taste has held steady between your earliest and latest years.</p>`;
  const t = I.tastes.table;
  const heat = `<div class="tscroll"><table class="mtable heat"><thead><tr><th>Genre</th>${t.years.map((y) => `<th class="n">’${y.year.slice(2)}</th>`).join("")}</tr></thead>
    <tbody>${t.genres.map((g, gi) => `<tr><td>${esc(g)}</td>${t.years.map((y) => { const v = y.shares[gi];
      return `<td class="n" style="background:color-mix(in srgb, var(--green-mark) ${v == null ? 0 : Math.min(65, v * 1.5)}%, transparent)">${v == null ? "—" : v}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="status">Percent of each year's films in the genre.</p>`;
  return sh("Changing tastes") + lines + heat;
}

function mGenres(I) {
  if (!I.genres.length) return sh("Genres") + needMeta();
  const max = Math.max(0.5, ...I.genres.map((g) => Math.abs(g.vsCrowd || 0)), ...I.genres.map((g) => Math.abs(g.vsMe)));
  const bar = (d) => d == null ? `<span class="dim">—</span>` : `<span class="dbar" aria-hidden="true"><span class="mid"></span><span class="fill ${d >= 0 ? "pos" : "neg"}" style="width:${Math.min(50, Math.abs(d) / max * 50).toFixed(1)}%"></span></span>`;
  const lines = I.genreLines.map((t) => `<div class="tline"><span class="mk" aria-hidden="true">●</span><span>${esc(t)}</span></div>`).join("");
  const rows = I.genres.map((g) => `<button class="grow" type="button" data-push="${reg(g.name, `${plural(g.count, "film")} · ${g.mine.toFixed(2)} average`, g.films)}">
    <span style="min-width:0"><span class="nm">${esc(g.name)}</span><span class="sub">${plural(g.count, "film")} · ★ ${g.mine.toFixed(2)}</span></span>
    <span class="gcol">${bar(g.vsMe)}<span class="v">${signed(g.vsMe)}</span></span><span class="gcol">${bar(g.vsCrowd)}<span class="v">${g.vsCrowd == null ? "" : signed(g.vsCrowd)}</span></span>${CHEV}</button>`).join("");
  return sh("Genres") + lines + `<div class="ghead"><span></span><span>vs your avg</span><span>vs ${esc(I.crowd.short)}</span><span></span></div>${rows}
    <div class="legend" style="margin-top:8px"><span><i style="background:var(--green-mark)"></i>Higher</span><span><i style="background:var(--blue-mark)"></i>Lower</span><span>in stars</span></div>`;
}

function mPeople(I) {
  const P = I.people;
  const row = (p, i, value, sub) => `<button class="prow" type="button" data-push="${reg(p.name, sub(p), p.films, p)}">
    <span class="rk">${i + 1}</span>${avatar(p, "md")}<span style="min-width:0"><span class="nm" style="display:block">${esc(p.name)}</span><span class="sub">${esc(sub(p))}</span></span>
    <span class="val">${value}</span>${CHEV}</button>`;
  const obs = [...P.obsDirectors.map((p) => ({ ...p, role: "Director" })), ...P.obsActors.map((p) => ({ ...p, role: "Actor" }))].sort((a, b) => b.inLatest - a.inLatest).slice(0, 6);
  const comp = [...P.compDirectors.map((p) => ({ ...p, role: "Director" })), ...P.compActors.map((p) => ({ ...p, role: "Actor" }))].sort((a, b) => b.years.size - a.years.size || b.count - a.count).slice(0, 6);
  if (!obs.length && !comp.length && !P.binges.length) return sh("People") + `<div class="empty">People trends need cast &amp; crew details and a few years of diary.</div>`;
  let html = "";
  if (obs.length) html += sh(`New in ${I.latest}`) + obs.map((p, i) => row(p, i, `${p.inLatest}`, (q) => `${q.role} · ${plural(q.inLatest, "film")} in ${I.latest}, none before`)).join("");
  if (comp.length) html += sh("Long-time companions") + comp.map((p, i) => row(p, i, `${p.years.size}y`, (q) => `${q.role} · ${plural(q.years.size, "year")} of your diary`)).join("");
  if (P.binges.length) html += sh("Director binges") + P.binges.map((p, i) => row(p, i, `${p.binge.n}`, (q) => `${q.binge.n} films, ${fmtDate(q.binge.from)} – ${fmtDate(q.binge.to)}`)).join("");
  if (P.discoveries.length >= 2) html += sh("Directors discovered each year") +
    colChart(P.discoveries.map((d) => ({ a: d.count, b: 0, label: `’${d.year.slice(2)}`, tip: `${d.year}: ${plural(d.count, "new director")}` })), "New directors by year", "", 64);
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
  const grid = (items) => `<div class="pgrid">${items.map((p) => `<div class="pitem" title="You ${p.you}★ · ${C.label} ${crowdScore(C.key, p.crowd)}">${poster(p.f)}
    <span class="pmeta"><span class="stars">${stars(p.you)}</span></span><span class="mdate">${C.short} ${crowdScore(C.key, p.crowd)} · <b class="dv">${signed(p.diff)}★</b></span></div>`).join("")}</div>`;
  let html = sh("Against the crowd") + toggles + `<p class="lead">You give ${Math.abs(C.meanDiff).toFixed(2)}★ ${C.meanDiff >= 0 ? "more" : "less"} than ${esc(C.label)} on average${followText(C.r)}, across ${plural(C.n, "film")}.</p>`;
  html += sh(`Liked more than ${esc(C.short)}`) + (C.higher.length ? grid(C.higher) : `<div class="empty">No film you rated ¾★ or more above them.</div>`);
  html += sh(`Liked less than ${esc(C.short)}`) + (C.lower.length ? grid(C.lower) : `<div class="empty">No film you rated ¾★ or more below them.</div>`);
  if (C.gems.length) html += sh("Hidden gems") + `<p class="status" style="margin:-2px 0 10px">Rated 4½★ or more by you, and by few others.</p><div class="pgrid">${C.gems.map((g) => `<div class="pitem">${poster(g.f)}
    <span class="pmeta"><span class="stars">${stars(g.f.rating)}</span></span><span class="mdate">${fmtN(g.pop.n)} ${g.pop.src} votes</span></div>`).join("")}</div>`;
  return html;
}

function mHabits(I) {
  if (!I.habits.length) return "";
  return sh("Habits") + `<div class="facts" style="margin-top:0">${I.habits.map((h) => `<div class="fact"><span class="k">${esc(h.k)}</span><span class="v">${esc(h.v)}</span><span class="t">${esc(h.text)}</span></div>`).join("")}</div>`;
}
</script>
