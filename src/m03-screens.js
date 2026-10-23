<script>
/* ---------- app state ---------- */
const state = {
  mode: "example", lib: null, scope: "all", view: "profile", statsView: "films", stack: [], wn: "any", backupKeys: false,
  role: "c", sort: "most", catSort: "most", peopleLimit: 50, diaryLimit: 40, crowd: null, insTab: "overview", yearTab: "overview", trend: "films",
  reviewQuery: "", reviewLimit: 30, cmp: null, cmpTab: "overview", cmpError: "", unfriend: null, drillLimit: 200,
};
let MY_LIB = null, EXAMPLE_LIB = null, STATS = null, YEARS = [];
const IMG = "https://image.tmdb.org/t/p/w185";
const showImages = !IN_VIEWER; // pages inside Claude can't load outside images
const VIEW_KEY = "cr-mview-v1";
const STATS_VIEWS = ["films", "people", "genres"];
const TOP_VIEWS = ["profile", "diary", ...STATS_VIEWS, "insights", "compare"];
const TITLES = { diary: "Diary", films: "Stats", people: "Stats", genres: "Stats", insights: "Insights", compare: "Compare" };
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const svg = (body, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const CHEV = `<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>`;
const SEARCH_ICON = svg(`<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>`, 2.2);
const BACK = svg(`<path d="M15 5l-7 7 7 7"/>`, 2.4);
const CLOSE = svg(`<path d="M6 6l12 12M18 6L6 18"/>`, 2.4);
const ICON = {
  gear: svg(`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`, 1.8),
  review: svg(`<path d="M5 4h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 3.5V5a1 1 0 0 1 1-1z"/><path d="M8.5 9h7M8.5 12.5h4.5"/>`, 1.9),
  next: svg(`<path d="M6 4.5v15l12-7.5z"/>`, 1.9),
  heart: svg(`<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>`, 1.9),
  rewatch: svg(`<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>`, 1.9),
  sparkle: svg(`<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/>`, 1.9),
  upload: svg(`<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3"/>`, 1.9),
  share: svg(`<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>`, 1.9),
  plus: svg(`<path d="M12 5v14M5 12h14"/>`, 2.2),
};

function metaOf(f) {
  if (state.mode === "example") return EXAMPLE_META[f.key] || null;
  const m = META[f.key];
  if (m && !m.miss) return m;
  return EXAMPLE_META[f.key] || null;
}

/* ---------- speed: results worked out once per change of data, and screens patched rather than redrawn ---------- */
let MEMO = new Map(), memoTag = [];
// The stats, insights and comparisons for this diary, worked out once until something in the data changes.
function memo(key, fn) {
  const tag = [state.lib, META, LBX, FRIENDS, DATA_REV];
  if (tag.some((x, i) => x !== memoTag[i])) { MEMO = new Map(); memoTag = tag; }
  if (!MEMO.has(key)) MEMO.set(key, fn());
  return MEMO.get(key);
}
const statsOf = (scope) => memo(`stats|${scope}`, () => computeStats(state.lib, metaOf, scope));
// Puts new HTML into place by changing only what differs: loaded posters stay, side-scrolled rows keep their
// place, and nothing flashes. Children with data-k keep their element when they move.
function morph(el, html) {
  const t = document.createElement("template");
  t.innerHTML = html;
  patchKids(el, t.content);
}
function patchKids(a, b) {
  const keyed = new Map();
  for (let c = a.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.hasAttribute("data-k")) keyed.set(c.getAttribute("data-k"), c);
  let x = a.firstChild, y = b.firstChild;
  while (y) {
    const next = y.nextSibling, k = y.nodeType === 1 ? y.getAttribute("data-k") : null;
    if (k != null) {
      const m = keyed.get(k);
      if (m && m.nodeName === y.nodeName) { keyed.delete(k); if (m === x) x = x.nextSibling; else a.insertBefore(m, x); patchNode(m, y); }
      else a.insertBefore(y, x);
    } else if (x && x.nodeType === y.nodeType && x.nodeName === y.nodeName && !(x.nodeType === 1 && x.hasAttribute("data-k"))) { patchNode(x, y); x = x.nextSibling; }
    else a.insertBefore(y, x);
    y = next;
  }
  while (x) { const n = x.nextSibling; a.removeChild(x); x = n; }
}
function patchNode(x, y) {
  if (x.nodeType !== 1) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; return; }
  if (x.nodeName === "IMG" && x.getAttribute("src") === y.getAttribute("src")) return;
  for (let i = x.attributes.length - 1; i >= 0; i--) { const n = x.attributes[i].name; if (!y.hasAttribute(n) && !(n === "open" && x.nodeName === "DETAILS")) x.removeAttribute(n); }
  for (const { name, value } of y.attributes) if (x.getAttribute(name) !== value) x.setAttribute(name, value);
  if (x.nodeName === "INPUT") { const v = y.getAttribute("value") || ""; if (x !== document.activeElement && x.value !== v) x.value = v; return; }
  patchKids(x, y);
}

