// Every kind of link on every page opens the data behind it: a pop-up on a computer, a sheet on a phone.
import { open, assert, noErrors, phoneTour } from "./lib.mjs";

async function clickThrough(page, scope, panel, where, min = 6) {
  const sel = `${scope} [data-list]`;
  const n = await page.$$eval(sel, (x) => x.length);
  assert(n >= min, `${where}: only ${n} links`);
  const seen = new Map();
  let opened = 0;
  for (let i = 0; i < n; i++) {
    const el = (await page.$$(sel))[i];
    if (!el) break;
    const kind = await el.evaluate((e) => `${(e.closest("section, .sh") || {}).id || ""}|${e.className}|${e.tagName}`);
    seen.set(kind, (seen.get(kind) || 0) + 1);
    if (seen.get(kind) > 2 || !(await el.isVisible())) continue;
    // a country on the map is an odd shape (France reaches to South America), so it's clicked as itself, not at its middle
    if (await el.evaluate((e) => e instanceof SVGGeometryElement)) await el.dispatchEvent("click"); else await el.click();
    await page.waitForTimeout(40);
    const title = await page.evaluate((p) => { const d = document.querySelector(p); return d && d.open ? d.querySelector("h2, h3").textContent : null; }, panel);
    assert(title, `${where}: link ${i} (${kind}) opened nothing`);
    opened++;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(60);
  }
  noErrors(page, where);
  return opened;
}

export default async function ({ browser, base }) {
  const d = await open(browser, base, "desktop.html");
  await clickThrough(d, ".wrap", "#dlg", "desktop stats");
  await d.click("#btn-insights"); await d.waitForTimeout(150);
  await clickThrough(d, "#insights", "#dlg", "desktop insights");
  await d.click('[data-insyear="2025"]'); await d.waitForTimeout(150);
  await clickThrough(d, "#insights", "#dlg", "desktop 2025");
  await d.click("#btn-compare"); await d.waitForTimeout(150);
  await clickThrough(d, "#compare", "#dlg", "desktop compare");
  await d.click("#btn-settings"); await d.waitForTimeout(150);
  await clickThrough(d, "#settings", "#dlg", "desktop settings", 0);

  // every screen and section of the phone; a section can be short, but it links to something
  const m = await open(browser, base, "mobile.html", { phone: true });
  await phoneTour(m, async (where) => { await m.evaluate(() => scrollTo(0, 0)); await clickThrough(m, "#screen", "#sheet", `phone ${where}`, (await m.$("#screen .empty")) ? 0 : 1); });
}
