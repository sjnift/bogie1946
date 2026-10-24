<script>
/* ---------- phone: a tap opens the data behind it in a sheet; a long list can go on a screen of its own ---------- */
let SSTACK = [];
// `how` is "push" when a list inside the sheet opened, "back" when it stepped back.
function paintSheet(how) {
  const sheet = $("#sheet"), d = SSTACK[SSTACK.length - 1];
  PANEL = new Map();
  const { html, hidden } = inPanel(() => drillBody(d, PANEL_CAP));
  const n = drillSize(d);
  const head = `<div class="sheet-grab"><div class="sheet-grip" aria-hidden="true"></div><div class="sheet-head">
    ${SSTACK.length > 1 ? `<button class="nav-btn" type="button" data-sback>${BACK}<span class="sr-only">Back</span></button>` : "<span></span>"}
    <div class="sheet-title">${d.person && d.person.key ? avatar(d.person, "sm") : ""}<div style="min-width:0"><h2 id="sheet-title">${esc(d.title)}</h2>${d.sub ? `<p>${esc(d.sub)}</p>` : ""}</div></div>
    <button class="nav-btn done" type="button" data-sclose>${CLOSE}<span class="sr-only">Done</span></button></div></div>`;
  const foot = hidden ? `<div class="sheet-foot"><button class="btn green block" type="button" data-drillpage>See all ${fmtN(n)}</button></div>` : "";
  sheet.innerHTML = head + `<div class="sheet-body${how && !REDUCED ? ` ${how === "back" ? "back" : "enter"}` : ""}">${html}</div>` + foot;
  if (!sheet.open) { sheet.classList.remove("closing"); sheet.style.transform = ""; if (typeof sheet.showModal === "function") sheet.showModal(); else sheet.setAttribute("open", ""); }
  const body = sheet.querySelector(".sheet-body");
  if (body) body.scrollTop = 0;
  const q = $("#search-q");
  if (q && d.kind === "search") { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  fillFilmo(sheet); fillShare(sheet); fillStory(sheet);
}
// From a screen a drill opens the sheet; from inside the sheet it stacks, with Back.
function openSheet(d, inside) {
  if (!d) return;
  SSTACK = inside ? [...SSTACK, d] : [d];
  paintSheet(inside ? "push" : "");
  pushSheetState();
}
// Slides the sheet away, then closes it (the history steps back when it has closed).
function closeSheet() {
  const sheet = $("#sheet");
  if (!sheet.open || sheet.classList.contains("closing")) return;
  if (REDUCED) { sheet.close(); return; }
  sheet.classList.add("closing");
  setTimeout(() => { sheet.close(); sheet.classList.remove("closing", "dragging", "snap"); sheet.style.transform = ""; sheet.style.removeProperty("--drag"); }, 200);
}
// Pull the sheet down by its top, or by its list when that's scrolled to the top, to close it.
function bindSheetDrag(sheet) {
  let drag = null;
  sheet.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || sheet.classList.contains("closing")) return;
    const body = sheet.querySelector(".sheet-body"), grab = !!e.target.closest(".sheet-grab");
    if (!grab && !(body && body.contains(e.target) && body.scrollTop <= 0)) return;
    if (e.target.closest("input")) return;
    drag = { y: e.touches[0].clientY, t: e.timeStamp, dy: 0, active: false, body };
  }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (!drag) return;
    const dy = e.touches[0].clientY - drag.y;
    if (!drag.active) {
      if (dy > 8 && (!drag.body || drag.body.scrollTop <= 0)) { drag.active = true; drag.y += dy; drag.t = e.timeStamp; }
      else if (dy < -4) { drag = null; return; } else return;
    }
    e.preventDefault();
    drag.dy = Math.max(0, e.touches[0].clientY - drag.y);
    sheet.classList.add("dragging");
    sheet.style.transform = `translateY(${drag.dy}px)`;
  }, { passive: false });
  const end = (e) => {
    const d = drag; drag = null;
    if (!d || !d.active) return;
    sheet.classList.remove("dragging");
    const speed = d.dy / Math.max(1, e.timeStamp - d.t);
    if (d.dy > 110 || speed > 0.65) { sheet.style.setProperty("--drag", `${d.dy}px`); closeSheet(); }
    else { sheet.classList.add("snap"); sheet.style.transform = ""; setTimeout(() => sheet.classList.remove("snap"), 260); }
  };
  sheet.addEventListener("touchend", end);
  sheet.addEventListener("touchcancel", end);
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
    ${hidden ? `<button class="row" type="button" data-drillmore data-auto style="padding-inline:0"><span>Show more</span><span class="count">${fmtN(hidden)} more</span>${CHEV}</button>` : ""}`;
}
</script>
