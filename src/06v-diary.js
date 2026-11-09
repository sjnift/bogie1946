<script>
/* ---------- the diary as Letterboxd shows it (asked 7 Nov 2026: "build a diary tab on website", then "build it like
   letterboxd with same filters"): every diary entry, newest first, with the filters of Letterboxd's diary page: Year
   (the year chips themselves), Rating, Decade and Genre (the page's own filter, so the rest of the page follows and the
   strip says so), Sort by, and what to show (liked, reviewed, rewatches). The computer's Diary chapter (07-render-d) and
   the phone's Diary tab (m04-screens) draw it. Menus are plain buttons shown and hidden in place, never <select>s
   redrawn while in use (Safari froze on those, Oct 2026). They last until the page is closed, like the filters. */
const DIARY = { rating: "any", sort: "watched", show: "all", menu: null, n: 0 };
const DIARY_PAGE = 100; // the computer's rows at first, and with each "Show more" (the phone keeps its own, diaryLimit)
// Letterboxd's sorts, in its order and words
const DIARY_SORTS = [["When watched", [["watched", "Newest first"], ["watched-asc", "Earliest first"]]],
  ["Film name", [["name", "A to Z"], ["name-desc", "Z to A"]]],
  ["Release date", [["released", "Newest first"], ["released-asc", "Earliest first"]]],
  ["Your rating", [["rating", "Highest first"], ["rating-asc", "Lowest first"]]],
  ["Average rating", [["avg", "Highest first"], ["avg-asc", "Lowest first"]]],
  ["Film popularity", [["popular", "Most popular first"], ["popular-asc", "Least popular first"]]],
  ["Film length", [["length-asc", "Shortest first"], ["length", "Longest first"]]]];
const DIARY_RATINGS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];
const diarySortName = (v) => { for (const [g, xs] of DIARY_SORTS) for (const [k, l] of xs) if (k === v) return `${g}${k === "watched" ? "" : `, ${l.toLowerCase()}`}`; return ""; };
// What to show (Letterboxd's eye menu): rewatches only where the diary marks them, "logged here" only where there are some.
function diaryShows(lib) {
  return [["all", "Every entry"], ["liked", "Liked films"], ["reviewed", "Reviewed"],
    ...(everRewatched(lib) ? [["rewatch", "Rewatches"], ["first", "First watches"]] : []),
    ...(lib.entries.some((e) => e.local) ? [["here", "Logged on this site"]] : [])];
}
const diaryFiltered = () => DIARY.rating !== "any" || DIARY.show !== "all";
const diaryPasses = (e) => (DIARY.rating === "any" || (DIARY.rating === "none" ? !e.rating : e.rating === +DIARY.rating))
  && (DIARY.show === "all" || (DIARY.show === "liked" ? e.film.liked : DIARY.show === "reviewed" ? e.review
    : DIARY.show === "rewatch" ? e.rewatch : DIARY.show === "first" ? !e.rewatch : DIARY.show === "here" ? !!e.local : true));
