// Every page and screen of the example diary draws, with nothing broken showing on it.
import { open, assert, noErrors, phoneTour } from "./lib.mjs";

const clean = async (page, where) => {
  const body = await page.evaluate(() => document.body.innerText);
  for (const bad of ["undefined", "NaN", "[object Object]", "null★"]) assert(!body.includes(bad), `${where} shows "${bad}"`);
  noErrors(page, where);
};

export default async function ({ browser, base }) {
  const d = await open(browser, base, "desktop.html");
  await clean(d, "desktop stats");
  for (const [btn, where] of [["#btn-insights", "insights"], ['[data-insyear="2024"]', "insights 2024"], ["#btn-compare", "compare"], ['[data-cmp="all"]', "compare everyone"]]) {
    await d.click(btn); await d.waitForTimeout(150);
    await clean(d, `desktop ${where}`);
  }
  const m = await open(browser, base, "mobile.html", { phone: true });
  const phone = async (where) => {
    await clean(m, `phone ${where}`);
    const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(over <= 0, `phone ${where} scrolls sideways by ${over}px`);
  };
  await phoneTour(m, phone);
  for (const act of ["settings", "reviews", "watchnext"]) {
    await m.click(`#screen [data-act="${act}"], #nav-right [data-act="${act}"]`); await m.waitForTimeout(150);
    await phone(act);
    await m.click('[data-act="back"]'); await m.waitForTimeout(150);
  }
}
