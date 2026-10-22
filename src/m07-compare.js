<script>
/* ---------- phone: the Compare screen, pushed from Profile ---------- */
function compareScreen() {
  const profiles = comparePeople().map((p) => tasteProfile(p, metaOf));
  const friends = profiles.slice(1);
  if (state.cmp === "all" ? friends.length < 2 : !friends.some((f) => f.id === state.cmp)) state.cmp = friends.length ? friends[0].id : null;
  const ex = state.mode === "example";
  const sel = friends.find((f) => f.id === state.cmp);
  const toggles = friends.length ? `<div class="toggles" style="flex-wrap:wrap">${friends.map((f) =>
    `<button class="toggle" type="button" data-cmp="${f.id}" aria-pressed="${state.cmp === f.id}">${esc(f.name)}</button>`).join("")}
    ${friends.length >= 2 ? `<button class="toggle" type="button" data-cmp="all" aria-pressed="${state.cmp === "all"}">Everyone</button>` : ""}</div>` : "";
  const note = ex ? (MY_LIB ? "These are made-up example friends. Switch back to your diary in the Import tab to compare with real ones." : "These are made-up example friends. Import your own export first, then add friends' exports here.")
    : friends.length ? "Friends' exports stay in this browser." : "Ask a friend for their Letterboxd export (Settings → Data → Export your data), then add the ZIP here. Add as many friends as you like. Their exports stay in this browser.";
  const remove = sel && !sel.example ? `<button class="linkish" type="button" data-unfriend="${sel.id}">${state.unfriend === sel.id ? `Tap again to remove ${esc(sel.name)}` : `Remove ${esc(sel.name)}`}</button>` : "";
  const head = `${toggles}<p class="status" style="margin:12px 0 0">${note} ${remove}</p>
    ${ex ? "" : `<button class="btn block" type="button" data-act="add-friend" style="margin-top:12px"${MY_LIB ? "" : " disabled"}>Add a friend's export</button>`}
    ${state.cmpError ? `<p class="status err" role="alert">${esc(state.cmpError)}</p>` : ""}
    ${friendsSaveFailed ? `<p class="status err">This browser wouldn't save your friends' exports.</p>` : ""}`;
  if (state.cmp === "all") return head + mGroup(profiles);
  if (sel) return head + mPair(comparePair(profiles[0], sel, metaOf));
  return head;
}

const mFilms = (items, empty, cap, card) => items.length ? `<div class="pgrid">${items.map((x) => `<button class="pitem" type="button" ${dl(card(x.f))}>${poster(x.f)}${cap(x)}</button>`).join("")}</div>` : `<div class="empty">${empty}</div>`;
const twoStars = (B) => (x) => `<span class="mdate">You <span class="stars">${stars(x.a)}</span></span><span class="mdate">${esc(B.name)} <span class="stars">${stars(x.b)}</span></span>`;

function mPair(C) {
  const { A, B, match, to } = C;
  let h = sh(`You and ${esc(B.name)}`);
  h += match.score != null ? `<button class="icard" type="button" ${dl(to.rated)}><span class="k">Taste match</span><span class="big">${match.score}/100 · ${matchWords(match.score)}</span>
      <span class="p">From how close your ratings are on the ${plural(match.n, "film")} you've both rated.${go}</span></button>`
    : `<div class="empty">A taste match needs five or more films you've both rated. You have ${dlink(match.n && to.rated, match.n)}.</div>`;
  h += mLines(C.lines, () => "●");
  const o = C.overlap, tot = o.onlyA + o.both + o.onlyB || 1;
  const seg = (cls, n, d) => n ? `<span class="${cls}" role="button" tabindex="0" ${dl(d)} style="flex:${n / tot}"></span>` : "";
  h += sh("Overlap") + `<div class="venn" aria-label="${o.onlyA} only you, ${o.both} both, ${o.onlyB} only ${esc(B.name)}">
      ${seg("va", o.onlyA, to.onlyA)}${seg("vboth", o.both, to.shared)}${seg("vb", o.onlyB, to.onlyB)}</div>
    <div class="legend" style="margin-top:8px;flex-wrap:wrap"><span><i style="background:var(--green-mark)"></i>Only you ${dlink(o.onlyA && to.onlyA, fmtN(o.onlyA))}</span><span><i style="background:var(--muted)"></i>Both ${dlink(o.both && to.shared, fmtN(o.both))}</span><span><i style="background:var(--blue-mark)"></i>Only ${esc(B.name)} ${dlink(o.onlyB && to.onlyB, fmtN(o.onlyB))}</span></div>`;
  h += sh("You both loved") + mFilms(C.bothLoved, "No film you both rated 4½★ or more.", twoStars(B), to.card);
  h += sh("You rated higher") + mFilms(C.aHigher, `Nothing you rated 1½★ or more above ${esc(B.name)}.`, twoStars(B), to.card);
  h += sh(`${esc(B.name)} rated higher`) + mFilms(C.bHigher, `Nothing ${esc(B.name)} rated 1½★ or more above you.`, twoStars(B), to.card);
  h += `<p class="status" style="margin:12px 0 0">${dlink(to.apart, "Every film you've both rated, furthest apart first")}</p>`;
  h += mBothReviewed(A, B, to.card);
  if (A.rated.length && B.rated.length) {
    const mx = Math.max(1, ...A.spread, ...B.spread);
    h += sh("Rating style") + `<div class="legend" style="flex-wrap:wrap"><span><i style="background:var(--green-mark)"></i>You · ${A.avg.toFixed(2)} avg</span><span><i style="background:var(--blue-mark)"></i>${esc(B.name)} · ${B.avg.toFixed(2)} avg</span></div>
      <div class="phist" role="group" aria-label="Share of each person's ratings at each half-star">${A.spread.map((a, i) => `<button class="pgroup" type="button" ${a || B.spread[i] ? dl(to.stars((i + 1) / 2)) : "disabled"} aria-label="${stars((i + 1) / 2)}: you ${Math.round(a)}%, ${esc(B.name)} ${Math.round(B.spread[i])}%">
        <span class="pa" style="height:${(a / mx * 100).toFixed(1)}%"></span><span class="pb" style="height:${(B.spread[i] / mx * 100).toFixed(1)}%"></span></button>`).join("")}</div>
      <div class="hist-ends"><span class="stars">½</span><span class="stars">★★★★★</span></div>`;
  }
  if (C.topGenres.length) {
    const gmax = Math.max(1, ...C.topGenres.map((g) => Math.max(g.a, g.b)));
    h += sh("Genres") + C.topGenres.map((g) => `<button class="gpair" type="button" ${dl(to.genre(g.g))}><span class="gname">${esc(g.g)}</span><span class="gbars"><span class="ga" style="width:${(g.a / gmax * 100).toFixed(1)}%"></span><span class="gb" style="width:${(g.b / gmax * 100).toFixed(1)}%"></span></span>
      <span class="gv">${Math.round(g.a)}·${Math.round(g.b)}%</span></button>`).join("");
  }
  const rows = (items, val, toOf) => items.map((x) => `<button class="kv" type="button" ${dl(toOf(x))}><span>${esc(x.name || x[0])}</span><span>${val(x)}</span></button>`).join("");
  if (C.directors.shared.length) h += sh("Directors you both watch") + rows(C.directors.shared, (x) => `you ${x.a} · ${esc(B.name)} ${x.b}`, (x) => to.person(x.name, "d"));
  if (C.actors.shared.length) h += sh("Actors you both watch") + rows(C.actors.shared, (x) => `you ${x.a} · ${esc(B.name)} ${x.b}`, (x) => to.person(x.name, "c"));
  const recCap = (who) => (x) => `<span class="pmeta"><span class="stars">${stars(x.f.rating)}</span></span><span class="mdate">${who}${x.onWatchlist ? " · on your watchlist" : ""}</span>`;
  h += sh(`For you, from ${esc(B.name)}`) + mFilms(C.forA, `Nothing ${esc(B.name)} rated 4★ or more that you haven't seen.`, recCap(esc(B.name)), to.card);
  h += sh(`For ${esc(B.name)}, from you`) + mFilms(C.forB, `Nothing you rated 4★ or more that ${esc(B.name)} hasn't seen.`, recCap("You"), to.card);
  h += sh("Watch together") + (C.together.length ? C.together.map((w) => `<a class="kv" href="${esc(lbUrl(w))}" target="_blank" rel="noopener"><span>${esc(w.name)}</span><span>${w.year || ""} ↗</span></a>`).join("") : `<div class="empty">No film is on both of your watchlists.</div>`);
  h += sh("Habits") + `<div class="tscroll" style="margin-top:0"><table class="mtable"><thead><tr><th></th><th class="n">You</th><th class="n">${esc(B.name)}</th></tr></thead><tbody>${habitRows(C).map(([k, a, b]) =>
    `<tr><td>${k}</td><td class="n">${a}</td><td class="n">${b}</td></tr>`).join("")}</tbody></table></div><p class="status">Tap any number to see what's behind it.</p>`;
  return h;
}

