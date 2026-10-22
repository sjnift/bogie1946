<script>
/* ---------- importing ---------- */
async function importFiles(files) {
  const err = $("#import-error"), done = $("#import-done"), btn = $("#btn-import");
  err.hidden = true; done.hidden = true;
  btn.disabled = true; btn.textContent = "Reading export…";
  try {
    // a backup from another device restores everything it holds
    if (isBackupFile(files)) {
      done.textContent = await restoreBackup(files[0]);
      MY_LIB = myLibrary();
      Object.assign(state, { mode: "mine", scope: "all" });
      saveView(); render(); done.hidden = false;
      await refreshFeed(); autoLookup(allFilmsLib());
      return;
    }
    const rows = await readExport(files);
    const saved = store.set(KEYS.rows, rows);
    MY_LIB = myLibrary();
    Object.assign(state, { mode: "mine", scope: "all", more: { cast: false, directors: false } });
    job.note = saved ? "" : "This browser wouldn't save your export, so you'll need to import it again next time.";
    job.err = !saved;
    saveView();
    render();
    done.innerHTML = `${esc(importSummary(rows, MY_LIB))}${MY_LIB.reviews.length ? ' <a href="#reviews">See your reviews</a>' : ""}`;
    done.hidden = false;
    await refreshFeed();
    autoLookup(allFilmsLib());
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
  $("#btn-compare").addEventListener("click", () => { state.page = state.page === "compare" ? "stats" : "compare"; saveView(); render(); window.scrollTo(0, 0); });
  const friendInput = $("#friend-input");
  friendInput.addEventListener("change", async () => {
    const files = [...friendInput.files]; friendInput.value = "";
    if (!files.length) return;
    try {
      state.cmp = await addFriend(files);
      Object.assign(state, { cmpError: "", mode: "mine" });
      autoLookup(allFilmsLib());
    } catch (e) { state.cmpError = (e && e.message) || "Couldn't read that export."; }
    render();
  });
  $("#btn-mine").addEventListener("click", () => { state.mode = "mine"; state.scope = "all"; saveView(); render(); });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-expand],[data-more-reviews],[data-reimport],[data-insyear],#btn-add-friend,[data-cmp],[data-unfriend],[data-lb],[data-crowd],[data-scope],[data-tab],[data-more],[data-list],[data-close],[data-dback],[data-drillpage],[data-drillback],[data-drillmore],[data-fix],[data-fixsave],[data-fixcancel],[data-wn],#btn-search,#btn-backup,[data-sharego],#btn-tmdb,#btn-change-key,#btn-omdb,#btn-change-omdb,#btn-claude,#btn-claude-retry,#btn-stop");
    if (!t) return;
    if (t.hasAttribute("data-expand")) {
      const text = t.previousElementSibling, open = text.classList.toggle("clamp") === false;
      t.textContent = open ? "Show less" : "Read more";
    }
    else if (t.hasAttribute("data-more-reviews")) { state.reviewLimit += 20; refreshReviewList(); }
    else if (t.hasAttribute("data-reimport")) $("#file-input").click();
    else if (t.dataset.insyear) { state.insYear = t.dataset.insyear; routeReplace = true; renderInsights(); routeReplace = false; $(`[data-insyear="${t.dataset.insyear}"]`)?.focus(); }
    else if (t.id === "btn-add-friend") $("#friend-input").click();
    else if (t.dataset.cmp) { state.cmp = t.dataset.cmp; state.unfriend = null; renderCompare(); $(`[data-cmp="${t.dataset.cmp}"]`)?.focus(); }
    else if (t.dataset.unfriend) {
      if (state.unfriend === t.dataset.unfriend) { removeFriend(t.dataset.unfriend); state.unfriend = null; }
      else state.unfriend = t.dataset.unfriend;
      renderCompare();
    }
    else if (t.dataset.lb) lbAction(t.dataset.lb, MY_LIB);
    else if (t.dataset.crowd) { state.crowd = t.dataset.crowd; renderInsights(); $(`[data-crowd="${t.dataset.crowd}"]`)?.focus(); }
    else if (t.dataset.scope) { state.scope = t.dataset.scope; state.more = { cast: false, directors: false }; state.reviewLimit = 20; saveView(); routeReplace = true; render(); routeReplace = false; }
    else if (t.dataset.tab) { state.tab[t.dataset.tab] = t.dataset.val; renderSections(STATS); $(`[data-tab="${t.dataset.tab}"][data-val="${t.dataset.val}"]`)?.focus(); }
    else if (t.dataset.more) { state.more[t.dataset.more] = true; renderSections(STATS); }
    else if (t.dataset.list) { const dlg = $("#dlg"); openDrill(drillGet(t.dataset.list), dlg.open && dlg.contains(t)); }
    else if (t.hasAttribute("data-close")) $("#dlg").close();
    else if (t.hasAttribute("data-dback")) history.back();
    else if (t.hasAttribute("data-drillpage")) openDrillPage(DSTACK[DSTACK.length - 1]);
    else if (t.hasAttribute("data-drillback")) history.back();
    else if (t.hasAttribute("data-drillmore")) { state.drillLimit += 300; renderDrillPage(); }
    else if (t.dataset.fix) { FIXING = t.dataset.fix; FIX_NOTE = { key: null, text: "" }; repaintDrill(); $("#fix-input")?.focus(); }
    else if (t.dataset.fixsave) runFix(t.dataset.fixsave, repaintDrill);
    else if (t.hasAttribute("data-fixcancel")) { FIXING = null; repaintDrill(); }
    else if (t.dataset.wn) { state.wn = t.dataset.wn; renderSections(STATS); $(`[data-wn="${t.dataset.wn}"]`)?.focus(); }
    else if (t.id === "btn-search") openSearch();
    else if (t.dataset.sharego) shareGo(t.dataset.sharego);
    else if (t.id === "btn-backup") downloadBackup($("#backup-keys")?.checked);
    else if (t.id === "btn-tmdb") startTmdb(MY_LIB);
    else if (t.id === "btn-change-key") { editKey = true; renderLookup(); $("#tmdb-key")?.focus(); }
    else if (t.id === "btn-omdb") startOmdb(MY_LIB);
    else if (t.id === "btn-change-omdb") { editOmdb = true; renderLookup(); $("#omdb-key")?.focus(); }
    else if (t.id === "btn-claude") runClaude(MY_LIB);
    else if (t.id === "btn-claude-retry") retryClaudeMisses(MY_LIB);
    else if (t.id === "btn-stop") job.ctl && job.ctl.abort();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "search-q") {
      const d = DSTACK[DSTACK.length - 1];
      if (d && d.kind === "search") { d.q = e.target.value; $("#search-results").innerHTML = inPanel(() => searchResultsHtml(d)); }
      return;
    }
    if (e.target.id !== "review-search") return;
    state.reviewQuery = e.target.value; state.reviewLimit = 20; refreshReviewList();
  });
  document.addEventListener("keydown", (e) => {
    // "/" searches from anywhere but a text box; Enter in search opens the first result
    if (e.key === "/" && !e.target.closest("input, textarea, select, [contenteditable]")) { e.preventDefault(); openSearch(); }
    else if (e.key === "Enter" && e.target.id === "search-q") { const first = $("#search-results [data-list]"); if (first) first.click(); }
    else if (e.key === "Enter" && e.target.id === "fix-input") { const b = $("[data-fixsave]"); if (b) b.click(); }
  });
  const dlg = $("#dlg");
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", onPanelClosed);
  window.addEventListener("popstate", onPopState);

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
    META = {}; PHOTOS = {}; LBX = {}; FRIENDS = []; MY_LIB = null;
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

