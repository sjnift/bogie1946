// The diary on the site, locked with a password, against a stand-in GitHub (the repository) and a stand-in for
// the site itself (what Pages serves from docs/). A computer puts its diary there; what goes up is encrypted
// and carries no email address or API keys; a phone opens it with the password (a wrong one is refused) and
// keeps it after a reload; a newer import on the computer goes up by itself and reaches the phone; a change
// from another device at the same moment is merged; a new password, a forgotten one, taking it off, and a wrong key
// all behave.
import { createHash, webcrypto } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { open, seed, assert, noErrors, until, JSZip } from "./lib.mjs";
// Types into a box and makes sure it took: the page redraws its boxes when GitHub answers a question it asked, and typing
// at that very instant went into the box being replaced (now and then, on GitHub's slower machines).
async function typeIn(page, sel, value) {
  for (let i = 0; i < 5; i++) {
    await page.fill(sel, value);
    const ok = await page.evaluate(([sel, v]) => { const el = document.querySelector(sel), box = el && el.closest("[data-sitebox]");
      return !!el && el.value === v && (!box || SITE_TYPED[`${box.dataset.sitebox}|${el.name}`] === v); }, [sel, value]);
    if (ok) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`couldn't type into ${sel}`);
}

const REPO = "sjnift/bogie1946", TOKEN = "github_pat_test", PASS = "popcorn and credits", PASS2 = "second reel of film", PASS3 = "a third reel entirely";
const rows = { profile: [{ "Date Joined": "2020-01-01", Username: "tester", "Given Name": "Sam", "Email Address": "someone@example.com", Bio: "hi" }],
  watched: [{ Name: "Heat", Year: "1995", Date: "2024-01-01" }], diary: [{ Name: "Heat", Year: "1995", Date: "2024-02-03", "Watched Date": "2024-02-03", Rating: "4.5" }],
  ratings: [{ Name: "Heat", Year: "1995", Rating: "4.5" }] };
const film = (id, d) => ({ src: "tmdb", v: 9, id, d: [d], c: [], w: [], p: [], m: [], g: ["Crime"], k: ["USA"], l: "English", r: 120 });
const meta = { "heat|1995": film(949, "Michael Mann") };

// The repository as a map of path → blob sha for each tree; blobs are named the way git names them.
function fakeGitHub({ token = TOKEN } = {}) {
  const blobs = new Map(), trees = new Map(), commits = new Map(), sha1 = (x) => createHash("sha1").update(x).digest("hex");
  const gh = { calls: [], beforePatch: null, authors: [] };
  const blob = (buf) => { const sha = sha1(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])); blobs.set(sha, buf); return sha; };
  const tree = (files) => { const sha = sha1("tree " + JSON.stringify(Object.entries(files).sort())); trees.set(sha, files); return sha; };
  const commit = (t, parents) => { const sha = sha1(`commit ${t} ${parents} ${Math.random()}`); commits.set(sha, { tree: t, parents }); return sha; };
  gh.ref = commit(tree({ "docs/index.html": blob(Buffer.from("<!doctype html>")) }), []);
  gh.files = () => trees.get(commits.get(gh.ref).tree);
  gh.file = (path) => { const sha = gh.files()[path]; return sha && blobs.get(sha); };
  // another device's commit, made straight in the repository (null deletes a file)
  gh.write = (changes) => { const files = { ...gh.files() }; for (const [p, buf] of Object.entries(changes)) { if (buf === null) delete files[p]; else files[p] = blob(buf); } gh.ref = commit(tree(files), [gh.ref]); };
  gh.handler = async (route) => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization, Content-Type, Accept", "access-control-allow-methods": "GET, POST, PATCH, OPTIONS" };
    const reply = (status, body) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body || {}) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const m = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
    if (!m || m[1] !== REPO) return reply(404, { message: "Not Found" });
    if (req.headers().authorization !== `Bearer ${token}`) return reply(401, { message: "Bad credentials" });
    const p = m[2] || "", body = req.postData() ? JSON.parse(req.postData()) : null;
    gh.calls.push(`${method} ${p}`);
    let x;
    if (method === "GET" && p === "") return reply(200, { full_name: REPO, private: false, default_branch: "main" });
    if (method === "GET" && p === "/git/ref/heads/main") return reply(200, { object: { sha: gh.ref, type: "commit" } });
    if (method === "GET" && (x = p.match(/^\/git\/commits\/(\w+)$/))) return reply(200, { sha: x[1], tree: { sha: commits.get(x[1]).tree } });
    if (method === "GET" && (x = p.match(/^\/contents\/(.+)$/))) {
      const dir = x[1] + "/", files = trees.get(commits.get(url.searchParams.get("ref")).tree);
      const list = Object.entries(files).filter(([f]) => f.startsWith(dir) && !f.slice(dir.length).includes("/")).map(([f, sha]) => ({ name: f.slice(dir.length), path: f, sha, type: "file" }));
      return list.length ? reply(200, list) : reply(404, { message: "Not Found" });
    }
    if (method === "GET" && (x = p.match(/^\/git\/blobs\/(\w+)$/))) return reply(200, { sha: x[1], encoding: "base64", content: blobs.get(x[1]).toString("base64").replace(/.{60}/g, "$&\n") });
    if (method === "POST" && p === "/git/blobs") return reply(201, { sha: blob(Buffer.from(body.content, "base64")) });
    if (method === "POST" && p === "/git/trees") {
      const files = { ...trees.get(body.base_tree) };
      for (const e of body.tree) if (e.sha) files[e.path] = e.sha; else delete files[e.path];
      return reply(201, { sha: tree(files) });
    }
    if (method === "POST" && p === "/git/commits") { gh.authors.push(`${(body.author || {}).email} ${(body.committer || {}).email}`); return reply(201, { sha: commit(body.tree, body.parents) }); }
    if (method === "PATCH" && p === "/git/refs/heads/main") {
      if (gh.beforePatch) { const f = gh.beforePatch; gh.beforePatch = null; await f(); }
      if (!body.force && commits.get(body.sha).parents[0] !== gh.ref) return reply(422, { message: "Update is not a fast forward" });
      gh.ref = body.sha; return reply(200, { object: { sha: gh.ref } });
    }
    return reply(404, { message: "Not Found" });
  };
  // the site: whatever docs/diary/ holds in the repository right now
  gh.pages = async (route) => {
    const name = new URL(route.request().url()).pathname.split("/diary/")[1], buf = gh.file(`docs/diary/${name}`);
    return buf ? route.fulfill({ status: 200, contentType: name.endsWith(".json") ? "application/json" : "application/octet-stream", body: buf }) : route.fulfill({ status: 404, body: "not found" });
  };
  return gh;
}
// Opening and sealing parts in node, the way the page does.
const subtle = webcrypto.subtle;
const keyFor = async (pass, salt) => subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: Buffer.from(salt, "base64"), iterations: 600000 },
  await subtle.importKey("raw", Buffer.from(pass), "PBKDF2", false, ["deriveKey"]), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
