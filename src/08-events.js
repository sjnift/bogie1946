<script>
/* ---------- importing ---------- */
async function importFiles(files) {
  const err = $("#import-error"), btn = $("#btn-import");
  err.hidden = true;
  btn.disabled = true; btn.textContent = "Reading export…";
  try {
    const rows = await readExport(files);
    const saved = store.set(KEYS.rows, rows);
    MY_LIB = buildLibrary(rows);
    Object.assign(state, { mode: "mine", scope: "all", more: { cast: false, directors: false } });
    job.note = saved ? "" : "This browser wouldn't save your export, so you'll need to import it again next time.";
    job.err = !saved;
    saveView();
    render();
    autoLookup(MY_LIB);
  } catch (e) {
    err.textContent = (e && e.message) || "Couldn't read that file. Import the ZIP from Letterboxd → Settings → Data.";
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = "Import Letterboxd export";
  }
}

/* ---------- wiring ---------- */
function bind() {
  const fileInput = $("#file-input");
  $("#btn-import").addEventListener("click", () => fileInput.click());
  $("#btn-import-2").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { const files = [...fileInput.files]; fileInput.value = ""; if (files.length) importFiles(files); });
  $("#btn-example").addEventListener("click", () => { state.mode = "example"; state.scope = "all"; saveView(); render(); });
  $("#btn-insights").addEventListener("click", () => { state.page = state.page === "insights" ? "stats" : "insights"; saveView(); render(); window.scrollTo(0, 0); });
  $("#btn-mine").addEventListener("click", () => { state.mode = "mine"; state.scope = "all"; saveView(); render(); });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-lb],[data-crowd],[data-scope],[data-tab],[data-more],[data-list],[data-close],#btn-tmdb,#btn-change-key,#btn-omdb,#btn-change-omdb,#btn-claude,#btn-claude-retry,#btn-stop");
    if (!t) return;
    if (t.dataset.lb) lbAction(t.dataset.lb, MY_LIB);
    else if (t.dataset.crowd) { state.crowd = t.dataset.crowd; renderInsights(); $(`[data-crowd="${t.dataset.crowd}"]`)?.focus(); }
    else if (t.dataset.scope) { state.scope = t.dataset.scope; state.more = { cast: false, directors: false }; saveView(); render(); }
    else if (t.dataset.tab) { state.tab[t.dataset.tab] = t.dataset.val; renderSections(STATS); $(`[data-tab="${t.dataset.tab}"][data-val="${t.dataset.val}"]`)?.focus(); }
    else if (t.dataset.more) { state.more[t.dataset.more] = true; renderSections(STATS); }
    else if (t.dataset.list) openList(t.dataset.list);
    else if (t.hasAttribute("data-close")) $("#dlg").close();
    else if (t.id === "btn-tmdb") startTmdb(MY_LIB);
    else if (t.id === "btn-change-key") { editKey = true; renderLookup(); $("#tmdb-key")?.focus(); }
    else if (t.id === "btn-omdb") startOmdb(MY_LIB);
    else if (t.id === "btn-change-omdb") { editOmdb = true; renderLookup(); $("#omdb-key")?.focus(); }
    else if (t.id === "btn-claude") runClaude(MY_LIB);
    else if (t.id === "btn-claude-retry") retryClaudeMisses(MY_LIB);
    else if (t.id === "btn-stop") job.ctl && job.ctl.abort();
  });
  const dlg = $("#dlg");
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  // forgetting everything takes two clicks
  let armed = null;
  $("#btn-forget").addEventListener("click", (e) => {
    const btn = e.currentTarget, status = $("#forget-status");
    if (!armed) {
      btn.textContent = "Click again to delete";
      status.textContent = "Removes your imported export and looked-up details from this browser, plus any keys you typed in.";
      armed = setTimeout(() => { armed = null; btn.textContent = "Delete saved data from this browser"; status.textContent = ""; }, 6000);
      return;
    }
    clearTimeout(armed); armed = null;
    if (job.running && job.ctl) job.ctl.abort();
    Object.values(KEYS).forEach((k) => store.del(k));
    META = {}; PHOTOS = {}; LBX = {}; MY_LIB = null;
    Object.assign(state, { mode: "example", scope: "all" });
    job.note = ""; job.err = false;
    btn.textContent = "Delete saved data from this browser";
    status.textContent = "Deleted.";
    render();
  });

  // tooltips for chart marks
  const tip = $("#tip");
  const place = (x, y) => {
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 20;
    tip.style.left = Math.max(8, left) + "px"; tip.style.top = top + "px";
  };
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false; place(e.clientX, e.clientY);
  });
  document.addEventListener("pointermove", (e) => { if (!tip.hidden) place(e.clientX, e.clientY); });
  document.addEventListener("pointerleave", () => { tip.hidden = true; });
  window.addEventListener("scroll", () => { tip.hidden = true; }, { passive: true });

  // drop an export anywhere
  const veil = $("#drop-veil");
  let depth = 0;
  const hasFiles = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes("Files");
  window.addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; veil.hidden = false; });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; veil.hidden = true; } });
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; veil.hidden = true;
    const files = [...e.dataTransfer.files];
    if (files.length) importFiles(files);
  });
}

function init() {
  const ex = buildExample();
  EXAMPLE_META = Object.fromEntries(Object.entries(ex.meta).map(([k, m]) => [k, cleanMeta(m)]));
  EXAMPLE_LIB = buildLibrary(ex.rows);
  const saved = store.get(KEYS.rows, null);
  if (saved) { try { MY_LIB = buildLibrary(saved); } catch { MY_LIB = null; } }
  const view = store.get(KEYS.view, {});
  state.mode = MY_LIB && view.mode !== "example" ? "mine" : "example";
  if (view.scope) state.scope = view.scope;
  if (view.page === "insights") state.page = "insights";
  bind();
  render();
  // A saved key picks up films not yet looked up, or matched before matching improved.
  if (MY_LIB) { autoLookup(MY_LIB); pollLetterboxd(MY_LIB); }
}
init();
</script>
