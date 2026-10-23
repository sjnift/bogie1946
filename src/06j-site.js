<script>
/* ---------- your diary on this site, locked with a password ----------
   The device where the export is imported puts a copy on the site itself: docs/diary/ in the site's own
   repository, committed through GitHub's API with a key that only that device keeps. The copy is encrypted
   (AES-GCM, with a key made from the owner's password by PBKDF2) in three parts: the export, film details,
   and the rest (photos, Letterboxd averages, friends), so a change sends only its own part again. Any device
   that opens the site and is given the password once shows the diary with no import, and keeps up with it.
   The export's email address and the API keys are never in it. index.json says, in the clear, whose diary it
   is, when each part last changed, and how to make the key from the password. */
const SITE_REC = "cr-site-v1";      // every device that opened it: { salt, key, user, at, have: { part: at }, sums: { part: sha-256 } }
const SITE_PUB = "cr-site-pub-v1";  // a device that puts it there: { repo, token, at }
const SITE_DIRTY = "cr-site-dirty"; // changes here not yet on the site: { at, now: a new import or friend }
const SITE_PARTS = ["rows", "meta", "extra"];
const SITE_PATH = "docs/diary/";    // in the repository; the site serves docs/ at its root
const SITE_ITER = 600000;
const SITE_MIN_PASS = 10;
const SITE_META_EVERY = 12 * 3600e3; // film details go up at most twice a day: each update stays in the repository's history
const SITE_ON = !IN_VIEWER && /^https?:$/.test(location.protocol);
const SITE_DEVICE = document.querySelector(".tabbar") ? "phone" : "computer";
const SITE_GH_REPO = SITE_REPO ? SITE_REPO.split("/").slice(3, 5).join("/") : "";
const PUBLISHED = new Set([KEYS.rows, KEYS.meta, KEYS.photos, KEYS.lbx, KEYS.friends]);
let SITE = ls.get(SITE_REC, null), SITEPUB = ls.get(SITE_PUB, null);
// the key works for the site's repository whatever it's called, so a renamed one is followed
if (SITEPUB && SITE_GH_REPO && SITEPUB.repo !== SITE_GH_REPO) { SITEPUB.repo = SITE_GH_REPO; ls.set(SITE_PUB, SITEPUB); }
// index: undefined until the site has been asked, null when it has no diary
const site = { index: undefined, offline: false, checked: 0, busy: "", note: "", err: false, noteIn: "publish", applying: false, armed: null, timer: null, due: 0, job: null };
const saveSite = () => { SITE ? ls.set(SITE_REC, SITE) : ls.del(SITE_REC); SITEPUB ? ls.set(SITE_PUB, SITEPUB) : ls.del(SITE_PUB); };

/* ----- bytes, hashes and the lock ----- */
const bytesToB64 = (bytes) => { let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const b64ToBytes = (b64) => { const bin = atob(String(b64).replace(/\s/g, "")); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const toB64 = (text) => bytesToB64(new TextEncoder().encode(text));
// The same data always gives the same text, whatever order its keys were added in.
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((n) => [n, x[n]])) : x));
const sha256 = async (text) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: b64ToBytes(salt), iterations: SITE_ITER }, base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
const importKey = (b64) => crypto.subtle.importKey("raw", b64ToBytes(b64), "AES-GCM", true, ["encrypt", "decrypt"]);
const exportKey = async (key) => bytesToB64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
const squeeze = async (bytes, how) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(how === "in" ? new CompressionStream("gzip") : new DecompressionStream("gzip"))).arrayBuffer());
// One byte for the kind (1 plain, 2 gzipped), 12 for the IV, then the encrypted data.
async function seal(key, value, plain) {
  let body = new TextEncoder().encode(JSON.stringify(value)), kind = 1;
  if (!plain && typeof CompressionStream === "function") { body = await squeeze(body, "in"); kind = 2; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body));
  const out = new Uint8Array(13 + ct.length); out[0] = kind; out.set(iv, 1); out.set(ct, 13);
  return out;
}
async function unseal(key, bytes) {
  let body = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(1, 13) }, key, bytes.subarray(13)));
  if (bytes[0] === 2) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser is too old to unpack the diary. Update it and try again.");
    body = await squeeze(body, "out");
  }
  return JSON.parse(new TextDecoder().decode(body));
}

