<script>
/* ---------- phone: addresses you can bookmark, and the back button ----------
   #/profile, #/diary, #/films, #/people, #/genres for the tabs; #/insights/2024 for Insights of a year;
   #/compare/<friend>; #/data (settings), #/reviews, #/watchnext and #/list for pushed screens; /film/<film> on
   the end opens that film's card. Every tab, screen and sheet is a history entry, so the phone's back gesture
   steps back the way it came. */
let sheetDepth = 0, closingByHistory = false, afterClose = null, routeReady = false, routeReplace = false;
const PUSHED = { data: "Settings", reviews: "Reviews", watchnext: "Watch next" };
function routeBase() {
  const top = state.stack[state.stack.length - 1];
  if (!top) {
    if (state.view === "insights") return `#/insights${state.scope !== "all" ? "/" + state.scope : ""}`;
    if (state.view === "compare") return `#/compare${state.cmp ? "/" + encodeURIComponent(state.cmp) : ""}`;
    return `#/${state.view}`;
  }
  return PUSHED[top.type] ? `#/${top.type}` : "#/list";
}
const hashParts = () => {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")), m = h.match(/^(.*?)\/?film\/(.+)$/);
  return m ? { base: m[1], film: m[2] } : { base: h, film: null };
};
const filmHash = (key) => `${routeBase().replace(/\/$/, "")}/film/${encodeURIComponent(key)}`;
function routeFromHash() {
  const [a, b] = hashParts().base.split("/");
  if (!a) return;
  if (TOP_VIEWS.includes(a)) {
    Object.assign(state, { view: a, stack: [] });
    if (STATS_VIEWS.includes(a)) state.statsView = a;
    if (a === "insights") state.scope = b || "all";
    if (a === "compare" && b) state.cmp = b;
    return;
  }
  if (PUSHED[a]) {
    const top = state.stack[state.stack.length - 1];
    if (!top || top.type !== a) state.stack = [{ type: a, title: PUSHED[a], ret: 0 }];
  } else if (a === "list" && !(state.stack.length && state.stack[state.stack.length - 1].type === "drill")) state.stack = [];
}
// After a render: a new tab or screen becomes a history entry; a new year or friend replaces the address.
function syncHash(replace) {
  if (!routeReady || sheetDepth) return;
  const want = routeBase();
  if (`#/${hashParts().base}` === want) return;
  try { replace || routeReplace ? history.replaceState(history.state, "", want) : history.pushState({ app: 1 }, "", want); } catch {}
}
function pushSheetState() {
  const d = SSTACK[SSTACK.length - 1];
  try { history.pushState({ sheet: SSTACK.length }, "", d.kind === "film" && d.film ? filmHash(d.film.key) : routeBase()); sheetDepth = SSTACK.length; } catch { sheetDepth = 0; }
}
// Closes the sheet and takes its history entries with it, then runs `next`.
function closeSheetThen(next) {
  const sheet = $("#sheet");
  if (!sheet.open) { next && next(); return; }
  const n = sheetDepth;
  closingByHistory = true; sheet.close();
  if (n) { afterClose = next || null; history.go(-n); } else { closingByHistory = false; next && next(); }
}
function onSheetClosed() {
  SSTACK = []; PANEL = new Map();
  if (!closingByHistory && sheetDepth) { const n = sheetDepth; sheetDepth = 0; closingByHistory = true; history.go(-n); return; }
  if (!closingByHistory) sheetDepth = 0;
}
function onPopState() {
  const depth = (history.state && history.state.sheet) || 0, sheet = $("#sheet");
  if (closingByHistory) {
    if (depth) return;
    closingByHistory = false; sheetDepth = 0;
    const next = afterClose; afterClose = null;
    if (next) next();
    return;
  }
  if (sheet.open && depth && depth < SSTACK.length) { SSTACK = SSTACK.slice(0, depth); sheetDepth = depth; paintSheet("back"); return; }
  if (sheet.open) { closingByHistory = true; sheet.close(); closingByHistory = false; sheetDepth = 0; }
  // back out of a pushed screen to whatever is under it, where it was scrolled to
  const a = hashParts().base.split("/")[0], top = state.stack[state.stack.length - 1], under = state.stack[state.stack.length - 2];
  routeReplace = true;
  if (top && (under ? under.type === a : !PUSHED[a] && a !== "list")) {
    const d = state.stack.pop();
    if (!state.stack.length && TOP_VIEWS.includes(a)) state.view = a;
    render("pop"); window.scrollTo(0, d.ret || 0);
  } else {
    const was = state.view, had = state.stack.length;
    if (!had) SCROLL[was] = window.scrollY;
    routeFromHash(); render(state.view !== was || had ? "tab" : "");
    window.scrollTo(0, state.view !== was ? SCROLL[state.view] || 0 : window.scrollY);
  }
  routeReplace = false;
  if (!depth) openRouteFilm();
}
function openRouteFilm() {
  const { film } = hashParts();
  if (!film || (!MY_LIB && !SHOW_EXAMPLE)) return;
  const f = state.lib.films.find((x) => x.key === film) || (MY_LIB && MY_LIB.watchlistFilms.find((x) => x.key === film));
  try { history.replaceState(null, "", routeBase()); } catch {}
  if (f) openSheet(D.film(f));
}
function openSearch() {
  const top = SSTACK[SSTACK.length - 1];
  if ($("#sheet").open && top && top.kind === "search") { $("#search-q")?.focus(); return; }
  openSheet({ kind: "search", title: "Search your diary", sub: "", q: "" }, $("#sheet").open);
}
const repaintDrill = () => { if ($("#sheet").open) paintSheet(); else render(); };
</script>
