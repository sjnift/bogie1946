<script>
/* ---------- Compare: other members' exports next to yours ----------
   Friends' exports are read the same way as yours and kept in this browser only. Their films share
   the cast & crew cache with yours, keyed by title and year, so a film is looked up once for everyone. */
let FRIENDS = [];         // [{ id, name, rows, lib }]
let EXAMPLE_FRIENDS = []; // made-up members shown with the example diary
let friendsSaveFailed = false;

function loadFriends() {
  FRIENDS = store.get(KEYS.friends, []).map((f) => ({ ...f, lib: buildLibrary(f.rows) }));
}
function saveFriends() {
  friendsSaveFailed = !store.set(KEYS.friends, FRIENDS.map(({ id, name, rows }) => ({ id, name, rows })));
}
async function addFriend(files) {
  const rows = await readExport(files);
  const lib = buildLibrary(rows);
  const name = lib.profile.username || `Friend ${FRIENDS.length + 1}`;
  const existing = FRIENDS.find((f) => f.name === name);
  if (existing) Object.assign(existing, { rows, lib }); // a newer export of the same member replaces the old one
  else FRIENDS.push({ id: "f" + Date.now().toString(36), name, rows, lib });
  saveFriends();
  return existing ? existing.id : FRIENDS[FRIENDS.length - 1].id;
}
function removeFriend(id) { FRIENDS = FRIENDS.filter((f) => f.id !== id); saveFriends(); }
// Everyone in the comparison: you first, then friends (example ones with the example diary).
function comparePeople() {
  const ex = state.mode === "example";
  const me = { id: "me", name: "You", me: true, lib: state.lib };
  return [me, ...(ex ? EXAMPLE_FRIENDS : FRIENDS)];
}
// Every film anyone has logged, for looking up cast & crew once for all of them.
function allFilmsLib() {
  const seen = new Map();
  for (const lib of [MY_LIB, ...FRIENDS.map((f) => f.lib)]) if (lib) for (const f of lib.films) if (!seen.has(f.key)) seen.set(f.key, f);
  // your watchlist too, for Watch next
  if (MY_LIB) for (const w of MY_LIB.watchlistFilms) if (!seen.has(w.key)) seen.set(w.key, w);
  return { films: [...seen.values()], profile: (MY_LIB || {}).profile || {} };
}

/* ----- one person's taste in numbers ----- */
function tasteProfile(p, metaOf) {
  const lib = p.lib, films = lib.films, rated = films.filter((f) => f.rating), E = lib.entries;
  const genres = new Map(), directors = new Map(), actors = new Map();
  let withMeta = 0, langKnown = 0, nonEng = 0;
  for (const f of films) {
    const m = metaOf(f); if (!m) continue;
    withMeta++;
    m.g.forEach((g) => bump(genres, g)); m.d.forEach((d) => bump(directors, d)); m.c.slice(0, CAST_DEPTH).forEach((c) => bump(actors, c));
    if (m.l) { langKnown++; if (m.l !== "English") nonEng++; }
  }
  const spread = Array(10).fill(0);
  for (const f of rated) spread[Math.round(f.rating * 2) - 1]++;
  const span = E.length > 1 ? (dayIndex(E[E.length - 1].date) - dayIndex(E[0].date) + 1) / 365.25 : 0;
  const dated = films.filter((f) => f.year);
  return {
    ...p, films, rated, byKey: new Map(films.map((f) => [f.key, f])),
    avg: avg(rated.map((f) => f.rating)), spread: spread.map((n) => rated.length ? n / rated.length * 100 : 0),
    genres, directors, actors, withMeta,
    nonEnglish: langKnown >= 5 ? Math.round(nonEng / langKnown * 100) : null,
    avgYear: dated.length ? Math.round(avg(dated.map((f) => f.year))) : null,
    perYear: span >= 0.5 ? Math.round(E.length / span) : null,
    weekend: E.length >= 10 ? pctOf(E.filter((e) => weekdayOf(e.date) >= 5).length, E.length) : null,
    rewatch: E.length >= 10 ? pctOf(E.filter((e) => e.rewatch).length, E.length) : null,
    watchlist: new Map(lib.watchlistFilms.map((w) => [w.key, w])),
  };
}
const genreShare = (P, g) => P.withMeta ? (P.genres.get(g) || 0) / P.withMeta * 100 : 0;
// 0–100: mostly how close your ratings are on films you've both rated, partly whether you rank them alike.
function matchScore(pairs) {
  if (pairs.length < 5) return { score: null, n: pairs.length };
  const mad = avg(pairs.map((x) => Math.abs(x.a - x.b)));
  const r = pearson(pairs.map((x) => x.a), pairs.map((x) => x.b));
  const score = Math.round(100 * Math.max(0, Math.min(1, 0.6 * (1 - mad / 2) + 0.4 * (((r ?? 0) + 1) / 2))));
  return { score, mad, r, n: pairs.length, within: pctOf(pairs.filter((x) => Math.abs(x.a - x.b) <= 0.5).length, pairs.length) };
}
const matchWords = (s) => s >= 80 ? "Film twins" : s >= 65 ? "Strong match" : s >= 50 ? "Some common ground" : s >= 35 ? "Different tastes" : "Opposites";

