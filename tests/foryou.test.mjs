// For you (06s): a hundred films you'd love, against a stand-in TMDB. From a diary that loves one director and not
// another, the list puts the loved director's unseen films first, with why; never a film of the diary, an unreleased one,
// a "trilogy" re-edit or one too little seen; each film once; both layouts; a film you then log leaves the list at once
// and the list is made again with it as a new data point.
import { open, seed, assert, noErrors, until } from "./lib.mjs";

const LOVED = 500, MEH = 501;
// the diary: twelve films by Dir Loved rated high, twelve by Dir Meh rated low, six in between
const films = Array.from({ length: 30 }, (_, i) => {
  const loved = i < 12, meh = i >= 12 && i < 24;
  return { id: i + 1, name: `Diary Film ${i + 1}`, year: 1960 + i, rating: loved ? (i % 2 ? 5 : 4.5) : meh ? (i % 2 ? 2 : 1.5) : 3, liked: loved && i % 3 === 0,
    dir: loved ? "Dir Loved" : meh ? "Dir Meh" : "Dir Other", did: loved ? LOVED : meh ? MEH : 502, genre: loved ? "Drama" : meh ? "Action" : "Comedy" };
});
const metaOfFilm = (f) => ({ src: "tmdb", v: 15, id: f.id, y: f.year, d: [f.dir], di: [f.did], c: [`Star ${f.id}`, "Shared Actor"], ci: [9000 + f.id, 8000], w: [], wi: [], p: [], pi: [], m: [], mi: [],
  g: [f.genre], k: ["United States of America"], l: "English", r: 105, va: 7, vc: 4000, poster: null });
const rows = (extra = []) => ({ profile: [{ Username: "tester" }],
  watched: [...films, ...extra].map((f) => ({ Name: f.name, Year: String(f.year), Date: "2024-01-01" })),
  diary: [...films, ...extra].map((f, i) => ({ Name: f.name, Year: String(f.year), "Watched Date": `2024-0${1 + (i % 9)}-1${i % 9}`, Rating: String(f.rating) })),
  ratings: [...films, ...extra].map((f) => ({ Name: f.name, Year: String(f.year), Rating: String(f.rating) })),
  likes: [...films, ...extra].filter((f) => f.liked).map((f) => ({ Name: f.name, Year: String(f.year) })), reviews: [], watchlist: [] });
const metas = (extra = []) => Object.fromEntries([...films, ...extra].map((f) => [`${f.name.toLowerCase()}|${f.year}`, metaOfFilm(f)]));
// what TMDB's lists say of a film, and its details in full
const brief = (id, title, date, votes, genre = 18) => ({ id, title, release_date: date, genre_ids: [genre], vote_average: 7.4, vote_count: votes, original_language: "en", poster_path: null });
const CANDS = {
  101: { title: "Loved Dir New Film", date: "2010-05-01", dir: "Dir Loved", did: LOVED, genre: "Drama" },
  106: { title: "Loved Dir Other", date: "2001-05-05", dir: "Dir Loved", did: LOVED, genre: "Drama" },
  102: { title: "Meh Dir New Film", date: "2011-05-01", dir: "Dir Meh", did: MEH, genre: "Action" },
};
const details = (id) => { const c = CANDS[id]; return { id, title: c.title, release_date: c.date, poster_path: null, runtime: 110, vote_average: 7.4, vote_count: 5000, imdb_id: "", original_language: "en",
  genres: [{ name: c.genre }], production_countries: [{ name: "United States of America" }], production_companies: [], spoken_languages: [{ english_name: "English", iso_639_1: "en" }],
  credits: { cast: [{ id: 7000 + id, name: `Lead ${id}`, order: 0, character: "Hero" }], crew: [{ id: c.did, name: c.dir, job: "Director" }] } }; };

async function setup(browser, base, file, phone) {
  const p = await open(browser, base, file, { phone });
  await p.context().route(/api\.themoviedb\.org/, (r) => {
    const u = new URL(r.request().url()), json = (o) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
    let m;
    if ((m = u.pathname.match(/^\/3\/movie\/(\d+)\/recommendations$/))) return json({ results: [
      brief(101, "Loved Dir New Film", "2010-05-01", 5000), brief(102, "Meh Dir New Film", "2011-05-01", 5000, 28), brief(5, "Diary Film 5", "1964-01-01", 5000),
      brief(103, "Not Out Yet", "2099-01-01", 5000), brief(104, "The Loved Trilogy", "2005-01-01", 5000), brief(105, "Hardly Seen", "2008-01-01", 20)] });
    if (u.pathname === `/3/person/${LOVED}/movie_credits`) return json({ cast: [], crew: [{ ...brief(106, "Loved Dir Other", "2001-05-05", 3000), job: "Director" }, { ...brief(1, "Diary Film 1", "1960-01-01", 4000), job: "Director" }] });
    if ((m = u.pathname.match(/^\/3\/movie\/(\d+)$/)) && CANDS[m[1]]) return json(details(+m[1]));
    if (u.pathname.startsWith("/3/person/")) return json({ cast: [], crew: [] });
    json({ results: [] });
  });
  await seed(p, rows(), { "cr-meta-v1": metas(), "cr-tmdb-key": "k123" });
  return p;
}

