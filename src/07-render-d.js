<script>
/* ---------- desktop: the main page below On this day, as a dashboard (asked Oct 2026, after cards that opened in place
   only brought the old clutter back). Each section is a card made for its size: a headline, one picture of it (a chart,
   a few posters, a short list) and "See all" opening the rest in the pop-up. Nothing is cut off and nothing opens in place.
   People, Genres & countries, When you watch and Ratings stay in full, as sections, the way they were before (the owner's
   call, 25 Oct 2026). */
D.block = (title, sub, html) => ({ kind: "block", title, sub, html });
const TOP_N = 5;
// A card: its title (and a switch, where it has one), the line that sums it up, its picture, and a way to the rest.
function dcard(id, title, o) {
  if (!o || !o.body) return "";
  const more = o.more && o.more[0] ? `<div class="dc-foot"><button class="dc-more" type="button" ${dl(o.more[0])}>${o.more[1]}<span aria-hidden="true"> ›</span></button></div>` : "";
  return `<section class="dc${o.wide ? " wide" : ""}" id="${id}" aria-labelledby="${id}-h"><header class="dc-head"><h2 id="${id}-h">${title}</h2>${o.tabs || ""}</header>
    ${o.line ? `<p class="dc-line">${o.line}</p>` : ""}<div class="dc-body credit-body">${o.body}</div>${more}</section>`;
}
// a few posters, and a short ranked list (name, bar, number)
const dposters = (films, cap, n = TOP_N) => `<div class="posters dc-posters">${films.slice(0, n).map((f) => cap ? posterBtn(f, cap(f)) : posterHtml(f)).join("")}</div>`;
const dlist = (items, valueOf, widthOf, toOf) => `<div class="dc-list">${items.map((x) => `<button class="dc-row" type="button" ${dl(toOf(x))}><span class="n">${esc(x.name)}</span>
  <span class="track" aria-hidden="true"><span style="width:${Math.max(2, widthOf(x) * 100).toFixed(1)}%"></span></span><span class="v">${valueOf(x)}</span></button>`).join("")}</div>`;

// The chapters, in order: cards, except those marked to show in full.
function dashChapters(s) {
  const all = s.scope === "all", noMeta = !s.withMeta, L = cardLines(s), lib = state.lib, scope = s.scope;
  const I = homeInsights(), R = all ? null : homeInsights(s.scope), views = viewsOf(s);

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

  /* people, and genres and countries: these two chapters stay in full, as sections (asked Oct 2026) */
  const everyone = (data, label) => dlink(data.total && D.names(label, `${fmtN(data.total)} in all, most watched first`, data.most, { faces: true }), `${fmtN(data.total)} ${label.toLowerCase()}`);
  const people = (kind, data) => noMeta ? emptyMeta() : tabs(kind, [["most", "Most watched"], ["best", "Highest rated"]], state.tab[kind]) + peopleBlock(kind, data, s);
  const peopleFull = [
    section("starring", "Starring", `${everyone(s.cast, "Actors")} in the top ${CAST_DEPTH} billed of each film. ${castBarText(s)}`, people("cast", s.cast)),
    section("directed", "Directed by", `${everyone(s.directors, "Directors")}.`, people("directors", s.directors)),
    section("crew", "Crew", `Writers, cinematographers and composers. Highest rated needs ${s.minRated}+ rated films.`, noMeta ? emptyMeta() : crewBlock(s)),
    all ? section("people-years", "People over the years", "Who's new, who stays, and how many directors each year brought.", noMeta ? emptyMeta() : peopleYearsBlock(I)) : "",
    !all && R.firstYear !== s.scope ? section("new-in", `New in ${esc(s.scope)}`, "Directors, actors, countries and languages that first turned up in your diary this year.", noMeta ? emptyMeta() : newInBlock(R)) : ""];
  const originFull = [
    section("origin", "Genre &amp; origin", "Genres, production countries and original languages.", noMeta ? emptyMeta() : catBlock(s)),
    section("world", "Around the world", "Where your films were made: the more films, the deeper the gold. Hover over a country for more; click it for its films.",
      noMeta ? emptyMeta() : worldMapHtml(s.countries, { scope: s.scope, total: s.films.filter((f) => metaOf(f) && (metaOf(f).k || []).length).length }) || `<div class="empty">No countries known for these films yet.</div>`),
    all ? section("genre-years", "Genres year by year", "The share of each year's films in each genre.", noMeta ? emptyMeta() : genreYearsBlock(I)) : "",
    all ? section("genre-rates", "Genres as you rate them", "Each genre against your own average and against the crowd.", noMeta ? emptyMeta() : genresBlock(I)) : ""];

  /* when you watch, and ratings: these stay in full too (asked Oct 2026) */
  const prevY = all ? "" : String(+s.scope - 1);
  const G = monthGrid(lib, metaOf, all ? null : s.scope), mLine = G && monthsLine(G);
  const hab = all ? I.habits : R.habits.filter((h) => !["Longest streak", "Biggest day", "Oldest film"].includes(h.k));
  const whenFull = [
    section("logged", "Logged", all ? "Diary entries over time, by day and by date." : `Diary entries in ${esc(s.scope)}, week by week.`, diaryBlock(s)),
    section("months", "Month by month", G && G.Y ? `Each month of ${esc(G.Y)} against your usual for it.` : "Every month of every year, darker for more.",
      G ? `${mLine ? `<p class="lead">${mLine}</p>` : ""}${monthGridHtml(G)}${monthTableHtml(G)}` : monthTableHtml(G)),
    all ? section("years", "Year by year", "By the year you watched, from diary dates.", yearsBlock(I)) : "",
    all ? "" : section("vsprev", `Against ${prevY}`, `${esc(s.scope)} next to the year before.`, vsPrevBlock(R, prevY)),
    section("habits", "Habits", all ? "When and how you watch." : `When and how you watched in ${esc(s.scope)}.`, habitsBlock(hab, "Habits come from diary dates."))];
  const k = HOME_INS.k, C = all ? crowdOf(k, lib.films) : crowdOf(k, R.S.films, R.ratingAt), Y = all ? null : s.scope;
  const ratingsFull = [
    section("rated", "Rated", "How your ratings spread across half-stars.", ratingBlock(s)),
    section("crowd", "Against the crowd", all ? "Where your ratings part ways with everyone else's." : `Films you rated in ${esc(s.scope)}.`, crowdBlock(C, Y)),
    section("top", "Highest &amp; lowest rated", L.top || "Your highest-rated films and your lowest.", bestWorstBlock(s))];

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
    ["people", "People", peopleFull, true],
    ["origin", "Genres &amp; countries", originFull, true],
    ["when", "When you watch", whenFull, true],
    ["ratings", "Ratings", ratingsFull, true],
    ["reviews", "Reviews", [dcard("reviews", "Reviewed", { wide: !reviewStats, line: all ? "Your latest reviews. Search finds any of them." : `What you wrote about films you watched in ${esc(s.scope)}, latest first.`, body: reviewsBlock(s) }),
      dcard("review-stats", "Reviews in numbers", reviewStats)]],
    ["next", "Watch next", [dcard("next", "Watch next", next)]],
  ];
}
</script>
