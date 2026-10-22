<script>
/* ---------- phone: the Compare screen, pushed from Profile ---------- */
function compareScreen() {
  LISTS = new Map();
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

const mFilms = (items, empty, cap) => items.length ? `<div class="pgrid">${items.map((x) => `<div class="pitem">${poster(x.f)}${cap(x)}</div>`).join("")}</div>` : `<div class="empty">${empty}</div>`;
const twoStars = (B) => (x) => `<span class="mdate">You <span class="stars">${stars(x.a)}</span></span><span class="mdate">${esc(B.name)} <span class="stars">${stars(x.b)}</span></span>`;

function mPair(C) {
  const { A, B, match } = C;
  let h = sh(`You and ${esc(B.name)}`);
  h += match.score != null ? `<div class="icard"><span class="k">Taste match</span><span class="big">${match.score}/100 · ${matchWords(match.score)}</span>
      <p>From how close your ratings are on the ${plural(match.n, "film")} you've both rated.</p></div>`
    : `<div class="empty">A taste match needs five or more films you've both rated. You have ${match.n}.</div>`;
  h += C.lines.map((t) => `<div class="tline"><span class="mk" aria-hidden="true">●</span><span>${esc(t)}</span></div>`).join("");
  const o = C.overlap, tot = o.onlyA + o.both + o.onlyB || 1;
  h += sh("Overlap") + `<div class="venn" role="img" aria-label="${o.onlyA} only you, ${o.both} both, ${o.onlyB} only ${esc(B.name)}">
      ${o.onlyA ? `<span class="va" style="flex:${o.onlyA / tot}"></span>` : ""}${o.both ? `<span class="vboth" style="flex:${o.both / tot}"></span>` : ""}${o.onlyB ? `<span class="vb" style="flex:${o.onlyB / tot}"></span>` : ""}</div>
    <div class="legend" style="margin-top:8px;flex-wrap:wrap"><span><i style="background:var(--green-mark)"></i>Only you ${fmtN(o.onlyA)}</span><span><i style="background:var(--muted)"></i>Both ${fmtN(o.both)}</span><span><i style="background:var(--blue-mark)"></i>Only ${esc(B.name)} ${fmtN(o.onlyB)}</span></div>`;
  h += sh("You both loved") + mFilms(C.bothLoved, "No film you both rated 4½★ or more.", twoStars(B));
  h += sh("You rated higher") + mFilms(C.aHigher, `Nothing you rated 1½★ or more above ${esc(B.name)}.`, twoStars(B));
  h += sh(`${esc(B.name)} rated higher`) + mFilms(C.bHigher, `Nothing ${esc(B.name)} rated 1½★ or more above you.`, twoStars(B));
  h += mBothReviewed(A, B);
  if (A.rated.length && B.rated.length) {
    const mx = Math.max(1, ...A.spread, ...B.spread);
    h += sh("Rating style") + `<div class="legend" style="flex-wrap:wrap"><span><i style="background:var(--green-mark)"></i>You · ${A.avg.toFixed(2)} avg</span><span><i style="background:var(--blue-mark)"></i>${esc(B.name)} · ${B.avg.toFixed(2)} avg</span></div>
      <div class="phist" role="img" aria-label="Share of each person's ratings at each half-star">${A.spread.map((a, i) => `<div class="pgroup" data-tip="${stars((i + 1) / 2)}: you ${Math.round(a)}%, ${esc(B.name)} ${Math.round(B.spread[i])}%">
        <span class="pa" style="height:${(a / mx * 100).toFixed(1)}%"></span><span class="pb" style="height:${(B.spread[i] / mx * 100).toFixed(1)}%"></span></div>`).join("")}</div>
      <div class="hist-ends"><span class="stars">½</span><span class="stars">★★★★★</span></div>`;
  }
  if (C.topGenres.length) {
    const gmax = Math.max(1, ...C.topGenres.map((g) => Math.max(g.a, g.b)));
    h += sh("Genres") + C.topGenres.map((g) => `<div class="gpair"><span class="gname">${esc(g.g)}</span><span class="gbars"><span class="ga" style="width:${(g.a / gmax * 100).toFixed(1)}%"></span><span class="gb" style="width:${(g.b / gmax * 100).toFixed(1)}%"></span></span>
      <span class="gv">${Math.round(g.a)}·${Math.round(g.b)}%</span></div>`).join("");
  }
  const rows = (items, val) => items.map((x) => `<div class="kv"><span>${esc(x.name || x[0])}</span><span>${val(x)}</span></div>`).join("");
  if (C.directors.shared.length) h += sh("Directors you both watch") + rows(C.directors.shared, (x) => `you ${x.a} · ${esc(B.name)} ${x.b}`);
  if (C.actors.shared.length) h += sh("Actors you both watch") + rows(C.actors.shared, (x) => `you ${x.a} · ${esc(B.name)} ${x.b}`);
  const recCap = (who) => (x) => `<span class="pmeta"><span class="stars">${stars(x.f.rating)}</span></span><span class="mdate">${who}${x.onWatchlist ? " · on your watchlist" : ""}</span>`;
  h += sh(`For you, from ${esc(B.name)}`) + mFilms(C.forA, `Nothing ${esc(B.name)} rated 4★ or more that you haven't seen.`, recCap(esc(B.name)));
  h += sh(`For ${esc(B.name)}, from you`) + mFilms(C.forB, `Nothing you rated 4★ or more that ${esc(B.name)} hasn't seen.`, recCap("You"));
  h += sh("Watch together") + (C.together.length ? C.together.map((w) => `<div class="kv"><span>${esc(w.name)}</span><span>${w.year || ""}</span></div>`).join("") : `<div class="empty">No film is on both of your watchlists.</div>`);
  const hr = (k, a, b) => `<tr><td>${k}</td><td class="n">${a ?? "—"}</td><td class="n">${b ?? "—"}</td></tr>`;
  h += sh("Habits") + `<div class="tscroll" style="margin-top:0"><table class="mtable"><thead><tr><th></th><th class="n">You</th><th class="n">${esc(B.name)}</th></tr></thead><tbody>
    ${hr("Films", fmtN(A.films.length), fmtN(B.films.length))}${hr("Entries a year", A.perYear && fmtN(A.perYear), B.perYear && fmtN(B.perYear))}
    ${hr("Average ★", A.avg && A.avg.toFixed(2), B.avg && B.avg.toFixed(2))}${hr("Avg release year", A.avgYear, B.avgYear)}
    ${hr("Not English", A.nonEnglish != null ? A.nonEnglish + "%" : null, B.nonEnglish != null ? B.nonEnglish + "%" : null)}
    ${hr("Weekends", A.weekend != null ? A.weekend + "%" : null, B.weekend != null ? B.weekend + "%" : null)}${hr("Rewatches", A.rewatch != null ? A.rewatch + "%" : null, B.rewatch != null ? B.rewatch + "%" : null)}</tbody></table></div>`;
  return h;
}

function mGroup(profiles) {
  const G = compareGroup(profiles);
  const pairs = [];
  profiles.forEach((P, i) => profiles.forEach((Q, j) => { if (j > i && G.matrix[i][j] && G.matrix[i][j].score != null) pairs.push({ a: P.name, b: Q.name, s: G.matrix[i][j].score }); }));
  pairs.sort((x, y) => y.s - x.s);
  let h = sh("Taste matrix");
  if (pairs.length) h += `<div class="tline"><span class="mk">●</span><span>Closest: ${esc(pairs[0].a)} and ${esc(pairs[0].b)}, ${pairs[0].s}/100.</span></div>` +
    (pairs.length > 1 ? `<div class="tline"><span class="mk">●</span><span>Furthest apart: ${esc(pairs[pairs.length - 1].a)} and ${esc(pairs[pairs.length - 1].b)}, ${pairs[pairs.length - 1].s}/100.</span></div>` : "");
  h += `<div class="tscroll"><table class="mtable heat"><thead><tr><th></th>${profiles.map((p) => `<th class="n">${esc(p.name)}</th>`).join("")}</tr></thead><tbody>
    ${profiles.map((P, i) => `<tr><td>${esc(P.name)}</td>${profiles.map((_, j) => { const m = G.matrix[i][j];
      return m && m.score != null ? `<td class="n" style="background:color-mix(in srgb, var(--green-mark) ${Math.round(m.score * 0.65)}%, transparent)">${m.score}</td>` : `<td class="n dim">${m ? "—" : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="status">${plural(G.everyone, "film")} everyone has seen.</p>`;
  const all = (x) => x.by.map((b) => `<span class="mdate">${esc(b.name)} <span class="stars">${stars(b.r)}</span></span>`).join("");
  h += sh("Everyone loved") + mFilms(G.loved, "No film yet that three or more of you all rated 4★ or more.", all);
  h += sh("Most divisive") + mFilms(G.divisive, "Nothing has split the group yet.", all);
  h += sh("Movie night") + (G.picks.length ? G.picks.map((p) => `<div class="tline"><span class="mk">●</span><span><b>${esc(p.name)}</b> <span class="dim">${p.year || ""}</span>. ${esc(p.why)}.</span></div>`).join("") : `<div class="empty">No pick yet.</div>`);
  return h;
}
</script>
