<script>
/* ---------- your diary on this site, locked with a password ----------
   A copy lives on the site itself: docs/diary/ in the site's own repository, committed through GitHub's API. It is
   encrypted (AES-GCM, with a key made from the owner's password by PBKDF2) in parts: the export, the keys (TMDB,
   OMDb, Apify and the GitHub key that lets a device update the site), Letterboxd averages, friends, and film
   details and people's photos spread over 16 parts each, so a few newly found films send only the few parts they
   fall in. Every device given the password once shows the diary with no import, has the keys without typing them,
   and keeps the site up to date itself: what it looks up goes up, what other devices looked up comes down, and
   nothing is looked up twice. The export's email address is never in it, and nothing is ever there unencrypted.
   index.json says, in the clear, whose diary it is, when each part last changed, and how to make the key from the
   password. (Version 1 diaries had parts rows, meta, extra, keys; they're read, and replaced on the next update.) */
const SITE_REC = "cr-site-v1";      // every device that opened it: { salt, key, user, at, have: { part: at }, sums: { part: sha-256 } }
const SITE_PUB = "cr-site-pub-v1";  // a device that puts it there: { repo, token, at }
const SITE_DIRTY = "cr-site-dirty"; // changes here not yet on the site: { at, now: a new import, friend or key }
const SITE_SHARDS = 16;
const SITE_PARTS = ["rows", "keys", "lbx", "friends", ...Array.from({ length: SITE_SHARDS }, (_, i) => `m${i}`), ...Array.from({ length: SITE_SHARDS }, (_, i) => `p${i}`)];
const siteShard = (key) => hash32(String(key)) % SITE_SHARDS;
const SITE_KEYS = ["tmdb", "omdb", "apify"]; // with the GitHub key, these travel with the diary
const SITE_PATH = "docs/diary/";    // in the repository; the site serves docs/ at its root
const SITE_ITER = 600000;
const SITE_MIN_PASS = 10;
const SITE_ON = !IN_VIEWER && /^https?:$/.test(location.protocol);
const SITE_DEVICE = document.querySelector(".tabbar") ? "phone" : "computer";
const SITE_GH_REPO = SITE_REPO ? SITE_REPO.split("/").slice(3, 5).join("/") : "";
const PUBLISHED = new Set([KEYS.rows, KEYS.meta, KEYS.photos, KEYS.lbx, KEYS.friends, ...SITE_KEYS.map((k) => KEYS[k])]);
const SITE_SOON = new Set([KEYS.rows, KEYS.friends, ...SITE_KEYS.map((k) => KEYS[k])]); // go up within seconds
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
// One byte for the kind, 12 for the IV, then the encrypted data. Kinds 1 (plain) and 2 (gzipped) are from before parts
// were tied to a label; 3 (gzipped) and 4 (plain) carry one (AES-GCM's additional data) that must match when opened:
// a part's name and when it last changed, so no part can be swapped for another, or for an older copy of itself.
async function seal(key, value, plain, aad) {
  let body = new TextEncoder().encode(JSON.stringify(value)), gz = false;
  if (!plain && typeof CompressionStream === "function") { body = await squeeze(body, "in"); gz = true; }
  const kind = aad ? (gz ? 3 : 4) : (gz ? 2 : 1);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, ...(aad ? { additionalData: new TextEncoder().encode(aad) } : {}) }, key, body));
  const out = new Uint8Array(13 + ct.length); out[0] = kind; out.set(iv, 1); out.set(ct, 13);
  return out;
}
// `untiedOk`: whether a part without a label is still accepted (only from a diary this device has never seen signed)
async function unseal(key, bytes, aad, untiedOk = true) {
  const kind = bytes[0], tied = kind === 3 || kind === 4;
  if (!tied && !untiedOk) throw new Error(SITE_TAMPERED);
  let body = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(1, 13), ...(tied ? { additionalData: new TextEncoder().encode(aad || "") } : {}) }, key, bytes.subarray(13)));
  if (kind === 2 || kind === 3) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser is too old to unpack the diary. Update it and try again.");
    body = await squeeze(body, "out");
  }
  return JSON.parse(new TextDecoder().decode(body));
}
// The index is signed with the diary's key (its SHA-256, sealed), and counts its updates (`n`): a device takes it only
// when the signature holds and the count isn't lower than one it has seen, so nobody can change what it lists or put
// an older copy back. An unsigned index (from before) is taken only by a device that has never seen a signed one.
const SITE_TAMPERED = "The diary on the site doesn't check out: it was changed by something other than your devices, or an older copy was put back. This device kept its own copy, and puts it back on the site at its next update.";
const indexBody = (idx) => { const { sig, ...rest } = idx; return canon(rest); };
const signIndex = async (key, idx) => ({ ...idx, sig: bytesToB64(await seal(key, await sha256(indexBody(idx)), true, "index")) });
async function siteTrusts(key, idx) {
  if (!idx.sig) return !(SITE && SITE.signed);
  try { if ((await unseal(key, b64ToBytes(idx.sig), "index", false)) !== await sha256(indexBody(idx))) return false; } catch { return false; }
  return (Number(idx.n) || 0) >= ((SITE && SITE.n) || 0);
}
const partLabel = (p, idx) => `${p}|${idx.parts[p]}`;

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
// Writes files (null deletes one) as one commit; false when someone else changed the repository first. `base` is the
// folder they're in: the diary's, unless said otherwise.
async function commitFiles(head, files, message, base = SITE_PATH) {
  const tree = [];
  for (const [name, bytes] of Object.entries(files)) {
    const sha = bytes && (await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: bytesToB64(bytes), encoding: "base64" }) })).sha;
    tree.push({ path: base + name, mode: "100644", type: "blob", sha: sha || null });
  }
  const t = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.tree, tree }) });
  // signed with GitHub's private no-reply address, not the account's email (which a public repository shows to all)
  const by = { name: "Credits Roll", email: `${SITEPUB.repo.split("/")[0]}@users.noreply.github.com` };
  const c = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: t.sha, parents: [head.commit], author: by, committer: by }) });
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
function siteLocal() {
  const keys = Object.fromEntries(SITE_KEYS.map((k) => [k, store.get(KEYS[k], "")]).filter(([, v]) => v));
  if (SITEPUB) Object.assign(keys, { github: SITEPUB.token, repo: SITEPUB.repo });
  const out = { rows: siteRows(store.get(KEYS.rows, null)), keys, lbx: LBX, friends: store.get(KEYS.friends, []).map((f) => ({ ...f, rows: siteRows(f.rows) })) };
  for (let i = 0; i < SITE_SHARDS; i++) { out[`m${i}`] = {}; out[`p${i}`] = {}; }
  for (const [k, m] of Object.entries(META)) out[`m${siteShard(k)}`][k] = m;
  for (const [k, v] of Object.entries(PHOTOS)) out[`p${siteShard(k)}`][k] = v;
  return out;
}
// Bulk lookups that use up a daily allowance (OMDb) are left to devices that update the site, or that have their
// own import: a device that only reads the site's diary would spend the allowance on films others fetch anyway.
const siteLeadsLookups = () => !SITE_ON || !SITE || !!SITEPUB || !(store.get(KEYS.rows, null) || {}).site;
const siteUser = (rows) => (((rows && rows.profile) || [])[0] || {}).Username || "";
// Whether this device's diary belongs to the account whose diary is on the site. An export of someone else's account
// imported here never goes up in its place, and the site's diary doesn't replace it either.
const siteSameUser = (rows = store.get(KEYS.rows, null), user = (site.index && site.index.user) || (SITE && SITE.user)) => {
  const mine = siteUser(rows);
  return !mine || !user || mine.toLowerCase() === String(user).toLowerCase();
};
// Which of two imports is newer: by when it was imported, or for imports from before that was noted,
// by the newest diary entry and then by size.
const rowsWhen = (r) => r.importedAt || (r.diary || []).reduce((m, e) => ((e.Date || "") > m ? e.Date : m), "");
const rowsSize = (r) => (r.diary || []).length + (r.watched || []).length + (r.reviews || []).length;
const newerRows = (a, b) => (rowsWhen(a) !== rowsWhen(b) ? rowsWhen(a) > rowsWhen(b) : rowsSize(a) > rowsSize(b));
/* Merging the site's copy (b) into this device's (a). The site's wins unless this device's is strictly better, so
   devices settle on one version instead of each sending its own back and forth for ever; what's better here
   then goes up, and the other devices take it. */
