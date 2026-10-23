// Nothing is counted twice. For every period of every page, on both layouts, the totals add up and every
// list a click can open (films, diary entries, people, genres, groups) holds each film or entry once.
// Then the same over an export written to trip it: one film spelled four ways, titles in other scripts,
// a cast list naming someone twice, a watched film still on the watchlist, and a feed overlapping the export.
import { open, seed, assert, noErrors } from "./lib.mjs";

// Runs in the page: every rule broken anywhere, as text.
function audit() {
  const bad = [];
  const once = (items, keyOf, where) => {
    const seen = new Set();
    for (const x of items) { const k = keyOf(x); if (seen.has(k)) { bad.push(`${where}: ${k} twice`); return; } seen.add(k); }
  };
  const film = (f) => titleKey(f.name, f.year);
  const walk = (d, where) => {
    if (!d) return;
    const w = `${where} › ${d.title || d.kind}`;
    if (d.kind === "films") once(d.films, film, w);
    if (d.kind === "entries") { once(d.entries, (e) => e, w); once(d.entries, (e) => `${film(e.film)} on ${e.date} #${e.order}`, w); }
    if (d.kind === "reviews") once(d.reviews, (r) => r, w);
    if (d.kind === "names") { once(d.items, (p) => p.name, w); for (const p of d.items) if (p.films) once(p.films, film, `${w} › ${p.name}`); }
    if (d.kind === "groups") for (const g of d.groups) walk(g, w);
  };
  for (const d of LISTS.values()) walk(d, location.hash);
  const lib = state.lib;
  once(lib.films, film, "library");
  once(lib.entries, (e) => e, "diary");
  for (const scope of ["all", ...new Set(lib.entries.map((e) => e.date.slice(0, 4)))]) {
    const s = computeStats(lib, metaOf, scope), w = `stats ${scope}`;
    once(s.films, film, w);
    const sum = (a) => a.reduce((t, x) => t + x, 0);
    if (sum(s.weekday) !== s.entries.length) bad.push(`${w}: weekdays add up to ${sum(s.weekday)}, not ${s.entries.length}`);
    if (sum([...s.byDay.values()]) !== s.entries.length) bad.push(`${w}: days add up wrong`);
    if (sum(s.spread.map((x) => x.count)) !== s.rated) bad.push(`${w}: ratings add up wrong`);
    if (sum(s.decades.map((x) => x.count)) !== s.films.filter((f) => f.year).length) bad.push(`${w}: decades add up wrong`);
    for (const [k, data] of [["cast", s.cast], ["directors", s.directors], ["writers", s.writers], ["genres", s.genres], ["countries", s.countries], ["languages", s.languages]])
      for (const p of data.most) { once(p.films, film, `${w} ${k} ${p.name}`); if (p.count !== p.films.length) bad.push(`${w} ${k} ${p.name}: count ${p.count} for ${p.films.length} films`); }
  }
  return bad;
}
const check = async (page, where) => {
  const bad = await page.evaluate(`(${audit})()`);
  assert(!bad.length, `${where}: ${bad.slice(0, 3).join("; ")}${bad.length > 3 ? ` (and ${bad.length - 3} more)` : ""}`);
};
// Opens every page and period, auditing each.
async function tour(d, m, label) {
  await check(d, `${label} desktop stats`);
  for (const y of await d.$$eval("#scopes [data-scope]", (x) => x.map((b) => b.dataset.scope))) { await d.click(`[data-scope="${y}"]`); await check(d, `${label} desktop stats ${y}`); }
  await d.click("#btn-insights");
  for (const y of await d.$$eval("#scopes [data-insyear]", (x) => x.map((b) => b.dataset.insyear))) { await d.click(`[data-insyear="${y}"]`); await check(d, `${label} desktop insights ${y}`); }
  await d.click("#btn-compare"); await check(d, `${label} desktop compare`);
  for (const view of ["profile", "people", "diary", "films"]) { await m.click(`.tabbar [data-view="${view}"]`); await check(m, `${label} phone ${view}`); }
  await m.click('.tabbar [data-view="profile"]'); await m.click('#nav-right [data-act="insights"]'); await check(m, `${label} phone insights`);
  noErrors(d, `${label} desktop`); noErrors(m, `${label} phone`);
}

