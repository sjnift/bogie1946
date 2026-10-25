<script>
/* ---------- insights: patterns across the whole diary, shared by both layouts ----------
   Year trends come from diary dates. Crowd comparisons need a crowd score per film, out of 10:
   Letterboxd members (through Apify), TMDB users (from the TMDB lookup), IMDb users and critics (from OMDb). */
const CROWDS = {
  // (an average read from a film's own page may come without its count, n 0: Letterboxd shows one only once a film has
  // enough ratings, so it counts; until Oct 2026 such films were left out of every comparison)
  letterboxd: { label: "Letterboxd members", short: "Letterboxd", score: (m, f) => { const x = f && LBX[f.key]; return x && x.r && (!x.n || x.n >= 10) ? x.r * 2 : null; } },
  imdb: { label: "IMDb users", short: "IMDb", score: (m) => m && m.ir && (m.iv || 0) >= 100 ? m.ir : null },
  tmdb: { label: "TMDB users", short: "TMDB", score: (m) => m && m.va && (m.vc || 0) >= 25 ? m.va : null },
  critics: { label: "Critics (Metacritic)", short: "Critics", score: (m) => m && m.mc ? m.mc / 10 : null },
};
// A crowd's score the way that crowd shows it: Letterboxd in stars out of 5, the others out of 10.
// How far apart a film must be to be listed against the crowd: ¾★ either way; for the site's owner's own diary alone,
// ½★ above (their call, 25 Oct 2026: ¾★ left them two films; everyone else, guests included, keeps ¾★).
const SITE_OWNER = "bogie1946";
const isSiteOwner = () => !!(typeof MY_LIB === "object" && MY_LIB && MY_LIB.profile && String(MY_LIB.profile.username || "").toLowerCase() === SITE_OWNER);
const crowdAbove = () => (isSiteOwner() ? 0.5 : 0.75), CROWD_BELOW = 0.75;
const starPart = (x) => (x === 0.5 ? "½★" : x === 0.75 ? "¾★" : `${x}★`);
const crowdScore = (key, stars5) => key === "letterboxd" ? `${stars5.toFixed(1)}★` : (stars5 * 2).toFixed(1);
const pctOf = (n, d) => d ? Math.round(n / d * 100) : 0;
const starsNum = (x) => `${x.toFixed(1)}★`;
// In a table that compares its rows, the highest of each column in gold and the lowest in purple (asked Oct 2026): the
// class for each row's value (" hi", " lo" or ""). Values go in as shown, so two "3.49"s tie; null leaves a row out (a
// year still under way, in counts). Only a single clear winner is marked (the owner's call, Oct 2026): an end shared by
// two or more rows, fewer than three values, or all alike leave that end unmarked.
function hiLo(values) {
  const xs = values.filter((v) => v != null && Number.isFinite(v));
  const max = Math.max(...xs), min = Math.min(...xs), ties = (x) => xs.filter((v) => v === x).length;
  if (xs.length < 3 || max === min) return values.map(() => "");
  const hi = ties(max) === 1, lo = ties(min) === 1;
  return values.map((v) => v == null || !Number.isFinite(v) ? "" : hi && v === max ? " hi" : lo && v === min ? " lo" : "");
}
const HILO_NOTE = "Highest in each column in gold, lowest in purple.";
// Average rating by year as columns: only the best year's number (gold) and the worst's (purple) are written over them,
// the rest show on hover or tap, so a long run of years doesn't crowd (the owner found every number congested, Oct 2026).
function avgYearsChart(years) {
  const shown = years.map((p) => p.avgRating ? +p.avgRating.toFixed(2) : null), H = hiLo(shown);
  const mark = new Map(years.map((p, i) => [p.year, H[i].trim()])), few = shown.filter((v) => v != null).length < 3;
  return { values: (c) => { const k = mark.get(c.year); return few ? c.a.toFixed(2) : k ? `<b class="${k}">${c.a.toFixed(2)}</b>` : ""; }, base: valuesBase(years.map((p) => p.avgRating), 0.25) };
}
// each calendar month: films, films a year (or the usual for that month), your average
const monthHiLo = (G, cal) => ({ films: hiLo(cal.map((c) => c.E.length)), year: hiLo(cal.map((c) => G.Y ? (c.usual != null ? +c.usual.toFixed(1) : null) : +c.perYear.toFixed(1))),
  avg: hiLo(cal.map((c) => c.avg ? +c.avg.toFixed(2) : null)) });
// each year: counts leave out a year still under way; shares and averages don't
const yearsHiLo = (ys) => ({ films: hiLo(ys.map((p) => p.pace ? null : p.films)), hours: hiLo(ys.map((p) => p.pace ? null : Math.round(p.hours))),
  rating: hiLo(ys.map((p) => p.avgRating ? +p.avgRating.toFixed(2) : null)), newShare: hiLo(ys.map((p) => p.newShare)), nonEnglish: hiLo(ys.map((p) => p.nonEnglish)), rewatches: hiLo(ys.map((p) => p.entries ? pctOf(p.rewatches, p.entries) : null)),
  countries: hiLo(ys.map((p) => p.pace ? null : p.countries || null)) });
// each genre: films, share, your average, against your average, against the crowd
const genresHiLo = (gs) => ({ count: hiLo(gs.map((g) => g.count)), share: hiLo(gs.map((g) => g.share)), mine: hiLo(gs.map((g) => +g.mine.toFixed(2))),
  vsMe: hiLo(gs.map((g) => +g.vsMe.toFixed(2))), vsCrowd: hiLo(gs.map((g) => g.vsCrowd == null ? null : +g.vsCrowd.toFixed(2))) });
