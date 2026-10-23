<script>
/* ---------- phone: Compare, a tab of its own. Friend chips at the top; a pair splits into sections. ---------- */
const CMP_TABS = [["overview", "Overview"], ["films", "Films"], ["ratings", "Ratings"], ["people", "People"], ["picks", "Picks"], ["habits", "Habits"]];
function compareScreen() {
  const profiles = memo("profiles", () => comparePeople().map((p) => tasteProfile(p, metaOf)));
  const friends = profiles.slice(1);
  if (state.cmp === "all" ? friends.length < 2 : !friends.some((f) => f.id === state.cmp)) state.cmp = friends.length ? friends[0].id : null;
  const ex = state.mode === "example";
  const sel = friends.find((f) => f.id === state.cmp);
  const chips = friends.length || !ex ? `<div class="chips" role="group" aria-label="Friends">${friends.map((f) =>
    `<button class="chip" type="button" data-cmp="${esc(f.id)}" aria-pressed="${state.cmp === f.id}">${avatar({ name: f.name }, "xs")}${esc(f.name)}</button>`).join("")}
    ${friends.length >= 2 ? `<button class="chip" type="button" data-cmp="all" aria-pressed="${state.cmp === "all"}">Everyone</button>` : ""}
    ${ex ? "" : `<button class="chip add" type="button" data-act="add-friend"${MY_LIB ? "" : " disabled"}>${ICON.plus}Add a friend</button>`}</div>` : "";
  const note = ex ? (MY_LIB ? "These are made-up example friends. Switch back to your diary in Settings to compare with real ones." : "These are made-up example friends. Import your own export first, then add friends' exports here.")
    : friends.length ? "Friends' exports stay in this browser." : "Ask a friend for their Letterboxd export (Settings → Data → Export your data), then add the ZIP here. Add as many friends as you like. Their exports stay in this browser.";
  const remove = sel && !sel.example ? ` <button class="linkish" type="button" data-unfriend="${esc(sel.id)}">${state.unfriend === sel.id ? `Tap again to remove ${esc(sel.name)}` : `Remove ${esc(sel.name)}`}</button>` : "";
  const head = ltitle("Compare") + chips + `<p class="note">${note}${remove}</p>
    ${!ex && !friends.length ? `<button class="btn green block" type="button" data-act="add-friend" style="margin-top:14px"${MY_LIB ? "" : " disabled"}>${ICON.plus}Add a friend's export</button>` : ""}
    ${state.cmpError ? `<p class="status err" role="alert" style="margin-top:10px">${esc(state.cmpError)}</p>` : ""}
    ${friendsSaveFailed ? `<p class="status err">This browser wouldn't save your friends' exports.</p>` : ""}`;
  if (state.cmp === "all") return head + mGroup(profiles);
  if (sel) {
    if (!CMP_TABS.some(([k]) => k === state.cmpTab)) state.cmpTab = "overview";
    return head + utabs("cmptab", CMP_TABS, state.cmpTab) + mPair(memo(`pair|${sel.id}`, () => comparePair(profiles[0], sel, metaOf)), state.cmpTab);
  }
  return head;
}

const mFilms = (items, empty, cap, card) => items.length ? `<div class="pgrid">${items.map((x) => `<button class="pitem" type="button" ${dl(card(x.f))}>${poster(x.f)}${cap(x)}</button>`).join("")}</div>` : `<div class="empty">${empty}</div>`;
const twoStars = (B) => (x) => `<span class="mdate">You <span class="stars">${stars(x.a)}</span></span><span class="mdate">${esc(B.name)} <span class="stars">${stars(x.b)}</span></span>`;
// the taste match as a ring
const ring = (score) => { const r = 44, c = 2 * Math.PI * r;
  return `<span class="ring" aria-hidden="true"><svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="9"/>
    <circle cx="52" cy="52" r="${r}" fill="none" stroke="var(--green)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(c * score / 100).toFixed(1)} ${c.toFixed(1)}"/></svg><b>${score}</b></span>`; };

function mPair(C, tab) {
  const { A, B, match, to } = C;
  if (tab === "films") return sh("You both loved") + mFilms(C.bothLoved, "No film you both rated 4½★ or more.", twoStars(B), to.card) +
    sh("You rated higher") + mFilms(C.aHigher, `Nothing you rated 1½★ or more above ${esc(B.name)}.`, twoStars(B), to.card) +
    sh(`${esc(B.name)} rated higher`) + mFilms(C.bHigher, `Nothing ${esc(B.name)} rated 1½★ or more above you.`, twoStars(B), to.card) +
    `<p class="note">${dlink(to.apart, "Every film you've both rated, furthest apart first")}</p>` + mBothReviewed(A, B, to.card);
  if (tab === "ratings") {
    let h = "";
    if (A.rated.length && B.rated.length) {
      const mx = Math.max(1, ...A.spread, ...B.spread);
      h += sh("Rating style") + `<div class="card"><div class="legend"><span><i style="background:var(--green-mark)"></i>You · ${A.avg.toFixed(2)} avg</span><span><i style="background:var(--blue-mark)"></i>${esc(B.name)} · ${B.avg.toFixed(2)} avg</span></div>
        <div class="phist" role="group" aria-label="Share of each person's ratings at each half-star">${A.spread.map((a, i) => `<button class="pgroup" type="button" ${a || B.spread[i] ? dl(to.stars((i + 1) / 2)) : "disabled"} aria-label="${stars((i + 1) / 2)}: you ${Math.round(a)}%, ${esc(B.name)} ${Math.round(B.spread[i])}%">
          <span class="pa" style="height:${(a / mx * 100).toFixed(1)}%"></span><span class="pb" style="height:${(B.spread[i] / mx * 100).toFixed(1)}%"></span></button>`).join("")}</div>
        <div class="hist-ends"><span class="stars">½</span><span class="stars">★★★★★</span></div></div>`;
    }
    if (C.topGenres.length) {
      const gmax = Math.max(1, ...C.topGenres.map((g) => Math.max(g.a, g.b)));
      h += sh("Genres", `<span class="count">share of each diary</span>`) + `<div class="group">${C.topGenres.map((g) => `<button class="gpair" type="button" ${dl(to.genre(g.g))}><span class="gname">${esc(g.g)}</span><span class="gbars"><span class="ga" style="width:${(g.a / gmax * 100).toFixed(1)}%"></span><span class="gb" style="width:${(g.b / gmax * 100).toFixed(1)}%"></span></span>
        <span class="gv">${Math.round(g.a)}·${Math.round(g.b)}%</span></button>`).join("")}</div>`;
    }
    return h || `<div class="empty">Not enough ratings to compare yet.</div>`;
  }
  if (tab === "people") {
    const rows = (items, val, toOf) => `<div class="group">${items.map((x) => `<button class="kv" type="button" ${dl(toOf(x))}><span>${esc(x.name || x[0])}</span><span>${val(x)}</span></button>`).join("")}</div>`;
    let h = "";
    if (C.directors.shared.length) h += sh("Directors you both watch") + rows(C.directors.shared, (x) => `you ${x.a} · ${esc(B.name)} ${x.b}`, (x) => to.person(x.name, "d"));
    if (C.actors.shared.length) h += sh("Actors you both watch") + rows(C.actors.shared, (x) => `you ${x.a} · ${esc(B.name)} ${x.b}`, (x) => to.person(x.name, "c"));
    return h || `<div class="empty">No director or actor you've both watched more than once yet.</div>`;
  }
  if (tab === "picks") {
    const recCap = (who) => (x) => `<span class="pmeta"><span class="stars">${stars(x.f.rating)}</span></span><span class="mdate">${who}${x.onWatchlist ? " · on your watchlist" : ""}</span>`;
    return sh(`For you, from ${esc(B.name)}`) + mFilms(C.forA, `Nothing ${esc(B.name)} rated 4★ or more that you haven't seen.`, recCap(esc(B.name)), to.card) +
      sh(`For ${esc(B.name)}, from you`) + mFilms(C.forB, `Nothing you rated 4★ or more that ${esc(B.name)} hasn't seen.`, recCap("You"), to.card) +
      sh("Watch together") + (C.together.length ? `<div class="group">${C.together.map((w) => `<a class="kv" href="${esc(lbUrl(w))}" target="_blank" rel="noopener"><span>${esc(w.name)}</span><span>${w.year || ""} ↗</span></a>`).join("")}</div>` : `<div class="empty">No film is on both of your watchlists.</div>`);
  }
  if (tab === "habits") return sh("Habits") + `<div class="group"><div class="crow head"><span></span><span class="n">You</span><span class="n">${esc(B.name)}</span><span></span></div>${habitRows(C).map(([k, a, b]) =>
    `<div class="crow"><span>${k}</span><span class="n">${a}</span><span class="n">${b}</span><span></span></div>`).join("")}</div><p class="note">Tap any number to see what's behind it.</p>`;
  const o = C.overlap, tot = o.onlyA + o.both + o.onlyB || 1;
  const seg = (cls, n, d) => n ? `<span class="${cls}" role="button" tabindex="0" ${dl(d)} style="flex:${n / tot}"></span>` : "";
  let h = match.score != null ? `<button class="icard wide" type="button" ${dl(to.rated)} style="margin-top:16px"><span class="vs">${ring(match.score)}<span style="display:grid;gap:4px"><span class="k">Taste match with ${esc(B.name)}</span>
      <span class="big">${matchWords(match.score)}</span><span class="p">${match.score}/100, from how close your ratings are on the ${plural(match.n, "film")} you've both rated.${go}</span></span></span></button>`
    : `<div class="empty">A taste match needs five or more films you've both rated. You have ${dlink(match.n && to.rated, match.n)}.</div>`;
  h += sh("Overlap") + `<div class="card"><div class="venn" aria-label="${o.onlyA} only you, ${o.both} both, ${o.onlyB} only ${esc(B.name)}">
      ${seg("va", o.onlyA, to.onlyA)}${seg("vboth", o.both, to.shared)}${seg("vb", o.onlyB, to.onlyB)}</div>
    <div class="legend"><span><i style="background:var(--green-mark)"></i>Only you ${dlink(o.onlyA && to.onlyA, fmtN(o.onlyA))}</span><span><i style="background:var(--slate-mark)"></i>Both ${dlink(o.both && to.shared, fmtN(o.both))}</span><span><i style="background:var(--blue-mark)"></i>Only ${esc(B.name)} ${dlink(o.onlyB && to.onlyB, fmtN(o.onlyB))}</span></div></div>`;
  if (C.lines.length) h += sh("What stands out") + mLines(C.lines, () => "●");
  return h;
}