// kinds 1 and 2 untied (from before), 3 and 4 tied to a label: the part's name and when it changed
async function openPart(key, buf, label) {
  const tied = buf[0] === 3 || buf[0] === 4;
  const body = Buffer.from(await subtle.decrypt({ name: "AES-GCM", iv: buf.subarray(1, 13), ...(tied ? { additionalData: Buffer.from(label || "") } : {}) }, key, buf.subarray(13)));
  return JSON.parse((buf[0] === 2 || buf[0] === 3 ? gunzipSync(body) : body).toString("utf8"));
}
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((n) => [n, x[n]])) : x));
const sha256 = (t) => createHash("sha256").update(t).digest("hex");
// The app's grouping of film details and photos into 16 parts (FNV-1a), and everything on the site, opened.
const hash32 = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const shardOf = (k) => `m${hash32(k) % 16}`;
const diaryFiles = (gh) => Object.keys(gh.files()).filter((f) => f.startsWith("docs/diary/")).map((f) => f.slice(11)).sort();
async function openAll(gh, key) {
  const all = { meta: {}, photos: {} }, ix = JSON.parse(gh.file("docs/diary/index.json"));
  for (const f of diaryFiles(gh).filter((n) => n.endsWith(".bin"))) {
    const p = f.slice(0, -4), v = await openPart(key, gh.file(`docs/diary/${f}`), `${p}|${ix.parts[p]}`);
    if (/^m\d+$/.test(p)) Object.assign(all.meta, v); else if (/^p\d+$/.test(p)) Object.assign(all.photos, v); else all[p] = v;
  }
  return all;
}
async function sealPart(key, value, label, plain) {
  const body = plain ? Buffer.from(JSON.stringify(value)) : gzipSync(Buffer.from(JSON.stringify(value)));
  const iv = webcrypto.getRandomValues(new Uint8Array(12)), ct = Buffer.from(await subtle.encrypt({ name: "AES-GCM", iv, ...(label ? { additionalData: Buffer.from(label) } : {}) }, key, body));
  return Buffer.concat([Buffer.from([label ? (plain ? 4 : 3) : (plain ? 1 : 2)]), Buffer.from(iv), ct]);
}
// an index signed the way the app signs it (the diary's key sealing the SHA-256 of everything else in it)
async function signed(key, ix) { const { sig, ...rest } = ix; return { ...rest, sig: (await sealPart(key, sha256(canon(rest)), "index", true)).toString("base64") }; }
async function device(browser, base, gh, file, opts) {
  const page = await open(browser, base, null, opts);
  await page.context().route(/api\.github\.com/, gh.handler);
  await page.context().route(/\/diary\//, gh.pages);
  if (file) { await page.goto(base + file + (opts.example === false ? "" : "?example")); await page.waitForFunction(() => typeof state === "object" && state.lib); }
  return page;
}
const settled = (page, what) => until(page, () => !site.job && !site.busy && site.index !== undefined, what);

export default async function ({ browser, base }) {
  const gh = fakeGitHub();

  // The site knows its own repository from its address, at the long one and the short one
  const probe = await open(browser, base, "desktop.html");
  const repos = await probe.evaluate(() => [["sjnift.github.io", "/credits-roll/desktop.html"], ["sjnift.github.io", "/bogie1946/mobile.html"], ["sjnift.github.io", "/mobile.html"], ["sjnift.github.io", "/"],
    ["127.0.0.1", "/desktop.html"]].map(([h, p]) => repoOfPage(h, p)));
  assert(JSON.stringify(repos) === JSON.stringify(["https://github.com/sjnift/credits-roll", "https://github.com/sjnift/bogie1946", "https://github.com/sjnift/sjnift.github.io",
    "https://github.com/sjnift/sjnift.github.io", null]), `repository from the address: ${repos}`);
  await probe.context().close();

  // A computer with a diary puts it on the site.
  const a = await device(browser, base, gh, "desktop.html", {});
  await seed(a, rows, { "cr-meta-v1": meta, "cr-tmdb-key": "k123", "cr-omdb-key": "om456" });
  await a.click("#btn-settings");
  await a.click("#site-box details.owner-open > summary"); // folded away until the GitHub key shows it's the owner
  await a.waitForSelector("#site-box #site-newpass-publish");
  await typeIn(a, "#site-newpass-publish", "short");
  await a.click('#site-box [data-site="create"]');
  assert(/at least 10/.test(await a.innerText("#site-box")), "a short password wasn't refused");
  await typeIn(a, "#site-newpass-publish", PASS);
  await typeIn(a, "#site-repo-publish", REPO);
  await typeIn(a, "#site-token-publish", TOKEN);
  await a.click('#site-box [data-site="create"]');
  await until(a, () => !site.job && site.index && SITEPUB && SITEPUB.at, "the first copy to go up");
  const idx = JSON.parse(gh.file("docs/diary/index.json"));
  const wantParts = ["rows", "keys", "lbx", "friends", ...Array.from({ length: 16 }, (_, i) => `m${i}`), ...Array.from({ length: 16 }, (_, i) => `p${i}`)];
  assert(idx.v === 2 && idx.user === "tester" && wantParts.every((p) => idx.parts[p]) && JSON.stringify(diaryFiles(gh)) === JSON.stringify([...wantParts.map((p) => `${p}.bin`), "index.json"].sort()),
    `on the site: ${diaryFiles(gh)}`);
  const everything = () => diaryFiles(gh).map((f) => gh.file(`docs/diary/${f}`).toString("latin1")).join();
  assert(!/someone@example\.com|k123|om456/.test(everything()) && !everything().includes(TOKEN), "the email address or a key is readable on the site");
  let key = await keyFor(PASS, idx.salt);
  let up = await openAll(gh, key);
  assert(up.rows.watched.length === 1 && up.rows.profile[0].Username === "tester" && up.rows.profile[0]["Given Name"] === "Sam" && !("Email Address" in up.rows.profile[0]) && !("Bio" in up.rows.profile[0]), `rows on the site: ${JSON.stringify(up.rows.profile)}`);
  assert(up.meta["heat|1995"].d[0] === "Michael Mann", "film details missing");
  // the keys travel in their own locked part, the GitHub key with them; nowhere else
  assert(JSON.stringify(up.keys) === JSON.stringify({ tmdb: "k123", omdb: "om456", github: TOKEN, repo: REPO }), `keys on the site: ${JSON.stringify(up.keys)}`);
  assert(!/k123|om456/.test(JSON.stringify({ ...up, keys: null })) && !JSON.stringify({ ...up, keys: null }).includes(TOKEN), "a key is outside its own locked part");
  assert(/On the site/.test(await a.innerText("#site-box")), `computer's box: ${await a.innerText("#site-box")}`);

  // The index is signed and counts its updates; every part is tied to its name and when it changed
  assert(idx.sig && idx.n === 1 && diaryFiles(gh).filter((f) => f.endsWith(".bin")).every((f) => gh.file(`docs/diary/${f}`)[0] === 3), "the diary on the site isn't signed, or a part isn't tied to its label");

  // A diary put there in the first layout (whole-file parts, no keys, no signature), on a device that has never seen
  // a signed one, as the owner's devices hadn't: it moves to the new layout, signed, by itself
  await a.evaluate(() => { SITE.signed = false; SITE.n = 0; saveSite(); });
  { const v1 = { rows: up.rows, meta: up.meta, extra: { photos: up.photos, lbx: up.lbx, friends: up.friends } }, at = new Date().toISOString(), out = {};
    for (const f of diaryFiles(gh)) out[`docs/diary/${f}`] = null;
    for (const [p, v] of Object.entries(v1)) out[`docs/diary/${p}.bin`] = await sealPart(key, v);
    const { sig, n, ...unsigned } = idx;
    out["docs/diary/index.json"] = Buffer.from(JSON.stringify({ ...unsigned, v: 1, at, parts: { rows: at, meta: at, extra: at } }));
    gh.write(out); }
  await a.reload(); await a.waitForFunction(() => typeof state === "object" && state.lib && MY_LIB);
  { const t0 = Date.now(); while (!JSON.parse(gh.file("docs/diary/index.json")).sig && Date.now() - t0 < 12000) await a.waitForTimeout(250); }
  await until(a, () => !site.job && !site.busy, "the computer to finish");
  assert(JSON.stringify(diaryFiles(gh)) === JSON.stringify([...wantParts.map((p) => `${p}.bin`), "index.json"].sort()), `after moving to the new layout: ${diaryFiles(gh)}`);
  up = await openAll(gh, key);
  assert(up.meta["heat|1995"] && up.keys.github === TOKEN, "the new layout lost something");
  assert(await a.evaluate(() => state.page) === "settings", "the reload didn't come back to Settings");

  // A phone with nothing on it: the site offers the diary; a wrong password is refused, the right one opens it,
  // with the keys (the GitHub one too: this phone keeps the site up to date as well) and nothing looked up again.
  const b = await device(browser, base, gh, "mobile.html", { phone: true, example: false });
  let tmdbCalls = 0;
  await b.context().route(/api\.themoviedb\.org/, (r) => { tmdbCalls++; r.abort(); });
  await b.waitForSelector('[data-sitebox="open"] input[name="pass"]', { state: "attached" });
  // most people with nothing imported are friends bringing their own export: the owner's way in is a small fold
  assert(await b.evaluate(() => { const d = document.querySelector('[data-sitebox="open"] details.owner-open'); return d && !d.open && /Are you @tester\? Open your diary/.test(d.querySelector("summary").textContent)
    && document.querySelector('[data-act="import"]').compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING; }), "the phone didn't put importing first, with the owner's way in folded below it");
  await b.click('[data-sitebox="open"] details.owner-open > summary');
  assert(/@tester's diary is on this site/.test(await b.innerText('[data-sitebox="open"]')), "the phone didn't offer the diary");
  // (forgot the password? with nothing here to put there instead, it says to import first)
  assert(await b.evaluate(() => /Forgot the password/.test(document.querySelector('[data-sitebox="open"]').textContent) && /Import your Letterboxd export/.test(document.querySelector('[data-sitebox="open"] details').textContent)
    && !document.querySelector('[data-site="restart"]')), "the phone with nothing on it didn't explain a forgotten password");
  await typeIn(b, '[data-sitebox="open"] input[name="pass"]', "not the password");
  await b.click('[data-sitebox="open"] [data-site="unlock"]');
  await until(b, () => !site.busy && site.err, "the wrong password to be refused");
  assert(/doesn't open it/.test(await b.innerText('[data-sitebox="open"]')) && !(await b.evaluate(() => MY_LIB)), "a wrong password opened something");
  await typeIn(b, '[data-sitebox="open"] input[name="pass"]', PASS);
  await b.press('[data-sitebox="open"] input[name="pass"]', "Enter");
  await until(b, () => MY_LIB && MY_LIB.films.length === 1 && !site.busy, "the phone to open the diary");
  await b.waitForTimeout(300);
  let got = await b.evaluate(() => ({ dir: META["heat|1995"] && META["heat|1995"].d[0], key: store.get(KEYS.tmdb, ""), omdb: store.get(KEYS.omdb, ""), pub: SITEPUB && SITEPUB.token,
    mode: state.mode, user: MY_LIB.profile.username, box: !!document.querySelector('[data-sitebox="open"] input'), leads: siteLeadsLookups() }));
  assert(got.dir === "Michael Mann" && got.key === "k123" && got.omdb === "om456" && got.pub === TOKEN && got.leads && got.mode === "mine" && got.user === "tester" && !got.box,
    `phone after opening: ${JSON.stringify(got)}`);
  assert(tmdbCalls === 0, `the phone looked up ${tmdbCalls} films the site already had`);
  await b.reload();
  await b.waitForFunction(() => typeof state === "object" && state.lib && MY_LIB);
  assert(await b.evaluate(() => MY_LIB.films.length === 1 && !document.querySelector('[data-sitebox="open"] input')), "the phone forgot the diary or asked again after a reload");

  // A key changed on the computer reaches the phone, without typing it there
  const keysAt = JSON.parse(gh.file("docs/diary/index.json")).parts.keys;
  await a.evaluate(() => store.set(KEYS.tmdb, "k999"));
  { const t0 = Date.now(); while (JSON.parse(gh.file("docs/diary/index.json")).parts.keys === keysAt && Date.now() - t0 < 12000) await a.waitForTimeout(250); }
  await until(a, () => !site.job && !site.busy, "the computer to send the new key");
  await b.evaluate(() => siteCheck(true));
  assert(await b.evaluate(() => store.get(KEYS.tmdb, "")) === "k999", "the new key didn't reach the phone");

  // What the phone looks up goes up (only the one part it falls in) and reaches the computer; then neither has
  // anything to send
  const zKey = "z|2010", before = { ...gh.files() };
  await b.evaluate((k) => { META[k] = cleanMeta({ src: "tmdb", v: 9, id: 10, d: ["Z"], c: [], w: [], p: [], m: [], g: ["Drama"], k: ["Japan"], l: "Japanese", r: 100, t: new Date().toISOString() }); saveMeta(); return sitePublish(); }, zKey);
  const changed = Object.keys(gh.files()).filter((f) => gh.files()[f] !== before[f]).map((f) => f.slice(11)).sort();
  assert(JSON.stringify(changed) === JSON.stringify([`${shardOf(zKey)}.bin`, "index.json"].sort()), `the phone sent: ${changed}`);
  await a.evaluate(() => siteCheck(true));
  assert(await a.evaluate((k) => !!META[k], zKey), "the computer didn't get what the phone looked up");
  const patches = () => gh.calls.filter((c) => c.startsWith("PATCH")).length;
  let p0 = patches();
  await a.evaluate(() => sitePublish()); await b.evaluate(() => sitePublish());
  assert(patches() === p0, "a device sent something the site already had");

  // Two devices with different copies of one film's details settle on the newer one, instead of overwriting each other
  await a.evaluate(() => { META["q|1999"] = cleanMeta({ src: "tmdb", v: 9, id: 5, d: ["Older"], c: [], w: [], p: [], m: [], g: ["Drama"], k: ["USA"], l: "English", r: 90, t: "2026-01-01T00:00:00.000Z" }); return sitePublish(); });
  await b.evaluate(() => { META["q|1999"] = cleanMeta({ src: "tmdb", v: 9, id: 5, d: ["Newer"], c: [], w: [], p: [], m: [], g: ["Drama"], k: ["USA"], l: "English", r: 90, t: "2026-02-01T00:00:00.000Z" }); });
  await b.evaluate(() => siteCheck(true)); await b.evaluate(() => sitePublish());
  await a.evaluate(() => siteCheck(true));
  p0 = patches();
  await a.evaluate(() => sitePublish()); await b.evaluate(() => sitePublish());
  const q = [await a.evaluate(() => META["q|1999"].d[0]), await b.evaluate(() => META["q|1999"].d[0]), (await openAll(gh, key)).meta["q|1999"].d[0]];
  assert(q.join() === "Newer,Newer,Newer" && patches() === p0, `copies of one film: ${q}, ${patches() - p0} more updates`);

  // A newer export imported on the computer goes up by itself (only the export), and the phone gets it.
  const beforeImport = { ...gh.files() };
  const zip = new JSZip();
  zip.file("profile.csv", "Date Joined,Username,Email Address\n2020-01-01,tester,someone@example.com\n");
  zip.file("watched.csv", "Date,Name,Year,Letterboxd URI\n2024-01-01,Heat,1995,x\n2026-10-01,Le Samouraï,1967,y\n");
  zip.file("diary.csv", "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2024-02-03,Heat,1995,x,4.5,,,2024-02-03\n2026-10-02,Le Samouraï,1967,y,5,,,2026-10-01\n");
  await a.setInputFiles("#file-input", [{ name: "export.zip", mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) }]);
  { const t0 = Date.now(); while (gh.files()["docs/diary/rows.bin"] === beforeImport["docs/diary/rows.bin"] && Date.now() - t0 < 12000) await a.waitForTimeout(250); }
  await settled(a, "the computer to finish");
  const sent = Object.keys(gh.files()).filter((f) => gh.files()[f] !== beforeImport[f]).map((f) => f.slice(11)).sort();
  assert(JSON.stringify(sent) === JSON.stringify(["index.json", "rows.bin"]), `the import sent: ${sent}`);
  assert((await openPart(key, gh.file("docs/diary/rows.bin"), `rows|${JSON.parse(gh.file("docs/diary/index.json")).parts.rows}`)).watched.length === 2, "the new import on the site is wrong");
  const snapshot = Object.fromEntries(diaryFiles(gh).map((f) => [`docs/diary/${f}`, gh.file(`docs/diary/${f}`)])); // for the rollback test below
  await b.evaluate(() => siteCheck(true));
  assert(await b.evaluate(() => MY_LIB.films.map((f) => f.name).sort().join()) === "Heat,Le Samouraï", "the phone didn't get the newer import");

  // The computer finds the new film's details; the phone, opened again, takes them from the site before looking
  // anything up, so it asks TMDB for nothing
  const samKey = await a.evaluate(() => MY_LIB.films.find((f) => f.name.startsWith("Le Sam")).key);
  await a.evaluate((k) => { META[k] = cleanMeta({ src: "tmdb", v: 9, id: 5511, d: ["Jean-Pierre Melville"], c: ["Alain Delon"], w: [], p: [], m: [], g: ["Crime"], k: ["France"], l: "French", r: 105, t: new Date().toISOString() }); saveMeta(); return sitePublish(); }, samKey);
  tmdbCalls = 0;
  await b.reload();
  await b.waitForFunction((k) => typeof state === "object" && MY_LIB && META[k], samKey, { timeout: 8000 });
  await b.waitForTimeout(500);
  assert(tmdbCalls === 0, `the phone asked TMDB for ${tmdbCalls} films another device had already found`);

  // Another device updates the site at the moment the computer does: the computer's first try loses, it brings
  // that change in, and the second try carries both.
  await a.evaluate(() => { META["x|2001"] = cleanMeta({ src: "tmdb", v: 9, id: 1, d: ["A"], c: [], w: [], p: [], m: [], g: ["Drama"], k: ["France"], l: "French", r: 90 }); });
  gh.beforePatch = async () => {
    const ix = JSON.parse(gh.file("docs/diary/index.json")), part = shardOf("y|2002"), m = await openPart(key, gh.file(`docs/diary/${part}.bin`), `${part}|${ix.parts[part]}`), at = new Date().toISOString();
    m["y|2002"] = film(2, "B");
    gh.write({ [`docs/diary/${part}.bin`]: await sealPart(key, m, `${part}|${at}`), "docs/diary/index.json": Buffer.from(JSON.stringify(await signed(key, { ...ix, n: ix.n + 1, at, parts: { ...ix.parts, [part]: at } }))) });
  };
  p0 = patches();
  await a.evaluate(() => sitePublish());
  assert(patches() - p0 === 2, `expected a lost race and a retry: ${patches() - p0}`);
  const merged = (await openAll(gh, key)).meta;
  assert(merged["x|2001"] && merged["y|2002"] && merged["heat|1995"], `merged details: ${Object.keys(merged)}`);
  assert(await a.evaluate(() => !!META["y|2002"]), "the computer didn't take in the other device's change");

  // Tampering: whoever changes the site without the password can't get a device to take it in, and the next update
  // from a device puts the real diary back
  await b.evaluate(() => siteCheck(true));
  const good = Object.fromEntries(diaryFiles(gh).map((f) => [`docs/diary/${f}`, gh.file(`docs/diary/${f}`)]));
  const phoneState = async () => b.evaluate(() => JSON.stringify([MY_LIB.films.length, Object.keys(META).length, SITE && SITE.n]));
  const before2 = await phoneState();
  const refuses = async (what) => {
    await b.evaluate(() => { site.note = ""; site.err = false; return siteCheck(true); });
    const r = await b.evaluate(() => [site.err, site.note]);
    assert(r[0] && /doesn't check out/.test(r[1]) && await phoneState() === before2, `${what}: ${JSON.stringify(r)}`);
  };
  // an index changed without the password (another part listed as newer)
  { const ix = JSON.parse(good["docs/diary/index.json"]); gh.write({ "docs/diary/index.json": Buffer.from(JSON.stringify({ ...ix, n: ix.n + 5, at: new Date().toISOString(), parts: { ...ix.parts, rows: new Date().toISOString() } })) }); }
  await refuses("an index changed without the password");
  // an older copy put back whole (signed, but counting fewer updates than the phone has seen)
  gh.write(snapshot);
  await refuses("an older copy put back");
  // one part swapped for another (both genuine, and the index genuine and newest)
  gh.write(good);
  { const ix = JSON.parse(good["docs/diary/index.json"]), at = new Date().toISOString(), m1 = good["docs/diary/m1.bin"];
    gh.write({ "docs/diary/m2.bin": m1, "docs/diary/index.json": Buffer.from(JSON.stringify(await signed(await keyFor(PASS, ix.salt), { ...ix, n: ix.n + 1, at, parts: { ...ix.parts, m2: ix.parts.m1 } }))) }); }
  await refuses("a part swapped for another");
  // the computer's next update puts the real diary back, and the phone takes it
  await a.evaluate(() => sitePublish());
  await b.evaluate(() => { site.note = ""; site.err = false; return siteCheck(true); });
  assert(!(await b.evaluate(() => site.err)) && (await openAll(gh, key)).meta["y|2002"], "the computer didn't put the real diary back");

  // A new password, set on the phone this time: the computer asks for it once, then carries on.
  await b.evaluate(() => push({ type: "data", title: "Settings", ret: 0 }));
  await b.waitForSelector('[data-sitebox="publish"] [data-site="password"]', { state: "attached" });
  await b.evaluate(() => { for (const d of document.querySelectorAll('[data-sitebox="publish"] details')) d.open = true; });
  await typeIn(b, '[data-sitebox="publish"] input[name="newpass"]', PASS2);
  // a redraw between typing and pressing the button (a background update finishing, a note appearing) keeps what was
  // typed: on GitHub's slower machines one landed there now and then, and the new password went missing (Oct 2026)
  await b.evaluate(() => { site.note = "Something else happened."; site.noteIn = "publish"; render(); siteRedraw(); site.note = ""; render(); siteRedraw(); });
  await b.evaluate(() => { window.__salt0 = JSON.parse(localStorage.getItem("cr-site-v1") || "{}").salt; });
  await b.click('[data-sitebox="publish"] [data-site="password"]');
  // locking it afresh takes a while; then it either says so or says why not
  await until(b, () => !site.job && !site.busy && (/Password changed/.test(site.note) || site.err || JSON.parse(localStorage.getItem("cr-site-v1") || "{}").salt !== window.__salt0), "the password change", undefined, 20000);
  const pw = await b.evaluate(() => ({ note: site.note, err: site.err }));
  assert(!pw.err, `the password change failed: ${pw.note}`);
  const idx2 = JSON.parse(gh.file("docs/diary/index.json"));
  assert(idx2.salt !== idx.salt, "the password change didn't lock it afresh");
  key = await keyFor(PASS2, idx2.salt);
  assert((await openAll(gh, key)).keys.github === TOKEN, "the new lock lost the keys");
  await a.evaluate(() => siteCheck(true));
  await a.waitForSelector('#site-open input[name="pass"]');
  assert(/new password/.test(await a.innerText("#site-open")), "the computer didn't say the password changed");
  await typeIn(a, '#site-open input[name="pass"]', PASS2);
  await a.click('#site-open [data-site="unlock"]');
  await until(a, () => !site.busy && !document.querySelector('#site-open input') && META["x|2001"] && META["y|2002"], "the computer to open it with the new password");

  // A forgotten password: the computer, which has its own copy, can't open the diary on the site any more, so it
  // replaces it under a new password, shown to be the owner by a GitHub key. A short password and a key GitHub
  // refuses change nothing (what was typed stays, and the key that worked is kept). The phone then asks for the new
  // password, and keeps what it has.
  await a.evaluate(() => { SITE = null; saveSite(); return siteCheck(true); });
  await a.waitForSelector('#site-open [data-site="restart"]', { state: "attached" });
  const ixText = gh.file("docs/diary/index.json").toString();
  await a.evaluate(() => { for (const d of document.querySelectorAll("#site-open details")) d.open = true; });
  const form = () => a.evaluate(() => ({ text: document.querySelector("#site-open").innerText, open: document.querySelector("#site-open details").open,
    typed: document.querySelector('#site-open input[name="newpass"]').value, pub: SITEPUB && SITEPUB.token }));
  await typeIn(a, '#site-open input[name="newpass"]', "short");
  await a.click('#site-open [data-site="restart"]');
  let f = await form();
  assert(/at least 10/.test(f.text) && f.open && f.typed === "short", `a short new password: ${JSON.stringify(f)}`);
  await typeIn(a, '#site-open input[name="newpass"]', PASS3);
  await typeIn(a, '#site-open input[name="token"]', "not a real key");
  await a.click('#site-open [data-site="restart"]');
  await until(a, () => !site.job && site.err, "a wrong key to be refused");
  f = await form();
  assert(/didn't accept the key/.test(f.text) && f.open && f.typed === PASS3 && f.pub === TOKEN && gh.file("docs/diary/index.json").toString() === ixText, `a wrong key: ${JSON.stringify(f)}`);
  await typeIn(a, '#site-open input[name="token"]', TOKEN);
  await a.click('#site-open [data-site="restart"]');
  await until(a, () => !site.job && !site.busy && /locked with your new password/.test(site.note), "starting over");
  const idx3 = JSON.parse(gh.file("docs/diary/index.json")), ixBefore = JSON.parse(ixText);
  assert(idx3.salt !== ixBefore.salt && idx3.n > ixBefore.n && idx3.sig, `the new copy's index: ${JSON.stringify({ n: idx3.n, was: ixBefore.n })}`);
  key = await keyFor(PASS3, idx3.salt);
  up = await openAll(gh, key);
  assert(up.rows.profile[0].Username === "tester" && !JSON.stringify(up).includes("someone@example.com") && up.keys.github === TOKEN && up.meta["x|2001"], "the new copy lost something, or carries the email");
  assert(/Your diary is on the site again/.test(await a.innerText("#site-open")) && !(await a.$('#site-open input')), "the computer didn't say it was done");
  await b.evaluate(() => siteCheck(true));
  await b.waitForSelector('[data-sitebox="publish"] [data-site="restart"]', { state: "attached" }); // the phone's Settings offers it too
  await typeIn(b, '[data-sitebox="publish"] input[name="pass"]', PASS3);
  await b.click('[data-sitebox="publish"] [data-site="unlock"]');
  await until(b, () => !site.busy && SITE && site.index && SITE.salt === site.index.salt && META["x|2001"] && META["y|2002"] && MY_LIB.films.length === 2, "the phone to open it with the new password");

  // Someone else's export imported on a device that has the diary: it never goes up in place of the diary, the
  // site's diary doesn't replace it, and Settings says so. Importing the right export again puts the device back in step.
  {
    const before = gh.file("docs/diary/index.json").toString(), commits = gh.authors.length;
    const other = { ...rows, profile: [{ Username: "someone_else", "Date Joined": "2021-01-01" }], watched: [{ Name: "Alien", Year: "1979", Date: "2024-01-01" }],
      diary: [{ Name: "Alien", Year: "1979", Date: "2024-03-03", "Watched Date": "2024-03-03", Rating: "4" }], ratings: [] };
    const mineRows = await b.evaluate(() => store.get(KEYS.rows, null));
    await b.evaluate((r) => { store.set(KEYS.rows, { ...r, importedAt: new Date().toISOString() }); MY_LIB = myLibrary(); DATA_REV++; render(); }, other);
    await b.waitForTimeout(5500);
    await b.evaluate(() => { site.checked = 0; return siteCheck(true); });
    const now = await b.evaluate(() => ({ user: MY_LIB.profile.username, dirty: localStorage.getItem("cr-site-dirty"), box: document.querySelector('[data-sitebox="publish"]').textContent }));
    assert(gh.file("docs/diary/index.json").toString() === before && gh.authors.length === commits, "another account's export went up in place of the diary");
    assert(now.user === "someone_else" && !now.dirty && /leaves @tester's diary on the site alone/.test(now.box), `the other account's diary on the phone: ${JSON.stringify(now).slice(0, 300)}`);
    await b.evaluate((r) => { store.set(KEYS.rows, r); MY_LIB = myLibrary(); DATA_REV++; render(); }, mineRows);
    await until(b, () => MY_LIB.profile.username === "tester" && !site.job, "the phone to have its own diary again");
  }

  // Sharing the TMDB key with visitors, from the computer's Settings: share.json beside the pages holds the TMDB key and
  // nothing else; a visitor who imports their own export gets cast & crew looked up with it, without saving it; when
  // sharing stops, the file goes and the visitor no longer has a key.
  {
    if (await a.evaluate(() => state.page) !== "settings") await a.click("#btn-settings");
    await a.evaluate(() => siteRedraw());
    await a.waitForSelector('#site-box [data-site="share-on"]');
    assert(/becomes public/.test(await a.innerText("#site-box")), "the computer didn't say the shared key becomes public");
    await a.click('#site-box [data-site="share-on"]');
    await until(a, () => share.on === true && !share.busy, "sharing to start");
    const shared = JSON.parse(gh.file("docs/share.json"));
    assert(shared.tmdb === "k999" && Object.keys(shared).sort().join() === "at,tmdb", `what was shared: ${JSON.stringify(shared)}`);
    const v = await device(browser, base, gh, null, { example: false });
    await v.context().route(/\/share\.json/, (r) => { const b = gh.file("docs/share.json"); return b ? r.fulfill({ contentType: "application/json", body: b }) : r.fulfill({ status: 404, body: "not found" }); });
    const asked = [];
    await v.context().route(/api\.themoviedb\.org/, (r) => { asked.push(r.request().url()); r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ results: [] }) }); });
    await v.goto(base + "desktop.html"); await v.waitForFunction(() => typeof state === "object");
    await seed(v, { profile: [{ Username: "a_visitor" }], watched: [{ Name: "Brick", Year: "2005", Date: "2024-01-01" }], diary: [{ Name: "Brick", Year: "2005", Date: "2024-01-02", "Watched Date": "2024-01-02", Rating: "4" }] });
    { const t0 = Date.now(); while (!asked.length && Date.now() - t0 < 10000) await v.waitForTimeout(200); }
    assert(asked.some((u) => /[?&]api_key=k999\b/.test(u)), `the visitor didn't look films up with the shared key: ${asked.slice(0, 2)}`);
    assert(!(await v.evaluate(() => localStorage.getItem("cr-tmdb-key") || store.get(KEYS.tmdb, ""))), "the visitor saved the shared key");
    assert(gh.file("docs/diary/index.json") && JSON.parse(gh.file("docs/diary/index.json")).user === "tester", "the visitor touched the diary on the site");
    await a.click('#site-box [data-site="share-off"]');
    await until(a, () => share.on === false && !share.busy, "sharing to stop");
    assert(!gh.file("docs/share.json"), "share.json is still on the site");
    await v.reload(); await v.waitForFunction(() => typeof state === "object" && state.lib); await v.waitForTimeout(300);
    assert(await v.evaluate(() => tmdbKey()) === "", "the visitor still has a key after sharing stopped");
    noErrors(v, "visitor");
    await v.context().close();
  }

  // Letting visitors compare with you: taste.json beside the pages holds the films with ratings and likes, and the
  // username, nothing else (no dates, reviews, email or keys); a visitor with their own export compares in one tap; the
  // owner's newer import updates it; when it stops, the file goes.
  {
    await a.evaluate(() => siteRedraw());
    await a.waitForSelector('#site-box [data-site="taste-on"]');
    assert(/for anyone to read/.test(await a.innerText("#site-box")), "the computer didn't say the ratings become public");
    await a.click('#site-box [data-site="taste-on"]');
    await until(a, () => taste.on === true && !taste.busy, "the ratings to go up");
    const card = JSON.parse(gh.file("docs/taste.json"));
    const text = gh.file("docs/taste.json").toString();
    assert(card.user === "tester" && Object.keys(card).sort().join() === "at,films,from,user,v" && card.films.every((x) => x.length === 4)
      && !/@|Date|Review|k123|om456|k999/.test(text) && !text.includes(TOKEN), `what went up for visitors: ${text.slice(0, 300)}`);
    const v = await device(browser, base, gh, null, { example: false, phone: true });
    await v.context().route(/\/taste\.json/, (r) => { const b = gh.file("docs/taste.json"); return b ? r.fulfill({ contentType: "application/json", body: b }) : r.fulfill({ status: 404, body: "not found" }); });
    await v.goto(base + "mobile.html"); await v.waitForFunction(() => typeof state === "object");
    await seed(v, { profile: [{ Username: "a_visitor" }], watched: [{ Name: "Heat", Year: "1995", Date: "2024-01-01" }], ratings: [{ Name: "Heat", Year: "1995", Rating: "4" }] });
    await v.waitForFunction(() => TASTE);
    await v.evaluate(() => goTo("compare", { force: true, top: true }));
    await v.click("[data-compare-owner]");
    const got = await v.evaluate(() => ({ friends: FRIENDS.map((f) => f.id + ":" + f.name + ":" + f.lib.films.length), shown: document.querySelector("#screen").textContent.includes("tester"), offer: !!document.querySelector("[data-compare-owner]") }));
    assert(got.friends.length === 1 && /^site:tester:\d+$/.test(got.friends[0]) && got.shown && !got.offer, `comparing with the owner: ${JSON.stringify(got)}`);
    noErrors(v, "visitor comparing");
    await v.context().close();
    await a.click('#site-box [data-site="taste-off"]');
    await until(a, () => taste.on === false && !taste.busy, "the ratings to come off");
    assert(!gh.file("docs/taste.json"), "taste.json is still on the site");
  }

  // Counting visits: visits.json beside the pages holds the GoatCounter code and nothing else; a visitor's page sends
  // one count to that GoatCounter as a picture request; the owner's own devices send none; the small print says so;
  // when it stops, the file goes.
  {
    await a.evaluate(() => siteRedraw());
    await a.waitForSelector('#site-box [data-site="visits-on"]');
    await typeIn(a, '#site-box [name="visitcode"]', "https://Bogie-Test.goatcounter.com/");
    await a.click('#site-box [data-site="visits-on"]');
    await until(a, () => visits.on === true && !visits.busy, "counting to start");
    const file = JSON.parse(gh.file("docs/visits.json"));
    assert(file.goatcounter === "bogie-test" && Object.keys(file).sort().join() === "at,goatcounter", `what went up for counting: ${JSON.stringify(file)}`);
    assert(/bogie-test\.goatcounter\.com/.test(await a.innerText("#site-box")), "the owner's box doesn't link to their counts");
    const counted = [];
    for (const [who, phone] of [["visitor", false], ["visitor", true]]) {
      const v = await device(browser, base, gh, null, { example: false, phone });
      await v.context().route(/\/visits\.json/, (r) => { const b = gh.file("docs/visits.json"); return b ? r.fulfill({ contentType: "application/json", body: b }) : r.fulfill({ status: 404, body: "not found" }); });
      await v.context().route(/goatcounter\.com/, (r) => { counted.push(r.request().url()); r.fulfill({ contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") }); });
      await v.goto(base + (phone ? "mobile.html" : "desktop.html")); await v.waitForFunction(() => typeof state === "object");
      await seed(v, { profile: [{ Username: "a_visitor" }], watched: [{ Name: "Heat", Year: "1995", Date: "2024-01-01" }] });
      const n0 = counted.length;
      await v.waitForFunction(() => VISIT_CODE, null, { timeout: 8000 });
      { const t0 = Date.now(); while (counted.length === n0 && Date.now() - t0 < 8000) await v.waitForTimeout(200); }
      if (phone) await v.evaluate(() => push({ type: "data", title: "Settings" })); else await v.click("#btn-settings");
      await v.waitForTimeout(300);
      const note = await v.evaluate(() => [...document.querySelectorAll("p")].some((x) => /counted with GoatCounter/.test(x.textContent) && !x.closest("[hidden]")));
      assert(note, `${who} on the ${phone ? "phone" : "computer"}: the small print doesn't say visits are counted`);
      noErrors(v, `${who} counted`);
      await v.context().close();
    }
    assert(counted.length >= 2 && counted.every((u) => /^https:\/\/bogie-test\.goatcounter\.com\/count\?p=%2F/.test(u)), `the visitors' counts: ${counted.slice(0, 3)}`);
    // the owner's own device: no count
    const before = counted.length;
    await a.context().route(/goatcounter\.com/, (r) => { counted.push(r.request().url()); r.fulfill({ contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") }); });
    await a.context().route(/\/visits\.json/, (r) => { const b = gh.file("docs/visits.json"); return b ? r.fulfill({ contentType: "application/json", body: b }) : r.fulfill({ status: 404, body: "not found" }); });
    await a.evaluate(() => countVisit()); await a.waitForTimeout(500);
    assert(counted.length === before && await a.evaluate(() => VISIT_CODE) === "bogie-test", "the owner's own device was counted");
    // "Send a test visit": from the owner's own device, saying whether it got through
    await a.click('#site-box [data-site="visits-test"]');
    await until(a, () => !visits.busy && /reached GoatCounter/.test(visits.note), "a test visit to get through");
    assert(counted.some((u) => /p=%2Ftest-visit/.test(u)), "the test visit wasn't sent");
    await a.context().unroute(/goatcounter\.com/); await a.context().route(/goatcounter\.com/, (r) => r.abort("blockedbyclient"));
    await a.click('#site-box [data-site="visits-test"]');
    await until(a, () => !visits.busy && /stopped it/.test(visits.note), "a blocked test visit to be told");
    await a.click('#site-box [data-site="visits-off"]');
    await until(a, () => visits.on === false && !visits.busy, "counting to stop");
    assert(!gh.file("docs/visits.json"), "visits.json is still on the site");
  }

  // Taking it off the site: the files go, each device keeps its copy, and no device puts it back by itself.
  await a.click('#site-box [data-site="remove"]');
  await a.click('#site-box [data-site="remove"]');
  await until(a, () => !site.busy && site.index === null, "taking it off");
  assert(!diaryFiles(gh).length, `still on the site: ${diaryFiles(gh)}`);
  await b.evaluate(() => siteCheck(true));
  assert(await b.evaluate(() => MY_LIB.films.length === 2 && !SITE), "the phone lost its copy, or would still send");
  const calls = gh.calls.length;
  for (const p of [a, b]) await p.evaluate(() => { META["w|2004"] = META["x|2001"]; saveMeta(); store.set(KEYS.omdb, "om789"); });
  await a.waitForTimeout(5000);
  assert(gh.calls.length === calls && !diaryFiles(gh).length && /Put your diary on this site/.test(await a.innerText("#site-box")), "something went up after it was taken off");

  // A key GitHub doesn't accept isn't kept, and nothing goes up.
  const g2 = fakeGitHub({ token: "the real one" });
  const c = await device(browser, base, g2, "mobile.html", { phone: true });
  await seed(c, rows);
  await c.evaluate(() => push({ type: "data", title: "Settings", ret: 0 }));
  // (a device without the site's GitHub key may not be the owner's, so this is folded away)
  await c.waitForSelector('[data-sitebox="publish"] details.owner-open > summary');
  await c.click('[data-sitebox="publish"] details.owner-open > summary');
  await typeIn(c, '[data-sitebox="publish"] input[name="newpass"]', PASS);
  await typeIn(c, '[data-sitebox="publish"] input[name="repo"]', REPO);
  await typeIn(c, '[data-sitebox="publish"] input[name="token"]', "wrong");
  await c.click('[data-sitebox="publish"] [data-site="create"]');
  await until(c, () => !site.job && site.err, "the refusal");
  const r = await c.evaluate(() => ({ pub: SITEPUB, stored: localStorage.getItem("cr-site-pub-v1"), note: site.note }));
  assert(!r.pub && !r.stored && /didn't accept the key/.test(r.note) && !Object.keys(g2.files()).some((f) => f.startsWith("docs/diary/")), `wrong key: ${JSON.stringify(r)}`);

  // every change the app made is signed with GitHub's no-reply address, never the owner's email
  assert(gh.authors.length && gh.authors.every((x) => x === "sjnift@users.noreply.github.com sjnift@users.noreply.github.com"), `commits signed as: ${[...new Set(gh.authors)]}`);
  noErrors(a, "computer"); noErrors(b, "phone"); noErrors(c, "phone with a wrong key");
  for (const p of [a, b, c]) await p.context().close();
}
