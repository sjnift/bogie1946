// A real export ZIP: the right files are read (not likes/reviews.csv or lists/diary.csv), and reviews keep their formatting.
import { open, assert, noErrors, JSZip } from "./lib.mjs";

async function exportZip() {
  const z = new JSZip(), f = (n, t) => z.file(n, t);
  f("profile.csv", "Date Joined,Username,Given Name\n2020-01-01,tester,T\n");
  f("watched.csv", "Date,Name,Year,Letterboxd URI\n2026-03-01,Heat,1995,https://boxd.it/a\n2026-04-01,Brick,2005,https://boxd.it/b\n");
  f("diary.csv", "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2026-03-02,Heat,1995,x,4.5,,,2026-03-01\n2026-04-02,Brick,2005,x,4,Yes,,2026-04-01\n");
  f("ratings.csv", "Date,Name,Year,Letterboxd URI,Rating\n2026-03-02,Heat,1995,x,4.5\n");
  f("reviews.csv", 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n2026-03-02,Heat,1995,x,4.5,,"<p>The <i>coffee shop</i> scene.\nWith ""quotes"".</p><script>alert(1)</script>",,2026-03-01\n');
  f("watchlist.csv", "Date,Name,Year,Letterboxd URI\n2026-01-01,Knives Out,2019,https://boxd.it/c\n");
  f("likes/films.csv", "Date,Name,Year,Letterboxd URI\n2026-01-01,Heat,1995,x\n2026-01-01,Coney Island,1917,x\n");
  f("likes/reviews.csv", "Date,Name,Year,Letterboxd URI\n");
  f("lists/diary.csv", "Letterboxd list export v7\nDate,Name,Tags,URL,Description\n2026-01-01,diary,,x,\n\nPosition,Name,Year,URL,Description\n1,Dune,2021,x,\n");
  f("deleted/reviews.csv", "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n2026-01-01,Brick,2005,x,1,,gone,,\n");
  return z.generateAsync({ type: "nodebuffer" });
}

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    await p.setInputFiles("#file-input", [{ name: "letterboxd-tester.zip", mimeType: "application/zip", buffer: await exportZip() }]);
    await p.waitForFunction(() => MY_LIB && state.mode === "mine");
    const got = await p.evaluate(() => ({ films: MY_LIB.films.map((f) => f.name).sort(), entries: MY_LIB.entries.length, reviews: MY_LIB.reviews.map((r) => r.html),
      liked: MY_LIB.films.filter((f) => f.liked).map((f) => f.name), watchlist: MY_LIB.watchlistFilms.map((w) => w.name), uri: MY_LIB.films.find((f) => f.name === "Heat").uri }));
    assert(got.films.join() === "Brick,Heat", `${file}: films ${got.films}`);
    assert(got.entries === 2, `${file}: ${got.entries} diary entries (lists/diary.csv read as the diary?)`);
    assert(got.reviews.length === 1 && got.reviews[0].includes("<i>coffee shop</i>") && !got.reviews[0].includes("script"), `${file}: review ${got.reviews[0]}`);
    assert(got.liked.join() === "Heat", `${file}: liked ${got.liked} (a liked-only film counted?)`);
    assert(got.watchlist.join() === "Knives Out" && got.uri === "https://boxd.it/a", `${file}: watchlist or film link missing`);
    const summary = await p.evaluate(() => (document.querySelector("#import-done") || {}).textContent || state.importNote);
    assert(/2 films, 2 diary entries and 1 review/.test(summary), `${file}: summary "${summary}"`);
    noErrors(p, file);
  }
}
