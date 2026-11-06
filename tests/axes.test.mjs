// Every bar chart has clearly labelled axes (asked 6 Nov 2026: "all the bar charts in the website have no clearly
// labelled x and y axis"), on both layouts, everywhere a chart is drawn: the y axis's name and the x axis's name; a
// scale of two or more labels down the left, rising evenly, each beside its own line and none cut off at the left;
// and labels along the x axis. The release-year chart labels every year of a short stretch (the 1940s had "1940" alone).
import { open, assert, noErrors, desktopChapters, phoneTour } from "./lib.mjs";

// what each chart on the screen shows: its axis names, its y labels (text, height from the bottom), its x labels
const audit = (page) => page.evaluate(() => [...document.querySelectorAll(".cx")].filter((c) => c.offsetParent).map((c) => {
  const box = c.getBoundingClientRect(), y = c.querySelector(".cx-y"), yb = y && y.getBoundingClientRect();
  return { plain: c.classList.contains("plain"), yt: (c.querySelector(".cx-yt") || {}).textContent || "", xt: (c.querySelector(".cx-xt") || {}).textContent || "",
    ys: y ? [...y.children].map((s) => { const r = s.getBoundingClientRect(); return { t: s.textContent, at: Math.round(yb.bottom - (r.top + r.bottom) / 2), left: Math.round(r.left - box.left) }; }) : [],
    xs: [...c.querySelectorAll(".cx-x span, .lbl")].map((s) => s.textContent).filter(Boolean) };
}));

export default async function ({ browser, base }) {
  let charts = 0;
  const check = (list, where) => {
    for (const c of list) {
      charts++;
      const w = `${where}: ${c.yt || "?"} / ${c.xt || "?"}`;
      assert(c.yt.trim() && c.xt.trim(), `${w}: an axis without a name ${JSON.stringify(c)}`);
      assert(c.xs.length >= 2, `${w}: no labels along the x axis ${JSON.stringify(c.xs)}`);
      if (c.plain) continue; // the weekdays: each bar carries its own number
      assert(c.ys.length >= 2, `${w}: a scale of ${c.ys.length} label(s)`);
      const gaps = c.ys.slice(1).map((s, i) => s.at - c.ys[i].at);
      assert(gaps.every((g) => g > 8) && Math.max(...gaps) - Math.min(...gaps) <= 2, `${w}: the scale doesn't rise evenly ${JSON.stringify(c.ys)}`);
      assert(c.ys.every((s) => s.left >= -1), `${w}: a y label cut off at the left ${JSON.stringify(c.ys)}`);
    }
  };
  // the computer: every chapter, the release years three ways, Insights, Compare
  const d = await open(browser, base, "desktop.html");
  await desktopChapters(d, async (id) => { await d.waitForTimeout(150); check(await audit(d), `computer ${id}`); });
  await d.evaluate(() => setChapter("films")); await d.waitForTimeout(150);
  for (const t of ["films", "rating", "decades"]) { await d.click(`[data-tab="released"][data-val="${t}"]`); await d.waitForTimeout(100); check(await audit(d), `computer released ${t}`); }
  // a short stretch of release years labels every year
  const short = await d.evaluate(() => { const s = computeStats(state.lib, metaOf, "all"), ys = s.relYears.filter((x) => x.year >= 2010 && x.year <= 2019);
    const el = document.createElement("div"); el.innerHTML = releaseYearsChart({ ...s, relYears: ys }, "films", 162, true); return [...el.querySelectorAll(".ry-axis span")].map((x) => x.textContent); });
  assert(short.length >= 8 && short.every((y, i) => !i || +y === +short[i - 1] + 1), `a decade of release years, every year labelled: ${short}`);
  await d.evaluate(() => { location.hash = "#/insights"; }); await d.waitForTimeout(1500);
  check(await audit(d), "computer insights");
  const fid = await d.evaluate(() => EXAMPLE_FRIENDS[0].id);
  await d.evaluate((f) => { location.hash = `#/compare/${f}`; }, fid); await d.waitForTimeout(800);
  const cmp = await audit(d);
  assert(cmp.some((c) => /ratings/.test(c.yt) && c.xt === "Rating given"), `computer compare: the rating style chart ${JSON.stringify(cmp)}`);
  check(cmp, "computer compare");
  noErrors(d, "desktop");
  // the phone: every screen and section
  const m = await open(browser, base, "mobile.html", { phone: true });
  await phoneTour(m, async (name) => { await m.waitForTimeout(120); check(await audit(m), `phone ${name}`); });
  noErrors(m, "phone");
  assert(charts >= 25, `only ${charts} charts looked at`);
}
