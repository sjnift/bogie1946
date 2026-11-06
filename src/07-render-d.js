<script>
/* ---------- desktop: the main page's chapters, one at a time (asked 5 Nov 2026: "homepage is too cluttered"; the owner
   chose "one chapter at a time" over trimming the long page further). Under the tiles: Recently watched, On this day and
   the best decade, always; then a bar of chapter tabs that stays at the top, and only the chosen chapter below it, every
   section in full (the owner's call, 25 Oct 2026, after trying a dashboard of cards), trimmed where one part repeated
   another: the crowd's and the highest and lowest rated films a row of posters each with the rest a click away, one
   calendar in When you watch, one row of charts in Year by year, and the countries on the map rather than in a column
   beside it. Only the chapter on screen is worked out. */
// The chapters, in order.
const CHAPTERS = [["films", "Films"], ["people", "People"], ["origin", "Genres &amp; countries"], ["when", "When you watch"],
  ["ratings", "Ratings"], ["reviews", "Reviews"], ["lists", "Lists"], ["next", "Watch next"]];
// The chapters this diary has (Watch next needs a watchlist), and the one to show.
const chaptersOf = (lib) => CHAPTERS.filter(([id]) => (id !== "next" || lib.watchlistFilms.length) && (id !== "lists" || (lib.lists || []).length));
function chapterOn(lib) {
  const have = chaptersOf(lib);
  return (have.find(([id]) => id === state.chapter) || have[0])[0];
}
// One chapter's sections, worked out only when it's the one on screen. (Before everyone's credits are worked out on a
// visit with a big diary, only Films is drawn: renderSections.)
function dashChapter(s, id) {
  const all = s.scope === "all", noMeta = !s.withMeta, lib = state.lib, scope = s.scope;
  const I = () => homeInsights(), R = () => all ? null : homeInsights(s.scope);

  if (id === "films") {
    const L = cardLines(s), views = viewsOf(s);
    const decCols = [];
    if (s.decades.length) for (let d = s.decades[0].decade; d <= s.decades[s.decades.length - 1].decade; d += 10) {
      const x = s.decades.find((y) => y.decade === d);
      decCols.push({ a: x ? x.count : 0, b: 0, label: `’${String(d).slice(2)}s`, tip: `${d}s: ${plural(x ? x.count : 0, "film")}${x && x.avg ? ` · ${x.avg.toFixed(2)} average` : ""}`, to: x && DR.decade(x) });
    }
    const re = s.films.filter((f) => views(f) > 1).sort((a, b) => views(b) - views(a) || (b.rating || 0) - (a.rating || 0));
    return [
      section("released", "Released", L.released || "Films by year of release.", (() => {
        const rel = state.tab.released || "films";
        return tabs("released", [["films", "Films by year"], ["rating", "Rating by year"], ["decades", "By decade"]], rel) + (rel === "decades"
          ? (s.decades.length ? colChart(decCols, "Films by decade of release", "", 162, { y: "Films", x: "Decade of release" }) : `<div class="empty">No release years in this period.</div>`)
          : releaseYearsChart(s, rel, 162, 10));
      })()),
      section("milestones", "Milestones", "Counted through your diary in date order.", milestonesBlock(s)),
      recordsBlock(s) ? section("records", "Records", "The longest, shortest, oldest and newest films.", recordsBlock(s)) : "",
      re.length ? section("rewatched", "Most rewatched", `${L.rewatched} ${dlink(re.length > 8 && D.films("Most rewatched", filmsSub(re), re, { scope, sort: "given", note: (f) => plural(views(f), "viewing") }), `All ${fmtN(re.length)} rewatched films`)}`, rewatchedBlock(s)) : ""];
  }

  if (id === "people") {
    const everyone = (data, label) => dlink(data.total && D.names(label, `${fmtN(data.total)} in all, most watched first`, data.most, { faces: true }), `${fmtN(data.total)} ${label.toLowerCase()}`);
    const people = (kind, data) => noMeta ? emptyMeta() : tabs(kind, [["most", "Most watched"], ["best", "Highest rated"]], state.tab[kind]) + peopleBlock(kind, data, s);
    const Ri = R();
    return [
      section("starring", "Starring", `${everyone(s.cast, "Actors")}. ${esc(castBarText(s))} ${castRuleHtml()}`, people("cast", s.cast)),
      // voice roles apart from on-screen acting (asked 26 Oct 2026)
      s.voice.total ? section("voices", "Voices", `${everyone(s.voice, "Voice actors")} in animation, narration and other voice roles, counted apart from on-screen acting. Additional voices and cameos don't count. Highest rated needs ${s.minRated}+ rated films.`, people("voices", s.voice)) : "",
      section("directed", "Directed by", `${everyone(s.directors, "Directors")}.`, people("directors", s.directors)),
      section("crew", "Crew", `Writers, cinematographers and composers. Highest rated needs ${s.minRated}+ rated films.`, noMeta ? emptyMeta() : crewBlock(s)),
      all ? section("people-years", "People over the years", "Who's new, who stays, and how many directors each year brought.", noMeta ? emptyMeta() : peopleYearsBlock(I())) : "",
      !all && Ri.firstYear !== s.scope ? section("new-in", `New in ${esc(s.scope)}`, "Directors, actors, countries and languages that first turned up in your diary this year.", noMeta ? emptyMeta() : newInBlock(Ri)) : ""];
  }

  if (id === "origin") return [
    section("origin", "Genre &amp; origin", "Genres and original languages; countries are on the map below.", noMeta ? emptyMeta() : catBlock(s)),
    section("world", "Around the world", "Where your films were made: the more films, the deeper the gold. Hover over a country for more; click it for its films. Zoom with + and −, or ctrl and the wheel, and drag to move around.",
      noMeta ? emptyMeta() : worldMapHtml(s.countries, { scope: s.scope, total: s.films.filter((f) => metaOf(f) && (metaOf(f).k || []).length).length, tops: true }) || `<div class="empty">No countries known for these films yet.</div>`),
    all ? section("genre-years", "Genres year by year", "The share of each year's films in each genre.", noMeta ? emptyMeta() : genreYearsBlock(I())) : "",
    all ? section("genre-rates", "Genres as you rate them", "Each genre against your own average and against the crowd.", noMeta ? emptyMeta() : genresBlock(I())) : ""];

  if (id === "when") {
    const prevY = all ? "" : String(+s.scope - 1);
    const G = monthGrid(lib, metaOf, all ? null : s.scope), mLine = G && monthsLine(G);
    const Ii = I(), Ri = R();
    const hab = all ? Ii.habits : Ri.habits.filter((h) => !["Longest streak", "Biggest day", "Oldest film"].includes(h.k));
    return [
      section("logged", "Logged", all ? "Diary entries over time, by day and by date." : `Diary entries in ${esc(s.scope)}, week by week.`, diaryBlock(s)),
      section("months", "Month by month", G && G.Y ? `Each month of ${esc(G.Y)} against your usual for it.` : "Every month of every year, darker for more.",
        G ? `${mLine ? `<p class="lead">${mLine}</p>` : ""}${monthGridHtml(G)}${monthTableHtml(G)}` : monthTableHtml(G)),
      section("seasons", "Seasons", all ? "Your diary through India's seasons, and the genres each one leans to." : `${esc(s.scope)} through India's seasons, against the rest of the year.`, seasonsBlock(seasonData(lib, metaOf, all ? null : s.scope))),
      all ? section("years", "Year by year", "By the year you watched, from diary dates.", yearsBlock(Ii)) : "",
      all ? "" : section("vsprev", `Against ${prevY}`, `${esc(s.scope)} next to the year before.`, vsPrevBlock(Ri, prevY)),
      section("habits", "Habits", all ? "When and how you watch." : `When and how you watched in ${esc(s.scope)}.`, habitsBlock(hab, "Habits come from diary dates."))];
  }

  if (id === "ratings") {
    const L = cardLines(s), Ri = R(); I(); // homeInsights keeps the crowd it used in HOME_INS
    const k = HOME_INS.k, C = all ? crowdOf(k, lib.films) : crowdOf(k, Ri.S.films, Ri.ratingAt), Y = all ? null : s.scope;
    return [
      section("rated", "Rated", "How your ratings spread across half-stars.", ratingBlock(s)),
      section("crowd", "Against the crowd", all ? "Where your ratings part ways with everyone else's." : `Films you rated in ${esc(s.scope)}.`, crowdBlock(C, Y)),
      section("top", "Highest &amp; lowest rated", L.top || "Your highest-rated films and your lowest.", bestWorstBlock(s))];
  }

  if (id === "reviews") return [
    section("reviews", "Reviewed", all ? "Your latest reviews. Search finds any of them." : `What you wrote about films you watched in ${esc(s.scope)}, latest first.`, reviewsBlock(s)),
    lib.reviewTextMissing || !lib.reviews.length ? "" : section("review-stats", all ? "Your reviews in numbers" : `Your ${esc(s.scope)} reviews in numbers`, "What you write, and when you bother.", reviewInsightsBlock(lib, all ? null : s.scope))];

  // your lists (06t-lists): the same whatever the year, since a list isn't of a year; a filter narrows them
  if (id === "lists") return [section("lists", "Lists", `${esc(listsLine(lib.lists))} Your lists on Letterboxd, newest first. They come with an export.`, listCardsHtml(lib.lists))];

  if (id === "next") { const W = lib.watchlistFilms.length ? watchNext(lib) : undefined;
    return [W !== undefined ? section("next", "Watch next", "Your watchlist, likeliest favourites first.", watchNextBlock(W)) : ""]; }
  return [];
}
</script>