const signed = (x, digits = 1) => Math.abs(x) < 0.5 * Math.pow(10, -digits) ? (0).toFixed(digits) : `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(digits)}`;
function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = avg(xs), my = avg(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const topOf = (map) => { let best = null; for (const [k, v] of map) if (!best || v > best[1]) best = [k, v]; return best; };
const bump = (map, k, n = 1) => map.set(k, (map.get(k) || 0) + n);

// Films rated by you and by a crowd, with both scores, the ones you rate furthest above them first.
function crowdDrill(films, key, title, rOf = (f) => f.rating) {
  const c = CROWDS[key] || CROWDS.tmdb;
  const rows = films.map((f) => { const r = rOf(f), s = r && c.score(metaOf(f), f); return s ? { f, crowd: s / 2, diff: r - s / 2 } : null; })
    .filter(Boolean).sort((a, b) => b.diff - a.diff);
  const by = new Map(rows.map((x) => [x.f, x]));
  return D.films(title || `You against ${c.label}`, rows.length ? `${plural(rows.length, "film")} · ${signed(avg(rows.map((x) => x.diff)), 2)}★ against them on average` : "", rows.map((x) => x.f),
    { sort: "given", ratingOf: rOf, note: (f) => { const x = by.get(f); return `${c.short} ${crowdScore(c === CROWDS[key] ? key : "tmdb", x.crowd)} · you ${signed(x.diff)}★`; } });
}
const hasGenre = (g) => (f) => { const m = metaOf(f); return !!m && m.g.includes(g); };
const notEnglish = (f) => { const m = metaOf(f); return !!m && !!m.l && m.l !== "English"; };
const langNote = (f) => metaOf(f).l;
// Diary entries logged the day you watched, and the ones logged later.
function loggingDrill(es, pct) {
  const same = es.filter((e) => e.logged === e.date), later = es.filter((e) => e.logged !== e.date);
  return D.groups("Same-day logging", `${pct}% logged the day you watched`, [D.entries("Logged the same day", entriesSub(same), same),
    D.entries("Logged on another day", entriesSub(later), later, { note: (e) => { const d = dayIndex(e.logged) - dayIndex(e.date); return `Logged ${fmtDate(e.logged)}, ${plural(Math.abs(d), "day")} ${d >= 0 ? "later" : "earlier"}`; } })]);
}
// The data behind one year's number in the year-by-year view.
function yearDrill(p, what) {
  const y = p.year;
  if (what === "entries") return D.entries(`Diary of ${y}`, entriesSub(p.E), p.E);
  if (what === "hours") return D.films(`Hours in ${y}`, `${fmtN(Math.round(p.hours))} hours`, p.F.filter(runtimeOf), { scope: y, sort: "runtime",
    note: (f) => { const v = viewsIn(f, y); return `${runtimeOf(f)} min${v > 1 ? ` × ${v} viewings` : ""}`; } });
  if (what === "rating") {
    const last = new Map();
    for (const e of p.E) if (e.rating) last.set(e.film, e.rating);
    const r = (f) => last.has(f) ? last.get(f) : f.rating;
    const fs = p.F.filter(r).sort((a, b) => r(b) - r(a));
    return D.films(`Ratings in ${y}`, `${p.avgRating ? p.avgRating.toFixed(2) : "—"} average · ${plural(fs.length, "film")}`, fs, { sort: "given", ratingOf: r });
  }
  if (what === "age") return D.films(`Film age in ${y}`, p.age != null ? `${Math.round(p.age)} years old on average when watched` : "", p.F.filter((f) => f.year), { sort: "old", note: (f) => `${plural(+y - f.year, "year")} old` });
  if (what === "nonEnglish") return D.films(`Not in English, ${y}`, filmsSub(p.nonEngFilms), p.nonEngFilms, { scope: y, note: langNote });
  if (what === "rewatches") { const es = p.E.filter((e) => e.rewatch); return D.entries(`Rewatches in ${y}`, entriesSub(es), es); }
  if (what === "new") { const fs = p.F.filter((f) => f.year >= +y - 1); return D.films(`New releases in ${y}`, `${plural(fs.length, "film")} from ${+y - 1} or ${y}`, fs, { scope: y }); }
  if (what === "countries") {
    const m = new Map();
    for (const f of p.F) for (const k of (metaOf(f) || { k: [] }).k) { if (!m.has(k)) m.set(k, []); m.get(k).push(f); }
    const items = [...m].map(([name, films]) => ({ name, films })).sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
    return D.names(`Countries in ${y}`, plural(items.length, "country", "countries"), items, { scope: y });
  }
  return D.films(`Films of ${y}`, filmsSub(p.F), p.F, { scope: y, sort: "watched" });
}
// "…, and the films they like most tend to be the ones you like most too", or nothing when it can't be measured.
const followText = (r) => r == null ? "" : r >= 0.6 ? ", and the films they like most tend to be the ones you like most too" : r >= 0.35 ? ", and your favourites and theirs overlap a little"
  : ", and your favourites and theirs barely line up";

function computeInsights(lib, metaOf, crowdKey) {
  const E = lib.entries, rated = lib.films.filter((f) => f.rating);
  const overallAvg = avg(rated.map((f) => f.rating));
  const today = new Date(), thisYear = String(today.getFullYear());
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 1)) / 864e5) + 1;

  /* ----- year by year ----- */
  const years = [...new Set(E.map((e) => e.date.slice(0, 4)))].sort();
  const perYear = years.map((y) => {
    const es = E.filter((e) => e.date.startsWith(y));
    const films = [...new Set(es.map((e) => e.film))];
    let minutes = 0;
    for (const e of es) { const m = metaOf(e.film); if (m && m.r) minutes += m.r; }
    const ratings = es.map((e) => e.rating || e.film.rating).filter(Boolean);
    const dated = films.filter((f) => f.year);
    const langs = films.map(metaOf).filter((m) => m && m.l);
    const nonEngFilms = films.filter(notEnglish);
    const genres = new Map(), directors = new Map(), actors = new Map(), countries = new Set();
    let withMeta = 0;
    for (const f of films) {
      const m = metaOf(f); if (!m) continue; withMeta++;
      new Set(m.g).forEach((g) => bump(genres, g)); new Set(m.d).forEach((d) => bump(directors, d));
      new Set(m.c).forEach((c) => bump(actors, c)); m.k.forEach((k) => countries.add(k));
    }
    const pace = y === thisYear && dayOfYear > 30 && dayOfYear < 360 ? Math.round(films.length / dayOfYear * 365) : null;
    return {
      year: y, E: es, F: films, nonEngFilms, films: films.length, entries: es.length, rewatches: es.filter((e) => e.rewatch).length, hours: minutes / 60, pace,
      avgRating: avg(ratings), age: dated.length ? avg(dated.map((f) => +y - f.year)) : null,
      newShare: dated.length ? pctOf(dated.filter((f) => f.year >= +y - 1).length, dated.length) : null,
      nonEnglish: langs.length >= 3 ? pctOf(langs.filter((m) => m.l !== "English").length, langs.length) : null,
      genres, withMeta, countries: countries.size,
      topGenre: topOf(genres), topDirector: topOf(directors), topActor: topOf(actors),
    };
  });
  const usable = perYear.filter((p) => p.films >= 5);
  const busiest = perYear.reduce((a, p) => !a || p.films > a.films ? p : a, null);

  /* ----- changing tastes: the earliest years against the latest ----- */
  const tastes = { lines: [], table: null };
  if (usable.length >= 2) {
    const span = usable.length >= 4 ? 2 : 1;
    const early = usable.slice(0, span), late = usable.slice(-span);
    const label = (g) => g.length > 1 ? `${g[0].year}–${g[g.length - 1].year.slice(2)}` : g[0].year;
    const share = (group, genre) => { const n = group.reduce((s, p) => s + (p.genres.get(genre) || 0), 0), d = group.reduce((s, p) => s + p.withMeta, 0); return d ? n / d * 100 : null; };
    const mean = (group, k) => { const v = group.map((p) => p[k]).filter((x) => x != null); return v.length ? avg(v) : null; };
    const E0 = label(early), L0 = label(late);
    const allGenres = new Map();
    for (const p of perYear) for (const [g, n] of p.genres) bump(allGenres, g, n);
    const top = [...allGenres].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
    const moves = top.map((g) => ({ g, from: share(early, g), to: share(late, g) })).filter((x) => x.from != null && x.to != null).map((x) => ({ ...x, d: x.to - x.from }));
    const filmsIn = (group, test) => [...new Set(group.flatMap((p) => p.F))].filter(test);
    const thenNow = (title, test, o) => { const a = filmsIn(late, test), b = filmsIn(early, test);
      return D.groups(title, `${L0} against ${E0}`, [D.films(L0, filmsSub(a), a, o), D.films(E0, filmsSub(b), b, o)]); };
    const risers = moves.filter((x) => x.d >= 5).sort((a, b) => b.d - a.d).slice(0, 2);
    const fallers = moves.filter((x) => x.d <= -5).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const x of risers) tastes.lines.push({ dir: "up", big: x.g, text: `${x.g} grew from ${Math.round(x.from)}% of your films in ${E0} to ${Math.round(x.to)}% in ${L0}.`, to: thenNow(`${x.g}, then and now`, hasGenre(x.g)) });
    for (const x of fallers) tastes.lines.push({ dir: "down", big: `Less ${x.g}`, text: `${x.g} fell from ${Math.round(x.from)}% of your films in ${E0} to ${Math.round(x.to)}% in ${L0}.`, to: thenNow(`${x.g}, then and now`, hasGenre(x.g)) });
    const a0 = mean(early, "age"), a1 = mean(late, "age");
    if (a0 != null && a1 != null && Math.abs(a1 - a0) >= 3) tastes.lines.push({ dir: a1 > a0 ? "up" : "down", big: a1 > a0 ? "Older films" : "Newer films",
      text: a1 > a0 ? `You're watching older films: on average ${Math.round(a1)} years old when you saw them in ${L0}, against ${Math.round(a0)} in ${E0}.`
        : `You're watching newer films: on average ${Math.round(a1)} years old when you saw them in ${L0}, against ${Math.round(a0)} in ${E0}.`,
      to: thenNow("Release years, then and now", (f) => !!f.year, { sort: "old", note: (f) => `Released ${f.year}` }) });
    const n0 = mean(early, "nonEnglish"), n1 = mean(late, "nonEnglish");
    if (n0 != null && n1 != null && Math.abs(n1 - n0) >= 10) tastes.lines.push({ dir: n1 > n0 ? "up" : "down", big: n1 > n0 ? "World cinema" : "More English",
      text: `Films not in English went from ${Math.round(n0)}% of your watching in ${E0} to ${Math.round(n1)}% in ${L0}.`, to: thenNow("Not in English, then and now", notEnglish, { note: langNote }) });
    const r0 = mean(early, "avgRating"), r1 = mean(late, "avgRating");
    if (r0 != null && r1 != null && Math.abs(r1 - r0) >= 0.2) tastes.lines.push({ dir: r1 > r0 ? "up" : "down", big: r1 > r0 ? "Kinder" : "Tougher",
      text: r1 > r0 ? `You've grown more generous: your average rating rose from ${starsNum(r0)} in ${E0} to ${starsNum(r1)} in ${L0}.`
        : `You've grown tougher: your average rating fell from ${starsNum(r0)} in ${E0} to ${starsNum(r1)} in ${L0}.`, to: thenNow("Your ratings, then and now", (f) => !!f.rating) });
    const w0 = mean(early, "films"), w1 = mean(late, "films");
    if (w0 && w1 && Math.abs(w1 - w0) / w0 >= 0.25) tastes.lines.push({ dir: w1 > w0 ? "up" : "down", big: w1 > w0 ? "More films" : "Fewer films",
      text: `You watch ${w1 > w0 ? "more" : "fewer"} films than you used to: about ${Math.round(w1)} a year in ${L0}, against ${Math.round(w0)} in ${E0}.`,
      to: D.groups("How much you watch", `${L0} against ${E0}`, [late, early].map((g, i) => { const es = g.flatMap((p) => p.E); return D.entries(i ? E0 : L0, entriesSub(es), es); })) });
    tastes.table = { genres: top, years: usable.map((p) => ({ year: p.year, p, shares: top.map((g) => p.withMeta ? Math.round((p.genres.get(g) || 0) / p.withMeta * 100) : null) })) };
  }

  /* ----- genres: what you watch, how you rate it, and how the crowd does ----- */
  const crowd = CROWDS[crowdKey] || CROWDS.tmdb;
  const gmap = new Map();
  for (const f of lib.films) {
    const m = metaOf(f); if (!m) continue;
    for (const g of new Set(m.g)) {
      let x = gmap.get(g); if (!x) { x = { name: g, films: [], mine: [], vsCrowd: [] }; gmap.set(g, x); }
      x.films.push(f);
      if (f.rating) { x.mine.push(f.rating); const c = crowd.score(m, f); if (c) x.vsCrowd.push(f.rating - c / 2); }
    }
  }
  const withMetaCount = lib.films.filter((f) => metaOf(f)).length;
  const genres = [...gmap.values()].filter((g) => g.mine.length >= 3).map((g) => ({
    name: g.name, films: g.films, count: g.films.length, share: pctOf(g.films.length, withMetaCount), mine: avg(g.mine),
    vsMe: avg(g.mine) - overallAvg, vsCrowd: g.vsCrowd.length >= 3 ? avg(g.vsCrowd) : null,
  })).sort((a, b) => b.count - a.count);
  const genreLines = [];
  const solid = genres.filter((g) => g.mine.length >= 5 || g.count >= 5);
  const loved = [...solid].sort((a, b) => b.vsMe - a.vsMe)[0];
  const gFilms = (g) => D.films(g.name, filmsSub(g.films), g.films);
  if (loved && loved.vsMe >= 0.15) genreLines.push({ text: `You rate ${loved.name} ${loved.vsMe.toFixed(1)}★ above your average, more than any other genre.`, to: gFilms(loved) });
  const lukewarm = solid.slice(0, 5).filter((g) => g.vsMe <= -0.15).sort((a, b) => a.vsMe - b.vsMe)[0];
  if (lukewarm) genreLines.push({ text: `${lukewarm.name} is among the genres you watch most (${lukewarm.share}% of your films), but you rate it ${Math.abs(lukewarm.vsMe).toFixed(1)}★ below your average.`, to: gFilms(lukewarm) });
  const withCrowd = genres.filter((g) => g.vsCrowd != null);
  const above = [...withCrowd].sort((a, b) => b.vsCrowd - a.vsCrowd)[0], below = [...withCrowd].sort((a, b) => a.vsCrowd - b.vsCrowd)[0];
  if (above && above.vsCrowd >= 0.2) genreLines.push({ text: `Next to ${crowd.label}, you're kindest to ${above.name}: ${above.vsCrowd.toFixed(1)}★ above them on average.`, to: crowdDrill(above.films, crowdKey, `${above.name} against ${crowd.label}`) });
  if (below && below !== above && below.vsCrowd <= -0.2) genreLines.push({ text: `You're harshest on ${below.name}: ${Math.abs(below.vsCrowd).toFixed(1)}★ below ${crowd.label} on average.`, to: crowdDrill(below.films, crowdKey, `${below.name} against ${crowd.label}`) });

  /* ----- people: obsessions, companions, binges, discoveries ----- */
  const peopleFrom = (role) => {
    const map = new Map();
    for (const e of E) {
      const m = metaOf(e.film); if (!m) continue;
      const names = m[role];
      for (const n of names) {
        const k = personKey(n);
        let p = map.get(k); if (!p) { p = { key: k, name: n, firstSeen: new Map(), years: new Set() }; map.set(k, p); }
        if (!p.firstSeen.has(e.film)) p.firstSeen.set(e.film, e.date);
        p.years.add(e.date.slice(0, 4));
      }
    }
    return [...map.values()].map((p) => ({ ...p, films: [...p.firstSeen.keys()], count: p.firstSeen.size }));
  };
  const directors = peopleFrom("d"), actors = peopleFrom("c");
  const latest = usable.length ? usable[usable.length - 1].year : years[years.length - 1];
  const obsessions = (list) => list.map((p) => {
    const inLatest = [...p.firstSeen.values()].filter((d) => d.startsWith(latest)).length;
    return { ...p, inLatest, before: p.count - inLatest };
  }).filter((p) => p.inLatest >= 2 && p.before === 0).sort((a, b) => b.inLatest - a.inLatest || a.name.localeCompare(b.name)).slice(0, 6);
  const companions = (list) => list.filter((p) => p.years.size >= 3).sort((a, b) => b.years.size - a.years.size || b.count - a.count).slice(0, 6);
  const binges = directors.map((p) => {
    const dates = [...p.firstSeen.values()].sort();
    let best = null;
    for (let i = 0; i < dates.length; i++) {
      let j = i;
      while (j + 1 < dates.length && dayIndex(dates[j + 1]) - dayIndex(dates[i]) <= 30) j++;
      const n = j - i + 1;
      if (n >= 3 && (!best || n > best.n)) best = { n, from: dates[i], to: dates[j] };
    }
    if (best) best.entries = E.filter((e) => p.firstSeen.get(e.film) === e.date && e.date >= best.from && e.date <= best.to);
    return best ? { ...p, binge: best } : null;
  }).filter(Boolean).sort((a, b) => b.binge.n - a.binge.n || (b.binge.to > a.binge.to ? 1 : -1)).slice(0, 5);
  const firstYear = new Map();
  for (const p of directors) { const y = [...p.firstSeen.values()].sort()[0].slice(0, 4); if (!firstYear.has(y)) firstYear.set(y, []); firstYear.get(y).push(p); }
  const discoveries = years.slice(1).map((y) => { const people = (firstYear.get(y) || []).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)); return { year: y, count: people.length, people }; });

  /* ----- against the crowd ----- */
  const pairs = rated.map((f) => { const c = crowd.score(metaOf(f), f); return c ? { f, you: f.rating, crowd: c / 2, diff: f.rating - c / 2 } : null; }).filter(Boolean);
  const crowdOut = { key: crowdKey, label: crowd.label, short: crowd.short, n: pairs.length, available: {} };
  for (const k of Object.keys(CROWDS)) crowdOut.available[k] = rated.filter((f) => CROWDS[k].score(metaOf(f), f)).length;
  if (pairs.length >= 5) {
    crowdOut.r = pearson(pairs.map((p) => p.you), pairs.map((p) => p.crowd));
    crowdOut.meanDiff = avg(pairs.map((p) => p.diff));
    crowdOut.higher = pairs.filter((p) => p.diff >= crowdAbove()).sort((a, b) => b.diff - a.diff || b.you - a.you).slice(0, 12);
    crowdOut.lower = pairs.filter((p) => p.diff <= -CROWD_BELOW).sort((a, b) => a.diff - b.diff || a.you - b.you).slice(0, 12);
  }
  const popularity = (f) => { const x = LBX[f.key], m = metaOf(f); return x && x.n ? { n: x.n, src: "Letterboxd" } : m && m.iv ? { n: m.iv, src: "IMDb" } : m && m.vc ? { n: m.vc, src: "TMDB" } : null; };
  crowdOut.gems = rated.filter((f) => f.rating >= 4.5).map((f) => ({ f, pop: popularity(f) }))
    .filter((x) => x.pop && x.pop.n < { Letterboxd: 5000, IMDb: 25000, TMDB: 1000 }[x.pop.src])
    .sort((a, b) => b.f.rating - a.f.rating || a.pop.n - b.pop.n).slice(0, 12);

  /* ----- habits ----- */
  const habits = [];
  if (E.length) {
    const weekendE = E.filter((e) => weekdayOf(e.date) >= 5);
    const wk = pctOf(weekendE.length, E.length);
    habits.push({ k: wk >= 36 ? "Weekend watcher" : wk <= 22 ? "Weeknight watcher" : "Weekends", v: `${wk}%`, notable: wk >= 36 || wk <= 22,
      text: `of your diary falls on a Saturday or Sunday, against 29% if you watched evenly through the week.`, to: D.entries("Weekend diary", entriesSub(weekendE, `${wk}% of the diary`), weekendE) });
    const months = Array(12).fill(0), seen = Array(12).fill(0);
    for (const e of E) months[+e.date.slice(5, 7) - 1]++;
    const first = E[0].date, last = E[E.length - 1].date;
    for (let y = +first.slice(0, 4); y <= +last.slice(0, 4); y++) for (let m = 0; m < 12; m++) {
      const k = `${y}-${String(m + 1).padStart(2, "0")}`;
      if (k >= first.slice(0, 7) && k <= last.slice(0, 7)) seen[m]++;
    }
    const rates = months.map((n, i) => seen[i] ? n / seen[i] : 0), mean = avg(rates.filter((_, i) => seen[i]));
    const best = rates.indexOf(Math.max(...rates));
    const monthE = E.filter((e) => +e.date.slice(5, 7) - 1 === best);
    if (mean && rates[best] / mean >= 1.15) habits.push({ k: "Film month", v: MONTHS_LONG[best], notable: rates[best] / mean >= 1.3, text: `is when you watch most: ${Math.round((rates[best] / mean - 1) * 100)}% more films than an average month.`,
      to: D.entries(`Every ${MONTHS_LONG[best]}`, entriesSub(monthE), monthE) });
    const loggedKnown = E.filter((e) => e.logged);
    const sameDay = pctOf(loggedKnown.filter((e) => e.logged === e.date).length, loggedKnown.length);
    if (loggedKnown.length >= 10) habits.push({ k: "Same-day logging", v: `${sameDay}%`, text: "of films are logged on the day you watch them.", to: loggingDrill(loggedKnown, sameDay) });
    const perDay = new Map(); for (const e of E) bump(perDay, e.date);
    const bingeDays = [...perDay.values()].filter((n) => n >= 3).length;
    const marathonE = E.filter((e) => perDay.get(e.date) >= 3);
    if (bingeDays) habits.push({ k: "Marathon days", v: fmtN(bingeDays), text: `${bingeDays === 1 ? "day" : "days"} with three or more films.`, to: D.entries("Marathon days", `${plural(bingeDays, "day")} with three or more films · ${entriesSub(marathonE)}`, marathonE) });
    const catchE = E.filter((e) => !e.rewatch && e.film.year && +e.date.slice(0, 4) <= e.film.year + 0), catches = catchE.length;
    habits.push({ k: "Same-year catches", v: fmtN(catches), text: `${catches === 1 ? "film" : "films"} seen in the year ${catches === 1 ? "it" : "they"} came out.`, to: catches ? D.entries("Seen the year they came out", entriesSub(catchE), catchE) : null });
    const rwE = E.filter((e) => e.rewatch), rw = pctOf(rwE.length, E.length);
    habits.push({ k: "Rewatches", v: `${rw}%`, text: "of your diary entries are rewatches.", to: rwE.length ? D.entries("Rewatches", entriesSub(rwE, `${rw}% of the diary`), rwE) : null });
    const timedFilms = lib.films.filter((f) => runtimeOf(f)), runtimes = timedFilms.map(runtimeOf);
    const long = runtimes.filter((r) => r >= 150).length, longPct = pctOf(long, runtimes.length);
    if (runtimes.length >= 10) habits.push({ k: "Typical length", v: `${Math.round(avg(runtimes))} min`,
      text: `is your average film; ${!long ? "none run" : !longPct ? `only ${long} ${long === 1 ? "runs" : "run"}` : `${longPct}% run`} 2½ hours or more.`,
      to: D.films("Your films by length", `${Math.round(avg(runtimes))} min on average · longest first`, timedFilms, { sort: "runtime", note: (f) => `${runtimeOf(f)} min` }) });
  }

  /* ----- at a glance: the strongest few findings ----- */
  const glance = [];
  if (busiest) {
    const cur = perYear.find((p) => p.year === thisYear);
    glance.push({ k: "Busiest year", big: busiest.year, text: `${plural(busiest.films, "film")} that year${cur && cur.pace && cur !== busiest ? `. ${thisYear} is on pace for about ${fmtN(cur.pace)}.` : "."}`,
      to: D.films(`Films of ${busiest.year}`, filmsSub(busiest.F), busiest.F, { scope: busiest.year, sort: "watched" }) });
  }
  if (overallAvg) {
    const high = pctOf(rated.filter((f) => f.rating >= 4).length, rated.length);
    const style = overallAvg >= 3.75 ? "a generous rater" : overallAvg <= 3 ? "a tough rater" : "a middle-of-the-road rater";
    glance.push({ k: "Rating style", big: starsNum(overallAvg), text: `average makes you ${style}: ${high}% of your rated films get 4★ or more.`, to: D.films("Rated films", filmsSub(rated), rated) });
  }
  crowdOut.to = crowdDrill(rated, crowdKey);
  if (crowdOut.meanDiff != null) glance.push({ k: `You vs ${crowd.label}`, big: `${signed(crowdOut.meanDiff)}★`, text: `on average against ${crowd.label}${followText(crowdOut.r)}, across ${plural(pairs.length, "film")}.`, to: crowdOut.to });
  if (tastes.lines.length) glance.push({ k: "Changing taste", big: tastes.lines[0].big, text: tastes.lines[0].text, to: tastes.lines[0].to });
  if (loved && loved.vsMe >= 0.15) glance.push({ k: "Best-loved genre", big: loved.name, text: `gets ${loved.vsMe.toFixed(1)}★ more from you than your average film.`, to: gFilms(loved) });
  const obsD = obsessions(directors);
  if (obsD.length) glance.push({ k: `New in ${latest}`, big: obsD[0].name, text: `${obsD[0].inLatest} films in ${latest}, none before. Your newest director obsession.`, to: D.films(obsD[0].name, `${plural(obsD[0].inLatest, "film")} in ${latest}, none before`, obsD[0].films, { person: obsD[0] }) });
  else { const comp = companions(directors)[0]; if (comp) glance.push({ k: "Constant companion", big: comp.name, text: `turns up in your diary in ${comp.years.size} different years.`, to: D.films(comp.name, `In your diary in ${[...comp.years].sort().join(", ")}`, comp.films, { person: comp }) }); }
  const habit = habits.find((h) => h.notable);
  if (habit) glance.push({ k: habit.k, big: habit.v, text: habit.text, to: habit.to });

  return {
    years: perYear, usable, latest, tastes, genres, genreLines, overallAvg,
    people: { obsDirectors: obsD, obsActors: obsessions(actors), compDirectors: companions(directors), compActors: companions(actors), binges, discoveries },
    crowd: crowdOut, habits, glance,
  };
}
// The crowd to compare with: Letterboxd members when enough rated films have their average, then IMDb, then TMDB.
function defaultCrowd(lib, metaOf) {
  const rated = lib.films.filter((f) => f.rating);
  const n = (k) => rated.filter((f) => CROWDS[k].score(metaOf(f), f)).length;
  const enough = (k) => n(k) >= Math.max(5, n("tmdb") * 0.5);
  return enough("letterboxd") ? "letterboxd" : enough("imdb") ? "imdb" : "tmdb";
}
</script>
<script>
/* ---------- one year's insights: that year against the one before, and against your whole diary ---------- */
// `I` is the all-years insights when the caller has them worked out already.
function computeYearInsights(lib, metaOf, Y, crowdKey, I = computeInsights(lib, metaOf, crowdKey)) {
  const S = computeStats(lib, metaOf, Y);
  const cur = I.years.find((p) => p.year === Y), prev = I.years.find((p) => p.year === String(+Y - 1));
  const E = S.entries, overall = I.overallAvg;
  // the rating given that year, if the film was rated in the diary then
  const ratingIn = (f) => { const es = E.filter((e) => e.film === f && e.rating); return es.length ? es[es.length - 1].rating : f.rating; };
  const rated = S.films.map((f) => ({ f, r: ratingIn(f) })).filter((x) => x.r).sort((a, b) => b.r - a.r || a.f.name.localeCompare(b.f.name));

  // the first year each person, country and language turns up anywhere in the diary
  const firstYear = (pick) => {
    const m = new Map();
    for (const e of lib.entries) { const meta = metaOf(e.film); if (!meta) continue; for (const k of pick(meta)) if (!m.has(k)) m.set(k, e.date.slice(0, 4)); }
    return m;
  };
  const firstD = firstYear((m) => m.d.map(personKey)), firstC = firstYear((m) => m.c.map(personKey));
  const firstK = firstYear((m) => m.k), firstL = firstYear((m) => m.l ? [m.l] : []);
  const newIn = (map) => [...map].filter(([, y]) => y === Y).map(([k]) => k);
  const discovered = (ranked, first) => ranked.most.filter((p) => first.get(p.key) === Y);

  // the rating a film got in a given year's diary, or its rating if the diary didn't have one
  const ratingAt = (p) => (f) => { const es = p.E.filter((e) => e.film === f && e.rating); return es.length ? es[es.length - 1].rating : f.rating; };
  const prevY = String(+Y - 1);
  // a change from last year opens both years' data, one under the other
  const both = (title, what) => D.groups(title, `${Y} against ${prevY}`, [yearDrill(cur, what), yearDrill(prev, what)]);
  const changes = [];
  if (cur && prev) {
    const row = (label, a, b, fmt, what) => { if (a != null && b != null) changes.push({ label, now: fmt(a), before: fmt(b), d: fmt(a) === fmt(b) ? 0 : a - b, to: both(label, what) }); };
    row("Films", cur.films, prev.films, fmtN, "films");
    row("Hours", Math.round(cur.hours), Math.round(prev.hours), fmtN, "hours");
    row("Average rating", cur.avgRating, prev.avgRating, (x) => x.toFixed(2), "rating");
    row("New releases", cur.newShare, prev.newShare, (x) => `${x}%`, "new");
    row("Not in English", cur.nonEnglish, prev.nonEnglish, (x) => `${x}%`, "nonEnglish");
    row("Film age when watched", cur.age, prev.age, (x) => `${Math.round(x)} years`, "age");
    row("Countries", cur.countries, prev.countries, fmtN, "countries");
    row("Rewatches", pctOf(cur.rewatches, cur.entries), pctOf(prev.rewatches, prev.entries), (x) => `${x}%`, "rewatches");
  }
  const genreLines = [];
  if (cur && prev && cur.withMeta >= 5 && prev.withMeta >= 5) {
    const moves = [...new Set([...cur.genres.keys(), ...prev.genres.keys()])]
      .map((g) => ({ g, a: (cur.genres.get(g) || 0) / cur.withMeta * 100, b: (prev.genres.get(g) || 0) / prev.withMeta * 100 })).map((x) => ({ ...x, d: x.a - x.b }));
    const line = (x) => `${x.g} went from ${Math.round(x.b)}% of your films in ${+Y - 1} to ${Math.round(x.a)}% in ${Y}.`;
    const to = (x) => D.groups(x.g, `${Y} against ${prevY}`, [cur, prev].map((p) => { const fs = p.F.filter(hasGenre(x.g)); return D.films(`${x.g} in ${p.year}`, filmsSub(fs), fs, { scope: p.year }); }));
    for (const x of moves.filter((x) => x.d >= 8).sort((a, b) => b.d - a.d).slice(0, 2)) genreLines.push({ dir: "up", text: line(x), to: to(x) });
    for (const x of moves.filter((x) => x.d <= -8).sort((a, b) => a.d - b.d).slice(0, 2)) genreLines.push({ dir: "down", text: line(x), to: to(x) });
  }

  const crowd = CROWDS[crowdKey] || CROWDS.tmdb;
  const pairs = rated.map((x) => { const c = crowd.score(metaOf(x.f), x.f); return c ? { f: x.f, you: x.r, crowd: c / 2, diff: x.r - c / 2 } : null; }).filter(Boolean);
  const crowdY = { key: crowdKey, label: crowd.label, short: crowd.short, n: pairs.length, meanDiff: pairs.length ? avg(pairs.map((p) => p.diff)) : null,
    higher: pairs.filter((p) => p.diff >= crowdAbove()).sort((a, b) => b.diff - a.diff).slice(0, 8), lower: pairs.filter((p) => p.diff <= -CROWD_BELOW).sort((a, b) => a.diff - b.diff).slice(0, 8) };

  const habits = [];
  if (E.length) {
    const weekendE = E.filter((e) => weekdayOf(e.date) >= 5), wk = pctOf(weekendE.length, E.length);
    habits.push({ k: "Weekends", v: `${wk}%`, text: "of the year's diary fell on a Saturday or Sunday.", to: D.entries(`Weekends of ${Y}`, entriesSub(weekendE, `${wk}% of the year`), weekendE) });
    if (S.streak.days > 1) habits.push({ k: "Longest streak", v: `${S.streak.days} days`, text: "in a row with at least one film.", to: DR.streak(S) });
    if (S.busiestDay && S.busiestDay.count > 1) habits.push({ k: "Biggest day", v: plural(S.busiestDay.count, "film"), text: `on ${fmtDate(S.busiestDay.key)}.`, to: DR.day(E, S.busiestDay.key) });
    const logged = E.filter((e) => e.logged), sameDay = pctOf(logged.filter((e) => e.logged === e.date).length, logged.length);
    if (logged.length >= 5) habits.push({ k: "Same-day logging", v: `${sameDay}%`, text: "of films logged the day you watched them.", to: loggingDrill(logged, sameDay) });
    habits.push({ k: "Same-year releases", v: fmtN(S.newReleases || 0), text: `films that came out in ${Y}.`, to: S.newReleases ? DR.released(S, Y) : null });
    const oldest = S.films.filter((f) => f.year).sort((a, b) => a.year - b.year)[0];
    if (oldest) habits.push({ k: "Oldest film", v: String(oldest.year), text: `${oldest.name}.`, to: D.film(oldest) });
    const reE = E.filter((e) => e.rewatch);
    habits.push({ k: "Rewatches", v: fmtN(reE.length), text: `of ${plural(E.length, "diary entry", "diary entries")}.`, to: reE.length ? D.entries(`Rewatches in ${Y}`, entriesSub(reE), reE) : null });
  }

  const glance = [];
  const yr = ratingAt(cur || { E });
  if (cur) glance.push({ k: "Films", to: DR.films(S), big: fmtN(cur.films), text: prev ? `${cur.films >= prev.films ? "Up" : "Down"} ${Math.abs(pctOf(cur.films - prev.films, prev.films))}% from ${fmtN(prev.films)} in ${+Y - 1}${cur.pace ? `, and on pace for about ${fmtN(cur.pace)}` : ""}.` : `in your diary${cur.pace ? `, on pace for about ${fmtN(cur.pace)}` : ""}.` });
  const ratedTo = (list, title) => D.films(title, `${list.length ? avg(list.map((x) => x.r)).toFixed(2) : "—"} average · ${plural(list.length, "film")}`, list.map((x) => x.f), { sort: "given", ratingOf: yr });
  if (rated[0]) { const ties = rated.filter((x) => x.r === rated[0].r);
    glance.push({ k: "Film of the year", big: rated[0].f.name, text: `${stars(rated[0].r)}${ties.length > 1 ? `, tied with ${ties.length - 1} more` : ""}.`, to: ties.length > 1 ? ratedTo(ties, `Your ${stars(rated[0].r)} films of ${Y}`) : D.film(rated[0].f) }); }
  if (cur && cur.avgRating && overall) glance.push({ k: "Average rating", big: starsNum(cur.avgRating), text: Math.abs(cur.avgRating - overall) < 0.05 ? "The same as your all-time average." : `${Math.abs(cur.avgRating - overall).toFixed(1)}★ ${cur.avgRating > overall ? "above" : "below"} your all-time average.`, to: ratedTo(rated, `Ratings in ${Y}`) });
  if (cur && cur.topGenre && cur.withMeta) { const fs = cur.F.filter(hasGenre(cur.topGenre[0])); glance.push({ k: "Top genre", big: cur.topGenre[0], text: `${pctOf(cur.topGenre[1], cur.withMeta)}% of the year's films.`, to: D.films(`${cur.topGenre[0]} in ${Y}`, filmsSub(fs), fs, { scope: Y }) }); }
  const dir = S.directors.most[0]; if (dir && dir.count > 1) glance.push({ k: "Director of the year", big: dir.name, text: `${plural(dir.count, "film")} in ${Y}.`, to: DR.person(dir, { scope: Y }) });
  const star = S.cast.most[0]; if (star && star.count > 1) glance.push({ k: "Most seen actor", big: star.name, text: `${plural(star.count, "film")} in ${Y}.`, to: DR.person(star, { scope: Y }) });
  const discD = discovered(S.directors, firstD);
  if (discD.length && diaryYears(lib)[0] !== Y) glance.push({ k: "Discoveries", big: plural(discD.length, "director"), text: `new to your diary in ${Y}${discD[0].count > 1 ? `, led by ${discD[0].name} with ${discD[0].count} films` : ""}.`, to: D.names(`Directors new in ${Y}`, plural(discD.length, "director"), discD, { faces: true, scope: Y }) });
  if (S.busiestMonth) glance.push({ k: "Busiest month", big: MONTHS_LONG[+S.busiestMonth.key.slice(5, 7) - 1], text: `${plural(S.busiestMonth.count, "film")}.`, to: DR.month(E, S.busiestMonth.key) });

  return {
    Y, S, cur, prev, overall, rated, changes, genreLines, glance, habits,
    best: rated.slice(0, 12), worst: rated.filter((x) => x.r <= 2.5).sort((a, b) => a.r - b.r).slice(0, 8),
    topDirectors: S.directors.most.slice(0, 8), topActors: S.cast.most.slice(0, 8),
    discDirectors: discD.slice(0, 8), discActors: discovered(S.cast, firstC).slice(0, 8),
    newCountries: newIn(firstK), newLangs: newIn(firstL), crowd: crowdY, firstYear: diaryYears(lib)[0], ratingAt: yr,
  };
}
// The years with diary entries, oldest first.
const diaryYears = (lib) => [...new Set(lib.entries.map((e) => e.date.slice(0, 4)))].sort();