let renderQueued = false;
// Film details or averages arrived: work everything out again, once per frame at most.
function scheduleRender() {
  DATA_REV++;
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}
function saveView() { store.set(VIEW_KEY, { scope: state.scope, mode: state.mode, view: state.view }); }
const tabOf = (view) => STATS_VIEWS.includes(view) ? "stats" : view;
let screenKey = "", SCROLL = {};

// Draws the current screen. `motion` is how it arrived: "push", "pop" or "tab".
function render(motion) {
  if (state.mode === "mine" && !MY_LIB) state.mode = "example";
  state.lib = state.mode === "mine" ? MY_LIB : EXAMPLE_LIB;
  // nothing imported: an import screen, not the made-up example (that needs ?example in the address)
  const empty = !MY_LIB && !SHOW_EXAMPLE;
  document.body.classList.toggle("nodata", empty);
  if (empty && !state.stack.length) {
    renderTop(null, true);
    $("#screen").innerHTML = welcomeScreen(); screenKey = "welcome";
    syncHash();
    return;
  }
  YEARS = memo("years", () => [...new Set(state.lib.entries.map((e) => e.date.slice(0, 4)))].sort().reverse());
  if (state.scope !== "all" && !YEARS.includes(state.scope)) state.scope = "all";
  STATS = statsOf(state.scope);
  LISTS = new Map();
  const d = state.stack[state.stack.length - 1];
  renderTop(d);
  const html = d ? detailScreen(d, STATS) : SCREENS[state.view](STATS);
  const el = $("#screen"), key = d ? `${state.stack.length}:${d.type}:${d.title}` : state.view;
  const fresh = key !== screenKey;
  if (fresh) { el.innerHTML = html; screenKey = key; } else morph(el, html);
  for (const b of document.querySelectorAll(".tabbar [data-view]")) {
    if (b.dataset.view === tabOf(state.view)) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  }
  if (fresh) {
    const cal = $(".cal-wrap", el);
    if (cal) cal.scrollLeft = cal.scrollWidth;
    for (const on of el.querySelectorAll(".scopes [aria-pressed=true], .chips [aria-pressed=true], .utabs [aria-pressed=true]")) {
      const bar = on.parentElement;
      if (on.offsetLeft + on.offsetWidth > bar.clientWidth) bar.scrollLeft = on.offsetLeft - 16;
    }
  }
  if (motion && !REDUCED) { el.classList.remove("enter-push", "enter-pop", "enter-tab"); void el.offsetWidth; el.classList.add(`enter-${motion}`); }
  fillFilmo(el);
  watchMore(el);
  syncHash();
  requestAnimationFrame(updateTop);
  warmUp();
}
// While nothing is happening, work out Insights for all years and the chosen year, so its tab opens at once.
let warmQueued = false;
function warmUp() {
  if (warmQueued) return;
  warmQueued = true;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  idle(() => {
    warmQueued = false;
    const lib = state.lib;
    if (!lib.entries.length) return;
    allInsights();
    const Y = state.scope !== "all" ? state.scope : YEARS[0];
    if (Y) memo(`yins|${Y}|${crowdKey()}`, () => computeYearInsights(lib, metaOf, Y, crowdKey(), allInsights()));
  }, { timeout: 5000 });
}
$("#screen").addEventListener("animationend", (e) => { if (e.target.id === "screen") e.target.classList.remove("enter-push", "enter-pop", "enter-tab"); });