/* ----- the site (for reading) and GitHub (for changing it) ----- */
async function siteGet(name, version) {
  const res = await fetch(`diary/${name}${version ? `?v=${encodeURIComponent(version)}` : ""}`, { cache: version ? "default" : "no-cache" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The site said ${res.status}.`);
  return name.endsWith(".json") ? res.json() : new Uint8Array(await res.arrayBuffer());
}
const ghFail = (msg, extra = {}) => Object.assign(new Error(msg), extra);
async function gh(path, opts = {}) {
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${SITEPUB.repo}${path}`, { ...opts,
      headers: { Authorization: `Bearer ${SITEPUB.token}`, Accept: "application/vnd.github+json", ...(opts.body ? { "Content-Type": "application/json" } : {}) } });
  } catch { throw ghFail("Couldn't reach GitHub. Your changes are kept here and go up next time."); }
  if (res.status === 401) throw ghFail("GitHub didn't accept the key. It may have expired: make a new one (same steps as before) and paste it here.", { key: true });
  if (res.status === 404 && !path) throw ghFail(`GitHub can't find ${SITEPUB.repo} with this key. Check that the key was given that repository.`, { key: true });
  if (res.status === 403) throw ghFail("This key can read the site's repository but not change it. Give it Contents: Read and write.", { key: true });
  if (!res.ok) throw ghFail(`GitHub said ${res.status}.`, { status: res.status });
  return res.status === 204 ? null : res.json();
}
async function repoHead() {
  const branch = (await gh("")).default_branch || "main";
  // (the time on the end stops the browser answering from its own copy of a minute ago)
  const commit = (await gh(`/git/ref/heads/${branch}?t=${Date.now()}`)).object.sha;
  return { branch, commit, tree: (await gh(`/git/commits/${commit}`)).tree.sha };
}
// The diary's files in the repository as it is now: { name: blob sha }.
async function hostedFiles(commit) {
  try { return Object.fromEntries((await gh(`/contents/${SITE_PATH.slice(0, -1)}?ref=${commit}`)).filter((f) => f.type === "file").map((f) => [f.name, f.sha])); }
  catch (e) { if (e.status === 404) return {}; throw e; }
}
const blobBytes = async (sha) => b64ToBytes((await gh(`/git/blobs/${sha}`)).content);
// Writes files (null deletes one) as one commit; false when someone else changed the repository first.
async function commitFiles(head, files, message) {
  const tree = [];
  for (const [name, bytes] of Object.entries(files)) {
    const sha = bytes && (await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: bytesToB64(bytes), encoding: "base64" }) })).sha;
    tree.push({ path: SITE_PATH + name, mode: "100644", type: "blob", sha: sha || null });
  }
  const t = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.tree, tree }) });
  const c = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: t.sha, parents: [head.commit] }) });
  try { await gh(`/git/refs/heads/${head.branch}`, { method: "PATCH", body: JSON.stringify({ sha: c.sha, force: false }) }); return true; }
  catch (e) { if (e.status === 422 || e.status === 409) return false; throw e; }
}

/* ----- what goes up from this device, and bringing the site's copy in ----- */
const PROFILE_KEEP = ["Username", "Date Joined", "Given Name", "Family Name"];
function siteRows(rows) {
  if (!rows) return null;
  const r = { ...rows, profile: (rows.profile || []).map((p) => Object.fromEntries(PROFILE_KEEP.filter((k) => k in p).map((k) => [k, p[k]]))) };
  delete r.site;
  return r;
}
const siteLocal = () => ({ rows: siteRows(store.get(KEYS.rows, null)), meta: META,
  extra: { photos: PHOTOS, lbx: LBX, friends: store.get(KEYS.friends, []).map((f) => ({ ...f, rows: siteRows(f.rows) })) } });
