// The year picture, On this day, Watch next, and the site still installing as an app.
import { open, assert, noErrors } from "./lib.mjs";

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    await p.goto(`${base}${file}?example#/insights/2025`); await p.waitForFunction(() => typeof state === "object" && state.lib);
    await p.click(phone ? 'button:has-text("Share 2025 as an image")' : "#y-glance .dlink");
    await p.waitForSelector(".share-img", { timeout: 15000 });
    const size = await p.$eval(".share-img", (img) => [img.naturalWidth, img.naturalHeight].join("x"));
    assert(size === "1080x1350", `${file}: image ${size}`);
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
  // Reviewed on the main page: the latest three, the rest one click away
  const rv = await d.evaluate(() => ({ cards: document.querySelectorAll("#reviews article.review").length, total: reviewsIn(state.lib, null).length,
    first: $("#reviews .rv-title").textContent.trim(), latest: reviewsIn(state.lib, null)[0].film.name, link: $("#reviews .rv-all").textContent }));
  assert(rv.cards === 3 && rv.first.startsWith(rv.latest) && rv.link === `All ${rv.total} reviews`, `reviewed: ${JSON.stringify(rv)}`);
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
