<script>
/* ---------- importing ---------- */
async function importFiles(files) {
  state.importError = "";
  try {
    // a backup from another device restores everything it holds
    if (isBackupFile(files)) {
      const note = await restoreBackup(files[0]);
      MY_LIB = myLibrary(); DATA_REV++;
      Object.assign(state, { mode: "mine", scope: "all", view: "profile", stack: [], importNote: note });
      saveView(); render("tab"); window.scrollTo(0, 0);
      await refreshFeed(); autoLookup(allFilmsLib());
      return;
    }
    const rows = await readExport(files);
    const saved = store.set(KEYS.rows, rows);
    await store.flush();
    MY_LIB = myLibrary(); DATA_REV++; LOAD_ERROR = "";
    Object.assign(state, { mode: "mine", scope: "all", view: "profile", stack: [], peopleLimit: 50, diaryLimit: 40 });
    job.note = saved ? "" : "This browser wouldn't save your export, so you'll need to import it again next time.";
    job.err = !saved;
    state.importNote = importSummary(rows, MY_LIB);
    setTimeout(async () => { await refreshFeed(); autoLookup(allFilmsLib()); });
  } catch (e) {
    state.importError = (e && e.message) || "Couldn't read that file. Import the ZIP from Letterboxd → Settings → Data.";
    Object.assign(state, { view: "profile", stack: [{ type: "data", title: PUSHED.data, ret: 0 }] });
  }
  saveView();
  render("tab");
  window.scrollTo(0, 0);
}

/* ---------- taps ---------- */
let forgetTimer = null;
function act(t) {
  const a = t.dataset.act;
  if (a === "import") $("#file-input").click();
  else if (a === "insights" || a === "compare") goTo(a);
  else if (a === "settings") push({ type: "data", title: PUSHED.data });
  else if (a === "reviews") { state.reviewLimit = 30; push({ type: "reviews", title: "Reviews" }); }
  else if (a === "add-friend") $("#friend-input").click();
  // back through history when this screen was reached in the app, otherwise straight to the one under it
  else if (a === "back") { if (history.state && history.state.app) history.back(); else { routeReplace = true; pop(); routeReplace = false; } }
  else if (a === "search") openSearch();
  else if (a === "watchnext") push({ type: "watchnext", title: "Watch next" });
  else if (a === "backup") downloadBackup(state.backupKeys);
  else if (a === "backup-keys") { state.backupKeys = !state.backupKeys; render(); }
  else if (a === "people") { Object.assign(state, { role: t.dataset.role || "c", peopleLimit: 50 }); goTo("people", { force: true, top: true }); }
  else if (a === "cat") push({ type: "cat", field: t.dataset.field, title: t.dataset.field[0].toUpperCase() + t.dataset.field.slice(1) });
  else if (a === "all-rated" || a === "liked") openSheet(a === "liked" ? DR.liked(STATS) : D.films("Highest rated", filmsSub(STATS.films.filter((f) => f.rating)), STATS.films.filter((f) => f.rating), { scope: STATS.scope }));
  else if (a === "more-people") { state.peopleLimit += 100; render(); }
  else if (a === "more-diary") { state.diaryLimit += 120; render(); }
  else if (a === "forget") {
    if (!state.forgetArmed) {
      state.forgetArmed = true; render();
      forgetTimer = setTimeout(() => { state.forgetArmed = false; if (state.stack.length) render(); }, 6000);
      return;
    }
    clearTimeout(forgetTimer); state.forgetArmed = false;
    if (job.running && job.ctl) job.ctl.abort();
    Object.values(KEYS).forEach((k) => store.del(k)); store.del(VIEW_KEY);
    META = {}; PHOTOS = {}; LBX = {}; FRIENDS = []; MY_LIB = null; DATA_REV++; siteForget();
    Object.assign(state, { mode: "example", scope: "all" });
    job.note = "Deleted your saved data from this browser."; job.err = false;
    render();
  }
  else if (a === "tmdb") startTmdb(MY_LIB);
  else if (a === "change-key") { editKey = true; renderLookup(); $("#tmdb-key")?.focus(); }
  else if (a === "omdb") startOmdb(MY_LIB);
  else if (a === "change-omdb") { editOmdb = true; renderLookup(); $("#omdb-key")?.focus(); }
  else if (a === "claude") runClaude(MY_LIB);
  else if (a === "claude-retry") retryClaudeMisses(MY_LIB);
  else if (a === "stop") job.ctl && job.ctl.abort();
}
// A "Show more" scrolled into view loads the next lot by itself.
function loadMore(el) {
  if (el.dataset.act) act(el);
  else if (el.hasAttribute("data-drillmore")) { state.drillLimit += 200; render(); }
}

