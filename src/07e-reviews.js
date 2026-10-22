<script>
/* ---------- desktop: reviews on the stats page, in Insights and in Compare ---------- */
const reimportNote = () => `<div class="notice"><p><strong>Your reviews aren't in yet.</strong> The copy of your export saved in this browser was made before
  review text was kept. Import your Letterboxd export again to bring your reviews in, formatting and all.</p>
  <button class="btn small" type="button" data-reimport>Import export</button></div>`;

function reviewCard(r) {
  const long = r.words > 90;
  const tags = r.tags ? `<div class="rv-tags">${r.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => `<span class="chiplet">${esc(t)}</span>`).join("")}</div>` : "";
  return `<article class="review"><div class="rv-art">${artHtml(r.film)}</div><div class="rv-body">
    <h3 class="rv-title">${esc(r.film.name)} <span class="muted">${r.film.year || ""}</span></h3>
    <div class="rv-meta"><span class="stars">${stars(r.rating)}</span>${r.film.liked ? ' <span class="muted" title="Liked">♥</span>' : ""}
      <span class="muted">${r.date ? `${r.rewatch ? "Rewatched" : "Watched"} ${fmtDate(r.date)}` : ""}${tmdbLink(r.film)}</span></div>
    <div class="rv-text${long ? " clamp" : ""}">${r.html}</div>
    ${long ? `<button class="linkish rv-more" type="button" data-expand>Read more</button>` : ""}${tags}</div></article>`;
}
function reviewMatches(scopeYear) {
  const q = (state.reviewQuery || "").trim().toLowerCase();
  const all = reviewsIn(state.lib, scopeYear);
  return { all, list: q ? all.filter((r) => r.text.toLowerCase().includes(q) || r.film.name.toLowerCase().includes(q)) : all };
}
function reviewListHtml(scopeYear) {
  const { all, list } = reviewMatches(scopeYear);
  const shown = list.slice(0, state.reviewLimit);
  const count = state.reviewQuery ? `${plural(list.length, "review")} match "${esc(state.reviewQuery)}"` : plural(all.length, "review");
  return `<p class="status" id="review-count">${count}</p>` + (shown.length ? shown.map(reviewCard).join("") : `<div class="empty">No review matches that search.</div>`) +
    (list.length > shown.length ? `<button class="btn small" type="button" data-more-reviews>Show more reviews (${fmtN(list.length - shown.length)} left)</button>` : "");
}
function reviewsBlock(s) {
  const lib = state.lib;
  if (lib.reviewTextMissing) return reimportNote();
  const year = s.scope === "all" ? null : s.scope;
  if (!reviewsIn(lib, year).length) return `<div class="empty">No reviews ${year ? `in ${year}` : "yet"}.</div>`;
  return `<div class="review-tools"><label class="sr-only" for="review-search">Search your reviews</label>
    <input id="review-search" type="search" autocomplete="off" placeholder="Search your reviews by word or title" value="${esc(state.reviewQuery || "")}"></div>
    <div id="review-list">${reviewListHtml(year)}</div>`;
}
function refreshReviewList() {
  const el = $("#review-list");
  if (el) el.innerHTML = reviewListHtml(state.scope === "all" ? null : state.scope);
}

/* ----- review insights, for all years or one ----- */
function reviewInsightsBlock(lib, Y) {
  if (lib.reviewTextMissing) return reimportNote();
  const RI = computeReviewInsights(lib, Y);
  if (!RI) return `<div class="empty">No written reviews ${Y ? `in ${Y}` : "yet"}.</div>`;
  const lines = `<ul class="trend-lines">${RI.lines.map((t) => `<li><span class="mk" aria-hidden="true">●</span><span>${esc(t)}</span></li>`).join("")}</ul>`;
  const maxN = RI.top.length ? RI.top[0][1] : 1;
  const words = RI.top.length ? `<h3 class="sub-h">Words you use most</h3><div class="wordcloud">${RI.top.map(([w, n]) =>
    `<span class="w" style="font-size:${(13 + 13 * n / maxN).toFixed(1)}px" data-tip="In ${plural(n, "review")}">${esc(w)}</span>`).join("")}</div>
    <p class="status">Counted once per review. Common words like "the" and "film" are left out.</p>` : "";
  const leaning = RI.love.length || RI.cold.length ? `<div class="ins-grid">
    <div><h3 class="sub-h">When you love a film</h3><div class="chiplets">${RI.love.map((w) => `<span class="chiplet">${esc(w)}</span>`).join("") || `<span class="status">Not enough reviews yet.</span>`}</div></div>
    <div><h3 class="sub-h">When you don't</h3><div class="chiplets">${RI.cold.map((w) => `<span class="chiplet">${esc(w)}</span>`).join("") || `<span class="status">Not enough reviews yet.</span>`}</div></div></div>
    <p class="status">Words that turn up more in your reviews of films you rated 4½★ or more than in those you rated 3★ or less, and the other way round.</p>` : "";
  const perYear = RI.perYear.length >= 2 ? `<h3 class="sub-h">Reviews each year</h3>` + colChart(RI.perYear.map((p) => ({ a: p.count, b: 0, label: `’${p.year.slice(2)}`, tip: `${p.year}: ${plural(p.count, "review")}` })), "Reviews written each year", "", 90) : "";
  const longest = `<h3 class="sub-h">Your longest review${Y ? ` of ${Y}` : ""}</h3>` + reviewCard(RI.longest);
  return lines + words + leaning + perYear + longest;
}

/* ----- in Compare: the same film, both reviews ----- */
function bothReviewedBlock(A, B) {
  const both = bothReviewed(A, B).slice(0, 6);
  if (!both.length) return `<div class="empty">No film you've both written a review of${A.lib.reviewTextMissing || B.lib.reviewTextMissing ? " (import the exports again to bring review text in)" : ""}.</div>`;
  return both.map((x) => `<div class="pair-rev"><h3 class="rv-title">${esc(x.f.name)} <span class="muted">${x.f.year || ""}</span></h3><div class="ins-grid">
    <div><div class="rv-meta"><span class="muted">You</span> <span class="stars">${stars(x.mine.rating)}</span></div><p class="rv-text">${esc(excerpt(x.mine.text))}</p></div>
    <div><div class="rv-meta"><span class="muted">${esc(B.name)}</span> <span class="stars">${stars(x.theirs.rating)}</span></div><p class="rv-text">${esc(excerpt(x.theirs.text))}</p></div></div></div>`).join("");
}
</script>
