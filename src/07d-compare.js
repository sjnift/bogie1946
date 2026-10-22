<script>
/* ---------- desktop: the Compare page ---------- */
function renderCompare() {
  LISTS = new Map();
  const profiles = comparePeople().map((p) => tasteProfile(p, metaOf));
  const friends = profiles.slice(1);
  if (state.cmp === "all" ? friends.length < 2 : !friends.some((f) => f.id === state.cmp)) state.cmp = friends.length ? friends[0].id : null;
  $("#hero-title").innerHTML = `Compare <span class="accent">taste</span>`;
  $("#hero-sub").textContent = friends.length
    ? `Your diary next to ${friends.map((f) => f.name).join(" and ")}: where your tastes meet, where they part, and what to watch next.`
    : "Add a friend's Letterboxd export to see where your tastes meet and where they part.";
  const parts = [section("c-who", "Who's in", "Friends' exports stay in this browser.", whoBlock(friends))];
  if (state.cmp === "all") parts.push(...groupSections(profiles));
  else if (state.cmp) parts.push(...pairSections(comparePair(profiles[0], friends.find((f) => f.id === state.cmp), metaOf)));
  $("#compare").innerHTML = parts.join("");
}

function whoBlock(friends) {
  const ex = state.mode === "example";
  const chips = friends.map((f) => `<span class="who">
      <button class="chip" type="button" data-cmp="${f.id}" aria-pressed="${state.cmp === f.id}">You and ${esc(f.name)}</button>
      ${f.example ? "" : `<button class="linkish who-x" type="button" data-unfriend="${f.id}">${state.unfriend === f.id ? "Remove?" : `<span aria-hidden="true">×</span><span class="sr-only">Remove ${esc(f.name)}</span>`}</button>`}</span>`).join("");
  const all = friends.length >= 2 ? `<button class="chip" type="button" data-cmp="all" aria-pressed="${state.cmp === "all"}">Everyone</button>` : "";
  const add = `<button class="btn small" type="button" id="btn-add-friend"${!MY_LIB ? " disabled" : ""}>Add a friend's export</button>`;
  const note = ex ? (MY_LIB ? `These are made-up example friends. Go back to your diary (top right) to compare with real ones.` : `These are made-up example friends. Import your own export first, then add friends' exports here.`)
    : friends.length ? "" : `Ask a friend for their Letterboxd export (Settings → Data → Export your data), then add the ZIP here. Add as many friends as you like.`;
  const err = state.cmpError ? `<p class="status err" role="alert">${esc(state.cmpError)}</p>` : "";
  const saved = friendsSaveFailed ? `<p class="status err">This browser wouldn't save your friends' exports, so you'll need to add them again next time.</p>` : "";
  return `<div class="who-row">${chips}${all}${ex ? "" : add}</div>${note ? `<p class="status">${note}</p>` : ""}${err}${saved}`;
}

/* ----- you and one friend ----- */
function bothCap(x, A, B) {
  return `<div class="cap"><span><span class="muted">You</span> <span class="stars">${stars(x.a)}</span></span><span><span class="muted">${esc(B.name)}</span> <span class="stars">${stars(x.b)}</span></span></div>`;
}
const filmRow = (items, empty, cap) => items.length ? `<div class="posters">${items.map((x) => `<div class="poster">${artHtml(x.f)}${cap(x)}</div>`).join("")}</div>` : `<div class="empty">${empty}</div>`;

