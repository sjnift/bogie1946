<script>
/* ---------- desktop: the main page below On this day, as a dashboard (asked Oct 2026, after cards that opened in place
   only brought the old clutter back). Each section is a card made for its size: a headline, one picture of it (a chart,
   a top five, a few posters) and "See all" opening the rest in the pop-up. Nothing is cut off and nothing opens in place. */
D.block = (title, sub, html) => ({ kind: "block", title, sub, html });
const TOP_N = 5;
// A card: its title (and a switch, where it has one), the line that sums it up, its picture, and a way to the rest.
function dcard(id, title, o) {
  if (!o || !o.body) return "";
  const more = o.more && o.more[0] ? `<div class="dc-foot"><button class="dc-more" type="button" ${dl(o.more[0])}>${o.more[1]}<span aria-hidden="true"> ›</span></button></div>` : "";
  return `<section class="dc${o.wide ? " wide" : ""}" id="${id}" aria-labelledby="${id}-h"><header class="dc-head"><h2 id="${id}-h">${title}</h2>${o.tabs || ""}</header>
    ${o.line ? `<p class="dc-line">${o.line}</p>` : ""}<div class="dc-body credit-body">${o.body}</div>${more}</section>`;
}
// a top five as faces, a few posters, and a short ranked list (name, bar, number)
const dfaces = (list, valueOf) => `<div class="dc-faces">${list.slice(0, TOP_N).map((p, i) => `<button class="person" type="button" data-list="${reg(p.name, personSub(p), p.films, p)}">${faceHtml(p, i + 1)}<span class="nm">${esc(p.name)}</span><span class="ct">${valueOf(p)}</span></button>`).join("")}</div>`;
const dposters = (films, cap, n = TOP_N) => `<div class="posters dc-posters">${films.slice(0, n).map((f) => cap ? posterBtn(f, cap(f)) : posterHtml(f)).join("")}</div>`;
const dlist = (items, valueOf, widthOf, toOf) => `<div class="dc-list">${items.map((x) => `<button class="dc-row" type="button" ${dl(toOf(x))}><span class="n">${esc(x.name)}</span>
  <span class="track" aria-hidden="true"><span style="width:${Math.max(2, widthOf(x) * 100).toFixed(1)}%"></span></span><span class="v">${valueOf(x)}</span></button>`).join("")}</div>`;
const personTo = (p) => D.films(p.name, personSub(p), p.films, { person: p });
// genres, countries or languages as a list in the pop-up
const catNames = (title, data, scope) => D.names(title, "", data.most.map((c) => ({ name: c.name, films: c.films, value: fmtN(c.count),
  note: `${plural(c.count, "film")}${c.avg ? ` · ${c.avg.toFixed(2)} average` : ""}`, to: D.films(c.name, filmsSub(c.films), c.films, { scope }) })));

