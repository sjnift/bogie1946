<script>
/* ---------- section helpers ---------- */
function section(id, role, hint, body) {
  return `<section class="credit" id="${id}" aria-labelledby="${id}-h"><div class="role"><h2 id="${id}-h">${role}</h2>${hint ? `<div class="hint">${hint}</div>` : ""}</div><div class="credit-body">${body}</div></section>`;
}
function tabs(group, items, current) {
  return `<div class="tabs" role="tablist">${items.map(([v, label]) =>
    `<button class="tab" role="tab" type="button" data-tab="${group}" data-val="${v}" aria-selected="${v === current}">${label}</button>`).join("")}</div>`;
}
function faceHtml(p, rank) {
  const ph = showImages && PHOTOS[p.key];
  return `<div class="face"><span class="initials" aria-hidden="true">${esc(initials(p.name))}</span>${ph ? `<img src="${IMG}${esc(ph)}" alt="" loading="lazy">` : ""}${rank ? `<span class="rank">${rank}</span>` : ""}</div>`;
}
const emptyMeta = () => `<div class="empty">Cast and crew aren't part of the Letterboxd export. Fill them in from <button class="linkish" type="button" data-goto="settings">Settings</button>.</div>`;
function rankRows(list, valueOf, widthOf, startRank, titleOf) {
  return `<ol class="rank-list${list.some((p) => p.group) ? " tied-list" : ""}">${list.map((p, i) => `<li><button class="rank-row${p.group ? " tied" : ""}" type="button" data-list="${p.to ? drill(p.to) : reg(p.name, titleOf(p), p.films, p)}">
    <span class="r">${p.rank ?? startRank + i}</span><span class="n">${esc(p.name)}${p.also ? ` <span class="also">${esc(p.also)}</span>` : ""}</span>
    <span class="track" aria-hidden="true"><span style="width:${Math.max(1, widthOf(p) * 100).toFixed(1)}%"></span></span>
    <span class="v">${valueOf(p)}</span></button></li>`).join("")}</ol>`;
}
// A run of four or more with the same count becomes one row ("12 actors with 3 films each", opening them all)
// instead of a column of identical bars. Ranks run from `start`.
function foldTies(list, countOf, start, group) {
  const out = [];
  for (let i = 0; i < list.length;) {
    let j = i;
    while (j < list.length && countOf(list[j]) === countOf(list[i])) j++;
    if (j - i >= 4) {
      const xs = list.slice(i, j), n = countOf(list[i]);
      out.push({ ...group(xs, n), group: xs, count: n, rank: `${start + i}–${start + j - 1}`, also: `${xs.slice(0, 3).map((x) => x.name).join(", ")}…` });
    } else for (let k = i; k < j; k++) out.push({ ...list[k], rank: start + k });
    i = j;
  }
  return out;
}
const peopleTies = (label) => (xs, n) => ({ name: `${fmtN(xs.length)} ${label} with ${plural(n, "film")} each`, to: D.names(`${fmtN(xs.length)} ${label} with ${plural(n, "film")} each`, "Most watched first", xs, { faces: true }) });

