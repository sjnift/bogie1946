// Letterboxd averages through a stand-in Apify: a big diary's first run stops at the cap, and "Get the remaining" finds
// the rest by address (with the year first: only titles shared by several films have one; then the plain address),
// then reads the own Letterboxd page of every film still without an average. Shared titles once cost two films each in
// one run, which hit its cap and left films "not found" for good; and the scraper leaves the average out for some
// films that have thousands of ratings (the owner's 132, Oct 2026), which their pages give.
import { open, seed, assert, noErrors } from "./lib.mjs";

const special = [["8½", 1963, "8-half"], ["M*A*S*H", 1970, "mash"], ["Heat", 1995, "heat-1995"], ["Søren", 2020, "soren"], ["Not Under This Title", 2001, "something-else"],
  ["Tiny Short", 2019, "tiny-short"], ["Obscure Short", 2015, "obscure-short"], ["Twin Title", 1960, "twin-title-1960"]];
// the films' own pages, as the page reader finds them: Tiny Short has an average the scraper left out, Obscure Short none
// at all, Twin Title's plain address is another film of that name
const homeOnly = new Set();
let refuse = null; // Apify refusing to start a run: { status, error }
const pages = { "tiny-short": [2019, 3.4, 9000], "obscure-short": [2015, null, 0], "twin-title": [1990, 2.9, 500], "twin-title-1960": [1960, 3.9, 4000] };
// titles shared with another film on Letterboxd: theirs has the year in its address, the plain one is the other film's
const shared = Array.from({ length: 40 }, (_, i) => [`Remade ${i}`, 1940 + i, `remade-${i}-${1940 + i}`]);
const films = [...Array.from({ length: 1340 }, (_, i) => [`Film ${i}`, 1950 + (i % 70), `film-${i}`]), ...special, ...shared];

