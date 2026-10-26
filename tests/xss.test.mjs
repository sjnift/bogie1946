// Nothing from outside can run code on the page. Every place outside text comes from is filled with booby-trapped
// text (the export, film details and photos as TMDB or another device could send them, Letterboxd averages, a
// friend's export, the daily feed, TMDB's answers, a search, the address), then every screen on both layouts is
// opened, and lists and film cards with it. Any element that gained an on… attribute or a javascript: link, or any
// payload that ran, fails the check, with the screen it was on.
import { open, seed, assert, noErrors } from "./lib.mjs";

const RAN = "window.__xss=(window.__xss||0)+1;(window.__xssAt=window.__xssAt||[]).push(String(this.outerHTML).slice(0,200)+' IN '+((document.querySelector('#dlg[open]')||document.body).innerText||'').slice(0,300).replace(/\\s+/g,' '))";
const P = {
  tag: `<img src=x onerror="${RAN}">`,
  quote: `"><img src=x onerror="${RAN}">`,
  single: `'><svg onload="${RAN}">`,
  script: `</script><script>${RAN}</script>`,
  url: `javascript:${RAN}`,
};
const nasty = (label) => `${label} ${P.quote} ${P.single} ${P.tag}`;
const films = [
  { Name: nasty("Heat"), Year: "1995" }, { Name: `${P.single} Night`, Year: "2001" }, { Name: P.tag, Year: "2010" },
  { Name: `Plain ${P.script}`, Year: "2019" }, { Name: "Brick", Year: "2005" },
];
const review = `<p onclick="${RAN}">Good <a href="${P.url}">link</a> <a href="https://x.test/" onmouseover="${RAN}">ok</a></p>${P.tag}<svg onload="${RAN}"></svg><iframe src="${P.url}"></iframe>`;
const rows = (user, given) => ({
  profile: [{ Username: user, "Date Joined": "2020-01-01", "Given Name": given }],
  watched: films.map((f) => ({ ...f, Date: "2024-01-01", "Letterboxd URI": P.url })),
  diary: films.map((f, i) => ({ ...f, Date: `2024-0${i + 1}-03`, "Watched Date": `2024-0${i + 1}-03`, Rating: String(3 + (i % 3)), Rewatch: i % 2 ? "Yes" : "", Tags: nasty("tag") })),
  ratings: films.map((f, i) => ({ ...f, Rating: String(3 + (i % 3)) })),
  reviews: films.map((f, i) => ({ ...f, Date: `2024-0${i + 1}-04`, "Watched Date": `2024-0${i + 1}-03`, Rating: "4", Review: review, Tags: nasty("rtag") })),
  likes: films.slice(0, 2).map((f) => ({ ...f })),
  watchlist: [{ Name: nasty("Wanted"), Year: "2020", "Letterboxd URI": P.url }, { Name: "Le Samouraï", Year: "1967" }],
});
// film details as another device (or TMDB, which anyone can edit) could send them: nothing cleaned
const meta = (i) => ({ src: "tmdb", v: 12, id: 1000 + i, poster: `/p${i}.jpg${P.quote}`, y: 1990 + i, d: [nasty("Director")], c: [nasty("Actor"), `${P.single} Star`], w: [nasty("Writer")],
  p: [nasty("Shooter")], m: [nasty("Composer")], g: ["Drama", nasty("Genre")], k: [nasty("Country"), "France"], l: nasty("Language"), r: 100 + i, va: 7.1, vc: 900,
  im: `tt${P.quote}`, ir: 7.5, iv: 1000, mc: 70, rt: 90, om: "2026-10-01", why: nasty("why"), via: P.quote,
  cq: nasty("2026-10-26"), ca: [nasty("Added"), `${P.single} Extra`], cr: [`${P.single} Star`] }); // the cast as IMDb put it right (06d)