// The chapters of cards, in order.
function dashChapters(s) {
  const all = s.scope === "all", noMeta = !s.withMeta, L = cardLines(s), lib = state.lib, scope = s.scope;
  const I = homeInsights(), R = all ? null : homeInsights(s.scope), views = viewsOf(s);
  const people = (kind, data, label) => {
    if (noMeta) return { body: emptyMeta() };
    const best = state.tab[kind] === "best", list = best ? data.best : data.most, minR = kind === "cast" ? s.castMinRated : s.minRated;
    return { tabs: tabs(kind, [["most", "Most watched"], ["best", "Highest rated"]], state.tab[kind]),
      line: best ? (kind === "cast" ? castBarText(s) : `Highest rated needs ${minR}+ rated films.`) : L[kind === "cast" ? "starring" : "directed"].replace(/ Highest rated needs.*$/, ""),
      body: list.length ? dfaces(list, (p) => best ? `★ ${p.avg.toFixed(2)} · ${plural(p.ratings.length, "film")}` : plural(p.count, "film")) : `<div class="empty">Nobody here has ${minR} or more rated films yet.</div>`,
      more: [list.length > TOP_N && D.names(best ? `${label}, highest rated` : label, best ? `${minR}+ rated films each, best first` : `${fmtN(data.total)} in all, most watched first`, list, { faces: true }),
        best ? `All ${fmtN(list.length)} highest rated` : `All ${fmtN(data.total)} ${label.toLowerCase()}`] };
  };

  /* films */
  const decCols = [];
  if (s.decades.length) for (let d = s.decades[0].decade; d <= s.decades[s.decades.length - 1].decade; d += 10) {
    const x = s.decades.find((y) => y.decade === d);
    decCols.push({ a: x ? x.count : 0, b: 0, label: `’${String(d).slice(2)}s`, tip: `${d}s: ${plural(x ? x.count : 0, "film")}${x && x.avg ? ` · ${x.avg.toFixed(2)} average` : ""}`, to: x && DR.decade(x) });
  }
  const released = s.decades.length ? { line: L.released, body: colChart(decCols, "Films by decade of release", "", 120, { unit: "films" }),
    more: [D.names("Decades", "In order of release", s.decades.map((x) => ({ name: `${x.decade}s`, films: x.films, value: fmtN(x.count),
      note: `${plural(x.count, "film")}${x.avg ? ` · ${x.avg.toFixed(2)} average` : ""}`, to: DR.decade(x) }))), "All decades"] } : null;
  const milestones = s.entries.length ? { line: L.milestones, body: milestonesBlock(s, TOP_N),
    more: [D.block("Milestones", "Counted through your diary in date order", () => milestonesBlock(s)), "All milestones"] } : null;
  const records = recordsBlock(s);
  const re = s.films.filter((f) => views(f) > 1).sort((a, b) => views(b) - views(a) || (b.rating || 0) - (a.rating || 0));
  const rewatched = re.length ? { line: L.rewatched,
    body: dlist(re.slice(0, TOP_N).map((f) => ({ name: `${f.name}${f.year ? ` (${f.year})` : ""}`, f })), (x) => `${views(x.f)}×`, (x) => views(x.f) / views(re[0]), (x) => D.film(x.f)),
    more: [re.length > TOP_N && D.films("Most rewatched", filmsSub(re), re, { scope, sort: "given", note: (f) => plural(views(f), "viewing") }), `All ${fmtN(re.length)} rewatched films`] } : null;

  /* people */
  const crewCol = (label, data) => `<div><h4 class="dc-h">${label}</h4>${data.most.length ? dlist(data.most.slice(0, 3), (p) => fmtN(p.count), (p) => p.count / data.most[0].count, personTo) : `<p class="status">Nobody yet.</p>`}</div>`;
  const crew = noMeta ? { body: emptyMeta() } : { line: L.crew, body: `<div class="dc-cols">${crewCol("Written by", s.writers)}${crewCol("Shot by", s.dop)}${crewCol("Music by", s.music)}</div>`,
    more: [D.groups("Crew", "Most watched first", [D.names("Writers", "", s.writers.most, { faces: true }), D.names("Cinematographers", "", s.dop.most, { faces: true }), D.names("Composers", "", s.music.most, { faces: true })]), "All writers, cinematographers and composers"] };
  let overYears = null;
  if (all && !noMeta && I.people.discoveries.length >= 2) {
    const disc = I.people.discoveries, last = disc[disc.length - 1];
    overYears = { line: `${dlink(last.count && D.names(`Directors new in ${last.year}`, plural(last.count, "director"), last.people, { faces: true }), plural(last.count, "director"))} new to you in ${last.year}.`,
      body: colChart(disc.map((d) => ({ a: d.count, b: 0, label: `’${d.year.slice(2)}`, tip: `${d.year}: ${plural(d.count, "new director")}`, to: d.count && D.names(`Directors new in ${d.year}`, plural(d.count, "director"), d.people, { faces: true }) })), "New directors by year", "", 110, { unit: "new" }),
      more: [D.block("People over the years", "Who's new, who stays, and how many directors each year brought", () => peopleYearsBlock(I)), "New faces and long-time companions"] };
  }
  const newIn = !all && R.firstYear !== s.scope && !noMeta ? { line: `${plural(R.discDirectors.length, "director")} and ${plural(R.discActors.length, "actor")} new to your diary in ${esc(s.scope)}.`,
    body: R.discDirectors.length ? dfaces(R.discDirectors, (p) => plural(p.count, "film")) : `<div class="empty">No new directors this year.</div>`,
    more: [D.block(`New in ${s.scope}`, "Directors, actors, countries and languages that first turned up this year", () => newInBlock(R)), "Everything new this year"] } : null;

  /* genres and countries */
  const catCol = (label, data) => `<div><h4 class="dc-h">${label}</h4>${data.most.length ? dlist(data.most.slice(0, 4), (c) => fmtN(c.count), (c) => c.count / data.most[0].count, (c) => D.films(c.name, filmsSub(c.films), c.films, { scope })) : `<p class="status">None yet.</p>`}</div>`;
  const origin = noMeta ? { body: emptyMeta() } : { line: L.origin, body: `<div class="dc-cols">${catCol("Genres", s.genres)}${catCol("Countries", s.countries)}${catCol("Languages", s.languages)}</div>`,
    more: [D.groups("Genres, countries and languages", "Most watched first", [catNames("Genres", s.genres, scope), catNames("Countries", s.countries, scope), catNames("Languages", s.languages, scope)]), "All genres, countries and languages"] };
  let genreRates = null;
  if (all && !noMeta && I.genres.length >= 2) {
    const g = [...I.genres].sort((a, b) => b.vsMe - a.vsMe), up = g.filter((x) => x.vsMe > 0).slice(0, 3), down = g.filter((x) => x.vsMe < 0).slice(-3).reverse();
    const max = Math.max(0.1, ...g.map((x) => Math.abs(x.vsMe)));
    const col = (label, list) => `<div><h4 class="dc-h">${label}</h4>${list.length ? dlist(list, (x) => `${signed(x.vsMe, 2)}★`, (x) => Math.abs(x.vsMe) / max, (x) => D.films(x.name, `${plural(x.count, "film")} · ${x.mine.toFixed(2)} average`, x.films)) : `<p class="status">None.</p>`}</div>`;
    genreRates = { line: up[0] ? `You rate ${esc(up[0].name.toLowerCase())} highest, ${signed(up[0].vsMe, 2)}★ above your average.` : "Each genre against your own average.",
      body: `<div class="dc-cols two">${col("Above your average", up)}${col("Below it", down)}</div>`,
      more: [D.block("Genres as you rate them", "Each genre against your own average and against the crowd", () => genresBlock(I)), `All ${fmtN(I.genres.length)} genres`] };
  }
  let genreYears = null;
  if (all && !noMeta && I.tastes.table) {
    const t = I.tastes.table, ys = t.years.slice(-8), gs = t.genres.slice(0, 5);
    genreYears = { wide: true, line: "The share of each year's films in your top genres.",
      body: `<div class="tbl-wrap"><table class="data heat dc-heat"><thead><tr><th></th>${ys.map((y) => `<th class="n">${y.year}</th>`).join("")}</tr></thead><tbody>${gs.map((g) => { const gi = t.genres.indexOf(g);
        return `<tr><td>${esc(g)}</td>${ys.map((y) => { const v = y.shares[gi], fs = y.p.F.filter(hasGenre(g));
          return `<td class="n cell" style="background:color-mix(in srgb, var(--gold) ${v == null ? 0 : Math.min(70, v * 1.6)}%, transparent)">${v == null ? "—" : dlink(fs.length && D.films(`${g} in ${y.year}`, filmsSub(fs, `${v}% of the year's films`), fs, { scope: y.year }), v + "%")}</td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div>`,
      more: [D.block("Genres year by year", "The share of each year's films in each genre", () => genreYearsBlock(I)), "Every genre, every year"] };
  }

  /* when you watch */
  const tl = s.entries.length ? timeline(s) : [];
  const unit = s.scope !== "all" ? "week" : tl.length && tl[0].key.length === 7 ? "month" : "year";
  const logged = s.entries.length ? { line: L.logged, body: colChart(tl, `Diary entries by ${unit}`, "", 110, { unit: "films" }),
    more: [D.block("Logged", all ? "Diary entries over time, by day and by date" : `Diary entries in ${s.scope}`, () => diaryBlock(s)), "Days, weeks and streaks"] } : null;
  const G = monthGrid(lib, metaOf, all ? null : s.scope);
  const months = G ? { line: monthsLine(G), body: monthGridHtml(G),
    more: [D.block(G.Y ? `Each month of ${G.Y}` : "Each month, across the years", G.Y ? "Against your usual for each month" : "Films, a year, your average and what it leans to", () => monthTableHtml(G)), "Each month in detail"] } : null;
  let years = null;
  if (all && I.years.length >= 2) {
    const top = [...I.years].sort((a, b) => b.films - a.films)[0];
    years = { line: `${dlink(yearDrill(top, "films"), top.year)} was your fullest year: ${plural(top.films, "film")}.`,
      body: colChart(I.years.map((p) => ({ a: p.films, b: p.pace && p.pace > p.films ? p.pace - p.films : 0, label: `’${p.year.slice(2)}`, tip: `${p.year}: ${plural(p.films, "film")}${p.pace ? `, on pace for about ${fmtN(p.pace)}` : ""}`, to: p.entries ? yearDrill(p, "films") : null })), "Films by year", "", 110, { unit: "films" }),
      more: [D.block("Year by year", "By the year you watched, from diary dates", () => yearsBlock(I)), "Hours, ratings and more, year by year"] };
  }
  const prevY = all ? "" : String(+s.scope - 1);
  const vsprev = !all && R.changes.length ? { line: `${esc(s.scope)} next to ${prevY}.`,
    body: `<div class="dc-list">${R.changes.slice(0, 4).map((c) => `<button class="dc-row vs" type="button" ${dl(c.to)}><span class="n">${esc(c.label)}</span><span class="v">${esc(String(c.before))} → <b>${esc(String(c.now))}</b></span></button>`).join("")}</div>`,
    more: [D.block(`${s.scope} against ${prevY}`, "Everything that changed", () => vsPrevBlock(R, prevY)), "Everything against the year before"] } : null;
  const hab = all ? I.habits : R.habits.filter((h) => !["Longest streak", "Biggest day", "Oldest film"].includes(h.k));
  const habits = hab.length ? { line: all ? "When and how you watch." : `When and how you watched in ${esc(s.scope)}.`, body: habitsBlock(hab.slice(0, 2), ""),
    more: [hab.length > 2 && D.block("Habits", all ? "When and how you watch" : `When and how you watched in ${s.scope}`, () => habitsBlock(hab, "")), `All ${hab.length} habits`] } : null;

  /* ratings */
  const rated = s.rated ? { line: L.rated, body: colChart(s.spread.map((x) => ({ a: x.count, b: 0, label: x.r === 0.5 ? "½" : x.r % 1 ? "" : `${x.r}★`, tip: `${stars(x.r)} · ${plural(x.count, "film")}`, to: x.count && DR.rating(s.films, x.r) })), "How many films you gave each rating", "", 110, { unit: "films" }),
    more: [DR.rated(s), `All ${fmtN(s.rated)} rated films`] } : null;
  const k = HOME_INS.k, C = all ? crowdOf(k, lib.films) : crowdOf(k, R.S.films, R.ratingAt), Y = all ? null : s.scope;
  const crowdTabs = Object.entries(CROWDS).filter(([key]) => (C.available[key] || 0) >= (Y ? 3 : 5) || key === C.key);
  const crowd = { tabs: crowdTabs.length > 1 ? `<div class="tabs" role="tablist">${crowdTabs.map(([key, c]) => `<button class="tab" role="tab" type="button" data-crowd="${key}" aria-selected="${key === C.key}">${c.label}</button>`).join("")}</div>` : "" };
  if (C.n < (Y ? 3 : 5)) crowd.body = crowdBlock(C, Y, true);
  else {
    crowd.line = `${Y ? `On the ${dlink(C.to, plural(C.n, "film"))} you rated in ${esc(Y)}, you gave` : `Across ${dlink(C.to, plural(C.n, "film"))} you rated, you give`} ${Math.abs(C.meanDiff).toFixed(2)}★ ${C.meanDiff >= 0 ? "more" : "less"} than ${esc(C.label)} on average.`;
    crowd.body = C.higher.length ? `<h4 class="dc-h">You liked more than ${esc(C.label)}</h4>` + dposters(C.higher.map((p) => p.f), (f) => { const p = C.higher.find((x) => x.f === f);
      return `<span class="cap"><span class="stars">${stars(p.you)}</span><span class="muted">${esc(C.short)} ${crowdScore(C.key, p.crowd)}</span></span>`; }) : `<p class="status">No film you rated ¾★ or more above them.</p>`;
    crowd.more = [D.block("Against the crowd", all ? "Where your ratings part ways with everyone else's" : `Films you rated in ${Y}`, () => crowdBlock(C, Y, true)), "Liked more, liked less, hidden gems"];
  }
  const ratedFilms = s.films.filter((f) => f.rating).sort((a, b) => b.rating - a.rating || views(b) - views(a) || (b.year || 0) - (a.year || 0));
  const low = s.films.filter((f) => f.rating && f.rating <= 2.5).sort((a, b) => a.rating - b.rating || views(b) - views(a) || a.name.localeCompare(b.name));
  const top = ratedFilms.length ? { wide: true, line: L.top,
    body: `<div class="dc-cols two"><div><h4 class="dc-h">Highest rated</h4>${dposters(ratedFilms)}</div><div><h4 class="dc-h">Lowest rated</h4>${low.length ? dposters(low) : `<p class="status">Nothing at 2½★ or under.</p>`}</div></div>`,
    more: [D.groups("Highest and lowest rated", "", [D.films("Highest rated", filmsSub(ratedFilms), ratedFilms, { scope, sort: "given" }), ...(low.length ? [D.films("Lowest rated", filmsSub(low, "2½★ and under"), low, { scope, sort: "given" })] : [])]), "All, highest first, and the lowest"] } : null;

  /* reviews and watch next */
  const RI = lib.reviewTextMissing ? null : computeReviewInsights(lib, all ? null : s.scope);
  const reviewStats = RI ? { line: RI.lines[0] ? dline(RI.lines[0].to, esc(RI.lines[0].text)) : "What you write, and when you bother.",
    body: RI.lines.length > 1 ? lineItems(RI.lines.slice(1, 3), () => "●") : `<p class="status">${plural(RI.count, "written review")}.</p>`,
    more: [D.block(all ? "Your reviews in numbers" : `Your ${s.scope} reviews in numbers`, "What you write, and when you bother", () => reviewInsightsBlock(lib, all ? null : s.scope)), "Words you use, and when you write"] } : null;
  const W = lib.watchlistFilms.length ? watchNext(lib) : undefined;
  let next = null;
  if (W !== undefined) {
    const list = W ? W.picks.filter((p) => p.known && wnFits(p, state.wn)) : [];
    next = { wide: true, line: "Your watchlist, likeliest favourites first.", tabs: W ? `<div class="tabs" role="tablist">${WN_LENGTHS.map(([v, l]) => `<button class="tab" role="tab" type="button" data-wn="${v}" aria-selected="${v === state.wn}">${l}</button>`).join("")}</div>` : "",
      body: !W ? watchNextBlock(W) : list.length ? dposters(list.map((p) => p.f), (f) => { const p = list.find((x) => x.f === f); return `<span class="cap"><span class="pred">About ${p.pred.toFixed(1)}★</span></span>`; }, 10)
        : `<div class="empty">${W.picks.some((p) => p.known) ? "Nothing on your watchlist fits that length." : "Your watchlist films need cast &amp; crew details first."}</div>`,
      more: [list.length > 10 && wnDrill(list, "Watch next"), `All ${fmtN(list.length)}, best bets first`] };
  }

  return [
    ["films", "Films", [dcard("released", "Released", released), dcard("milestones", "Milestones", milestones),
      records ? dcard("records", "Records", { body: records }) : "", dcard("rewatched", "Most rewatched", rewatched)]],
    ["people", "People", [dcard("starring", "Starring", people("cast", s.cast, "Actors")), dcard("directed", "Directed by", people("directors", s.directors, "Directors")),
      dcard("crew", "Crew", crew), dcard("people-years", "People over the years", overYears), dcard("new-in", `New in ${esc(s.scope)}`, newIn)]],
    ["origin", "Genres &amp; countries", [dcard("origin", "Genre &amp; origin", origin), dcard("genre-rates", "Genres as you rate them", genreRates), dcard("genre-years", "Genres year by year", genreYears)]],
    ["when", "When you watch", [dcard("logged", "Logged", logged), dcard("months", "Month by month", months), dcard("years", "Year by year", years), dcard("vsprev", `Against ${prevY}`, vsprev), dcard("habits", "Habits", habits)]],
    ["ratings", "Ratings", [dcard("rated", "Rated", rated), dcard("crowd", "Against the crowd", crowd), dcard("top", "Highest &amp; lowest rated", top)]],
    ["reviews", "Reviews", [dcard("reviews", "Reviewed", { wide: !reviewStats, line: all ? "Your latest reviews. Search finds any of them." : `What you wrote about films you watched in ${esc(s.scope)}, latest first.`, body: reviewsBlock(s) }),
      dcard("review-stats", "Reviews in numbers", reviewStats)]],
    ["next", "Watch next", [dcard("next", "Watch next", next)]],
  ];
}
</script>
