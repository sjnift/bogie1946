// Insights as a study of the diary: on a made-up diary five years long with patterns planted in it, the study finds
// them (horror every October, a Japanese season that a first Kurosawa opened, a liking for Japanese films beyond their
// reputation, a drift toward films not in English, longer films at weekends), on both layouts and for a single year.
// Nothing the Stats page shows is repeated, every list a finding opens holds each film or entry once and isn't empty,
// and the pages show no errors.
import { open, seed, assert, noErrors, until } from "./lib.mjs";

function plantedDiary() {
  let s = 11;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const iso = (t) => new Date(t).toISOString().slice(0, 10), day = 864e5;
  const NAT = [["United States of America", "English", 6], ["United Kingdom", "English", 2], ["France", "French", 2], ["Italy", "Italian", 1], ["South Korea", "Korean", 1], ["Germany", "German", 1], ["Japan", "Japanese", 0]];
  const G = ["Drama", "Comedy", "Thriller", "Crime", "Romance", "Science Fiction", "Mystery", "Action", "Horror"];
  const films = [];
  const make = (name, year, nation, lang, d, g, crowd, cast) => { const f = { name, year, k: [nation], l: lang, d: [d], g, r: 85 + Math.floor(rnd() * 50), crowd, c: cast }; films.push(f); return f; };
  let n = 0;
  for (let i = 0; i < 70; i++) {
    const [nation, lang] = (() => { const w = NAT.reduce((t, x) => t + x[2], 0); let r = rnd() * w; for (const x of NAT) { r -= x[2]; if (r <= 0) return x; } return NAT[0]; })();
    const d = `Director ${i}`, cast = [`Actor ${i}a`, `Actor ${i}b`, `Actor ${i}c`, `Actor ${(i * 7) % 70}d`];
    for (let j = 0; j < 9; j++) make(`Film ${++n}`, 1960 + Math.floor(rnd() * 64), nation, lang, d, [...new Set([pick(G), "Drama", ...(rnd() < 0.3 ? [pick(G)] : [])])], 2.6 + rnd() * 1.4, cast);
  }
  for (let j = 0; j < 30; j++) make(`Fright ${j}`, 1975 + j, "United States of America", "English", `Shock Maker ${j % 6}`, ["Horror"], 2.8 + rnd(), [`Scream ${j}`]);
  const kuro = Array.from({ length: 7 }, (_, j) => make(`Kurosawa ${j}`, 1950 + j * 2, "Japan", "Japanese", "Akira Kurosawa", ["Drama", "Action"], 4.1, ["Toshirō Mifune", "Takashi Shimura"]));
  const japan = Array.from({ length: 40 }, (_, j) => make(`Tokyo Story ${j}`, 1949 + j, "Japan", "Japanese", `Japanese Director ${j % 8}`, ["Drama"], 3.6 + rnd() * 0.4, [`Japanese Actor ${j}`]));
  // the watching
  const start = Date.UTC(2021, 0, 1), end = Date.UTC(2025, 11, 31), seen = new Set(), diary = [];
  const free = (pred) => films.filter((f) => !seen.has(f) && pred(f));
  const see = (f, t) => {
    seen.add(f);
    const wd = (new Date(t).getUTCDay() + 6) % 7, p = (t - start) / (end - start);
    let r = f.crowd + (f.l === "Japanese" ? 0.7 : 0) + (rnd() - 0.5) * 0.9;
    r = Math.max(0.5, Math.min(5, Math.round(r * 2) / 2));
    diary.push({ f, t, r });
    if (wd >= 5 && f.r < 110) f.r += 40; // weekend films run long
    return p;
  };
  for (let t = start; t < end; t += day) {
    const date = new Date(t), mo = date.getUTCMonth(), p = (t - start) / (end - start);
    if (rnd() > 0.55) continue;
    let f = null;
    if (t === Date.UTC(2023, 1, 6)) f = kuro[0];
    else if (t > Date.UTC(2023, 1, 6) && t < Date.UTC(2023, 4, 20) && rnd() < 0.7) f = free((x) => x.d[0] === "Akira Kurosawa")[0] || pick(free((x) => x.l === "Japanese"));
    else if (mo === 9 && rnd() < 0.6) f = pick(free((x) => x.g.includes("Horror")));
    if (!f) { const foreign = rnd() < 0.12 + 0.5 * p; f = pick(free((x) => x.l !== "Japanese" && !x.g.includes("Horror") && (foreign ? x.l !== "English" : x.l === "English"))) || pick(free((x) => x.l !== "Japanese")); }
    if (f) see(f, t);
  }
  const rows = { profile: [{ Username: "planted", "Date Joined": "2020-12-01" }], watched: [], ratings: [], diary: [], likes: [], reviews: [], watchlist: [] };
  const meta = {}, lbx = {};
  const key = (f) => `${f.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${f.year}`;
  diary.forEach((e, i) => {
    const base = { Name: e.f.name, Year: String(e.f.year) };
    rows.diary.push({ ...base, Date: iso(e.t), "Watched Date": iso(e.t), Rating: String(e.r), Rewatch: "", Tags: "" });
    rows.watched.push({ ...base, Date: iso(e.t) });
    rows.ratings.push({ ...base, Rating: String(e.r) });
    meta[key(e.f)] = { src: "tmdb", v: 11, id: 5000 + i, d: e.f.d, c: e.f.c, w: e.f.d, p: [], m: [], g: e.f.g, k: e.f.k, l: e.f.l, r: e.f.r, va: Math.round(e.f.crowd * 20) / 10, vc: 500 + i * 3, y: e.f.year };
    lbx[key(e.f)] = { r: Math.round(e.f.crowd * 100) / 100, n: 1000 + i * 37, slug: "s" };
  });
  return { rows, meta, lbx };
}

