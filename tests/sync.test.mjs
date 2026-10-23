// Sync across devices through a private GitHub repository, against a stand-in GitHub that keeps real git
// blob names: a computer connects and sends its diary, a phone opened from the sync link gets it, an import on
// the phone reaches the computer, changes made on two devices at once are merged, and a public repository,
// a wrong key and stopping sync all behave.
import { createHash } from "node:crypto";
import { open, seed, assert, noErrors, until, JSZip } from "./lib.mjs";

const REPO = "sjnift/credits-roll-data", TOKEN = "github_pat_test";
const rows = { profile: [{ Username: "tester" }], watched: [{ Name: "Heat", Year: "1995", Date: "2024-01-01" }],
  diary: [{ Name: "Heat", Year: "1995", Date: "2024-02-03", "Watched Date": "2024-02-03", Rating: "4.5" }], ratings: [{ Name: "Heat", Year: "1995", Rating: "4.5" }] };
const meta = { "heat|1995": { src: "tmdb", v: 6, id: 949, d: ["Michael Mann"], c: ["Al Pacino"], w: [], p: [], m: [], g: ["Crime"], k: ["USA"], l: "English", r: 170 } };
const film = (id, name) => ({ src: "tmdb", v: 6, id, d: ["Someone"], c: [], w: [], p: [], m: [], g: ["Drama"], k: ["France"], l: "French", r: 100, name });

function fakeGitHub({ repo = REPO, token = TOKEN, isPrivate = true } = {}) {
  const objs = new Map(), sha1 = (x) => createHash("sha1").update(x).digest("hex");
  const gh = { ref: null, calls: [], pushes: 0, beforePatch: null };
  const blob = (buf) => { const sha = sha1(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])); objs.set(sha, buf); return sha; };
  const tree = (base, entries) => {
    const map = new Map(base ? objs.get(base).map((e) => [e.path, e]) : []);
    for (const e of entries) map.set(e.path, { path: e.path, mode: "100644", type: "blob", sha: e.sha });
    const list = [...map.values()].sort((a, b) => (a.path < b.path ? -1 : 1)), sha = sha1("tree " + JSON.stringify(list));
    objs.set(sha, list); return sha;
  };
  const commit = (t, parents, message) => { const sha = sha1(`commit ${t} ${parents} ${message} ${Math.random()}`); objs.set(sha, { tree: t, parents, message }); return sha; };
  gh.files = () => (gh.ref ? Object.fromEntries(objs.get(objs.get(gh.ref).tree).map((e) => [e.path, objs.get(e.sha).toString("utf8")])) : {});
  gh.json = (name) => JSON.parse(gh.files()[name]);
  // another device's commit, made straight in the repository
  gh.write = (files) => { const t = tree(objs.get(gh.ref).tree, Object.entries(files).map(([path, text]) => ({ path, sha: blob(Buffer.from(text)) }))); gh.ref = commit(t, [gh.ref], "elsewhere"); };
  gh.handler = async (route) => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization, Content-Type, Accept", "access-control-allow-methods": "GET, POST, PATCH, PUT, OPTIONS" };
    const reply = (status, body) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body || {}) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const m = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
    if (!m || m[1] !== repo) return reply(404, { message: "Not Found" });
    if (req.headers().authorization !== `Bearer ${token}`) return reply(401, { message: "Bad credentials" });
    const p = m[2] || "", body = req.postData() ? JSON.parse(req.postData()) : null;
    gh.calls.push(`${method} ${p}`);
    let x;
    if (method === "GET" && p === "") return reply(200, { full_name: repo, private: isPrivate, default_branch: "main" });
    if (method === "GET" && p === "/git/ref/heads/main") return gh.ref ? reply(200, { object: { sha: gh.ref, type: "commit" } }) : reply(409, { message: "Git Repository is empty." });
    if (method === "PUT" && (x = p.match(/^\/contents\/(.+)$/))) {
      const t = tree(gh.ref ? objs.get(gh.ref).tree : null, [{ path: x[1], sha: blob(Buffer.from(body.content, "base64")) }]);
      gh.ref = commit(t, gh.ref ? [gh.ref] : [], body.message); return reply(201, { commit: { sha: gh.ref } });
    }
    if (method === "GET" && (x = p.match(/^\/git\/commits\/(\w+)$/))) { const c = objs.get(x[1]); return reply(200, { sha: x[1], tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })) }); }
    if (method === "GET" && (x = p.match(/^\/git\/trees\/(\w+)$/))) return reply(200, { sha: x[1], tree: objs.get(x[1]) });
    if (method === "GET" && (x = p.match(/^\/git\/blobs\/(\w+)$/))) return reply(200, { sha: x[1], encoding: "base64", content: objs.get(x[1]).toString("base64").replace(/.{60}/g, "$&\n") });
    if (method === "POST" && p === "/git/blobs") return reply(201, { sha: blob(Buffer.from(body.content, "base64")) });
    if (method === "POST" && p === "/git/trees") return reply(201, { sha: tree(body.base_tree, body.tree) });
    if (method === "POST" && p === "/git/commits") return reply(201, { sha: commit(body.tree, body.parents, body.message) });
    if (method === "PATCH" && p === "/git/refs/heads/main") {
      if (gh.beforePatch) { const f = gh.beforePatch; gh.beforePatch = null; f(); }
      if (!body.force && objs.get(body.sha).parents[0] !== gh.ref) return reply(422, { message: "Update is not a fast forward" });
      gh.ref = body.sha; gh.pushes++; return reply(200, { object: { sha: gh.ref } });
    }
    return reply(404, { message: "Not Found" });
  };
  return gh;
}
const synced = (page, what) => until(page, () => SYNC && SYNC.at && !syncState.running && !syncBusy, what);

