<script>
/* ---------- phone: reviews, review insights and side-by-side reviews ---------- */
const mReimport = () => `<div class="card notice"><p class="title">Your reviews aren't in yet.</p>
  <p>The copy of your export saved here was made before review text was kept. Import your Letterboxd export again to bring your reviews in, formatting and all.</p>
  <button class="btn green block" type="button" data-act="import">Import export</button></div>`;

function mReviewItem(r) {
  const long = r.words > 60;
  return `<div class="mrev"><div class="mrev-head">${poster(r.film)}<div style="min-width:0"><div class="t">${esc(r.film.name)} <span>${r.film.year || ""}</span></div>
    <div class="m"><span class="stars">${stars(r.rating)}</span>${r.film.liked ? '<span class="heart">♥</span>' : ""}${r.rewatch ? '<span class="rewatch">↻</span>' : ""}<span class="dim">${r.date ? fmtDate(r.date) : ""}</span></div></div></div>
    <div class="rv-text${long ? " clamp" : ""}">${r.html}</div>${long ? `<button class="linkish" type="button" data-expand>More</button>` : ""}</div>`;
}
function mReviewList(year) {
  const q = (state.reviewQuery || "").trim().toLowerCase();
  const all = reviewsIn(state.lib, year);
  const list = q ? all.filter((r) => r.text.toLowerCase().includes(q) || r.film.name.toLowerCase().includes(q)) : all;
  const shown = list.slice(0, state.reviewLimit);
  return `<p class="status" style="margin:10px 0 0">${q ? `${plural(list.length, "review")} match` : plural(all.length, "review")}</p>` +
    (shown.length ? shown.map(mReviewItem).join("") : `<div class="empty">No review matches that search.</div>`) +
    (list.length > shown.length ? `<button class="row" type="button" data-more-reviews><span>Show more</span><span class="count">${fmtN(list.length - shown.length)} more</span>${CHEV}</button>` : "");
}
function reviewsScreen() {
  const lib = state.lib, year = state.scope === "all" ? null : state.scope;
  if (lib.reviewTextMissing) return mReimport();
  if (!reviewsIn(lib, year).length) return `<div class="empty" style="padding-top:28px">No written reviews ${year ? `in ${year}` : "yet"}.</div>`;
  return `<label class="sr-only" for="review-search">Search your reviews</label>
    <input class="key" id="review-search" type="search" autocomplete="off" placeholder="Search reviews" value="${esc(state.reviewQuery || "")}" style="margin-top:14px;font-family:var(--sans)">
    ${year ? `<p class="status" style="margin:8px 0 0">Showing ${year}. Pick another year on Profile.</p>` : ""}
    <div id="review-list">${mReviewList(year)}</div>`;
}
function refreshReviewList() {
  const el = $("#review-list");
  if (el) el.innerHTML = mReviewList(state.scope === "all" ? null : state.scope);
}

function mReviewInsights(lib, Y) {
  if (lib.reviewTextMissing) return sh(Y ? `Reviews in ${esc(Y)}` : "Your reviews") + mReimport();
  const RI = computeReviewInsights(lib, Y);
  if (!RI) return "";
  let h = sh(Y ? `Reviews in ${esc(Y)}` : "Your reviews") + RI.lines.map((t) => `<div class="tline"><span class="mk" aria-hidden="true">●</span><span>${esc(t)}</span></div>`).join("");
  if (RI.top.length) {
    const maxN = RI.top[0][1];
    h += `<p class="status" style="margin:12px 0 6px">Words you use most</p><div class="wordcloud">${RI.top.map(([w, n]) => `<span class="w" style="font-size:${(12 + 11 * n / maxN).toFixed(1)}px">${esc(w)}</span>`).join("")}</div>`;
  }
  const chips = (ws) => ws.length ? `<div class="wchips">${ws.map((w) => `<span>${esc(w)}</span>`).join("")}</div>` : `<p class="status">Not enough reviews yet.</p>`;
  if (RI.love.length || RI.cold.length) h += `<p class="status" style="margin:14px 0 6px">When you love a film</p>${chips(RI.love)}<p class="status" style="margin:12px 0 6px">When you don't</p>${chips(RI.cold)}`;
  h += `<p class="status" style="margin:14px 0 0">Your longest review${Y ? ` of ${esc(Y)}` : ""}</p>` + mReviewItem(RI.longest);
  return h;
}

function mBothReviewed(A, B) {
  const both = bothReviewed(A, B).slice(0, 6);
  if (!both.length) return "";
  return sh("In your words") + both.map((x) => `<div class="mrev"><div class="t" style="color:var(--ink);font-weight:600">${esc(x.f.name)} <span class="dim">${x.f.year || ""}</span></div>
    <p class="m" style="margin:6px 0 2px">You <span class="stars">${stars(x.mine.rating)}</span></p><p class="rv-text" style="margin:0">${esc(excerpt(x.mine.text, 180))}</p>
    <p class="m" style="margin:8px 0 2px">${esc(B.name)} <span class="stars">${stars(x.theirs.rating)}</span></p><p class="rv-text" style="margin:0">${esc(excerpt(x.theirs.text, 180))}</p></div>`).join("");
}
</script>
