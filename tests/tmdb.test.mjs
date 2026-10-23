// Against a stand-in TMDB: a film only matches a film with its title (The Ear, 1970, is not the most popular
// film of 1970 with "ear" somewhere in it), a wrong match is put right from the film card and stays right,
// a director's filmography shows what's left to see, and search finds films and people.
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
  const filmo = await p.$eval("#dlg .filmo", (e) => e.textContent.replace(/\s+/g, " "));
  assert(/Seen 2 of 3/.test(filmo) && /Knives Out 2019\s*On your watchlist/.test(filmo) && !/Not Out Yet/.test(filmo), `filmography: ${filmo}`);

  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.keyboard.press("/"); await p.keyboard.type("rian"); await p.waitForTimeout(100);
  const found = await p.$$eval("#search-results .dr-t", (x) => x.map((t) => t.innerText));
  assert(found.includes("Rian Johnson"), `search: ${found}`);
  noErrors(p, "desktop");

  // matching: TMDB dates The Ear by its 1990 release, and its search for "The Ear" in 1970 offers other films
  const q = await open(browser, base, "mobile.html", { phone: true });
  const looked = [];
  await q.context().route(/api\.themoviedb\.org/, (r) => {
    const u = new URL(r.request().url()), json = (o) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
    const hit = (id, title, date, votes, original = title) => ({ id, title, original_title: original, release_date: date, vote_count: votes });
    if (u.pathname.startsWith("/3/movie/")) {
      const id = +u.pathname.slice(9); looked.push(String(id));
      const countries = (...n) => n.map((name) => ({ name }));
      const details = {
        88953: { production_countries: countries("Czechoslovakia"), original_language: "cs", spoken_languages: [{ iso_639_1: "cs" }] },
        42741: { production_countries: countries("France", "Italy"), original_language: "fr", spoken_languages: [{ iso_639_1: "fr" }], release_date: "1972-10-25" },
        145: { production_countries: countries("Denmark", "France", "Netherlands", "Norway", "Sweden", "Finland", "Iceland", "United Kingdom", "Italy", "Belgium", "Germany", "Switzerland", "United States of America"),
          original_language: "da", spoken_languages: [{ iso_639_1: "en" }], release_date: "1996-07-05" },
        22985: { production_countries: countries("United Kingdom"), original_language: "en", spoken_languages: [{ iso_639_1: "en" }], release_date: "1951-05-25" },
      }[id] || {};
      return json({ ...movie(id, "x", "1990-01-01", "Someone", ["Someone Else"]), ...details });
    }
    const found = { tt11564570: 661374, tt7277634: 1002, tt0066904: 1003 }[u.pathname.split("/find/")[1]];
    if (u.pathname.startsWith("/3/find/")) return json({ movie_results: found ? [{ id: found }] : [] });
    const query = u.searchParams.get("query"), year = u.searchParams.get("year");
    // TMDB's title is longer than Letterboxd's, or is one half of it; "Alien" (1979) must not become "Alien: Resurrection"
    if (query === "Wake Up Dead Man") return json({ results: [hit(812583, "Wake Up Dead Man: A Knives Out Mystery", "2025-11-26", 3000)] });
    if (query === "Special Title") return json({ results: year === "2019" ? [hit(1004, "Special Title", "2019-05-01", 40)] : [] });
    if (query === "Alien") return json({ results: year ? [] : [hit(8078, "Alien: Resurrection", "1997-11-12", 5000), hit(8077, "Alien³", "1992-05-22", 5000)] });
    if (query === "The Ear") return json({ results: year ? [hit(35002, "When Dinosaurs Ruled the Earth", "1970-10-25", 97), hit(186296, "From Ear to Ear", "1970-09-25", 9)]
      : [hit(1288220, "A Mosquito in the Ear", "2026-06-11", 2), hit(88953, "The Ear", "1990-01-01", 75, "Ucho"), hit(1276412, "The Internal Ear", "2016-07-01", 0)] });
    if (query === "Heat") return json({ results: year ? [] : [hit(949, "Heat", "1995-12-15", 9000), hit(4, "Heat", "1986-03-14", 90), hit(5, "Heat", "1972-10-06", 20)] });
    if (query === "Brick") return json({ results: [hit(9270, "Brick", "2006-03-31", 900), hit(7, "Brick", "2005-01-01", 3)] });
    if (query === "A Cop") return json({ results: year ? [] : [hit(781867, "Call a Cop", "1921-06-26", 1), hit(8, "A Cop", "1947-01-01", 2)] });
    if (query === "Breaking the Waves") return json({ results: [hit(145, "Breaking the Waves", "1996-07-05", 3000)] });
    if (query === "The Prowler") return json({ results: [hit(22985, "The Prowler", "1951-05-25", 97)] });
    json({ results: [] });
  });
  await seed(q, { profile: [{ Username: "tester" }], watched: [{ Name: "The Ear", Year: "1970" }, { Name: "Heat", Year: "1934" }, { Name: "Brick", Year: "2005" },
    { Name: "A Cop", Year: "1972" }, { Name: "Breaking the Waves", Year: "1996" }, { Name: "The Prowler", Year: "1951" },
    { Name: "Glass Onion", Year: "2022" }, { Name: "Nathan for You: Finding Frances", Year: "2017" }, { Name: "The Sorrow and the Pity", Year: "1969" },
    { Name: "Wake Up Dead Man", Year: "2025" }, { Name: "Show Name: Special Title", Year: "2019" }, { Name: "Alien", Year: "1979" }], diary: [], ratings: [] },
    { "cr-meta-v1": { "the ear|1970": { src: "tmdb", v: 3, id: 35002, d: ["Don Chaffey"], c: ["Victoria Vetri"], w: [], p: [], m: [], g: ["Adventure"], k: ["UK"], l: "English", r: 100 },
      "brick|2005": { src: "tmdb", v: 6, id: 9270, d: ["Rian Johnson"], c: ["Joseph Gordon-Levitt"], w: [], p: [], m: [], g: ["Crime"], k: ["USA"], l: "English", r: 110 },
      // films missed before matching learned half-titles: looked up again
      "wake up dead man|2025": { src: "tmdb", miss: true, v: 6 }, "the sorrow and the pity|1969": { src: "tmdb", miss: true, v: 6 } }, "cr-tmdb-key": "k123" });
  await q.waitForFunction(() => MY_LIB.films.every((f) => META[f.key] && META[f.key].v >= TMDB_MATCH_VERSION) && !needsLookup(MY_LIB, "tmdb").length && !job.running, null, { timeout: 8000 });
  const ear = await q.evaluate(() => { const s = computeStats(MY_LIB, metaOf, "all"), where = (list) => list.most.filter((x) => x.films.some((f) => f.name === "The Ear")).map((x) => x.name).join();
    return { id: META["the ear|1970"].id, country: where(s.countries), language: where(s.languages), heat: !!META["heat|1934"].miss, brick: META["brick|2005"].id };
  });
  assert(ear.id === 88953 && ear.country === "Czechoslovakia" && ear.language === "Czech", `The Ear: ${JSON.stringify(ear)}`);
  assert(ear.heat, "a 1934 film matched a Heat from decades later, though several films share that title");
  assert(ear.brick === 9270 && !looked.includes("9270"), `Brick, matched to the same film as before, was fetched again: ${looked}`);
  const more = await q.evaluate(() => ({ cop: META["a cop|1972"].id, waves: [META["breaking the waves|1996"].l, META["breaking the waves|1996"].k.length], prowler: META["the prowler|1951"].k.join(), why: META["the prowler|1951"].why }));
  assert(more.cop === 42741, `A Cop (1972) should be Melville's Un flic, not a 1947 film: ${more.cop}`);
  assert(more.waves[0] === "English" && more.waves[1] === 13, `Breaking the Waves: language ${more.waves[0]} (spoken in English), ${more.waves[1]} of 13 countries kept`);
  assert(more.prowler === "USA" && /American/.test(more.why || ""), `The Prowler's country: ${more.prowler}`);
  const halves = await q.evaluate(() => Object.fromEntries(["glass onion|2022", "nathan for you: finding frances|2017", "the sorrow and the pity|1969", "wake up dead man|2025",
    "show name: special title|2019", "alien|1979"].map((k) => [k, META[k].miss ? "miss" : `${META[k].id}${META[k].via ? ` via ${META[k].via}` : ""}`])));
  assert(JSON.stringify(halves) === JSON.stringify({ "glass onion|2022": "661374 via tt11564570", "nathan for you: finding frances|2017": "1002 via tt7277634",
    "the sorrow and the pity|1969": "1003 via tt0066904", "wake up dead man|2025": "812583", "show name: special title|2019": "1004", "alien|1979": "miss" }), `titled differently on TMDB: ${JSON.stringify(halves)}`);
  const check = await q.evaluate(() => dataCheck(MY_LIB).nomatch.map((x) => x.name).join());
  assert(check === "Alien (1979),Heat (1934)", `still without a TMDB match: ${check}`);
  noErrors(q, "phone");
}