function mGroup(profiles) {
  const G = memo("group", () => compareGroup(profiles));
  const pairs = [];
  profiles.forEach((P, i) => profiles.forEach((Q, j) => { if (j > i && G.matrix[i][j] && G.matrix[i][j].score != null) pairs.push({ a: P.name, b: Q.name, s: G.matrix[i][j].score, to: G.pairTo(i, j) }); }));
  pairs.sort((x, y) => y.s - x.s);
  let h = sh("Taste matrix");
  if (pairs.length) h += mLines([{ text: `Closest: ${pairs[0].a} and ${pairs[0].b}, ${pairs[0].s}/100.`, to: pairs[0].to },
    pairs.length > 1 && { text: `Furthest apart: ${pairs[pairs.length - 1].a} and ${pairs[pairs.length - 1].b}, ${pairs[pairs.length - 1].s}/100.`, to: pairs[pairs.length - 1].to }].filter(Boolean), () => "●");
  h += `<div class="card" style="margin-top:12px;padding:8px"><div class="tscroll"><table class="mtable heat"><thead><tr><th></th>${profiles.map((p) => `<th class="n">${esc(p.name)}</th>`).join("")}</tr></thead><tbody>
    ${profiles.map((P, i) => `<tr><td>${esc(P.name)}</td>${profiles.map((_, j) => { const m = G.matrix[i][j];
      return m && m.score != null ? `<td class="n" style="background:color-mix(in srgb, var(--green-mark) ${Math.round(m.score * 0.65)}%, transparent)">${dlink(G.pairTo(i, j), m.score)}</td>` : `<td class="n dim">${m ? "—" : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div></div>
    <p class="note">${dlink(G.everyone && G.everyoneTo, plural(G.everyone, "film"))} everyone has seen.</p>`;
  const all = (x) => x.by.map((b) => `<span class="mdate">${esc(b.name)} <span class="stars">${stars(b.r)}</span></span>`).join("");
  h += sh("Everyone loved") + mFilms(G.loved, "No film yet that three or more of you all rated 4★ or more.", all, G.card);
  h += sh("Most divisive") + mFilms(G.divisive, "Nothing has split the group yet.", all, G.card);
  const pickName = (p) => p.f ? dlink(G.card(p.f), `<b>${esc(p.name)}</b>`) : `<a href="${esc(lbUrl(p))}" target="_blank" rel="noopener"><b>${esc(p.name)}</b></a>`;
  h += sh("Movie night") + (G.picks.length ? `<div class="lines">${G.picks.map((p) => `<div class="tline"><span class="mk">●</span><span>${pickName(p)} <span class="dim">${p.year || ""}</span>. ${esc(p.why)}.</span></div>`).join("")}</div>` : `<div class="empty">No pick yet.</div>`);
  return h;
}
</script>
