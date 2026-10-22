// Every kind of link on every page opens the data behind it: a pop-up on a computer, a sheet on a phone.
import { open, assert, noErrors } from "./lib.mjs";

async function clickThrough(page, scope, panel, where) {
  const sel = `${scope} [data-list]`;
  const n = await page.$$eval(sel, (x) => x.length);
  assert(n > 5, `${where}: only ${n} links`);
  const seen = new Map();
  let opened = 0;
  for (let i = 0; i < n; i++) {
    const el = (await page.$$(sel))[i];
    if (!el) break;
    const kind = await el.evaluate((e) => `${(e.closest("section, .sh") || {}).id || ""}|${e.className}|${e.tagName}`);
    seen.set(kind, (seen.get(kind) || 0) + 1);
    if (seen.get(kind) > 2 || !(await el.isVisible())) continue;
    await el.click();
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

  const m = await open(browser, base, "mobile.html", { phone: true });
  for (const view of ["profile", "diary", "films", "people"]) {
    await m.click(`.tabbar [data-view="${view}"]`); await m.waitForTimeout(100);
    await clickThrough(m, "#screen", "#sheet", `phone ${view}`);
  }
  await m.click('.tabbar [data-view="profile"]'); await m.click('#nav-right [data-act="insights"]'); await m.waitForTimeout(150);
  await clickThrough(m, "#screen", "#sheet", "phone insights");
}
