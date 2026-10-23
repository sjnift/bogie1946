<script>
/* ---------- desktop: reviews on the stats page, in Insights and in Compare ---------- */
const reimportNote = () => `<div class="notice"><p><strong>Your reviews' words aren't saved here yet.</strong> The copy of your export in this browser lists your
  reviews but not their text, as it was saved by an older version of this page. Download a fresh export (Letterboxd → Settings → Data → Export your data)
  and import it here: your reviews come in, formatting and all. Reviews from your daily feed show below meanwhile.</p>
  <button class="btn small" type="button" data-reimport>Import export</button></div>`;

// `short`: the stats page's few reviews, cut to a few lines each.
function reviewCard(r, short) {
  const long = r.words > (short ? 45 : 90);
  const tags = r.tags ? `<div class="rv-tags">${r.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => `<span class="chiplet">${esc(t)}</span>`).join("")}</div>` : "";
  const card = D.film(r.film);
  return `<article class="review${short ? " short" : ""}"><button class="rv-art poster" type="button" ${dl(card)} aria-label="${esc(r.film.name)}">${artHtml(r.film)}</button><div class="rv-body">
    <h3 class="rv-title">${dlink(card, esc(r.film.name))} <span class="muted">${r.film.year || ""}</span></h3>
    <div class="rv-meta"><span class="stars">${stars(r.rating)}</span>${r.film.liked ? ' <span class="muted" title="Liked">♥</span>' : ""}
      <span class="muted">${r.date ? `${r.rewatch ? "Rewatched" : "Watched"} ${fmtDate(r.date)}` : ""}${tmdbLink(r.film)}</span></div>
    <div class="rv-text${long ? ` clamp${short ? " short" : ""}` : ""}">${r.html}</div>
    ${long ? `<button class="linkish rv-more" type="button" data-expand>Read more</button>` : ""}${tags}</div></article>`;
}
function reviewMatches(scopeYear) {
  const q = (state.reviewQuery || "").trim().toLowerCase();
  const all = reviewsIn(state.lib, scopeYear);
  return { all, list: q ? all.filter((r) => r.text.toLowerCase().includes(q) || r.film.name.toLowerCase().includes(q)) : all };
}
// The stats page shows the latest few (or the first few that match a search); the rest open in the pop-up.
const REVIEWS_SHOWN = 3;
function reviewListHtml(scopeYear) {
  const { all, list } = reviewMatches(scopeYear), q = state.reviewQuery;
  const shown = list.slice(0, REVIEWS_SHOWN);
  const count = q ? `${plural(list.length, "review")} match "${esc(q)}"` : `${plural(all.length, "review")}${all.length > shown.length ? `, the latest ${shown.length} here` : ""}`;
  const rest = list.length > shown.length ? `<p class="status rv-all">${dlink(D.reviews(q ? `Reviews matching "${q}"` : scopeYear ? `Reviews in ${scopeYear}` : "Your reviews", "Newest first", list),
    q ? `All ${fmtN(list.length)} matching reviews` : `All ${fmtN(list.length)} reviews`)}</p>` : "";
  return `<p class="status" id="review-count">${count}</p>` + (shown.length ? shown.map((r) => reviewCard(r, true)).join("") : `<div class="empty">No review matches that search.</div>`) + rest;
}
function reviewsBlock(s) {
  const lib = state.lib;
  const year = s.scope === "all" ? null : s.scope;
  // the reviews that do have words (from the daily feed) still show under the note
  if (lib.reviewTextMissing) return reimportNote() + (reviewsIn(lib, year).length ? `<div id="review-list">${reviewListHtml(year)}</div>` : "");
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
  const lines = lineItems(RI.lines, () => "●");
  const maxN = RI.top.length ? RI.top[0][1] : 1;
  const words = RI.top.length ? `<h3 class="sub-h">Words you use most</h3><div class="wordcloud">${RI.top.map(([w, n]) =>
    `<button class="w" type="button" ${dl(RI.wordTo(w))} style="font-size:${(13 + 13 * n / maxN).toFixed(1)}px" data-tip="In ${plural(n, "review")}">${esc(w)}</button>`).join("")}</div>
    <p class="status">Counted once per review. Common words like "the" and "film" are left out.</p>` : "";
  const leaning = RI.love.length || RI.cold.length ? `<div class="ins-grid">
    <div><h3 class="sub-h">When you love a film</h3><div class="chiplets">${RI.love.map((w) => `<button class="chiplet" type="button" ${dl(RI.loveTo(w))}>${esc(w)}</button>`).join("") || `<span class="status">Not enough reviews yet.</span>`}</div></div>
    <div><h3 class="sub-h">When you don't</h3><div class="chiplets">${RI.cold.map((w) => `<button class="chiplet" type="button" ${dl(RI.coldTo(w))}>${esc(w)}</button>`).join("") || `<span class="status">Not enough reviews yet.</span>`}</div></div></div>
    <p class="status">Words that turn up more in your reviews of films you rated 4½★ or more than in those you rated 3★ or less, and the other way round.</p>` : "";
  const perYear = RI.perYear.length >= 2 ? `<h3 class="sub-h">Reviews each year</h3>` + colChart(RI.perYear.map((p) => ({ a: p.count, b: 0, label: `’${p.year.slice(2)}`, tip: `${p.year}: ${plural(p.count, "review")}`, to: p.to })), "Reviews written each year", "", 90) : "";
  const longest = `<h3 class="sub-h">Your longest review${Y ? ` of ${Y}` : ""}</h3>` + reviewCard(RI.longest);
  return lines + words + leaning + perYear + longest;
}

/* ----- in Compare: the same film, both reviews ----- */
function bothReviewedBlock(A, B, card) {
  const both = bothReviewed(A, B).slice(0, 6);
  if (!both.length) return `<div class="empty">No film you've both written a review of${A.lib.reviewTextMissing || B.lib.reviewTextMissing ? " (import the exports again to bring review text in)" : ""}.</div>`;
  return both.map((x) => `<div class="pair-rev"><h3 class="rv-title">${dlink(card(x.f), esc(x.f.name))} <span class="muted">${x.f.year || ""}</span></h3><div class="ins-grid">
    <div><div class="rv-meta"><span class="muted">You</span> <span class="stars">${stars(x.mine.rating)}</span></div><p class="rv-text">${esc(excerpt(x.mine.text))}</p></div>
    <div><div class="rv-meta"><span class="muted">${esc(B.name)}</span> <span class="stars">${stars(x.theirs.rating)}</span></div><p class="rv-text">${esc(excerpt(x.theirs.text))}</p></div></div></div>`).join("");
}
</script>
