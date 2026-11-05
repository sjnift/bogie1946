// Films on your lists you haven't seen get their posters and details from TMDB (asked 6 Nov 2026), kept apart from the
// diary's films: their posters show on the list's card and in the list, the film card has its director, and nothing in
// the stats counts them; both layouts.
import { open, seed, assert, noErrors, until } from "./lib.mjs";

const rows = { profile: [{ Username: "tester" }], watched: [{ Name: "Heat", Year: "1995", Date: "2024-01-01" }],
  diary: [{ Name: "Heat", Year: "1995", Date: "2024-01-02", "Watched Date": "2024-01-02", Rating: "4" }], ratings: [{ Name: "Heat", Year: "1995", Rating: "4" }],
  likes: [], reviews: [], watchlist: [],
  lists: [{ name: "Thrillers", date: "2025-01-01", tags: "", url: "", desc: "", films: [[1, "Rope", "1948", "https://boxd.it/abcd", "Long takes"], [2, "Heat", "1995", "", ""]] }] };
const META = { "heat|1995": { src: "tmdb", v: 15, id: 949, y: 1995, d: ["Michael Mann"], di: [1], c: ["Al Pacino"], ci: [2], w: [], wi: [], p: [], pi: [], m: [], mi: [], g: ["Crime"], k: ["USA"], l: "English", r: 170, poster: "/heat.jpg" } };
const ROPE = { id: 1580, title: "Rope", release_date: "1948-08-26", poster_path: "/rope.jpg", runtime: 80, vote_average: 7.9, vote_count: 3000, imdb_id: "tt0040746", original_language: "en",
  genres: [{ name: "Thriller" }], production_countries: [{ name: "United States of America" }], production_companies: [], spoken_languages: [{ english_name: "English", iso_639_1: "en" }],
  credits: { cast: Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: i ? `Player ${i}` : "James Stewart", order: i, character: `Part ${i}`, gender: 2, profile_path: `/f${i}.jpg` })),
    crew: [{ id: 2636, name: "Alfred Hitchcock", job: "Director", profile_path: "/hitch.jpg" }] } };

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone, example: false });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await p.context().route(/image\.tmdb\.org/, (r) => r.fulfill({ contentType: "image/png", body: png }));
    await p.context().route(/api\.themoviedb\.org/, (r) => {
      const u = new URL(r.request().url()), json = (o) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
      if (u.pathname === "/3/search/movie" && /rope/i.test(u.searchParams.get("query") || "")) return json({ results: [{ id: 1580, title: "Rope", original_title: "Rope", release_date: "1948-08-26", poster_path: "/rope.jpg", vote_count: 3000, popularity: 20 }] });
      if (u.pathname === "/3/movie/1580") return json(ROPE);
      json({ results: [], cast: [], crew: [] });
    });
    await seed(p, rows, { "cr-meta-v1": META, "cr-tmdb-key": "k123" });
    await until(p, () => { const m = LMETA()["rope|1948"]; return m && m.poster; }, "Rope looked up for its list", null, 10000);
    const got = await p.evaluate(() => { const f = MY_LIB.lists[0].items[0].f, m = LMETA()[f.key], s = computeStats(MY_LIB, metaOf, "all");
      return { listed: !!f.listed, poster: metaOf(f) && metaOf(f).poster, inMeta: !!META[f.key], cast: m.c.length, d: m.d.join(), photo: !!PHOTOS[personKey("Alfred Hitchcock")],
        dirs: s.directors.most.map((x) => x.name).join(), films: MY_LIB.films.length, saved: !!(store.get(KEYS.lmeta, {}) || {})["rope|1948"] }; });
    assert(got.listed && got.poster === "/rope.jpg" && !got.inMeta && got.cast === 8 && got.d === "Alfred Hitchcock" && !got.photo && got.dirs === "Michael Mann" && got.films === 1 && got.saved,
      `${file}: a list's film looked up apart from the diary: ${JSON.stringify(got)}`);
    // its poster on the list's card (desktop: the Lists chapter; phone: Profile's Lists row), and the film card
    if (!phone) await p.click('#jump [data-chapter="lists"]');
    await until(p, (phone) => [...document.querySelectorAll(phone ? ".scroller.lists .lcard img" : "#lists .lcard img")].some((i) => /rope\.jpg/.test(i.src)), "Rope's poster on the list's card", phone, 20000);
    await p.click(phone ? ".scroller.lists .lcard" : "#lists .lmain");
    await p.waitForSelector(`${phone ? "#sheet" : "#dlg"} .drill-row`);
    await p.click(`${phone ? "#sheet" : "#dlg"} .drill-row`);
    await until(p, (phone) => /Alfred Hitchcock/.test(document.querySelector(phone ? "#sheet" : "#dlg").textContent), "the director on Rope's card", phone);
    noErrors(p, file);
  }
}