export default async function ({ browser, base }) {
  const gh = fakeGitHub();

  // A computer with a diary connects to a new, empty repository and sends everything up.
  const a = await open(browser, base, "desktop.html");
  await a.context().route(/api\.github\.com/, gh.handler);
  await seed(a, rows, { "cr-meta-v1": meta, "cr-tmdb-key": "k123" });
  await a.waitForSelector("#sync-box #sync-token");
  await a.fill("#sync-repo", REPO);
  await a.fill("#sync-token", TOKEN);
  await a.click('[data-sync="connect"]');
  await synced(a, "the computer's first sync");
  let files = gh.files();
  assert(["README.md", "rows.json", "meta.json", "photos.json", "lbx.json", "friends.json", "keys.json", "sync.json"].every((f) => f in files), `repository files: ${Object.keys(files)}`);
  assert(gh.json("rows.json").watched.length === 1 && gh.json("meta.json")["heat|1995"].d[0] === "Michael Mann" && gh.json("keys.json").tmdb === "k123", "the computer's data didn't all go up");
  assert(/Synced/.test(await a.innerText("#sync-box")), `sync box: ${await a.innerText("#sync-box")}`);

  // The link and its QR code.
  await a.click('[data-sync="link"]');
  await a.waitForSelector("#sync-box .sync-qr svg");
  const link = await a.evaluate(() => syncLink());
  assert(link.startsWith(base) && /#sync=[\w-]+$/.test(link), `sync link: ${link}`);

  // A phone opened from the link (through the front page) links itself and gets the diary, details and key.
  const b = await open(browser, base, null, { phone: true });
  await b.context().route(/api\.github\.com/, gh.handler);
  await b.goto(link);
  await until(b, () => typeof MY_LIB !== "undefined" && MY_LIB && MY_LIB.films.length === 1 && SYNC && SYNC.at && !syncBusy, "the phone to get the diary");
  const got = await b.evaluate(() => ({ url: location.href, dir: META["heat|1995"] && META["heat|1995"].d[0], key: store.get(KEYS.tmdb, ""), welcome: !!document.querySelector("[data-syncbox=welcome]"), mode: state.mode }));
  assert(/mobile\.html/.test(got.url) && !/sync=/.test(got.url), `the key stayed in the address: ${got.url}`);
  assert(got.dir === "Michael Mann" && got.key === "k123" && !got.welcome && got.mode === "mine", `phone after linking: ${JSON.stringify(got)}`);

  // A newer export imported on the phone goes up by itself within seconds, and the computer brings it in.
  const z = new JSZip();
  z.file("profile.csv", "Date Joined,Username\n2020-01-01,tester\n");
  z.file("watched.csv", "Date,Name,Year,Letterboxd URI\n2024-01-01,Heat,1995,x\n2026-10-01,Le Samouraï,1967,y\n");
  z.file("diary.csv", "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2024-02-03,Heat,1995,x,4.5,,,2024-02-03\n2026-10-02,Le Samouraï,1967,y,5,,,2026-10-01\n");
  await b.setInputFiles("#file-input", [{ name: "export.zip", mimeType: "application/zip", buffer: await z.generateAsync({ type: "nodebuffer" }) }]);
  await b.waitForFunction(() => MY_LIB.films.length === 2);
  const t0 = Date.now();
  while (gh.json("rows.json").watched.length !== 2 && Date.now() - t0 < 10000) await b.waitForTimeout(200);
  assert(gh.json("rows.json").watched.length === 2, "the phone's import didn't go up");
  const pushesBefore = gh.pushes;
  await a.evaluate(() => syncNow());
  const films = await a.evaluate(() => MY_LIB.films.map((f) => f.name).sort().join());
  assert(films === "Heat,Le Samouraï", `computer after pulling: ${films}`);
  assert(gh.pushes === pushesBefore, "bringing changes in sent something back");

  // Only what changed is sent: one film's details changing uploads that file and the sync note, nothing else.
  await b.evaluate(() => syncBusy);
  await a.evaluate(() => { META["x|2001"] = cleanMeta({ src: "tmdb", v: 6, id: 1, d: ["A"], c: [], w: [], p: [], m: [], g: ["Drama"], k: ["France"], l: "French", r: 90 }); saveMeta(); });
  gh.calls.length = 0;
  // ...while the phone, at the same moment, saves another film: the computer's first push loses the race
  gh.beforePatch = () => { const m = gh.json("meta.json"); m["y|2002"] = film(2, "y"); gh.write({ "meta.json": JSON.stringify(m) }); };
  await a.evaluate(() => syncNow());
  const blobs = gh.calls.filter((c) => c === "POST /git/blobs").length, patches = gh.calls.filter((c) => c.startsWith("PATCH")).length;
  assert(patches === 2, `expected a lost race then a retry, saw ${patches} ref updates`);
  assert(blobs === 4, `expected meta.json and sync.json twice, saw ${blobs} uploads`);
  const merged = gh.json("meta.json");
  assert(merged["x|2001"] && merged["y|2002"] && merged["heat|1995"], `merged details: ${Object.keys(merged)}`);
  assert(await a.evaluate(() => !!META["y|2002"] && !localStorage.getItem("cr-sync-dirty")), "the computer didn't take in the phone's film, or still has changes waiting");
  await b.evaluate(() => syncNow());
  assert(await b.evaluate(() => !!META["x|2001"] && !!META["y|2002"]), "the phone didn't get both films' details");

  // Stopping sync keeps the diary here.
  await a.click('[data-sync="disconnect"]');
  const off = await a.evaluate(() => ({ sync: SYNC, stored: localStorage.getItem("cr-sync-v1"), films: MY_LIB.films.length, box: document.querySelector("#sync-box").innerText }));
  assert(!off.sync && !off.stored && off.films === 2 && /no longer syncs/.test(off.box), `after stopping: ${JSON.stringify(off)}`);

  // A public repository and a wrong key are refused, and nothing is kept.
  for (const [g, token, says] of [[fakeGitHub({ repo: "sjnift/open", isPrivate: false }), TOKEN, /public/], [fakeGitHub({ repo: "sjnift/open" }), "wrong", /didn't accept the key/]]) {
    const c = await open(browser, base, "mobile.html", { phone: true, example: false });
    await c.context().route(/api\.github\.com/, g.handler);
    await c.fill("#sync-repo", "sjnift/open");
    await c.fill("#sync-token", token);
    await c.click('[data-sync="connect"]');
    await until(c, () => !syncState.running && syncState.note, "the refusal");
    const r = await c.evaluate(() => ({ sync: SYNC, note: syncState.note, err: syncState.err }));
    assert(!r.sync && r.err && says.test(r.note) && !g.ref, `refusal: ${JSON.stringify(r)}`);
    noErrors(c, "refused phone");
    await c.context().close();
  }
  noErrors(a, "computer"); noErrors(b, "phone");
  await a.context().close(); await b.context().close();
}