/* ----- what a click in Compare opens ----- */
// A film card with what each person logged for it.
const cardFor = (people) => (f) => D.film(f, { lib: people[0].lib, people: people.map((P) => ({ name: P.me ? "You" : P.name, lib: P.lib, film: P.byKey.get(f.key),
  missing: P.watchlist.has(f.key) ? "On the watchlist, not seen yet." : "Not logged." })) });
const whose = (P) => P.me ? "Your" : `${P.name}'s`;
// One person's films (or diary entries), each opening with everyone's records.
const filmsOf = (P, title, films, people, o) => D.films(title, filmsSub(films), films, { lib: P.lib, cardOf: cardFor(people), ...o });
const entriesOf = (P, title, es, o) => D.entries(title, entriesSub(es), es, { lib: P.lib, who: P.me ? null : P.name, ...o });
// Films two people have both rated, with both ratings, closest first or furthest first.
function ratedByBoth(P, Q, title, order = "close") {
  const rows = P.films.map((f) => ({ f, a: f.rating, b: (Q.byKey.get(f.key) || {}).rating })).filter((x) => x.a && x.b)
    .sort((x, y) => order === "close" ? Math.abs(x.a - x.b) - Math.abs(y.a - y.b) || y.a - x.a : Math.abs(y.a - y.b) - Math.abs(x.a - x.b));
  const by = new Map(rows.map((x) => [x.f, x]));
  return D.films(title, `${plural(rows.length, "film")} rated by both, ${order === "close" ? "closest" : "furthest apart"} first`, rows.map((x) => x.f), { sort: "given", lib: P.lib, cardOf: cardFor([P, Q]),
    note: (f) => { const x = by.get(f); return `${P.me ? "You" : P.name} ${stars(x.a)} · ${Q.name} ${stars(x.b)}`; } });
}
const pairOf = (title, sub, a, b) => D.groups(title, sub, [a, b]);

