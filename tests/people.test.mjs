// People are TMDB's people, by id: two actors who share a name (Paul Guilfoyle, 1902–1961, and Paul Guilfoyle, born
// 1949: the owner found the younger one credited with 1940s films, 26 Oct 2026) are counted, shown, pictured and looked
// up apart, labelled by TMDB's dates (or their films' years until those come); a credit TMDB's dates make impossible
// isn't counted; the people check says so on both layouts.
import { open, seed, assert, noErrors } from "./lib.mjs";

const meta = (id, y, c, ci, d = ["A Director"], di = [900]) => ({ src: "tmdb", v: 9, id, y, d, di, c, ci, w: [], p: [], m: [], g: ["Crime"], k: ["USA"], l: "English", r: 90 });
const films = [
  ["Old Noir", 1946, meta(1, 1946, ["Paul Guilfoyle", "Lead A"], [104714, 1])],
  ["Another Noir", 1948, meta(2, 1948, ["Paul Guilfoyle"], [104714])],
  ["Modern One", 1987, meta(3, 1987, ["Paul Guilfoyle", "Lead B"], [925, 2])],
  ["Later One", 1999, meta(4, 1999, ["Paul Guilfoyle"], [925])],
  ["Too Early", 1946, meta(5, 1946, ["Young Star"], [3])],
  ["Right Time", 1995, meta(6, 1995, ["Young Star"], [3])],
  // one person TMDB keeps twice (one IMDb id), under two spellings: one person
  ["Twice Kept", 2001, meta(7, 2001, ["Lu Qi"], [31])], ["Kept Again", 2003, meta(8, 2003, ["Lü Qi"], [32])], ["Third Time", 2005, meta(9, 2005, ["Lü Qi"], [32])],
];
const persons = { 104714: { birthday: "1902-07-14", deathday: "1961-06-27", imdb_id: "nm0002116", profile_path: "/old.jpg" },
  925: { birthday: "1949-04-28", deathday: null, imdb_id: "nm0002117", profile_path: "/new.jpg" }, 3: { birthday: "1970-01-01", imdb_id: "nm0000003" },
  31: { birthday: "1925-01-01", imdb_id: "nm0000031" }, 32: { birthday: "1925-01-01", imdb_id: "nm0000031" } };
const rows = { profile: [{ Username: "tester" }], watched: films.map(([n, y]) => ({ Name: n, Year: String(y) })), ratings: [], diary: films.map(([n, y], i) => ({ Name: n, Year: String(y), "Watched Date": `2024-0${i + 1}-02`, Rating: "4" })) };
const metas = Object.fromEntries(films.map(([n, y, m]) => [`${n.toLowerCase()}|${y}`, m]));

async function standIn(p, asked) {
  await p.context().route(/api\.themoviedb\.org/, (r) => {
    const u = new URL(r.request().url()), json = (o, status = 200) => r.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
    const m = u.pathname.match(/^\/3\/person\/(\d+)$/);
    if (m) { asked.push(+m[1]); return persons[m[1]] ? json({ id: +m[1], ...persons[m[1]] }) : json({}, 404); }
    if (/\/3\/person\/\d+\/movie_credits/.test(u.pathname)) { asked.push(`credits ${u.pathname.split("/")[3]}`); return json({ cast: [], crew: [] }); }
    json({ results: [] });
  });
}
const counted = (page) => page.evaluate(() => { const s = computeStats(MY_LIB, metaOf, "all"), of = (n) => (s.cast.most.find((x) => x.name === n) || {}).count || 0;
  return { old: of("Paul Guilfoyle (1902–1961)"), young: of("Paul Guilfoyle (born 1949)"), plain: of("Paul Guilfoyle"), star: of("Young Star"), twice: [of("Lu Qi"), of("Lü Qi")].join(),
    oldFilms: personDrill(MY_LIB, "Paul Guilfoyle (1902–1961)", "c").films.map((f) => f.name).sort().join(), photos: [PHOTOS["paul guilfoyle 1902 1961"], PHOTOS["paul guilfoyle born 1949"]].join() }; });

export default async function ({ browser, base }) {
  const p = await open(browser, base, "desktop.html"), asked = [];
  await standIn(p, asked);
  await seed(p, rows, { "cr-meta-v1": metas, "cr-tmdb-key": "k123" });
  // before TMDB's dates come, the two are told apart by their films' years
  const early = await p.evaluate(() => { const keep = FACTS; FACTS = {}; META_REV++; const l = [...peopleIndex().label.values()].sort(); FACTS = keep; META_REV++; return l.join(" | "); });
  assert(early === "Lu Qi (film of 2001) | Lü Qi (films 2003–2005) | Paul Guilfoyle (films 1946–1948) | Paul Guilfoyle (films 1987–1999)", `namesakes before their dates: ${early}`);
  await p.waitForFunction(() => !factsJob.running && FACTS[925] && FACTS[104714] && FACTS[3], null, { timeout: 8000 });
  const c = await counted(p);
  assert(c.old === 2 && c.young === 2 && c.plain === 0, `two people of one name counted apart: ${JSON.stringify(c)}`);
  assert(c.oldFilms === "Another Noir,Old Noir" && c.photos === "/old.jpg,/new.jpg", `each with their own films and face: ${JSON.stringify(c)}`);
  assert(c.star === 1, `a credit before the person was born isn't counted: ${c.star}`);
  assert(c.twice === "3,0", `one person TMDB keeps twice is counted once, under one name: ${c.twice}`);
  // only people in two or more films, or who share a name, have their dates asked for
  assert([...new Set(asked)].sort().join() === "104714,3,31,32,900,925", `asked TMDB for: ${asked}`);
  // the filmography of each is theirs, by TMDB's id, not the better known of the two
  await p.evaluate(() => filmography("Paul Guilfoyle (1902–1961)", "c"));
  assert(asked.includes("credits 104714") && !asked.includes("credits 925"), `filmography asked for: ${asked}`);
  await p.click("#btn-settings");
  await p.waitForFunction(() => /people check/i.test($("#lookup").innerText), null, { timeout: 5000 });
  const box = (await p.innerText("#lookup")).replace(/\s+/g, " ");
  assert(/2 people in your diary share a name/.test(box) && /1 credit is impossible by TMDB's own dates/.test(box) && /Dates checked for 5 of 5 people/.test(box), `the people check: ${box.slice(box.search(/people check/i), box.search(/people check/i) + 600)}`);
  noErrors(p, "desktop");

  // the phone counts them apart too
  const m = await open(browser, base, "mobile.html", { phone: true });
  await standIn(m, []);
  await seed(m, rows, { "cr-meta-v1": metas, "cr-tmdb-key": "k123" });
  await m.waitForFunction(() => !factsJob.running && FACTS[925], null, { timeout: 8000 });
  const mc = await counted(m);
  assert(mc.old === 2 && mc.young === 2 && mc.plain === 0 && mc.star === 1, `phone: ${JSON.stringify(mc)}`);
  await m.click("#nav-right [data-act=\"settings\"]");
  await m.waitForFunction(() => /People check/i.test(document.body.innerText) && /2 people in your diary share a name/.test(document.body.innerText), null, { timeout: 5000 });
  noErrors(m, "phone");
  await p.close(); await m.close();
}
