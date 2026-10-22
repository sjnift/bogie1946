<script>
/* ---------- phone: a tap opens the data behind it in a sheet; a long list can go on a screen of its own ---------- */
let SSTACK = [];
function paintSheet() {
  const sheet = $("#sheet"), d = SSTACK[SSTACK.length - 1];
  PANEL = new Map();
  const { html, hidden } = inPanel(() => drillBody(d, PANEL_CAP));
  const n = drillSize(d);
  const head = `<div class="sheet-grip" aria-hidden="true"></div><div class="sheet-head">
    ${SSTACK.length > 1 ? `<button class="nav-btn" type="button" data-sback>${BACK}<span class="sr-only">Back</span></button>` : "<span></span>"}
    <div class="sheet-title">${d.person && d.person.key ? avatar(d.person, "sm") : ""}<div style="min-width:0"><h2 id="sheet-title">${esc(d.title)}</h2>${d.sub ? `<p>${esc(d.sub)}</p>` : ""}</div></div>
    <button class="nav-btn done" type="button" data-sclose>Done</button></div>`;
  const foot = hidden ? `<div class="sheet-foot"><button class="btn green block" type="button" data-drillpage>See all ${fmtN(n)}</button></div>` : "";
  sheet.innerHTML = head + `<div class="sheet-body">${html}</div>` + foot;
  if (!sheet.open) { if (typeof sheet.showModal === "function") sheet.showModal(); else sheet.setAttribute("open", ""); }
  const body = sheet.querySelector(".sheet-body");
  if (body) body.scrollTop = 0;
  const q = $("#search-q");
  if (q && d.kind === "search") { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  fillFilmo(sheet); fillShare(sheet);
}
// From a screen a drill opens the sheet; from inside the sheet it stacks, with Back.
function openSheet(d, inside) {
  if (!d) return;
  SSTACK = inside ? [...SSTACK, d] : [d];
  paintSheet();
  pushSheetState();
}
// "See all" turns the sheet into a screen of its own, pushed like any other.
function sheetToPage() {
  const d = SSTACK[SSTACK.length - 1];
  closeSheetThen(() => { state.drillLimit = 200; push({ type: "drill", title: d.title, d }); });
}
function drillScreen(d) {
  const { html, hidden } = drillBody(d, state.drillLimit);
  return `<div class="dhead">${d.person && d.person.key ? avatar(d.person, "xl") : ""}<div class="name">${esc(d.title)}</div>${d.sub ? `<div class="sub">${esc(d.sub)}</div>` : ""}</div>
    <div class="drill-page">${html}</div>
    ${hidden ? `<button class="row" type="button" data-drillmore><span>Show more</span><span class="count">${fmtN(hidden)} more</span>${CHEV}</button>` : ""}`;
}
</script>