export default async function ({ browser, base }) {
  // the computer: the page, the button, the list
  const d = await setup(browser, base, "desktop.html", false);
  await d.evaluate(() => { location.hash = "#/foryou"; });
  await d.waitForSelector('#foryou [data-fy="go"]');
  await d.click('#foryou [data-fy="go"]');
  await until(d, () => FY && !FY_JOB.running, "the list to be made", null, 20000);
  const got = await d.evaluate(() => ({ ids: FY.all.map((x) => x.id), fresh: FY.fresh.map((x) => x.id), why: FY.all.map((x) => x.why.join(" | ")),
    shown: document.querySelectorAll("#foryou .fy-grid > li").length, err: FY_JOB.err, test: FY.test, weights: FY.weights.length }));
  assert(!got.err && got.ids.length === 3 && new Set(got.ids).size === got.ids.length && got.shown === 3, `the list: ${JSON.stringify(got)}`);
  assert(got.ids.indexOf(102) > got.ids.indexOf(101) && got.ids.indexOf(102) > got.ids.indexOf(106), `the loved director's films first: ${got.ids}`);
  assert(![1, 5, 103, 104, 105].some((id) => got.ids.includes(id)), `no diary, unreleased, trilogy or hardly seen film: ${got.ids}`);
  assert(/Dir Loved/.test(got.why[0]) && got.test.n === 30 && got.test.topAvg > got.test.allAvg && got.weights > 5, `why and the test on the diary: ${JSON.stringify(got)}`);
  // a film's card says why
  await d.click("#foryou .fy-p");
  await d.waitForSelector("#dlg .fc-why li");
  const card = await d.$eval("#dlg", (e) => e.textContent);
  assert(/Why it's on your list/.test(card) && /#1 for you: about [\d.]+★, \d+% chance you'd love it/.test(card) && /Not in your diary/.test(card), `the card: ${card.slice(0, 300)}`);
  await d.keyboard.press("Escape");
  noErrors(d, "for you, desktop");

  // a film of the list logged: it leaves the list at once, and the list is made again with it as a new data point
  const logged = { id: 101, name: "Loved Dir New Film", year: 2010, rating: 5, liked: true, dir: "Dir Loved", did: LOVED, genre: "Drama" };
  await d.evaluate(([r, m]) => { localStorage.setItem("cr-rows-v1", JSON.stringify(r)); localStorage.setItem("cr-meta-v1", JSON.stringify(m)); }, [rows([logged]), metas([logged])]);
  await d.evaluate(() => { location.hash = "#/"; }); // off the page, so only the check in the background makes it again
  await d.reload();
  await d.waitForFunction(() => typeof state === "object" && state.lib && FY);
  const after = await d.evaluate(() => ({ stale: fyStale(MY_LIB), shown: fyFilms("all").map((f) => f.name) }));
  assert(after.stale && !after.shown.includes("Loved Dir New Film") && after.shown.length === 2, `logged film leaves the list: ${JSON.stringify(after)}`);
  await d.evaluate(() => { FY.at = new Date(Date.now() - 2 * 3600e3).toISOString(); fyAutoCheck(); });
  await until(d, () => FY && !FY_JOB.running && !fyStale(MY_LIB), "the list made again", null, 20000);
  const again = await d.evaluate(() => ({ ids: FY.all.map((x) => x.id), n: FY.test.n }));
  assert(!again.ids.includes(101) && again.n === 31, `made again with the new film as a data point: ${JSON.stringify(again)}`);
  noErrors(d, "for you, made again");

  // the phone: the banner on Profile, the screen, a film's sheet
  const m = await setup(browser, base, "mobile.html", true);
  await m.evaluate(() => { location.hash = "#/profile"; });
  await m.waitForSelector('.banner.fy[data-act="foryou"]');
  await m.click('.banner.fy[data-act="foryou"]');
  await m.waitForSelector('#screen [data-fy="go"]');
  await m.click('#screen [data-fy="go"]');
  await until(m, () => FY && !FY_JOB.running, "the list to be made on the phone", null, 20000);
  await m.waitForSelector("#screen .drill-row");
  const rowsShown = await m.$$eval("#screen .drill-row", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ")));
  assert(rowsShown.length === 3 && /Loved Dir/.test(rowsShown[0]) && /chance you'd love it/.test(rowsShown[0]), `phone list: ${rowsShown.join(" / ")}`);
  await m.click('#screen [data-fyshow="fresh"]');
  await m.click("#screen .drill-row");
  await m.waitForSelector("#sheet .fc-why li");
  noErrors(m, "for you, phone");
}