// Leading articles don't count in a name sort, as on Letterboxd ("The Godfather" under G).
const sortTitle = (n) => String(n || "").replace(/^(the|a|an)\s+/i, "");
// Letterboxd's average where it's known, else TMDB's score in stars; how widely seen: Letterboxd's ratings, else TMDB's votes.
const crowdStars = (f) => { const x = LBX[f.key], m = metaOf(f); return x && x.r ? x.r : m && m.va ? m.va / 2 : null; };
const crowdSize = (f) => { const x = LBX[f.key], m = metaOf(f); return x && x.n ? x.n : m && m.vc ? m.vc : null; };
const byWatched = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (b.order || 0) - (a.order || 0);
// The entries to show, in the order picked; anything without the value sorted on goes last, newest first among equals.
function diaryList(entries) {
  const list = entries.filter(diaryPasses), S = DIARY.sort, up = /-asc$/.test(S), k = S.replace(/-(asc|desc)$/, "");
  if (k === "watched") return up ? list : list.reverse();
  if (k === "name") return list.sort((a, b) => byName(sortTitle(a.film.name), sortTitle(b.film.name)) * (S === "name-desc" ? -1 : 1) || byWatched(b, a));
  const val = { released: (e) => e.film.year || null, rating: (e) => e.rating || null, avg: (e) => crowdStars(e.film),
    popular: (e) => crowdSize(e.film), length: (e) => (metaOf(e.film) || {}).r || null }[k];
  const vs = new Map(list.map((e) => [e, val(e)]));
  return list.sort((a, b) => { const x = vs.get(a), y = vs.get(b);
    if (x == null || y == null) return (x == null) - (y == null) || byWatched(b, a);
    return (up ? x - y : y - x) || byWatched(b, a); });
}
// The bar of menus over the diary. `lib` is the whole diary (the choices), `s` the stats of what's on show.
function diaryBarHtml(s) {
  const lib = wholeLib(), years = diaryYears(lib).reverse();
  const opt = (attrs, text, on) => `<button class="dd-opt" type="button" role="menuitemradio" aria-checked="${!!on}" ${attrs}>${text}</button>`;
  const head = (t) => `<span class="dd-h" role="presentation">${t}</span>`;
  const dd = (id, label, value, opts, on) => { const open = DIARY.menu === id;
    return `<div class="dd${on ? " on" : ""}"><button class="dd-btn" type="button" data-dmenu="${id}" aria-haspopup="menu" aria-expanded="${open}">${label}${value ? ` <b>${value}</b>` : ""}<span class="dd-caret" aria-hidden="true">▾</span></button>
      <div class="dd-menu" role="menu" aria-label="${label}"${open ? "" : " hidden"}>${opts}</div></div>`; };
  const pick = (k, v) => `data-dpick="${k}" data-dval="${esc(v)}"`;
  const one = (k, what) => FILTER[k].length === 1 ? esc(FILTER[k][0]) : FILTER[k].length ? `${FILTER[k].length} ${what}` : "";
  const year = dd("year", "Year", s.scope === "all" ? "" : esc(s.scope),
    opt(`data-dpick="year" data-scope="all"`, "All years", s.scope === "all") + years.map((y) => opt(`data-dpick="year" data-scope="${esc(y)}"`, esc(y), s.scope === y)).join(""), s.scope !== "all");
  const rating = dd("rating", "Rating", DIARY.rating === "any" ? "" : DIARY.rating === "none" ? "None" : `<span class="stars">${stars(+DIARY.rating)}</span>`,
    opt(pick("rating", "any"), "Any rating", DIARY.rating === "any") + opt(pick("rating", "none"), "No rating", DIARY.rating === "none")
      + DIARY_RATINGS.map((r) => opt(pick("rating", r), `<span class="stars">${stars(r)}</span><span class="sr-only"> ${r} stars</span>`, +DIARY.rating === r)).join(""), DIARY.rating !== "any");
  const decades = filterOptions(lib, metaOf, "d").map(([v]) => v).reverse();
  const decade = decades.length ? dd("decade", "Decade", one("d", "decades"),
    opt(pick("d", ""), "Any decade", !FILTER.d.length) + decades.map((v) => opt(pick("d", v), esc(v), FILTER.d.length === 1 && FILTER.d[0] === v)).join(""), FILTER.d.length > 0) : "";
  const genres = filterOptions(lib, metaOf, "g").map(([v]) => v).sort(byName);
  const genre = genres.length ? dd("genre", "Genre", one("g", "genres"),
    opt(pick("g", ""), "Any genre", !FILTER.g.length) + genres.map((v) => opt(pick("g", v), esc(v), FILTER.g.length === 1 && FILTER.g[0] === v)).join(""), FILTER.g.length > 0) : "";
  const sort = dd("sort", "Sort by", esc(diarySortName(DIARY.sort)),
    DIARY_SORTS.map(([g, xs]) => head(g) + xs.map(([k, l]) => opt(pick("sort", k), l, DIARY.sort === k)).join("")).join(""), false);
  const shows = diaryShows(lib), cur = shows.find(([k]) => k === DIARY.show) || shows[0];
  const show = dd("show", "Show", cur[0] === "all" ? "" : cur[1], shows.map(([k, l]) => opt(pick("show", k), l, cur[0] === k)).join(""), cur[0] !== "all");
  return `<div class="dfilt" role="group" aria-label="Filter and sort the diary">${year}${rating}${decade}${genre}${show}<span class="dfilt-gap"></span>${sort}</div>`;
}
// The line over the entries: how many, of how many, and a way back to all of them.
function diaryCountHtml(shown, s) {
  const lib = wholeLib(), all = s.scope === "all" ? lib.entries.length : lib.entries.filter((e) => e.date.startsWith(s.scope)).length;
  const narrowed = diaryFiltered() || filterOn();
  return `<p class="dcount" role="status">${narrowed ? `${fmtN(shown)} of ${plural(all, "diary entry", "diary entries")}` : plural(shown, "diary entry", "diary entries")}${s.scope === "all" ? "" : ` in ${esc(s.scope)}`}${narrowed ? ` <button class="dclear" type="button" data-dclear>Clear filters</button>` : ""}</p>`;
}
// Opening or closing a menu changes nothing else, so nothing is redrawn (and a click elsewhere still does what it does).
function diaryMenu(id, focus) {
  DIARY.menu = id;
  for (const d of document.querySelectorAll(".dd")) {
    const b = d.querySelector("[data-dmenu]"), m = d.querySelector(".dd-menu"), on = !!b && b.dataset.dmenu === id;
    if (!b || !m) continue;
    b.setAttribute("aria-expanded", on); m.hidden = !on;
    if (on) { const o = m.querySelector('[aria-checked="true"]') || m.querySelector(".dd-opt"); if (o) { m.scrollTop = Math.max(0, o.offsetTop - 48); if (focus) o.focus({ preventScroll: true }); } }
  }
}
const diaryRedraw = () => SITE_DEVICE === "phone" ? render() : renderSections(STATS);
document.addEventListener("click", (e) => {
  const t = e.target.closest && e.target.closest("[data-dmenu],[data-dpick],[data-dmore],[data-dclear]");
  if (!t) { if (DIARY.menu && !(e.target.closest && e.target.closest(".dd"))) diaryMenu(null); return; }
  if (t.dataset.dmenu) { diaryMenu(DIARY.menu === t.dataset.dmenu ? null : t.dataset.dmenu, e.detail === 0); return; }
  if (t.hasAttribute("data-dmore")) { DIARY.n += DIARY_PAGE; diaryRedraw(); return; }
  DIARY.menu = null; DIARY.n = 0;
  if (typeof state.diaryLimit === "number") state.diaryLimit = 40; // the phone's list starts again from the top
  if (t.hasAttribute("data-dclear")) { DIARY.rating = "any"; DIARY.show = "all"; if (filterOn()) { clearFilters(); refreshFilters(); } else diaryRedraw(); return; }
  const k = t.dataset.dpick, v = t.dataset.dval;
  if (k === "year") return; // the year chips' own handler (data-scope) redraws the page for that year
  if (k === "d" || k === "g") { FILTER[k] = v ? [v] : []; if (k in FILTER_ALL) FILTER_ALL[k] = false; refreshFilters(); return; }
  DIARY[k] = v; diaryRedraw();
});
// Keys: Escape closes the menu (back to its button), the arrows move along its choices.
document.addEventListener("keydown", (e) => {
  if (!DIARY.menu) return;
  const m = document.querySelector(".dd-menu:not([hidden])");
  if (!m) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const id = DIARY.menu; diaryMenu(null); document.querySelector(`[data-dmenu="${id}"]`)?.focus(); return; }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const os = [...m.querySelectorAll(".dd-opt")], i = os.indexOf(document.activeElement);
  e.preventDefault(); os[(i + (e.key === "ArrowDown" ? 1 : -1) + os.length) % os.length]?.focus();
}, true);
</script>