function renderTop(d, welcome) {
  $("#top").classList.toggle("detail", !!d);
  $("#nav-left").innerHTML = d ? `<button class="nav-btn" type="button" data-act="back">${BACK}<span class="sr-only">Back</span></button>`
    : welcome ? "" : `<button class="nav-btn" type="button" data-act="search">${SEARCH_ICON}<span class="sr-only">Search</span></button>`;
  const who = state.mode === "example" ? "Example diary" : state.lib.profile.username || "Your diary";
  $("#nav-title").textContent = welcome ? "Credits Roll" : d ? d.title : state.view === "profile" ? who : TITLES[state.view];
  $("#nav-right").innerHTML = welcome || (!d && state.view === "profile") ? `<button class="nav-btn" type="button" data-act="settings">${ICON.gear}<span class="sr-only">Import &amp; settings</span></button>` : "";
}
// Nothing imported (or this browser lost hold of it): how to bring your diary in.
function welcomeScreen() {
  const why = LOAD_ERROR ? `<div class="card notice"><p class="title">Your saved diary couldn't be read</p><p class="status err">${esc(LOAD_ERROR)}</p><p class="status">Import your export again.</p></div>`
    : store.failed ? `<div class="card notice"><p class="title">Your diary isn't showing</p><p class="status">This browser's saved data couldn't be opened just now. Close the app completely and open it again. If it still isn't there, import your export or a backup file again.</p></div>` : "";
  return `<section class="hero"><div class="hero-bg" aria-hidden="true"></div><div class="hero-in">
      <span class="avatar xl" aria-hidden="true">${ICON.sparkle}</span><h2 class="hname">Credits Roll</h2><p class="hhandle">Your Letterboxd diary, in numbers</p></div></section>
    ${why}<div data-sitebox="open">${siteBox("open")}</div><div class="card glow notice"><p class="title">Import your Letterboxd export</p>
      <ol class="steps"><li>On <a href="https://letterboxd.com/settings/data/" target="_blank" rel="noopener">letterboxd.com</a>, open Settings → Data.</li>
        <li>Choose Export your data and download the ZIP.</li><li>Import the ZIP here. It stays in this browser.</li></ol>
      <button class="btn green block" type="button" data-act="import">${ICON.upload}Import export</button>
      <p class="status">A backup file from another device works the same way.</p>
      ${state.importError ? `<p class="status err" role="alert">${esc(state.importError)}</p>` : ""}</div>
    ${IN_VIEWER ? `<p class="note">This Claude version keeps its own copy of an import. Your saved diary is on the website, <a href="https://sjnift.github.io/bogie1946/" target="_blank" rel="noopener">sjnift.github.io/bogie1946</a>.</p>` : ""}
    <div class="foot"><p class="stamp">Updated <!--BUILD--></p></div>`;
}
// The header frosts over once the screen scrolls under it.
function updateTop() { $("#top").classList.toggle("solid", window.scrollY > 12); }
window.addEventListener("scroll", () => { if (!renderQueued) requestAnimationFrame(updateTop); }, { passive: true });

