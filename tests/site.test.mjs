// The diary on the site, locked with a password, against a stand-in GitHub (the repository) and a stand-in for
// the site itself (what Pages serves from docs/). A computer puts its diary there; what goes up is encrypted
// and carries no email address or API keys; a phone opens it with the password (a wrong one is refused) and
// keeps it after a reload; a newer import on the computer goes up by itself and reaches the phone; a change
// from another device at the same moment is merged; a new password, taking it off, and a wrong key all behave.
import { createHash, webcrypto } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { open, seed, assert, noErrors, until, JSZip } from "./lib.mjs";

const REPO = "sjnift/credits-roll", TOKEN = "github_pat_test", PASS = "popcorn and credits", PASS2 = "second reel of film";
const rows = { profile: [{ "Date Joined": "2020-01-01", Username: "tester", "Given Name": "Sam", "Email Address": "someone@example.com", Bio: "hi" }],
  watched: [{ Name: "Heat", Year: "1995", Date: "2024-01-01" }], diary: [{ Name: "Heat", Year: "1995", Date: "2024-02-03", "Watched Date": "2024-02-03", Rating: "4.5" }],
  ratings: [{ Name: "Heat", Year: "1995", Rating: "4.5" }] };
const film = (id, d) => ({ src: "tmdb", v: 6, id, d: [d], c: [], w: [], p: [], m: [], g: ["Crime"], k: ["USA"], l: "English", r: 120 });
const meta = { "heat|1995": film(949, "Michael Mann") };

