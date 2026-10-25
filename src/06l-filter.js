<script>
/* ---------- filters: the Stats pages narrowed to a genre, a decade, a country or a language ----------
   Everything on the computer's main page, and on the phone's Profile, Diary and Stats, is worked out from the diary
   seen through the filters: its films that pass, their diary entries, reviews and watchlist. Insights and Compare
   always use the whole diary. Filters last until the page is closed. */
const FILTERS = [["g", "Genre"], ["d", "Decade"], ["k", "Country"], ["l", "Language"]];
// Each group takes any number of picks (asked Oct 2026). A film can have several genres and countries, so with two or
// more picked there, a switch says whether it needs any of them or all of them; a film has one decade and one
// language, so those always match any.
const FILTER = { g: [], d: [], k: [], l: [] };
const FILTER_ALL = { g: false, k: false };
const FILTER_BOTH = new Set(["g", "k"]);
const filterOn = () => FILTERS.some(([k]) => FILTER[k].length);
const groupAll = (k) => FILTER_BOTH.has(k) && FILTER_ALL[k] && FILTER[k].length > 1;
function clearFilters() { for (const [k] of FILTERS) FILTER[k] = []; FILTER_ALL.g = FILTER_ALL.k = false; }
// What a film offers each filter (genres and countries need cast & crew details; decades come with the export)
function facetValues(f, key, metaOf) {
  if (key === "d") return f.year ? [`${Math.floor(f.year / 10) * 10}s`] : [];
  const m = metaOf(f);
  if (!m) return [];
  return key === "g" ? m.g || [] : key === "k" ? m.k || [] : m.l ? [m.l] : [];
}
function groupPasses(vals, k) {
  const picks = FILTER[k];
  return !picks.length || (groupAll(k) ? picks.every((v) => vals.includes(v)) : picks.some((v) => vals.includes(v)));
}
const filmPasses = (f, metaOf, except) => FILTERS.every(([k]) => k === except || groupPasses(facetValues(f, k, metaOf), k));
// The same library object while the filters, the diary and its details stay the same, so worked-out stats are kept.
let FILTERED = null;
function filteredLib(lib, metaOf) {
  if (!lib || !filterOn()) return lib;
  const sig = `${FILTERS.map(([k]) => FILTER[k].join("\u0001") + (groupAll(k) ? "&" : "|")).join("/")}|${DATA_REV}|${Object.keys(META).length}`;
  if (FILTERED && FILTERED.base === lib && FILTERED.sig === sig && FILTERED.meta === META) return FILTERED.lib;
  const keep = (f) => filmPasses(f, metaOf);
  const films = lib.films.filter(keep), set = new Set(films);
  const watchlistFilms = lib.watchlistFilms.filter(keep);
  const out = { ...lib, films, entries: lib.entries.filter((e) => set.has(e.film)), reviews: lib.reviews.filter((r) => set.has(r.film)),
    watchlistFilms, watchlist: watchlistFilms.length, filtered: true };
  FILTERED = { base: lib, sig, meta: META, lib: out };
  return out;
}
// The choices for one filter, with how many films each has given the other filters (and, matching all of a group's
// picks, given those picks too), most first (decades in order).
function filterOptions(lib, metaOf, key) {
  const counts = new Map(), every = FILTER_BOTH.has(key) && FILTER_ALL[key];
  for (const f of lib.films) {
    if (!filmPasses(f, metaOf, key)) continue;
    const vals = new Set(facetValues(f, key, metaOf));
    if (every && !FILTER[key].every((p) => vals.has(p))) continue;
    for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts].sort((a, b) => key === "d" ? a[0].localeCompare(b[0]) : b[1] - a[1] || a[0].localeCompare(b[0]));
}
// "Horror or Thriller films from the 1970s, made in France and Italy, in French"
const joinWords = (xs, word) => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${word} ${xs[xs.length - 1]}`;
function filterText() {
  if (!filterOn()) return "";
  const w = (k) => joinWords(FILTER[k], groupAll(k) ? "and" : "or");
  return `${FILTER.g.length ? `${w("g")} films` : "Films"}${FILTER.d.length ? ` from the ${w("d")}` : ""}${FILTER.k.length ? `, made in ${w("k")}` : ""}${FILTER.l.length ? `, in ${w("l")}` : ""}`;
}
// The whole diary (the filters narrow it, never the other way round).
const wholeLib = () => state.mode === "mine" && MY_LIB ? MY_LIB : EXAMPLE_LIB;
// The panel of choices, in the pop-up (computer) or the sheet (phone), opened by the Filter button. Plain buttons, not
// menus: Safari froze or went blank when a menu was replaced in the page while it was being used (owner, Oct 2026).
D.filters = () => ({ kind: "filters", title: "Filter your stats", sub: "" }); // no explanation: the choices speak for themselves (owner, Oct 2026)
const FILTER_SHOWN = 14; // choices shown at first in each group; the rest behind "More"
const filterMore = new Set();
function filtersInner() {
  const lib = wholeLib();
  if (!lib) return "";
  const n = filterOn() ? filteredLib(lib, metaOf).films.length : lib.films.length;
  const groups = FILTERS.map(([k, label]) => {
    const opts = filterOptions(lib, metaOf, k);
    if (!opts.length) return k === "d" ? "" : `<section class="fp-group"><h4>${label}</h4><p class="fp-none">${label === "Decade" ? "" : "Comes with cast &amp; crew details."}</p></section>`;
    const picks = FILTER[k];
    const cur = picks.filter((v) => !opts.some(([o]) => o === v)).map((v) => [v, 0]);
    const all = [...cur, ...opts], many = all.length > FILTER_SHOWN && !filterMore.has(k);
    const shown = many ? all.filter(([v], i) => i < FILTER_SHOWN || picks.includes(v)) : all;
    const mode = FILTER_BOTH.has(k) && picks.length > 1 ? `<div class="fp-mode" role="group" aria-label="A film needs">${[["any", "Any of these"], ["all", "All of these"]].map(([m, l]) =>
      `<button type="button" data-fmode="${k}" data-fval="${m}" aria-pressed="${(m === "all") === FILTER_ALL[k]}">${l}</button>`).join("")}</div>` : "";
    return `<section class="fp-group"><h4>${label}${picks.length ? ` <button class="fp-x" type="button" data-fclear="${k}">Clear</button>` : ""}</h4>${mode}
      <div class="fp-chips">${shown.map(([v, c]) => `<button class="fp-chip" type="button" data-fpick="${k}" data-fval="${esc(v)}" aria-pressed="${picks.includes(v)}">${esc(v)}<span>${fmtN(c)}</span></button>`).join("")}
      ${many ? `<button class="fp-more" type="button" data-fmore="${k}">${fmtN(all.length - shown.length)} more</button>` : ""}</div></section>`;
  }).join("");
  return `${groups}<div class="fp-foot">${filterOn() ? `<button class="btn small" type="button" data-filter-clear>Clear</button>` : ""}
    <button class="btn small primary green" type="button" data-close data-sclose>${filterOn() ? `Show ${plural(n, "film")}` : "Done"}</button></div>`;
}
const filtersBodyHtml = () => `<div class="fpanel">${filtersInner()}</div>`;
// The line that says a filter is on, with a way off. `n` is how many films pass.
const filterStripHtml = (n) => filterOn() ? `<div class="fstrip" role="status"><span>${esc(filterText())} <b>· ${plural(n, "film")}</b></span>
  <button class="fstrip-edit" type="button" ${dl(D.filters())}>Change</button><button class="fstrip-x" type="button" data-filter-clear>Clear</button></div>` : "";
// After a choice: the panel shows it at once, the page underneath follows a moment later.
let filterRedraw = 0;
function refreshFilters() {
  for (const el of document.querySelectorAll(".fpanel")) el.innerHTML = filtersInner();
  cancelAnimationFrame(filterRedraw);
  filterRedraw = requestAnimationFrame(() => { try { render(); } catch (e) { clearFilters(); render(); } });
}
document.addEventListener("click", (e) => {
  const pick = e.target.closest("[data-fpick]");
  if (pick) {
    const k = pick.dataset.fpick, v = pick.dataset.fval;
    FILTER[k] = FILTER[k].includes(v) ? FILTER[k].filter((x) => x !== v) : [...FILTER[k], v];
    if (FILTER[k].length < 2 && k in FILTER_ALL) FILTER_ALL[k] = false; // the switch shows again from "any" with two picks
    refreshFilters(); return;
  }
  const mode = e.target.closest("[data-fmode]");
  if (mode) { FILTER_ALL[mode.dataset.fmode] = mode.dataset.fval === "all"; refreshFilters(); return; }
  const group = e.target.closest("[data-fclear]");
  if (group) { const k = group.dataset.fclear; FILTER[k] = []; if (k in FILTER_ALL) FILTER_ALL[k] = false; refreshFilters(); return; }
  const more = e.target.closest("[data-fmore]");
  if (more) { filterMore.add(more.dataset.fmore); for (const el of document.querySelectorAll(".fpanel")) el.innerHTML = filtersInner(); return; }
  if (e.target.closest("[data-filter-clear]")) { clearFilters(); refreshFilters(); }
});
// With a filter on, sections it leaves empty are left out rather than shown as "nothing here".
function dropEmpties(html, isEmpty) {
  const t = document.createElement("template");
  t.innerHTML = html;
  isEmpty(t.content);
  return t.innerHTML;
}
</script>
