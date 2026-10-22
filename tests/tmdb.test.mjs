// Against a stand-in TMDB: a wrong match is put right from the film card and stays right, a director's
// filmography shows what's left to see, and search finds films and people.
import { open, seed, assert, noErrors } from "./lib.mjs";

const movie = (id, title, date, dir, cast) => ({ id, title, release_date: date, poster_path: null, genres: [{ name: "Crime" }], production_countries: [{ name: "United States of America" }],
  original_language: "en", runtime: 110, vote_average: 7.5, vote_count: 9000, imdb_id: "tt0393109", credits: { cast: cast.map((name, order) => ({ name, order })), crew: [{ name: dir, job: "Director" }] } });

export default async function ({ browser, base }) {
  const p = await open(browser, base, "desktop.html");
  await p.context().route(/api\.themoviedb\.org/, (r) => {
    const u = new URL(r.request().url()), json = (o) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
    if (u.pathname === "/3/movie/9270") return json(movie(9270, "Brick", "2005-04-08", "Rian Johnson", ["Joseph Gordon-Levitt"]));
    if (u.pathname === "/3/find/tt0393109") return json({ movie_results: [{ id: 9270 }] });
    if (u.pathname === "/3/search/person") return json({ results: [{ id: 17, name: "Rian Johnson", known_for_department: "Directing", popularity: 9 }] });
    if (u.pathname === "/3/person/17/movie_credits") return json({ cast: [], crew: [
      { id: 9270, title: "Brick", release_date: "2005-04-08", job: "Director", vote_count: 900 }, { id: 22, title: "Looper", release_date: "2012-09-26", job: "Director", vote_count: 9000 },
      { id: 23, title: "Knives Out", release_date: "2019-11-27", job: "Director", vote_count: 9000 }, { id: 24, title: "Not Out Yet", release_date: "2099-01-01", job: "Director", vote_count: 9 }] });
    json({ results: [] });
  });
  await seed(p, { profile: [{ Username: "tester" }], watched: [{ Name: "Brick", Year: "2005" }, { Name: "Looper", Year: "2012" }],
    diary: [{ Name: "Brick", Year: "2005", "Watched Date": "2024-02-03", Rating: "4" }, { Name: "Looper", Year: "2012", "Watched Date": "2024-03-03", Rating: "4" }], ratings: [], watchlist: [{ Name: "Knives Out", Year: "2019" }] },
  { "cr-meta-v1": { "brick|2005": { src: "tmdb", v: 3, id: 999, d: ["Somebody Else"], c: [], w: [], p: [], m: [], g: ["Drama"], k: [], l: "English", r: 25 },
    "looper|2012": { src: "tmdb", v: 3, id: 22, d: ["Rian Johnson"], c: ["Bruce Willis"], w: [], p: [], m: [], g: ["Action"], k: [], l: "English", r: 119 } }, "cr-tmdb-key": "k123" });

  await p.evaluate(() => openDrill(D.film(MY_LIB.films.find((f) => f.name === "Brick"))));
  await p.click("[data-fix]"); await p.fill("#fix-input", "https://www.imdb.com/title/tt0393109/"); await p.keyboard.press("Enter");
  await p.waitForFunction(() => META["brick|2005"].id === 9270);
  const fixed = await p.evaluate(() => ({ dir: META["brick|2005"].d[0], pin: META["brick|2005"].pin, again: needsLookup(MY_LIB, "tmdb").length, card: $("#dlg .fc-dir").textContent }));
  assert(fixed.dir === "Rian Johnson" && fixed.pin && fixed.again === 0 && fixed.card.includes("Rian Johnson"), `fix: ${JSON.stringify(fixed)}`);

  await p.click("#dlg .fc-dir .dlink");
  await p.waitForFunction(() => /Seen 2 of 3/.test(($("#dlg .filmo") || {}).textContent || ""), null, { timeout: 8000 }).catch(() => {});
  const filmo = await p.$eval("#dlg .filmo", (e) => e.innerText.replace(/\s+/g, " "));
  assert(/Seen 2 of 3/.test(filmo) && /Knives Out 2019 On your watchlist/.test(filmo) && !/Not Out Yet/.test(filmo), `filmography: ${filmo}`);

  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.keyboard.press("/"); await p.keyboard.type("rian"); await p.waitForTimeout(100);
  const found = await p.$$eval("#search-results .dr-t", (x) => x.map((t) => t.innerText));
  assert(found.includes("Rian Johnson"), `search: ${found}`);
  noErrors(p, "desktop");
}
