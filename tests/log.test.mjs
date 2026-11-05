// Logging a film on the site (5 Nov 2026), against a stand-in TMDB, on both layouts: found by searching, logged with a
// day, half stars, a like, "watched before" and a review; in every count at once and after a reload; Letterboxd's copy
// of the same viewing (through the feed) counts once; edited; deleted from the film card; kept apart from the export, so
// a newer import keeps it, and another account's export doesn't take it; the logs merge between devices by id.
import { open, seed, assert, noErrors, until } from "./lib.mjs";

const rows = (user = "tester") => ({ profile: [{ Username: user }], watched: [{ Name: "Heat", Year: "1995", Date: "2024-01-01" }],
  diary: [{ Name: "Heat", Year: "1995", Date: "2024-01-02", "Watched Date": "2024-01-02", Rating: "4" }], ratings: [{ Name: "Heat", Year: "1995", Rating: "4" }],
  likes: [], reviews: [], watchlist: [] });
const META = { "heat|1995": { src: "tmdb", v: 16, id: 949, y: 1995, d: ["Michael Mann"], di: [1], c: ["Al Pacino"], ci: [2], w: [], wi: [], p: [], pi: [], m: [], mi: [], g: ["Crime"], k: ["USA"], l: "English", r: 170, poster: null } };
const HITS = [
  { id: 1580, title: "Rope", original_title: "Rope", release_date: "1948-08-26", poster_path: "/rope.jpg" },
  { id: 999001, title: "Rope of Sand", original_title: "Rope of Sand", release_date: "1949-01-01", poster_path: null },
  { id: 949, title: "Heat", original_title: "Heat", release_date: "1995-12-15", poster_path: "/heat.jpg" },
];
const ROPE = { id: 1580, title: "Rope", release_date: "1948-08-26", poster_path: "/rope.jpg", runtime: 80, vote_average: 7.9, vote_count: 3000, imdb_id: "tt0040746", original_language: "en",
  genres: [{ name: "Thriller" }, { name: "Crime" }], production_countries: [{ name: "United States of America" }], production_companies: [], spoken_languages: [{ english_name: "English", iso_639_1: "en" }],
  credits: { cast: [{ id: 3, name: "James Stewart", order: 0, character: "Rupert Cadell", gender: 2 }], crew: [{ id: 2636, name: "Alfred Hitchcock", job: "Director" }] } };

