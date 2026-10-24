<script>
/* ---------- filters: the Stats pages narrowed to a genre, a decade, a country or a language ----------
   Everything on the computer's main page, and on the phone's Profile, Diary and Stats, is worked out from the diary
   seen through the filters: its films that pass, their diary entries, reviews and watchlist. Insights and Compare
   always use the whole diary. Filters last until the page is closed. */
const FILTERS = [["g", "Genre"], ["d", "Decade"], ["k", "Country"], ["l", "Language"]];
const FILTER = { g: "", d: "", k: "", l: "" };
const filterOn = () => FILTERS.some(([k]) => FILTER[k]);
// What a film offers each filter (genres and countries need cast & crew details; decades come with the export)
function facetValues(f, key, metaOf) {
  if (key === "d") return f.year ? [`${Math.floor(f.year / 10) * 10}s`] : [];
  const m = metaOf(f);
  if (!m) return [];
  return key === "g" ? m.g || [] : key === "k" ? m.k || [] : m.l ? [m.l] : [];
}
const filmPasses = (f, metaOf, except) => FILTERS.every(([k]) => k === except || !FILTER[k] || facetValues(f, k, metaOf).includes(FILTER[k]));
// The same library object while the filters, the diary and its details stay the same, so worked-out stats are kept.
let FILTERED = null;
function filteredLib(lib, metaOf) {
  if (!lib || !filterOn()) return lib;
  const sig = `${FILTERS.map(([k]) => FILTER[k]).join("|")}|${DATA_REV}|${Object.keys(META).length}`;
  if (FILTERED && FILTERED.base === lib && FILTERED.sig === sig && FILTERED.meta === META) return FILTERED.lib;
  const keep = (f) => filmPasses(f, metaOf);
  const films = lib.films.filter(keep), set = new Set(films);
  const watchlistFilms = lib.watchlistFilms.filter(keep);
  const out = { ...lib, films, entries: lib.entries.filter((e) => set.has(e.film)), reviews: lib.reviews.filter((r) => set.has(r.film)),
    watchlistFilms, watchlist: watchlistFilms.length, filtered: true };
  FILTERED = { base: lib, sig, meta: META, lib: out };
  return out;
}
// The choices for one filter, with how many films each would leave given the other filters, most first (decades in order).
function filterOptions(lib, metaOf, key) {
  const counts = new Map();
  for (const f of lib.films) if (filmPasses(f, metaOf, key)) for (const v of new Set(facetValues(f, key, metaOf))) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts].sort((a, b) => key === "d" ? a[0].localeCompare(b[0]) : b[1] - a[1] || a[0].localeCompare(b[0]));
}
// "Horror films from the 1970s, made in France, in French"
function filterText() {
  if (!filterOn()) return "";
  return `${FILTER.g ? `${FILTER.g} films` : "Films"}${FILTER.d ? ` from the ${FILTER.d}` : ""}${FILTER.k ? `, made in ${FILTER.k}` : ""}${FILTER.l ? `, in ${FILTER.l}` : ""}`;
}
// The row of filters: one menu each, and a way to clear them. `lib` is the whole diary.
function filterBar(lib, metaOf) {
  if (!lib || !lib.films.length) return "";
  const sel = ([k, label]) => {
    const opts = filterOptions(lib, metaOf, k);
    if (!opts.length && !FILTER[k]) return "";
    const cur = FILTER[k] && !opts.some(([v]) => v === FILTER[k]) ? [[FILTER[k], 0]] : [];
    return `<label class="fsel${FILTER[k] ? " on" : ""}"><span class="sr-only">${label}</span><select data-filter="${k}">
      <option value="">${FILTER[k] ? `Any ${label.toLowerCase()}` : label}</option>${[...cur, ...opts].map(([v, n]) => `<option value="${esc(v)}"${v === FILTER[k] ? " selected" : ""}>${esc(v)} (${fmtN(n)})</option>`).join("")}</select></label>`;
  };
  const sels = FILTERS.map(sel).join("");
  if (!sels) return "";
  return `<div class="filters" role="group" aria-label="Filter the films">${sels}${filterOn() ? `<button class="fclear" type="button" data-filter-clear>Clear filters</button>` : ""}</div>`;
}
// After a redraw, each menu shows the filter in force (a menu the viewer used doesn't follow its markup any more).
const syncFilterMenus = (root = document) => { for (const s of root.querySelectorAll("select[data-filter]")) if (s.value !== FILTER[s.dataset.filter]) s.value = FILTER[s.dataset.filter]; };
document.addEventListener("change", (e) => {
  const s = e.target.closest && e.target.closest("select[data-filter]");
  if (!s) return;
  FILTER[s.dataset.filter] = s.value;
  render();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-filter-clear]")) return;
  for (const [k] of FILTERS) FILTER[k] = "";
  render();
});
</script>
