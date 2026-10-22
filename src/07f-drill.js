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
  dlg.classList.toggle("wide", d.kind === "film" || d.kind === "reviews");
  if (!dlg.open) { if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", ""); }
  const body = dlg.querySelector(".dlg-body");
  if (body) body.scrollTop = 0;
}
// From the page a drill starts a new pop-up; from inside the pop-up it stacks, with Back.
function openDrill(d, inside) {
  if (!d) return;
  DSTACK = inside ? [...DSTACK, d] : [d];
  paintPanel();
}

/* ----- the full page ----- */
function openDrillPage(d) {
  const dlg = $("#dlg");
  if (dlg.open) dlg.close();
  const fresh = state.page !== "drill";
  if (fresh) state.drillBack = { page: state.page, y: window.scrollY };
  Object.assign(state, { page: "drill", drill: d, drillLimit: 300 });
  try { if (fresh) history.pushState({ crDrill: 1 }, ""); state.drillPushed = state.drillPushed || fresh; } catch { state.drillPushed = false; }
  render();
  window.scrollTo(0, 0);
}
function leaveDrillPage() {
  if (state.page !== "drill") return;
  const b = state.drillBack || { page: "stats", y: 0 };
  Object.assign(state, { page: b.page, drill: null, drillPushed: false });
  render();
  window.scrollTo(0, b.y);
}
function renderDrillPage() {
  const d = state.drill;
  $("#hero-title").innerHTML = esc(d.title);
  $("#hero-sub").textContent = d.sub || "";
  const { html, hidden } = drillBody(d, state.drillLimit);
  $("#drillpage").innerHTML = `<div class="drill-bar"><button class="btn small" type="button" data-drillback><span aria-hidden="true">←</span> Back</button></div>
    <div class="drill-page${d.kind === "reviews" ? " wide" : ""}">${html}</div>
    ${hidden ? `<p class="drill-bar"><button class="btn small" type="button" data-drillmore>Show more (${fmtN(hidden)} left)</button></p>` : ""}`;
}
</script>
