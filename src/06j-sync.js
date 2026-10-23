<script>
/* ---------- sync: the same diary on every device, through a private GitHub repository ----------
   The owner's own private repository (say sjnift/credits-roll-data) holds one JSON file per part of the data:
   the export, film details, photos, Letterboxd averages, friends and API keys. A fine-grained GitHub token that
   can read and write only that repository stays in each device's browser. Each sync is one commit through
   GitHub's git data API, so two devices can't half-overwrite each other: when another device synced first, its
   changes are pulled and merged before this one's go up. */
const SYNC_KEY = "cr-sync-v1"; // { repo, token, head, shas: { file: blob sha }, at, from }
const SYNC_DIRTY = "cr-sync-dirty"; // when this device last changed something it hasn't sent yet
const SYNC_FILES = ["rows", "meta", "photos", "lbx", "friends", "keys"];
const SYNCED = new Set([KEYS.rows, KEYS.meta, KEYS.photos, KEYS.lbx, KEYS.friends, KEYS.tmdb, KEYS.omdb, KEYS.apify]);
const SYNC_DEVICE = document.querySelector(".tabbar") ? "phone" : "computer";
let SYNC = ls.get(SYNC_KEY, null), syncBusy = null, syncTimer = null, syncApplying = false;
const syncState = { note: "", err: false, keyErr: false, running: false, linkOpen: false };
const saveSync = () => { if (SYNC) ls.set(SYNC_KEY, SYNC); else ls.del(SYNC_KEY); };

// Anything synced that changes on this device goes up: a new import or friend within seconds, film details
// and averages a minute later (after any lookup in progress, which saves every few films, has finished).
let syncDue = 0;
function syncLater(wait) {
  if (syncTimer && syncDue <= Date.now() + wait) return; // already going sooner
  clearTimeout(syncTimer); syncDue = Date.now() + wait;
  syncTimer = setTimeout(function later() {
    if (wait > 5000 && [job, imdbJob, lbJob].some((j) => j && j.running)) { syncTimer = setTimeout(later, 30000); return; }
    syncTimer = null; syncNow();
  }, wait);
}
STORE_HOOK = (k) => {
  if (syncApplying || !SYNC || !SYNCED.has(k)) return;
  ls.set(SYNC_DIRTY, Date.now());
  syncLater(k === KEYS.rows || k === KEYS.friends ? 3000 : 60000);
};
// Going into the background sends what's waiting; coming back brings in what other devices sent meanwhile.
addEventListener("visibilitychange", () => {
  if (!SYNC) return;
  if (document.visibilityState === "hidden") { if (ls.get(SYNC_DIRTY, 0)) syncNow(); }
  else if (!SYNC.at || Date.now() - Date.parse(SYNC.at) > 60000) syncNow();
});