// Switches tab (or Stats section), keeping where each one was scrolled to.
function goTo(view, opts = {}) {
  const same = state.view === view && !state.stack.length;
  if (same && !opts.force) { window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }); return; }
  if (!state.stack.length) SCROLL[state.view] = window.scrollY;
  Object.assign(state, { view, stack: [], forgetArmed: false, importNote: opts.keepNote ? state.importNote : "" });
  if (STATS_VIEWS.includes(view)) state.statsView = view;
  if ($("#sheet").open) closeSheetThen();
  saveView();
  render("tab");
  window.scrollTo(0, opts.top ? 0 : SCROLL[view] || 0);
}
function push(entry) {
  entry.ret = window.scrollY;
  state.stack.push(entry);
  render("push");
  window.scrollTo(0, 0);
}
function pop() {
  const d = state.stack.pop();
  render("pop");
  window.scrollTo(0, d ? d.ret : 0);
}
// A "Show more" that loads itself when scrolled to.
let moreObs = null;
function watchMore(root) {
  if (!("IntersectionObserver" in window)) return;
  if (!moreObs) moreObs = new IntersectionObserver((xs) => { for (const x of xs) if (x.isIntersecting && x.target.isConnected) { moreObs.unobserve(x.target); loadMore(x.target); } }, { rootMargin: "600px 0px" });
  moreObs.disconnect();
  for (const b of root.querySelectorAll("[data-auto]")) moreObs.observe(b);
}

/* ---------- pieces ---------- */
const sh = (label, right = "") => `<div class="sh"><h3>${label}</h3>${right}</div>`;
const seeAll = (attrs, label = "See all") => `<button class="more" type="button" ${attrs}>${label}${CHEV}</button>`;
const ltitle = (t, sub = "") => `<div class="lt"><div><h2 class="ltitle">${t}</h2>${sub ? `<p class="lt-sub">${sub}</p>` : ""}</div></div>`;
const scopeBar = (label = "All time") => `<div class="scopes" id="scopes" role="group" aria-label="Time period">${["all", ...YEARS].map((y) =>
  `<button class="scope" type="button" data-scope="${y}" aria-pressed="${y === state.scope}">${y === "all" ? label : y}</button>`).join("")}</div>`;
const imgTag = (src) => `<img class="fade" src="${IMG}${esc(src)}" alt="" loading="lazy" decoding="async">`;
function avatar(p, size) {
  const ph = showImages && p.key && PHOTOS[p.key];
  return `<span class="avatar ${size}" aria-hidden="true">${esc(initials(p.name || "?"))}${ph ? imgTag(ph) : ""}</span>`;
}
function poster(f) {
  const m = metaOf(f);
  return `<span class="poster"><span class="ph">${esc(f.name)}<small>${f.year || ""}</small></span>${showImages && m && m.poster ? imgTag(m.poster) : ""}</span>`;
}
const likeMark = (f) => f.liked ? '<span class="heart" aria-label="liked">♥</span>' : "";
function posterItem(f, to, caption) {
  return `<button class="pitem" type="button" data-k="${esc(f.key)}" ${dl(to || D.film(f))} title="${esc(f.name)}${f.year ? ` (${f.year})` : ""}">${poster(f)}${caption ?? `<span class="pmeta"><span class="stars">${stars(f.rating)}</span>${likeMark(f)}</span>`}</button>`;
}
const posterGrid = (films, cls = "") => `<div class="pgrid ${cls}">${films.map((f) => posterItem(f)).join("")}</div>`;
const filmsTitle = (p) => `${plural(p.count, "film")}${p.avg ? ` · ★ ${p.avg.toFixed(2)} average` : ""}`;
function personRow(p, rank, sortBest) {
  return `<button class="prow" type="button" data-k="${esc(p.name)}" data-list="${reg(p.name, filmsTitle(p), p.films, p)}">
    <span class="rk">${rank}</span>${avatar(p, "md")}
    <span style="min-width:0"><span class="nm">${esc(p.name)}</span><span class="sub">${sortBest ? plural(p.count, "film") : p.avg ? `★ ${p.avg.toFixed(2)} average` : "No ratings"}</span></span>
    <span class="val">${sortBest ? p.avg.toFixed(2) : fmtN(p.count)}</span>${CHEV}</button>`;
}
function catRow(c, max, sortBest) {
  const w = sortBest ? c.avg / 5 : c.count / max;
  return `<button class="prow cat" type="button" data-list="${reg(c.name, filmsTitle(c), c.films)}">
    <span class="nm">${esc(c.name)}</span><span class="mini" aria-hidden="true"><span style="width:${(w * 100).toFixed(1)}%"></span></span>
    <span class="val" style="text-align:right">${sortBest ? c.avg.toFixed(2) : fmtN(c.count)}</span>${CHEV}</button>`;
}
const needMeta = () => `<div class="card glow" style="margin-top:16px"><p class="title">No cast or crew yet</p>
  <p class="status">Letterboxd's export lists your films, dates and ratings, but not who's in them. Fill them in once, in Settings.</p>
  <button class="btn green" type="button" data-act="settings">Fill in cast &amp; crew</button></div>`;
