// Letterboxd averages through a stand-in Apify: a big diary's first run stops at the cap, and the follow-up runs find
// the rest by address: with the year first (only titles shared by several films have one), then the plain address for
// the others. Shared titles once cost two films each in one run, which hit its cap and left films "not found" for good.
import { open, seed, assert, noErrors } from "./lib.mjs";

const special = [["8½", 1963, "8-half"], ["M*A*S*H", 1970, "mash"], ["Heat", 1995, "heat-1995"], ["Søren", 2020, "soren"], ["Not Under This Title", 2001, "something-else"],
  ["Tiny Short", 2019, "tiny-short"]];
// titles shared with another film on Letterboxd: theirs has the year in its address, the plain one is the other film's
const shared = Array.from({ length: 40 }, (_, i) => [`Remade ${i}`, 1940 + i, `remade-${i}-${1940 + i}`]);
const films = [...Array.from({ length: 1340 }, (_, i) => [`Film ${i}`, 1950 + (i % 70), `film-${i}`]), ...special, ...shared];

export default async function ({ browser, base }) {
  const p = await open(browser, base, "desktop.html");
  const bodies = [];
  const bySlug = new Map(films.map((f) => [f[2], f])); bySlug.set("heat", ["Heat", 1986, "heat"]);
  for (const [n, y] of shared) bySlug.set(n.toLowerCase().replace(/ /g, "-"), [n, y + 30, n.toLowerCase().replace(/ /g, "-")]);
  await p.context().route(/api\.apify\.com/, (r) => {
    const req = r.request(), u = new URL(req.url()), cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type" };
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    const json = (o, status = 200) => r.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname.endsWith("/runs")) { bodies.push(JSON.parse(req.postData())); return json({ data: { id: "run" + bodies.length, defaultDatasetId: "ds" + bodies.length } }); }
    if (u.pathname.includes("/actor-runs/gone")) return json({ error: { type: "record-not-found" } }, 404); // a run of the token used before
    if (u.pathname.includes("/actor-runs/")) return json({ data: { status: "SUCCEEDED" } });
    if (u.pathname.includes("/datasets/")) {
      const input = bodies[+u.pathname.match(/ds(\d+)/)[1] - 1], off = +u.searchParams.get("offset");
      const item = (f, s) => ({ recordType: "film", title: f[0], year: String(f[1]), filmSlug: s, averageRating: f[0] === "Tiny Short" ? null : 3.8, ratingsCount: 500 });
      // like the actor: films in the order asked, an address that doesn't exist costs nothing, and the run stops at its cap
      const items = input.startUrls[0].includes("/tester/films/") ? films.slice(0, input.maxResults).map((f) => item(f, f[2]))
        : input.startUrls.map((x) => x.match(/film\/([^/]+)\//)[1]).filter((s) => bySlug.has(s)).map((s) => item(bySlug.get(s), s)).slice(0, input.maxResults);
      return json(items.slice(off, off + 1000));
    }
    json({});
  });
  await seed(p, { profile: [{ Username: "tester" }], watched: films.map((f) => ({ Name: f[0], Year: String(f[1]) })), ratings: [], diary: [] }, { "cr-apify-key": "apify_api_TEST" });
  await p.click("#btn-settings"); // Letterboxd averages are under Settings → Film details
  await p.click('[data-lb="all"]');
  await p.waitForFunction(() => !lbJob.running && Object.keys(LBX).length);
  assert(bodies[0].maxResults === 1300, `first run asked for ${bodies[0].maxResults}`);
  assert(/86 films are still missing, because one run stops at 1,300/.test(await p.evaluate(() => lbJob.note)), `note: ${await p.evaluate(() => lbJob.note)}`);
  await p.click('[data-lb="missing"]');
  await p.waitForFunction(() => !lbJob.running && !store.get(KEYS.lbRun, null));
  assert(bodies.length === 3, `the missing films took ${bodies.length - 1} runs, not 2 (with the year, then without)`);
  const urls = (b) => b.startUrls.map((u) => u.replace("https://letterboxd.com/film/", ""));
  for (const s of ["8-half-1963/", "heat-1995/", "remade-7-1947/"]) assert(urls(bodies[1]).includes(s), `the run with years didn't ask for ${s}`);
  for (const s of ["8-half/", "mash/", "soren/", "film-1320/"]) assert(urls(bodies[2]).includes(s), `the plain run didn't ask for ${s}`);
  assert(!urls(bodies[2]).some((s) => /^(heat|remade-)/.test(s)), `films found with their year were asked for again: ${urls(bodies[2]).filter((s) => /^(heat|remade-)/.test(s))}`);
  const r = await p.evaluate((sp) => sp.map(([n, y]) => { const x = LBX[filmKey(n, y)]; return x && x.r ? x.slug : "missing"; }), special);
  assert(r.join() === "8-half,mash,heat-1995,soren,missing,missing", `matched: ${r}`);
  const got = await p.evaluate((sh) => ({ shared: sh.filter(([n, y]) => (LBX[filmKey(n, y)] || {}).r).length, missing: lbMissing(MY_LIB).length,
    gone: lbNotFound(MY_LIB).map((f) => f.name).join(), few: lbTooFew(MY_LIB).map((f) => f.name).join() }), shared);
  assert(got.shared === 40 && got.missing === 0 && got.gone === "Not Under This Title" && got.few === "Tiny Short", `after both runs: ${JSON.stringify(got)}`);
  // "Look for them again": the film turned up on Letterboxd under its own address since
  bySlug.set("not-under-this-title", ["Not Under This Title", 2001, "not-under-this-title"]);
  await p.click('[data-lb="retry"]');
  await p.waitForFunction(() => !lbJob.running && !store.get(KEYS.lbRun, null));
  assert(await p.evaluate(() => (LBX[filmKey("Not Under This Title", 2001)] || {}).slug) === "not-under-this-title" && await p.evaluate(() => lbNotFound(MY_LIB).length) === 0, "looked for again and found");
  // a run started with the token used before can't be read with the new one: set aside, not asked for at every start
  await p.evaluate(async () => { store.set(KEYS.lbRun, { id: "gone", dataset: "x", at: Date.now(), mode: "missing", phase: "plain", keys: [], slugs: {} }); await pollLetterboxd(MY_LIB); });
  const gone = await p.evaluate(() => [!!store.get(KEYS.lbRun, null), lbJob.note]);
  assert(!gone[0] && /previous Apify token/.test(gone[1]), `a run of the old token: ${gone}`);
  noErrors(p, "desktop");
}