/* ----- you and one other person ----- */
function comparePair(A, B, metaOf) {
  const shared = A.films.filter((f) => B.byKey.has(f.key));
  const union = A.films.length + B.films.length - shared.length;
  const pairs = shared.map((f) => ({ f, a: f.rating, b: B.byKey.get(f.key).rating })).filter((x) => x.a && x.b);
  const match = matchScore(pairs);
  const by = (fn) => (x, y) => fn(y) - fn(x);
  const popularity = (f) => { const x = LBX[f.key], m = metaOf(f); return (x && x.n) || (m && (m.iv || m.vc)) || 0; };
  const recs = (from, to) => from.films.filter((f) => f.rating >= 4 && !to.byKey.has(f.key))
    .sort((x, y) => y.rating - x.rating || popularity(y) - popularity(x)).slice(0, 12)
    .map((f) => ({ f, onWatchlist: to.watchlist.has(f.key) }));
  const topGenres = [...new Set([...A.genres.keys(), ...B.genres.keys()])]
    .map((g) => ({ g, a: genreShare(A, g), b: genreShare(B, g) })).sort((x, y) => (y.a + y.b) - (x.a + x.b)).slice(0, 10);
  const both = [A, B], card = cardFor(both);
  // each side of a comparison: your films that pass a test, then theirs
  const sides = (title, sub, test, o) => pairOf(title, sub, ...both.map((P) => { const fs = P.films.filter(test); return filmsOf(P, P.me ? "You" : B.name, fs, both, o); }));
  const to = {
    shared: D.films("Seen by both", `${plural(shared.length, "film")} you've both logged`, shared, { lib: A.lib, cardOf: card, note: (f) => `You ${stars(f.rating) || "–"} · ${B.name} ${stars(B.byKey.get(f.key).rating) || "–"}` }),
    onlyA: filmsOf(A, "Only you", A.films.filter((f) => !B.byKey.has(f.key)), both),
    onlyB: filmsOf(B, `Only ${B.name}`, B.films.filter((f) => !A.byKey.has(f.key)), both),
    rated: ratedByBoth(A, B, "Films you've both rated"),
    apart: ratedByBoth(A, B, "Where you disagree", "far"),
    ratings: sides("Ratings", "Each person's rated films", (f) => f.rating),
    genre: (g) => sides(g, "Each person's films in the genre", hasGenre(g)),
    age: sides("Release years", "Each person's films, oldest first", (f) => !!f.year, { sort: "old", note: (f) => `Released ${f.year}` }),
    nonEnglish: sides("Not in English", "Each person's films not in English", notEnglish, { note: langNote }),
    stars: (r) => sides(`Rated ${stars(r)}`, "Films each of you gave this rating", (f) => f.rating === r),
    person: (name, role) => pairOf(name, "Each person's films with them", ...both.map((P) => ({ ...personDrill(P.lib, name, role), title: P.me ? "You" : B.name, cardOf: card }))),
    personOf: (P, name, role) => ({ ...personDrill(P.lib, name, role), title: name, sub: `${whose(P)} films`, cardOf: card }),
    diary: (P) => entriesOf(P, `${whose(P)} diary`, P.lib.entries),
    weekend: (P) => entriesOf(P, `${whose(P)} weekends`, P.lib.entries.filter((e) => weekdayOf(e.date) >= 5)),
    rewatches: (P) => entriesOf(P, `${whose(P)} rewatches`, P.lib.entries.filter((e) => e.rewatch)),
    films: (P, title, test = () => true, o) => filmsOf(P, title || `${whose(P)} films`, P.films.filter(test), both, o),
    card,
  };
  const lines = [];
  if (shared.length) lines.push({ to: to.shared, text: `You've both seen ${plural(shared.length, "film")}: ${pctOf(shared.length, A.films.length)}% of yours and ${pctOf(shared.length, B.films.length)}% of ${B.name}'s.` });
  if (match.score != null) lines.push({ to: to.rated, text: `On the ${plural(match.n, "film")} you've both rated, your ratings are within half a star ${match.within}% of the time, and ${match.mad.toFixed(1)}★ apart on average.` });
  if (A.avg && B.avg && Math.abs(A.avg - B.avg) >= 0.15) lines.push({ to: to.ratings, text: `${A.avg > B.avg ? "You rate" : `${B.name} rates`} ${Math.abs(A.avg - B.avg).toFixed(1)}★ higher on average (${starsNum(Math.max(A.avg, B.avg))} against ${starsNum(Math.min(A.avg, B.avg))}).` });
  for (const x of topGenres.filter((x) => Math.abs(x.a - x.b) >= 6).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b)).slice(0, 3))
    lines.push({ to: to.genre(x.g), text: `${x.g} is ${Math.round(x.b)}% of ${B.name}'s films and ${Math.round(x.a)}% of yours.` });
  if (A.avgYear && B.avgYear && Math.abs(A.avgYear - B.avgYear) >= 5) lines.push({ to: to.age, text: `${A.avgYear < B.avgYear ? "You watch" : `${B.name} watches`} older films: an average release year of ${Math.min(A.avgYear, B.avgYear)} against ${Math.max(A.avgYear, B.avgYear)}.` });
  if (A.nonEnglish != null && B.nonEnglish != null && Math.abs(A.nonEnglish - B.nonEnglish) >= 10) lines.push({ to: to.nonEnglish, text: `Films not in English are ${B.nonEnglish}% of ${B.name}'s and ${A.nonEnglish}% of yours.` });
  if (A.perYear && B.perYear && Math.abs(A.perYear - B.perYear) / Math.min(A.perYear, B.perYear) >= 0.3)
    lines.push({ to: pairOf("Diary entries", "Each person's diary", to.diary(A), to.diary(B)), text: `${B.name} logs about ${fmtN(B.perYear)} films a year to your ${fmtN(A.perYear)}.` });
  const people = (mapA, mapB) => ({
    shared: [...mapA].filter(([n]) => mapB.has(n)).map(([n, a]) => ({ name: n, a, b: mapB.get(n) })).sort((x, y) => Math.min(y.a, y.b) - Math.min(x.a, x.b) || (y.a + y.b) - (x.a + x.b)).slice(0, 8),
    onlyA: [...mapA].filter(([n, c]) => c >= 2 && !mapB.has(n)).sort((x, y) => y[1] - x[1]).slice(0, 6),
    onlyB: [...mapB].filter(([n, c]) => c >= 2 && !mapA.has(n)).sort((x, y) => y[1] - x[1]).slice(0, 6),
  });
  return {
    A, B, shared, union, pairs, match, lines, topGenres, to,
    overlap: { onlyA: A.films.length - shared.length, both: shared.length, onlyB: B.films.length - shared.length, jaccard: union ? shared.length / union : 0 },
    bothLoved: pairs.filter((x) => x.a >= 4.5 && x.b >= 4.5).sort(by((x) => x.a + x.b)).slice(0, 12),
    aHigher: pairs.filter((x) => x.a - x.b >= 1.5).sort(by((x) => x.a - x.b)).slice(0, 12),
    bHigher: pairs.filter((x) => x.b - x.a >= 1.5).sort(by((x) => x.b - x.a)).slice(0, 12),
    forA: recs(B, A), forB: recs(A, B),
    together: [...A.watchlist.values()].filter((w) => B.watchlist.has(w.key)),
    directors: people(A.directors, B.directors), actors: people(A.actors, B.actors),
  };
}

