<script>
/* ---------- desktop: the main page's chapters below On this day and the best decade, every section in full (the owner's
   call, 25 Oct 2026, after trying a dashboard of cards), trimmed where one part repeated another: the crowd's and the
   highest and lowest rated films a row of posters each with the rest a click away, one calendar in When you watch, one
   row of charts in Year by year, and the countries on the map rather than in a column beside it. */
// The chapters, in order, each a list of sections.
function dashChapters(s) {
  const all = s.scope === "all", noMeta = !s.withMeta, L = cardLines(s), lib = state.lib, scope = s.scope;
  const I = homeInsights(), R = all ? null : homeInsights(s.scope), views = viewsOf(s);

  /* films */
  const decCols = [];
  if (s.decades.length) for (let d = s.decades[0].decade; d <= s.decades[s.decades.length - 1].decade; d += 10) {
    const x = s.decades.find((y) => y.decade === d);
    decCols.push({ a: x ? x.count : 0, b: 0, label: `’${String(d).slice(2)}s`, tip: `${d}s: ${plural(x ? x.count : 0, "film")}${x && x.avg ? ` · ${x.avg.toFixed(2)} average` : ""}`, to: x && DR.decade(x) });
  }
  const re = s.films.filter((f) => views(f) > 1).sort((a, b) => views(b) - views(a) || (b.rating || 0) - (a.rating || 0));
  const filmsFull = [
    section("released", "Released", L.released || "Films by decade of release.", s.decades.length ? colChart(decCols, "Films by decade of release", "", 162, { unit: "films" }) : `<div class="empty">No release years in this period.</div>`),
    section("milestones", "Milestones", "Counted through your diary in date order.", milestonesBlock(s)),
    recordsBlock(s) ? section("records", "Records", "The longest, shortest, oldest and newest films.", recordsBlock(s)) : "",
    re.length ? section("rewatched", "Most rewatched", `${L.rewatched} ${dlink(re.length > 8 && D.films("Most rewatched", filmsSub(re), re, { scope, sort: "given", note: (f) => plural(views(f), "viewing") }), `All ${fmtN(re.length)} rewatched films`)}`, rewatchedBlock(s)) : ""];

  /* people, and genres and countries */
  const everyone = (data, label) => dlink(data.total && D.names(label, `${fmtN(data.total)} in all, most watched first`, data.most, { faces: true }), `${fmtN(data.total)} ${label.toLowerCase()}`);
  const people = (kind, data) => noMeta ? emptyMeta() : tabs(kind, [["most", "Most watched"], ["best", "Highest rated"]], state.tab[kind]) + peopleBlock(kind, data, s);
  const peopleFull = [
    section("starring", "Starring", `${everyone(s.cast, "Actors")}. ${castRuleText()} ${castBarText(s)}`, people("cast", s.cast)),
    // voice roles apart from on-screen acting (asked 26 Oct 2026)
    s.voice.total ? section("voices", "Voices", `${everyone(s.voice, "Voice actors")} in animation, narration and other voice roles, counted apart from on-screen acting. Additional voices and cameos don't count. Highest rated needs ${s.minRated}+ rated films.`, people("voices", s.voice)) : "",
    section("directed", "Directed by", `${everyone(s.directors, "Directors")}.`, people("directors", s.directors)),
    section("crew", "Crew", `Writers, cinematographers and composers. Highest rated needs ${s.minRated}+ rated films.`, noMeta ? emptyMeta() : crewBlock(s)),
    all ? section("people-years", "People over the years", "Who's new, who stays, and how many directors each year brought.", noMeta ? emptyMeta() : peopleYearsBlock(I)) : "",
    !all && R.firstYear !== s.scope ? section("new-in", `New in ${esc(s.scope)}`, "Directors, actors, countries and languages that first turned up in your diary this year.", noMeta ? emptyMeta() : newInBlock(R)) : ""];
  const originFull = [
    section("origin", "Genre &amp; origin", "Genres and original languages; countries are on the map below.", noMeta ? emptyMeta() : catBlock(s)),
    section("world", "Around the world", "Where your films were made: the more films, the deeper the gold. Hover over a country for more; click it for its films. Zoom with + and −, or ctrl and the wheel, and drag to move around.",
      noMeta ? emptyMeta() : worldMapHtml(s.countries, { scope: s.scope, total: s.films.filter((f) => metaOf(f) && (metaOf(f).k || []).length).length, tops: true }) || `<div class="empty">No countries known for these films yet.</div>`),
    all ? section("genre-years", "Genres year by year", "The share of each year's films in each genre.", noMeta ? emptyMeta() : genreYearsBlock(I)) : "",
    all ? section("genre-rates", "Genres as you rate them", "Each genre against your own average and against the crowd.", noMeta ? emptyMeta() : genresBlock(I)) : ""];

  /* when you watch, and ratings */
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
  const W = lib.watchlistFilms.length ? watchNext(lib) : undefined;
  const reviewsFull = [
    section("reviews", "Reviewed", all ? "Your latest reviews. Search finds any of them." : `What you wrote about films you watched in ${esc(s.scope)}, latest first.`, reviewsBlock(s)),
    lib.reviewTextMissing || !lib.reviews.length ? "" : section("review-stats", all ? "Your reviews in numbers" : `Your ${esc(s.scope)} reviews in numbers`, "What you write, and when you bother.", reviewInsightsBlock(lib, all ? null : s.scope))];
  const nextFull = [W !== undefined ? section("next", "Watch next", "Your watchlist, likeliest favourites first.", watchNextBlock(W)) : ""];

  return [
    ["films", "Films", filmsFull],
    ["people", "People", peopleFull],
    ["origin", "Genres &amp; countries", originFull],
    ["when", "When you watch", whenFull],
    ["ratings", "Ratings", ratingsFull],
    ["reviews", "Reviews", reviewsFull],
    ["next", "Watch next", nextFull],
  ];
}
</script>
