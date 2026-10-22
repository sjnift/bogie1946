<script>
/* ---------- app state ---------- */
const state = {
  mode: "example", lib: null, scope: "all", view: "profile", stack: [],
  role: "c", crew: "w", sort: "most", catSort: "most", peopleLimit: 50, diaryLimit: 60, crowd: null, insYear: "all", reviewQuery: "", reviewLimit: 30, cmp: null, cmpError: "", unfriend: null,
};
let MY_LIB = null, EXAMPLE_LIB = null, STATS = null;
const IMG = "https://image.tmdb.org/t/p/w185";
const showImages = !IN_VIEWER; // pages inside Claude can't load outside images
const VIEW_KEY = "cr-mview-v1";
const TITLES = { profile: "Profile", people: "People", diary: "Diary", films: "Films", data: "Import" };
const CHEV = `<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>`;
const BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`;

function metaOf(f) {
  if (state.mode === "example") return EXAMPLE_META[f.key] || null;
  const m = META[f.key];
  if (m && !m.miss) return m;
  return EXAMPLE_META[f.key] || null;
}
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}
function saveView() { store.set(VIEW_KEY, { scope: state.scope, mode: state.mode, view: state.view }); }

function render() {
  if (state.mode === "mine" && !MY_LIB) state.mode = "example";
  state.lib = state.mode === "mine" ? MY_LIB : EXAMPLE_LIB;
  const years = [...new Set(state.lib.entries.map((e) => e.date.slice(0, 4)))].sort().reverse();
  if (state.scope !== "all" && !years.includes(state.scope)) state.scope = "all";
  STATS = computeStats(state.lib, metaOf, state.scope);
  LISTS = new Map();
  const d = state.stack[state.stack.length - 1];
  renderTop(years, d);
  $("#screen").innerHTML = d ? detailScreen(d, STATS) : SCREENS[state.view](STATS);
  for (const b of document.querySelectorAll(".tabbar [data-view]")) {
    if (b.dataset.view === state.view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  }
  const cal = $(".cal-wrap");
  if (cal) cal.scrollLeft = cal.scrollWidth;
}
function renderTop(years, d) {
  $("#top").classList.toggle("detail", !!d);
  $("#nav-left").innerHTML = d ? `<button class="nav-btn" type="button" data-act="back">${BACK}<span class="sr-only">Back</span></button>` : "";
  const who = state.mode === "example" ? "Example diary" : state.lib.profile.username || "Your diary";
  $("#nav-title").textContent = d ? d.title : state.view === "profile" ? who : TITLES[state.view];
  $("#nav-right").innerHTML = !d ? `<button class="nav-btn" type="button" data-act="insights">Insights</button>` : "";
  $("#scopes").innerHTML = ["all", ...years].map((y) =>
    `<button class="scope" type="button" data-scope="${y}" aria-pressed="${y === state.scope}">${y === "all" ? "All time" : y}</button>`).join("");
}
function push(entry) {
  entry.ret = window.scrollY;
  state.stack.push(entry);
  render();
  window.scrollTo(0, 0);
}
function pop() {
  const d = state.stack.pop();
  render();
  window.scrollTo(0, d ? d.ret : 0);
}

/* ---------- pieces ---------- */
const sh = (label, right = "") => `<div class="sh"><span>${label}</span>${right}</div>`;
function avatar(p, size) {
  const ph = showImages && p.key && PHOTOS[p.key];
  return `<span class="avatar ${size}" aria-hidden="true">${esc(initials(p.name || "?"))}${ph ? `<img src="${IMG}${esc(ph)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>`;
}
function poster(f) {
  const m = metaOf(f);
  const img = showImages && m && m.poster ? `<img src="${IMG}${esc(m.poster)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<span class="poster"><span class="ph">${esc(f.name)}<small>${f.year || ""}</small></span>${img}</span>`;
}
function posterGrid(films) {
  return `<div class="pgrid">${films.map((f) => `<div class="pitem" title="${esc(f.name)}${f.year ? ` (${f.year})` : ""}">${poster(f)}
    <span class="pmeta"><span class="stars">${stars(f.rating)}</span>${f.liked ? '<span class="heart" aria-label="liked">♥</span>' : ""}</span></div>`).join("")}</div>`;
}
const filmsTitle = (p) => `${plural(p.count, "film")}${p.avg ? ` · ★ ${p.avg.toFixed(2)} average` : ""}`;
function personRow(p, rank, sortBest) {
  return `<button class="prow" type="button" data-push="${reg(p.name, filmsTitle(p), p.films, p)}">
    <span class="rk">${rank}</span>${avatar(p, "md")}
    <span style="min-width:0"><span class="nm" style="display:block">${esc(p.name)}</span><span class="sub">${filmsTitle(p)}</span></span>
    <span class="val">${sortBest ? p.avg.toFixed(2) : fmtN(p.count)}</span>${CHEV}</button>`;
}
function catRow(c, max, sortBest) {
  const w = sortBest ? c.avg / 5 : c.count / max;
  return `<button class="prow cat" type="button" data-push="${reg(c.name, filmsTitle(c), c.films)}">
    <span class="nm">${esc(c.name)}</span><span class="mini" aria-hidden="true"><span style="width:${(w * 100).toFixed(1)}%"></span></span>
    <span class="val" style="text-align:right">${sortBest ? c.avg.toFixed(2) : fmtN(c.count)}</span>${CHEV}</button>`;
}
const needMeta = () => `<div class="card" style="margin-top:14px"><p class="title">No cast or crew yet</p>
  <p>Letterboxd's export lists your films, dates and ratings, but not who's in them. Fill them in from the Import tab.</p>
  <button class="btn green" type="button" data-view="data">Fill in cast &amp; crew</button></div>`;

