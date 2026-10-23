// Addresses change with the page, the back button steps back through pop-ups, sheets and pages, and a bookmarked address opens where it was.
import { open, assert, noErrors } from "./lib.mjs";

export default async function ({ browser, base }) {
  const d = await open(browser, base, "desktop.html");
  const at = () => d.evaluate(() => [location.hash, state.page, $("#dlg").open ? $("#dlg h3").textContent : ""].join(" "));
  assert((await at()).startsWith("#/ stats"), `start: ${await at()}`);
  await d.click("#tiles .tile-main"); await d.click("#dlg .drill-row"); await d.waitForTimeout(100);
  assert(/#\/film\/.+ stats \S/.test(await at()), `film card address: ${await at()}`);
  await d.goBack(); await d.waitForTimeout(150);
  assert(/^#\/ stats All films/.test(await at()), `back to the list: ${await at()}`);
  await d.goBack(); await d.waitForTimeout(150);
  assert(await at() === "#/ stats ", `back closes it: ${await at()}`);
  await d.click("#btn-insights"); await d.click('[data-insyear="2025"]'); await d.waitForTimeout(150);
  assert((await at()).startsWith("#/insights/2025 insights"), `insights: ${await at()}`);
  await d.goBack(); await d.waitForTimeout(150);
  assert((await at()).startsWith("#/ stats"), `back from insights: ${await at()}`);
  await d.click("#tiles .tile-main >> nth=2"); await d.click("[data-drillpage]"); await d.waitForTimeout(200);
  assert((await at()).startsWith("#/list drill"), `full page: ${await at()}`);
  await d.goBack(); await d.waitForTimeout(200);
  assert(await at() === "#/ stats ", `back from the full page: ${await at()}`);
  await d.goto(base + "desktop.html#/2025/film/" + encodeURIComponent("aftersun|2022")); await d.waitForTimeout(400);
  assert(await at() === "#/2025/film/aftersun%7C2022 stats Aftersun", `bookmarked film: ${await at()}`);
  noErrors(d, "desktop");

  const m = await open(browser, base, "mobile.html", { phone: true });
  const mat = () => m.evaluate(() => [location.hash, $("#nav-title").textContent, $("#sheet").open ? $("#sheet h2").textContent : ""].join(" "));
  await m.click('.tabbar [data-view="diary"]'); await m.click(".fact >> nth=3"); await m.click("#sheet .drill-row"); await m.waitForTimeout(150);
  assert(/^#\/diary\/film\/.+ Diary \S/.test(await mat()), `phone card: ${await mat()}`);
  await m.goBack(); await m.waitForTimeout(150);
  assert(/^#\/diary Diary \S+day/.test(await mat()), `phone back to the list: ${await mat()}`);
  await m.click("#sheet [data-sclose]"); await m.waitForTimeout(250);
  assert(await mat() === "#/diary Diary ", `Done closes the sheet: ${await mat()}`);
  await m.goto(base + "mobile.html#/insights/2024"); await m.waitForTimeout(400);
  assert((await mat()).startsWith("#/insights/2024 Insights") && await m.$eval('[data-scope="2024"]', (b) => b.getAttribute("aria-pressed")) === "true", `phone bookmark: ${await mat()}`);
  await m.click('.tabbar [data-view="stats"]'); await m.waitForTimeout(150);
  assert((await mat()).startsWith("#/films Stats"), `phone Stats tab: ${await mat()}`);
  await m.goBack(); await m.waitForTimeout(200);
  assert((await mat()).startsWith("#/insights/2024 Insights"), `phone back to the tab before: ${await mat()}`);
  await m.goto(base + "mobile.html#/reviews"); await m.waitForTimeout(400);
  assert((await mat()).startsWith("#/reviews Reviews"), `phone pushed screen: ${await mat()}`);
  await m.click('[data-act="back"]'); await m.waitForTimeout(200);
  assert(!(await mat()).startsWith("#/reviews"), `phone back arrow stayed on Reviews: ${await mat()}`);
  noErrors(m, "phone");
}
