// The owner's cast checked against IMDb, through a stand-in Apify that runs our own page function on stand-in IMDb
// pages (the page as IMDb draws it since 2025, the older cast table, plain links): five films first, then the rest;
// what IMDb marks uncredited or archive footage comes off, credited roles TMDB lacks go on under TMDB's spelling, a
// role IMDb gives no character takes nothing off; the people pages count it so, each film once. A trial IMDb turns
// away stops there. Visitors' diaries don't offer it.
import { open, seed, assert, noErrors } from "./lib.mjs";

// each person's TMDB id, the same in every film
const PID = { "Humphrey Bogart": 101, "Peter Lorre": 102, "Bess Flowers": 103, "Lead Player": 201, "Archive Man": 202, "Quiet One": 301, "Song Kang-ho": 401 };
const meta = (id, c, d = ["Some Director"]) => ({ src: "tmdb", v: 10, id, y: 1940 + id, im: `tt${String(id).padStart(7, "0")}`, d, c, ci: c.map((n) => PID[n]), w: [], p: [], m: [], g: ["Drama"], k: ["USA"], l: "English", r: 100 });
// TMDB's dates for two people: Night Cafe's Peter Lorre (TMDB 102) has another IMDb id than the one IMDb's page gives
// for the role, which is TMDB 777's: TMDB gave the role to the wrong person of that name
const today = new Date().toISOString().slice(0, 10);
const facts = { 102: { b: 1904, d: 1964, im: "nm9999999", p: "", t: today }, 777: { b: 1904, d: 1964, im: "nm0000048", p: "", t: today } };
const films = [
  ["Night Cafe", 1942, meta(1, ["Humphrey Bogart", "Bess Flowers", "Peter Lorre"])],
  ["Old Table", 1950, meta(2, ["Lead Player", "Archive Man"])],
  ["Plain Links", 1960, meta(3, ["Quiet One"])],
  ["Seoul Story", 2019, meta(4, ["Song Kang-ho"])],
  ["Fourth", 1970, meta(5, ["Humphrey Bogart"])],
  ["Fifth", 1971, meta(6, ["Peter Lorre"])],
  ["Sixth", 1972, meta(7, ["Lead Player"])],
  ["Seventh", 1973, meta(8, ["Lead Player"])],
];
const key = (n, y) => `${n.toLowerCase()}|${y}`;
const next = (cast) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { contentData: { categories: [
  { id: "director", name: "Directors", section: { items: [{ id: "nm0000900", rowTitle: "Some Director" }] } },
  { id: "cast", name: "Cast", section: { total: cast.length, items: cast.map(([id, rowTitle, ch, at]) => ({ id, rowTitle, characters: ch ? [ch] : [], attributes: at || null })) } }] } } } })}</script></html>`;
const pages = {
  tt0000001: next([["nm0000007", "Humphrey Bogart", "Rick"], ["nm0283284", "Bess Flowers", "Customer in Café", "(uncredited)"], ["nm0000048", "Peter Lorre", "Ugarte"],
    ["nm0000101", "Kang-ho Song", "Visitor"], ["nm0000102", "Dooley Wilson", "Sam"]]),
  tt0000002: `<table class="cast_list"><tr class="odd"><td><a href="/name/nm0000201/">Lead Player</a></td><td class="character">The Lead</td></tr>
    <tr class="even"><td><a href="/name/nm0000202/">Archive Man</a></td><td class="character">Self (archive footage)</td></tr>
    <tr class="odd"><td><a href="/name/nm0000203/">Extra Credited</a></td><td class="character">Bartender</td></tr></table>`,
  tt0000003: `<ul><li><a href="/name/nm0000301/">Quiet One</a> (no character given)</li><li><a href="/name/nm0000302/">Named Two</a><a href="/title/tt0000003/characters/nm0000302/">Clerk</a></li></ul>`,
};
// the other films: IMDb's cast as TMDB has it, so nothing changes
const page = (tt) => pages[tt] || next(films.find(([, , m]) => m.im === tt)[2].c.map((n, i) => [`nm${String(500 + i).padStart(7, "0")}`, n, "Role"]));

async function standIn(p, runs, { turnAway = false } = {}) {
  await p.context().route(/\/feed\/[^/]+\.json/, (r) => r.fulfill({ status: 404, body: "" })); // the owner's real daily feed stays out
  await p.context().route(/api\.apify\.com/, async (r) => {
    const req = r.request(), u = new URL(req.url()), cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type" };
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    const json = (o) => r.fulfill({ headers: cors, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname.endsWith("/runs")) { runs.push({ ...JSON.parse(req.postData()), actor: u.pathname.split("/acts/")[1].split("/")[0] }); return json({ data: { id: "run" + runs.length, defaultDatasetId: "ds" + runs.length } }); }
    if (u.pathname.includes("/actor-runs/")) return json({ data: { status: "SUCCEEDED", usageTotalUsd: 0.004 } });
    if (u.pathname.includes("/datasets/")) {
      const input = runs[+u.pathname.match(/ds(\d+)/)[1] - 1], fn = new Function(`return (${input.pageFunction})`)();
      const items = [];
      for (const { url, userData } of input.startUrls) items.push(await fn({ request: { url, userData }, response: { status: turnAway ? 202 : 200 },
        body: turnAway ? "<html><script>challenge()</script></html>" : page(url.match(/title\/(tt\d+)\//)[1]) }));
      return json(items.slice(+u.searchParams.get("offset"), +u.searchParams.get("offset") + 500));
    }
    json({});
  });
}
const rows = (user) => ({ profile: [{ Username: user }], watched: films.map(([n, y]) => ({ Name: n, Year: String(y) })), ratings: [], diary: [] });
const metas = Object.fromEntries(films.map(([n, y, m]) => [key(n, y), m]));

export default async function ({ browser, base }) {
  const p = await open(browser, base, "desktop.html"), runs = [];
  await standIn(p, runs);
  await seed(p, rows("bogie1946"), { "cr-meta-v1": metas, "cr-apify-key": "apify_api_TEST", "cr-people-v1": facts });
  await p.click("#btn-settings");
  assert(/Cast checked on IMDb/i.test(await p.innerText("#lookup")), "the owner's Settings offer the IMDb cast check");
  await p.click('[data-lb="ic-start"]');
  await p.waitForFunction(() => !icJob.running && !store.get(KEYS.icRun, null) && MY_LIB.films.every((f) => META[f.key].cq), null, { timeout: 10000 });
  assert(runs.length === 2 && runs[0].startUrls.length === 5 && runs[1].startUrls.length === 3 && runs.every((x) => x.actor === "apify~jsdom-scraper"),
    `five films first, then the other three: ${runs.map((x) => x.startUrls.length)}`);
  assert(/^https:\/\/www\.imdb\.com\/title\/tt\d{7}\/fullcredits\/$/.test(runs[0].startUrls[0].url), `IMDb's full cast page: ${runs[0].startUrls[0].url}`);
  const got = await p.evaluate(() => Object.fromEntries(MY_LIB.films.map((f) => [f.name, castOf(META[f.key]).join(", ")])));
  assert(got["Night Cafe"] === "Humphrey Bogart, Peter Lorre, Song Kang-ho, Dooley Wilson",
    `uncredited on IMDb comes off; credited on IMDb goes on, under TMDB's spelling: ${got["Night Cafe"]}`);
  assert(got["Old Table"] === "Lead Player, Extra Credited", `archive footage comes off, from the older cast table: ${got["Old Table"]}`);
  assert(got["Plain Links"] === "Quiet One, Named Two", `no character on IMDb takes nothing off: ${got["Plain Links"]}`);
  // the people pages count it so, each film once, and the drill holds the same films
  const people = await p.evaluate(() => { const s = computeStats(MY_LIB, metaOf, "all"), of = (n) => s.cast.most.find((x) => x.name === n);
    return { song: of("Song Kang-ho") && of("Song Kang-ho").count, bess: !!of("Bess Flowers"), kang: !!of("Kang-ho Song"),
      drill: (() => { const d = personDrill(MY_LIB, "Song Kang-ho", "c"); return (d.items || d.films || []).map((f) => f.name).sort().join(); })() }; });
  assert(people.song === 2 && !people.bess && !people.kang && people.drill === "Night Cafe,Seoul Story", `counted: ${JSON.stringify(people)}`);
  const box = await p.innerText("#lookup");
  assert(/8 of 8 films checked/.test(box) && /added 4 people/.test(box) && /took off 2 people/.test(box) && /in 3 films/.test(box), `the box says what IMDb changed: ${box.match(/\d+ of 8 films checked[^\n]*/)}`);
  assert(/Checked against IMDb for 8 films/.test(await p.evaluate(() => castRuleText())), "the people pages say the cast was checked on IMDb");
  // the role TMDB gave to the wrong Peter Lorre goes to the right one, and the people check says so
  const moved = await p.evaluate(() => { const m = META["night cafe|1942"]; return { to: rolePeople(m, "c").find((x) => x.name === "Peter Lorre"), wrong: peopleCheck(MY_LIB).wrong.map((x) => x.name).join() }; });
  assert(moved.to && moved.to.id === 777 && moved.to.moved === 102 && moved.wrong === "Peter Lorre in Night Cafe (1942)", `the wrong person of a name: ${JSON.stringify(moved)}`);
  noErrors(p, "desktop");

  // the phone shows the box too
  const m = await open(browser, base, "mobile.html", { phone: true });
  await seed(m, rows("bogie1946"), { "cr-meta-v1": metas, "cr-apify-key": "apify_api_TEST", "cr-people-v1": facts });
  await m.click("#nav-right [data-act=\"settings\"]");
  await m.waitForFunction(() => /Cast checked on IMDb/i.test(document.body.innerText), null, { timeout: 5000 });
  noErrors(m, "phone");

  // a trial IMDb turns away: nothing more is tried
  const q = await open(browser, base, "desktop.html"), runs2 = [];
  await standIn(q, runs2, { turnAway: true });
  await seed(q, rows("bogie1946"), { "cr-meta-v1": metas, "cr-apify-key": "apify_api_TEST", "cr-people-v1": facts });
  await q.click("#btn-settings");
  await q.click('[data-lb="ic-start"]');
  await q.waitForFunction(() => !icJob.running && icJob.note, null, { timeout: 10000 });
  const blocked = await q.evaluate(() => ({ note: icJob.note, checked: MY_LIB.films.filter((f) => META[f.key].cq).length }));
  assert(runs2.length === 1 && blocked.checked === 0 && /didn't let Apify read/.test(blocked.note), `turned away: ${runs2.length} runs, ${JSON.stringify(blocked)}`);
  noErrors(q, "turned away");

  // a visitor's own diary doesn't offer it
  const v = await open(browser, base, "desktop.html");
  await seed(v, rows("someone_else"), { "cr-meta-v1": metas, "cr-apify-key": "apify_api_TEST", "cr-people-v1": facts });
  await v.click("#btn-settings");
  assert(!/Cast checked on IMDb/i.test(await v.innerText("#lookup")), "a visitor's Settings don't offer the IMDb cast check");
  for (const x of [p, m, q, v]) await x.close();
}