/* ----- GitHub ----- */
const syncFail = (msg, extra = {}) => Object.assign(new Error(msg), extra);
async function gh(path, opts = {}) {
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${SYNC.repo}${path}`, { ...opts,
      headers: { Authorization: `Bearer ${SYNC.token}`, Accept: "application/vnd.github+json", ...(opts.body ? { "Content-Type": "application/json" } : {}) } });
  } catch { throw syncFail("Couldn't reach GitHub. Your changes are kept here and go up next time."); }
  if (res.status === 401) throw syncFail("GitHub didn't accept the key. It may have expired: make a new one (same steps as before) and paste it here.", { key: true });
  if (res.status === 404 && !path) throw syncFail(`GitHub can't find ${SYNC.repo} with this key. Check the name and that the key was given that repository.`, { key: true });
  if (res.status === 403) throw syncFail("This key can read the repository but not change it. Give it Contents: Read and write.", { key: true });
  if (!res.ok) throw syncFail(`GitHub said ${res.status}.`, { status: res.status });
  return res.status === 204 ? null : res.json();
}
const toB64 = (text) => { const bytes = new TextEncoder().encode(text); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const fromB64 = (b64) => { const bin = atob(String(b64).replace(/\s/g, "")); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };
// Git's own name for a file's content, so unchanged parts aren't sent again.
async function blobSha(text) {
  const body = new TextEncoder().encode(text), head = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length); all.set(head); all.set(body, head.length);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-1", all))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function remoteHead() {
  const repo = await gh("");
  if (!repo.private) throw syncFail(`${SYNC.repo} is public, so anyone could read your diary and keys there. Make it private on GitHub first (Settings → Danger Zone → Change visibility).`, { key: true });
  const branch = repo.default_branch || "main";
  // (the time on the end stops the browser answering from its own copy of a minute ago)
  try { return { branch, commit: (await gh(`/git/ref/heads/${branch}?t=${Date.now()}`)).object.sha }; }
  catch (e) { if (e.status === 404 || e.status === 409) return { branch, commit: null }; throw e; } // an empty repository
}
async function remoteFiles(commit) {
  const c = await gh(`/git/commits/${commit}`), t = await gh(`/git/trees/${c.tree.sha}`);
  return { tree: c.tree.sha, files: Object.fromEntries(t.tree.filter((x) => x.type === "blob").map((x) => [x.path, x.sha])) };
}
// Sends the parts that differ from the repository's as one commit; false when another device got there first.
async function pushSnapshot(head, base) {
  const data = syncLocal(), changes = [];
  for (const k of SYNC_FILES) {
    const text = JSON.stringify(data[k] ?? null), sha = await blobSha(text);
    if (base.files[`${k}.json`] !== sha) changes.push({ path: `${k}.json`, text, sha, k });
  }
  if (!changes.length) return { commit: head.commit, files: base.files };
  changes.push({ path: "sync.json", text: JSON.stringify({ app: "credits-roll", at: new Date().toISOString(), from: SYNC_DEVICE, changed: changes.map((c) => c.k) }) });
  for (const c of changes) c.sha = (await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: toB64(c.text), encoding: "base64" }) })).sha;
  const tree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base.tree, tree: changes.map((c) => ({ path: c.path, mode: "100644", type: "blob", sha: c.sha })) }) });
  const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: `Credits Roll on a ${SYNC_DEVICE}: ${changes.filter((c) => c.k).map((c) => c.k).join(", ")}`, tree: tree.sha, parents: [head.commit] }) });
  try { await gh(`/git/refs/heads/${head.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) }); }
  catch (e) { if (e.status === 422 || e.status === 409) return null; throw e; }
  const files = { ...base.files }; for (const c of changes) files[c.path] = c.sha;
  return { commit: commit.sha, files };
}

/* ----- this device's data, and bringing the repository's in ----- */
function syncLocal() {
  return { rows: store.get(KEYS.rows, null), meta: META, photos: PHOTOS, lbx: LBX, friends: store.get(KEYS.friends, []),
    keys: { tmdb: store.get(KEYS.tmdb, ""), omdb: store.get(KEYS.omdb, ""), apify: store.get(KEYS.apify, "") } };
}
// The better of two copies of a film's details: matched by hand, then found, then a newer kind of match, then more filled in.
const metaScore = (m) => !m ? -1 : (m.pin ? 1e6 : 0) + (m.miss ? 0 : 1e4) + (m.v || 0) * 100 + (m.om ? 10 : 0) + (m.ik ? 5 : 0);
const mergeMeta = (a, b) => { const out = { ...a }; for (const [k, m] of Object.entries(b || {})) if (metaScore(m) > metaScore(out[k])) out[k] = m; return out; };
const mergeLbx = (a, b) => { const out = { ...a }; for (const [k, x] of Object.entries(b || {})) if (!out[k] || (x && x.r && !out[k].r)) out[k] = x; return out; };
const mergeFriends = (a, b) => { const by = new Map((a || []).map((f) => [f.id, f])); for (const f of b || []) if (!by.has(f.id)) by.set(f.id, f); return [...by.values()]; };
// Which of two imports is newer: by when it was imported, or for imports from before that was noted,
// by the newest diary entry and then by size.
const rowsWhen = (r) => r.importedAt || (r.diary || []).reduce((m, e) => (e.Date || "") > m ? e.Date : m, "");
const rowsSize = (r) => (r.diary || []).length + (r.watched || []).length + (r.reviews || []).length;
const newerRows = (a, b) => rowsWhen(a) !== rowsWhen(b) ? rowsWhen(a) > rowsWhen(b) : rowsSize(a) > rowsSize(b);
// With nothing changed here the repository's copy replaces this one; otherwise the two are merged
// (the newer import wins; details, averages, photos and friends are combined; keys fill gaps).
function applyRemote(remote, merge) {
  let newRows = false;
  syncApplying = true;
  try {
    if (remote.rows) {
      const mine = store.get(KEYS.rows, null);
      if (!merge || !mine || newerRows(remote.rows, mine)) { store.set(KEYS.rows, remote.rows); newRows = true; }
    }
    if (remote.meta) META = merge ? mergeMeta(META, remote.meta) : { ...remote.meta };
    if (remote.photos) PHOTOS = merge ? { ...remote.photos, ...PHOTOS } : { ...remote.photos };
    if (remote.lbx) { LBX = merge ? mergeLbx(LBX, remote.lbx) : { ...remote.lbx }; store.set(KEYS.lbx, LBX); }
    if (remote.meta || remote.photos) saveMeta();
    if (remote.friends) { store.set(KEYS.friends, merge ? mergeFriends(store.get(KEYS.friends, []), remote.friends) : remote.friends); loadFriends(); }
    for (const [k, v] of Object.entries(remote.keys || {})) if (v && KEYS[k] && (!merge || !store.get(KEYS[k], ""))) store.set(KEYS[k], v);
  } finally { syncApplying = false; }
  store.flush();
  // the page shows what came in
  MY_LIB = myLibrary(); LOAD_ERROR = "";
  if (MY_LIB) state.mode = "mine";
  DATA_REV++; SEARCH_INDEX = null;
  render();
  // a diary that just arrived gets the daily feed's newer entries, and any films still to look up
  if (newRows && MY_LIB) refreshFeed().then(() => autoLookup(allFilmsLib())).catch(() => {});
}

/* ----- one sync: bring in what's new there, then send what's new here ----- */
function syncNow() {
  if (!SYNC || IN_VIEWER) return Promise.resolve();
  if (syncBusy) return syncBusy;
  syncBusy = (async () => {
    Object.assign(syncState, { running: true, note: "", err: false, keyErr: false }); syncRedraw();
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        let head = await remoteHead();
        if (!head.commit) { // a brand-new repository: give it a first commit to build on
          await gh("/contents/README.md", { method: "PUT", body: JSON.stringify({ message: "Credits Roll sync", content: toB64("Credits Roll keeps your diary here so every device shows the same. Keep this repository private.\n") }) });
          head = await remoteHead();
        }
        const dirtyAt = ls.get(SYNC_DIRTY, 0);
        let base = await remoteFiles(head.commit);
        if (head.commit !== SYNC.head) {
          const remote = {};
          for (const k of SYNC_FILES) {
            const sha = base.files[`${k}.json`];
            if (sha && sha !== (SYNC.shas || {})[k]) remote[k] = JSON.parse(fromB64((await gh(`/git/blobs/${sha}`)).content));
          }
          if (Object.keys(remote).length) applyRemote(remote, !!dirtyAt);
          SYNC.head = head.commit; SYNC.shas = Object.fromEntries(SYNC_FILES.map((k) => [k, base.files[`${k}.json`]]));
          saveSync();
          if (!dirtyAt) break;
        }
        if (!dirtyAt && SYNC_FILES.every((k) => base.files[`${k}.json`])) break;
        const pushed = await pushSnapshot(head, base);
        if (!pushed) continue; // another device synced in between: pull that, merge, try again
        SYNC.head = pushed.commit; SYNC.shas = Object.fromEntries(SYNC_FILES.map((k) => [k, pushed.files[`${k}.json`]]));
        if (ls.get(SYNC_DIRTY, 0) === dirtyAt) ls.del(SYNC_DIRTY); // a change made meanwhile goes next time
        break;
      }
      Object.assign(SYNC, { at: new Date().toISOString(), error: "" }); saveSync();
    } catch (e) {
      Object.assign(syncState, { err: true, keyErr: !!e.key, note: e.message || "Couldn't sync." });
      if (SYNC) { SYNC.error = syncState.note; saveSync(); }
    } finally {
      syncState.running = false; syncBusy = null; syncRedraw();
      if (SYNC && !syncState.err && ls.get(SYNC_DIRTY, 0)) syncLater(60000); // changed while it ran
    }
  })();
  return syncBusy;
}
// Links this device: checks the key can reach a private repository, then syncs (merging anything already here).
async function syncConnect(repo, token) {
  repo = String(repo || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$|\/+$/g, "");
  token = String(token || "").trim();
  const link = token.match(/#sync=([\w-]+)/);
  if (link) { const x = readSyncLink(link[1]); if (!x) return syncSay("That link isn't a Credits Roll sync link.", true); ({ r: repo, t: token } = x); }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return syncSay("Type the repository as your-name/repository-name, for example sjnift/credits-roll-data.", true);
  if (!token) return syncSay("Paste the key (token) from GitHub.", true);
  SYNC = { repo, token, head: null, shas: {} };
  if (store.get(KEYS.rows, null)) ls.set(SYNC_DIRTY, Date.now()); // what's here is merged with what's there
  saveSync();
  await syncNow();
  // a key or repository that doesn't work isn't kept
  if (syncState.keyErr) { const note = syncState.note; SYNC = null; saveSync(); ls.del(SYNC_DIRTY); syncSay(note, true); }
  else if (!syncState.err) syncSay("Connected. Changes made here now reach your other devices, and theirs come here.");
}
// Stops syncing here (also when this browser's saved data is deleted); the repository keeps its copy.
function syncDisconnect(deleted) {
  clearTimeout(syncTimer); syncTimer = null;
  SYNC = null; saveSync(); ls.del(SYNC_DIRTY);
  Object.assign(syncState, { note: deleted ? "" : "This device no longer syncs. Its diary stays here.", err: false, linkOpen: false });
  syncRedraw();
}
const syncSay = (note, err) => { Object.assign(syncState, { note, err: !!err }); syncRedraw(); };

/* ----- linking another device: a link (or QR code) carrying the repository and key ----- */
const b64url = (s) => toB64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function readSyncLink(code) {
  try { const x = JSON.parse(fromB64(code.replace(/-/g, "+").replace(/_/g, "/"))); return x && x.r && x.t ? x : null; } catch { return null; }
}
const syncLink = () => `${location.origin}${location.pathname.replace(/[^/]*$/, "")}#sync=${b64url(JSON.stringify({ r: SYNC.repo, t: SYNC.token }))}`;
// A sync link opened on this device: link it, and take the key out of the address straight away.
const SYNC_FROM_LINK = (() => {
  const m = location.hash.match(/^#sync=([\w-]+)/);
  if (!m) return null;
  try { history.replaceState(null, "", location.pathname + location.search); } catch {}
  return readSyncLink(m[1]);
})();
let qrLib = null;
function drawQr(el) {
  const draw = () => { const qr = qrcode(0, "L"); qr.addData(syncLink()); qr.make(); el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true }); };
  if (window.qrcode) return draw();
  qrLib = qrLib || new Promise((ok, no) => { const s = Object.assign(document.createElement("script"), { src: "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js", onload: ok, onerror: no }); document.head.append(s); });
  qrLib.then(draw, () => { el.hidden = true; });
}

/* ----- the sync box, in Settings on a phone and at the foot of the page on a computer ----- */
const agoText = (iso) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtDate(iso.slice(0, 10)); };
// kind: "desktop", "phone" (Settings) or "welcome" (the phone's import screen)
function syncInner(kind) {
  if (IN_VIEWER) return "";
  const phone = kind !== "desktop", welcome = kind === "welcome" && !SYNC;
  const btn = (act, label, main) => `<button class="${phone ? `btn${main ? " green" : ""} block` : `btn${main ? " primary" : ""} small`}" type="button" data-sync="${act}">${label}</button>`;
  const note = syncState.note ? `<p class="status${syncState.err ? " err" : ""}" role="status">${esc(syncState.note)}</p>` : "";
  const name = welcome ? "Synced on another device?" : "Sync across devices";
  const title = phone ? `<p class="title">${name}</p>` : `<h3 class="sub-h">${name}</h3>`;
  if (!SYNC) {
    return title + `<p class="status">${welcome ? "Open the sync link from that device's Settings here, or connect to the same repository below, and your diary comes in."
      : "Keep your diary, film details, averages, friends and keys the same on every phone and computer, through a private GitHub repository only you can see."}</p>
      <label class="status" for="sync-repo">Repository</label><input class="key" id="sync-repo" type="text" autocomplete="off" spellcheck="false" placeholder="your-name/credits-roll-data" value="${esc(SITE_REPO ? `${SITE_REPO.split("/")[3]}/credits-roll-data` : "")}">
      <label class="status" for="sync-token">Key (GitHub token), or a sync link from another device</label><input class="key" id="sync-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">
      ${btn("connect", syncState.running ? "Connecting…" : "Connect", true)}${note}
      <details class="sync-help"><summary>How to set it up (once, about 5 minutes)</summary><ol class="steps">
        <li>On GitHub, <a href="https://github.com/new" target="_blank" rel="noopener">make a new repository</a> called <b>credits-roll-data</b>. Choose <b>Private</b>, then Create repository.</li>
        <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Make a fine-grained token</a>: name it Credits Roll sync and pick the longest expiry.
          Under Repository access choose <b>Only select repositories</b> and pick credits-roll-data. Under Permissions → Repository permissions set <b>Contents</b> to <b>Read and write</b>. Generate it and copy it.</li>
        <li>Paste the key above and press Connect. On your other devices, use Link another device here instead of making another key.</li></ol></details>`;
  }
  const when = syncState.running ? "Syncing…" : SYNC.at ? `Synced ${agoText(SYNC.at)} with ${esc(SYNC.repo)}.` : `Connected to ${esc(SYNC.repo)}.`;
  const pending = !syncState.running && ls.get(SYNC_DIRTY, 0) ? " Changes on this device go up within a minute." : "";
  const link = syncState.linkOpen ? `<div class="sync-link"><p class="status">On your other device, scan this code with the camera, or open this link there. It carries your key, so keep it to yourself.</p>
      <div class="sync-qr" data-syncqr aria-label="QR code with the sync link"></div>${btn("copy", "Copy the link")}
      <p class="status">For an app installed on an iPhone's home screen, copy the link and paste it into that app's Settings → Sync across devices.</p></div>` : "";
  return title + `<p class="status">${when}${pending}</p>${note}
    <div class="${phone ? "sync-btns" : "lookup-row"}">${btn("now", "Sync now", true)}${btn("link", syncState.linkOpen ? "Hide the link" : "Link another device")}${btn("disconnect", "Stop syncing this device")}</div>${link}`;
}
function syncRedraw() {
  for (const el of document.querySelectorAll("[data-syncbox]")) el.innerHTML = syncInner(el.dataset.syncbox);
  const qr = document.querySelector("[data-syncqr]");
  if (qr && SYNC) drawQr(qr);
}
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-sync]");
  if (!t) return;
  const a = t.dataset.sync;
  if (a === "connect") syncConnect(($("#sync-repo") || {}).value, ($("#sync-token") || {}).value);
  else if (a === "now") syncNow();
  else if (a === "show") { const box = $("#sync-box"); box.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); ($("#sync-token") || box).focus({ preventScroll: true }); }
  else if (a === "link") { syncState.linkOpen = !syncState.linkOpen; syncRedraw(); }
  else if (a === "disconnect") syncDisconnect();
  else if (a === "copy") {
    try { await navigator.clipboard.writeText(syncLink()); t.textContent = "Copied. Open it on your other device"; }
    catch { t.insertAdjacentHTML("afterend", `<input class="key" readonly value="${esc(syncLink())}">`); t.textContent = "Select the link below and copy it"; }
  }
});
// At start: a sync link opened here links this device; otherwise a linked device brings in what's new.
function syncOnStart() {
  if (IN_VIEWER) return;
  syncRedraw();
  if (SYNC_FROM_LINK) syncConnect(SYNC_FROM_LINK.r, SYNC_FROM_LINK.t);
  else if (SYNC) syncNow();
}
</script>
