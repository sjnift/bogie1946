<script>
/* ---------- importing ---------- */
async function importFiles(files) {
  state.importError = "";
  try {
    const rows = await readExport(files);
    const saved = store.set(KEYS.rows, rows);
    MY_LIB = buildLibrary(rows);
    Object.assign(state, { mode: "mine", scope: "all", view: "profile", stack: [], peopleLimit: 50, diaryLimit: 60 });
    job.note = saved ? "" : "This browser wouldn't save your export, so you'll need to import it again next time.";
    job.err = !saved;
    setTimeout(() => autoLookup(allFilmsLib()));
  } catch (e) {
    state.importError = (e && e.message) || "Couldn't read that file. Import the ZIP from Letterboxd → Settings → Data.";
    Object.assign(state, { view: "data", stack: [] });
  }
  saveView();
  render();
  window.scrollTo(0, 0);
}

/* ---------- taps ---------- */
let forgetTimer = null;
function act(t) {
  const a = t.dataset.act;
  if (a === "import") $("#file-input").click();
  else if (a === "insights") push({ type: "insights", title: "Insights" });
  else if (a === "compare") push({ type: "compare", title: "Compare" });
  else if (a === "reviews") { state.reviewLimit = 30; push({ type: "reviews", title: "Reviews" }); }
  else if (a === "add-friend") $("#friend-input").click();
  else if (a === "back") pop();
  else if (a === "people") { Object.assign(state, { view: "people", role: t.dataset.role || "c", stack: [], peopleLimit: 50 }); saveView(); render(); window.scrollTo(0, 0); }
  else if (a === "cat") push({ type: "cat", field: t.dataset.field, title: t.dataset.field[0].toUpperCase() + t.dataset.field.slice(1) });
  else if (a === "all-rated" || a === "liked") {
    const films = STATS.films.filter((f) => a === "liked" ? f.liked : f.rating);
    push({ type: "films", title: a === "liked" ? "Liked" : "Highest rated", sub: plural(films.length, "film"), films });
  }
  else if (a === "more-people") { state.peopleLimit += 100; render(); }
  else if (a === "more-diary") { state.diaryLimit += 120; render(); }
  else if (a === "example" || a === "mine") { Object.assign(state, { mode: a === "example" ? "example" : "mine", scope: "all", view: "profile", stack: [] }); saveView(); render(); window.scrollTo(0, 0); }
  else if (a === "forget") {
    if (!state.forgetArmed) {
      state.forgetArmed = true; render();
      forgetTimer = setTimeout(() => { state.forgetArmed = false; if (state.view === "data") render(); }, 6000);
      return;
    }
    clearTimeout(forgetTimer); state.forgetArmed = false;
    if (job.running && job.ctl) job.ctl.abort();
    Object.values(KEYS).forEach((k) => store.del(k)); store.del(VIEW_KEY);
    META = {}; PHOTOS = {}; LBX = {}; FRIENDS = []; MY_LIB = null;
    Object.assign(state, { mode: "example", scope: "all", stack: [] });
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

function bind() {
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
  const fileInput = $("#file-input");
  fileInput.addEventListener("change", () => { const files = [...fileInput.files]; fileInput.value = ""; if (files.length) importFiles(files); });
  document.addEventListener("input", (e) => {
    if (e.target.id !== "review-search") return;
    state.reviewQuery = e.target.value; state.reviewLimit = 30; refreshReviewList();
  });
  document.addEventListener("click", (e) => {
    const x = e.target.closest("[data-expand],[data-more-reviews]");
    if (x && x.hasAttribute("data-expand")) { const open = x.previousElementSibling.classList.toggle("clamp") === false; x.textContent = open ? "Less" : "More"; return; }
    if (x) { state.reviewLimit += 30; refreshReviewList(); }
  });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-insyear],[data-cmp],[data-unfriend],[data-lb],[data-crowdsel],[data-act],[data-view],[data-scope],[data-push],[data-role],[data-crew],[data-sort],[data-catsort]");
    if (!t) return;
    if (t.dataset.insyear) { state.insYear = t.dataset.insyear; render(); return; }
    if (t.dataset.cmp) { Object.assign(state, { cmp: t.dataset.cmp, unfriend: null }); render(); return; }
    if (t.dataset.unfriend) {
      if (state.unfriend === t.dataset.unfriend) { removeFriend(t.dataset.unfriend); state.unfriend = null; } else state.unfriend = t.dataset.unfriend;
      render(); return;
    }
    if (t.dataset.lb) { lbAction(t.dataset.lb, MY_LIB); return; }
    if (t.dataset.crowdsel) { state.crowd = t.dataset.crowdsel; render(); return; }
    if (t.dataset.act) return act(t);
    if (t.dataset.view) {
      const same = state.view === t.dataset.view && !state.stack.length;
      Object.assign(state, { view: t.dataset.view, stack: [], forgetArmed: false });
      saveView(); render();
      if (!same) window.scrollTo(0, 0);
    }
    else if (t.dataset.scope) { Object.assign(state, { scope: t.dataset.scope, peopleLimit: 50, diaryLimit: 60 }); saveView(); render(); }
    else if (t.dataset.push) { const L = LISTS.get(t.dataset.push); if (L) push({ type: "films", title: L.title, sub: L.sub, films: L.films, person: L.person }); }
    else if (t.dataset.role) { Object.assign(state, { role: t.dataset.role, peopleLimit: 50 }); render(); }
    else if (t.dataset.crew) { state.crew = t.dataset.crew; render(); }
    else if (t.dataset.sort) { state.sort = t.dataset.sort; render(); }
    else if (t.dataset.catsort) { state.catSort = t.dataset.catsort; render(); }
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

function init() {
  const ex = buildExample();
  EXAMPLE_FRIENDS = buildExampleFriends().map((f) => ({ ...f, lib: buildLibrary(f.rows) }));
  loadFriends();
  EXAMPLE_META = Object.fromEntries(Object.entries(ex.meta).map(([k, m]) => [k, cleanMeta(m)]));
  EXAMPLE_LIB = buildLibrary(ex.rows);
  const saved = store.get(KEYS.rows, null);
  if (saved) { try { MY_LIB = buildLibrary(saved); } catch { MY_LIB = null; } }
  const view = store.get(VIEW_KEY, {});
  state.mode = MY_LIB && view.mode !== "example" ? "mine" : "example";
  if (view.scope) state.scope = view.scope;
  if (SCREENS[view.view]) state.view = view.view;
  bind();
  render();
  // A saved key picks up films not yet looked up, or matched before matching improved.
  if (MY_LIB) { autoLookup(allFilmsLib()); pollLetterboxd(MY_LIB); }
}
init();
</script>
