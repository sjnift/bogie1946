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
  return `<div class="face"><span class="initials" aria-hidden="true">${esc(initials(p.name))}</span>${ph ? `<img src="${IMG}${esc(ph)}" alt="" loading="lazy" onerror="this.remove()">` : ""}${rank ? `<span class="rank">${rank}</span>` : ""}</div>`;
}
const emptyMeta = () => `<div class="empty">Cast and crew aren't part of the Letterboxd export. Fill them in with <a href="#lookup">Cast &amp; crew</a> above.</div>`;
function rankRows(list, valueOf, widthOf, startRank, titleOf) {
  return `<ol class="rank-list">${list.map((p, i) => `<li><button class="rank-row" type="button" data-list="${reg(p.name, titleOf(p), p.films, p)}">
    <span class="r">${startRank + i}</span><span class="n">${esc(p.name)}</span>
    <span class="track" aria-hidden="true"><span style="width:${Math.max(1, widthOf(p) * 100).toFixed(1)}%"></span></span>
    <span class="v">${valueOf(p)}</span></button></li>`).join("")}</ol>`;
}
/* ---------- section bodies ---------- */
function peopleBlock(kind, data, s) {
  const t = state.tab[kind];
  const list = t === "most" ? data.most : data.best;
  if (!list.length) return `<div class="empty">${t === "best" ? `Nobody here has ${s.minRated} or more rated films yet.` : "Nobody to show for this period."}</div>`;
  const top = list.slice(0, 12);
  const cards = top.map((p, i) => `<button class="person" type="button" data-list="${reg(p.name, personSub(p), p.films, p)}">
    ${faceHtml(p, i + 1)}<span class="nm">${esc(p.name)}</span>
    <span class="ct">${t === "most" ? plural(p.count, "film") : `<span class="stars">★</span> ${p.avg.toFixed(2)} · ${plural(p.ratings.length, "film")}`}</span></button>`).join("");
  const limit = state.more[kind] ? 100 : 24;
  const rest = list.slice(12, limit);
  const max = list[0].count;
  const rows = rest.length ? rankRows(rest,
    (p) => t === "most" ? plural(p.count, "film") : p.avg.toFixed(2),
    (p) => t === "most" ? p.count / max : p.avg / 5, 13, personSub) : "";
  const moreBtn = list.length > limit ? `<div><button class="btn small" type="button" data-more="${kind}">Show more</button></div>` : "";
  return `<div class="people">${cards}</div>${rows}${moreBtn}`;
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
    ["Busiest month", bm ? `${MONTHS_LONG[+bm.key.slice(5, 7) - 1]} ${bm.key.slice(0, 4)} · ${plural(bm.count, "film")}` : "—"],
    ["Most in one day", s.busiestDay ? `${plural(s.busiestDay.count, "film")} · ${fmtDate(s.busiestDay.key)}` : "—"],
    ["Longest streak", s.streak.days > 1 ? `${s.streak.days} days in a row` : "1 day"],
    ["Favourite day", WEEKDAYS_LONG[fav]],
    [`Average per ${unit}`, perUnit.toFixed(1)],
  ].map(([k, v]) => `<div class="fact"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join("");
  const wmax = Math.max(1, ...s.weekday);
  const weekdays = `<div class="weekdays" role="img" aria-label="Diary entries by day of the week">${s.weekday.map((n, i) =>
    `<div class="wd" data-tip="${WEEKDAYS_LONG[i]}: ${plural(n, "film")}"><span class="cnt">${n}</span><div class="bar-v"><span style="height:${(n / wmax * 100).toFixed(1)}%"></span></div><span class="lbl">${WEEKDAYS[i]}</span></div>`).join("")}</div>`;
  const table = `<details class="tbl"><summary>View as table</summary><div class="scroll"><table class="data"><thead><tr><th>${unit[0].toUpperCase() + unit.slice(1)}</th><th class="n">First watches</th><th class="n">Rewatches</th></tr></thead><tbody>${
    cols.filter((c) => c.a + c.b).map((c) => `<tr><td>${esc(c.tipLabel)}</td><td class="n">${c.a}</td><td class="n">${c.b}</td></tr>`).join("")}</tbody></table></div></details>`;
  return `<div class="facts">${facts}</div>${colChart(cols, `Diary entries by ${unit}`, legend)}${table}
    <div class="facts" style="align-items:end; gap:28px 48px"><div class="fact"><span class="k" style="margin-bottom:8px">By day of the week</span>${weekdays}</div>
    <div class="fact" style="min-width:0; max-width:100%"><span class="k" style="margin-bottom:8px">${s.scope === "all" ? "Last 12 months of diary" : "Every day of " + s.scope}</span>${heatmap(s)}</div></div>`;
}
function ratingBlock(s) {
  if (!s.rated) return `<div class="empty">No rated films in this period.</div>`;
  const cols = s.spread.map((x) => ({ a: x.count, b: 0, label: x.r === 0.5 ? "½" : x.r % 1 ? "" : `${x.r}★`, tip: `${stars(x.r)} · ${plural(x.count, "film")}` }));
  const most = s.spread.reduce((a, b) => b.count > a.count ? b : a);
  const facts = [
    ["Average", `${s.avgRating.toFixed(2)} of 5`], ["Given most", `${stars(most.r)} · ${plural(most.count, "time")}`],
    ["Rated films", fmtN(s.rated)], ["Five stars", plural(s.spread[9].count, "film")],
  ].map(([k, v]) => `<div class="fact"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join("");
  return `<div class="facts">${facts}</div>${colChart(cols, "How many films you gave each rating")}`;
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
    `<div class="cat-grid">${col("Genres", s.genres)}${col("Countries", s.countries)}${col("Languages", s.languages)}</div>`;
}
function decadeBlock(s) {
  if (!s.decades.length) return `<div class="empty">No release years in this period.</div>`;
  const all = s.decades;
  const cols = [];
  for (let d = all[0].decade; d <= all[all.length - 1].decade; d += 10) {
    const x = all.find((y) => y.decade === d);
    cols.push({ a: x ? x.count : 0, b: 0, label: `’${String(d).slice(2)}s`, tip: `${d}s: ${plural(x ? x.count : 0, "film")}${x && x.avg ? ` · ${x.avg.toFixed(2)} average` : ""}` });
  }
  const best = all.filter((x) => x.ratings.length >= 3).sort((a, b) => b.avg - a.avg).slice(0, 4);
  const list = best.length ? `<div class="decades"><div class="k muted" style="font-size:12.5px">Highest-rated decades</div>${best.map((x) => `<div class="decade">
      <div class="lbl">${x.decade}s<small>${x.avg.toFixed(2)} avg</small></div>
      <div class="row">${x.top.slice(0, 4).map((f) => `<span class="chiplet">${esc(f.name)} <span class="stars">${stars(f.rating)}</span></span>`).join("")}</div></div>`).join("")}</div>` : "";
  return colChart(cols, "Films by decade of release") + list;
}
function crewBlock(s) {
  const t = state.tab.crew;
  const data = { w: s.writers, p: s.dop, m: s.music }[t];
  const list = data.most.slice(0, 15);
  const body = list.length ? rankRows(list, (p) => plural(p.count, "film"), (p) => p.count / list[0].count, 1, personSub) : `<div class="empty">Nobody to show yet.</div>`;
  return tabs("crew", [["w", "Written by"], ["p", "Shot by"], ["m", "Music by"]], t) + body;
}
function milestonesBlock(s) {
  const E = s.entries;
  if (!E.length) return `<div class="empty">Milestones come from diary dates, and there are none in this period.</div>`;
  const marks = s.scope === "all" ? [50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000] : [25, 50, 100, 150, 200, 250, 300, 365, 400, 500];
  const hits = marks.filter((n) => n < E.length).slice(-6).map((n) => [`${ordinal(n)} film`, E[n - 1]]);
  const items = [[s.scope === "all" ? "First film" : `First of ${s.scope}`, E[0]], ...hits];
  if (E.length > 1) items.push([s.scope === "all" ? "Latest" : `Latest of ${s.scope}`, E[E.length - 1]]);
  return `<div class="milestones">${items.map(([k, e]) => `<div class="poster milestone"><span class="k">${k}</span>${artHtml(e.film)}
    <div class="cap"><span class="d">${fmtDate(e.date)}</span><span>${e.rating ? `<span class="stars">${stars(e.rating)}</span>` : ""}${e.rewatch ? `<span class="muted" title="Rewatch"> ↻<span class="sr-only">rewatch</span></span>` : ""}</span></div></div>`).join("")}</div>`;
}
// The poster itself: TMDB's image where there is one, otherwise a title card.
function artHtml(f) {
  const m = metaOf(f);
  const img = showImages && m && m.poster ? `<img src="${IMG}${esc(m.poster)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<div class="art" title="${esc(f.name)}${f.year ? ` (${f.year})` : ""}">${img}<div class="t">${esc(f.name)}</div><div class="y">${f.year || ""}</div></div>`;
}
function posterHtml(f) {
  return `<div class="poster">${artHtml(f)}
    <div class="cap"><span class="stars">${stars(f.rating)}</span>${f.liked ? ' <span class="muted" title="Liked">♥</span>' : ""}</div></div>`;
}
function highlightsBlock(s) {
  const views = (f) => s.scope === "all" ? f.entries.length : f.entries.filter((e) => e.date.startsWith(s.scope)).length;
  const top = s.films.filter((f) => f.rating).sort((a, b) => b.rating - a.rating || views(b) - views(a) || (b.year || 0) - (a.year || 0)).slice(0, 12);
  const re = s.films.filter((f) => views(f) > 1).sort((a, b) => views(b) - views(a) || (b.rating || 0) - (a.rating || 0)).slice(0, 8);
  const timed = s.films.filter((f) => metaOf(f) && metaOf(f).r);
  const longest = timed.reduce((a, f) => !a || metaOf(f).r > metaOf(a).r ? f : a, null);
  const shortest = timed.reduce((a, f) => !a || metaOf(f).r < metaOf(a).r ? f : a, null);
  const dated = s.films.filter((f) => f.year);
  const oldest = dated.reduce((a, f) => !a || f.year < a.year ? f : a, null);
  const facts = [
    ["Longest", longest && `${longest.name} · ${metaOf(longest).r} min`], ["Shortest", shortest && `${shortest.name} · ${metaOf(shortest).r} min`],
    ["Oldest", oldest && `${oldest.name} · ${oldest.year}`], ["Liked", plural(s.likes, "film")],
  ].filter(([, v]) => v).map(([k, v]) => `<div class="fact"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join("");
  const reList = re.length ? `<div><div class="muted" style="font-size:12.5px; margin-bottom:6px">Most rewatched</div>${rankRows(
    re.map((f) => ({ name: `${f.name}${f.year ? ` (${f.year})` : ""}`, films: [f], count: views(f) })),
    (p) => `${p.count} viewings`, (p) => p.count / views(re[0]), 1, (p) => plural(p.count, "viewing"))}</div>` : "";
  return `<div class="facts">${facts}</div>${top.length ? `<div class="posters">${top.map(posterHtml).join("")}</div>` : `<div class="empty">No rated films in this period.</div>`}${reList}`;
}

function renderSections(s) {
  LISTS = new Map();
  const noMeta = !s.withMeta;
  const people = (kind, data) => noMeta ? emptyMeta() : tabs(kind, [["most", "Most watched"], ["best", "Highest rated"]], state.tab[kind]) + peopleBlock(kind, data, s);
  $("#sections").innerHTML = [
    section("starring", "Starring", `${fmtN(s.cast.total)} actors in the top ${CAST_DEPTH} billed of each film. Highest rated needs ${s.minRated}+ rated films.`, people("cast", s.cast)),
    section("directed", "Directed by", `${fmtN(s.directors.total)} directors.`, people("directors", s.directors)),
    section("logged", "Logged", s.scope === "all" ? "Diary entries over time, by day and by date." : `Diary entries in ${s.scope}, week by week.`, diaryBlock(s)),
    section("rated", "Rated", "How your ratings spread across half-stars.", ratingBlock(s)),
    section("origin", "Genre &amp; origin", "Genres, production countries and original languages.", noMeta ? emptyMeta() : catBlock(s)),
    section("released", "Released", "Films by decade of release.", decadeBlock(s)),
    section("crew", "Crew", "Writers, cinematographers and composers.", noMeta ? emptyMeta() : crewBlock(s)),
    section("milestones", "Milestones", "Counted through your diary in date order.", milestonesBlock(s)),
    section("top", "Top billing", "Your highest-rated films.", highlightsBlock(s)),
  ].join("");
}

/* ---------- film list dialog ---------- */
function openList(id) {
  const L = LISTS.get(id);
  if (!L) return;
  const dlg = $("#dlg");
  const films = [...L.films].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.year || 0) - (a.year || 0));
  const rows = films.map((f) => {
    const n = f.entries.length, last = n ? f.entries[n - 1].date : null;
    return `<div class="film-row"><div><div class="ft">${esc(f.name)} <span class="fy">${f.year || ""}</span></div>
      <div class="fd">${last ? `Watched ${fmtDate(last)}${n > 1 ? ` · ${n} viewings` : ""}` : "Logged without a date"}</div></div>
      <div class="fr"><span class="stars">${stars(f.rating)}</span>${f.liked ? ' <span class="muted">♥</span>' : ""}</div></div>`;
  }).join("");
  dlg.innerHTML = `<div class="dlg-head">${L.person && L.person.key ? faceHtml(L.person) : ""}<div style="min-width:0"><h3 id="dlg-title">${esc(L.title)}</h3>
    <div class="muted" style="font-size:13px">${esc(L.sub)}</div></div><button class="btn small close" type="button" data-close>Close</button></div>
    <div class="dlg-body">${rows}</div>`;
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
}
</script>