function bind() {
  const friendInput = $("#friend-input");
  friendInput.addEventListener("change", async () => {
    const files = [...friendInput.files]; friendInput.value = "";
    if (!files.length) return;
    try {
      state.cmp = await addFriend(files);
      Object.assign(state, { cmpError: "", mode: "mine", cmpTab: "overview" });
      DATA_REV++;
      autoLookup(allFilmsLib());
    } catch (e) { state.cmpError = (e && e.message) || "Couldn't read that export."; }
    render();
  });
  const fileInput = $("#file-input");
  fileInput.addEventListener("change", () => { const files = [...fileInput.files]; fileInput.value = ""; if (files.length) importFiles(files); });
  document.addEventListener("input", (e) => {
    if (e.target.id === "search-q") {
      const d = SSTACK[SSTACK.length - 1];
      if (d && d.kind === "search") { d.q = e.target.value; $("#search-results").innerHTML = inPanel(() => searchResultsHtml(d)); }
      return;
    }
    if (e.target.id !== "review-search") return;
    state.reviewQuery = e.target.value; state.reviewLimit = 30; refreshReviewList();
  });
  document.addEventListener("click", (e) => { const c = e.target.closest("[data-copycheck]"); if (c) copyDataCheck(c); });
  document.addEventListener("click", (e) => {
    const x = e.target.closest("[data-expand],[data-more-reviews]");
    if (x && x.hasAttribute("data-expand")) { const open = x.previousElementSibling.classList.toggle("clamp") === false; x.textContent = open ? "Show less" : "Read more"; return; }
    if (x) { state.reviewLimit += 30; refreshReviewList(); }
  });
  // the sheet: Back, close, a tap outside it, Escape, a pull down, and "See all"
  const sheet = $("#sheet");
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener("cancel", (e) => { e.preventDefault(); closeSheet(); });
  sheet.addEventListener("close", onSheetClosed);
  bindSheetDrag(sheet);
  window.addEventListener("popstate", onPopState);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "search-q") { const first = $("#search-results [data-list]"); if (first) first.click(); }
    else if (e.key === "Enter" && e.target.id === "fix-input") { const b = $("[data-fixsave]"); if (b) b.click(); }
  });
  document.addEventListener("click", (e) => {
    const x = e.target.closest("[data-sback],[data-sclose],[data-drillpage],[data-drillmore]");
    if (!x) return;
    if (x.hasAttribute("data-sback")) history.back();
    else if (x.hasAttribute("data-sclose")) closeSheet();
    else if (x.hasAttribute("data-drillpage")) sheetToPage();
    else loadMore(x);
  });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-fix],[data-fixsave],[data-fixcancel],[data-wn],[data-sharego]");
    if (!t) return;
    if (t.dataset.sharego) { shareGo(t.dataset.sharego); return; }
    if (t.dataset.fix) { FIXING = t.dataset.fix; FIX_NOTE = { key: null, text: "" }; repaintDrill(); $("#fix-input")?.focus(); }
    else if (t.dataset.fixsave) runFix(t.dataset.fixsave, repaintDrill);
    else if (t.hasAttribute("data-fixcancel")) { FIXING = null; repaintDrill(); }
    else if (t.dataset.wn) { state.wn = t.dataset.wn; render(); }
  });
  // sections, chips and toggles redraw the screen in place; tabs and screens move
  const SETS = { instab: "insTab", ytab: "yearTab", cmptab: "cmpTab", trend: "trend", crowdsel: "crowd", sort: "sort", catsort: "catSort" };
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-instab],[data-ytab],[data-cmptab],[data-trend],[data-cmp],[data-unfriend],[data-lb],[data-crowdsel],[data-act],[data-view],[data-scope],[data-list],[data-role],[data-sort],[data-catsort]");
    if (!t || t.disabled) return;
    const set = Object.keys(SETS).find((k) => t.dataset[k] != null);
    if (set) {
      const section = set === "instab" || set === "ytab" || set === "cmptab";
      state[SETS[set]] = t.dataset[set];
      const bar = section && t.closest(".utabs"), barTop = bar ? bar.getBoundingClientRect().top + window.scrollY : 0;
      render();
      // a new section starts at its top, just under the header and year chips
      if (bar) { const y = barTop - $("#top").offsetHeight - (($("#scopes") || {}).offsetHeight || 0); if (window.scrollY > y) window.scrollTo(0, Math.max(0, y)); }
      return;
    }
    if (t.dataset.cmp) { Object.assign(state, { cmp: t.dataset.cmp, unfriend: null }); routeReplace = true; render(); routeReplace = false; return; }
    if (t.dataset.unfriend) {
      if (state.unfriend === t.dataset.unfriend) { removeFriend(t.dataset.unfriend); state.unfriend = null; DATA_REV++; } else state.unfriend = t.dataset.unfriend;
      render(); return;
    }
    if (t.dataset.lb) { lbAction(t.dataset.lb, MY_LIB); return; }
    if (t.dataset.act) return act(t);
    if (t.dataset.view) {
      const v = t.dataset.view === "stats" ? state.statsView : t.dataset.view;
      // the Stats sections replace each other in the address; the tabs are history entries
      if (STATS_VIEWS.includes(v) && STATS_VIEWS.includes(state.view) && !state.stack.length) { routeReplace = true; goTo(v); routeReplace = false; }
      else goTo(v);
    }
    else if (t.dataset.scope) {
      Object.assign(state, { scope: t.dataset.scope, peopleLimit: 50, diaryLimit: 40 }); saveView();
      routeReplace = true; render(); routeReplace = false;
    }
    else if (t.dataset.list) openSheet(drillGet(t.dataset.list), sheet.open && sheet.contains(t));
    else if (t.dataset.role) { Object.assign(state, { role: t.dataset.role, peopleLimit: 50 }); render(); }
  });

  // tooltips for chart marks; a tap shows one on a phone
  const tip = $("#tip");
  const place = (x, y) => {
    const r = tip.getBoundingClientRect();
    let left = x + 12, top = y - r.height - 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 12;
    if (top < 8) top = y + 20;
    tip.style.left = Math.max(8, left) + "px"; tip.style.top = top + "px";
  };
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false; place(e.clientX, e.clientY);
  });
  document.addEventListener("pointermove", (e) => { if (!tip.hidden) place(e.clientX, e.clientY); });
  window.addEventListener("scroll", () => { tip.hidden = true; }, { passive: true });

  // a dropped export works too, for anyone using this on a computer
  const hasFiles = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes("Files");
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("drop", (e) => { if (!hasFiles(e)) return; e.preventDefault(); const files = [...e.dataTransfer.files]; if (files.length) importFiles(files); });
}

