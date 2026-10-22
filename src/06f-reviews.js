<script>
/* ---------- reviews: the words behind the ratings ---------- */
const STOPWORDS = new Set(`the and for that this with was but are not you all any can had her his one our out get has him how its may new now see two who did let put say she too use from have they will been more when what were your than then them some just into only also very much even such here most like over well back many does make made each those after where which while about would could there their these other being still really thing things through every because before again first last never ever though think know going felt feel feels lot little bit enough always something nothing anything everything someone without within around another itself himself herself myself yourself whole kind sort maybe almost quite rather pretty seem seems seemed got gets getting goes went come came comes take took make makes making give gave look looks looked watch watched watching rewatch rewatched film films movie movies cinema scene scenes character characters story time times way ways year years day days man men people`.split(/\s+/));
const reviewWords = (text) => (text.toLowerCase().match(/\p{L}[\p{L}'’-]*/gu) || [])
  .map((w) => w.replace(/’/g, "'").replace(/'s$/, "").replace(/-+$/, "")).filter((w) => w.length > 2 && !STOPWORDS.has(w));
const reviewsIn = (lib, Y) => lib.reviews.filter((r) => r.text && (!Y || (r.date || "").startsWith(Y)));

// Counts, lengths, which films you review, and the words you use, overall or for one year.
function computeReviewInsights(lib, Y) {
  const R = reviewsIn(lib, Y);
  if (!R.length) return null;
  const total = R.reduce((s, r) => s + r.words, 0);
  const byLength = [...R].sort((a, b) => b.words - a.words);
  const median = byLength[Math.floor(byLength.length / 2)].words;
  const docFreq = (list) => { const m = new Map(); for (const r of list) for (const w of new Set(reviewWords(r.text))) bump(m, w); return m; };
  const top = [...docFreq(R)].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 24);
  // words that set your reviews of loved films apart from the rest, and the other way round
  const hi = R.filter((r) => r.rating >= 4.5), lo = R.filter((r) => r.rating && r.rating <= 3);
  let love = [], cold = [];
  if (hi.length >= 4 && lo.length >= 3) {
    const dh = docFreq(hi), dl = docFreq(lo);
    const lean = (w) => Math.log(((dh.get(w) || 0) + 0.5) / (hi.length + 1)) - Math.log(((dl.get(w) || 0) + 0.5) / (lo.length + 1));
    love = [...dh.keys()].filter((w) => dh.get(w) >= 2 && lean(w) > 0).sort((a, b) => lean(b) - lean(a)).slice(0, 8);
    cold = [...dl.keys()].filter((w) => dl.get(w) >= 2 && lean(w) < 0).sort((a, b) => lean(a) - lean(b)).slice(0, 8);
  }
  const films = Y ? [...new Set(lib.entries.filter((e) => e.date.startsWith(Y)).map((e) => e.film))] : lib.films;
  const reviewed = new Set(R.map((r) => r.film));
  const rated = films.filter((f) => f.rating);
  const avgReviewed = avg(rated.filter((f) => reviewed.has(f)).map((f) => f.rating)), avgOthers = avg(rated.filter((f) => !reviewed.has(f)).map((f) => f.rating));
  const shareAt = (test) => { const fs = rated.filter((f) => test(f.rating)); return fs.length >= 3 ? pctOf(fs.filter((f) => reviewed.has(f)).length, fs.length) : null; };
  const loveShare = shareAt((r) => r >= 4.5), lowShare = shareAt((r) => r <= 2.5);
  const lines = [
    `${Y ? `In ${Y} you wrote` : "You've written"} ${plural(R.length, "review")}, about ${fmtN(total)} words in all${total >= 600 ? `: roughly ${fmtN(Math.round(total / 300))} pages of a paperback` : ""}.`,
    `A typical review runs ${plural(median, "word")}; the longest, for ${byLength[0].film.name}, runs ${fmtN(byLength[0].words)}.`,
  ];
  if (films.length) lines.push(`You've reviewed ${pctOf(reviewed.size, films.length)}% of the films you logged${Y ? ` in ${Y}` : ""}.`);
  if (avgReviewed && avgOthers && Math.abs(avgReviewed - avgOthers) >= 0.15)
    lines.push(`You review the films you ${avgReviewed > avgOthers ? "like more" : "like less"}: ${starsNum(avgReviewed)} on average for the ones you reviewed, against ${starsNum(avgOthers)} for the rest.`);
  if (loveShare != null && lowShare != null && Math.abs(loveShare - lowShare) >= 10)
    lines.push(`You review ${loveShare}% of the films you rate 4½★ or more, and ${lowShare}% of those you rate 2½★ or less.`);
  const perYear = Y ? [] : [...new Set(R.map((r) => (r.date || "").slice(0, 4)).filter(Boolean))].sort()
    .map((y) => ({ year: y, count: R.filter((r) => (r.date || "").startsWith(y)).length }));
  return { count: R.length, total, median, longest: byLength[0], top, love, cold, lines, perYear };
}
// Reviews of the same film by two people, both with text.
function bothReviewed(A, B) {
  const theirs = new Map(B.lib.reviews.filter((r) => r.text).map((r) => [r.film.key, r]));
  return A.lib.reviews.filter((r) => r.text && theirs.has(r.film.key)).map((r) => ({ f: r.film, mine: r, theirs: theirs.get(r.film.key) }));
}
// A short plain-text excerpt for side-by-side views.
const excerpt = (text, n = 220) => text.length > n ? text.slice(0, n).replace(/\s+\S*$/, "") + "…" : text;
</script>