const siteUser = (rows) => (((rows && rows.profile) || [])[0] || {}).Username || "";
// Which of two imports is newer: by when it was imported, or for imports from before that was noted,
// by the newest diary entry and then by size.
const rowsWhen = (r) => r.importedAt || (r.diary || []).reduce((m, e) => ((e.Date || "") > m ? e.Date : m), "");
const rowsSize = (r) => (r.diary || []).length + (r.watched || []).length + (r.reviews || []).length;
const newerRows = (a, b) => (rowsWhen(a) !== rowsWhen(b) ? rowsWhen(a) > rowsWhen(b) : rowsSize(a) > rowsSize(b));
// The better of two copies of a film's details: matched by hand, then found, then a newer kind of match, then more filled in.
const metaScore = (m) => (!m ? -1 : (m.pin ? 1e6 : 0) + (m.miss ? 0 : 1e4) + (m.v || 0) * 100 + (m.om ? 10 : 0) + (m.ik ? 5 : 0));
const mergeMeta = (a, b) => { const out = { ...a }; for (const [k, m] of Object.entries(b || {})) if (metaScore(m) > metaScore(out[k])) out[k] = m; return out; };
const mergeLbx = (a, b) => { const out = { ...a }; for (const [k, x] of Object.entries(b || {})) if (!out[k] || (x && x.r && !out[k].r)) out[k] = x; return out; };
// friends are matched by name (each device gives a friend its own id); the newer export of each is kept
const mergeFriends = (a, b) => {
  const by = new Map((a || []).map((f) => [f.name.toLowerCase(), f]));
  for (const f of b || []) { const k = f.name.toLowerCase(), had = by.get(k); if (!had || newerRows(f.rows, had.rows)) by.set(k, had ? { ...f, id: had.id } : f); }
  return [...by.values()];
};
// Parts from the site come into this device: an import newer than this device's (or one that came from the site
// before) replaces it; film details, averages, photos and friends are combined with what's here.
async function siteTake(parts, idx, draw) {
  let newRows = false;
  site.applying = true;
  try {
    if (parts.rows) {
      const mine = store.get(KEYS.rows, null);
      if (!mine || mine.site || newerRows(parts.rows, mine)) { store.set(KEYS.rows, { ...parts.rows, site: idx.parts.rows }); newRows = true; }
    }
    if (parts.meta) META = mergeMeta(META, parts.meta);
    if (parts.extra) {
      const x = parts.extra;
      if (x.photos) PHOTOS = { ...x.photos, ...PHOTOS };
      if (x.lbx) { LBX = mergeLbx(LBX, x.lbx); store.set(KEYS.lbx, LBX); }
      if (x.friends) { store.set(KEYS.friends, mergeFriends(store.get(KEYS.friends, []), x.friends)); loadFriends(); }
    }
    if (parts.meta || parts.extra) saveMeta();
  } finally { site.applying = false; }
  store.flush();
  for (const p of Object.keys(parts)) { SITE.have[p] = idx.parts[p]; SITE.sums[p] = await sha256(canon(parts[p])); }
  SITE.at = idx.at; SITE.user = idx.user; saveSite();
  try { MY_LIB = myLibrary(); LOAD_ERROR = ""; } catch (e) { LOAD_ERROR = (e && e.message) || "unknown error"; }
  if (MY_LIB) state.mode = "mine";
  DATA_REV++; SEARCH_INDEX = null;
  if (draw) {
    render();
    // a diary that just arrived gets the daily feed's newer entries, and any films still to look up
    if (newRows && MY_LIB) refreshFeed().then(() => autoLookup(allFilmsLib())).catch(() => {});
  }
}
// The parts this device doesn't have yet, read from the site (or from GitHub, just before sending).
async function siteBring(idx, read, draw) {
  const key = await importKey(SITE.key), parts = {};
  const have = store.get(KEYS.rows, null) ? SITE.have || {} : {}; // nothing saved here any more: everything again
  SITE.have = SITE.have || {}; SITE.sums = SITE.sums || {};
  for (const p of SITE_PARTS) {
    if (!idx.parts[p] || have[p] === idx.parts[p]) continue;
    const bytes = await read(p);
    if (bytes) parts[p] = await unseal(key, bytes);
  }
  if (Object.keys(parts).length) await siteTake(parts, idx, draw);
  else { SITE.at = idx.at; saveSite(); }
}

