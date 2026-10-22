<script>
/* ---------- desktop: the Insights report ---------- */
function renderInsights() {
  const lib = state.lib;
  const I = computeInsights(lib, metaOf, state.crowd || defaultCrowd(lib, metaOf));
  LISTS = new Map();
  const first = lib.entries[0], last = lib.entries[lib.entries.length - 1];
  $("#hero-title").innerHTML = `Your <span class="accent">insights</span>`;
  $("#hero-sub").textContent = first ? `Patterns across ${plural(I.years.length, "year")} of your diary, ${fmtDate(first.date)} to ${fmtDate(last.date)}, and every film you've logged.` : "Insights come from your diary dates, and this diary has none yet.";
  $("#insights").innerHTML = [
    section("i-glance", "At a glance", "The strongest patterns in your diary.", glanceBlock(I)),
    section("i-years", "Year by year", "By the year you watched, from diary dates.", yearsBlock(I)),
    section("i-tastes", "Changing tastes", I.usable.length >= 2 ? `Your earliest years against your latest.` : "", tastesBlock(I)),
    section("i-genres", "Genres", "How much you watch each genre, and how you rate it.", genresBlock(I)),
    section("i-people", "People", "Directors and actors across your years of watching.", peopleInsights(I)),
    section("i-crowd", "Against the crowd", "Where your ratings part ways with everyone else's.", crowdBlock(I)),
    section("i-habits", "Habits", "When and how you watch.", habitsBlock(I)),
  ].join("");
}
const needYears = (what) => `<div class="empty">${what} need diary entries from at least two years, with five or more films in each.</div>`;

function glanceBlock(I) {
  if (!I.glance.length) return `<div class="empty">Not enough diary entries for insights yet.</div>`;
  return `<div class="glance">${I.glance.map((g) => `<div class="gcard"><span class="k">${esc(g.k)}</span><span class="big">${esc(g.big)}</span><p>${esc(g.text)}</p></div>`).join("")}</div>`;
}

