<script>
/* ---------- phone: reviews, review insights and side-by-side reviews ---------- */
const mReimport = () => `<div class="card glow notice"><p class="title">Your reviews' words aren't saved here yet</p>
  <p class="status">The copy of your export in this browser lists your reviews but not their text, as it was saved by an older version of this app. Download a fresh export (Letterboxd → Settings → Data → Export your data) and import it here: your reviews come in, formatting and all.</p>
  <button class="btn green block" type="button" data-act="import">Import export</button></div>`;

function mReviewItem(r) {
  const long = r.words > 60;
  return `<div class="mrev" data-k="${esc(r.film.key)}|${r.date || ""}"><button class="mrev-head" type="button" ${dl(D.film(r.film))}>${poster(r.film)}<span style="min-width:0"><span class="t" style="display:block">${esc(r.film.name)} <span>${r.film.year || ""}</span></span>
    <span class="m"><span class="stars">${stars(r.rating)}</span>${r.film.liked ? '<span class="heart">♥</span>' : ""}${r.rewatch ? '<span class="rewatch">↻</span>' : ""}<span class="dim">${r.date ? fmtDate(r.date) : ""}</span></span></span></button>
    <div class="rv-text${long ? " clamp" : ""}">${r.html}</div>${long ? `<button class="linkish" type="button" data-expand>Read more</button>` : ""}</div>`;
}
function mReviewList(year) {
  const q = (state.reviewQuery || "").trim().toLowerCase();
  const all = reviewsIn(state.lib, year);
  const list = q ? all.filter((r) => r.text.toLowerCase().includes(q) || r.film.name.toLowerCase().includes(q)) : all;
  const shown = list.slice(0, state.reviewLimit);
  return `<p class="note">${q ? `${plural(list.length, "review")} match` : plural(all.length, "review")}${year ? ` in ${year}` : ""}</p>` +
    (shown.length ? shown.map(mReviewItem).join("") : `<div class="empty">No review matches that search.</div>`) +
    (list.length > shown.length ? `<button class="row" type="button" data-more-reviews style="padding-inline:0;margin-top:8px"><span>Show more</span><span class="count">${fmtN(list.length - shown.length)} more</span>${CHEV}</button>` : "");
}
function reviewsScreen() {
  const lib = state.lib, year = state.scope === "all" ? null : state.scope;
  // the reviews that do have words (from the daily feed) still show under the note
  if (lib.reviewTextMissing) return mReimport() + (reviewsIn(lib, year).length ? `<div id="review-list">${mReviewList(year)}</div>` : "");
  if (!reviewsIn(lib, year).length) return `<div class="empty" style="padding-top:28px">No written reviews ${year ? `in ${year}` : "yet"}.</div>`;
  return `<div class="search-field">${SEARCH_ICON}<label class="sr-only" for="review-search">Search your reviews</label>
    <input id="review-search" type="search" autocomplete="off" placeholder="Search your reviews" value="${esc(state.reviewQuery || "")}"></div>
    <div id="review-list">${mReviewList(year)}</div>`;
}
function refreshReviewList() {
  const el = $("#review-list");
  if (el) morph(el, mReviewList(state.scope === "all" ? null : state.scope));
}

function mReviewInsights(lib, Y) {
  if (lib.reviewTextMissing) return mReimport();
  const RI = memo(`rev|${Y}`, () => computeReviewInsights(lib, Y));
  if (!RI) return "";
  let h = sh(Y ? `Reviews in ${esc(Y)}` : "Your reviews") + mLines(RI.lines, () => "●");
  if (RI.top.length) {
    const maxN = RI.top[0][1];
    h += sh("Words you use most") + `<div class="card"><div class="wordcloud">${RI.top.map(([w, n]) => `<button class="w" type="button" ${dl(RI.wordTo(w))} style="font-size:${(13 + 13 * n / maxN).toFixed(1)}px">${esc(w)}</button>`).join("")}</div></div>`;
  }
  const chips = (ws, to) => ws.length ? `<div class="wchips">${ws.map((w) => `<button type="button" ${dl(to(w))}>${esc(w)}</button>`).join("")}</div>` : `<p class="status">Not enough reviews yet.</p>`;
  if (RI.love.length || RI.cold.length) h += sh("Your words for…") + `<div class="card"><p class="k status">When you love a film</p>${chips(RI.love, RI.loveTo)}<p class="k status" style="margin-top:6px">When you don't</p>${chips(RI.cold, RI.coldTo)}</div>`;
  if (RI.perYear.length >= 2) h += sh("Reviews each year") + `<div class="card">${colChart(RI.perYear.map((p) => ({ a: p.count, b: 0, label: `’${p.year.slice(2)}`, tip: `${p.year}: ${plural(p.count, "review")}`, to: p.to })), "Reviews written each year", "", 80)}</div>`;
  h += sh(`Your longest review${Y ? ` of ${esc(Y)}` : ""}`) + mReviewItem(RI.longest);
  return h;
}

function mBothReviewed(A, B, card) {
  const both = bothReviewed(A, B).slice(0, 6);
  if (!both.length) return "";
  return sh("In your words") + both.map((x) => `<div class="mrev"><div class="t" style="color:var(--ink);font-weight:700">${dlink(card(x.f), esc(x.f.name))} <span class="dim">${x.f.year || ""}</span></div>
    <p class="m">You <span class="stars">${stars(x.mine.rating)}</span></p><p class="rv-text">${esc(excerpt(x.mine.text, 180))}</p>
    <p class="m">${esc(B.name)} <span class="stars">${stars(x.theirs.rating)}</span></p><p class="rv-text">${esc(excerpt(x.theirs.text, 180))}</p></div>`).join("");
}
</script>
