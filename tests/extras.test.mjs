// The pictures to share (a year, all time, a taste match; feed post or story), the year as a story, On this day,
// Watch next, and the site still installing as an app.
import { open, assert, noErrors } from "./lib.mjs";

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    const panel = phone ? "#sheet" : "#dlg";
    const imgSize = async (want, what) => {
      await p.waitForFunction((want) => { const i = document.querySelector(".share-img"); return i && i.complete && `${i.naturalWidth}x${i.naturalHeight}` === want; }, want, { timeout: 15000 }).catch(() => {});
      const size = await p.$eval(".share-img", (img) => [img.naturalWidth, img.naturalHeight].join("x"));
      assert(size === want, `${file} ${what}: image ${size}`);
    };
    const close = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(150); };
    await p.goto(`${base}${file}?example#/insights/2025`); await p.waitForFunction(() => typeof state === "object" && state.lib);
    await p.click(phone ? 'button:has-text("Share 2025 as an image")' : '#y-glance .dlink:has-text("share it as a picture")');
    await p.waitForSelector(".share-img", { timeout: 15000 });
    await imgSize("1080x1350", "2025 feed post");
    await p.click('[data-sharesize="story"]');
    await imgSize("1080x1920", "2025 story");
    await p.click('[data-sharesize="feed"]');
    await close();
    // the year as a story: every card, in turn, and the findings filled in
    await p.click(phone ? 'button:has-text("Play 2025 as a story")' : '#y-glance .dlink:has-text("Play it as a story")');
    await p.waitForSelector(`${panel} .story`);
    const cards = await p.$$eval(`${panel} .st-card`, (x) => x.length);
    for (let i = 1; i < cards; i++) await p.click(`${panel} [data-story-step="1"]`);
    const end = await p.evaluate((panel) => ({ on: [...document.querySelectorAll(`${panel} .st-card`)].findIndex((c) => c.classList.contains("on")), find: document.querySelector(`${panel} [data-storyfind]`).textContent }), panel);
    assert(cards >= 5 && end.on === cards - 1 && !/Working it out/.test(end.find), `${file} story: ${cards} cards, ended on ${end.on}, findings "${end.find.slice(0, 80)}"`);
    await close();
    // all time, from the main page
    await p.goto(`${base}${file}?example#/${phone ? "profile" : ""}`); await p.waitForFunction(() => typeof state === "object" && state.lib);
    await p.evaluate((phone) => phone ? openSheet(D.share("all")) : openDrill(D.share("all")), phone);
    await imgSize("1080x1350", "all time");
    await close();
    // a taste match with an example friend
    await p.evaluate((phone) => { const f = EXAMPLE_FRIENDS[0]; return phone ? openSheet(D.shareMatch(f.id, f.name)) : openDrill(D.shareMatch(f.id, f.name)); }, phone);
    await imgSize("1080x1350", "taste match");
    await close();
    noErrors(p, file);
  }
  const d = await open(browser, base, "desktop.html", { worker: true });
  const otd = await d.evaluate(() => { const T = onThisDay(state.lib, new Date(2026, 4, 3)); return T.entries.length && T.entries.every((e) => Math.abs(dayIndex(`2026${e.date.slice(4)}`) - dayIndex("2026-05-03")) <= 3); });
  assert(otd, "On this day picked the wrong dates");
  // Recently watched on the computer's main page: the eight latest entries, newest first; a year shows its last ones
  const recent = async () => d.evaluate(() => ({ title: $("#recent-h").textContent, dates: [...document.querySelectorAll("#recent .poster .d")].map((x) => x.textContent),
    want: state.lib.entries.filter((e) => state.scope === "all" || e.date.startsWith(state.scope)).slice(-8).reverse().map((e) => fmtDate(e.date)) }));
  let r = await recent();
  assert(r.title === "Recently watched" && r.dates.length === 8 && r.dates.join() === r.want.join(), `recently watched: ${JSON.stringify(r)}`);
  await d.click('[data-scope="2024"]'); await d.waitForTimeout(150);
  r = await recent();
  assert(r.title === "Last watched in 2024" && r.dates.join() === r.want.join() && r.dates.every((x) => x.endsWith("2024")), `last watched in 2024: ${JSON.stringify(r)}`);
  await d.click('[data-scope="all"]'); await d.waitForTimeout(150);
  // the main page (owner, Oct 2026): the best decade in full near the top, highest and lowest rated down in Ratings,
  // and every chapter's sections as cards cut short until opened
  const lay = await d.evaluate(() => { const ids = [...document.querySelectorAll("#sections .ch-mark, #sections section")].map((e) => e.id);
    return { ids, cards: document.querySelectorAll("#sections .dc").length, more: document.querySelectorAll("#sections .dc-more").length, glance: document.querySelectorAll("#sections .credit").length }; });
  const at = (id) => lay.ids.indexOf(id);
  assert(at("best-decade") > at("recent") && at("best-decade") < at("ch-films") && at("top") > at("ch-ratings") && at("top") > at("rated"), `main page order: ${lay.ids.join(" ")}`);
  assert(lay.cards >= 15 && lay.more >= 10 && lay.glance <= 3, `main page cards: ${JSON.stringify({ cards: lay.cards, more: lay.more, glance: lay.glance })}`);
  // a card's "See all" opens the whole section in the pop-up, not in place
  await d.click("#genre-years .dc-more"); await d.waitForTimeout(150);
  assert(await d.evaluate(() => $("#dlg").open && !!$("#dlg .dblock table.heat")), "Genres year by year didn't open in the pop-up");
  await d.keyboard.press("Escape"); await d.waitForTimeout(100);
  // Reviewed on the main page: the latest two, the rest one click away
  const rv = await d.evaluate(() => ({ cards: document.querySelectorAll("#reviews article.review").length, total: reviewsIn(state.lib, null).length,
    first: $("#reviews .rv-title").textContent.trim(), latest: reviewsIn(state.lib, null)[0].film.name, link: $("#reviews .rv-all").textContent }));
  assert(rv.cards === 2 && rv.first.startsWith(rv.latest) && rv.link === `All ${rv.total} reviews`, `reviewed: ${JSON.stringify(rv)}`);
  await d.click("#reviews .rv-all .dlink"); await d.waitForTimeout(150);
  const all = await d.evaluate(() => [$("#dlg").open, $("#dlg").querySelectorAll(".drill-rev").length]);
  assert(all[0] && all[1] === rv.total, `all reviews: ${all}`);
  await d.keyboard.press("Escape"); await d.waitForTimeout(100);
  const wn = await d.evaluate(() => { const W = watchNext(state.lib); return W && W.picks.filter((p) => p.known).map((p) => [p.f.name, +p.pred.toFixed(2), p.why.length]); });
  assert(wn && wn.length && wn.every(([, x]) => x >= 0.5 && x <= 5) && wn.every((x, i) => !i || x[1] <= wn[i - 1][1]), `Watch next: ${JSON.stringify(wn)}`);
  const pwa = await d.evaluate(async () => { const m = await (await fetch("manifest.webmanifest")).json(); const reg = await navigator.serviceWorker.ready; return [m.name, !!reg.active]; });
  assert(pwa[0] && pwa[1], `install as an app: ${pwa}`);
  noErrors(d, "desktop");
}