// Runs in the page: every list a link can open holds each film or entry once and isn't empty.
function auditLists() {
  const bad = [];
  const film = (f) => titleKey(f.name, f.year);
  const once = (items, keyOf, where) => { const seen = new Set(); for (const x of items) { const k = keyOf(x); if (seen.has(k)) { bad.push(`${where}: ${k} twice`); return; } seen.add(k); } };
  const walk = (d, where) => {
    if (!d) return;
    const w = `${where} › ${d.title || d.kind}`;
    if (["films", "entries", "names", "reviews"].includes(d.kind) && !drillSize(d)) bad.push(`${w}: empty`);
    if (d.kind === "films") once(d.films, film, w);
    if (d.kind === "entries") once(d.entries, (e) => e, w);
    if (d.kind === "names") { once(d.items, (p) => p.name, w); for (const p of d.items) if (p.films) once(p.films, film, `${w} › ${p.name}`); }
    if (d.kind === "groups") for (const g of d.groups) walk(g, w);
  };
  for (const d of LISTS.values()) walk(d, location.hash);
  return bad;
}
const audit = async (page, where) => { const bad = await page.evaluate(`(${auditLists})()`); assert(!bad.length, `${where}: ${bad.slice(0, 3).join("; ")}`); };
// what the Stats page shows, which Insights no longer repeats
const REPEATS = /Busiest year|Film of the year|Top genre|Director of the year|Most seen actor|Busiest month|Best of 20|Month by month|Year by year/;