function yearsBlock(I) {
  if (I.years.length < 2) return needYears("Year-by-year trends");
  const yr = (p) => `’${p.year.slice(2)}`;
  const mult = (title, value, tip, extra) => {
    const cols = I.years.map((p) => ({ a: Math.max(0, value(p) || 0), b: extra ? extra(p) : 0, label: yr(p), tip: tip(p) }));
    return `<div class="mult"><h3>${title}</h3>${colChart(cols, title + " by year", "", 90)}</div>`;
  };
  const anyPace = I.years.some((p) => p.pace && p.pace > p.films);
  const legend = anyPace ? `<div class="legend"><span><i style="background:var(--gold)"></i>Watched</span><span><i style="background:var(--lilac)"></i>Rest of this year at your current pace</span></div>` : "";
  const charts = `<div class="mults">
    ${mult("Films", (p) => p.films, (p) => `${p.year}: ${plural(p.films, "film")}${p.pace ? `, on pace for about ${fmtN(p.pace)}` : ""}`, (p) => p.pace && p.pace > p.films ? p.pace - p.films : 0)}
    ${mult("Hours", (p) => Math.round(p.hours), (p) => `${p.year}: ${fmtN(Math.round(p.hours))} hours`)}
    ${mult("Average rating", (p) => p.avgRating, (p) => `${p.year}: ${p.avgRating ? starsNum(p.avgRating) : "no ratings"}`)}
    ${mult("Film age when watched (years)", (p) => p.age, (p) => `${p.year}: films were ${p.age != null ? Math.round(p.age) : "—"} years old on average`)}
    ${mult("Not in English (%)", (p) => p.nonEnglish, (p) => `${p.year}: ${p.nonEnglish != null ? p.nonEnglish + "%" : "not enough details"}`)}
    ${mult("Rewatches (%)", (p) => pctOf(p.rewatches, p.entries), (p) => `${p.year}: ${pctOf(p.rewatches, p.entries)}% of entries`)}
  </div>`;
  const rows = [...I.years].reverse().map((p) => `<tr><td>${p.year}${p.pace ? ` <span class="muted">(pace ${fmtN(p.pace)})</span>` : ""}</td>
    <td class="n">${fmtN(p.films)}</td><td class="n">${fmtN(Math.round(p.hours))}</td><td class="n">${p.avgRating ? p.avgRating.toFixed(2) : "—"}</td>
    <td class="n">${p.newShare != null ? p.newShare + "%" : "—"}</td><td class="n">${p.nonEnglish != null ? p.nonEnglish + "%" : "—"}</td><td class="n">${p.countries || "—"}</td>
    <td>${p.topGenre ? esc(p.topGenre[0]) : "—"}</td><td>${p.topDirector && p.topDirector[1] > 1 ? `${esc(p.topDirector[0])} <span class="muted">${p.topDirector[1]}</span>` : "—"}</td>
    <td>${p.topActor && p.topActor[1] > 1 ? `${esc(p.topActor[0])} <span class="muted">${p.topActor[1]}</span>` : "—"}</td></tr>`).join("");
  return legend + charts + `<div class="tbl-wrap"><table class="data"><thead><tr><th>Year</th><th class="n">Films</th><th class="n">Hours</th><th class="n">Avg ★</th>
    <th class="n">New releases</th><th class="n">Not English</th><th class="n">Countries</th><th>Top genre</th><th>Top director</th><th>Top actor</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function tastesBlock(I) {
  if (!I.tastes.table) return needYears("Changes in taste");
  const lines = I.tastes.lines.length ? `<ul class="trend-lines">${I.tastes.lines.map((l) => `<li><span class="mk" aria-hidden="true">${l.dir === "up" ? "▲" : "▼"}</span><span>${esc(l.text)}</span></li>`).join("")}</ul>`
    : `<p class="lead">Your taste has held steady: no genre, language or rating habit moved much between your earliest and latest years.</p>`;
  const t = I.tastes.table;
  const heat = `<div class="tbl-wrap"><table class="data heat"><caption class="sr-only">Share of each year's films in each genre</caption>
    <thead><tr><th>Genre</th>${t.years.map((y) => `<th class="n">${y.year}</th>`).join("")}</tr></thead>
    <tbody>${t.genres.map((g, gi) => `<tr><td>${esc(g)}</td>${t.years.map((y) => { const v = y.shares[gi];
      return `<td class="n cell" style="background:color-mix(in srgb, var(--gold) ${v == null ? 0 : Math.min(70, v * 1.6)}%, transparent)">${v == null ? "—" : v + "%"}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="status">Share of each year's films in the genre. A film can have several genres.</p>`;
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
  const lines = I.genreLines.length ? `<ul class="trend-lines">${I.genreLines.map((t) => `<li><span class="mk" aria-hidden="true">●</span><span>${esc(t)}</span></li>`).join("")}</ul>` : "";
  const rows = I.genres.map((g) => `<tr><td><button class="linkish" type="button" data-list="${reg(g.name, `${plural(g.count, "film")} · ${g.mine.toFixed(2)} average`, g.films)}">${esc(g.name)}</button></td>
    <td class="n">${fmtN(g.count)}</td><td class="n">${g.share}%</td><td class="n">${g.mine.toFixed(2)}</td><td>${divBar(g.vsMe, max)}</td><td>${divBar(g.vsCrowd, max)}</td></tr>`).join("");
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
  const binge = widthBy(P.binges.map((p) => ({ ...p })), (p) => p.binge.n);
  const disc = P.discoveries.length >= 2 ? `<div><h3>Directors discovered each year</h3>${colChart(P.discoveries.map((d) => ({ a: d.count, b: 0, label: `’${d.year.slice(2)}`, tip: `${d.year}: ${plural(d.count, "new director")}` })), "New directors by year", "", 90)}
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
      : C.key === "imdb" || C.key === "critics" ? "IMDb and critics' scores come from OMDb. Add a free OMDb key in the Cast &amp; crew box on the stats page."
      : "Crowd scores come with TMDB details. Look your films up from the Cast &amp; crew box on the stats page.";
    return tabs + `<div class="empty">${why}</div>`;
  }
  const lead = `<p class="lead">Across ${plural(C.n, "film")} you rated, you give ${Math.abs(C.meanDiff).toFixed(2)}★ ${C.meanDiff >= 0 ? "more" : "less"} than ${esc(C.label)} on average${followText(C.r)}.</p>`;
  const cap = (p) => `<div class="cap"><span class="stars">${stars(p.you)}</span>
    <span class="muted">${esc(C.short)} ${(p.crowd * 2).toFixed(1)} · <b class="diff">${signed(p.diff)}★</b></span></div>`;
  const row = (items, empty) => items && items.length ? `<div class="posters">${items.map((p) => `<div class="poster" title="You: ${p.you}★ · ${esc(C.label)}: ${(p.crowd * 2).toFixed(1)} out of 10">${artHtml(p.f)}${cap(p)}</div>`).join("")}</div>` : `<div class="empty">${empty}</div>`;
  const gems = C.gems.length ? `<h3>Hidden gems</h3><p class="status">Films you rated 4½★ or more that few people have rated.</p>
    <div class="posters">${C.gems.map((g) => `<div class="poster">${artHtml(g.f)}<div class="cap"><span class="stars">${stars(g.f.rating)}</span><span class="muted">${fmtN(g.pop.n)} ${g.pop.src} votes</span></div></div>`).join("")}</div>` : "";
  return tabs + lead + `<div class="crowd">
    <h3>You liked more than ${esc(C.label)}</h3>${row(C.higher, "No film you rated ¾★ or more above them.")}
    <h3>You liked less than ${esc(C.label)}</h3>${row(C.lower, "No film you rated ¾★ or more below them.")}
    ${gems}</div>`;
}

function habitsBlock(I) {
  if (!I.habits.length) return `<div class="empty">Habits come from diary dates.</div>`;
  return `<div class="habits">${I.habits.map((h) => `<div class="habit"><span class="k">${esc(h.k)}</span><span class="v">${esc(h.v)}</span><span class="t">${esc(h.text)}</span></div>`).join("")}</div>`;
}
</script>
