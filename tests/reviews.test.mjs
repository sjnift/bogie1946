// Reviews: a saved export without review text is spotted even when the daily feed brings a few reviews with
// words (and those still show); a Review column written in other capitals still counts; and the highest-rated
// actors over all time need six rated films each, while a single year keeps the usual minimum.
import { open, seed, assert, noErrors, JSZip } from "./lib.mjs";

const feed = { user: "tester", items: [{ guid: "letterboxd-review-1", title: "Matewan", year: 1987, watched: "2026-08-09", logged: "2026-08-09", rating: 3.5, rewatch: false, liked: true, tmdb: 1, review: "<p>Proto-Eli Sunday.</p>" }] };
const old = { profile: [{ Username: "tester" }], watched: [{ Name: "Heat", Year: "1995" }, { Name: "Brick", Year: "2005" }], ratings: [],
  diary: [{ Name: "Heat", Year: "1995", "Watched Date": "2026-03-01" }, { Name: "Brick", Year: "2005", "Watched Date": "2026-04-01" }],
  reviews: [{ Name: "Heat", Year: "1995", Date: "2026-03-02", "Watched Date": "2026-03-01", Rating: "4.5" }, { Name: "Brick", Year: "2005", Date: "2026-04-02", "Watched Date": "2026-04-01", Rating: "4" }] };

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    await p.context().route(/\/feed\/tester\.json/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(feed) }));
    await seed(p, old);
    await p.waitForFunction(() => FEED);
    assert(await p.evaluate(() => MY_LIB.reviewTextMissing), `${file}: an export saved without review text wasn't spotted because the feed has a review`);
    if (phone) { await p.click('#screen [data-act="reviews"]'); await p.waitForTimeout(150); }
    else { await p.click('#jump [data-chapter="reviews"]'); await p.waitForTimeout(150); } // the computer's Reviews chapter
    const shown = await p.evaluate(() => document.body.innerText);
    assert(/words aren't saved here yet/.test(shown) && /Proto-Eli Sunday/.test(shown), `${file}: reviews page: ${shown.slice(0, 300)}`);

    // a fresh export brings the words in, whatever the capitals of its Review column
    const z = new JSZip();
    z.file("profile.csv", "Date Joined,Username\n2020-01-01,tester\n");
    z.file("watched.csv", "Date,Name,Year,Letterboxd URI\n2026-03-01,Heat,1995,x\n");
    z.file("reviews.csv", "Date,Name,Year,Letterboxd URI,Rating,Rewatch, review ,Tags,Watched Date\n2026-03-02,Heat,1995,x,4.5,,The coffee shop.,,2026-03-01\n");
    await p.setInputFiles("#file-input", [{ name: "export.zip", mimeType: "application/zip", buffer: await z.generateAsync({ type: "nodebuffer" }) }]);
    await p.waitForFunction(() => MY_LIB.reviews.some((r) => r.text === "The coffee shop."));
    assert(!(await p.evaluate(() => MY_LIB.reviewTextMissing)), `${file}: still flagged after a fresh export`);
    noErrors(p, file);
  }
  const d = await open(browser, base, "desktop.html");
  // six rated films over all time, two of them billed in the top 8; in a year, the most rated films that still lists
  // ten actors (2 at least, 6 at most), one of them billed in the top 8
  const cast = await d.evaluate(() => {
    const s = computeStats(state.lib, metaOf, "all");
    const fair = (y) => { const all = rankPeople(y.films, metaOf, "c", 1, 1).best, n = (t) => all.filter((p) => p.ratings.length >= t).length, t = y.castMinRated;
      return y.cast.best.length === n(t) && y.cast.best.every((p) => p.ratings.length >= t && p.lead >= 1) && t <= 6 && (t === 6 || n(t + 1) < 10) && (n(t) >= 10 || t <= 2); };
    const years = [...new Set(state.lib.entries.map((e) => e.date.slice(0, 4)))].map((yr) => computeStats(state.lib, metaOf, yr));
    const lead = rankPeople(state.lib.films, metaOf, "c", 6).best.filter((p) => p.lead < 2).length; // left out for small parts
    return [s.castMinRated, s.cast.best.every((p) => p.ratings.length >= 6 && p.lead >= 2), years.length > 0, years.every(fair), years.some((y) => y.cast.best.length > 0),
      s.cast.best.length + lead === rankPeople(state.lib.films, metaOf, "c", 6).best.length, /2 of them billed in the top 8/.test(castBarText(s))]; });
  assert(cast.join() === "6,true,true,true,true,true,true", `highest-rated actors: six rated films over all time, two billed in the top 8, a bar that follows each year: ${cast}`);
  // with a filter on (a decade, 6 Nov 2026), all time follows its films too: the bar comes down from 6 only where fewer
  // than ten actors would make it; two films billed in the top 8 while it stays at 6, one once it comes down; the line
  // under Starring says so, on both layouts
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = phone ? await open(browser, base, file, { phone }) : d;
    const f = await p.evaluate(() => {
      const base = typeof wholeLib === "function" ? wholeLib() : BASE_LIB; // the whole diary, on each layout
      const dec = filterOptions(base, metaOf, "d").sort((a, b) => b[1] - a[1]);
      const out = [];
      for (const [d] of dec) {
        FILTER.d = [d];
        const F = filteredLib(base, metaOf), s = computeStats(F, metaOf, "all"), t = s.castMinRated;
        const all = rankPeople(s.films, metaOf, "c", 1, 1).best, n = (k) => all.filter((p) => p.ratings.length >= k).length, lead = t >= 6 ? 2 : 1;
        out.push({ d, t, lead: s.castLead, films: s.films.length, ok: s.castLead === lead && s.cast.best.every((p) => p.ratings.length >= t && p.lead >= lead)
          && s.cast.best.length === all.filter((p) => p.ratings.length >= t && p.lead >= lead).length && (t === 6 || n(t + 1) < 10) && (n(t) >= 10 || t <= 2),
          text: castBarText(s) });
      }
      clearFilters();
      return out;
    });
    assert(f.length >= 2 && f.every((x) => x.ok) && f.some((x) => x.t < 6) && f.filter((x) => x.t < 6).every((x) => / one billed in the top 8/.test(x.text)),
      `${file}: highest-rated actors with a decade filter on: ${JSON.stringify(f)}`);
    // and on the page: the line under the actors says the decade's bar
    const low = f.find((x) => x.t < 6);
    await p.evaluate((d) => { FILTER.d = [d]; refreshFilters(); }, low.d); await p.waitForTimeout(300);
    if (phone) { await p.evaluate(() => { state.view = "people"; state.role = "c"; state.sort = "best"; render(); }); await p.waitForTimeout(200); }
    else { await p.evaluate(() => { setChapter("people"); }); await p.waitForTimeout(300); }
    const shown = await p.evaluate(() => document.body.textContent.includes(castBarText(computeStats(filteredLib(typeof wholeLib === "function" ? wholeLib() : BASE_LIB, metaOf), metaOf, "all"))));
    assert(shown, `${file}: the line under the actors with ${low.d} on`);
    await p.evaluate(() => { clearFilters(); refreshFilters(); }); await p.waitForTimeout(200);
    if (phone) noErrors(p, file);
  }
  // the bar for a year: the most rated films that still lists ten actors, from 6 down to 2
  const bars = await d.evaluate(() => { const ppl = (counts) => counts.map((n) => ({ ratings: Array(n).fill(4) }));
    return [castBar(ppl(Array(11).fill(9))), castBar(ppl([...Array(10).fill(5), 2])), castBar(ppl([...Array(5).fill(4), ...Array(7).fill(3)])), castBar(ppl([2, 2, 1])), castBar([])]; });
  assert(bars.join() === "6,5,3,2,2", `the year's bar for highest-rated actors: ${bars}`);
  noErrors(d, "desktop");
}