/* ----- checking the site, opening the diary with its password ----- */
async function siteCheck(draw) {
  if (!SITE_ON) return;
  site.checked = Date.now();
  try { site.index = await siteGet("index.json"); site.offline = false; }
  catch { site.offline = true; if (draw) siteRedraw(); return; } // offline: what's saved here still shows
  const idx = site.index;
  if (idx && SITE && SITE.salt === idx.salt && (idx.at !== SITE.at || !store.get(KEYS.rows, null))) {
    try { await siteBring(idx, (p) => siteGet(`${p}.bin`, idx.parts[p]), draw); }
    catch (e) { Object.assign(site, { note: e.message || "Couldn't bring in the site's diary.", err: true, noteIn: "publish" }); }
  }
  if (draw) siteRedraw();
}
async function siteUnlock(pass, where) {
  if (!pass) return siteSay("Type the password.", true, where);
  siteBusy("Opening…", where);
  try {
    const idx = await siteGet("index.json");
    if (!idx) throw new Error("There's no diary on this site any more.");
    const key = await deriveKey(pass, idx.salt);
    try { await unseal(key, b64ToBytes(idx.check)); } catch { throw new Error("That password doesn't open it. Check it and try again."); }
    site.index = idx;
    SITE = { salt: idx.salt, key: await exportKey(key), user: idx.user, at: null, have: {}, sums: {} };
    saveSite();
    await siteBring(idx, (p) => siteGet(`${p}.bin`, idx.parts[p]), true);
    siteDone("", where);
  } catch (e) { siteDone(e.message || "Couldn't open it.", where, true); }
}

/* ----- putting the diary on the site ----- */
// `password` locks it afresh: the first time, or a new password.
function sitePublish({ password } = {}) {
  if (!SITE_ON || !SITEPUB || (!password && !SITE)) return Promise.resolve();
  if (site.job) return site.job;
  site.job = (async () => {
    const dirty = JSON.stringify(ls.get(SITE_DIRTY, null)), fresh = !!password, had = site.index;
    siteBusy(fresh ? (had ? "Changing the password…" : "Putting your diary on the site…") : "Updating the site…");
    try {
      if (!store.get(KEYS.rows, null)) throw ghFail("Import your Letterboxd export first.");
      let key, salt, check, said = "The site is up to date.";
      if (fresh) { salt = bytesToB64(crypto.getRandomValues(new Uint8Array(16))); key = await deriveKey(password, salt); check = bytesToB64(await seal(key, "credits-roll", true)); }
      for (let attempt = 0; ; attempt++) {
        if (attempt === 4) throw ghFail("Another device kept changing the site at the same moment. Try again in a minute.");
        const head = await repoHead(), files = await hostedFiles(head.commit);
        const idx = files["index.json"] ? JSON.parse(new TextDecoder().decode(await blobBytes(files["index.json"]))) : null;
        const known = idx && SITE && SITE.salt === idx.salt;
        if (idx && !known) throw ghFail(fresh && !had ? "A diary was put on this site from another device a moment ago. Refresh the page in a minute and type its password."
          : "The diary on the site has a password this device doesn't know yet. Type it first.");
        if (known && idx.at !== SITE.at) await siteBring(idx, async (p) => files[`${p}.bin`] && blobBytes(files[`${p}.bin`]), true); // another device changed it: that first
        if (!fresh) { key = await importKey(SITE.key); salt = SITE.salt; check = idx ? idx.check : bytesToB64(await seal(key, "credits-roll", true)); }
        const local = siteLocal(), now = new Date().toISOString(), sums = (!fresh && known && SITE.sums) || {}, up = {};
        for (const p of SITE_PARTS) {
          const sum = await sha256(canon(local[p]));
          if (fresh || !idx || !idx.parts[p] || sums[p] !== sum) up[p] = sum;
        }
        if (!Object.keys(up).length) break;
        const parts = { ...(fresh || !idx ? {} : idx.parts) };
        const out = {};
        for (const p of Object.keys(up)) { out[`${p}.bin`] = await seal(key, local[p]); parts[p] = now; }
        const next = { app: "credits-roll", v: 1, user: siteUser(local.rows) || (idx && idx.user) || "", imported: rowsWhen(local.rows), at: now, from: SITE_DEVICE,
          salt, iter: SITE_ITER, check, parts };
        out["index.json"] = new TextEncoder().encode(JSON.stringify(next, null, 1) + "\n");
        if (!(await commitFiles(head, out, `Diary on the site: ${fresh ? (idx ? "new password" : "first copy") : "updated"} from a ${SITE_DEVICE}`))) continue;
        SITE = { salt, key: await exportKey(key), user: next.user, at: now, have: { ...(fresh ? {} : SITE.have), ...Object.fromEntries(Object.keys(up).map((p) => [p, now])) },
          sums: { ...sums, ...up } };
        SITEPUB.at = now; site.index = next; saveSite();
        said = fresh ? (idx ? "Password changed. Your other devices will ask for the new one." : "Your diary is on the site. On your other devices, open the site and type the password.") : "Updated the site.";
        break;
      }
      if (JSON.stringify(ls.get(SITE_DIRTY, null)) === dirty) ls.del(SITE_DIRTY); // a change made meanwhile goes next time
      siteDone(said);
    } catch (e) {
      if (e.key && !SITEPUB.at) SITEPUB = null; // a key that never worked isn't kept
      saveSite();
      siteDone(e.message || "Couldn't update the site.", "publish", true);
    } finally {
      site.job = null;
      if (ls.get(SITE_DIRTY, null) && !site.err) siteLater();
      siteRedraw();
    }
  })();
  return site.job;
}
// Takes the diary off the site; every device keeps its own copy, and nothing goes up again until it's put back.
async function siteRemove() {
  siteBusy("Taking it off the site…");
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const head = await repoHead(), files = await hostedFiles(head.commit);
      if (!Object.keys(files).length || await commitFiles(head, Object.fromEntries(Object.keys(files).map((n) => [n, null])), `Diary taken off the site from a ${SITE_DEVICE}`)) {
        SITE = null; site.index = null; ls.del(SITE_DIRTY); saveSite();
        return siteDone("Your diary is off the site. Every device keeps the copy it has.");
      }
    }
    throw ghFail("Another device kept changing the site at the same moment. Try again in a minute.");
  } catch (e) { siteDone(e.message || "Couldn't take it off.", "publish", true); }
}
function siteKey(repo, token) {
  repo = String(repo || SITE_GH_REPO).trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$|\/+$/g, "");
  token = String(token || "").trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return siteSay("Type the site's repository as name/repository, for example sjnift/bogie1946.", true), false;
  if (!token) return siteSay("Paste the GitHub key.", true), false;
  SITEPUB = { repo, token, at: null }; saveSite();
  return true;
}
// Forgets everything about the site on this device (with "Delete saved data from this browser").
function siteForget() { clearTimeout(site.timer); site.timer = null; SITE = null; SITEPUB = null; ls.del(SITE_DIRTY); saveSite(); Object.assign(site, { note: "", err: false }); }