export default async function ({ browser, base }) {
  const { rows, meta, lbx } = plantedDiary();
  const extra = { "cr-meta-v1": meta, "cr-letterboxd-v1": lbx };

  // the computer
  const d = await open(browser, base, "desktop.html");
  await seed(d, rows, extra);
  await d.click("#btn-insights");
  await d.waitForSelector("#i-habits");
  const txt = async (sel) => (await d.$eval(sel, (e) => e.textContent)).replace(/\s+/g, " ");
  const all = await txt("#insights");
  assert(!REPEATS.test(all), `Insights repeats the Stats page: ${all.match(REPEATS)}`);
  assert(/October is horror month/.test(await txt("#i-habits")), `the October horror habit wasn't found: ${await txt("#i-habits")}`);
  assert(/At weekends you go for longer films/.test(await txt("#i-habits")), "longer weekend films weren't found");
  assert(/Japanese season|Akira Kurosawa season/.test(await txt("#i-chapters")), `the Japanese season wasn't found: ${await txt("#i-chapters")}`);
  assert(/Films not in English have grown/.test(await txt("#i-tastes")), `the drift away from English wasn't found: ${await txt("#i-tastes")}`);
  assert(/Films in Japanese: you rate them [\d.]+★ higher than their reputation/.test(await txt("#i-ratings")), `the liking for Japanese films wasn't found: ${await txt("#i-ratings")}`);
  assert(/opened the door to Akira Kurosawa/.test(await txt("#i-threads")), `the Kurosawa door wasn't found: ${await txt("#i-threads")}`);
  await audit(d, "desktop insights");
  // findings open their films: a chapter, a column of a trend, and what ratings follow
  for (const sel of ["#i-chapters .ch-title .dlink", "#i-tastes .drift .col", "#i-ratings .rank-row"]) {
    await d.click(sel);
    await until(d, () => document.querySelector("#dlg").open && document.querySelectorAll("#dlg .drill-row, #dlg .name-row, #dlg [data-list]").length > 0, `${sel} to open its list`);
    await d.keyboard.press("Escape");
  }
  // one year against the rest
  await d.click('[data-insyear="2023"]');
  await d.waitForSelector("#y-differ");
  const y = await txt("#insights");
  assert(!REPEATS.test(y), `the year repeats the Stats page: ${y.match(REPEATS)}`);
  assert(/in Japanese, against/.test(await txt("#y-differ")), `2023's Japanese films weren't set apart: ${await txt("#y-differ")}`);
  assert(/Akira Kurosawa/.test(await txt("#y-threads")), "2023's Kurosawa run wasn't found");
  await audit(d, "desktop insights 2023");
  // through the year: the section is there, and on a diary where every December is busy, December is found
  assert(/Through the year/.test(all) && await d.evaluate(() => desktopStudy().months.enough), "the Through the year section is missing");
  const dec = await d.evaluate(() => {
    let r = 5; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647, rows = { profile: [{ Username: "dec" }], diary: [], watched: [], ratings: [], likes: [], reviews: [], watchlist: [] };
    let n = 0;
    for (let t = Date.UTC(2021, 0, 1); t <= Date.UTC(2024, 11, 31); t += 864e5) {
      const dec = new Date(t).getUTCMonth() === 11, k = rnd() < (dec ? 0.95 : 0.4) ? 1 + (rnd() < 0.2 ? 1 : 0) : 0;
      for (let j = 0; j < k; j++) { const name = `Seasonal ${++n}`, date = new Date(t).toISOString().slice(0, 10);
        rows.diary.push({ Name: name, Year: "2000", Date: date, "Watched Date": date, Rating: "3.5" }); rows.watched.push({ Name: name, Year: "2000", Date: date }); }
    }
    const S = computeStudy(buildLibrary(rows), () => null, "tmdb");
    return { pace: S.months.pace.map((p) => p.big), overview: S.overview.map((o) => o.k) };
  });
  assert(dec.pace[0] === "December" && dec.overview.includes("Through the year"), `a busy December every year wasn't found: ${JSON.stringify(dec)}`);
  // every year says something in each section (owner, Oct 2026: a 186-film year showed nothing set apart or month by month)
  for (const yr of await d.$$eval("[data-insyear]", (x) => x.map((b) => b.dataset.insyear).filter((y) => y !== "all"))) {
    await d.click(`[data-insyear="${yr}"]`); await d.waitForSelector("#y-differ");
    const blank = await d.$$eval("#insights .credit", (xs) => xs.filter((x) => x.querySelector(".credit-body > .empty")).map((x) => x.id));
    assert(!blank.filter((id) => id !== "y-threads").length, `${yr}: empty sections ${blank}`);
    assert(!REPEATS.test(await txt("#insights")), `${yr} repeats the Stats page`);
    await audit(d, `desktop insights ${yr}`);
  }
  noErrors(d, "desktop");

  // the phone: every section, all years and one year
  const m = await open(browser, base, "mobile.html", { phone: true });
  await seed(m, rows, extra);
  await m.evaluate(() => { state.scope = "all"; goTo("insights", { force: true, top: true }); });
  const seen = {};
  for (const t of await m.$$eval("[data-instab]", (x) => x.map((b) => b.dataset.instab))) {
    await m.click(`[data-instab="${t}"]`); await m.waitForTimeout(60);
    seen[t] = (await m.$eval("#screen", (e) => e.textContent)).replace(/\s+/g, " ");
    assert(!REPEATS.test(seen[t]), `phone ${t} repeats the Stats page: ${seen[t].match(REPEATS)}`);
    await audit(m, `phone insights ${t}`);
  }
  assert(/October is horror month/.test(seen.habits) && /Japanese season|Akira Kurosawa season/.test(seen.chapters) && /Films in Japanese/.test(seen.ratings) && /Akira Kurosawa/.test(seen.threads),
    "the phone didn't show the planted patterns");
  await m.click('[data-scope="2023"]');
  for (const t of await m.$$eval("[data-ytab]", (x) => x.map((b) => b.dataset.ytab))) {
    await m.click(`[data-ytab="${t}"]`); await m.waitForTimeout(60);
    const s = (await m.$eval("#screen", (e) => e.textContent)).replace(/\s+/g, " ");
    if (t === "apart") assert(/in Japanese, against/.test(s), `phone 2023 didn't set its Japanese films apart: ${s.slice(0, 300)}`);
    await audit(m, `phone insights 2023 ${t}`);
  }
  noErrors(m, "phone");
  for (const p of [d, m]) await p.context().close();
}
