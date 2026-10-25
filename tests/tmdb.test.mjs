// Against a stand-in TMDB: a film only matches a film with its title (The Ear, 1970, is not the most popular
// film of 1970 with "ear" somewhere in it), a wrong match is put right from the film card and stays right,
// a director's filmography shows what's left to see, and search finds films and people.
import { open, seed, assert, noErrors } from "./lib.mjs";

const movie = (id, title, date, dir, cast) => ({ id, title, release_date: date, poster_path: null, genres: [{ name: "Crime" }], production_countries: [{ name: "United States of America" }],
  original_language: "en", runtime: 110, vote_average: 7.5, vote_count: 9000, imdb_id: "tt0393109", credits: { cast: cast.map((name, order) => ({ name, order, character: `Role ${order + 1}` })), crew: [{ name: dir, job: "Director" }] } });

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
  const looked = [], searched = [];
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
        // as Letterboxd counts a cast: every credited role however far down, not cameos (uncredited, or no character)
        5001: { release_date: "2001-01-01", credits: { crew: [{ name: "Big Director", job: "Director" }], cast: [
          ...Array.from({ length: 16 }, (_, i) => ({ name: `Lead ${i + 1}`, order: i, character: `Role ${i + 1}`, profile_path: `/l${i + 1}.jpg` })),
          { name: "Party Extra", order: 16, character: "Party Guest (uncredited)" }, { name: "Walk On", order: 17, character: "" },
          { name: "Familiar Face", order: 18, character: "Barman", profile_path: "/ff.jpg" }, { name: "김청아", order: 19, character: "Shop Owner" },
          { name: "Voice Player", order: 20, character: "Additional Voices (voice)" },
          // a fine line: an extended cameo or special appearance that names its character is a part; a bare one isn't
          { name: "Extended Star", order: 21, character: "Tiger (Extended Cameo)" }, { name: "Song Guest", order: 22, character: 'Special Appearance in "Maahi Ve" Song' },
          { name: "Archive Face", order: 23, character: "Self (archive footage)" }, { name: "Cameo Star", order: 24, character: "Cameo Appearance" },
          { name: "Named Guest", order: 25, character: "Rohit (Special Appearance)" }, { name: "Cut Player", order: 26, character: "Sentry (deleted scene)" }] } },
        5002: { release_date: "2000-01-01" },
      }[id] || {};
      return json({ ...movie(id, "x", "1990-01-01", "Someone", ["Someone Else"]), ...details });
    }
    // as TMDB answers: Glass Onion is a film; The Sorrow and the Pity a two-part TV programme; Finding Frances an episode
    const find = { tt11564570: { movie_results: [{ id: 661374 }] }, tt0066904: { tv_results: [{ id: 128062 }] },
      tt7277634: { tv_episode_results: [{ id: 1388583, show_id: 58957, season_number: 4, episode_number: 7 }] } }[u.pathname.split("/find/")[1]];
    if (u.pathname.startsWith("/3/find/")) return json({ movie_results: [], tv_results: [], tv_episode_results: [], ...find });
    const person = (name, extra) => ({ name, profile_path: null, ...extra });
    const tv = {
      "/3/tv/128062": { id: 128062, name: "The Sorrow and the Pity", first_air_date: "1969-09-18", poster_path: "/sorrow.jpg", vote_average: 7.9, vote_count: 23,
        genres: [{ name: "Documentary" }, { name: "War & Politics" }], production_countries: [{ name: "Germany" }, { name: "Switzerland" }],
        original_language: "fr", spoken_languages: [{ iso_639_1: "en" }, { iso_639_1: "fr" }, { iso_639_1: "de" }], seasons: [{ season_number: 1, poster_path: "/s1.jpg" }],
        external_ids: { imdb_id: "tt0066904" }, aggregate_credits: { cast: [person("Marcel Ophüls", { order: 0, roles: [{ character: "Self - Interviewer" }] }), person("André Harris", { order: 1, roles: [{ character: "Self" }] })],
          crew: [person("Marcel Ophüls", { jobs: [{ job: "Director" }, { job: "Writer" }] }), person("André Gazut", { jobs: [{ job: "Director of Photography" }] })] } },
      "/3/tv/128062/season/1": { episodes: [{ runtime: 122 }, { runtime: 128 }] },
      "/3/tv/58957": { id: 58957, name: "Nathan for You", poster_path: "/nathan.jpg", genres: [{ name: "Comedy" }, { name: "Documentary" }],
        production_countries: [{ name: "United States of America" }], original_language: "en", spoken_languages: [{ iso_639_1: "en" }],
        seasons: [{ season_number: 0, poster_path: "/s0.jpg" }, { season_number: 4, poster_path: "/s4.jpg" }] },
      "/3/tv/58957/season/4/episode/7": { name: "Finding Frances", air_date: "2017-11-09", runtime: 84, vote_average: 9.4, vote_count: 17, crew: [person("Jakob Skrzypa", { job: "Production Assistant" })],
        guest_stars: [person("William Heath", { order: 500, character: "Self" })], credits: { cast: [person("Nathan Fielder", { order: 0, character: "Self" })] }, external_ids: { imdb_id: "tt7277634" } },
    }[u.pathname];
    if (u.pathname.startsWith("/3/tv/")) return tv ? json(tv) : r.fulfill({ status: 404, body: "{}" });
    const query = u.searchParams.get("query"), year = u.searchParams.get("year");
    if (u.pathname === "/3/search/movie") searched.push(query);
    if (query === "Big Cast") return json({ results: [hit(5001, "Big Cast", "2001-01-01", 500)] });
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
    { Name: "Wake Up Dead Man", Year: "2025" }, { Name: "Show Name: Special Title", Year: "2019" }, { Name: "Alien", Year: "1979" },
    { Name: "Big Cast", Year: "2001" }, { Name: "Kept Film", Year: "2003" }, { Name: "Pinned Film", Year: "2000" }], diary: [], ratings: [] },
    { "cr-meta-v1": { "the ear|1970": { src: "tmdb", v: 3, id: 35002, d: ["Don Chaffey"], c: ["Victoria Vetri"], w: [], p: [], m: [], g: ["Adventure"], k: ["UK"], l: "English", r: 100 },
      "brick|2005": { src: "tmdb", v: 6, id: 9270, d: ["Rian Johnson"], c: ["Joseph Gordon-Levitt"], w: [], p: [], m: [], g: ["Crime"], k: ["USA"], l: "English", r: 110 },
      // details as they're kept now, so not looked up; and a film matched by hand before the whole cast was kept
      "kept film|2003": { src: "tmdb", v: 8, id: 5003, d: ["Someone"], c: ["Familiar Face"], w: [], p: [], m: [], g: ["Drama"], k: ["USA"], l: "English", r: 90 },
      "pinned film|2000": { src: "tmdb", v: 6, id: 5002, pin: true, d: ["Old Name"], c: [], w: [], p: [], m: [], g: ["Drama"], k: ["USA"], l: "English", r: 90 },
      // films missed before matching learned half-titles: looked up again
      "wake up dead man|2025": { src: "tmdb", miss: true, v: 6 }, "the sorrow and the pity|1969": { src: "tmdb", miss: true, v: 6 },
      // missed while only TMDB's films were looked at, as the owner's devices had it (Oct 2026): looked up again
      "nathan for you: finding frances|2017": { src: "tmdb", miss: true, v: 7, via: "tt7277634" } }, "cr-tmdb-key": "k123" });
  await q.waitForFunction(() => MY_LIB.films.every((f) => META[f.key] && META[f.key].v >= TMDB_MATCH_VERSION) && !needsLookup(MY_LIB, "tmdb").length && !job.running, null, { timeout: 8000 });
  const ear = await q.evaluate(() => { const s = computeStats(MY_LIB, metaOf, "all"), where = (list) => list.most.filter((x) => x.films.some((f) => f.name === "The Ear")).map((x) => x.name).join();
    return { id: META["the ear|1970"].id, country: where(s.countries), language: where(s.languages), heat: !!META["heat|1934"].miss, brick: META["brick|2005"].id };
  });
  assert(ear.id === 88953 && ear.country === "Czechoslovakia" && ear.language === "Czech", `The Ear: ${JSON.stringify(ear)}`);
  assert(ear.heat, "a 1934 film matched a Heat from decades later, though several films share that title");
  // matched before the whole cast was kept: read again by its id, once, without searching for it again
  assert(ear.brick === 9270 && looked.filter((x) => x === "9270").length === 1 && !searched.includes("Brick"), `Brick, matched to the same film as before: details ${looked}, searched ${searched}`);
  const cast = await q.evaluate(() => { const m = META["big cast|2001"], pin = META["pinned film|2000"], s = computeStats(MY_LIB, metaOf, "all");
    return { c: m.c.join(), photos: ["lead 1", "lead 16", "familiar face"].map((k) => PHOTOS[k] || "-").join(), pin: [pin.pin, pin.v, pin.d.join()].join(),
      korean: s.cast.most.filter((p) => p.name === "김청아").length, face: (s.cast.most.find((p) => p.name === "Familiar Face") || {}).count };
  });
  assert(cast.c === [...Array.from({ length: 16 }, (_, i) => `Lead ${i + 1}`), "Familiar Face", "김청아", "Voice Player", "Extended Star", "Named Guest"].join(), `the credited cast: ${cast.c}`);
  assert(cast.photos === "/l1.jpg,-,/ff.jpg", `photos kept for the top billed and people met before, not every one-off player: ${cast.photos}`);
  assert(cast.pin === "true,8,Someone" && !searched.includes("Pinned Film") && looked.includes("5002"), `a film matched by hand, read again at its place: ${cast.pin}`);
  assert(cast.korean === 1 && cast.face === 2, `people counted: a name in Korean ${cast.korean}, someone in two films ${cast.face}`);
  const more = await q.evaluate(() => ({ cop: META["a cop|1972"].id, waves: [META["breaking the waves|1996"].l, META["breaking the waves|1996"].k.length], prowler: META["the prowler|1951"].k.join(), why: META["the prowler|1951"].why }));
  assert(more.cop === 42741, `A Cop (1972) should be Melville's Un flic, not a 1947 film: ${more.cop}`);
  assert(more.waves[0] === "English" && more.waves[1] === 13, `Breaking the Waves: language ${more.waves[0]} (spoken in English), ${more.waves[1]} of 13 countries kept`);
  assert(more.prowler === "USA" && /American/.test(more.why || ""), `The Prowler's country: ${more.prowler}`);
  const halves = await q.evaluate(() => Object.fromEntries(["glass onion|2022", "nathan for you: finding frances|2017", "the sorrow and the pity|1969", "wake up dead man|2025",
    "show name: special title|2019", "alien|1979"].map((k) => { const m = META[k];
      return [k, m.miss ? "miss" : `${m.tv ? `tv ${m.tv}${m.ep ? `/${m.se}/${m.ep}` : ""}` : m.id}${m.via ? ` via ${m.via}` : ""}`]; })));
  assert(JSON.stringify(halves) === JSON.stringify({ "glass onion|2022": "661374 via tt11564570", "nathan for you: finding frances|2017": "tv 58957/4/7 via tt7277634",
    "the sorrow and the pity|1969": "tv 128062 via tt0066904", "wake up dead man|2025": "812583", "show name: special title|2019": "1004", "alien|1979": "miss" }), `titled differently on TMDB: ${JSON.stringify(halves)}`);
  // what TMDB's TV side gives: the programme's director, cast and length added up; the episode's cast and guests, its
  // season's poster, the show's genres and country; and the links go to those TV pages
  const onTv = await q.evaluate(() => Object.fromEntries(["the sorrow and the pity|1969", "nathan for you: finding frances|2017"].map((k) => { const m = META[k];
    return [k, [m.d.join(), m.c.join(), m.r, m.l, m.g.join(), m.k.join(), m.poster, m.im, m.y, tmdbHref(m)].join(" | ")]; })));
  assert(onTv["the sorrow and the pity|1969"] === "Marcel Ophüls | Marcel Ophüls,André Harris | 250 | French | Documentary,War | Germany,Switzerland | /sorrow.jpg | tt0066904 | 1969 | https://www.themoviedb.org/tv/128062"
    && onTv["nathan for you: finding frances|2017"] === " | Nathan Fielder,William Heath | 84 | English | Comedy,Documentary | USA | /s4.jpg | tt7277634 | 2017 | https://www.themoviedb.org/tv/58957/season/4/episode/7",
    `films TMDB has as TV: ${JSON.stringify(onTv)}`);
  const check = await q.evaluate(() => dataCheck(MY_LIB).nomatch.map((x) => x.name).join());
  assert(check === "Alien (1979),Heat (1934)", `still without a TMDB match: ${check}`);
  noErrors(q, "phone");
}