function pairSections(C) {
  const { A, B, match } = C;
  const score = match.score != null ? `<div class="match"><span class="score">${match.score}</span><span class="out">/100</span>
      <div><b>${matchWords(match.score)}</b><p>From how close your ratings are on the ${plural(match.n, "film")} you've both rated (correlation ${match.r != null ? match.r.toFixed(2) : "—"}).</p></div></div>`
    : `<div class="empty">A taste match needs five or more films you've both rated. You have ${match.n}.</div>`;
  const lines = C.lines.length ? `<ul class="trend-lines">${C.lines.map((t) => `<li><span class="mk" aria-hidden="true">●</span><span>${esc(t)}</span></li>`).join("")}</ul>` : "";
  const o = C.overlap, tot = o.onlyA + o.both + o.onlyB || 1;
  const venn = `<div class="venn" role="img" aria-label="${o.onlyA} films only you have seen, ${o.both} you've both seen, ${o.onlyB} only ${esc(B.name)} has seen">
      ${o.onlyA ? `<span class="va" style="flex:${o.onlyA / tot}" data-tip="Only you: ${plural(o.onlyA, "film")}"></span>` : ""}
      ${o.both ? `<span class="vboth" style="flex:${o.both / tot}" data-tip="Both: ${plural(o.both, "film")}"></span>` : ""}
      ${o.onlyB ? `<span class="vb" style="flex:${o.onlyB / tot}" data-tip="Only ${esc(B.name)}: ${plural(o.onlyB, "film")}"></span>` : ""}</div>
    <div class="legend"><span><i style="background:var(--gold)"></i>Only you · ${fmtN(o.onlyA)}</span><span><i style="background:var(--muted)"></i>Both · ${fmtN(o.both)}</span><span><i style="background:var(--lilac)"></i>Only ${esc(B.name)} · ${fmtN(o.onlyB)}</span></div>
    <p class="status">${Math.round(o.jaccard * 100)}% of all the films either of you has seen, you've both seen.</p>`;
  const mx = Math.max(1, ...A.spread, ...B.spread);
  const hist = A.rated.length && B.rated.length ? `<div class="legend"><span><i style="background:var(--gold)"></i>You · ${A.avg.toFixed(2)} avg</span><span><i style="background:var(--lilac)"></i>${esc(B.name)} · ${B.avg.toFixed(2)} avg</span></div>
    <div class="phist" role="img" aria-label="Share of each person's ratings at each half-star">${A.spread.map((a, i) => `<div class="pgroup" data-tip="${stars((i + 1) / 2)}: you ${Math.round(a)}%, ${esc(B.name)} ${Math.round(B.spread[i])}%">
      <span class="pa" style="height:${(a / mx * 100).toFixed(1)}%"></span><span class="pb" style="height:${(B.spread[i] / mx * 100).toFixed(1)}%"></span></div>`).join("")}</div>
    <div class="stars-axis">${A.spread.map((_, i) => `<span>${i === 0 ? "½" : (i + 1) % 2 ? "" : `${(i + 1) / 2}★`}</span>`).join("")}</div>
    <p class="status">Share of each person's ratings at each half-star.</p>` : `<div class="empty">Both of you need rated films for this.</div>`;
  const gmax = Math.max(1, ...C.topGenres.map((g) => Math.max(g.a, g.b)));
  const genres = C.topGenres.length ? `<div class="legend"><span><i style="background:var(--gold)"></i>You</span><span><i style="background:var(--lilac)"></i>${esc(B.name)}</span></div>
    ${C.topGenres.map((g) => `<div class="gpair"><span class="gname">${esc(g.g)}</span><span class="gbars"><span class="ga" style="width:${(g.a / gmax * 100).toFixed(1)}%"></span><span class="gb" style="width:${(g.b / gmax * 100).toFixed(1)}%"></span></span>
      <span class="gv num">${Math.round(g.a)}% · ${Math.round(g.b)}%</span></div>`).join("")}<p class="status">Share of each person's films in the genre.</p>` : `<div class="empty">Genres come from cast &amp; crew details.</div>`;
  const plist = (title, items, val) => `<div><h3>${title}</h3>${items.length ? `<ol class="plain-list">${items.map((x) => `<li><span>${esc(x.name || x[0])}</span><span class="muted num">${val(x)}</span></li>`).join("")}</ol>` : `<p class="status">Nobody.</p>`}</div>`;
  const people = `<div class="ins-grid">
    ${plist("Directors you both watch", C.directors.shared, (x) => `you ${x.a} · ${esc(B.name)} ${x.b}`)}
    ${plist("Actors you both watch", C.actors.shared, (x) => `you ${x.a} · ${esc(B.name)} ${x.b}`)}
    ${plist("Directors only you watch", C.directors.onlyA, (x) => plural(x[1], "film"))}
    ${plist(`Directors only ${esc(B.name)} watches`, C.directors.onlyB, (x) => plural(x[1], "film"))}</div>`;
  const recCap = (who) => (x) => `<div class="cap"><span><span class="muted">${who}</span> <span class="stars">${stars(x.f.rating)}</span></span>${x.onWatchlist ? '<span class="muted">already on the watchlist</span>' : ""}</div>`;
  const together = C.together.length ? `<div class="chiplets">${C.together.map((w) => `<span class="chiplet">${esc(w.name)} <span class="muted">${w.year || ""}</span></span>`).join("")}</div>`
    : `<div class="empty">No film is on both of your watchlists${A.watchlist.size && B.watchlist.size ? "" : " (watchlists come from each export's watchlist.csv)"}.</div>`;
  const hrow = (k, a, b) => `<tr><td>${k}</td><td class="n">${a ?? "—"}</td><td class="n">${b ?? "—"}</td></tr>`;
  const habits = `<div class="tbl-wrap"><table class="data"><thead><tr><th></th><th class="n">You</th><th class="n">${esc(B.name)}</th></tr></thead><tbody>
    ${hrow("Films logged", fmtN(A.films.length), fmtN(B.films.length))}${hrow("Diary entries a year", A.perYear && fmtN(A.perYear), B.perYear && fmtN(B.perYear))}
    ${hrow("Average rating", A.avg && A.avg.toFixed(2), B.avg && B.avg.toFixed(2))}${hrow("Average release year", A.avgYear, B.avgYear)}
    ${hrow("Not in English", A.nonEnglish != null ? A.nonEnglish + "%" : null, B.nonEnglish != null ? B.nonEnglish + "%" : null)}
    ${hrow("On weekends", A.weekend != null ? A.weekend + "%" : null, B.weekend != null ? B.weekend + "%" : null)}${hrow("Rewatches", A.rewatch != null ? A.rewatch + "%" : null, B.rewatch != null ? B.rewatch + "%" : null)}
    </tbody></table></div>`;
  return [
    section("c-match", "Taste match", `You and ${esc(B.name)}.`, score + lines),
    section("c-overlap", "Overlap", "Films each of you has logged.", venn),
    section("c-agree", "Agree &amp; disagree", "Films you've both rated.", `<div class="crowd">
      <h3>You both loved</h3>${filmRow(C.bothLoved, "No film you both rated 4½★ or more.", (x) => bothCap(x, A, B))}
      <h3>You rated higher</h3>${filmRow(C.aHigher, `No film you rated 1½★ or more above ${esc(B.name)}.`, (x) => bothCap(x, A, B))}
      <h3>${esc(B.name)} rated higher</h3>${filmRow(C.bHigher, `No film ${esc(B.name)} rated 1½★ or more above you.`, (x) => bothCap(x, A, B))}</div>`),
    section("c-reviews", "In your words", "Films you've both reviewed.", bothReviewedBlock(A, B)),
    section("c-style", "Rating style", "How each of you spreads ratings.", hist),
    section("c-genres", "Genres", "Each person's mix of genres.", genres),
    section("c-people", "People", "Directors and actors across both diaries.", people),
    section("c-next", "Watch next", "Films one of you rated 4★ or more that the other hasn't logged.", `<div class="crowd">
      <h3>For you, from ${esc(B.name)}</h3>${filmRow(C.forA, `Nothing ${esc(B.name)} rated 4★ or more that you haven't seen.`, recCap(B.name))}
      <h3>For ${esc(B.name)}, from you</h3>${filmRow(C.forB, `Nothing you rated 4★ or more that ${esc(B.name)} hasn't seen.`, recCap("You"))}</div>`),
    section("c-together", "Watch together", "On both of your watchlists.", together),
    section("c-habits", "Habits", "How each of you watches.", habits),
  ];
}

/* ----- everyone ----- */
function groupSections(profiles) {
  const G = compareGroup(profiles);
  const names = profiles.map((p) => p.name);
  const cell = (m) => m && m.score != null ? `<td class="n cell" style="background:color-mix(in srgb, var(--gold) ${Math.round(m.score * 0.7)}%, transparent)" data-tip="${m.n} films both rated">${m.score}</td>` : `<td class="n cell muted">${m ? "—" : ""}</td>`;
  const pairs = [];
  profiles.forEach((P, i) => profiles.forEach((Q, j) => { if (j > i && G.matrix[i][j] && G.matrix[i][j].score != null) pairs.push({ a: P.name, b: Q.name, s: G.matrix[i][j].score }); }));
  pairs.sort((x, y) => y.s - x.s);
  const best = pairs[0], worst = pairs[pairs.length - 1];
  const summary = best ? `<ul class="trend-lines"><li><span class="mk">●</span><span>Closest tastes: ${esc(best.a)} and ${esc(best.b)}, ${best.s}/100.</span></li>
    ${worst !== best ? `<li><span class="mk">●</span><span>Furthest apart: ${esc(worst.a)} and ${esc(worst.b)}, ${worst.s}/100.</span></li>` : ""}
    <li><span class="mk">●</span><span>${plural(G.everyone, "film")} everyone has seen.</span></li></ul>` : "";
  const matrix = `<div class="tbl-wrap"><table class="data heat"><thead><tr><th></th>${names.map((n) => `<th class="n">${esc(n)}</th>`).join("")}</tr></thead>
    <tbody>${profiles.map((P, i) => `<tr><td>${esc(P.name)}</td>${profiles.map((_, j) => cell(G.matrix[i][j])).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="status">Taste match out of 100 for each pair, from films both have rated.</p>`;
  const rated = (x) => `<div class="cap">${x.by.map((b) => `<span><span class="muted">${esc(b.name)}</span> <span class="stars">${stars(b.r)}</span></span>`).join("")}</div>`;
  const picks = G.picks.length ? `<ul class="trend-lines">${G.picks.map((p) => `<li><span class="mk">●</span><span><b>${esc(p.name)}</b> <span class="muted">${p.year || ""}</span>. ${esc(p.why)}.</span></li>`).join("")}</ul>` : `<div class="empty">No pick yet: nothing is on two watchlists or loved by one of you and unseen by most.</div>`;
  return [
    section("c-matrix", "Taste matrix", `Everyone against everyone.`, summary + matrix),
    section("c-loved", "Everyone loved", "Rated highly, and alike, by three or more of you.", filmRow(G.loved, "No film yet that three or more of you all rated 4★ or more.", rated)),
    section("c-divisive", "Most divisive", "Films three or more of you rated, furthest apart.", filmRow(G.divisive, "Nothing has split the group yet.", rated)),
    section("c-night", "Movie night", "On several watchlists, or loved by one of you and unseen by most.", picks),
  ];
}
</script>