// The better of two copies of a film's details: matched by hand, then found, then a newer kind of match, then more
// filled in, then looked up more recently.
const metaScore = (m) => (!m ? -1 : (m.pin ? 1e6 : 0) + (m.miss ? 0 : 1e4) + (m.v || 0) * 100 + (m.om ? 10 : 0) + (m.ik ? 5 : 0));
const metaBetter = (a, b) => metaScore(a) !== metaScore(b) ? metaScore(a) > metaScore(b) : (a.t || "") > (b.t || "");
const mergeMeta = (a, b) => { const out = { ...a }; for (const [k, m] of Object.entries(b || {})) if (!out[k] || !metaBetter(out[k], m)) out[k] = m; return out; };
const mergeLbx = (a, b) => { const out = { ...a }; for (const [k, x] of Object.entries(b || {})) if (!(out[k] && out[k].r && !(x && x.r))) out[k] = x; return out; };
// friends are matched by name; the newer export of each is kept
const mergeFriends = (a, b) => {
  const by = new Map((a || []).map((f) => [f.name.toLowerCase(), f]));
  for (const f of b || []) { const k = f.name.toLowerCase(), had = by.get(k); if (!had || !newerRows(had.rows, f.rows)) by.set(k, f); }
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
    // film details and photos come in parts (m0…, p0…), or whole from a version 1 diary (meta, extra)
    let metaIn = null, photosIn = null, lbxIn = null, friendsIn = null;
    for (const [p, v] of Object.entries(parts)) {
      if (p === "meta" || /^m\d+$/.test(p)) metaIn = Object.assign(metaIn || {}, v);
      else if (/^p\d+$/.test(p)) photosIn = Object.assign(photosIn || {}, v);
      else if (p === "lbx") lbxIn = v;
      else if (p === "friends") friendsIn = v;
      else if (p === "extra") { photosIn = Object.assign(photosIn || {}, v.photos); lbxIn = v.lbx; friendsIn = v.friends; }
    }
    if (metaIn) META = mergeMeta(META, safeMetaMap(metaIn));
    if (photosIn) PHOTOS = { ...PHOTOS, ...safePhotos(photosIn) };
    if (lbxIn) { LBX = mergeLbx(LBX, safeLbx(lbxIn)); store.set(KEYS.lbx, LBX); }
    if (friendsIn) { store.set(KEYS.friends, mergeFriends(store.get(KEYS.friends, []), safeFriends(friendsIn))); loadFriends(); }
    if (parts.keys) {
      // the site's keys replace this device's, unless a key changed here hasn't gone up yet; with the GitHub key
      // this device keeps the site up to date too
      const waiting = !!ls.get(SITE_DIRTY, null), x = parts.keys;
      for (const k of SITE_KEYS) if (x[k] && (!waiting || !store.get(KEYS[k], ""))) store.set(KEYS[k], x[k]);
      const repo = SITE_GH_REPO || x.repo || (SITEPUB && SITEPUB.repo);
      if (x.github && repo && !(waiting && SITEPUB)) SITEPUB = { repo, token: x.github, at: (SITEPUB && SITEPUB.at) || null };
      job.badKey = imdbJob.badKey = lbJob.badKey = false;
    }
    if (metaIn || photosIn) saveMeta();
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
// The parts this device doesn't have yet, read from the site (or from GitHub, just before sending), six at a time.
async function siteBring(idx, read, draw) {
  const key = await importKey(SITE.key), parts = {};
  const have = store.get(KEYS.rows, null) ? SITE.have || {} : {}; // nothing saved here any more: everything again
  SITE.have = SITE.have || {}; SITE.sums = SITE.sums || {};
  const want = Object.keys(idx.parts).filter((p) => idx.parts[p] && have[p] !== idx.parts[p]);
  const next = async () => { for (let p; (p = want.shift());) { const bytes = await read(p); if (bytes) parts[p] = await unseal(key, bytes, partLabel(p, idx), !idx.sig); } };
  await Promise.all(Array.from({ length: 6 }, next));
  SITE.n = Math.max(SITE.n || 0, Number(idx.n) || 0); SITE.signed = SITE.signed || !!idx.sig;
  if (Object.keys(parts).length) await siteTake(parts, idx, draw);
  else { SITE.at = idx.at; saveSite(); }
}
// Whether this device has something the site doesn't (a part it lacks, or a part that differs): checked at start.
async function siteDiffers() {
  if (!SITE || !site.index || site.index.salt !== SITE.salt || !store.get(KEYS.rows, null) || !siteSameUser()) return false;
  const local = siteLocal();
  if (!site.index.sig || !(await siteTrusts(await importKey(SITE.key), site.index))) return true; // unsigned, or not to be trusted: send this device's
  for (const p of SITE_PARTS) if (!site.index.parts[p] || (SITE.sums || {})[p] !== await sha256(canon(local[p]))) return true;
  return false;
}

/* ----- checking the site, opening the diary with its password ----- */
async function siteCheck(draw) {
  if (!SITE_ON) return;
  site.checked = Date.now();
  try { site.index = await siteGet("index.json"); site.offline = false; }
  catch { site.offline = true; if (draw) siteRedraw(); return; } // offline: what's saved here still shows
  const idx = site.index;
  // taken off the site from another device: this one stops sending, and keeps its copy
  if (!idx && SITE) { SITE = null; ls.del(SITE_DIRTY); clearTimeout(site.timer); site.timer = null; saveSite(); }
  if (idx && SITE && SITE.salt === idx.salt && (idx.at !== SITE.at || !store.get(KEYS.rows, null)) && siteSameUser(store.get(KEYS.rows, null), idx.user)) {
    try {
      if (!(await siteTrusts(await importKey(SITE.key), idx))) throw new Error(SITE_TAMPERED);
      await siteBring(idx, (p) => siteGet(`${p}.bin`, idx.parts[p]), draw);
    } catch (e) { Object.assign(site, { note: /operation|decrypt/i.test(e.message || "") || e.name === "OperationError" ? SITE_TAMPERED : e.message || "Couldn't bring in the site's diary.", err: true, noteIn: "publish" }); }
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
    // (a fresh look: this device's record of an earlier diary doesn't count against a new password's)
    const prev = SITE; SITE = null;
    if (!(await siteTrusts(key, idx))) { SITE = prev; throw new Error(SITE_TAMPERED.replace(" This device kept its own copy, and puts it back on the site at its next update.", "")); }
    site.index = idx;
    SITE = { salt: idx.salt, key: await exportKey(key), user: idx.user, at: null, have: {}, sums: {}, n: 0, signed: false };
    saveSite();
    await siteBring(idx, (p) => siteGet(`${p}.bin`, idx.parts[p]), true);
    siteDone("", where);
  } catch (e) { siteDone(e.message || "Couldn't open it.", where, true); }
}

/* ----- putting the diary on the site ----- */
// `password` locks it afresh: the first time, or a new password. `restart` (a forgotten password) replaces a diary
// this device can't open with this device's own, under the new password: the GitHub key just typed is what proves
// it's the owner, since only they can make one for the site.
function sitePublish({ password, restart, where = "publish" } = {}) {
  if (!SITE_ON || !SITEPUB || (!password && !SITE)) return Promise.resolve();
  if (site.job) return site.job;
  site.job = (async () => {
    const dirty = JSON.stringify(ls.get(SITE_DIRTY, null)), fresh = !!password, had = site.index;
    siteBusy(restart ? "Replacing the diary on the site…" : fresh ? (had ? "Changing the password…" : "Putting your diary on the site…") : "Updating the site…", where);
    try {
      if (!store.get(KEYS.rows, null)) throw ghFail("Import your Letterboxd export first.");
      let key, salt, check, said = "The site is up to date.";
      if (fresh) { salt = bytesToB64(crypto.getRandomValues(new Uint8Array(16))); key = await deriveKey(password, salt); check = bytesToB64(await seal(key, "credits-roll", true)); }
      for (let attempt = 0; ; attempt++) {
        if (attempt === 4) throw ghFail("Another device kept changing the site at the same moment. Try again in a minute.");
        const head = await repoHead(), files = await hostedFiles(head.commit);
        const idx = files["index.json"] ? JSON.parse(new TextDecoder().decode(await blobBytes(files["index.json"]))) : null;
        const known = idx && SITE && SITE.salt === idx.salt;
        // taken off the site from another device: nothing goes back up until it's put there again
        if (!idx && !fresh) { SITE = null; ls.del(SITE_DIRTY); saveSite(); said = "Your diary was taken off the site from another device. Put it back here if you want it there."; break; }
        // another account's diary on this device stays here: it never replaces the one on the site
        if (idx && !siteSameUser(store.get(KEYS.rows, null), idx.user)) { ls.del(SITE_DIRTY); said = `This device has @${siteUser(store.get(KEYS.rows, null))}'s diary, so it leaves @${idx.user}'s on the site alone.`; break; }
        if (idx && !known && !restart) throw ghFail(fresh && !had ? "A diary was put on this site from another device a moment ago. Refresh the page in a minute and type its password."
          : "The diary on the site has a password this device doesn't know yet. Type it first.");
        if (!fresh) { key = await importKey(SITE.key); salt = SITE.salt; check = idx ? idx.check : bytesToB64(await seal(key, "credits-roll", true)); }
        // a diary that doesn't check out isn't brought in: this device's copy goes back up whole, signed afresh
        let trusted = known && await siteTrusts(key, idx);
        if (trusted && idx.at !== SITE.at) { // another device changed it: that first (unless a part of it doesn't open)
          try { await siteBring(idx, async (p) => files[`${p}.bin`] && blobBytes(files[`${p}.bin`]), true); }
          catch (e) { if (e.name === "OperationError" || e.message === SITE_TAMPERED) trusted = false; else throw e; }
        }
        const whole = fresh || !idx || !trusted || !idx.sig; // (unsigned, from before: every part is sealed again, tied to its label)
        const local = siteLocal(), now = new Date().toISOString(), sums = (!whole && SITE.sums) || {}, up = {};
        for (const p of SITE_PARTS) {
          const sum = await sha256(canon(local[p]));
          if (whole || !idx.parts[p] || sums[p] !== sum) up[p] = sum;
        }
        // a version 1 diary's whole-file parts go once their contents are in the new ones
        const old = Object.keys(files).filter((n) => n.endsWith(".bin") && !SITE_PARTS.includes(n.slice(0, -4)));
        if (!Object.keys(up).length && !old.length) break;
        const parts = Object.fromEntries(Object.entries(whole ? {} : idx.parts).filter(([p]) => SITE_PARTS.includes(p)));
        const out = Object.fromEntries(old.map((n) => [n, null]));
        for (const p of Object.keys(up)) { parts[p] = now; out[`${p}.bin`] = await seal(key, local[p], false, `${p}|${now}`); }
        const n = Math.max(Number(idx && idx.n) || 0, (SITE && SITE.n) || 0) + 1;
        const next = await signIndex(key, { app: "credits-roll", v: 2, n, user: siteUser(local.rows) || (idx && idx.user) || "", at: now, from: SITE_DEVICE,
          salt, iter: SITE_ITER, check, parts });
        out["index.json"] = new TextEncoder().encode(JSON.stringify(next, null, 1) + "\n");
        if (!(await commitFiles(head, out, `Diary on the site: ${restart && idx && !known ? "started over with a new password" : fresh ? (idx ? "new password" : "first copy") : "updated"} from a ${SITE_DEVICE}`))) continue;
        SITE = { salt, key: await exportKey(key), user: next.user, at: now, have: { ...(whole ? {} : SITE.have), ...Object.fromEntries(Object.keys(up).map((p) => [p, now])) },
          sums: { ...sums, ...up }, n, signed: true };
        SITEPUB.at = now; delete SITEPUB.prev; site.index = next; saveSite();
        said = restart ? "Done: the diary on the site is this device's, locked with your new password. Your other devices will ask for it, then add what they have."
          : fresh ? (idx ? "Password changed. Your other devices will ask for the new one." : "Your diary is on the site. On your other devices, open the site and type the password.") : "Updated the site.";
        break;
      }
      if (JSON.stringify(ls.get(SITE_DIRTY, null)) === dirty) ls.del(SITE_DIRTY); // a change made meanwhile goes next time
      if (SITEPUB && SITEPUB.prev) { delete SITEPUB.prev; saveSite(); }
      siteDone(said, where.split(":")[0]);
    } catch (e) {
      if (e.key && !SITEPUB.at) SITEPUB = SITEPUB.prev || null; // a key that never worked isn't kept (the one before it is)
      saveSite();
      siteDone(e.message || "Couldn't update the site.", where, true);
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
function siteKey(repo, token, where) {
  repo = String(repo || SITE_GH_REPO).trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$|\/+$/g, "");
  token = String(token || "").trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return siteSay("Type the site's repository as name/repository, for example sjnift/bogie1946.", true, where), false;
  if (!token) return siteSay("Paste the GitHub key.", true, where), false;
  const prev = SITEPUB && SITEPUB.at ? { repo: SITEPUB.repo, token: SITEPUB.token, at: SITEPUB.at } : null; // back if the new one isn't accepted
  SITEPUB = { repo, token, at: null, ...(prev ? { prev } : {}) }; saveSite();
  return true;
}
// Forgets everything about the site on this device (with "Delete saved data from this browser").
function siteForget() { clearTimeout(site.timer); site.timer = null; SITE = null; SITEPUB = null; ls.del(SITE_DIRTY); saveSite(); Object.assign(site, { note: "", err: false }); }

// A change on this device goes up by itself: a new import, friend or key within seconds; film details, photos and
// averages a minute after lookups finish, so other devices don't look the same films up again.
STORE_HOOK = (k) => {
  if (site.applying || !SITEPUB || !SITE || !PUBLISHED.has(k) || !siteSameUser()) return;
  const d = ls.get(SITE_DIRTY, null) || { at: Date.now() };
  if (SITE_SOON.has(k)) d.now = true;
  ls.set(SITE_DIRTY, d);
  siteLater();
};
function siteLater() {
  const d = ls.get(SITE_DIRTY, null);
  if (!d || !SITEPUB || !SITE) return;
  const wait = d.now ? 4000 : 60e3;
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
  const html = siteBoxInner(kind);
  return kind === "publish" ? html + shareBox() : html;
}
function siteBoxInner(kind) {
  if (!SITE_ON) return "";
  const phone = SITE_DEVICE === "phone", idx = site.index;
  const mine = MY_LIB && MY_LIB.profile.username, user = idx && idx.user;
  const sameUser = !mine || !user || mine.toLowerCase() === user.toLowerCase();
  const unlocked = idx && SITE && SITE.salt === idx.salt;
  const btn = (act, label, main) => `<button class="${phone ? `btn${main ? " green" : ""} block` : `btn${main ? " primary" : ""} small`}" type="button" data-site="${act}"${site.busy ? " disabled" : ""}>${label}</button>`;
  const field = (name, label, type, auto, value = "") => `<label class="status" for="site-${name}-${kind}">${label}</label>
    <input class="key" id="site-${name}-${kind}" name="${name}" type="${type}" autocomplete="${auto}" spellcheck="false" value="${esc(value)}">`;
  const sayIn = (w) => site.noteIn !== w ? "" : site.busy ? `<p class="status" role="status">${esc(site.busy)}</p>` : site.note ? `<p class="status${site.err ? " err" : ""}" role="status">${esc(site.note)}</p>` : "";
  const say = sayIn(kind);
  const box = (title, body, glow) => phone ? `<div class="card${glow ? " glow" : ""} site-card"><p class="title">${title}</p>${body}</div>` : `<div class="site-in"><h3 class="sub-h">${title}</h3>${body}</div>`;
  const passForm = () => field("pass", "Password", "password", "current-password") + btn("unlock", "Open", true) + say;
  const help = `<details class="site-help"><summary>How to make the GitHub key (once)</summary><ol class="steps">
      <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Make a fine-grained token</a>: name it Credits Roll site and pick the longest expiry.</li>
      <li>Under Repository access choose <b>Only select repositories</b> and pick <b>${esc((SITE_GH_REPO || "your-name/your-site").split("/")[1])}</b>.</li>
      <li>Under Permissions → Repository permissions set <b>Contents</b> to <b>Read and write</b>. Generate it, copy it and paste it above. It goes into your locked diary, so every device you open it on can update the site; you paste it only once.</li></ol></details>`;
  const keyFields = () => (SITE_GH_REPO ? "" : field("repo", "The site's repository", "text", "off", "")) + field("token", "GitHub key for the site", "password", "off");
  // a forgotten password: nobody can open the copy on the site, but the owner (who alone can make a GitHub key for
  // the site) can replace it with this device's diary under a new password
  const forgot = () => `<details class="site-help"><summary>Forgot the password?</summary><div class="site-form">${!MY_LIB
      ? `<p class="status">Nobody can open the copy on the site without it, but you can replace it. Import your Letterboxd export or a backup file on this device ${phone ? "below" : "first"}, then come back here and choose a new password.</p>`
      : `<p class="status">Nobody can open the copy on the site without it, but you can replace it with this device's diary, locked with a new password. If this device's copy is old, import a fresh Letterboxd export here first. To show it's you, paste a GitHub key for the site: only you can make one. Your other devices will then ask for the new password, and add what they have.</p>
      ${field("newpass", `New password (at least ${SITE_MIN_PASS} characters)`, "text", "new-password")}${SITEPUB ? field("token", "GitHub key for the site", "password", "off") : keyFields()}${btn("restart", "Replace it with a new password")}${sayIn(`${kind}:forgot`)}${help}`}</div></details>`;

  if (kind === "open") {
    // just replaced after a forgotten password: say so here, where it was done
    if (unlocked && site.noteIn === "open" && site.note && !site.err) return box("Your diary is on the site again", say, true);
    if (!idx || unlocked || !sameUser) return "";
    const [title, text] = !MY_LIB ? [`@${esc(user)}'s diary is on this site`, "Type its password to open it here. This device remembers it, so you only do this once."]
      : SITE ? ["The diary on this site has a new password", "Type it to keep this device up to date."]
      : ["Your diary is on this site", "Type its password and this device keeps up with it from now on, with no importing."];
    return box(title, `<p class="status">${text}</p>${passForm()}${forgot()}`, true);
  }
  if (!MY_LIB) return "";
  // a device that had the site's diary, now holding someone else's
  if (idx && !sameUser) return SITE ? box("Your diary on this site", `<p class="status">This device now has @${esc(mine)}'s diary, so it leaves @${esc(user)}'s diary on the site alone: nothing goes up from here, and nothing comes down. Import @${esc(user)}'s own export again to keep this device in step.</p>`) : "";
  const title = "Your diary on this site";
  if (idx === undefined) return box(title, `<p class="status">${site.offline ? "Couldn't reach the site just now." : "Checking the site…"}</p>`);
  if (!idx) {
    return box("Put your diary on this site", `<p class="status">Lock it with a password and every device can open it: just open the site and type the password once, with no importing. Your TMDB, OMDb, Apify and GitHub keys go along, locked the same way, so every device you open it on can use them and keeps the site up to date; your email address stays out of it. Choose a long password: it guards all of this.</p>
      ${field("newpass", `Choose a password (at least ${SITE_MIN_PASS} characters; you'll type it once on each device)`, "text", "new-password")}
      ${SITEPUB ? "" : keyFields()}${btn("create", "Put my diary on the site", true)}${say}${SITEPUB ? "" : help}`);
  }
  if (!unlocked) {
    return box(title, `<p class="status">${SITE ? "The diary on this site has a new password." : "Your diary is on this site."} ${phone ? "Type its password to keep this device up to date." : "Type its password at the top of the page to keep this device up to date."}</p>${phone ? passForm() + forgot() : ""}`);
  }
  const when = `Updated ${agoText(idx.at)}${idx.from ? ` from a ${esc(idx.from)}` : ""}.`;
  if (!SITEPUB) {
    return box(title, `<p class="status">This device opens @${esc(user)}'s diary from the site. ${when} The site has no working GitHub key, so no device can update it. Add one here and it goes to every device.</p>
      ${keyFields()}${btn("key", "Use this key", true)}${say}${help}`);
  }
  const d = ls.get(SITE_DIRTY, null);
  const pending = d ? (d.now ? " A change made here goes up in a moment." : " Film details found here go up a minute after lookups finish.") : "";
  return box(title, `<p class="status">On the site, locked with your password. ${when} Every device where you've typed the password keeps it up to date, and what one looks up, the others get.${pending}</p>${say}
    <div class="${phone ? "site-btns" : "site-row"}">${btn("now", "Update the site now", true)}${btn("remove", site.armed ? (phone ? "Tap again to take it off" : "Click again to take it off") : "Take my diary off the site")}</div>
    <details class="site-help"><summary>Change the password</summary>${field("newpass", `New password (at least ${SITE_MIN_PASS} characters)`, "text", "new-password")}${btn("password", "Change the password")}
      <p class="status">Your other devices will ask for the new one.</p></details>
    <details class="site-help"><summary>Use a new GitHub key</summary>${field("token", "New GitHub key (when the old one expires)", "password", "off")}${btn("key", "Use this key")}
      <p class="status">It goes to every device through your locked diary.</p></details>`);
}
// Redraws the boxes whose content changed (so a password being typed isn't wiped by an unrelated redraw). What's
// typed and which sections are open stay as they were (while it works, and when it didn't), unless it just worked.
const siteDrawn = new WeakMap();
function siteRedraw() {
  const keep = !(site.note && !site.err && !site.busy);
  for (const el of document.querySelectorAll("[data-sitebox]")) {
    const html = siteBox(el.dataset.sitebox);
    if (siteDrawn.get(el) !== html || el.innerHTML.trim() === "" !== !html.trim()) {
      const summary = (d) => (d.querySelector("summary") || {}).textContent;
      const open = new Set([...el.querySelectorAll("details[open]")].map(summary));
      const typed = Object.fromEntries([...el.querySelectorAll("input[name]")].map((i) => [i.name, i.value]));
      el.innerHTML = html; siteDrawn.set(el, html);
      if (!keep) continue;
      for (const d of el.querySelectorAll("details")) if (open.has(summary(d))) d.open = true;
      for (const i of el.querySelectorAll("input[name]")) if (typed[i.name] && !i.value) i.value = typed[i.name];
    }
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
  else if (a === "restart") {
    const pass = val("newpass"), w = `${where}:forgot`;
    if (!store.get(KEYS.rows, null)) return siteSay("Import your Letterboxd export or a backup file on this device first.", true, w);
    if (pass.length < SITE_MIN_PASS) return siteSay(`Choose a password of at least ${SITE_MIN_PASS} characters.`, true, w);
    if (!siteKey(val("repo") || (SITEPUB && SITEPUB.repo), val("token"), w)) return;
    sitePublish({ password: pass, restart: true, where: w });
  }
  else if (a === "key") { if (siteKey(val("repo") || (SITEPUB && SITEPUB.repo), val("token"))) sitePublish().then(() => { if (SITEPUB && !site.err) siteSay("Key saved. It reaches your other devices through your locked diary."); }); }
  else if (a === "now") sitePublish();
  else if (a === "share-on") shareSet(val("sharekey").trim() || ownTmdbKey());
  else if (a === "share-off") shareSet(null);
  else if (a === "remove") {
    if (!site.armed) { site.armed = setTimeout(() => { site.armed = null; siteRedraw(); }, 6000); return siteRedraw(); }
    clearTimeout(site.armed); site.armed = null; siteRemove();
  }
});
// Enter in the password box opens the diary
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.matches || !e.target.matches('[data-sitebox] input[name="pass"]')) return;
  e.preventDefault();
  const b = e.target.closest("[data-sitebox]").querySelector('[data-site="unlock"]');
  if (b) b.click();
});
// After the first screen: bring in what the site has that this device doesn't, then send what this device has that
// the site doesn't (a part it lacks goes at once: the new layout, or a key). Lookups wait for this (`siteSettled`),
// so nothing another device already found is looked up again.
function siteStart() {
  if (!SITE_ON) return;
  siteRedraw();
  site.ready = (Date.now() - site.checked < 5000 ? Promise.resolve() : siteCheck(true)).then(async () => {
    if (!SITEPUB || !SITE || !(await siteDiffers())) return;
    const missing = site.index && (!site.index.sig || SITE_PARTS.some((p) => !site.index.parts[p]));
    ls.set(SITE_DIRTY, { ...(ls.get(SITE_DIRTY, null) || { at: Date.now() }), ...(missing ? { now: true } : {}) });
    siteLater();
  }).catch(() => {});
}
const siteSettled = () => site.ready || Promise.resolve();

/* ----- sharing the TMDB key with visitors ----- */
// The owner can let anyone who opens the site and imports their own export use their TMDB key, so cast & crew fill in
// with no key of their own: the key goes in docs/share.json beside the pages, in the clear (it has to be readable by
// everyone), put there or taken away from Settings on any device with the GitHub key. Only the TMDB key is ever shared.
const SHARE_FILE = "share.json";
// on: null until asked (once a page), then true, false, or "?" when GitHub couldn't be asked
const share = { on: null, checking: false, busy: "", note: "", err: false };
const shareThere = async (commit) => { try { return (await gh(`/contents/docs?ref=${commit}`)).some((f) => f.name === SHARE_FILE); } catch (e) { if (e.status === 404) return false; throw e; } };
async function shareCheck() {
  if (!SITEPUB || share.checking) return;
  share.checking = true;
  try { share.on = await shareThere((await repoHead()).commit); } catch { share.on = "?"; }
  share.checking = false;
  siteRedraw();
}
async function shareSet(key) {
  if (!SITEPUB || share.busy) return;
  if (key && !/^[A-Za-z0-9._-]{3,500}$/.test(key)) { Object.assign(share, { note: "That doesn't look like a TMDB key.", err: true }); return siteRedraw(); }
  Object.assign(share, { busy: key ? "Sharing your TMDB key…" : "Stopping…", note: "", err: false });
  siteRedraw();
  try {
    for (let attempt = 0; ; attempt++) {
      if (attempt === 4) throw ghFail("Another device kept changing the site at the same moment. Try again in a minute.");
      const head = await repoHead();
      if (!key && !(await shareThere(head.commit))) break;
      const body = key ? new TextEncoder().encode(JSON.stringify({ tmdb: key, at: new Date().toISOString() }, null, 1) + "\n") : null;
      if (await commitFiles(head, { [SHARE_FILE]: body }, key ? "Share the TMDB key with visitors" : "Stop sharing the TMDB key with visitors", "docs/")) break;
    }
    Object.assign(share, { on: !!key, busy: "", note: key ? "Shared. Visitors get it within a minute or two." : "Stopped. Visitors stop using it within a minute or two.", err: false });
  } catch (e) { Object.assign(share, { busy: "", note: e.message || "Couldn't change it.", err: true }); }
  siteRedraw();
}
// In Settings, under the diary on the site: on a device with the GitHub key, its own diary and a TMDB key.
function shareBox() {
  if (!SITE_ON || !SITEPUB || !MY_LIB || !ownTmdbKey() || !siteSameUser()) return "";
  if (share.on === null) { if (!share.checking) setTimeout(shareCheck); return ""; }
  const phone = SITE_DEVICE === "phone";
  const btn = (act, label, main) => `<button class="${phone ? `btn${main ? " green" : ""} block` : `btn${main ? " primary" : ""} small`}" type="button" data-site="${act}"${share.busy ? " disabled" : ""}>${label}</button>`;
  const say = share.busy ? `<p class="status" role="status">${esc(share.busy)}</p>` : share.note ? `<p class="status${share.err ? " err" : ""}" role="status">${esc(share.note)}</p>` : "";
  const unsure = share.on === "?" ? `<p class="status">Couldn't ask GitHub whether your key is shared just now.</p>` : "";
  const body = share.on === true
    ? `<p class="status">Anyone who opens this site and imports their own Letterboxd export gets cast &amp; crew filled in with your TMDB key, with no key of their own. Your diary and your other keys stay locked.</p>${btn("share-off", "Stop sharing")}${say}`
    : `<p class="status">Let anyone who opens this site and imports their own Letterboxd export get cast &amp; crew filled in with your TMDB key, with no key of their own. Your diary and your other keys stay locked. The TMDB key itself becomes public: anyone could copy it from the site. TMDB keys are free, but if someone misused it TMDB could switch it off, and your own lookups would stop until you made a new one.</p>
      <details class="site-help"><summary>Share a different TMDB key instead</summary><label class="status" for="site-sharekey">A TMDB key to share, say from a second TMDB account (leave empty to share yours)</label>
        <input class="key" id="site-sharekey" name="sharekey" type="password" autocomplete="off" spellcheck="false"></details>
      ${btn("share-on", "Share my TMDB key with visitors", true)}${share.on === "?" ? btn("share-off", "Stop sharing") : ""}${unsure}${say}`;
  const title = share.on === true ? "Visitors use your TMDB key" : "Share your TMDB key with visitors";
  return phone ? `<div class="card site-card"><p class="title">${title}</p>${body}</div>` : `<div class="site-in"><h3 class="sub-h">${title}</h3>${body}</div>`;
}
</script>