const scan = (page, where) => page.evaluate((where) => {
  const bad = [];
  for (const el of document.querySelectorAll("*")) for (const a of el.attributes) {
    if (/^on/i.test(a.name)) bad.push(`${el.tagName.toLowerCase()} ${a.name}`);
    if (["href", "src", "action", "formaction", "xlink:href"].includes(a.name) && /^\s*javascript:/i.test(a.value)) bad.push(`${el.tagName.toLowerCase()} ${a.name}=javascript:`);
  }
  for (const s of document.querySelectorAll("script")) if (s.textContent.includes("__xss")) bad.push("script element with the payload");
  if (document.querySelector("iframe")) bad.push("iframe");
  return { where, ran: window.__xss || 0, bad: [...new Set(bad)].slice(0, 6) };
}, where);
const check = async (page, where) => { if (process.env.XSS_DEBUG) console.log(new Date().toISOString().slice(11, 19), where); const r = await scan(page, where); const at = r.ran ? await page.evaluate(() => (window.__xssAt || []).join(" || ")) : ""; assert(!r.ran && !r.bad.length, `${where}: ${r.ran ? `payload ran ${r.ran}× at ${at}; ` : ""}${r.bad.join(", ")}`); };
// opens up to `n` of the lists and cards on screen, checking after each
async function clickAround(page, scope, panel, where, n = 25) {
  const ids = await page.$$eval(`${scope} [data-list]`, (x) => [...new Set(x.map((e) => e.dataset.list))]);
  for (const id of ids.slice(0, n)) {
    const el = await page.$(`${scope} [data-list="${id}"]`);
    if (!el || !(await el.isVisible())) continue;
    await el.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(40);
    await check(page, `${where}, list ${id}`);
    // inside the pop-up or sheet, the first few things it links to as well
    for (const inner of (await page.$$(`${panel} [data-list]`)).slice(0, 3)) { if (await inner.isVisible()) { await inner.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(30); await check(page, `${where}, list ${id} inside`); } }
    await page.keyboard.press("Escape"); await page.waitForTimeout(30);
    if (await page.evaluate((p) => { const d = document.querySelector(p); return d && d.open; }, panel)) { await page.keyboard.press("Escape"); await page.waitForTimeout(30); }
  }
}
async function prepare(page) {
  await page.context().route(/\/feed\/tester\.json/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ user: "tester", items: [
    { guid: "letterboxd-review-1", title: nasty("Fed"), year: 2026, watched: "2026-10-20", logged: "2026-10-20", rating: 4, rewatch: false, liked: true, tmdb: 77, review: review, link: P.url }] }) }));
  await page.context().route(/api\.themoviedb\.org/, (r) => {
    const u = new URL(r.request().url()), json = (o) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
    if (/\/search\/person/.test(u.pathname)) return json({ results: [{ id: 5, name: nasty("Person"), known_for_department: "Acting", popularity: 9, profile_path: `/x.jpg${P.quote}` }] });
    if (/\/person\/\d+\/movie_credits/.test(u.pathname)) return json({ cast: [{ id: 9, title: nasty("Credit"), release_date: "2001-01-01", character: nasty("Role"), vote_count: 900, poster_path: `/c.jpg${P.quote}` }], crew: [] });
    json({ results: [] });
  });
  await seed(page, rows("tester", nasty("Sam")), { "cr-tmdb-key": "k123" });
  // film details, photos, Letterboxd averages and a friend, for every film including the watchlist's and the friend's
  await page.evaluate(([friendRows, metas]) => {
    const metaFor = (i) => metas[i % metas.length];
    store.set(KEYS.friends, [{ id: "f1", name: `Pal ${'"><img src=x onerror="window.__xss=(window.__xss||0)+1">'}`, rows: friendRows }]);
    loadFriends();
    const all = [...MY_LIB.films, ...MY_LIB.watchlistFilms, ...FRIENDS.flatMap((f) => f.lib.films)];
    all.forEach((f, i) => { META[f.key] = metaFor(i); LBX[f.key] = { r: 3.5, n: 1200, slug: `s${i}${'"><img src=x onerror="window.__xss=(window.__xss||0)+1">'}` }; });
    for (const m of Object.values(META)) for (const n of [...m.d, ...m.c]) PHOTOS[personKey(n)] = `/ph.jpg${'"><img src=x onerror="window.__xss=(window.__xss||0)+1">'}`;
    saveMeta(); store.set(KEYS.lbx, LBX);
    return store.flush();
  }, [rows("pal", "Pal"), Array.from({ length: 40 }, (_, i) => meta(i))]);
  await page.reload();
  await page.waitForFunction(() => typeof state === "object" && state.lib && MY_LIB && FRIENDS.length);
}