async function init() {
  await store.init();
  META = store.get(KEYS.meta, {}); PHOTOS = store.get(KEYS.photos, {}); LBX = store.get(KEYS.lbx, {});
  const ex = buildExample();
  EXAMPLE_FRIENDS = buildExampleFriends().map((f) => ({ ...f, lib: buildLibrary(f.rows) }));
  loadFriends();
  EXAMPLE_META = Object.fromEntries(Object.entries(ex.meta).map(([k, m]) => [k, cleanMeta(m)]));
  EXAMPLE_LIB = buildLibrary(ex.rows);
  try { MY_LIB = myLibrary(); } catch (e) { MY_LIB = null; LOAD_ERROR = (e && e.message) || "unknown error"; }
  // a device that opened the diary on the site before but has nothing saved now: bring it in before the first screen
  if (!MY_LIB && SITE && SITE_ON) await siteCheck(false);
  const view = store.get(VIEW_KEY, {});
  state.mode = MY_LIB ? "mine" : "example"; // your diary whenever there is one
  if (view.scope) state.scope = view.scope;
  if (TOP_VIEWS.includes(view.view)) state.view = view.view;
  else if (view.view === "data") state.stack = [{ type: "data", title: PUSHED.data, ret: 0 }];
  if (STATS_VIEWS.includes(state.view)) state.statsView = state.view;
  bind();
  routeFromHash();
  render();
  routeReady = true;
  syncHash(true);
  openRouteFilm();
  // the site owner's ratings, when they let visitors compare with them (and on their own device, kept up to date)
  loadTasteCard().then(() => { if (!TASTE) return; if (tasteRefresh()) DATA_REV++; siteSettled().then(tasteFollow); render(); });
  loadSharedKey().then(() => { if (SHARED_TMDB) render(); }); // the key boxes and reminders know about it
  siteStart();
  // New diary entries from the daily feed, then a saved key picks up films not yet looked up.
  // (lookups wait until this device has what the site has, so nothing found elsewhere is looked up again)
  if (MY_LIB) { await refreshFeed(); siteSettled().then(() => autoLookup(allFilmsLib())); pollLetterboxd(MY_LIB); }
}
async function refreshFeed() {
  const feed = MY_LIB && await loadFeed(MY_LIB.profile.username);
  if (!feed) return;
  FEED = feed; MY_LIB = myLibrary(); SEARCH_INDEX = null; DATA_REV++;
  render();
}
init();
</script>