// A change on this device goes up by itself: a new import or friend within seconds, film details and averages
// once lookups have finished, at most twice a day.
STORE_HOOK = (k) => {
  if (site.applying || !SITEPUB || !SITE || !PUBLISHED.has(k)) return;
  const d = ls.get(SITE_DIRTY, null) || { at: Date.now() };
  if (k === KEYS.rows || k === KEYS.friends) d.now = true;
  ls.set(SITE_DIRTY, d);
  siteLater();
};
function siteLater() {
  const d = ls.get(SITE_DIRTY, null);
  if (!d || !SITEPUB || !SITE) return;
  const wait = d.now ? 4000 : Math.max(10 * 60e3, (SITEPUB.at ? Date.parse(SITEPUB.at) + SITE_META_EVERY : 0) - Date.now());
  if (site.timer && site.due <= Date.now() + wait) return; // already going sooner
  clearTimeout(site.timer); site.due = Date.now() + wait;
  site.timer = setTimeout(function go() {
    if (!d.now && [job, imdbJob, lbJob].some((j) => j && j.running)) { site.timer = setTimeout(go, 60e3); return; }
    site.timer = null; sitePublish();
  }, wait);
}
// Going into the background sends a new import straight away; coming back checks the site for a newer copy.
addEventListener("visibilitychange", () => {
  if (!SITE_ON) return;
  if (document.visibilityState === "hidden") { const d = ls.get(SITE_DIRTY, null); if (d && d.now && SITEPUB) sitePublish(); }
  else if (Date.now() - site.checked > 10 * 60e3) siteCheck(true);
});

