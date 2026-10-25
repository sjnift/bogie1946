<script>
/* ---------- desktop: a click opens the data behind it in a pop-up; a long list can go on a page of its own ---------- */
let DSTACK = [];
function panelHeadHtml(d) {
  const face = d.person && d.person.key ? faceHtml(d.person) : "";
  return `<div class="dlg-head">${DSTACK.length > 1 ? `<button class="btn small" type="button" data-dback><span aria-hidden="true">←</span> Back</button>` : ""}${face}
    <div style="min-width:0"><h3 id="dlg-title">${esc(d.title)}</h3>${d.sub ? `<div class="muted" style="font-size:13px">${esc(d.sub)}</div>` : ""}</div>
    <button class="btn small close" type="button" data-close>Close</button></div>`;
}
function paintPanel() {
  const dlg = $("#dlg"), d = DSTACK[DSTACK.length - 1];
  PANEL = new Map();
  const { html, hidden } = inPanel(() => drillBody(d, PANEL_CAP));
  const n = drillSize(d);
  const foot = hidden ? `<div class="dlg-foot"><span class="status">Showing ${fmtN(n - hidden)} of ${fmtN(n)}</span>
    <button class="btn small primary" type="button" data-drillpage>See all ${fmtN(n)} on one page</button></div>` : "";
  dlg.innerHTML = inPanel(() => panelHeadHtml(d)) + `<div class="dlg-body">${html}</div>` + foot;
  dlg.classList.toggle("wide", d.kind === "film" || d.kind === "reviews" || d.kind === "search");
  dlg.classList.toggle("tall", d.kind === "share");
  if (!dlg.open) { if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", ""); }
  const body = dlg.querySelector(".dlg-body");
  if (body) body.scrollTop = 0;
  const q = $("#search-q");
  if (q && d.kind === "search") { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  fillFilmo(dlg); fillShare(dlg); fillStory(dlg);
}
const repaintDrill = () => { if ($("#dlg").open) paintPanel(); else if (state.page === "drill") renderDrillPage(); };
// From the page a drill starts a new pop-up; from inside the pop-up it stacks, with Back. Each step is a
// browser history entry, so the back button steps back through the pop-up and then closes it.
function openDrill(d, inside) {
  if (!d) return;
  DSTACK = inside ? [...DSTACK, d] : [d];
  paintPanel();
  pushPanelState();
}

/* ----- the full page ----- */
function openDrillPage(d) {
  if (state.page !== "drill") state.drillBack = { page: state.page, y: window.scrollY };
  const go = () => {
    Object.assign(state, { page: "drill", drill: d, drillLimit: 300 });
    render();
    window.scrollTo(0, 0);
  };
  closePanelThen(go);
}
function renderDrillPage() {
  const d = state.drill;
  $("#hero-title").innerHTML = esc(d.title);
  $("#hero-sub").textContent = d.sub || "";
  const { html, hidden } = drillBody(d, state.drillLimit);
  $("#drillpage").innerHTML = `<div class="drill-bar"><button class="btn small" type="button" data-drillback><span aria-hidden="true">←</span> Back</button></div>
    <div class="drill-page${d.kind === "reviews" ? " wide" : ""}">${html}</div>
    ${hidden ? `<p class="drill-bar"><button class="btn small" type="button" data-drillmore>Show more (${fmtN(hidden)} left)</button></p>` : ""}`;
  fillFilmo($("#drillpage"));
}
</script>
<script>
/* ---------- desktop: addresses you can bookmark, and the back button ----------
   #/ and #/2024 are the stats, #/insights and #/insights/2024 the insights, #/compare/<friend> a comparison,
   #/settings the settings.
   /film/<film> on the end opens that film's card. */
const routeBase = () => state.page === "insights" ? `#/insights${state.insYear !== "all" ? "/" + state.insYear : ""}`
  : state.page === "compare" ? `#/compare${state.cmp ? "/" + encodeURIComponent(state.cmp) : ""}`
  : state.page === "drill" ? "#/list" : state.page === "settings" ? "#/settings" : state.scope === "all" ? "#/" : `#/${state.scope}`;
const hashParts = () => {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")), m = h.match(/^(.*?)\/?film\/(.+)$/);
  return m ? { base: m[1], film: m[2] } : { base: h, film: null };
};
const filmHash = (key) => `${routeBase().replace(/\/$/, "")}/film/${encodeURIComponent(key)}`;
let panelDepth = 0, closingByHistory = false, afterClose = null, routeReady = false, routeReplace = false;
function routeFromHash(initial) {
  const { base } = hashParts();
  if (initial && !base && !location.hash) return; // no address: the saved view stands
  const [a, b] = base.split("/");
  if (a === "insights") Object.assign(state, { page: "insights", insYear: b || "all" });
  else if (a === "compare") Object.assign(state, { page: "compare", cmp: b || state.cmp });
  else if (a === "list" && state.drill) state.page = "drill";
  else if (a === "settings") state.page = "settings";
  else Object.assign(state, { page: "stats", scope: /^\d{4}$/.test(a || "") ? a : "all" });
}
// After a render: a new page or friend becomes a history entry; a different year or period just changes the address.
function syncHash() {
  if (!routeReady || panelDepth) return;
  const want = routeBase();
  if (`#/${hashParts().base}` === want || (want === "#/" && !hashParts().base)) return;
  try { routeReplace ? history.replaceState(history.state, "", want) : history.pushState(null, "", want); } catch {}
}
function pushPanelState() {
  const d = DSTACK[DSTACK.length - 1];
  const url = d.kind === "film" && d.film ? filmHash(d.film.key) : routeBase();
  try { history.pushState({ panel: DSTACK.length }, "", url); panelDepth = DSTACK.length; } catch { panelDepth = 0; }
}
// Closes the pop-up and takes its history entries with it, then runs `next`.
function closePanelThen(next) {
  const dlg = $("#dlg");
  if (!dlg.open) { next && next(); return; }
  const n = panelDepth;
  closingByHistory = true; dlg.close();
  if (n) { afterClose = next || null; history.go(-n); } else { closingByHistory = false; next && next(); }
}
function onPanelClosed() {
  DSTACK = []; PANEL = new Map();
  if (!closingByHistory && panelDepth) { const n = panelDepth; panelDepth = 0; closingByHistory = true; history.go(-n); return; }
  if (!closingByHistory) panelDepth = 0;
}
function onPopState() {
  const depth = (history.state && history.state.panel) || 0, dlg = $("#dlg");
  if (closingByHistory) {
    if (depth) return; // still stepping back
    closingByHistory = false; panelDepth = 0;
    const next = afterClose; afterClose = null;
    if (next) next();
    return;
  }
  if (dlg.open && depth && depth < DSTACK.length) { DSTACK = DSTACK.slice(0, depth); panelDepth = depth; paintPanel(); return; }
  if (dlg.open) { closingByHistory = true; dlg.close(); closingByHistory = false; panelDepth = 0; }
  const wasDrill = state.page === "drill", before = routeBase();
  routeFromHash();
  if (routeBase() !== before) { render(); if (wasDrill && state.page !== "drill") window.scrollTo(0, (state.drillBack && state.drillBack.y) || 0); }
  if (!depth) openRouteFilm();
}
// An address ending in /film/<film> opens that card over the page.
function openRouteFilm() {
  const { film } = hashParts();
  if (!film) return;
  const f = state.lib.films.find((x) => x.key === film) || (MY_LIB && MY_LIB.watchlistFilms.find((x) => x.key === film));
  try { history.replaceState(null, "", routeBase()); } catch {}
  if (f) openDrill(D.film(f));
}
</script>