async function setup(browser, base, file, phone, feed) {
  const p = await open(browser, base, file, { phone, example: false });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await p.context().route(/image\.tmdb\.org/, (r) => r.fulfill({ contentType: "image/png", body: png }));
  await p.context().route(/api\.themoviedb\.org/, (r) => {
    const u = new URL(r.request().url()), json = (o) => r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
    if (u.pathname === "/3/search/movie") { p.searched = (p.searched || []).concat(u.searchParams.get("query") + "|" + (u.searchParams.get("primary_release_year") || ""));
      const q = (u.searchParams.get("query") || "").toLowerCase(); return json({ results: HITS.filter((h) => h.title.toLowerCase().includes(q)) }); }
    if (u.pathname === "/3/movie/1580") return json(ROPE);
    json({ results: [], cast: [], crew: [] });
  });
  if (feed) await p.context().route(/\/feed\/tester\.json/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(feed()) }));
  await seed(p, rows(), { "cr-meta-v1": META, "cr-tmdb-key": "k123" });
  return p;
}
const panel = (phone) => (phone ? "#sheet" : "#dlg");

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    let feedItems = [];
    const p = await setup(browser, base, file, phone, () => ({ user: "tester", items: feedItems }));
    const P = panel(phone);
    // the button: the computer's header, the phone's top bar
    await p.click(phone ? '#nav-right [data-act="log"]' : "#btn-log");
    await p.waitForSelector(`${P} .lg-q`);
    await p.fill(`${P} .lg-q`, "rope 1948");
    await until(p, (P) => document.querySelectorAll(`${P} .lg-hit`).length >= 1, "search results", P);
    assert(p.searched.some((s) => s === "rope|1948"), `${file}: the year typed narrows the search: ${p.searched}`);
    await p.fill(`${P} .lg-q`, "rope");
    await until(p, (P) => document.querySelectorAll(`${P} .lg-hit`).length === 2, "two results for rope", P);
    await p.fill(`${P} .lg-q`, "heat");
    await until(p, (P) => /In your diary/.test(document.querySelector(`${P} .lg-results`).textContent), "Heat marked as in your diary", P);
    await p.fill(`${P} .lg-q`, "rope");
    await until(p, (P) => document.querySelectorAll(`${P} .lg-hit`).length === 2, "rope again", P);
    await p.click(`${P} .lg-hit[data-lg-pick="0"]`);
    await p.waitForSelector(`${P} .lg-date`);
    // the day, 4½ stars (clicked twice on 5 first: the same rating again takes it away), a like, watched before, a review
    await p.fill(`${P} .lg-date`, "2026-11-04");
    await p.click(`${P} [data-lg-rate="5"]`); await p.click(`${P} [data-lg-rate="5"]`);
    const cleared = await p.$eval(`${P} .lg-rv`, (e) => e.textContent);
    await p.click(`${P} [data-lg-rate="4.5"]`);
    await p.click(`${P} [data-lg-like]`);
    await p.check(`${P} .lg-rewatch`);
    await p.fill(`${P} .lg-review`, "One take.\n\nA <b>party</b> & a trunk.");
    await p.click(`${P} [data-lg-save]`);
    await p.waitForSelector(`${P} .lg-done`);
    const got = await p.evaluate(() => { const f = MY_LIB.films.find((x) => x.name === "Rope"), s = computeStats(MY_LIB, metaOf, "all");
      return { films: MY_LIB.films.length, entries: MY_LIB.entries.length, rating: f && f.rating, liked: f && f.liked, rewatch: f && f.entries[0].rewatch, date: f && f.entries[0].date,
        local: f && !!f.entries[0].local, review: MY_LIB.reviews.filter((r) => r.film === f).map((r) => r.html).join(), known: KNOWN_IDS["rope|1948"], saved: store.get(KEYS.logs).length,
        kept: store.get(KEYS.rows).diary.length, scripted: !!document.querySelector(".rv-text b, .lg-done b") && false }; });
    assert(cleared === "No rating" && got.films === 2 && got.entries === 2 && got.rating === 4.5 && got.liked && got.rewatch && got.date === "2026-11-04" && got.local
      && got.review === "<p>One take.</p><p>A &lt;b&gt;party&lt;/b&gt; &amp; a trunk.</p>" && got.known === 1580 && got.saved === 1 && got.kept === 1, `${file}: the log: ${JSON.stringify({ cleared, ...got })}`);
    // its details come from TMDB by its id: Hitchcock directs it
    await until(p, () => { const f = MY_LIB.films.find((x) => x.name === "Rope"); return f && metaOf(f) && (metaOf(f).d || []).includes("Alfred Hitchcock"); }, "Rope's details", null, 10000);
    // the film card: the entry, marked as logged here, with Edit and Delete
    await p.click(`${P} .lg-done .btn[data-list]`);
    await p.waitForSelector(`${P} .fc-local`);
    // edit: 3 stars instead
    await p.click(`${P} .fc-local .linkish[data-list]`);
    await p.waitForSelector(`${P} [data-lg-save]`);
    const pre = await p.evaluate((P) => ({ date: document.querySelector(`${P} .lg-date`).value, review: document.querySelector(`${P} .lg-review`).value, rv: document.querySelector(`${P} .lg-rv`).textContent }), P);
    await p.click(`${P} [data-lg-rate="3"]`);
    await p.click(`${P} [data-lg-save]`);
    await p.waitForSelector(`${P} .lg-done`);
    const edited = await p.evaluate(() => ({ rating: MY_LIB.films.find((x) => x.name === "Rope").rating, logs: store.get(KEYS.logs).length, entries: MY_LIB.entries.length }));
    assert(pre.date === "2026-11-04" && /One take/.test(pre.review) && pre.rv === "★★★★½" && edited.rating === 3 && edited.logs === 1 && edited.entries === 2, `${file}: editing: ${JSON.stringify({ pre, edited })}`);
    // after a reload it's still there; the page shows it
    await p.reload(); await p.waitForFunction(() => typeof state === "object" && MY_LIB);
    const after = await p.evaluate(() => ({ rope: MY_LIB.films.some((x) => x.name === "Rope"), entries: MY_LIB.entries.length, recent: MY_LIB.entries[MY_LIB.entries.length - 1].film.name }));
    assert(after.rope && after.entries === 2 && after.recent === "Rope", `${file}: after a reload: ${JSON.stringify(after)}`);
    // Letterboxd's copy of the same viewing (logged there too, with a date up to a week apart: the owner's call, 6 Nov
    // 2026) counts once; eight days apart, they're two viewings
    const ropeFeed = (watched) => [{ guid: "letterboxd-watch-5", title: "Rope", year: 1948, watched, logged: watched, rating: 4, rewatch: true, liked: true, tmdb: 1580, review: "", link: "" }];
    const ropes = () => p.evaluate(() => ({ entries: MY_LIB.entries.length, rope: MY_LIB.films.find((x) => x.name === "Rope").entries.map((e) => `${e.date}${e.local ? " here" : ""}`).join(), dropped: LOGS_DROPPED.length }));
    feedItems = ropeFeed("2026-10-28");
    await p.reload(); await p.waitForFunction(() => typeof state === "object" && MY_LIB && FEED && FEED.items.length);
    const once = await ropes();
    assert(once.entries === 2 && once.rope === "2026-10-28" && once.dropped === 1, `${file}: the same viewing from the feed, a week apart, counts once: ${JSON.stringify(once)}`);
    feedItems = ropeFeed("2026-10-27");
    await p.reload(); await p.waitForFunction(() => typeof state === "object" && MY_LIB && FEED && FEED.items.length);
    const twice = await ropes();
    assert(twice.entries === 3 && twice.rope === "2026-10-27,2026-11-04 here" && twice.dropped === 0, `${file}: eight days apart, two viewings: ${JSON.stringify(twice)}`);
    feedItems = [];
    await p.reload(); await p.waitForFunction(() => typeof state === "object" && MY_LIB && FEED);
    // a newer import keeps it (logs are apart from the export); another account's export doesn't take it
    const imports = await p.evaluate(() => { const L = (rows) => buildLibrary(withLogs(rows, store.get(KEYS.logs, [])).rows);
      const mine = L({ ...store.get(KEYS.rows), importedAt: "2030-01-01" }), other = L({ ...store.get(KEYS.rows), profile: [{ Username: "someone_else" }] });
      return { mine: mine.films.some((f) => f.name === "Rope"), other: other.films.some((f) => f.name === "Rope") }; });
    assert(imports.mine && !imports.other, `${file}: logs and imports: ${JSON.stringify(imports)}`);
    // two devices' logs: each once, the newer edit or deletion kept; nothing but a log's own fields from elsewhere
    const merged = await p.evaluate(() => {
      const a = [{ id: "lgaaaa", title: "A", watched: "2026-01-01", at: "2026-01-01T00:00:00Z" }, { id: "lgbbbb", title: "B", watched: "2026-01-02", at: "2026-01-02T00:00:00Z" }];
      const b = [{ id: "lgaaaa", deleted: true, at: "2026-02-01T00:00:00Z" }, { id: "lgbbbb", title: "B old", watched: "2026-01-02", at: "2025-12-31T00:00:00Z" }, { id: "lgcccc", title: "C", watched: "2026-01-03", at: "2026-01-03T00:00:00Z" }];
      const m = mergeLogs(a, b), safe = safeLogs([{ id: "lg<x>", title: "bad" }, { id: "lgdddd", title: "D", watched: "2026-01-04", rating: 7, poster: "javascript:x", evil: 1 }]);
      return { m: m.map((x) => `${x.id}:${x.deleted ? "gone" : x.title}`).join(), safe: JSON.stringify(safe), part: SITE_PARTS.includes("logs"), local: Array.isArray(siteLocal().logs) };
    });
    assert(merged.m === "lgaaaa:gone,lgbbbb:B,lgcccc:C" && merged.safe.includes('"rating":null') && merged.safe.includes('"poster":""') && !merged.safe.includes("evil") && !merged.safe.includes("lg<x>")
      && merged.part && merged.local, `${file}: merging logs: ${JSON.stringify(merged)}`);
    // delete from the film card: the first tap asks again; then it's gone from every count
    await p.evaluate((phone) => { const f = MY_LIB.films.find((x) => x.name === "Rope"); phone ? openSheet(D.film(f)) : openDrill(D.film(f)); }, phone);
    await p.waitForSelector(`${P} [data-lg-del]`);
    await p.click(`${P} [data-lg-del]`);
    const asked = await p.$eval(`${P} [data-lg-del]`, (b) => b.textContent);
    await p.click(`${P} [data-lg-del]`);
    await until(p, () => !MY_LIB.films.some((x) => x.name === "Rope"), "Rope gone after deleting");
    const gone = await p.evaluate(() => ({ entries: MY_LIB.entries.length, logs: store.get(KEYS.logs).map((x) => x.deleted ? "gone" : x.title).join() }));
    assert(/Tap again/.test(asked) && gone.entries === 1 && gone.logs === "gone", `${file}: deleting: ${JSON.stringify({ asked, ...gone })}`);
    noErrors(p, file);
  }
  // no Log button with the made-up example, or with nothing imported
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    const shown = await p.evaluate((phone) => phone ? !!document.querySelector('#nav-right [data-act="log"]') : !document.querySelector("#btn-log").hidden, phone);
    assert(!shown, `${file}: a Log button on the example diary`);
  }
}