function mGroup(profiles) {
  const G = compareGroup(profiles);
  const pairs = [];
  profiles.forEach((P, i) => profiles.forEach((Q, j) => { if (j > i && G.matrix[i][j] && G.matrix[i][j].score != null) pairs.push({ a: P.name, b: Q.name, s: G.matrix[i][j].score, to: G.pairTo(i, j) }); }));
  pairs.sort((x, y) => y.s - x.s);
  let h = sh("Taste matrix");
  if (pairs.length) h += mLines([{ text: `Closest: ${pairs[0].a} and ${pairs[0].b}, ${pairs[0].s}/100.`, to: pairs[0].to },
    pairs.length > 1 && { text: `Furthest apart: ${pairs[pairs.length - 1].a} and ${pairs[pairs.length - 1].b}, ${pairs[pairs.length - 1].s}/100.`, to: pairs[pairs.length - 1].to }].filter(Boolean), () => "●");
  h += `<div class="tscroll"><table class="mtable heat"><thead><tr><th></th>${profiles.map((p) => `<th class="n">${esc(p.name)}</th>`).join("")}</tr></thead><tbody>
    ${profiles.map((P, i) => `<tr><td>${esc(P.name)}</td>${profiles.map((_, j) => { const m = G.matrix[i][j];
      return m && m.score != null ? `<td class="n" style="background:color-mix(in srgb, var(--green-mark) ${Math.round(m.score * 0.65)}%, transparent)">${dlink(G.pairTo(i, j), m.score)}</td>` : `<td class="n dim">${m ? "—" : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="status">${dlink(G.everyone && G.everyoneTo, plural(G.everyone, "film"))} everyone has seen.</p>`;
  const all = (x) => x.by.map((b) => `<span class="mdate">${esc(b.name)} <span class="stars">${stars(b.r)}</span></span>`).join("");
  h += sh("Everyone loved") + mFilms(G.loved, "No film yet that three or more of you all rated 4★ or more.", all, G.card);
  h += sh("Most divisive") + mFilms(G.divisive, "Nothing has split the group yet.", all, G.card);
  const pickName = (p) => p.f ? dlink(G.card(p.f), `<b>${esc(p.name)}</b>`) : `<a href="${esc(lbUrl(p))}" target="_blank" rel="noopener"><b>${esc(p.name)}</b></a>`;
  h += sh("Movie night") + (G.picks.length ? G.picks.map((p) => `<div class="tline"><span class="mk">●</span><span>${pickName(p)} <span class="dim">${p.year || ""}</span>. ${esc(p.why)}.</span></div>`).join("") : `<div class="empty">No pick yet.</div>`);
  return h;
}
</script>
