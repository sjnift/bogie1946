// Recent favourites (asked 6 Nov 2026): the four best rated films of the last six months, a tie going to a liked film,
// then to the four most varied (decade, genre, country, colour or black and white, English or not); each film once;
// the tab on both layouts.
import { open, assert, noErrors } from "./lib.mjs";

export default async function ({ browser, base }) {
  // the rules, on made-up films with their own details
  const d = await open(browser, base, "desktop.html");
  const r = await d.evaluate(() => {
    const M = {}, F = {};
    const film = (key, year, rating, liked, m) => { F[key] = { key, name: key, year, rating, liked, entries: [] }; M[key] = { g: [], k: [], l: "English", ...m }; return F[key]; };
    const mo = (f) => M[f.key];
    const ent = (f, date, rating = null) => { const e = { film: f, date, rating }; f.entries.push(e); return e; };
    const now = new Date(2026, 10, 6); // 6 Nov 2026
    const names = (R) => R.films.map((c) => c.f.name).join();
    // A at 5★, B at 4½★ liked, then four at 4½★ not liked for two places: C is like A and B and watched last; D is a
    // 1950s Japanese crime film in black and white; E a 1940s French western (black and white by its year); F like C
    const A = film("A", 1994, 5, false, { g: ["Drama"], k: ["USA"] }), B = film("B", 2015, 4.5, true, { g: ["Comedy"], k: ["France"], l: "French" });
    const C = film("C", 1995, 4.5, false, { g: ["Drama"], k: ["USA"] }), D = film("D", 1954, 4.5, false, { g: ["Crime"], k: ["Japan"], l: "Japanese", bw: 1 });
    const E = film("E", 1946, 4.5, false, { g: ["Western"], k: ["France"], l: "French", bw: 0 }), G = film("G", 1996, 4.5, false, { g: ["Drama"], k: ["USA"] });
    const H = film("H", 2001, 5, false, { g: ["Drama"], k: ["USA"] }), U = film("U", 2002, null, false, {}), L = film("L", 2003, null, true, { g: ["Horror"], k: ["UK"] });
    const es = [ent(H, "2026-04-01", 5), ent(A, "2026-06-01", 5), ent(A, "2026-10-01", 5), ent(B, "2026-07-01"), ent(D, "2026-08-01"), ent(E, "2026-08-02"), ent(G, "2026-09-01"), ent(C, "2026-11-05"), ent(U, "2026-10-10"), ent(L, "2026-10-11")];
    const R = recentFavs(es, "all", mo, now);
    // liked beats a higher place in the diary: two at 4½★, one liked
    const P = film("P", 1980, 4.5, false, {}), Q = film("Q", 1981, 4.5, true, {});
    const liked = recentFavs([ent(P, "2026-10-01"), ent(Q, "2026-09-01")], "all", mo, now);
    // a liked film with no rating comes after every rated one, and only then
    const few = recentFavs([ent(L, "2026-10-11"), ent(U, "2026-10-12"), ent(P, "2026-10-01")], "all", mo, now);
    // colour: TMDB's mark, else by the year; 1935–66 unmarked is not known
    const col = [colourOf({ year: 1930 }, {}), colourOf({ year: 1950 }, { bw: 1 }), colourOf({ year: 1950 }, { bw: 0 }), colourOf({ year: 1940 }, { g: ["Animation"] }), colourOf({ year: 1970 }, {}), colourOf({ year: 2020 }, { bw: 1 })].join();
    // a past year: its last six months; this year in February: from 1 January
    const w1 = favWindow("2024", now), w2 = favWindow("2026", new Date(2026, 1, 10)), w3 = favWindow("all", now);
    // a big tie takes the quick way and still picks four different films
    const many = Array.from({ length: 40 }, (_, i) => film(`T${i}`, 1930 + i * 2, 4, false, { g: [["Drama", "Comedy", "Horror"][i % 3]], k: [["USA", "India", "Japan", "Iran"][i % 4]] }));
    const big = recentFavs(many.map((f, i) => ent(f, `2026-0${5 + (i % 5)}-1${i % 10}`)), "all", mo, now);
    return { top: names(R), tie: R.tie, rated: R.rated, watched: R.watched, last: R.films[0].last, line: favsLine(R), liked: names(liked), few: names(few), col,
      w: [w1.start, w1.end, w2.start, w2.end, w3.start, w3.end].join(), big: new Set(big.films.map((c) => c.f.key)).size, bigTie: big.tie && big.tie.n };
  });
  // H was watched before 6 May: out; A twice: once, with its latest date; U (no rating, not liked) out; C and G, like A,
  // lose the tie to D and E; the tie's two in the order watched, latest first
  assert(r.top === "A,B,E,D" && r.last === "2026-10-01" && r.watched === 8 && r.rated === 7, `the four: ${JSON.stringify(r)}`);
  assert(r.tie && r.tie.n === 4 && r.tie.places === 2 && r.tie.rating === 4.5 && !r.tie.liked && /Four films tied at 4½★ for the last two/.test(r.line), `the tie: ${JSON.stringify(r)}`);
  assert(r.liked === "Q,P", `liked first: ${r.liked}`);
  assert(r.few === "P,L", `a liked film with no rating after the rated: ${r.few}`);
  assert(r.col === "bw,bw,,colour,colour,bw", `colour or black and white: ${r.col}`);
  assert(r.w === "2024-07-01,2024-12-31,2026-01-01,2026-02-10,2026-05-06,2026-11-06", `the six months: ${r.w}`);
  assert(r.big === 4 && r.bigTie === 40, `a big tie: ${r.big} films, ${r.bigTie} tied`);
  noErrors(d, "desktop rules");

  // the tab on both layouts: the same four as the engine, each opening its film card
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = phone ? await open(browser, base, file, { phone }) : d;
    await p.click(phone ? '[data-recentby="fav"]' : '#recent [data-tab="recent"][data-val="fav"]');
    await p.waitForTimeout(150);
    const got = await p.evaluate((phone) => {
      const R = recentFavs(phone ? computeStats(state.lib, metaOf, "all").entries : STATS.entries, "all");
      const box = document.querySelector(phone ? ".pgrid.favs" : "#recent .posters.favs");
      return { want: R.films.map((c) => c.f.name), shown: box ? [...box.querySelectorAll(phone ? ".pitem" : ".poster")].map((b) => (b.getAttribute("title") || b.querySelector(".art").getAttribute("title")).replace(/ \(\d{4}\)$/, "")) : [],
        note: (document.querySelector(phone ? ".favs-note" : "#recent .hint") || {}).textContent || "" };
    }, phone);
    assert(got.want.length === 4 && got.shown.join("|") === got.want.join("|") && /Ties go to a film you liked/.test(got.note), `${file}: the favourites shown: ${JSON.stringify(got)}`);
    await p.click(phone ? ".pgrid.favs .pitem" : "#recent .posters.favs .poster");
    const panel = phone ? "#sheet" : "#dlg";
    await p.waitForSelector(`${panel} .fc-entry.on`);
    const card = await p.evaluate((panel) => document.querySelector(panel).textContent, panel);
    assert(card.includes(got.want[0]), `${file}: a favourite opens its film card, on its viewing: ${card.slice(0, 120)}`);
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    await p.click(phone ? '[data-recentby="recent"]' : '#recent [data-tab="recent"][data-val="recent"]');
    await p.waitForTimeout(150);
    const back = await p.evaluate((phone) => !!document.querySelector(phone ? ".scroller .pitem" : "#recent .posters:not(.favs) .poster") && !document.querySelector(phone ? ".pgrid.favs" : "#recent .posters.favs"), phone);
    assert(back, `${file}: back to recently watched`);
    noErrors(p, file);
  }
}
