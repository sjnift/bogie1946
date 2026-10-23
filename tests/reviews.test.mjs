// Reviews: a saved export without review text is spotted even when the daily feed brings a few reviews with
// words (and those still show); a Review column written in other capitals still counts; and the highest-rated
// actors need six rated films each.
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
  const cast = await d.evaluate(() => { const s = computeStats(state.lib, metaOf, "all"); return [CAST_MIN_RATED, s.cast.best.every((p) => p.ratings.length >= 6), s.directors.best.length]; });
  assert(cast[0] === 6 && cast[1] && cast[2] > 0, `highest-rated actors need six rated films: ${cast}`);
  noErrors(d, "desktop");
}