/* ----- the boxes: "open" (asks for the password) and "publish" (in Settings, or at the foot of the page) ----- */
const agoText = (iso) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `on ${fmtDate(iso.slice(0, 10))}`; };
const siteSay = (note, err, where = "publish") => { Object.assign(site, { note, err: !!err, noteIn: where }); siteRedraw(); };
const siteBusy = (busy, where = "publish") => { Object.assign(site, { busy, note: "", err: false, noteIn: where }); siteRedraw(); };
const siteDone = (note, where = "publish", err) => { Object.assign(site, { busy: "", note, err: !!err, noteIn: where }); siteRedraw(); };
function siteBox(kind) {
  if (!SITE_ON) return "";
  const phone = SITE_DEVICE === "phone", idx = site.index;
  const mine = MY_LIB && MY_LIB.profile.username, user = idx && idx.user;
  const sameUser = !mine || !user || mine.toLowerCase() === user.toLowerCase();
  const unlocked = idx && SITE && SITE.salt === idx.salt;
  const btn = (act, label, main) => `<button class="${phone ? `btn${main ? " green" : ""} block` : `btn${main ? " primary" : ""} small`}" type="button" data-site="${act}"${site.busy ? " disabled" : ""}>${label}</button>`;
  const field = (name, label, type, auto, value = "") => `<label class="status" for="site-${name}-${kind}">${label}</label>
    <input class="key" id="site-${name}-${kind}" name="${name}" type="${type}" autocomplete="${auto}" spellcheck="false" value="${esc(value)}">`;
  const say = site.noteIn !== kind ? "" : site.busy ? `<p class="status" role="status">${esc(site.busy)}</p>` : site.note ? `<p class="status${site.err ? " err" : ""}" role="status">${esc(site.note)}</p>` : "";
  const box = (title, body, glow) => phone ? `<div class="card${glow ? " glow" : ""} site-card"><p class="title">${title}</p>${body}</div>` : `<div class="site-in"><h3 class="sub-h">${title}</h3>${body}</div>`;
  const passForm = () => field("pass", "Password", "password", "current-password") + btn("unlock", "Open", true) + say;

  if (kind === "open") {
    if (!idx || unlocked || !sameUser) return "";
    const [title, text] = !MY_LIB ? [`@${esc(user)}'s diary is on this site`, "Type its password to open it here. This device remembers it, so you only do this once."]
      : SITE ? ["The diary on this site has a new password", "Type it to keep this device up to date."]
      : ["Your diary is on this site", "Type its password and this device keeps up with it from now on, with no importing."];
    return box(title, `<p class="status">${text}</p>${passForm()}`, true);
  }
  if (!MY_LIB || (idx && !sameUser)) return "";
  const title = "Your diary on this site";
  if (idx === undefined) return box(title, `<p class="status">${site.offline ? "Couldn't reach the site just now." : "Checking the site…"}</p>`);
  const help = `<details class="site-help"><summary>How to make the GitHub key (once)</summary><ol class="steps">
      <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Make a fine-grained token</a>: name it Credits Roll site and pick the longest expiry.</li>
      <li>Under Repository access choose <b>Only select repositories</b> and pick <b>${esc((SITE_GH_REPO || "your-name/your-site").split("/")[1])}</b>.</li>
      <li>Under Permissions → Repository permissions set <b>Contents</b> to <b>Read and write</b>. Generate it, copy it and paste it above. It stays in this browser.</li></ol></details>`;
  const keyFields = () => (SITE_GH_REPO ? "" : field("repo", "The site's repository", "text", "off", "")) + field("token", "GitHub key for the site", "password", "off");
  if (!idx) {
    return box("Put your diary on this site", `<p class="status">Lock it with a password and every device can open it: just open the site and type the password once, with no importing. Your email address and API keys stay out of it.</p>
      ${field("newpass", `Choose a password (at least ${SITE_MIN_PASS} characters; you'll type it once on each device)`, "text", "new-password")}
      ${SITEPUB ? "" : keyFields()}${btn("create", "Put my diary on the site", true)}${say}${SITEPUB ? "" : help}`);
  }
  if (!unlocked) {
    return box(title, `<p class="status">${SITE ? "The diary on this site has a new password." : "Your diary is on this site."} ${phone ? "Type its password to keep this device up to date." : "Type its password at the top of the page to keep this device up to date."}</p>${phone ? passForm() : ""}`);
  }
  const when = `Updated ${agoText(idx.at)}${idx.from ? ` from a ${esc(idx.from)}` : ""}.`;
  if (!SITEPUB) {
    return box(title, `<p class="status">This device opens @${esc(user)}'s diary from the site. ${when} To update the site from this device too, add a GitHub key.</p>
      ${keyFields()}${btn("key", "Use this key", true)}${say}${help}`);
  }
  const d = ls.get(SITE_DIRTY, null);
  const pending = d ? (d.now ? " A change made here goes up in a moment." : " New film details made here go up once lookups finish, at most twice a day.") : "";
  return box(title, `<p class="status">On the site, locked with your password. ${when}${pending}</p>${say}
    <div class="${phone ? "site-btns" : "site-row"}">${btn("now", "Update the site now", true)}${btn("remove", site.armed ? (phone ? "Tap again to take it off" : "Click again to take it off") : "Take my diary off the site")}</div>
    <details class="site-help"><summary>Change the password</summary>${field("newpass", `New password (at least ${SITE_MIN_PASS} characters)`, "text", "new-password")}${btn("password", "Change the password")}
      <p class="status">Your other devices will ask for the new one.</p></details>
    <p class="status"><button class="linkish" type="button" data-site="forget">Forget the GitHub key on this ${SITE_DEVICE}</button></p>`);
}
// Redraws the boxes whose content changed (so a password being typed isn't wiped by an unrelated redraw).
const siteDrawn = new WeakMap();
function siteRedraw() {
  for (const el of document.querySelectorAll("[data-sitebox]")) {
    const html = siteBox(el.dataset.sitebox);
    if (siteDrawn.get(el) !== html || el.innerHTML.trim() === "" !== !html.trim()) { el.innerHTML = html; siteDrawn.set(el, html); }
  }
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-site]");
  if (!t || t.disabled) return;
  const box = t.closest("[data-sitebox]"), where = box ? box.dataset.sitebox : "publish";
  const val = (n) => ((box && box.querySelector(`[name="${n}"]`)) || {}).value || "";
  const a = t.dataset.site;
  if (a !== "remove") { clearTimeout(site.armed); site.armed = null; }
  if (a === "unlock") siteUnlock(val("pass"), where);
  else if (a === "create" || a === "password") {
    const pass = val("newpass");
    if (pass.length < SITE_MIN_PASS) return siteSay(`Choose a password of at least ${SITE_MIN_PASS} characters.`, true);
    if (a === "create" && !SITEPUB && !siteKey(val("repo"), val("token"))) return;
    sitePublish({ password: pass });
  }
  else if (a === "key") { if (siteKey(val("repo"), val("token"))) sitePublish().then(() => { if (SITEPUB && !site.err) siteSay("Key saved. This device now updates the site when something changes here."); }); }
  else if (a === "now") sitePublish();
  else if (a === "remove") {
    if (!site.armed) { site.armed = setTimeout(() => { site.armed = null; siteRedraw(); }, 6000); return siteRedraw(); }
    clearTimeout(site.armed); site.armed = null; siteRemove();
  }
  else if (a === "forget") { SITEPUB = null; ls.del(SITE_DIRTY); saveSite(); siteSay("The GitHub key is gone from this device. It still opens your diary from the site."); }
});
// Enter in the password box opens the diary
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.matches || !e.target.matches('[data-sitebox] input[name="pass"]')) return;
  e.preventDefault();
  const b = e.target.closest("[data-sitebox]").querySelector('[data-site="unlock"]');
  if (b) b.click();
});
// After the first screen: check the site for its diary (or a newer copy), and send anything still waiting.
function siteStart() {
  if (!SITE_ON) return;
  siteRedraw();
  (Date.now() - site.checked < 5000 ? Promise.resolve() : siteCheck(true)).then(() => { if (SITEPUB && SITE && ls.get(SITE_DIRTY, null)) siteLater(); });
}
</script>