async function init() {
  await store.init();
  META = store.get(KEYS.meta, {}); PHOTOS = store.get(KEYS.photos, {}); LBX = store.get(KEYS.lbx, {});
  const ex = buildExample();
  EXAMPLE_FRIENDS = buildExampleFriends().map((f) => ({ ...f, lib: buildLibrary(f.rows) }));
  loadFriends();
  EXAMPLE_META = Object.fromEntries(Object.entries(ex.meta).map(([k, m]) => [k, cleanMeta(m)]));
  EXAMPLE_LIB = buildLibrary(ex.rows);
  try { MY_LIB = myLibrary(); } catch { MY_LIB = null; }
  const view = store.get(KEYS.view, {});
  state.mode = MY_LIB && view.mode !== "example" ? "mine" : "example";
  if (view.scope) state.scope = view.scope;
  if (view.page === "insights" || view.page === "compare") state.page = view.page;
  bind();
  routeFromHash(true);
  render();
  const film = hashParts().film;
  try { history.replaceState(null, "", film ? filmHash(film) : routeBase()); } catch {}
  routeReady = true;
  openRouteFilm();
  // New diary entries from the daily feed, then a saved key picks up films not yet looked up.
  if (MY_LIB) { await refreshFeed(); autoLookup(allFilmsLib()); pollLetterboxd(MY_LIB); }
}
// Loads the feed for the imported member and redraws with any entries it adds.
async function refreshFeed() {
  const feed = MY_LIB && await loadFeed(MY_LIB.profile.username);
  if (!feed) return;
  FEED = feed; MY_LIB = myLibrary(); SEARCH_INDEX = null;
  render();
}
init();
</script>