/* ---------- Profile ---------- */
function profileScreen(s) {
  const ex = state.mode === "example", lib = state.lib;
  const name = ex ? "Example diary" : lib.profile.name || lib.profile.username || "Your diary";
  const handle = ex ? `<span class="pill">Example</span>` : lib.profile.joined ? `Member since ${MONTHS_LONG[+lib.profile.joined.slice(5, 7) - 1]} ${lib.profile.joined.slice(0, 4)}` : "";
  const notice = ex ? `<div class="card notice"><p class="title">This is an example diary, not yours.</p>
      <p>Export your data from Letterboxd (Settings → Data → Export your data), then import the ZIP here. Your files stay in this browser.</p>
      <button class="btn green block" type="button" data-act="import">Import your export</button></div>` : "";
  const total = lib.films.length, have = lib.films.filter((f) => metaOf(f)).length;
  const fill = !ex && have < total ? `<button class="row" type="button" data-view="data" style="border-top:1px solid var(--line); margin-top:16px">
      <span>${job.running ? `Looking up cast &amp; crew · ${fmtN(job.done)} of ${fmtN(job.total)}` : `Cast &amp; crew for ${fmtN(have)} of ${plural(total, "film")}`}</span>
      <span class="count" style="color:var(--green)">${job.running ? "" : "Fill in"}</span>${CHEV}</button>` : "";
  const hours = Math.round(s.minutes / 60);
  const strip = `<div class="strip">
    <div><b class="num">${fmtN(s.films.length)}</b><span>Films</span></div>
    <div><b class="num">${s.timed ? fmtN(hours) : "—"}</b><span>Hours</span></div>
    <div><b class="num">${fmtN(s.entries.length)}</b><span>Entries</span></div>
    <div><b class="num">${s.avgRating ? s.avgRating.toFixed(2) : "—"}</b><span>Average</span></div></div>`;
  const top = s.films.filter((f) => f.rating).sort((a, b) => b.rating - a.rating || b.entries.length - a.entries.length || (b.year || 0) - (a.year || 0));
  const topRated = top.length ? sh("Top rated", `<button class="more" type="button" data-act="all-rated">See all</button>`) + posterGrid(top.slice(0, 4)) : "";
  const ratings = s.rated ? sh("Ratings", `<span class="num">${fmtN(s.rated)}</span>`) +
    colChart(s.spread.map((x) => ({ a: x.count, b: 0, tip: `${stars(x.r)} · ${plural(x.count, "film")}` })), "How many films you gave each rating", "", 72)
      .replace('class="chart"', 'class="chart slate"').replace(/<div class="axis"[^]*?<\/div>/, "") +
    `<div class="hist-ends" style="margin-right:26px"><span class="stars">★</span><span class="stars">★★★★★</span></div>` : "";
  const strip2 = (label, data, role) => {
    const list = data.most.slice(0, 10);
    if (!list.length) return "";
    return sh(label, `<button class="more" type="button" data-act="people" data-role="${role}">See all</button>`) +
      `<div class="scroller">${list.map((p) => `<button class="pcard" type="button" data-push="${reg(p.name, filmsTitle(p), p.films, p)}">
        ${avatar(p, "lg")}<span class="nm">${esc(p.name)}</span><span class="ct">${plural(p.count, "film")}</span></button>`).join("")}</div>`;
  };
  const people = s.withMeta ? strip2("Most watched actors", s.cast, "c") + strip2("Most watched directors", s.directors, "d") : "";
  const rows = [
    ["Actors", s.cast.total, `data-act="people" data-role="c"`],
    ["Directors", s.directors.total, `data-act="people" data-role="d"`],
    ["Diary", s.entries.length, `data-view="diary"`],
    ["Reviews", lib.reviewTextMissing ? s.reviews : reviewsIn(lib, s.scope === "all" ? null : s.scope).length, `data-act="reviews"`],
    ["Genres", s.genres.most.length, `data-act="cat" data-field="genres"`],
    ["Countries", s.countries.most.length, `data-act="cat" data-field="countries"`],
    ["Languages", s.languages.most.length, `data-act="cat" data-field="languages"`],
    ["Rewatches", s.rewatches, `data-view="films"`],
    ["Liked", s.likes, `data-act="liked"`],
  ].map(([k, n, attrs]) => `<li><button class="row" type="button" ${attrs}><span>${k}</span><span class="count">${fmtN(n)}</span>${CHEV}</button></li>`).join("");
  return `<div class="profile">${avatar({ name: ex ? "Example" : lib.profile.username || "You" }, "xl")}
      <div class="name">${esc(name)}</div><div class="handle">${handle}</div></div>
    ${notice}${strip}
    <button class="row" type="button" data-act="insights"><span>Insights</span><span class="count">Trends, tastes, the crowd</span>${CHEV}</button>
    <button class="row" type="button" data-act="compare"><span>Compare</span><span class="count">You and friends</span>${CHEV}</button>
    ${fill}${topRated}${ratings}${people}
    ${sh(state.scope === "all" ? "All time" : state.scope)}<ul class="menu">${rows}</ul>`;
}

