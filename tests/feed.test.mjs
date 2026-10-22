// The daily feed: the workflow's script reads a Letterboxd RSS feed into JSON, and the site adds its new
// entries (with ratings, likes, reviews and TMDB ids) to an imported diary without touching the export.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ROOT, open, seed, assert, noErrors } from "./lib.mjs";

const RSS = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org"><channel>
<item><title>Heat, 1995 - ★★★★★</title><link>https://letterboxd.com/tester/film/heat-1995/1/</link><guid isPermaLink="false">letterboxd-review-2</guid><pubDate>Wed, 21 Oct 2026 21:10:44 +0000</pubDate>
<letterboxd:watchedDate>2026-10-20</letterboxd:watchedDate><letterboxd:rewatch>Yes</letterboxd:rewatch><letterboxd:filmTitle>Heat</letterboxd:filmTitle><letterboxd:filmYear>1995</letterboxd:filmYear>
<letterboxd:memberRating>5.0</letterboxd:memberRating><letterboxd:memberLike>Yes</letterboxd:memberLike><tmdb:movieId>949</tmdb:movieId>
<description><![CDATA[<p><img src="https://a.ltrbxd.com/x.jpg"/></p> <p><em>This review may contain spoilers.</em></p> <p>Even <i>better</i> on the big screen &amp; louder.</p>]]></description></item>
<item><title>Brick, 2005</title><guid isPermaLink="false">letterboxd-watch-1</guid><pubDate>Sat, 3 Feb 2024 10:00:00 +0000</pubDate><letterboxd:watchedDate>2024-02-03</letterboxd:watchedDate>
<letterboxd:rewatch>No</letterboxd:rewatch><letterboxd:filmTitle>Brick</letterboxd:filmTitle><letterboxd:filmYear>2005</letterboxd:filmYear><letterboxd:memberRating>4.0</letterboxd:memberRating><tmdb:movieId>9270</tmdb:movieId>
<description><![CDATA[<p><img src="https://a.ltrbxd.com/y.jpg"/></p> <p>Watched on Saturday February 3, 2024.</p>]]></description></item>
<item><title>Love &amp; Mercy, 2014</title><guid isPermaLink="false">letterboxd-watch-3</guid><pubDate>Mon, 19 Oct 2026 10:00:00 +0000</pubDate><letterboxd:watchedDate>2026-10-19</letterboxd:watchedDate>
<letterboxd:rewatch>No</letterboxd:rewatch><letterboxd:filmTitle>Love &amp; Mercy</letterboxd:filmTitle><letterboxd:filmYear>2014</letterboxd:filmYear><tmdb:movieId>271714</tmdb:movieId>
<description><![CDATA[<p>Watched on Monday October 19, 2026.</p>]]></description></item>
<item><title>A list</title><guid isPermaLink="false">letterboxd-list-9</guid><description><![CDATA[<p>list</p>]]></description></item></channel></rss>`;

export default async function ({ browser, base }) {
  // the script, with Letterboxd stood in for by a preloaded fetch
  const dir = await mkdtemp(path.join(os.tmpdir(), "feed-"));
  await writeFile(path.join(dir, "mock.mjs"), `globalThis.fetch = async (url) => ({ ok: true, status: 200, headers: new Map(), text: async () => ${JSON.stringify(RSS)} });`);
  await writeFile(path.join(dir, "feed-users.txt"), "# usernames\ntester\n");
  const run = () => promisify(execFile)(process.execPath, ["--import", path.join(dir, "mock.mjs"), path.join(ROOT, "scripts/feed.mjs")], { cwd: dir });
  const out = await run();
  assert(/tester: 3 entries in the feed, 3 new/.test(out.stdout), `script said: ${out.stdout}`);
  const feed = JSON.parse(await readFile(path.join(dir, "docs/feed/tester.json"), "utf8"));
  const heat = feed.items.find((x) => x.title === "Heat");
  assert(feed.items.length === 3 && heat.rating === 5 && heat.rewatch && heat.liked && heat.tmdb === 949 && heat.review === "<p>Even <i>better</i> on the big screen &amp; louder.</p>", `parsed: ${JSON.stringify(heat)}`);
  assert(feed.items.find((x) => x.title === "Love & Mercy").review === "", "a watch without a review got one");
  assert(/0 new/.test((await run()).stdout), "a second run added entries again");

  // the site
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    await p.context().route(/\/feed\/tester\.json/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(feed) }));
    await seed(p, { profile: [{ Username: "Tester" }], watched: [{ Name: "Heat", Year: "1995" }, { Name: "Brick", Year: "2005" }],
      diary: [{ Name: "Heat", Year: "1995", "Watched Date": "2024-01-01", Rating: "4.5" }, { Name: "Brick", Year: "2005", "Watched Date": "2024-02-03", Rating: "4" }],
      ratings: [{ Name: "Heat", Year: "1995", Rating: "4.5" }, { Name: "Brick", Year: "2005", Rating: "4" }], reviews: [], likes: [] });
    await p.waitForFunction(() => FEED && MY_LIB.films.length === 3);
    const got = await p.evaluate(() => ({ films: MY_LIB.films.map((f) => `${f.name} ${f.entries.length}${f.liked ? "♥" : ""}`).join(), reviews: MY_LIB.reviews.length, known: KNOWN_IDS["love & mercy|2014"], kept: store.get(KEYS.rows).diary.length }));
    assert(got.films === "Heat 2♥,Brick 1,Love & Mercy 1" && got.reviews === 1 && got.known === 271714 && got.kept === 2, `${file}: ${JSON.stringify(got)}`);
    noErrors(p, file);
  }
}
