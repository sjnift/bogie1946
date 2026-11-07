// A film's rating changed on the site's film card (asked 7 Nov 2026: a rating changed on Letterboxd for a film watched
// in March never reached the site, the feed carrying only the latest entries): on both layouts, the film and its
// latest viewing take the new rating everywhere, nothing is counted twice, the same rating again takes it away, Undo
// gives Letterboxd's back, a newer export or a viewing logged since has the last word, another account's export isn't
// touched, the change travels like a log. No reminder about an old export (added 7 Nov 2026, removed the same day at
// the owner's request: "remove reminder").
import { open, seed, assert, noErrors } from "./lib.mjs";

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const rows = (exportedAt) => ({ profile: [{ Username: "tester" }], exportedAt, importedAt: exportedAt,
  watched: [{ Name: "Heat", Year: "1995", Date: "2026-03-10" }, { Name: "Rope", Year: "1948", Date: "2025-01-05" }],
  diary: [{ Name: "Heat", Year: "1995", Date: "2026-03-10", "Watched Date": "2026-03-10", Rating: "4" },
    { Name: "Rope", Year: "1948", Date: "2025-01-05", "Watched Date": "2025-01-05", Rating: "2.5" }, { Name: "Rope", Year: "1948", Date: "2026-02-01", "Watched Date": "2026-02-01", Rating: "3" }],
  ratings: [{ Name: "Heat", Year: "1995", Rating: "4" }, { Name: "Rope", Year: "1948", Rating: "3" }], likes: [], reviews: [], watchlist: [] });

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone, example: false });
    await seed(p, rows(daysAgo(3)));
    await p.waitForFunction(() => typeof MY_LIB === "object" && MY_LIB && MY_LIB.films.length === 2);
    const card = (name) => p.evaluate(([name, phone]) => { const f = MY_LIB.films.find((x) => x.name === name); return phone ? openSheet(D.film(f)) : openDrill(D.film(f)); }, [name, phone]);
    const panel = phone ? "#sheet" : "#dlg";
    const state = (name) => p.evaluate((name) => { const f = MY_LIB.films.find((x) => x.name === name), s = computeStats(MY_LIB, metaOf, "all");
      return { rating: f.rating, entries: f.entries.map((e) => e.rating), films: MY_LIB.films.length, all: MY_LIB.entries.length, avg: +s.avgRating.toFixed(2), rated: s.rated }; }, name);
    await card("Heat");
    await p.waitForSelector(`${panel} .fc-rate`);
    const before = await state("Heat");
    await p.click(`${panel} .fc-rate [data-fc-rate="2.5"]`);
    await p.waitForFunction(() => MY_LIB.films.find((x) => x.name === "Heat").rating === 2.5);
    const changed = await state("Heat");
    const note = await p.evaluate((panel) => ({ note: document.querySelector(`${panel} .fc-rnote`).textContent, shown: document.querySelector(`${panel} .fc-rate .lg-rv`).textContent,
      rec: store.get(KEYS.logs, []).filter((x) => x.kind === "rate").map((x) => `${x.k}:${x.rating}`).join() }), panel);
    assert(changed.rating === 2.5 && changed.entries.join() === "2.5" && changed.films === before.films && changed.all === before.all && changed.rated === before.rated
      && changed.avg === 2.75 && /Changed here on/.test(note.note) && /Letterboxd had ★★★★/.test(note.note) && note.shown === "★★½" && note.rec === "heat|1995:2.5",
      `${file}: Heat rated 2½★ here: ${JSON.stringify({ before, changed, note })}`);
    // the same rating again takes it away
    await p.click(`${panel} .fc-rate [data-fc-rate="2.5"]`);
    await p.waitForFunction(() => MY_LIB.films.find((x) => x.name === "Heat").rating == null);
    const off = await state("Heat");
    assert(off.rating == null && off.entries.join() === "" && off.rated === 1 && off.films === 2, `${file}: rating taken away: ${JSON.stringify(off)}`);
    // Undo: Letterboxd's again
    await p.click(`${panel} [data-fc-undo]`);
    await p.waitForFunction(() => MY_LIB.films.find((x) => x.name === "Heat").rating === 4);
    const undone = await p.evaluate((panel) => ({ note: document.querySelector(`${panel} .fc-rnote`).textContent, gone: store.get(KEYS.logs, []).filter((x) => x.kind === "rate" || x.deleted).map((x) => x.deleted ? "deleted" : x.rating).join() }), panel);
    assert(!/Changed here on/.test(undone.note) && undone.gone === "deleted", `${file}: undo: ${JSON.stringify(undone)}`);
    // a film seen twice: its latest viewing (which carried the film's rating) takes the new one, the earlier keeps its own
    await card("Rope");
    await p.waitForSelector(`${panel} .fc-rate`);
    await p.click(`${panel} .fc-rate [data-fc-rate="4"]`);
    await p.waitForFunction(() => MY_LIB.films.find((x) => x.name === "Rope").rating === 4);
    const rope = await state("Rope");
    assert(rope.entries.join() === "2.5,4", `${file}: Rope's viewings: ${rope.entries}`);
    // Letterboxd has the last word when it's newer: an export made after the change, or a viewing logged since
    const later = await p.evaluate(() => {
      const logs = store.get(KEYS.logs, []), R = (rows) => buildLibrary(withRates(rows, logs).rows).films.find((x) => x.name === "Rope").rating;
      const saved = store.get(KEYS.rows), tomorrow = new Date(Date.now() + 864e5).toISOString(), day = tomorrow.slice(0, 10);
      return { kept: R(saved), newerExport: R({ ...saved, exportedAt: tomorrow }), newerViewing: R({ ...saved, diary: [...saved.diary, { Name: "Rope", Year: "1948", Date: day, "Watched Date": day, Rating: "1" }], ratings: saved.ratings.map((r) => r.Name === "Rope" ? { ...r, Rating: "1" } : r) }),
        other: R({ ...saved, profile: [{ Username: "someone_else" }] }), safe: JSON.stringify(safeLogs([...logs, { id: "rtbad<x>", kind: "rate", k: "x" }, { id: "rtabcd", kind: "rate", k: "x|1", rating: 7, evil: 1, at: "2026-01-01" }])) };
    });
    assert(later.kept === 4 && later.newerExport === 3 && later.newerViewing === 1 && later.other === 3 && later.safe.includes('"kind":"rate"') && !later.safe.includes("evil") && !later.safe.includes("rtbad")
      && later.safe.includes('"k":"x|1","title":"","year":null,"rating":null'), `${file}: who has the last word: ${JSON.stringify(later)}`);
    // it lasts through a reload, and goes to the diary on the site with the logs
    await p.reload(); await p.waitForFunction(() => typeof MY_LIB === "object" && MY_LIB && MY_LIB.films.length === 2);
    const kept = await p.evaluate(() => ({ r: MY_LIB.films.find((x) => x.name === "Rope").rating, site: (siteLocal().logs || []).some((x) => x.kind === "rate") }));
    assert(kept.r === 4 && kept.site, `${file}: after a reload: ${JSON.stringify(kept)}`);
    // an old export: no reminder on the main page (the owner asked for it to go, 7 Nov 2026)
    await seed(p, rows(daysAgo(30)), { "cr-meta-v1": { "heat|1995": { src: "tmdb", v: 16, id: 949, d: ["Michael Mann"], c: [], w: [], p: [], m: [], g: ["Crime"], k: ["USA"], l: "English", r: 170 },
      "rope|1948": { src: "tmdb", v: 16, id: 1580, d: ["Alfred Hitchcock"], c: [], w: [], p: [], m: [], g: ["Thriller"], k: ["USA"], l: "English", r: 80 } } });
    await p.waitForFunction(() => typeof MY_LIB === "object" && MY_LIB && MY_LIB.films.length === 2);
    if (phone) await p.evaluate(() => { state.view = "profile"; render(); });
    else await p.evaluate(() => render());
    await p.waitForTimeout(200);
    const remind = await p.evaluate((phone) => { const t = phone ? [...document.querySelectorAll(".banner")].map((b) => b.textContent).join(" ") : $("#lookup-mini").textContent;
      return /export is \d+ days old|fresh export/i.test(t); }, phone);
    assert(!remind, `${file}: a reminder about an old export shows`);
    noErrors(p, file);
  }
  // the example diary (and anyone else's films in Compare) has no rating to change
  const ex = await open(browser, base, "desktop.html");
  await ex.evaluate(() => openDrill(D.film(state.lib.films[0])));
  await ex.waitForSelector("#dlg .fc-sec");
  assert(!(await ex.$("#dlg .fc-rate")), "the example diary's film card offers a rating change");
  noErrors(ex, "example");
}