export default async function ({ browser, base }) {
  // the computer
  const d = await open(browser, base, "desktop.html");
  await prepare(d);
  await check(d, "desktop stats");
  await clickAround(d, "#sections, #tiles, .band", "#dlg", "desktop stats");
  await d.click('[data-scope="2024"]'); await d.waitForTimeout(100); await check(d, "desktop 2024");
  await d.click('[data-scope="all"]');
  await d.click("#btn-insights"); await d.waitForTimeout(150); await check(d, "desktop insights");
  await clickAround(d, "#insights", "#dlg", "desktop insights", 15);
  await d.click("#btn-compare"); await d.waitForTimeout(150); await check(d, "desktop compare");
  await clickAround(d, "#compare", "#dlg", "desktop compare", 15);
  await d.click("#btn-settings"); await d.waitForTimeout(150); await check(d, "desktop settings");
  await d.click("#home-link"); await d.waitForTimeout(100);
  // the filter panel, and the page filtered by a booby-trapped country, language and genre
  await d.evaluate(() => openDrill(D.filters())); await d.waitForTimeout(100); await check(d, "desktop filter panel");
  for (const k of ["k", "l", "g"]) { const b = await d.$(`.fpanel [data-fpick="${k}"]`); if (b) { await b.evaluate((el) => el.click()); await d.waitForTimeout(150); await check(d, `desktop filtered (${k})`); } }
  await d.keyboard.press("Escape"); await d.evaluate(() => { clearFilters(); render(); });
  // search, a film card from the address, a made-up friend in the address
  await d.keyboard.press("/"); await d.keyboard.type(`${P.quote} Heat`); await d.waitForTimeout(150); await check(d, "desktop search");
  await d.keyboard.press("Escape");
  await d.fill("#review-search", P.quote); await d.waitForTimeout(100); await check(d, "desktop review search");
  for (const hash of [`#/film/${encodeURIComponent(await d.evaluate(() => MY_LIB.films[0].key))}`, `#/compare/${encodeURIComponent(P.quote)}`, `#/${encodeURIComponent(P.quote)}`]) {
    await d.goto(base + "desktop.html" + hash); await d.waitForFunction(() => typeof state === "object" && state.lib); await d.waitForTimeout(200);
    await check(d, `desktop address ${hash.slice(0, 20)}`);
  }
  // a person's filmography (TMDB's answer is booby-trapped too)
  await d.evaluate(() => openDrill(D.film(MY_LIB.films[0]))); await d.waitForTimeout(100);
  await d.click("#dlg .fc-dir .dlink", { timeout: 3000 }).catch(() => {}); await d.waitForTimeout(400); await check(d, "desktop filmography");
  noErrors(d, "desktop");

  // the phone
  const m = await open(browser, base, "mobile.html", { phone: true });
  await prepare(m);
  // (straight to the screen, closing any sheet left open)
  const tab = async (v) => { await m.evaluate((v) => { if ($("#sheet").open) closeSheet(); goTo(v === "stats" ? state.statsView : v, { force: true, top: true }); }, v); await m.waitForTimeout(120); };
  for (const v of ["profile", "diary", "stats", "insights", "compare"]) {
    await tab(v); await check(m, `phone ${v}`);
    await clickAround(m, "#screen", "#sheet", `phone ${v}`, 12);
  }
  await tab("stats");
  for (const v of ["films", "people", "genres", "years", "crowd"]) { await tab(v); await check(m, `phone stats ${v}`); await clickAround(m, "#screen", "#sheet", `phone ${v}`, 8); }
  await tab("films");
  await m.evaluate(() => openSheet(D.filters())); await m.waitForTimeout(100); await check(m, "phone filter panel");
  for (const k of ["k", "l", "g"]) { const b = await m.$(`.fpanel [data-fpick="${k}"]`); if (b) { await b.evaluate((el) => el.click()); await m.waitForTimeout(150); await check(m, `phone filtered (${k})`); } }
  await m.evaluate(() => { closeSheet(); clearFilters(); render(); }); await m.waitForTimeout(100);
  await tab("profile");
  for (const act of ["reviews", "watchnext", "settings"]) {
    if (!(await m.$(`[data-act="${act}"]`))) continue;
    await m.click(`[data-act="${act}"]`); await m.waitForTimeout(120); await check(m, `phone ${act}`);
    await m.evaluate(() => history.back()); await m.waitForTimeout(150);
  }
  await m.evaluate(() => openSearch()); await m.waitForTimeout(100);
  await m.keyboard.type(`${P.quote} Heat`); await m.waitForTimeout(150); await check(m, "phone search");
  noErrors(m, "phone");
}
