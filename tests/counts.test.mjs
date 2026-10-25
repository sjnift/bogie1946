// Nothing is counted twice. For every period of every page, on both layouts, the totals add up and every
// list a click can open (films, diary entries, people, genres, groups) holds each film or entry once; with filters on,
// everything behind every list passes them.
// Then the same over an export written to trip it: one film spelled four ways, titles in other scripts,
// a cast list naming someone twice, a watched film still on the watchlist, and a feed overlapping the export.
import { open, seed, assert, noErrors, phoneTour } from "./lib.mjs";

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
    // month by month: every month of the grid adds up to the period's diary, and so do the calendar months
    const G = monthGrid(lib, metaOf, scope === "all" ? null : scope);
    if (G) {
      const cells = sum(G.rows.flatMap((r) => r.months.map((m) => m.E.length))), cal = sum(G.cal.map((c) => c.E.length));
      if (cells !== s.entries.length || cal !== s.entries.length) bad.push(`${w}: months add up to ${cells} and ${cal}, not ${s.entries.length}`);
      for (const r of G.rows) once(r.E, (e) => e, `${w} months ${r.year}`);
    }
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
  await phoneTour(m, (where) => check(m, `${label} phone ${where}`));
  for (const y of await m.$$eval("#scopes [data-scope]", (x) => x.map((b) => b.dataset.scope))) { await m.click(`[data-scope="${y}"]`); await check(m, `${label} phone profile ${y}`); }
  await m.click('[data-scope="all"]');
  noErrors(d, `${label} desktop`); noErrors(m, `${label} phone`);
}

// Runs in the page, with filters on: every film behind every list passes them, and the filtered diary is exactly the
// films that pass (so nothing is lost or counted outside the filter).
function auditFilter() {
  const bad = [], ok = (f) => filmPasses(f, metaOf);
  const walk = (d) => {
    if (!d) return;
    if (d.kind === "films") for (const f of d.films) if (!ok(f)) bad.push(`${d.title}: ${f.name} doesn't pass the filters`);
    if (d.kind === "entries") for (const e of d.entries) if (!ok(e.film)) bad.push(`${d.title}: ${e.film.name} doesn't pass the filters`);
    if (d.kind === "names") for (const p of d.items) for (const f of p.films || []) if (!ok(f)) bad.push(`${d.title} › ${p.name}: ${f.name} doesn't pass the filters`);
    if (d.kind === "groups") d.groups.forEach(walk);
  };
  for (const d of LISTS.values()) walk(d);
  const whole = state.mode === "mine" ? MY_LIB : EXAMPLE_LIB, want = whole.films.filter(ok);
  if (!state.lib.filtered || state.lib.films.length !== want.length) bad.push(`the filtered diary has ${state.lib.films.length} films, not ${want.length}`);
  if (state.lib.entries.length !== whole.entries.filter((e) => ok(e.film)).length) bad.push("the filtered diary's entries don't match its films");
  return bad;
}
// The commonest genre and decade, picked from the menus, on both layouts: every page they narrow, every period.
async function filteredTour(d, m) {
  // the Filter button (the computer's bar at the top, the phone's top bar), then the first genre and decade in its panel
  const pickFilters = async (p, phone) => {
    await p.click(phone ? ".nav-btn.filt" : ".jump-filter");
    await p.waitForSelector(".fpanel [data-fpick]");
    for (const k of ["g", "d"]) { await p.click(`.fpanel [data-fpick="${k}"]`); await p.waitForTimeout(80); }
    await p.click(phone ? ".fp-foot [data-sclose]" : ".fp-foot [data-close]");
    await p.waitForTimeout(150);
    return p.evaluate(() => ({ g: FILTER.g.length, d: FILTER.d.length, strip: !!document.querySelector(".fstrip") }));
  };
  const both = async (p, where) => { await check(p, where); const bad = await p.evaluate(`(${auditFilter})()`); assert(!bad.length, `${where}: ${bad.slice(0, 3).join("; ")}`); };
  const f = await pickFilters(d, false);
  assert(f.g && f.d && f.strip, `the computer's filter panel didn't set a filter: ${JSON.stringify(f)}`);
  for (const y of await d.$$eval("#scopes [data-scope]", (x) => x.map((b) => b.dataset.scope))) { await d.click(`[data-scope="${y}"]`); await both(d, `filtered desktop stats ${y}`); }
  await d.click('[data-scope="all"]');
  // a second genre: films with either, then films with both
  for (const mode of ["any", "all"]) {
    await d.click(".fstrip .fstrip-edit"); await d.waitForSelector(".fpanel [data-fpick]");
    if (mode === "any") await d.click('.fpanel [data-fpick="g"][aria-pressed="false"]');
    else await d.click('.fpanel [data-fmode="g"][data-fval="all"]');
    await d.waitForTimeout(80);
    await d.click(".fp-foot [data-close]"); await d.waitForTimeout(150);
    const t = await d.evaluate(() => ({ n: FILTER.g.length, all: groupAll("g"), text: filterText() }));
    assert(t.n === 2 && t.all === (mode === "all") && t.text.includes(mode === "all" ? " and " : " or "), `two genres (${mode}): ${JSON.stringify(t)}`);
    for (const y of ["all", (await d.$$eval("#scopes [data-scope]", (x) => x.map((b) => b.dataset.scope)))[1]]) { await d.click(`[data-scope="${y}"]`); await both(d, `two genres (${mode}) desktop ${y}`); }
    await d.click('[data-scope="all"]');
  }
  await d.click("#btn-insights");
  assert(await d.evaluate(() => !state.lib.filtered), "Insights used the filtered diary");
  await d.click("#btn-insights");
  await d.click(".fstrip [data-filter-clear]"); await d.waitForTimeout(150);
  assert(await d.evaluate(() => !filterOn() && !state.lib.filtered && !document.querySelector(".fstrip") && document.querySelector(".jump-filter")), "clearing the filters didn't bring the whole diary back");
  await m.evaluate(() => goTo("films", { force: true, top: true }));
  const fm = await pickFilters(m, true);
  assert(fm.g && fm.d && fm.strip, `the phone's filter panel didn't set a filter: ${JSON.stringify(fm)}`);
  for (const v of ["profile", "diary", "films", "people", "genres", "years", "crowd"]) { await m.evaluate((v) => goTo(v, { force: true, top: true }), v); await both(m, `filtered phone ${v}`); }
  await m.evaluate(() => goTo("insights", { force: true, top: true }));
  assert(await m.evaluate(() => !state.lib.filtered), "the phone's Insights used the filtered diary");
  await m.evaluate(() => goTo("films", { force: true, top: true }));
  await m.click(".fstrip [data-filter-clear]"); await m.waitForTimeout(150);
  assert(await m.evaluate(() => !filterOn() && !state.lib.filtered), "the phone's clear didn't bring the whole diary back");
  noErrors(d, "filtered desktop"); noErrors(m, "filtered phone");
}

export default async function ({ browser, base }) {
  await tour(await open(browser, base, "desktop.html"), await open(browser, base, "mobile.html", { phone: true }), "example");
  await filteredTour(await open(browser, base, "desktop.html"), await open(browser, base, "mobile.html", { phone: true }));

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