/* ---------- People ---------- */
function peopleScreen(s) {
  const role = state.role;
  const data = role === "c" ? s.cast : role === "d" ? s.directors : { w: s.writers, p: s.dop, m: s.music }[state.crew];
  const best = state.sort === "best";
  const list = best ? data.best : data.most;
  const segs = [["c", "Actors"], ["d", "Directors"], ["crew", "Crew"]].map(([v, l]) =>
    `<button type="button" data-role="${v}" aria-pressed="${v === role}">${l}</button>`).join("");
  const crew = role === "crew" ? `<div class="toggles">${[["w", "Writers"], ["p", "Camera"], ["m", "Music"]].map(([v, l]) =>
    `<button class="toggle" type="button" data-crew="${v}" aria-pressed="${v === state.crew}">${l}</button>`).join("")}</div>` : "";
  const sorts = `<div class="toggles">${[["most", "Most watched"], ["best", "Highest rated"]].map(([v, l]) =>
    `<button class="toggle" type="button" data-sort="${v}" aria-pressed="${v === state.sort}">${l}</button>`).join("")}</div>`;
  const head = `<div class="segctl" role="group" aria-label="Role">${segs}</div>${crew}${sorts}`;
  if (!s.withMeta) return head + needMeta();
  const note = role === "c" ? `Top ${CAST_DEPTH} billed cast of each film.` : "";
  const bestNote = best ? `${note ? " " : ""}Highest rated needs ${s.minRated} or more rated films.` : "";
  const rows = list.slice(0, state.peopleLimit).map((p, i) => personRow(p, i + 1, best)).join("");
  const more = list.length > state.peopleLimit ? `<button class="row" type="button" data-act="more-people"><span>Show more</span><span class="count">${fmtN(list.length - state.peopleLimit)} more</span>${CHEV}</button>` : "";
  return head + sh(`${fmtN(list.length)} ${role === "c" ? "actors" : role === "d" ? "directors" : "people"}`) +
    (note + bestNote ? `<p class="status" style="margin:-2px 0 4px">${esc(note + bestNote)}</p>` : "") +
    (rows || `<div class="empty">Nobody to show for this period.</div>`) + more;
}
</script>
