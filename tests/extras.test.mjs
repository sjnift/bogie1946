// The year picture, On this day, Watch next, and the site still installing as an app.
import { open, assert, noErrors } from "./lib.mjs";

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    await p.goto(`${base}${file}#/insights/2025`); await p.waitForFunction(() => typeof state === "object" && state.lib);
    await p.click(phone ? 'button:has-text("Share 2025 as an image")' : "#y-glance .dlink");
    await p.waitForSelector(".share-img", { timeout: 15000 });
    const size = await p.$eval(".share-img", (img) => [img.naturalWidth, img.naturalHeight].join("x"));
    assert(size === "1080x1350", `${file}: image ${size}`);
    noErrors(p, file);
  }
  const d = await open(browser, base, "desktop.html");
  const otd = await d.evaluate(() => onThisDay(state.lib, new Date(2026, 4, 3)));
  assert(otd.entries.length && otd.entries.every((e) => Math.abs(dayIndex(`2026${e.date.slice(4)}`) - dayIndex("2026-05-03")) <= 3), "On this day picked the wrong dates");
  const wn = await d.evaluate(() => { const W = watchNext(state.lib); return W && W.picks.filter((p) => p.known).map((p) => [p.f.name, +p.pred.toFixed(2), p.why.length]); });
  assert(wn && wn.length && wn.every(([, x]) => x >= 0.5 && x <= 5) && wn.every((x, i) => !i || x[1] <= wn[i - 1][1]), `Watch next: ${JSON.stringify(wn)}`);
  const pwa = await d.evaluate(async () => { const m = await (await fetch("manifest.webmanifest")).json(); const reg = await navigator.serviceWorker.ready; return [m.name, !!reg.active]; });
  assert(pwa[0] && pwa[1], `install as an app: ${pwa}`);
  noErrors(d, "desktop");
}
