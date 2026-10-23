// Letterboxd averages through a stand-in Apify: a big diary's first run stops at the cap, and the follow-up
// run finds the rest by address, tricky titles and titles shared with older films included.
import { open, seed, assert, noErrors } from "./lib.mjs";

const special = [["8½", 1963, "8-half"], ["M*A*S*H", 1970, "mash"], ["Heat", 1995, "heat-1995"], ["Søren", 2020, "soren"], ["Not Under This Title", 2001, "something-else"]];
const films = [...Array.from({ length: 1340 }, (_, i) => [`Film ${i}`, 1950 + (i % 70), `film-${i}`]), ...special];

export default async function ({ browser, base }) {
  const p = await open(browser, base, "desktop.html");
  const bodies = [];
  await p.context().route(/api\.apify\.com/, (r) => {
    const req = r.request(), u = new URL(req.url()), cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type" };
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    const json = (o) => r.fulfill({ headers: cors, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname.endsWith("/runs")) { bodies.push(JSON.parse(req.postData())); return json({ data: { id: "run" + bodies.length, defaultDatasetId: "ds" + bodies.length } }); }
    if (u.pathname.includes("/actor-runs/")) return json({ data: { status: "SUCCEEDED" } });
    if (u.pathname.includes("/datasets/")) {
      const input = bodies[bodies.length - 1], off = +u.searchParams.get("offset");
      const bySlug = new Map(films.map((f) => [f[2], f])); bySlug.set("heat", ["Heat", 1986, "heat"]);
      const items = input.startUrls[0].includes("/tester/films/") ? films.slice(0, input.maxResults).map((f) => ({ recordType: "film", title: f[0], year: String(f[1]), filmSlug: f[2], averageRating: 3.5, ratingsCount: 900 }))
        : input.startUrls.map((x) => x.match(/film\/([^/]+)\//)[1]).filter((s) => bySlug.has(s)).map((s) => { const f = bySlug.get(s); return { recordType: "film", title: f[0], year: f[1], filmSlug: s, averageRating: 3.8, ratingsCount: 500 }; });
      return json(items.slice(off, off + 1000));
    }
    json({});
  });
  await seed(p, { profile: [{ Username: "tester" }], watched: films.map((f) => ({ Name: f[0], Year: String(f[1]) })), ratings: [], diary: [] }, { "cr-apify-key": "apify_api_TEST" });
  await p.click("#btn-settings"); // Letterboxd averages are under Settings → Film details
  await p.click('[data-lb="all"]');
  await p.waitForFunction(() => !lbJob.running && Object.keys(LBX).length);
  assert(bodies[0].maxResults === 1300, `first run asked for ${bodies[0].maxResults}`);
  assert(/45 films are still missing, because one run stops at 1,300/.test(await p.evaluate(() => lbJob.note)), `note: ${await p.evaluate(() => lbJob.note)}`);
  await p.click('[data-lb="missing"]');
  await p.waitForFunction(() => !lbJob.running);
  const urls = bodies[1].startUrls.map((u) => u.replace("https://letterboxd.com/film/", ""));
  for (const s of ["8-half/", "mash/", "heat/", "heat-1995/", "soren/"]) assert(urls.includes(s), `follow-up run didn't ask for ${s}`);
  const r = await p.evaluate((sp) => sp.map(([n, y]) => { const x = LBX[filmKey(n, y)]; return x && x.r ? x.slug : "missing"; }), special);
  assert(r.join() === "8-half,mash,heat-1995,soren,missing", `matched: ${r}`);
  assert(await p.evaluate(() => lbNotFound(MY_LIB).map((f) => f.name).join()) === "Not Under This Title", "not-found list");
  noErrors(p, "desktop");
}