/* ----- month by month (asked Oct 2026): every month of every year, and each calendar month across the years ----- */
// A month is "in the diary" from the month of its first entry to the month of its last; months before or after aren't
// counted as empty ones. For a single year (`Y`), each of its months also gets your usual for that month in other years.
function monthGrid(lib, metaOf, Y) {
  const all = lib.entries, E = Y ? all.filter((e) => e.date.startsWith(Y)) : all;
  if (!E.length) return null;
  const first = all[0].date.slice(0, 7), last = all[all.length - 1].date.slice(0, 7), live = (ym) => ym >= first && ym <= last;
  const byMonth = new Map();
  for (const e of all) { const k = e.date.slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(e); }
  const ymOf = (y, i) => `${y}-${String(i + 1).padStart(2, "0")}`;
  const years = Y ? [Y] : diaryYears(lib);
  const rows = years.map((y) => {
    const months = MONTHS_LONG.map((_, i) => { const key = ymOf(y, i); return { key, i, E: byMonth.get(key) || [], live: live(key) }; });
    return { year: y, months, E: months.flatMap((m) => m.E) };
  });
  const allYears = diaryYears(lib);
  // each genre's share of the period's films, to see what a month leans to beyond the usual mix
  const periodFilms = [...new Set(E.map((e) => e.film))].filter((f) => metaOf(f)), gAll = new Map();
  for (const f of periodFilms) for (const x of new Set(metaOf(f).g)) bump(gAll, x);
  const minLean = Y ? 3 : 5;
  const cal = MONTHS_LONG.map((name, i) => {
    const ms = rows.map((r) => r.months[i]).filter((m) => m.live), es = ms.flatMap((m) => m.E);
    const ratings = es.map((e) => e.rating || e.film.rating).filter(Boolean);
    const films = [...new Set(es.map((e) => e.film))], g = new Map();
    for (const f of films) { const m = metaOf(f); if (m) for (const x of new Set(m.g)) bump(g, x); }
    // the genre the month leans to most: the biggest share over its share of the rest of the period's films
    const withMeta = films.filter((f) => metaOf(f)).length;
    const lean = [...g].filter(([x, n]) => n >= minLean && periodFilms.length - withMeta > 0).map(([x, n]) => {
      const share = n / withMeta, rest = ((gAll.get(x) || 0) - n) / (periodFilms.length - withMeta);
      return { x, share, rest, lift: rest > 0 ? share / rest : 9 };
    }).filter((l) => l.lift >= 1.25 && l.share - l.rest >= 0.05).sort((a, b) => b.lift - a.lift || b.share - a.share)[0];
    // the same month in your other years (for a single year)
    const other = Y ? allYears.filter((y) => y !== Y).map((y) => ymOf(y, i)).filter(live) : [];
    const otherE = other.flatMap((k) => byMonth.get(k) || []);
    return { i, name, E: es, years: ms.length, perYear: ms.length ? es.length / ms.length : 0, avg: avg(ratings), rated: ratings.length, films,
      lean: lean || null, leanFilms: lean ? films.filter((f) => { const m = metaOf(f); return m && m.g.includes(lean.x); }) : [],
      usual: other.length ? otherE.length / other.length : null, usualE: otherE, usualYears: other.length };
  });
  return { Y, rows, cal, max: Math.max(1, ...rows.flatMap((r) => r.months.map((m) => m.E.length))), entries: E.length };
}
const monthEnts = (title, es, extra) => es.length ? D.entries(title, entriesSub(es, extra), es, { order: "asc" }) : null;
// The grid: a row a year, a column a month, each square the films watched then, darker for more; under it a typical
// year (or, for one year, your usual for each month in your other years).
function monthGridHtml(G) {
  const alpha = (n) => (0.16 + 0.84 * n / G.max).toFixed(2), fix = (v) => v.toFixed(v < 10 ? 1 : 0);
  const cell = (m) => !m.live ? `<td class="mg-off"></td>` : m.E.length
    ? `<td><button class="mg-c" type="button" ${dl(DR.month(m.E, m.key))} style="--a:${alpha(m.E.length)}" title="${monthName(m.key)}: ${plural(m.E.length, "film")}">${m.E.length}</button></td>`
    : `<td><span class="mg-0" title="${monthName(m.key)}: none">·</span></td>`;
  const foot = G.Y ? ["Usual", (c) => c.usual != null ? dlink(monthEnts(`${c.name} in your other years`, c.usualE, plural(c.usualYears, "year")), fix(c.usual)) : "—"]
    : ["A year", (c) => c.years ? dlink(monthEnts(`${c.name}, every year`, c.E, plural(c.years, "year")), fix(c.perYear)) : "—"];
  return `<div class="scroll"><table class="mgrid"><thead><tr><th></th>${MONTHS.map((m) => `<th>${m[0]}<span>${m.slice(1)}</span></th>`).join("")}<th class="n">All</th></tr></thead>
    <tbody>${[...G.rows].reverse().map((r) => `<tr><th>${r.year}</th>${r.months.map(cell).join("")}<td class="n">${dlink(monthEnts(`Diary of ${r.year}`, r.E), fmtN(r.E.length))}</td></tr>`).join("")}</tbody>
    <tfoot><tr><th>${foot[0]}</th>${G.cal.map((c) => `<td>${foot[1](c)}</td>`).join("")}<td></td></tr></tfoot></table></div>`;
}
// "Westerns 19% (10% the rest)": a month's lean, as a link to its films.
const leanHtml = (c, title) => c.lean ? `${dlink(D.films(`${c.lean.x}, ${title}`, filmsSub(c.leanFilms), c.leanFilms), esc(c.lean.x))} <span class="muted">${pc(c.lean.share)}% · ${pc(c.lean.rest)}% otherwise</span>` : "—";
// The line that sums it up: the fullest and emptiest months across the years, or the month of a year furthest from usual.
function monthsLine(G) {
  if (!G) return "";
  const live = G.cal.filter((c) => c.years && c.E.length), fix = (v) => v.toFixed(1);
  if (!G.Y) {
    const by = [...live].sort((a, b) => b.perYear - a.perYear), hi = by[0], lo = by[by.length - 1];
    return hi && lo && hi !== lo ? `${dlink(monthEnts(`${hi.name}, every year`, hi.E), hi.name)} is your fullest month, ${fix(hi.perYear)} films a year; ${dlink(monthEnts(`${lo.name}, every year`, lo.E), lo.name)} your emptiest, ${fix(lo.perYear)}.` : "";
  }
  const vs = live.filter((c) => c.usual != null).sort((a, b) => (b.E.length - b.usual) - (a.E.length - a.usual))[0];
  return vs && vs.E.length > vs.usual ? `${dlink(monthEnts(`${vs.name} ${G.Y}`, vs.E), `${vs.name} ${esc(G.Y)}`)} ran furthest ahead of your usual: ${plural(vs.E.length, "film")}, against ${fix(vs.usual)} in a typical ${vs.name}.`
    : `Each month of ${esc(G.Y)}, against your usual for it.`;
}
</script>