const segBar = (key, items, cur, cls = "") => `<div class="seg ${cls}" role="group">${items.map(([v, l]) => `<button type="button" data-${key}="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div>`;
const chipBar = (key, items, cur) => `<div class="chips" role="group">${items.map(([v, l]) => `<button class="chip" type="button" data-${key}="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div>`;
const utabs = (key, items, cur) => `<div class="utabs" role="group">${items.map(([v, l]) => `<button class="utab" type="button" data-${key}="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div>`;

/* ---------- Profile ---------- */
function profileScreen(s) {
  const ex = state.mode === "example", lib = state.lib;
  const name = ex ? "Example diary" : lib.profile.name || lib.profile.username || "Your diary";
  const joined = !ex && lib.profile.joined ? `Member since ${MONTHS_LONG[+lib.profile.joined.slice(5, 7) - 1]} ${lib.profile.joined.slice(0, 4)}` : "";
  const handle = ex ? `<span class="pill">Example</span>` : [lib.profile.name && lib.profile.username ? `@${esc(lib.profile.username)}` : "", joined].filter(Boolean).join(" · ");
  const hours = Math.round(s.minutes / 60);
  const stat = (to, v, label) => to ? `<button type="button" ${dl(to)}><b>${v}</b><span>${label}</span></button>` : `<div><b>${v}</b><span>${label}</span></div>`;
  // the backdrop: the best-rated films with posters, blurred
  const pics = showImages ? s.films.filter((f) => f.rating && metaOf(f) && metaOf(f).poster).sort((a, b) => b.rating - a.rating || lastSeen(b).localeCompare(lastSeen(a))).slice(0, 3) : [];
  const hero = `<section class="hero"><div class="hero-bg" aria-hidden="true">${pics.map((f) => `<img src="${IMG}${esc(metaOf(f).poster)}" alt="" decoding="async">`).join("")}</div>
    <div class="hero-in">${avatar({ name: ex ? "Example" : lib.profile.username || "You" }, "xl")}<h2 class="hname">${esc(name)}</h2><p class="hhandle">${handle}</p>
    <div class="hstats">${stat(s.films.length && DR.films(s), fmtN(s.films.length), "Films")}${stat(s.timed && DR.runtime(s), s.timed ? fmtN(hours) : "—", "Hours")}
      ${stat(s.entries.length && DR.diary(s), fmtN(s.entries.length), "Entries")}${stat(s.rated && DR.rated(s), s.avgRating ? s.avgRating.toFixed(2) : "—", "Average")}</div></div></section>`;
  const notice = ex ? `<div class="card glow notice"><p class="title">This is an example diary, not yours.</p>
      <p class="status">Export your data from Letterboxd (Settings → Data → Export your data), then import the ZIP here. Your files stay in this browser.</p>
      <button class="btn green block" type="button" data-act="import">${ICON.upload}Import your export</button></div>` : "";
  const note = state.importNote ? `<div class="card notice"><p class="status" style="color:var(--ink-1)">${esc(state.importNote)}</p>${MY_LIB && MY_LIB.reviews.length ? `<button class="btn block" type="button" data-act="reviews">See your reviews</button>` : ""}</div>` : "";
  const total = lib.films.length, have = lib.films.filter((f) => metaOf(f)).length;
  const fill = !ex && have < total ? `<button class="banner" type="button" data-act="settings"><span class="ico g">${ICON.sparkle}</span>
      <span><b>${job.running ? "Looking up cast &amp; crew" : "Fill in cast &amp; crew"}</b><small>${job.running ? `${fmtN(job.done)} of ${fmtN(job.total)} films` : `${fmtN(have)} of ${plural(total, "film")} have details`}</small>
      <span class="meter" aria-hidden="true"><span style="width:${Math.round((job.running ? job.done / Math.max(1, job.total) : have / Math.max(1, total)) * 100)}%"></span></span></span>${CHEV}</button>` : "";
  const nReviews = lib.reviewTextMissing ? s.reviews : reviewsIn(lib, s.scope === "all" ? null : s.scope).length;
  const tile = (attrs, ico, cls, label, sub) => `<button class="tile" type="button" ${attrs}><span class="ico ${cls}">${ico}</span><span style="min-width:0"><b>${label}</b><small>${sub}</small></span></button>`;
  const tiles = `<div class="tiles">${tile(`data-act="reviews"`, ICON.review, "b", "Reviews", plural(nReviews, "review"))}
    ${tile(lib.watchlistFilms.length ? `data-act="watchnext"` : `${dl(DR.watchlist(lib))}`, ICON.next, "g", "Watch next", lib.watchlistFilms.length ? `${fmtN(lib.watchlistFilms.length)} on your watchlist` : "Needs a watchlist")}
    ${tile(s.likes ? dl(DR.liked(s)) : `data-act="liked"`, ICON.heart, "o", "Liked", plural(s.likes, "film"))}
    ${tile(s.rewatches ? dl(DR.rewatches(s)) : `data-view="diary"`, ICON.rewatch, "s", "Rewatches", plural(s.rewatches, "rewatch", "rewatches"))}</div>`;
  const recent = s.entries.slice(-12).reverse();
  const recentRow = recent.length ? sh(s.scope === "all" ? "Recently watched" : `Last watched in ${s.scope}`, seeAll(`data-view="diary"`, "Diary")) +
    `<div class="scroller">${recent.map((e) => posterItem(e.film, D.film(e.film, { entry: e }), `<span class="pmeta"><span class="stars">${stars(e.rating)}</span>${e.rewatch ? '<span class="rewatch" aria-label="rewatch">↻</span>' : ""}${likeMark(e.film)}</span><span class="mdate">${fmtDate(e.date)}</span>`)).join("")}</div>` : "";
  const T = s.scope === "all" ? onThisDay(lib) : null;
  const otd = T && T.entries.length ? sh(esc(T.title), T.entries.length > 4 ? seeAll(dl(T.to)) : "") +
    `<div class="scroller">${T.entries.slice(0, 12).map((e) => posterItem(e.film, D.film(e.film, { entry: e }), `<span class="pmeta"><span class="stars">${stars(e.rating)}</span></span><span class="mdate">${T.week ? fmtDate(e.date) : e.date.slice(0, 4)}</span>`)).join("")}</div>` : "";
  const ratings = s.rated ? sh("Ratings", `<span class="count">${plural(s.rated, "film")} · ★ ${s.avgRating.toFixed(2)}</span>`) + `<div class="card">` +
    colChart(s.spread.map((x) => ({ a: x.count, b: 0, tip: `${stars(x.r)} · ${plural(x.count, "film")}`, to: x.count && DR.rating(s.films, x.r) })), "How many films you gave each rating", "", 84)
      .replace('class="chart"', 'class="chart slate"').replace(/<div class="axis"[^]*?<\/div>/, "") +
    `<div class="hist-ends" style="margin-right:28px"><span class="stars">½</span><span class="stars">★★★★★</span></div></div>` : "";
  const strip = (label, data, role) => {
    const list = data.most.slice(0, 12);
    if (!list.length) return "";
    return sh(label, seeAll(`data-act="people" data-role="${role}"`)) +
      `<div class="scroller">${list.map((p) => `<button class="pcard" type="button" data-k="${esc(p.name)}" data-list="${reg(p.name, filmsTitle(p), p.films, p)}">
        ${avatar(p, "lg")}<span class="nm">${esc(p.name)}</span><span class="ct">${plural(p.count, "film")}</span></button>`).join("")}</div>`;
  };
  const people = s.withMeta ? strip("Most watched actors", s.cast, "c") + strip("Most watched directors", s.directors, "d") : "";
  const reimport = !ex && lib.reviewTextMissing ? mReimport() : "";
  const onSite = ex ? "" : `<div data-sitebox="open">${siteBox("open")}</div>`; // a newer copy of the diary is on the site
  return hero + scopeBar() + onSite + notice + note + reimport + fill + tiles + recentRow + otd + ratings + people;
}