// The habits table in a pair comparison: label, then your cell and theirs, each opening what it counts.
function habitRows(C) {
  const { A, B, to } = C;
  const pct = (v) => v != null ? v + "%" : null;
  const row = (k, val, mk) => [k, ...[A, B].map((P) => { const v = val(P); return v == null ? "—" : dlink(mk(P), v); })];
  return [
    row("Films logged", (P) => fmtN(P.films.length), (P) => to.films(P)),
    row("Diary entries a year", (P) => P.perYear && fmtN(P.perYear), (P) => to.diary(P)),
    row("Average rating", (P) => P.avg && P.avg.toFixed(2), (P) => to.films(P, `${whose(P)} ratings`, (f) => f.rating)),
    row("Average release year", (P) => P.avgYear, (P) => to.films(P, `${whose(P)} films by release year`, (f) => !!f.year, { sort: "old", note: (f) => `Released ${f.year}` })),
    row("Not in English", (P) => pct(P.nonEnglish), (P) => to.films(P, `${whose(P)} films not in English`, notEnglish, { note: langNote })),
    row("On weekends", (P) => pct(P.weekend), (P) => to.weekend(P)),
    row("Rewatches", (P) => pct(P.rewatch), (P) => to.rewatches(P)),
  ];
}

/* ----- everyone at once ----- */
function compareGroup(profiles) {
  const n = profiles.length;
  const matrix = profiles.map((P) => profiles.map((Q) => {
    if (P === Q) return null;
    const pairs = P.films.map((f) => ({ a: f.rating, b: (Q.byKey.get(f.key) || {}).rating })).filter((x) => x.a && x.b);
    return matchScore(pairs);
  }));
  const ratings = new Map(); // film key → { f, by: [{ name, r }] }
  for (const P of profiles) for (const f of P.rated) {
    let x = ratings.get(f.key); if (!x) { x = { f, by: [] }; ratings.set(f.key, x); }
    x.by.push({ name: P.name, r: f.rating });
  }
  const sd = (xs) => { const m = avg(xs); return Math.sqrt(avg(xs.map((x) => (x - m) ** 2))); };
  const multi = [...ratings.values()].filter((x) => x.by.length >= Math.min(3, n)).map((x) => ({ ...x, mean: avg(x.by.map((b) => b.r)), sd: sd(x.by.map((b) => b.r)) }));
  const seenBy = new Map();
  for (const P of profiles) for (const f of P.films) seenBy.set(f.key, (seenBy.get(f.key) || 0) + 1);
  const wanted = new Map();
  for (const P of profiles) for (const w of P.watchlist.values()) { const x = wanted.get(w.key) || { w, by: [] }; x.by.push(P.name); wanted.set(w.key, x); }
  // a movie-night pick: on several watchlists, or loved by someone and unseen by most of the group
  const picks = [...wanted.values()].filter((x) => x.by.length >= 2).sort((a, b) => b.by.length - a.by.length).map((x) => ({ name: x.w.name, year: x.w.year, why: `On ${x.by.length} watchlists: ${x.by.join(", ")}` }));
  for (const x of [...ratings.values()].filter((x) => x.by.some((b) => b.r >= 4.5) && (seenBy.get(x.f.key) || 0) <= n / 2).sort((a, b) => Math.max(...b.by.map((q) => q.r)) - Math.max(...a.by.map((q) => q.r))).slice(0, 8)) {
    const fans = x.by.filter((b) => b.r >= 4.5).map((b) => b.name);
    if (!picks.some((p) => p.name === x.f.name && p.year === x.f.year)) picks.push({ name: x.f.name, year: x.f.year, f: x.f, why: `${fans.join(" and ")} gave it ${stars(Math.max(...x.by.map((b) => b.r)))}; ${n - (seenBy.get(x.f.key) || 0)} of ${n} haven't seen it` });
  }
  const allSeen = profiles[0].films.filter((f) => seenBy.get(f.key) === n);
  return {
    card: cardFor(profiles), pairTo: (i, j) => ratedByBoth(profiles[i], profiles[j], `${profiles[i].me ? "You" : profiles[i].name} and ${profiles[j].name}`),
    everyoneTo: D.films("Seen by everyone", plural(allSeen.length, "film"), allSeen, { lib: profiles[0].lib, cardOf: cardFor(profiles) }),
    matrix, everyone: allSeen.length,
    divisive: multi.filter((x) => x.sd >= 0.75).sort((a, b) => b.sd - a.sd).slice(0, 8),
    loved: multi.filter((x) => x.mean >= 4.25 && x.sd <= 0.5).sort((a, b) => b.mean - a.mean).slice(0, 8),
    picks: picks.slice(0, 8),
  };
}
</script>