/* ---------- section bodies ---------- */
/* ---------- the chapters shown in full (asked Oct 2026): People, Genres & countries, When you watch, Ratings ---------- */
// How your ratings spread across half-stars.
function ratingBlock(s) {
  if (!s.rated) return `<div class="empty">No rated films in this period.</div>`;
  const cols = s.spread.map((x) => ({ a: x.count, b: 0, label: x.r === 0.5 ? "½" : x.r % 1 ? "" : `${x.r}★`, tip: `${stars(x.r)} · ${plural(x.count, "film")}`, to: x.count && DR.rating(s.films, x.r) }));
  const most = s.spread.reduce((a, b) => b.count > a.count ? b : a);
  const facts = [
    ["Average", dlink(DR.rated(s), `${s.avgRating.toFixed(2)} of 5`)], ["Given most", dlink(DR.rating(s.films, most.r), `${stars(most.r)} · ${plural(most.count, "time")}`)],
    ["Rated films", dlink(DR.rated(s), fmtN(s.rated))], ["Five stars", dlink(s.spread[9].count && DR.rating(s.films, 5), plural(s.spread[9].count, "film"))],
  ].map(([k, v]) => `<div class="fact"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("");
  return `<div class="facts">${facts}</div>${colChart(cols, "How many films you gave each rating", "", 162, { unit: "films" })}`;
}
// The films watched most often in the period, ties of four or more folded into one row.
function rewatchedBlock(s) {
  const views = viewsOf(s), re = s.films.filter((f) => views(f) > 1).sort((a, b) => views(b) - views(a) || (b.rating || 0) - (a.rating || 0));
  if (!re.length) return "";
  const reRows = foldTies(re.map((f) => ({ name: `${f.name}${f.year ? ` (${f.year})` : ""}`, f, films: [f], count: views(f), to: D.film(f) })), (p) => p.count, 1,
    (xs, n) => ({ name: `${fmtN(xs.length)} films seen ${n} times`, to: D.films(`Seen ${n} times`, filmsSub(xs.map((x) => x.f)), xs.map((x) => x.f), { scope: s.scope, sort: "given" }) })).slice(0, 8);
  return rankRows(reRows, (p) => p.group ? `${p.count} viewings each` : `${p.count} viewings`, (p) => p.count / views(re[0]), 1, (p) => plural(p.count, "viewing"));
}
// Your highest-rated films, then the lowest, 2½★ and under, lowest first.
function bestWorstBlock(s) {
  const views = viewsOf(s);
  const top = s.films.filter((f) => f.rating).sort((a, b) => b.rating - a.rating || views(b) - views(a) || (b.year || 0) - (a.year || 0));
  const low = s.films.filter((f) => f.rating && f.rating <= 2.5).sort((a, b) => a.rating - b.rating || views(b) - views(a) || a.name.localeCompare(b.name));
  if (!top.length) return `<div class="empty">No rated films in this period.</div>`;
  return posterRow("Highest rated", top, D.films("Highest rated", filmsSub(top), top, { scope: s.scope, sort: "given" }), posterHtml)
    + (low.length ? posterRow("Lowest rated", low, D.films("Lowest rated", filmsSub(low, "2½★ and under"), low, { scope: s.scope, sort: "given" }), posterHtml) : "");
}
// A heading, one row of seven posters, and the whole list a click away when there's more (the owner's trim, Oct 2026).
const ROW_N = 7;
const posterRow = (title, items, to, draw) => `<h3 class="sub-h row-h"><span>${title}</span>${items.length > ROW_N ? dlink(to, `See all ${fmtN(items.length)} ›`) : ""}</h3>
  <div class="posters one-row">${items.slice(0, ROW_N).map(draw).join("")}</div>`;
// How many rows go under the twelve faces, the same for Most watched and Highest rated so switching doesn't move the
// page (the owner's trim, Oct 2026): actors down to the 21st; directors down to their first row of ties (when it
// comes before the 21st), the rest of the ties and everyone else behind "Show more".
const PEOPLE_TO = 21;
function peopleRowsShown(kind, data) {
  const rows = foldTies(data.most.slice(12), (p) => p.count, 13, peopleTies(kind === "cast" ? "actors" : kind === "voices" ? "voice actors" : "directors"));
  const upTo = rows.filter((r) => parseInt(r.rank, 10) <= PEOPLE_TO).length, tie = rows.findIndex((r) => r.group);
  return kind === "directors" && tie >= 0 ? Math.min(tie + 1, upTo) : upTo;
}
function peopleBlock(kind, data, s) {
  const t = state.tab[kind];
  const list = t === "most" ? data.most : data.best;
  if (!list.length) return `<div class="empty">${t === "best" ? `Nobody here has ${kind === "cast" ? s.castMinRated : s.minRated} or more rated films yet.` : kind === "voices" ? "No voice roles in this period." : "Nobody to show for this period."}</div>`;
  const top = list.slice(0, 12);
  const cards = top.map((p, i) => `<button class="person" type="button" data-list="${reg(p.name, personSub(p), p.films, p)}">
    ${faceHtml(p, i + 1)}<span class="nm">${esc(p.name)}</span>
    <span class="ct">${t === "most" ? plural(p.count, "film") : `<span class="stars">★</span> ${p.avg.toFixed(2)} · ${plural(p.ratings.length, "film")}`}</span></button>`).join("");
  const limit = state.more[kind] ? 60 : peopleRowsShown(kind, data); // rows below the cards
  const all = t === "most" ? foldTies(list.slice(12), (p) => p.count, 13, peopleTies(kind === "cast" ? "actors" : kind === "voices" ? "voice actors" : "directors")) : list.slice(12).map((p, i) => ({ ...p, rank: 13 + i }));
  const rest = all.slice(0, limit);
  const max = list[0].count;
  const rows = rest.length ? rankRows(rest,
    (p) => t === "most" ? (p.group ? `${plural(p.count, "film")} each` : plural(p.count, "film")) : p.avg.toFixed(2),
    (p) => t === "most" ? p.count / max : p.avg / 5, 13, personSub) : "";
  const moreBtn = state.more[kind] ? `<div><button class="btn small" type="button" data-less="${kind}">Show less</button></div>`
    : all.length > limit ? `<div><button class="btn small" type="button" data-more="${kind}">Show more</button></div>` : "";
  return `<div class="people">${cards}</div><div class="people-rows">${rows}</div>${moreBtn}`;
}
function catBlock(s) {
  const t = state.tab.cats;
  const col = (title, data, unit) => {
    const list = (t === "most" ? data.most : data.best).slice(0, 10);
    if (!list.length) return `<div><h3>${title}</h3><div class="empty">${t === "best" ? "Needs 3+ rated films each." : "Nothing yet."}</div></div>`;
    const max = list[0].count;
    return `<div><h3>${title}</h3>${rankRows(list, (c) => t === "most" ? fmtN(c.count) : c.avg.toFixed(2),
      (c) => t === "most" ? c.count / max : c.avg / 5, 1, (c) => `${plural(c.count, "film")}${c.avg ? ` · ${c.avg.toFixed(2)} average` : ""}`)
      .replace(/class="rank-row"/g, 'class="rank-row cat"').replace(/<span class="r">\d+<\/span>/g, "")}</div>`;
  };
  return tabs("cats", [["most", "Most watched"], ["best", "Highest rated"]], t) +
    `<div class="cat-grid two">${col("Genres", s.genres)}${col("Languages", s.languages)}</div>`; // countries: on the map below
}
// Writers, cinematographers and composers side by side, five each, the rest a click away (the owner's trim, Oct 2026:
// it was one list of fifteen behind three tabs).
const CREW_N = 5;
function crewBlock(s) {
  const best = state.tab.crewSort === "best";
  const col = (title, data, label) => {
    const list = best ? data.best : data.most;
    const all = list.length > CREW_N ? dlink(D.names(best ? `${title}, highest rated` : title, best ? `${s.minRated}+ rated films each, best first` : `${fmtN(list.length)} ${label}, most watched first`, list, { faces: true }),
      `See all ${fmtN(list.length)} ›`) : "";
    const rows = !list.length ? `<div class="empty">${best ? `Needs ${s.minRated}+ rated films each.` : "Nobody yet."}</div>`
      : rankRows(list.slice(0, CREW_N), (p) => best ? p.avg.toFixed(2) : fmtN(p.count), (p) => best ? p.avg / 5 : p.count / list[0].count, 1, personSub)
        .replace(/class="rank-row"/g, 'class="rank-row cat"').replace(/<span class="r">\d+<\/span>/g, "");
    return `<div><h3 class="row-h"><span>${title}</span>${all}</h3>${rows}</div>`;
  };
  return tabs("crewSort", [["most", "Most watched"], ["best", "Highest rated"]], state.tab.crewSort)
    + `<div class="cat-grid crew-grid">${col("Written by", s.writers, "writers")}${col("Shot by", s.dop, "cinematographers")}${col("Music by", s.music, "composers")}</div>`;
}
function diaryBlock(s) {
  if (!s.entries.length) return `<div class="empty">No diary dates in this period. Films logged without a date still count everywhere else.</div>`;
  const cols = timeline(s);
  const legend = s.rewatches ? `<div class="legend"><span><i style="background:var(--gold)"></i>First watch</span><span><i style="background:var(--lilac)"></i>Rewatch</span></div>` : "";
  const unit = s.scope !== "all" ? "week" : cols.length && cols[0].key.length === 7 ? "month" : "year";
  const fav = s.weekday.indexOf(Math.max(...s.weekday));
  const bm = s.busiestMonth;
  const perUnit = s.entries.length / Math.max(1, cols.filter((c, i) => i <= cols.map((x) => x.a + x.b > 0).lastIndexOf(true)).length);
  const facts = [
    ["Busiest month", bm ? dlink(DR.month(s.entries, bm.key), `${monthName(bm.key)} · ${plural(bm.count, "film")}`) : "—"],
    ["Most in one day", s.busiestDay ? dlink(DR.day(s.entries, s.busiestDay.key), `${plural(s.busiestDay.count, "film")} · ${fmtDate(s.busiestDay.key)}`) : "—"],
    ["Longest streak", dlink(DR.streak(s), s.streak.days > 1 ? `${s.streak.days} days in a row` : "1 day")],
    ["Favourite day", dlink(DR.weekday(s.entries, fav), WEEKDAYS_LONG[fav])],
    [`Average per ${unit}`, dlink(unitsDrill(cols, unit, perUnit), perUnit.toFixed(1))],
  ].map(([k, v]) => `<div class="fact"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("");
  const wmax = Math.max(1, ...s.weekday);
  const weekdays = `<div class="weekdays" role="group" aria-label="Diary entries by day of the week">${s.weekday.map((n, i) =>
    `<button class="wd" type="button" ${dl(DR.weekday(s.entries, i))} data-tip="${WEEKDAYS_LONG[i]}: ${plural(n, "film")}" aria-label="${WEEKDAYS_LONG[i]}: ${plural(n, "film")}"><span class="cnt">${n}</span><span class="bar-v"><span style="height:${(n / wmax * 100).toFixed(1)}%"></span></span><span class="lbl">${WEEKDAYS[i]}</span></button>`).join("")}</div>`;
  const shown = cols.filter((c) => c.a + c.b), hA = hiLo(shown.map((c) => c.a)), hB = hiLo(shown.map((c) => c.b));
  const table = `<details class="tbl"><summary>View as table</summary><div class="scroll"><table class="data"><thead><tr><th>${unit[0].toUpperCase() + unit.slice(1)}</th><th class="n">First watches</th><th class="n">Rewatches</th></tr></thead><tbody>${
    shown.map((c, i) => { const first = c.es.filter((e) => !e.rewatch), again = c.es.filter((e) => e.rewatch);
      return `<tr><td>${dlink(c.to, esc(c.tipLabel))}</td><td class="n${hA[i]}">${dlink(c.a && D.entries(`${c.tipLabel}: first watches`, entriesSub(first), first, { order: "asc" }), c.a)}</td>
      <td class="n${hB[i]}">${dlink(c.b && D.entries(`${c.tipLabel}: rewatches`, entriesSub(again), again, { order: "asc" }), c.b)}</td></tr>`; }).join("")}</tbody></table></div><p class="status">${HILO_NOTE}</p></details>`;
  return `<div class="facts">${facts}</div>${colChart(cols, `Diary entries by ${unit}`, legend, 162, { unit: "films" })}${table}
    <div class="facts" style="align-items:end; gap:28px 48px"><div class="fact"><span class="k" style="margin-bottom:8px">By day of the week</span>${weekdays}</div>
    ${s.scope === "all" ? "" /* the months are in Month by month, just below (the owner's trim, Oct 2026) */
      : `<div class="fact" style="min-width:0; max-width:100%"><span class="k" style="margin-bottom:8px">Every day of ${s.scope}</span>${heatmap(s)}</div>`}</div>`;
}
// Decades with three or more rated films, best average first.
const bestDecades = (s) => s.decades.filter((x) => x.ratings.length >= 3).sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 5);
// The best-rated decade, featured near the top of the page with its best films, and the second and third best below it
// with theirs, a little smaller (the owner's call, Oct 2026).
function bestDecadeBlock(s) {
  const [top, ...next] = bestDecades(s);
  if (!top) return "";
  const when = s.scope === "all" ? "" : ` · watched in ${esc(s.scope)}`;
  const runner = (x, i) => `<div class="bd-runner"><div class="bd-rhead"><span class="eyebrow">${i ? "Third" : "Second"} best${when}</span>
      <h3 class="bd-rtitle">${dlink(DR.decade(x), `The <span class="accent">${x.decade}s</span>`)}</h3>
      <p class="muted"><span class="stars">★</span> ${x.avg.toFixed(2)} average from ${plural(x.ratings.length, "rated film")}</p></div>
    <div class="posters">${x.top.slice(0, 6).map(posterHtml).join("")}</div></div>`;
  const rest = next.slice(2, 4);
  return `<div class="best-decade"><div class="bd-head"><span class="eyebrow">Your best decade${when}</span>
      <h3 class="bd-title">${dlink(DR.decade(top), `The <span class="accent">${top.decade}s</span>`)}</h3>
      <p class="muted"><span class="stars">★</span> ${top.avg.toFixed(2)} average from ${plural(top.ratings.length, "rated film")}</p></div>
    <div class="posters">${top.top.slice(0, 8).map(posterHtml).join("")}</div></div>
    ${next.length ? `<div class="bd-runners">${next.slice(0, 2).map(runner).join("")}</div>` : ""}
    ${rest.length ? `<p class="bd-next">Then ${joinAnd(rest.map((x) => `${dlink(DR.decade(x), `the ${x.decade}s`)} <span class="muted">${x.avg.toFixed(2)}</span>`))}.</p>` : ""}`;
}
const milestoneMarks = (s) => s.scope === "all" ? [50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000] : [25, 50, 100, 150, 200, 250, 300, 365, 400, 500];
// `most`: the first, the latest and the marks just before it, one row of seven.
function milestonesBlock(s, most = ROW_N) {
  const E = s.entries;
  if (!E.length) return `<div class="empty">Milestones come from diary dates, and there are none in this period.</div>`;
  const hits = milestoneMarks(s).filter((n) => n < E.length).slice(-6).map((n) => [`${ordinal(n)} film`, E[n - 1], n]);
  const items = [[s.scope === "all" ? "First film" : `First of ${s.scope}`, E[0], 1], ...hits];
  if (E.length > 1) items.push([s.scope === "all" ? "Latest" : `Latest of ${s.scope}`, E[E.length - 1], E.length]);
  if (items.length > most) items.splice(1, items.length - most);
  const badge = (n) => `Diary entry ${fmtN(n)} of ${fmtN(E.length)}${s.scope === "all" ? "" : ` in ${s.scope}`}`;
  return `<div class="milestones">${items.map(([k, e, n]) => `<button class="poster milestone" type="button" ${dl(D.film(e.film, { entry: e, badge: `${k}: ${badge(n)}, ${fmtDate(e.date)}` }))}><span class="k">${k}</span>${artHtml(e.film)}
    <span class="cap"><span class="d">${fmtDate(e.date)}</span><span>${e.rating ? `<span class="stars">${stars(e.rating)}</span>` : ""}${e.rewatch ? `<span class="muted" title="Rewatch"> ↻<span class="sr-only">rewatch</span></span>` : ""}</span></span></button>`).join("")}</div>`;
}
// The poster itself: TMDB's image where there is one, otherwise a title card.
function artHtml(f) {
  const m = metaOf(f);
  const img = showImages && m && m.poster ? `<img src="${IMG}${esc(m.poster)}" alt="" loading="lazy">` : "";
  return `<div class="art" title="${esc(f.name)}${f.year ? ` (${f.year})` : ""}">${img}<div class="t${titleFit(f.name)}">${esc(f.name)}</div><div class="y">${f.year || ""}</div></div>`;
}
function posterHtml(f) {
  return `<button class="poster" type="button" ${dl(D.film(f))}>${artHtml(f)}
    <span class="cap"><span class="stars">${stars(f.rating)}</span>${f.liked ? ' <span class="heart" title="Liked">♥</span>' : ""}</span></button>`;
}
// How many times a film was watched in the period.
const viewsOf = (s) => (f) => viewsIn(f, s.scope);
// The records: longest, shortest, oldest, newest, and the liked films.
function recordsBlock(s) {
  const timed = s.films.filter((f) => metaOf(f) && metaOf(f).r);
  const longest = timed.reduce((a, f) => !a || metaOf(f).r > metaOf(a).r ? f : a, null);
  const shortest = timed.reduce((a, f) => !a || metaOf(f).r < metaOf(a).r ? f : a, null);
  const dated = s.films.filter((f) => f.year);
  const oldest = dated.reduce((a, f) => !a || f.year < a.year ? f : a, null);
  const newest = dated.reduce((a, f) => !a || f.year > a.year ? f : a, null);
  const facts = [
    ["Longest", longest && `${longest.name} · ${metaOf(longest).r}\u00a0min`, longest], ["Shortest", shortest && `${shortest.name} · ${metaOf(shortest).r}\u00a0min`, shortest],
    ["Oldest", oldest && `${oldest.name} · ${oldest.year}`, oldest], ["Newest", newest && newest !== oldest && `${newest.name} · ${newest.year}`, newest],
  ].filter(([, v]) => v).map(([k, v, f, to]) => `<div class="fact"><span class="k">${k}</span><span class="v">${dlink(f ? D.film(f) : to, esc(v))}${tmdbLink(f)}</span></div>`).join("");
  return facts ? `<div class="facts">${facts}</div>` : "";
}