export default async function ({ browser, base }) {
  const p = await open(browser, base, "desktop.html");
  const bodies = [];
  const bySlug = new Map(films.map((f) => [f[2], f])); bySlug.set("heat", ["Heat", 1986, "heat"]); bySlug.delete("twin-title-1960");
  for (const [n, y] of shared) bySlug.set(n.toLowerCase().replace(/ /g, "-"), [n, y + 30, n.toLowerCase().replace(/ /g, "-")]);
  await p.context().route(/api\.apify\.com/, (r) => {
    const req = r.request(), u = new URL(req.url()), cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type" };
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    const json = (o, status = 200) => r.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname.endsWith("/runs") && refuse) return r.fulfill({ status: refuse.status, headers: cors, contentType: "application/json", body: JSON.stringify({ error: refuse.error }) });
    if (u.pathname.endsWith("/runs")) { bodies.push({ ...JSON.parse(req.postData()), actor: u.pathname.split("/acts/")[1].split("/")[0], query: u.search });
      return json({ data: { id: "run" + bodies.length, defaultDatasetId: "ds" + bodies.length } }); }
    if (u.pathname.includes("/actor-runs/gone")) return json({ error: { type: "record-not-found" } }, 404); // a run of the token used before
    if (u.pathname.includes("/actor-runs/")) return json({ data: { status: "SUCCEEDED" } });
    if (u.pathname.includes("/datasets/")) {
      const input = bodies[+u.pathname.match(/ds(\d+)/)[1] - 1], off = +u.searchParams.get("offset");
      const item = (f, s) => ({ recordType: "film", title: f[0], year: String(f[1]), filmSlug: s, averageRating: /Short/.test(f[0]) ? null : 3.8, ratingsCount: 500 });
      if (input.actor === "apify~jsdom-scraper") return json(input.startUrls.map(({ url, userData }) => { const s = url.match(/film\/([^/]+)\//)[1], pg = pages[s];
        if (homeOnly.has(s) && !(input.proxyConfiguration.apifyProxyGroups || []).includes("RESIDENTIAL")) return null; // turned away
        return pg ? { key: userData.key, sure: userData.sure, slug: s, year: pg[0], r: pg[1], n: pg[2], status: 200, gone: false } : { key: userData.key, sure: userData.sure, slug: s, status: 404, gone: true }; }).filter(Boolean).slice(off, off + 1000));
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
  assert(/88 films are still without an average, because one run stops at 1,300/.test(await p.evaluate(() => lbJob.note)), `note: ${await p.evaluate(() => lbJob.note)}`);
  assert(/Get the remaining 88 films/.test(await p.innerText('[data-lb="rest"]')), "the button for the remaining films");
  await p.click('[data-lb="rest"]');
  await p.waitForFunction(() => !lbJob.running && !store.get(KEYS.lbRun, null));
  assert(bodies.length === 4, `the remaining films took ${bodies.length - 1} runs, not 3 (with the year, without, then their pages)`);
  const urls = (b) => b.startUrls.map((u) => u.replace("https://letterboxd.com/film/", ""));
  for (const s of ["8-half-1963/", "heat-1995/", "remade-7-1947/"]) assert(urls(bodies[1]).includes(s), `the run with years didn't ask for ${s}`);
  for (const s of ["8-half/", "mash/", "soren/", "film-1320/"]) assert(urls(bodies[2]).includes(s), `the plain run didn't ask for ${s}`);
  assert(!urls(bodies[2]).some((s) => /^(heat|remade-)/.test(s)), `films found with their year were asked for again: ${urls(bodies[2]).filter((s) => /^(heat|remade-)/.test(s))}`);
  // the page reader: Apify's general one, on a small machine, given the address the scraper came back with or both of the title's
  const reader = bodies[3], asked = reader.startUrls.map((x) => x.url.replace("https://letterboxd.com/film/", ""));
  assert(reader.actor === "apify~jsdom-scraper" && /memory=1024/.test(reader.query) && reader.linkSelector === "" && /ratingValue/.test(reader.pageFunction), `the page reader's run: ${reader.actor} ${reader.query}`);
  assert(["tiny-short/", "obscure-short/", "twin-title/", "twin-title-1960/", "not-under-this-title/", "not-under-this-title-2001/"].every((x) => asked.includes(x)) && !asked.includes("tiny-short-2019/"),
    `the pages read: ${asked}`);
  const r = await p.evaluate((sp) => sp.map(([n, y]) => { const x = LBX[filmKey(n, y)]; return x && x.r ? `${x.slug} ${x.r}` : "none"; }), special);
  assert(r.join() === "8-half 3.8,mash 3.8,heat-1995 3.8,soren 3.8,none,tiny-short 3.4,none,twin-title-1960 3.9", `matched: ${r}`);
  const got = await p.evaluate((sh) => ({ shared: sh.filter(([n, y]) => (LBX[filmKey(n, y)] || {}).r).length, remaining: lbRemaining(MY_LIB).length,
    gone: lbNotFound(MY_LIB).map((f) => f.name).join(), few: lbTooFew(MY_LIB).map((f) => f.name).join(), box: document.querySelector("#lookup").innerText }), shared);
  assert(got.shared === 40 && got.remaining === 0 && got.gone === "Not Under This Title" && got.few === "Obscure Short", `after all three runs: ${JSON.stringify(got).slice(0, 300)}`);
  assert(/show[s]? no average on (its|their) Letterboxd page/.test(got.box) && /no Letterboxd page at the address/.test(got.box) && !/Get the remaining/.test(got.box), `the box after: ${got.box.slice(0, 400)}`);
  // pages Letterboxd turns away from Apify's data-centre addresses are read again once through home connections
  const n0 = bodies.length;
  const turnedAway = ["Lost Page", 1977, "lost-page"];
  await p.evaluate(([n, y]) => { const rows = store.get(KEYS.rows, {}); rows.watched.push({ Name: n, Year: String(y) }); store.set(KEYS.rows, rows); MY_LIB = myLibrary(); LBX[filmKey(n, y)] = { tries: 1, v: 2, few: true, slug: "lost-page" }; render(); }, turnedAway);
  pages["lost-page"] = [1977, 3.7, 6000]; homeOnly.add("lost-page");
  await p.click('[data-lb="rest"]');
  await p.waitForFunction(() => !lbJob.running && !store.get(KEYS.lbRun, null));
  const home = bodies.slice(n0);
  assert(home.length === 2 && !home[0].proxyConfiguration.apifyProxyGroups && home[1].proxyConfiguration.apifyProxyGroups.join() === "RESIDENTIAL"
    && await p.evaluate(() => (LBX[filmKey("Lost Page", 1977)] || {}).r) === 3.7, `read again through home connections: ${JSON.stringify(home.map((b) => b.proxyConfiguration))}`);
  // Apify's own reason when it won't start a run: only a refusal about usage reads as "credit used up" (a 403 for an
  // actor wanting full access to the account was once shown as that)
  refuse = { status: 403, error: { type: "insufficient-permissions", message: "You do not have permission to run this Actor." } };
  await p.evaluate(([n, y]) => { LBX[filmKey(n, y)] = { tries: 1, v: 2, few: true, slug: "lost-page" }; render(); }, turnedAway);
  await p.click('[data-lb="rest"]'); await p.waitForFunction(() => !lbJob.running);
  const said = await p.evaluate(() => lbJob.note);
  assert(/permission to run this Actor/.test(said) && !/credit/.test(said), `a refusal that isn't about credit: ${said}`);
  refuse = { status: 402, error: { type: "not-enough-usage-to-run-paid-actor", message: "Monthly usage limit exceeded." } };
  await p.click('[data-lb="rest"]'); await p.waitForFunction(() => !lbJob.running);
  assert(/this month's credit/.test(await p.evaluate(() => lbJob.note)), `a refusal about usage: ${await p.evaluate(() => lbJob.note)}`);
  refuse = null;
  // a run started with the token used before can't be read with the new one: set aside, not asked for at every start
  await p.evaluate(async () => { store.set(KEYS.lbRun, { id: "gone", dataset: "x", at: Date.now(), mode: "missing", phase: "plain", keys: [], slugs: {} }); await pollLetterboxd(MY_LIB); });
  const gone = await p.evaluate(() => [!!store.get(KEYS.lbRun, null), lbJob.note]);
  assert(!gone[0] && /previous Apify token/.test(gone[1]), `a run of the old token: ${gone}`);
  noErrors(p, "desktop");

  // a visitor connects a free Apify account of their own: the line under "against the crowd" points to Settings, the
  // steps are there, and a token Apify refuses isn't kept (nothing of the owner's is shared)
  for (const phone of [false, true]) {
    const v = await open(browser, base, phone ? "mobile.html" : "desktop.html", { phone });
    await v.context().route(/api\.apify\.com\/v2\/users\/me/, (r) => r.fulfill({ status: /BAD/.test(r.request().headers().authorization) ? 401 : 200,
      headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify({ data: { id: "u9" } }) }));
    await seed(v, { profile: [{ Username: "a_visitor" }], watched: films.slice(0, 30).map((f) => ({ Name: f[0], Year: String(f[1]) })), ratings: [], diary: [] });
    if (phone) await v.evaluate(() => goTo("crowd", { force: true, top: true }));
    await v.click(phone ? '.note [data-act="settings"]' : ".note .lb-go");
    await v.waitForSelector("#apify-key");
    const steps = await v.evaluate(() => document.querySelector(".lb-steps").textContent);
    assert(/Create a free Apify account/.test(steps) && /API & Integrations/.test(steps), `${phone ? "phone" : "computer"}: the steps: ${steps}`);
    await v.fill("#apify-key", "apify_api_BAD"); await v.click('[data-lb="save"]');
    await v.waitForFunction(() => /didn't accept/.test(lbJob.note));
    assert(!(await v.evaluate(() => store.get(KEYS.apify, ""))), "a token Apify refused was kept");
    await v.fill("#apify-key", "apify_api_GOOD"); await v.click('[data-lb="save"]');
    await v.waitForFunction(() => store.get(KEYS.apify, "") === "apify_api_GOOD");
    await v.waitForSelector('[data-lb="all"]');
    noErrors(v, phone ? "phone visitor" : "computer visitor");
    await v.close();
  }
}