/* ---------- Stats: films, people, genres ---------- */
const statsHead = () => ltitle("Stats") + scopeBar() + segBar("view", [["films", "Films"], ["people", "People"], ["genres", "Breakdown"]], state.view);
function peopleScreen(s) {
  const role = state.role;
  const data = { c: s.cast, d: s.directors, w: s.writers, p: s.dop, m: s.music }[role] || s.cast;
  const best = state.sort === "best";
  const list = best ? data.best : data.most;
  const head = statsHead() + chipBar("role", [["c", "Actors"], ["d", "Directors"], ["w", "Writers"], ["p", "Camera"], ["m", "Music"]], role) +
    segBar("sort", [["most", "Most watched"], ["best", "Highest rated"]], state.sort, "small");
  if (!s.withMeta) return head + needMeta();
  const note = role === "c" ? `Counts the top ${CAST_DEPTH} billed cast of each film.` : "";
  const bestNote = best ? `${note ? " " : ""}Highest rated needs ${role === "c" ? s.castMinRated : s.minRated} or more rated films.` : "";
  const val = (p) => best ? `★ ${p.avg.toFixed(2)}` : plural(p.count, "film");
  const podium = list.length >= 3 ? `<div class="podium">${[1, 0, 2].map((i) => { const p = list[i];
    return `<button class="pod${i ? "" : " first"}" type="button" data-list="${reg(p.name, filmsTitle(p), p.films, p)}">${avatar(p, "lg")}<span class="rkb">${i + 1}</span><span class="nm">${esc(p.name)}</span><span class="ct">${val(p)}</span></button>`; }).join("")}</div>` : "";
  const from = podium ? 3 : 0;
  const rows = list.slice(from, state.peopleLimit).map((p, i) => personRow(p, i + from + 1, best)).join("");
  const more = list.length > state.peopleLimit ? `<button class="row" type="button" data-act="more-people" data-auto><span>Show more</span><span class="count">${fmtN(list.length - state.peopleLimit)} more</span>${CHEV}</button>` : "";
  const label = { c: "actors", d: "directors", w: "writers", p: "cinematographers", m: "composers" }[role];
  return head + (list.length ? podium + sh(`${fmtN(list.length)} ${label}`) + (note + bestNote ? `<p class="status" style="margin:-6px 0 10px">${esc(note + bestNote)}</p>` : "") +
    (rows ? `<div class="group">${rows}${more}</div>` : "") : `<div class="empty">Nobody to show for this period.${bestNote ? ` ${esc(bestNote)}` : ""}</div>`);
}
</script>