// Films watched on this date in earlier years.
// The latest diary entries, newest first (a year's last ones when a year is picked): one row of posters.
const RECENT_N = 8;
function recentBlock(s) {
  return `<div class="posters">${s.entries.slice(-RECENT_N).reverse().map((e) => `<button class="poster" type="button" ${dl(D.film(e.film, { entry: e }))}>${artHtml(e.film)}
    <span class="cap"><span class="d">${fmtDate(e.date)}</span><span><span class="stars">${stars(e.rating)}</span>${e.rewatch ? ' <span class="muted" title="Rewatch">↻</span>' : ""}${e.film.liked ? ' <span class="heart" title="Liked">♥</span>' : ""}</span></span></button>`).join("")}</div>`;
}
function onThisDayBlock(T) {
  return `<div class="posters">${T.entries.slice(0, 12).map((e) => `<button class="poster" type="button" ${dl(D.film(e.film, { entry: e }))}>${artHtml(e.film)}
    <span class="cap"><span class="d">${T.week ? fmtDate(e.date) : e.date.slice(0, 4)}</span><span class="stars">${stars(e.rating)}</span></span></button>`).join("")}</div>` +
    (T.entries.length > 12 ? `<p class="status">${dlink(T.to, `All ${fmtN(T.entries.length)}`)}</p>` : "");
}
// The watchlist, likeliest favourites first, with why.
function watchNextBlock(W) {
  if (!W) return `<div class="empty">Watch next needs a watchlist in your export and five or more rated films.</div>`;
  const list = W.picks.filter((p) => p.known && wnFits(p, state.wn));
  const chips = `<div class="tabs" role="tablist">${WN_LENGTHS.map(([v, l]) => `<button class="tab" role="tab" type="button" data-wn="${v}" aria-selected="${v === state.wn}">${l}</button>`).join("")}</div>`;
  const cards = list.length ? `<div class="posters wn">${list.slice(0, 12).map((p) => `<button class="poster" type="button" ${dl(D.film(p.f))}>${artHtml(p.f)}
    <span class="cap"><span class="pred">About ${p.pred.toFixed(1)}★</span>${p.why[0] ? `<span class="muted why">${esc(p.why[0])}</span>` : ""}</span></button>`).join("")}</div>`
    : `<div class="empty">${W.picks.some((p) => p.known) ? "Nothing on your watchlist fits that length." : "Your watchlist films need cast &amp; crew details first. They're looked up with your TMDB key."}</div>`;
  const all = list.length > 12 ? `<p class="status">${dlink(wnDrill(list, "Watch next"), `See all ${fmtN(list.length)}`)}, best bets first.</p>` : "";
  const missing = W.missing ? `<p class="status">${plural(W.missing, "film")} on your watchlist ${W.missing === 1 ? "has" : "have"} no details yet, so ${W.missing === 1 ? "isn't" : "aren't"} ranked.</p>` : "";
  return chips + cards + all + missing + `<p class="status">A guess at your rating: your average, moved by how you rate each film's director, leads and genres, and by its crowd score as far as your ratings follow the crowd.</p>`;
}
// A person as a link to their films.
// The lines that sum up each card.
function cardLines(s) {
  const L = {}, views = viewsOf(s), E = s.entries;
  const big = [...s.decades].sort((a, b) => b.count - a.count)[0];
  if (big) L.released = `Most of your films come from ${dlink(DR.decade(big), `the ${big.decade}s`)}: ${plural(big.count, "film")} of ${fmtN(s.films.length)}.`;
  const hit = milestoneMarks(s).filter((n) => n <= E.length).pop(), me = hit ? E[hit - 1] : E[0];
  if (me) L.milestones = `${hit ? `Your ${ordinal(hit)} film` : "Your first film"}${s.scope === "all" ? "" : ` of ${esc(s.scope)}`}: ${dlink(D.film(me.film, { entry: me }), esc(me.film.name))}, ${fmtDate(me.date)}.`;
  const re = s.films.filter((f) => views(f) > 1).sort((a, b) => views(b) - views(a) || (b.rating || 0) - (a.rating || 0))[0];
  if (re) L.rewatched = `${dlink(D.film(re), esc(re.name))} leads, with ${views(re)} viewings.`;
  const five = s.films.filter((f) => f.rating === 5), low = s.films.filter((f) => f.rating && f.rating <= 2.5);
  if (s.rated) L.top = `${five.length ? dlink(D.films("Five stars", filmsSub(five), five, { scope: s.scope }), plural(five.length, "five-star film")) : "No five-star films yet"}${low.length ? `; ${dlink(D.films("Lowest rated", filmsSub(low, "2½★ and under"), low, { scope: s.scope, sort: "given" }), plural(low.length, "film"))} at 2½★ or under` : ""}.`;
  return L;
}
function renderSections(s) {
  const T = s.scope === "all" ? onThisDay(state.lib) : null;
  const best = bestDecadeBlock(s);
  // first, in full: what you've watched lately, on this day, and your best decade; then the chapters, in cards (People and
  // Genres & countries in full)
  const glance = [
    s.entries.length ? section("recent", s.scope === "all" ? "Recently watched" : `Last watched in ${s.scope}`,
      s.entries.length > RECENT_N ? dlink(DR.diary(s), `All ${fmtN(s.entries.length)} diary entries`) : "Your latest diary entries.", recentBlock(s)) : "",
    T && T.entries.length ? section("onthisday", T.title, T.sub, onThisDayBlock(T)) : "",
    best ? section("best-decade", "Best decade", "The decade of release you rate highest.", best) : ""].join("");
  // with a filter on, a section or card it leaves with nothing to show is left out, and so is a chapter left empty
  const trim = (html) => filterOn() ? dropEmpties(html, (root) => { for (const b of root.querySelectorAll(".credit-body")) if (b.children.length === 1 && b.firstElementChild.classList.contains("empty")) b.closest(".credit").remove(); }) : html;
  const chapters = dashChapters(s).map(([id, name, parts]) => [id, name, trim(parts.filter(Boolean).join(""))]).filter(([, , html]) => html.trim());
  const glanceHtml = trim(glance);
  const all = [glanceHtml.trim() && ["glance", "At a glance", glanceHtml], ...chapters].filter(Boolean);
  $("#sections").innerHTML = all.map(([id, name, html]) => `<div class="ch-mark" id="ch-${id}"><span>${name}</span></div>${html}`).join("")
    || `<div class="empty" style="margin-top:24px">No films pass this filter in this period.</div>`;
  // the menu that stays at the top: the chapters, then the filter (what's on, or a button to set one)
  $("#jump").innerHTML = `<div class="jump-in">${all.map(([id, name]) => `<button class="jump-link" type="button" data-jump="ch-${id}">${name}</button>`).join("")}</div>
    ${filterOn() ? filterStripHtml(s.films.length) : `<button class="jump-filter" type="button" ${dl(D.filters())}><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7z"/></svg>Filter</button>`}`;
  watchChapters();
}
// The menu at the top marks the chapter on screen, and takes you to any other.
let chapterObs = null;
function watchChapters() {
  if (!("IntersectionObserver" in window)) return;
  if (!chapterObs) chapterObs = new IntersectionObserver(() => {
    const marks = [...document.querySelectorAll("#sections .ch-mark")];
    let cur = marks[0];
    for (const m of marks) if (m.getBoundingClientRect().top < 120) cur = m;
    for (const b of document.querySelectorAll("#jump .jump-link")) {
      const on = !!cur && b.dataset.jump === cur.id;
      if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    }
  }, { rootMargin: "-100px 0px -60% 0px", threshold: [0, 1] });
  chapterObs.disconnect();
  for (const m of document.querySelectorAll("#sections .ch-mark, #sections .credit")) chapterObs.observe(m);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-jump]");
  if (!b) return;
  const el = document.getElementById(b.dataset.jump);
  if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
});

</script>