// The repository as a map of path → blob sha for each tree; blobs are named the way git names them.
function fakeGitHub({ token = TOKEN } = {}) {
  const blobs = new Map(), trees = new Map(), commits = new Map(), sha1 = (x) => createHash("sha1").update(x).digest("hex");
  const gh = { calls: [], beforePatch: null };
  const blob = (buf) => { const sha = sha1(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])); blobs.set(sha, buf); return sha; };
  const tree = (files) => { const sha = sha1("tree " + JSON.stringify(Object.entries(files).sort())); trees.set(sha, files); return sha; };
  const commit = (t, parents) => { const sha = sha1(`commit ${t} ${parents} ${Math.random()}`); commits.set(sha, { tree: t, parents }); return sha; };
  gh.ref = commit(tree({ "docs/index.html": blob(Buffer.from("<!doctype html>")) }), []);
  gh.files = () => trees.get(commits.get(gh.ref).tree);
  gh.file = (path) => { const sha = gh.files()[path]; return sha && blobs.get(sha); };
  gh.write = (changes) => { const files = { ...gh.files() }; for (const [p, buf] of Object.entries(changes)) files[p] = blob(buf); gh.ref = commit(tree(files), [gh.ref]); };
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
    if (method === "POST" && p === "/git/commits") return reply(201, { sha: commit(body.tree, body.parents) });
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
async function openPart(key, buf) {
  const body = Buffer.from(await subtle.decrypt({ name: "AES-GCM", iv: buf.subarray(1, 13) }, key, buf.subarray(13)));
  return JSON.parse((buf[0] === 2 ? gunzipSync(body) : body).toString("utf8"));
}
async function sealPart(key, value) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12)), ct = Buffer.from(await subtle.encrypt({ name: "AES-GCM", iv }, key, gzipSync(Buffer.from(JSON.stringify(value)))));
  return Buffer.concat([Buffer.from([2]), Buffer.from(iv), ct]);
}
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
  const repos = await probe.evaluate(() => [["sjnift.github.io", "/credits-roll/desktop.html"], ["sjnift.github.io", "/credits-roll"], ["sjnift.github.io", "/mobile.html"], ["sjnift.github.io", "/"],
    ["127.0.0.1", "/desktop.html"]].map(([h, p]) => repoOfPage(h, p)));
  assert(JSON.stringify(repos) === JSON.stringify(["https://github.com/sjnift/credits-roll", "https://github.com/sjnift/credits-roll", "https://github.com/sjnift/sjnift.github.io",
    "https://github.com/sjnift/sjnift.github.io", null]), `repository from the address: ${repos}`);
  await probe.context().close();

  // A computer with a diary puts it on the site.
  const a = await device(browser, base, gh, "desktop.html", {});
  await seed(a, rows, { "cr-meta-v1": meta, "cr-tmdb-key": "k123" });
  await a.click("#btn-settings");
  await a.waitForSelector("#site-box #site-newpass-publish");
  await a.fill("#site-newpass-publish", "short");
  await a.click('#site-box [data-site="create"]');
  assert(/at least 10/.test(await a.innerText("#site-box")), "a short password wasn't refused");
  await a.fill("#site-newpass-publish", PASS);
  await a.fill("#site-repo-publish", REPO);
  await a.fill("#site-token-publish", TOKEN);
  await a.click('#site-box [data-site="create"]');
  await until(a, () => !site.job && site.index && SITEPUB && SITEPUB.at, "the first copy to go up");
  const idx = JSON.parse(gh.file("docs/diary/index.json"));
  assert(["rows", "meta", "extra"].every((p) => gh.file(`docs/diary/${p}.bin`)) && idx.user === "tester" && idx.parts.rows, `on the site: ${Object.keys(gh.files())}`);
  const everything = Object.values(gh.files()).map((s) => s).join() + Object.keys(gh.files()).map((f) => gh.file(f).toString("latin1")).join();
  assert(!/someone@example\.com|k123/.test(everything), "the email address or a key is readable on the site");
  let key = await keyFor(PASS, idx.salt);
  const up = { rows: await openPart(key, gh.file("docs/diary/rows.bin")), meta: await openPart(key, gh.file("docs/diary/meta.bin")), extra: await openPart(key, gh.file("docs/diary/extra.bin")) };
  assert(up.rows.watched.length === 1 && up.rows.profile[0].Username === "tester" && up.rows.profile[0]["Given Name"] === "Sam" && !("Email Address" in up.rows.profile[0]) && !("Bio" in up.rows.profile[0]), `rows on the site: ${JSON.stringify(up.rows.profile)}`);
  assert(up.meta["heat|1995"].d[0] === "Michael Mann" && !JSON.stringify(up).includes("k123"), "film details missing, or a key went up");
  assert(/On the site/.test(await a.innerText("#site-box")), `computer's box: ${await a.innerText("#site-box")}`);

  // A phone with nothing on it: the site offers the diary; a wrong password is refused, the right one opens it.
  const b = await device(browser, base, gh, "mobile.html", { phone: true, example: false });
  await b.waitForSelector('[data-sitebox="open"] input[name="pass"]');
  assert(/@tester's diary is on this site/.test(await b.innerText('[data-sitebox="open"]')), "the phone didn't offer the diary");
  await b.fill('[data-sitebox="open"] input[name="pass"]', "not the password");
  await b.click('[data-sitebox="open"] [data-site="unlock"]');
  await until(b, () => !site.busy && site.err, "the wrong password to be refused");
  assert(/doesn't open it/.test(await b.innerText('[data-sitebox="open"]')) && !(await b.evaluate(() => MY_LIB)), "a wrong password opened something");
  await b.fill('[data-sitebox="open"] input[name="pass"]', PASS);
  await b.press('[data-sitebox="open"] input[name="pass"]', "Enter");
  await until(b, () => MY_LIB && MY_LIB.films.length === 1 && !site.busy, "the phone to open the diary");
  let got = await b.evaluate(() => ({ dir: META["heat|1995"] && META["heat|1995"].d[0], key: store.get(KEYS.tmdb, ""), mode: state.mode, user: MY_LIB.profile.username, box: !!document.querySelector('[data-sitebox="open"] input') }));
  assert(got.dir === "Michael Mann" && got.key === "" && got.mode === "mine" && got.user === "tester" && !got.box, `phone after opening: ${JSON.stringify(got)}`);
  await b.reload();
  await b.waitForFunction(() => typeof state === "object" && state.lib && MY_LIB);
  assert(await b.evaluate(() => MY_LIB.films.length === 1 && !document.querySelector('[data-sitebox="open"] input')), "the phone forgot the diary or asked again after a reload");

  // A newer export imported on the computer goes up by itself (only the parts that changed), and the phone gets it.
  const before = { ...gh.files() };
  const z = new JSZip();
  z.file("profile.csv", "Date Joined,Username,Email Address\n2020-01-01,tester,someone@example.com\n");
  z.file("watched.csv", "Date,Name,Year,Letterboxd URI\n2024-01-01,Heat,1995,x\n2026-10-01,Le Samouraï,1967,y\n");
  z.file("diary.csv", "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2024-02-03,Heat,1995,x,4.5,,,2024-02-03\n2026-10-02,Le Samouraï,1967,y,5,,,2026-10-01\n");
  await a.setInputFiles("#file-input", [{ name: "export.zip", mimeType: "application/zip", buffer: await z.generateAsync({ type: "nodebuffer" }) }]);
  const t0 = Date.now();
  while (gh.files()["docs/diary/rows.bin"] === before["docs/diary/rows.bin"] && Date.now() - t0 < 12000) await a.waitForTimeout(250);
  assert(gh.files()["docs/diary/rows.bin"] !== before["docs/diary/rows.bin"], "the computer's new import didn't go up");
  assert(gh.files()["docs/diary/extra.bin"] === before["docs/diary/extra.bin"], "a part that didn't change was sent again");
  assert((await openPart(key, gh.file("docs/diary/rows.bin"))).watched.length === 2, "the new import on the site is wrong");
  await settled(a, "the computer to finish");
  await b.evaluate(() => siteCheck(true));
  assert(await b.evaluate(() => MY_LIB.films.map((f) => f.name).sort().join()) === "Heat,Le Samouraï", "the phone didn't get the newer import");

  // Another device updates the site at the moment the computer does: the computer's first try loses, it brings
  // that change in, and the second try carries both.
  await a.evaluate(() => { META["x|2001"] = cleanMeta({ src: "tmdb", v: 6, id: 1, d: ["A"], c: [], w: [], p: [], m: [], g: ["Drama"], k: ["France"], l: "French", r: 90 }); });
  gh.beforePatch = async () => {
    const ix = JSON.parse(gh.file("docs/diary/index.json")), m = await openPart(key, gh.file("docs/diary/meta.bin")), at = new Date().toISOString();
    m["y|2002"] = film(2, "B");
    gh.write({ "docs/diary/meta.bin": await sealPart(key, m), "docs/diary/index.json": Buffer.from(JSON.stringify({ ...ix, at, parts: { ...ix.parts, meta: at } })) });
  };
  gh.calls.length = 0;
  await a.evaluate(() => sitePublish());
  assert(gh.calls.filter((c) => c.startsWith("PATCH")).length === 2, `expected a lost race and a retry: ${gh.calls.filter((c) => c.startsWith("PATCH"))}`);
  const merged = await openPart(key, gh.file("docs/diary/meta.bin"));
  assert(merged["x|2001"] && merged["y|2002"] && merged["heat|1995"], `merged details: ${Object.keys(merged)}`);
  assert(await a.evaluate(() => !!META["y|2002"]), "the computer didn't take in the other device's change");

  // A new password: the phone asks for it once, then carries on.
  await a.evaluate(() => { for (const d of document.querySelectorAll("#site-box details")) d.open = true; });
  await a.fill("#site-newpass-publish", PASS2);
  await a.click('#site-box [data-site="password"]');
  await until(a, () => !site.job && /Password changed/.test(site.note), "the password change");
  assert(JSON.parse(gh.file("docs/diary/index.json")).salt !== idx.salt, "the password change didn't lock it afresh");
  await b.evaluate(() => siteCheck(true));
  await b.waitForSelector('[data-sitebox="open"] input[name="pass"]');
  assert(/new password/.test(await b.innerText('[data-sitebox="open"]')), "the phone didn't say the password changed");
  await b.fill('[data-sitebox="open"] input[name="pass"]', PASS2);
  await b.click('[data-sitebox="open"] [data-site="unlock"]');
  await until(b, () => !site.busy && !document.querySelector('[data-sitebox="open"] input') && META["x|2001"] && META["y|2002"], "the phone to open it with the new password");

  // Taking it off the site: the files go, each device keeps its copy, and nothing goes up again by itself.
  await a.click('#site-box [data-site="remove"]');
  await a.click('#site-box [data-site="remove"]');
  await until(a, () => !site.busy && site.index === null, "taking it off");
  assert(!Object.keys(gh.files()).some((f) => f.startsWith("docs/diary/")), `still on the site: ${Object.keys(gh.files())}`);
  await b.evaluate(() => siteCheck(true));
  assert(await b.evaluate(() => MY_LIB.films.length === 2), "the phone lost its copy");
  const pushes = gh.calls.length;
  await a.evaluate(() => { META["z|2003"] = META["x|2001"]; saveMeta(); });
  await a.waitForTimeout(300);
  assert(gh.calls.length === pushes && /Put your diary on this site/.test(await a.innerText("#site-box")), "something went up after it was taken off");

  // A key GitHub doesn't accept isn't kept, and nothing goes up.
  const g2 = fakeGitHub({ token: "the real one" });
  const c = await device(browser, base, g2, "mobile.html", { phone: true });
  await seed(c, rows);
  await c.evaluate(() => push({ type: "data", title: "Settings", ret: 0 }));
  await c.waitForSelector('[data-sitebox="publish"] input[name="newpass"]');
  await c.fill('[data-sitebox="publish"] input[name="newpass"]', PASS);
  await c.fill('[data-sitebox="publish"] input[name="repo"]', REPO);
  await c.fill('[data-sitebox="publish"] input[name="token"]', "wrong");
  await c.click('[data-sitebox="publish"] [data-site="create"]');
  await until(c, () => !site.job && site.err, "the refusal");
  const r = await c.evaluate(() => ({ pub: SITEPUB, stored: localStorage.getItem("cr-site-pub-v1"), note: site.note }));
  assert(!r.pub && !r.stored && /didn't accept the key/.test(r.note) && !Object.keys(g2.files()).some((f) => f.startsWith("docs/diary/")), `wrong key: ${JSON.stringify(r)}`);

  noErrors(a, "computer"); noErrors(b, "phone"); noErrors(c, "phone with a wrong key");
  for (const p of [a, b, c]) await p.context().close();
}
