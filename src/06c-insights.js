<script>
/* ---------- insights: patterns across the whole diary, shared by both layouts ----------
   Year trends come from diary dates. Crowd comparisons need a crowd score per film:
   TMDB users (from the TMDB lookup), IMDb users and critics (from OMDb). */
const CROWDS = {
  imdb: { label: "IMDb users", short: "IMDb", score: (m) => m && m.ir && (m.iv || 0) >= 100 ? m.ir : null, votes: (m) => m.iv },
  tmdb: { label: "TMDB users", short: "TMDB", score: (m) => m && m.va && (m.vc || 0) >= 25 ? m.va : null, votes: (m) => m.vc },
  critics: { label: "Critics (Metacritic)", short: "Critics", score: (m) => m && m.mc ? m.mc / 10 : null, votes: () => null },
};
const pctOf = (n, d) => d ? Math.round(n / d * 100) : 0;
const starsNum = (x) => `${x.toFixed(1)}★`;
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

// "…, and your taste follows theirs closely (correlation 0.71)", or nothing when it can't be measured.
const followText = (r) => r == null ? "" : `, and your taste follows theirs ${r >= 0.6 ? "closely" : r >= 0.35 ? "loosely" : "hardly at all"} (correlation ${r.toFixed(2)})`;

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
    const genres = new Map(), directors = new Map(), actors = new Map(), countries = new Set();
    let withMeta = 0;
    for (const f of films) {
      const m = metaOf(f); if (!m) continue; withMeta++;
      m.g.forEach((g) => bump(genres, g)); m.d.forEach((d) => bump(directors, d));
      m.c.slice(0, CAST_DEPTH).forEach((c) => bump(actors, c)); m.k.forEach((k) => countries.add(k));
    }
    const pace = y === thisYear && dayOfYear > 30 && dayOfYear < 360 ? Math.round(films.length / dayOfYear * 365) : null;
    return {
      year: y, films: films.length, entries: es.length, rewatches: es.filter((e) => e.rewatch).length, hours: minutes / 60, pace,
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
    const risers = moves.filter((x) => x.d >= 5).sort((a, b) => b.d - a.d).slice(0, 2);
    const fallers = moves.filter((x) => x.d <= -5).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const x of risers) tastes.lines.push({ dir: "up", big: x.g, text: `${x.g} grew from ${Math.round(x.from)}% of your films in ${E0} to ${Math.round(x.to)}% in ${L0}.` });
    for (const x of fallers) tastes.lines.push({ dir: "down", big: `Less ${x.g}`, text: `${x.g} fell from ${Math.round(x.from)}% of your films in ${E0} to ${Math.round(x.to)}% in ${L0}.` });
    const a0 = mean(early, "age"), a1 = mean(late, "age");
    if (a0 != null && a1 != null && Math.abs(a1 - a0) >= 3) tastes.lines.push({ dir: a1 > a0 ? "up" : "down", big: a1 > a0 ? "Older films" : "Newer films",
      text: a1 > a0 ? `You're watching older films: on average ${Math.round(a1)} years old when you saw them in ${L0}, against ${Math.round(a0)} in ${E0}.`
        : `You're watching newer films: on average ${Math.round(a1)} years old when you saw them in ${L0}, against ${Math.round(a0)} in ${E0}.` });
    const n0 = mean(early, "nonEnglish"), n1 = mean(late, "nonEnglish");
    if (n0 != null && n1 != null && Math.abs(n1 - n0) >= 10) tastes.lines.push({ dir: n1 > n0 ? "up" : "down", big: n1 > n0 ? "World cinema" : "More English",
      text: `Films not in English went from ${Math.round(n0)}% of your watching in ${E0} to ${Math.round(n1)}% in ${L0}.` });
    const r0 = mean(early, "avgRating"), r1 = mean(late, "avgRating");
    if (r0 != null && r1 != null && Math.abs(r1 - r0) >= 0.2) tastes.lines.push({ dir: r1 > r0 ? "up" : "down", big: r1 > r0 ? "Kinder" : "Tougher",
      text: r1 > r0 ? `You've grown more generous: your average rating rose from ${starsNum(r0)} in ${E0} to ${starsNum(r1)} in ${L0}.`
        : `You've grown tougher: your average rating fell from ${starsNum(r0)} in ${E0} to ${starsNum(r1)} in ${L0}.` });
    const w0 = mean(early, "films"), w1 = mean(late, "films");
    if (w0 && w1 && Math.abs(w1 - w0) / w0 >= 0.25) tastes.lines.push({ dir: w1 > w0 ? "up" : "down", big: w1 > w0 ? "More films" : "Fewer films",
      text: `You watch ${w1 > w0 ? "more" : "fewer"} films than you used to: about ${Math.round(w1)} a year in ${L0}, against ${Math.round(w0)} in ${E0}.` });
    tastes.table = { genres: top, years: usable.map((p) => ({ year: p.year, shares: top.map((g) => p.withMeta ? Math.round((p.genres.get(g) || 0) / p.withMeta * 100) : null) })) };
  }

  /* ----- genres: what you watch, how you rate it, and how the crowd does ----- */
  const crowd = CROWDS[crowdKey] || CROWDS.tmdb;
  const gmap = new Map();
  for (const f of lib.films) {
    const m = metaOf(f); if (!m) continue;
    for (const g of m.g) {
      let x = gmap.get(g); if (!x) { x = { name: g, films: [], mine: [], vsCrowd: [] }; gmap.set(g, x); }
      x.films.push(f);
      if (f.rating) { x.mine.push(f.rating); const c = crowd.score(m); if (c) x.vsCrowd.push(f.rating - c / 2); }
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
  if (loved && loved.vsMe >= 0.15) genreLines.push(`You rate ${loved.name} ${loved.vsMe.toFixed(1)}★ above your average, more than any other genre.`);
  const lukewarm = solid.slice(0, 5).filter((g) => g.vsMe <= -0.15).sort((a, b) => a.vsMe - b.vsMe)[0];
  if (lukewarm) genreLines.push(`${lukewarm.name} is among the genres you watch most (${lukewarm.share}% of your films), but you rate it ${Math.abs(lukewarm.vsMe).toFixed(1)}★ below your average.`);
  const withCrowd = genres.filter((g) => g.vsCrowd != null);
  const above = [...withCrowd].sort((a, b) => b.vsCrowd - a.vsCrowd)[0], below = [...withCrowd].sort((a, b) => a.vsCrowd - b.vsCrowd)[0];
  if (above && above.vsCrowd >= 0.2) genreLines.push(`Next to ${crowd.label}, you're kindest to ${above.name}: ${above.vsCrowd.toFixed(1)}★ above them on average.`);
  if (below && below !== above && below.vsCrowd <= -0.2) genreLines.push(`You're harshest on ${below.name}: ${Math.abs(below.vsCrowd).toFixed(1)}★ below ${crowd.label} on average.`);

  /* ----- people: obsessions, companions, binges, discoveries ----- */
  const peopleFrom = (role) => {
    const map = new Map();
    for (const e of E) {
      const m = metaOf(e.film); if (!m) continue;
      const names = role === "c" ? m.c.slice(0, CAST_DEPTH) : m[role];
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
    return best ? { ...p, binge: best } : null;
  }).filter(Boolean).sort((a, b) => b.binge.n - a.binge.n || (b.binge.to > a.binge.to ? 1 : -1)).slice(0, 5);
  const firstYear = new Map();
  for (const p of directors) { const y = [...p.firstSeen.values()].sort()[0].slice(0, 4); bump(firstYear, y); }
  const discoveries = years.slice(1).map((y) => ({ year: y, count: firstYear.get(y) || 0 }));

  /* ----- against the crowd ----- */
  const pairs = rated.map((f) => { const m = metaOf(f), c = crowd.score(m); return c ? { f, you: f.rating, crowd: c / 2, diff: f.rating - c / 2, votes: crowd.votes(m) } : null; }).filter(Boolean);
  const crowdOut = { key: crowdKey, label: crowd.label, short: crowd.short, n: pairs.length, available: {} };
  for (const k of Object.keys(CROWDS)) crowdOut.available[k] = rated.filter((f) => CROWDS[k].score(metaOf(f))).length;
  if (pairs.length >= 5) {
    crowdOut.r = pearson(pairs.map((p) => p.you), pairs.map((p) => p.crowd));
    crowdOut.meanDiff = avg(pairs.map((p) => p.diff));
    crowdOut.higher = pairs.filter((p) => p.diff >= 0.75).sort((a, b) => b.diff - a.diff || b.you - a.you).slice(0, 12);
    crowdOut.lower = pairs.filter((p) => p.diff <= -0.75).sort((a, b) => a.diff - b.diff || a.you - b.you).slice(0, 12);
  }
  const popularity = (f) => { const m = metaOf(f); return m ? (m.iv ? { n: m.iv, src: "IMDb" } : m.vc ? { n: m.vc, src: "TMDB" } : null) : null; };
  crowdOut.gems = rated.filter((f) => f.rating >= 4.5).map((f) => ({ f, pop: popularity(f) }))
    .filter((x) => x.pop && (x.pop.src === "IMDb" ? x.pop.n < 25000 : x.pop.n < 1000))
    .sort((a, b) => b.f.rating - a.f.rating || a.pop.n - b.pop.n).slice(0, 12);

  /* ----- habits ----- */
  const habits = [];
  if (E.length) {
    const weekend = E.filter((e) => weekdayOf(e.date) >= 5).length;
    const wk = pctOf(weekend, E.length);
    habits.push({ k: wk >= 36 ? "Weekend watcher" : wk <= 22 ? "Weeknight watcher" : "Weekends", v: `${wk}%`, notable: wk >= 36 || wk <= 22,
      text: `of your diary falls on a Saturday or Sunday, against 29% if you watched evenly through the week.` });
    const months = Array(12).fill(0), seen = Array(12).fill(0);
    for (const e of E) months[+e.date.slice(5, 7) - 1]++;
    const first = E[0].date, last = E[E.length - 1].date;
    for (let y = +first.slice(0, 4); y <= +last.slice(0, 4); y++) for (let m = 0; m < 12; m++) {
      const k = `${y}-${String(m + 1).padStart(2, "0")}`;
      if (k >= first.slice(0, 7) && k <= last.slice(0, 7)) seen[m]++;
    }
    const rates = months.map((n, i) => seen[i] ? n / seen[i] : 0), mean = avg(rates.filter((_, i) => seen[i]));
    const best = rates.indexOf(Math.max(...rates));
    if (mean && rates[best] / mean >= 1.15) habits.push({ k: "Film month", v: MONTHS_LONG[best], notable: rates[best] / mean >= 1.3, text: `is when you watch most: ${Math.round((rates[best] / mean - 1) * 100)}% more films than an average month.` });
    const loggedKnown = E.filter((e) => e.logged);
    if (loggedKnown.length >= 10) habits.push({ k: "Same-day logging", v: `${pctOf(loggedKnown.filter((e) => e.logged === e.date).length, loggedKnown.length)}%`, text: "of films are logged on the day you watch them." });
    const perDay = new Map(); for (const e of E) bump(perDay, e.date);
    const bingeDays = [...perDay.values()].filter((n) => n >= 3).length;
    if (bingeDays) habits.push({ k: "Marathon days", v: fmtN(bingeDays), text: `${bingeDays === 1 ? "day" : "days"} with three or more films.` });
    const catches = E.filter((e) => !e.rewatch && e.film.year && +e.date.slice(0, 4) <= e.film.year + 0).length;
    habits.push({ k: "Same-year catches", v: fmtN(catches), text: `${catches === 1 ? "film" : "films"} seen in the year ${catches === 1 ? "it" : "they"} came out.` });
    const rw = pctOf(E.filter((e) => e.rewatch).length, E.length);
    habits.push({ k: "Rewatches", v: `${rw}%`, text: "of your diary entries are rewatches." });
    const runtimes = lib.films.map(metaOf).filter((m) => m && m.r).map((m) => m.r);
    if (runtimes.length >= 10) habits.push({ k: "Typical length", v: `${Math.round(avg(runtimes))} min`, text: `is your average film; ${pctOf(runtimes.filter((r) => r >= 150).length, runtimes.length)}% run 2½ hours or more.` });
  }

  /* ----- at a glance: the strongest few findings ----- */
  const glance = [];
  if (busiest) {
    const cur = perYear.find((p) => p.year === thisYear);
    glance.push({ k: "Busiest year", big: busiest.year, text: `${plural(busiest.films, "film")} that year${cur && cur.pace && cur !== busiest ? `. ${thisYear} is on pace for about ${fmtN(cur.pace)}.` : "."}` });
  }
  if (overallAvg) {
    const high = pctOf(rated.filter((f) => f.rating >= 4).length, rated.length);
    const style = overallAvg >= 3.75 ? "a generous rater" : overallAvg <= 3 ? "a tough rater" : "a middle-of-the-road rater";
    glance.push({ k: "Rating style", big: starsNum(overallAvg), text: `average makes you ${style}: ${high}% of your rated films get 4★ or more.` });
  }
  if (crowdOut.meanDiff != null) glance.push({ k: `You vs ${crowd.label}`, big: `${signed(crowdOut.meanDiff)}★`, text: `on average against ${crowd.label}${followText(crowdOut.r)}, across ${plural(pairs.length, "film")}.` });
  if (tastes.lines.length) glance.push({ k: "Changing taste", big: tastes.lines[0].big, text: tastes.lines[0].text });
  if (loved && loved.vsMe >= 0.15) glance.push({ k: "Best-loved genre", big: loved.name, text: `gets ${loved.vsMe.toFixed(1)}★ more from you than your average film.` });
  const obsD = obsessions(directors);
  if (obsD.length) glance.push({ k: `New in ${latest}`, big: obsD[0].name, text: `${obsD[0].inLatest} films in ${latest}, none before. Your newest director obsession.` });
  else { const comp = companions(directors)[0]; if (comp) glance.push({ k: "Constant companion", big: comp.name, text: `turns up in your diary in ${comp.years.size} different years.` }); }
  const habit = habits.find((h) => h.notable);
  if (habit) glance.push({ k: habit.k, big: habit.v, text: habit.text });

  return {
    years: perYear, usable, latest, tastes, genres, genreLines, overallAvg,
    people: { obsDirectors: obsD, obsActors: obsessions(actors), compDirectors: companions(directors), compActors: companions(actors), binges, discoveries },
    crowd: crowdOut, habits, glance,
  };
}
// The crowd score to compare with: IMDb when most rated films have it, else TMDB.
function defaultCrowd(lib, metaOf) {
  const rated = lib.films.filter((f) => f.rating);
  const n = (k) => rated.filter((f) => CROWDS[k].score(metaOf(f))).length;
  return n("imdb") >= Math.max(5, n("tmdb") * 0.5) ? "imdb" : "tmdb";
}
</script>