export default async function ({ browser, base }) {
  await tour(await open(browser, base, "desktop.html"), await open(browser, base, "mobile.html", { phone: true }), "example");

  const rows = {
    profile: [{ Username: "tester" }],
    watched: [{ Name: "Twilight’s Last Gleaming", Year: "1977", Date: "2026-01-01" }, { Name: "Twilight's Last Gleaming", Year: "1977", Date: "2026-01-01" },
      { Name: "七人の侍", Year: "1954", Date: "2026-01-01" }, { Name: "生きる", Year: "1952", Date: "2026-01-01" }, { Name: "Seven Samurai", Year: "1954", Date: "2026-01-01" }],
    diary: [{ Name: "Twilight&#039;s Last Gleaming", Year: "1977", Date: "2026-10-02", "Watched Date": "2026-10-02", Rating: "3.5" },
      { Name: "七人の侍", Year: "1954", Date: "2026-09-01", "Watched Date": "2026-09-01", Rating: "5" }],
    ratings: [{ Name: "TWILIGHT'S LAST GLEAMING", Year: "1977", Rating: "3.5" }],
    likes: [{ Name: "twilight’s last gleaming", Year: "1977" }],
    reviews: [{ Name: "Twilight's Last Gleaming", Year: "1977", Date: "2026-10-02", "Watched Date": "2026-10-02", Rating: "3.5", Review: "<p>Tense.</p>" }],
    watchlist: [{ Name: "Twilight’s Last Gleaming", Year: "1977" }, { Name: "Ikiru", Year: "1952" }],
  };
  const meta = { "twilight’s last gleaming|1977": { src: "tmdb", v: 3, id: 75938, d: ["Robert Aldrich"], c: ["Burt Lancaster", "Charles McGraw", "Charles McGraw"], w: [], p: [], m: [], g: ["Thriller", "Thriller"], k: ["USA"], l: "English", r: 146 } };
  const feed = { user: "tester", items: [
    { guid: "letterboxd-watch-1", title: "Twilight&#039;s Last Gleaming", year: 1977, watched: "2026-10-02", logged: "2026-10-02", rating: 3.5, rewatch: false, liked: true, tmdb: 75938, review: "" },
    { guid: "letterboxd-watch-2", title: "七人の侍", year: 1954, watched: "2026-08-30", logged: "2026-09-01", rating: 5, rewatch: false, liked: false, tmdb: 346, review: "" }, // date changed since: same viewing
    { guid: "letterboxd-review-3", title: "Twilight’s Last Gleaming", year: 1977, watched: "2026-10-21", logged: "2026-10-21", rating: 4, rewatch: true, liked: true, tmdb: 75938, review: "<p>Better again.</p>" },
  ] };
  const pages = [];
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    await p.context().route(/\/feed\/tester\.json/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(feed) }));
    await seed(p, rows, { "cr-meta-v1": meta });
    await p.waitForFunction(() => FEED);
    const got = await p.evaluate(() => {
      const t = MY_LIB.films.find((f) => f.year === 1977), s = computeStats(MY_LIB, metaOf, "all");
      return { films: MY_LIB.films.length, twilight: t.entries.length, rating: t.rating, liked: t.liked, reviews: MY_LIB.reviews.length,
        mcgraw: s.cast.most.find((p) => p.name === "Charles McGraw").count, thriller: s.genres.most.find((g) => g.name === "Thriller").count,
        watchlist: MY_LIB.watchlistFilms.map((w) => w.name).join(), next: (watchNext(MY_LIB) || { picks: [] }).picks.map((p) => p.f.name).join() };
    });
    assert(got.films === 4, `${file}: ${got.films} films, not 4 (one film spelled four ways, or two titles in other scripts merged)`);
    assert(got.twilight === 2 && got.rating === 3.5 && got.liked && got.reviews === 2, `${file}: Twilight's Last Gleaming ${JSON.stringify(got)}`);
    assert(got.mcgraw === 1 && got.thriller === 1, `${file}: a name or genre listed twice in one film counted twice: ${JSON.stringify(got)}`);
    assert(got.watchlist === "Ikiru" && !got.next.includes("Twilight"), `${file}: a watched film is still to watch next: ${got.watchlist}`);
    pages.push(p);
  }
  await tour(pages[0], pages[1], "tricky export");
}
