// The diary as Letterboxd shows it (asked 7 Nov 2026: "build a diary tab on website", "build it like letterboxd with same
// filters"): the computer's Diary chapter and the phone's Diary tab list every entry once, a hundred at a time on the
// computer; Year, Rating, Decade, Genre, Show and Sort by do what they say; Decade and Genre are the page's own filter;
// a row opens that entry's film card; Escape closes a menu; nothing scrolls sideways on the phone.
import { open, seed, assert, noErrors } from "./lib.mjs";

const TITLES = ["The Apartment", "Heat", "Rope", "Alien", "Vertigo", "Jaws", "Brazil", "Ran", "Fargo", "Seven", "Zodiac", "Up", "Her", "Drive", "Rocky", "Psycho",
  "Network", "Tootsie", "Amadeus", "Gandhi", "Persona", "Stalker", "Solaris", "Mirror", "Ikiru", "Yojimbo", "Sanjuro", "Ugetsu", "Late Spring", "Tokyo Story",
  "A Man Escaped", "Pickpocket", "Breathless", "Contempt", "Weekend", "Playtime", "Mon Oncle", "Le Samouraï", "Army of Shadows", "The Conformist"];
function rows() {
  const watched = [], diary = [], ratings = [], likes = [], reviews = [];
  TITLES.forEach((n, i) => { const y = String(1940 + (i * 7) % 80); watched.push({ Name: n, Year: y, Date: "2024-01-01" });
    if (i % 3 === 0) likes.push({ Name: n, Year: y }); });
  for (let i = 0; i < 130; i++) {
    const t = i % TITLES.length, n = TITLES[t], y = String(1940 + (t * 7) % 80), day = new Date(Date.UTC(2024, 0, 2) + i * 5 * 864e5).toISOString().slice(0, 10);
    const r = i % 11 === 0 ? "" : String(((i * 3) % 10 + 1) / 2);
    diary.push({ Name: n, Year: y, Date: day, "Watched Date": day, Rating: r, Rewatch: i >= TITLES.length ? "Yes" : "" });
    if (i % 17 === 0) reviews.push({ Name: n, Year: y, Date: day, "Watched Date": day, Review: `Thoughts on ${n}.`, Rating: r });
  }
  for (const n of TITLES) { const e = diary.filter((x) => x.Name === n && x.Rating).pop(); if (e) ratings.push({ Name: n, Year: e.Year, Rating: e.Rating }); }
  return { profile: [{ Username: "tester" }], exportedAt: "2026-11-01T00:00:00Z", watched, diary, ratings, likes, reviews, watchlist: [] };
}

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone, example: false });
    await seed(p, rows());
    await p.waitForFunction(() => typeof MY_LIB === "object" && MY_LIB && MY_LIB.entries.length === 130);
    // genres on some films (looked up for real on the site), so the Genre menu has choices
    await p.evaluate(() => { for (const [i, f] of MY_LIB.films.entries()) META[f.key] = { src: "tmdb", v: 16, id: 1000 + i, d: [], c: [], w: [], p: [], m: [], g: [i % 2 ? "Drama" : "Crime"], k: ["USA"], l: "English", r: 80 + i, t: Date.now() };
      META_REV++; if (typeof DATA_REV === "number") DATA_REV++; });
    if (phone) { await p.click('.tabbar [data-view="diary"]'); }
    else { await p.evaluate(() => render()); await p.click('#jump [data-chapter="diary"]'); }
    await p.waitForSelector(".dfilt [data-dmenu]");
    const rowSel = phone ? ".drow" : "#diary .dt-row";
    const shown = () => p.evaluate((rowSel) => [...document.querySelectorAll(rowSel)].map((b) => { const d = drillGet(b.dataset.list); return d && d.entry ? `${d.entry.film.key}|${d.entry.date}|${d.entry.order}` : "?"; }), rowSel);
    const pick = async (menu, sel) => { await p.click(`[data-dmenu="${menu}"]`); await p.click(`.dd-menu:not([hidden]) ${sel}`); await p.waitForTimeout(phone ? 150 : 120); };
    // every entry once, newest first (the computer a hundred at a time, the phone forty, both with more below)
    let got = await shown();
    if (!phone) {
      assert(got.length === 100, `${file}: the first page has ${got.length} rows`);
      await p.click("[data-dmore]"); await p.waitForTimeout(100); got = await shown();
    } else {
      while (await p.$('[data-act="more-diary"]')) { await p.click('[data-act="more-diary"]'); await p.waitForTimeout(80); }
      got = await shown();
    }
    const want = await p.evaluate(() => [...MY_LIB.entries].reverse().map((e) => `${e.film.key}|${e.date}|${e.order}`));
    assert(got.length === 130 && new Set(got).size === 130 && got.join() === want.join(), `${file}: every entry once, newest first: ${got.length} rows, ${new Set(got).size} different`);
    // Rating: only that rating, every one of them
    await pick("rating", '[data-dval="4"]');
    const r4 = await p.evaluate(() => MY_LIB.entries.filter((e) => e.rating === 4).length);
    got = await shown();
    let ok = await p.evaluate((got) => got.every((k) => MY_LIB.entries.find((e) => `${e.film.key}|${e.date}|${e.order}` === k).rating === 4), got);
    assert(ok && got.length === r4 && r4 > 0 && (await p.$eval(".dcount", (x) => x.textContent)).startsWith(`${r4} of 130`), `${file}: rated 4: ${got.length} of ${r4}`);
    await pick("rating", '[data-dval="none"]');
    got = await shown();
    assert(got.length === await p.evaluate(() => MY_LIB.entries.filter((e) => !e.rating).length), `${file}: no rating: ${got.length}`);
    await pick("rating", '[data-dval="any"]');
    // Show: liked, reviewed, rewatches
    for (const [v, test] of [["liked", "e.film.liked"], ["reviewed", "e.review"], ["rewatch", "e.rewatch"], ["first", "!e.rewatch"]]) {
      await pick("show", `[data-dval="${v}"]`);
      if (phone) while (await p.$('[data-act="more-diary"]')) { await p.click('[data-act="more-diary"]'); await p.waitForTimeout(60); }
      else while (await p.$("[data-dmore]")) { await p.click("[data-dmore]"); await p.waitForTimeout(60); }
      got = await shown();
      const n = await p.evaluate((test) => MY_LIB.entries.filter(new Function("e", `return ${test}`)).length, test);
      assert(got.length === n && n > 0, `${file}: show ${v}: ${got.length} rows, ${n} entries`);
    }
    await pick("show", '[data-dval="all"]');
    // Sort by: name (no leading "The"), release date, your rating, length; then back to when watched
    await pick("sort", '[data-dval="name"]');
    const names = await p.evaluate((rowSel) => [...document.querySelectorAll(rowSel)].slice(0, 12).map((b) => drillGet(b.dataset.list).entry.film.name), rowSel);
    assert(names[0] === "Alien" && names.indexOf("The Apartment") === names.lastIndexOf("Alien") + 1 + names.filter((x) => x === "Amadeus").length, `${file}: by name: ${names.join(" | ")}`);
    for (const [v, f, dir] of [["released", "e.film.year", -1], ["released-asc", "e.film.year", 1], ["rating", "e.rating", -1], ["length-asc", "metaOf(e.film).r", 1]]) {
      await pick("sort", `[data-dval="${v}"]`);
      const vals = await p.evaluate(([rowSel, f]) => [...document.querySelectorAll(rowSel)].map((b) => { const e = drillGet(b.dataset.list).entry; return new Function("e", `return ${f}`)(e) ?? null; }), [rowSel, f]);
      const known = vals.filter((x) => x != null), firstNull = vals.indexOf(null);
      ok = known.every((x, i) => !i || (x - known[i - 1]) * dir >= 0) && (firstNull < 0 || vals.slice(firstNull).every((x) => x == null));
      assert(ok && known.length, `${file}: sort ${v}: ${vals.slice(0, 15).join()}`);
    }
    await pick("sort", '[data-dval="watched"]');
    // Genre and Decade are the page's own filter: the strip says so, the rows follow, Clear takes it off
    await pick("genre", '[data-dval="Drama"]');
    await p.waitForTimeout(200);
    const g = await p.evaluate(() => ({ f: FILTER.g.join(), text: filterText() }));
    got = await shown();
    ok = await p.evaluate((got) => got.every((k) => (metaOf(MY_LIB.entries.find((e) => `${e.film.key}|${e.date}|${e.order}` === k).film).g || []).includes("Drama")), got);
    assert(g.f === "Drama" && /Drama/.test(g.text) && ok && got.length > 0, `${file}: genre: ${JSON.stringify(g)} ${got.length}`);
    await pick("decade", '[data-dval="1950s"]');
    await p.waitForTimeout(200);
    got = await shown();
    ok = await p.evaluate((got) => got.every((k) => { const f = MY_LIB.entries.find((e) => `${e.film.key}|${e.date}|${e.order}` === k).film; return f.year >= 1950 && f.year < 1960 && metaOf(f).g.includes("Drama"); }), got);
    assert(ok && (await p.evaluate(() => FILTER.d.join())) === "1950s", `${file}: decade and genre together: ${got.length}`);
    await p.click("[data-dclear]"); await p.waitForTimeout(250);
    assert(await p.evaluate(() => !filterOn() && DIARY.rating === "any" && DIARY.show === "all"), `${file}: Clear filters`);
    // Year: the year chips' own year
    await pick("year", '[data-scope="2025"]');
    await p.waitForTimeout(200);
    got = await shown();
    assert(await p.evaluate(() => state.scope === "2025") && got.length && got.every((k) => k.split("|").slice(-2)[0].startsWith("2025")), `${file}: year 2025: ${got.length}`);
    await pick("year", '[data-scope="all"]'); await p.waitForTimeout(200);
    // a menu: Escape closes it, a click elsewhere too, and only one is open at a time
    await p.click('[data-dmenu="sort"]');
    await p.keyboard.press("Escape");
    assert(await p.evaluate(() => !document.querySelector(".dd-menu:not([hidden])") && !DIARY.menu), `${file}: Escape leaves a menu open`);
    await p.click('[data-dmenu="rating"]'); await p.click('[data-dmenu="sort"]');
    assert((await p.$$(".dd-menu:not([hidden])")).length === 1, `${file}: two menus open`);
    await p.click(phone ? "h2.ltitle" : "#diary-h");
    assert(!(await p.$(".dd-menu:not([hidden])")), `${file}: a click elsewhere leaves the menu open`);
    // a row opens its entry's film card
    await p.click(`${rowSel}`);
    const panel = phone ? "#sheet" : "#dlg";
    await p.waitForSelector(`${panel}[open]`);
    const card = await p.evaluate((panel) => document.querySelector(panel).textContent, panel);
    assert(card.includes(TITLES[129 % TITLES.length]), `${file}: the first row's card: ${card.slice(0, 80)}`);
    if (phone) assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${file}: the page scrolls sideways`);
    noErrors(p, file);
  }
}
