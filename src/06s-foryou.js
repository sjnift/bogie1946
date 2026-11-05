<script>
/* ---------- For you: a hundred films you'd love that aren't in your diary ----------
   Asked 5 Nov 2026: "write an algorithm to predict movies I would like based on my letterboxd ratings, director actor
   genre data … correlate all the data you have about my viewing habits … to create a list of 100 films I would love".
   1. What love is, for you (`fyLove`): each film's rating against your own average and spread, more when you liked it.
   2. What predicts it, learned from your own diary (`fyModel`): for each kind of thing a film has (directors, writers,
      leading actors, camera and music, genres, genres in their decade, decade, countries, language, studio) how far
      your films with it sit above or below your usual, pulled towards nothing when there are few (shrinkage), each
      film scored with itself left out, so it never predicts itself; then a ridge regression of your love on those
      scores, with TMDB's score, how widely a film is seen, its length and how strongly films you loved point to it on
      TMDB, says how much each counts for you. Tested on your own films five ways (each fifth predicted from the
      other four): `test`.
   3. Films to choose from (`fyGather`): TMDB's recommendations for the films you loved most, the films of the
      directors you rate highest and those your favourite actors lead, and your watchlist; never one in your diary,
      unreleased, short, or too little seen to judge.
   4. The best by a first look are read in full from TMDB, scored as your own films were, put as stars and a chance
      you'd love it (fitted on your diary), and the hundred best kept with at most three by one director and one of a
      series (`fyPick`), each with why. Kept in this browser (`cr-foryou-v1`) and made again after FY_DAYS, or when
      the diary has grown. */
const FY_N = 100;            // films in the list
const FY_SEEDS = 40;         // films you loved whose TMDB recommendations are read
const FY_DIRS = 15, FY_ACTORS = 12; // directors and actors whose films are read
const FY_DETAIL = 260;       // candidates read in full, the best by a first look
const FY_MIN_VOTES = 100;    // TMDB votes a film needs to be judged (a watchlist film, 15)
const FY_PRIOR_VOTES = 300;  // TMDB's score pulled towards 6.6 by this many votes' worth: a new film's 8.1 from 116 votes says little
const FY_DAYS = 7;
const FY_MIN_RATED = 20;     // rated films with details the model needs
const FY_V = 1;
// each kind of thing a film has, and how many films' worth of "your usual" its average is pulled towards
const FY_FAMS = [["d", "Directors", 2], ["w", "Writers", 3], ["c", "Actors", 3], ["x", "Camera and music", 3], ["g", "Genres", 10],
  ["gd", "Genres in their decade", 6], ["dec", "Decades", 8], ["k", "Countries", 6], ["l", "Language", 6], ["s", "Studios", 5]];
const FY_NUMS = [["crowd", "TMDB's score"], ["pop", "How widely seen"], ["len", "Length"], ["rec", "Recommended for films you loved"]];
const FY_GENRES = { 28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Science Fiction", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western" };
// a compilation or a re-edit of films, not a film to see
const FY_NOT_A_FILM = /\btrilogy\b/i;
let FY = null;
const FY_JOB = { running: false, step: "", done: 0, total: 0, err: "", ctl: null };
const fyLang = (code) => { if (!code) return ""; if (code === "cn") return "Cantonese"; try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || ""; } catch { return ""; } };

// 1. How much you loved each film: your rating in your own spread (0 at your average), and a like on top.
function fyLove(lib) {
  const rs = lib.films.filter((f) => f.rating).map((f) => f.rating);
  const mu = avg(rs) || 3, sd = Math.max(0.5, Math.sqrt(avg(rs.map((r) => (r - mu) ** 2)) || 0));
  const s = new Map();
  for (const f of lib.films) {
    if (f.rating) s.set(f, (f.rating - mu) / sd + (f.liked ? 0.6 : 0) + Math.min(2, Math.max(0, f.entries.length - 1)) * 0.2);
    else if (f.liked) s.set(f, 1.2);
  }
  return { mu, sd, s };
}
// What a film has, by kind: [key, name, weight] (leading actors weigh most; several genres share their weight).
function fyFeats(m, year) {
  const out = {}, put = (F, items) => { if (items.length) out[F] = items; };
  const ppl = (names, w) => [...new Set(names)].map((n, i) => [personKey(n), n, w(i)]);
  put("d", ppl(roleNames(m, "d"), () => 1));
  put("w", ppl(roleNames(m, "w").slice(0, 4), () => 1));
  put("c", ppl(roleNames(m, "c").slice(0, 6), (i) => 1 / (1 + 0.4 * i)));
  put("x", ppl([...roleNames(m, "p").slice(0, 1), ...roleNames(m, "m").slice(0, 1)], () => 1));
  const g = [...new Set(m.g || [])], y = year || m.y, dec = y ? Math.floor(y / 10) * 10 : null, gw = 1 / Math.sqrt(g.length || 1);
  put("g", g.map((x) => [x, x, gw]));
  if (dec) { put("dec", [[String(dec), `the ${dec}s`, 1]]); put("gd", g.map((x) => [`${x}|${dec}`, `${x} from the ${dec}s`, gw])); }
  const k = [...new Set(m.k || [])];
  put("k", k.map((x) => [x, x, 1 / Math.sqrt(k.length)]));
  if (m.l) put("l", [[m.l, m.l, 1]]);
  const st = typeof filmStudio === "function" ? filmStudio(m) : "";
  if (st) put("s", [[st, st, 1]]);
  return out;
}
const fyCrowd = (m) => m.va && m.vc ? (m.va * m.vc + 6.6 * FY_PRIOR_VOTES) / (m.vc + FY_PRIOR_VOTES) - 6.6 : 0;
const fyNums = (m, rec) => [fyCrowd(m), Math.log10((m.vc || 0) + 1) - 3, m.r ? Math.max(-2, Math.min(2, (m.r - 110) / 30)) : 0, rec || 0];
// Solves (A + λI) x = b by elimination.
function fySolve(A, b, lambda) {
  const n = b.length, M = A.map((row, i) => [...row.map((v, j) => v + (i === j ? lambda : 0)), b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) continue;
    for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j]; }
  }
  return M.map((row, i) => Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]);
}
// Ridge regression on standardised columns: weights, and each column's mean and spread.
function fyFit(X, y) {
  const n = X.length, p = X[0].length, mean = Array(p).fill(0), sd = Array(p).fill(0), ym = avg(y);
  for (const r of X) r.forEach((v, j) => { mean[j] += v / n; });
  for (const r of X) r.forEach((v, j) => { sd[j] += (v - mean[j]) ** 2 / n; });
  for (let j = 0; j < p; j++) sd[j] = Math.sqrt(sd[j]) || 1;
  const A = Array.from({ length: p }, () => Array(p).fill(0)), b = Array(p).fill(0);
  X.forEach((r, i) => { const z = r.map((v, j) => (v - mean[j]) / sd[j]); for (let a = 0; a < p; a++) { b[a] += z[a] * (y[i] - ym); for (let c = 0; c < p; c++) A[a][c] += z[a] * z[c]; } });
  const w = fySolve(A, b, Math.max(5, n * 0.01));
  return { w, mean, sd, ym, predict: (r) => ym + r.reduce((s, v, j) => s + w[j] * (v - mean[j]) / sd[j], 0) };
}

// 2. Your taste, learned from your diary. `rec` (film → how strongly films you loved point to it) comes from step 3.
function fyModel(lib, rec = new Map()) {
  const L = fyLove(lib), rows = [];
  for (const [f, s] of L.s) { const m = metaOf(f); if (m && !m.miss) rows.push({ f, s, m, feats: fyFeats(m, f.year) }); }
  const A = {}; for (const [F] of FY_FAMS) A[F] = new Map();
  for (const r of rows) for (const F in r.feats) for (const [k, name, w] of r.feats[F]) {
    let a = A[F].get(k); if (!a) A[F].set(k, a = { name, sum: 0, w: 0, n: 0, rs: 0, rn: 0 });
    a.sum += r.s * w; a.w += w; a.n++; if (r.f.rating) { a.rs += r.f.rating; a.rn++; }
  }
  const K = Object.fromEntries(FY_FAMS.map(([F, , k]) => [F, k]));
  // a film's score for a kind: the weighted average of how you take each of its things (leaving out `self`)
  const fam = (F, items, self) => {
    let num = 0, den = 0;
    for (const [k, , w] of items || []) { const a = A[F].get(k); if (!a) continue;
      const sum = a.sum - (self ? self.s * w : 0), ww = a.w - (self ? w : 0); if (ww <= 1e-9) continue;
      num += sum / (ww + K[F]) * w; den += w; }
    return den ? num / den : 0;
  };
  const xOf = (feats, m, recV, self) => [...FY_FAMS.map(([F]) => fam(F, feats[F], self)), ...fyNums(m, recV)];
  const X = rows.map((r) => xOf(r.feats, r.m, rec.get(r.f.key) || 0, r)), y = rows.map((r) => r.s);
  if (rows.length < FY_MIN_RATED) return null;
  const fit = fyFit(X, y);
  // tested on your own films: each fifth predicted by a model fitted on the other four
  const cv = Array(rows.length);
  for (let fold = 0; fold < 5; fold++) {
    const tr = [], ty = []; rows.forEach((r, i) => { if (i % 5 !== fold) { tr.push(X[i]); ty.push(y[i]); } });
    const ff = fyFit(tr, ty); rows.forEach((r, i) => { if (i % 5 === fold) cv[i] = ff.predict(X[i]); });
  }
  // stars from a prediction, and the chance you'd love it (4★ or more, or liked), both fitted on your diary
  const rated = rows.map((r, i) => ({ r, p: cv[i] })).filter((x) => x.r.f.rating);
  const px = rated.map((x) => x.p), py = rated.map((x) => x.r.f.rating), pm = avg(px), qm = avg(py);
  const slope = px.reduce((s, v, i) => s + (v - pm) * (py[i] - qm), 0) / (px.reduce((s, v) => s + (v - pm) ** 2, 0) || 1);
  const stars = (p) => Math.max(0.5, Math.min(5, qm + slope * (p - pm)));
  const loved = (r) => (r.f.rating || 0) >= 4 || r.f.liked;
  let c0 = 0, c1 = 1; // logistic fit by Newton's method
  for (let it = 0; it < 25; it++) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    rows.forEach((r, i) => { const z = c0 + c1 * cv[i], pr = 1 / (1 + Math.exp(-z)), e = (loved(r) ? 1 : 0) - pr, v = pr * (1 - pr);
      g0 += e; g1 += e * cv[i]; h00 += v; h01 += v * cv[i]; h11 += v * cv[i] * cv[i]; });
    const det = h00 * h11 - h01 * h01; if (Math.abs(det) < 1e-12) break;
    c0 += (h11 * g0 - h01 * g1) / det; c1 += (h00 * g1 - h01 * g0) / det;
  }
  const love = (p) => 1 / (1 + Math.exp(-(c0 + c1 * p)));
  const order = rows.map((r, i) => i).sort((a, b) => cv[b] - cv[a]), top = order.slice(0, Math.max(10, Math.round(rows.length / 10)));
  const rOf = (ix) => ix.map((i) => rows[i].f.rating).filter(Boolean), share = (ix) => ix.filter((i) => loved(rows[i])).length / ix.length;
  const corr = (() => { const a = cv, b = y, ma = avg(a), mb = avg(b); let s = 0, sa = 0, sb = 0; a.forEach((v, i) => { s += (v - ma) * (b[i] - mb); sa += (v - ma) ** 2; sb += (b[i] - mb) ** 2; }); return sa && sb ? s / Math.sqrt(sa * sb) : 0; })();
  const test = { n: rows.length, r: corr, topAvg: avg(rOf(top)), allAvg: avg(rOf(order)), topLoved: share(top), allLoved: share(order), top: top.length };
  // how much each kind counts for you: its weight's share (a minus when it counts against)
  const names = [...FY_FAMS.map(([, n]) => n), ...FY_NUMS.map(([, n]) => n)], tot = fit.w.reduce((s, w) => s + Math.abs(w), 0) || 1;
  const weights = fit.w.map((w, j) => ({ name: names[j], share: Math.abs(w) / tot, sign: Math.sign(w) })).sort((a, b) => b.share - a.share);
  return { L, A, K, fam, xOf, fit, stars, love, test, weights, rows: rows.length };
}

// Why a film is on the list: the few things that lift it most, in words.
function fyWhy(model, feats, m, x, recFrom) {
  const out = [], { fit, A, K } = model;
  const famText = (F, it) => {
    const a = A[F].get(it[0]); if (!a || !a.rn) return "";
    const v = `${(a.rs / a.rn).toFixed(1)}★ on average over ${plural(a.rn, "film")} of yours`;
    if (F === "d") return `You rate ${a.name}'s films ${(a.rs / a.rn).toFixed(1)}★ on average (${plural(a.rn, "film")})`;
    if (F === "w") return `Written by ${a.name}: ${v}`;
    if (F === "c") return `With ${a.name}: ${v}`;
    if (F === "x") return `${roleNames(m, "p").includes(a.name) ? "Shot by" : "Music by"} ${a.name}: ${v}`;
    if (F === "g") return `${a.name} films: ${v}`;
    if (F === "gd") return `${a.name}: ${v}`;
    if (F === "dec") return `Films from ${a.name}: ${v}`;
    if (F === "k") return `Made in ${a.name}: ${v}`;
    if (F === "l") return `In ${a.name}: ${v}`;
    return `From ${a.name}: ${v}`;
  };
  // only a kind that counts for you, and only a thing in it you take to more than your usual (a weak decade lifting a
  // film through the arithmetic of the fit isn't a reason)
  const affOf = (F, k) => { const a = A[F].get(k); return a ? a.sum / (a.w + K[F]) : -Infinity; };
  FY_FAMS.forEach(([F], j) => {
    const lift = fit.w[j] * (x[j] - fit.mean[j]) / fit.sd[j];
    if (fit.w[j] <= 0 || lift < 0.04 || !feats[F]) return;
    const best = [...feats[F]].sort((p, q) => affOf(F, q[0]) - affOf(F, p[0]))[0];
    if (!best || affOf(F, best[0]) < 0.1) return;
    const text = famText(F, best); if (text) out.push({ lift, text });
  });
  const nj = FY_FAMS.length, liftOf = (j) => fit.w[nj + j] * (x[nj + j] - fit.mean[nj + j]) / fit.sd[nj + j];
  if (recFrom && recFrom.length) out.push({ lift: Math.max(0.05, liftOf(3)), text: `TMDB recommends it for ${joinWords(recFrom.slice(0, 3).map((f) => f.name), "and")}, which you loved` });
  // what's yours (your people, genres, places, films you loved) before what the crowd says
  const general = [];
  if (liftOf(0) >= 0.04 && m.va) general.push({ lift: liftOf(0), text: `Well regarded: ${m.va.toFixed(1)} on TMDB from ${fmtN(m.vc || 0)} votes` });
  if (liftOf(1) >= 0.04) general.push({ lift: liftOf(1), text: (m.vc || 0) < 2000 ? "Less widely seen, the kind you rate above the crowd" : "Widely seen, the kind you rate well" });
  return [...out.sort((a, b) => b.lift - a.lift), ...general.sort((a, b) => b.lift - a.lift)].slice(0, 3).map((o) => o.text);
}

// 3 and 4. Films to choose from, read and scored; `say` reports progress. Throws { code } when TMDB turns it away.
async function fyMake(lib, key, signal, say = () => {}) {
  let model = fyModel(lib); if (!model) throw { code: "few" };
  const today = new Date().toISOString().slice(0, 10), have = new Set(), haveKey = new Set(), byId = new Map();
  for (const f of lib.films) { const m = metaOf(f); if (m && m.id && !m.tv) { have.add(m.id); byId.set(m.id, f); } haveKey.add(titleKey(f.name, f.year)); }
  const C = new Map(), recDiary = new Map();
  const add = (r, src) => {
    if (!r || !r.id || have.has(r.id) || r.adult || (r.video && !r.vote_count)) return null;
    const year = parseInt((r.release_date || "").slice(0, 4), 10) || null;
    if (!r.release_date || r.release_date > today || haveKey.has(titleKey(r.title || "", year)) || FY_NOT_A_FILM.test(r.title || "")) return null;
    let c = C.get(r.id);
    if (!c) C.set(r.id, c = { id: r.id, name: r.title || r.original_title || "", year, rec: 0, from: [], people: [], wl: null,
      m: { id: r.id, y: year, g: (r.genre_ids || []).map((g) => FY_GENRES[g]).filter(Boolean), l: fyLang(r.original_language), va: r.vote_average, vc: r.vote_count, poster: r.poster_path, d: [], c: [] } });
    if (src) src(c);
    return c;
  };
  // the films you loved most, no more than two by one director, and TMDB's recommendations for each
  const seeds = [], perDir = new Map();
  for (const [f, s] of [...model.L.s].sort((a, b) => b[1] - a[1])) {
    if (seeds.length >= FY_SEEDS || s < 0.8) break;
    const m = metaOf(f); if (!m || !m.id || m.tv) continue;
    const d = roleNames(m, "d")[0] || ""; if ((perDir.get(d) || 0) >= 2) continue;
    perDir.set(d, (perDir.get(d) || 0) + 1); seeds.push({ f, s, id: m.id });
  }
  const jobs = [];
  for (const sd of seeds) jobs.push(async () => {
    const res = ((await tmdbGet(`/movie/${sd.id}/recommendations`, { page: 1 }, key, signal)) || {}).results || [];
    res.forEach((r, i) => { const w = sd.s / (1 + i / 8);
      if (have.has(r.id)) { const df = byId.get(r.id); if (df && df !== sd.f) recDiary.set(df.key, (recDiary.get(df.key) || 0) + w); return; }
      add(r, (c) => { c.rec += w; c.from.push(sd.f); }); });
  });
  // the directors you rate highest (2+ films) and the actors (3+), and what they've made and led
  const best = (F, min, n) => [...model.A[F].entries()].filter(([, a]) => a.n >= min).map(([k, a]) => ({ a, aff: a.sum / (a.w + model.K[F]) }))
    .filter((x) => x.aff > 0).sort((p, q) => q.aff - p.aff).slice(0, n);
  for (const { a } of best("d", 2, FY_DIRS)) { const pid = personIdOf(a.name); if (pid) jobs.push(async () => {
    const d = await tmdbGet(`/person/${pid}/movie_credits`, {}, key, signal);
    for (const r of ((d && d.crew) || []).filter((x) => x.job === "Director")) add(r, (c) => { if (!c.people.includes(a.name)) c.people.push(a.name); c.m.d = [...new Set([...c.m.d, a.name])]; });
  }); }
  for (const { a } of best("c", 3, FY_ACTORS)) { const pid = personIdOf(a.name); if (pid) jobs.push(async () => {
    const d = await tmdbGet(`/person/${pid}/movie_credits`, {}, key, signal);
    for (const r of ((d && d.cast) || []).filter((x) => x.order != null && x.order <= 3)) add(r, (c) => { if (!c.people.includes(a.name)) c.people.push(a.name); c.m.c = [...new Set([...c.m.c, a.name])]; });
  }); }
  say("Asking TMDB for films like the ones you love", 0, jobs.length);
  await fyRun(jobs, signal, (n) => say("Asking TMDB for films like the ones you love", n, jobs.length));
  // the model again, now knowing which of your own films TMDB recommends for the others you loved
  model = fyModel(lib, recDiary) || model;
  // your watchlist, read already
  for (const w of lib.watchlistFilms) { const m = metaOf(w); if (!m || m.miss || !m.id || m.tv || have.has(m.id)) continue;
    const c = C.get(m.id) || { id: m.id, name: w.name, year: w.year, rec: 0, from: [], people: [], m };
    c.m = m; c.full = true; c.wl = w; C.set(m.id, c); }
  // a first look at the rest from what the lists say, and the best of them read in full
  const scoreOf = (c) => model.fit.predict(model.xOf(fyFeats(c.m, c.year), c.m, c.rec));
  const pool = [...C.values()].filter((c) => (c.m.vc || 0) >= (c.wl ? 15 : FY_MIN_VOTES));
  const toRead = pool.filter((c) => !c.full).map((c) => ({ c, p: scoreOf(c) })).sort((a, b) => b.p - a.p).slice(0, FY_DETAIL).map((x) => x.c);
  say("Reading the likeliest films in full", 0, toRead.length);
  await fyRun(toRead.map((c) => async () => {
    const d = await tmdbGet(`/movie/${c.id}`, { append_to_response: "credits" }, key, signal);
    if (d) { c.m = detailsMeta(d).meta; c.full = true; c.name = d.title || c.name; }
  }), signal, (n) => say("Reading the likeliest films in full", n, toRead.length));
  // scored in full, short films and documentaries you don't take to left out
  const scored = pool.filter((c) => c.full && (!c.m.r || c.m.r >= 45)).map((c) => {
    const feats = fyFeats(c.m, c.year), x = model.xOf(feats, c.m, c.rec), p = model.fit.predict(x);
    return { c, p, why: fyWhy(model, feats, c.m, x, [...new Set(c.from)].sort((a, b) => (model.L.s.get(b) || 0) - (model.L.s.get(a) || 0))) };
  }).sort((a, b) => b.p - a.p);
  const pick = (list) => fyPick(list, FY_N);
  const keep = (x) => ({ id: x.c.id, name: x.c.name, year: x.c.year, wl: x.c.wl ? x.c.wl.key : "", p: x.p, stars: model.stars(x.p), love: model.love(x.p), why: x.why, m: fyTrim(x.c.m) });
  const all = pick(scored).map(keep), fresh = pick(scored.filter((x) => !x.c.wl)).map(keep);
  return { v: FY_V, user: lib.profile.username || "", sig: fySig(lib), at: new Date().toISOString(), all, fresh,
    test: model.test, weights: model.weights, seeds: seeds.length, considered: pool.length, read: toRead.length };
}
// A few TMDB calls at a time.
async function fyRun(jobs, signal, tick) {
  let i = 0, done = 0;
  const worker = async () => { while (i < jobs.length) { if (signal && signal.aborted) throw { code: "stop" }; const j = jobs[i++];
    try { await j(); } catch (e) { if (e && (e.code === "auth" || e.code === "stop" || e.name === "AbortError")) throw e; } tick(++done); } };
  await Promise.all(Array.from({ length: 6 }, worker));
}
// The hundred best, varied: at most three by one director, one of a series.
function fyPick(list, n) {
  const out = [], perDir = new Map(), series = new Set();
  for (const x of list) {
    if (out.length >= n) break;
    const ds = roleNames(x.c.m, "d"), cl = x.c.m.cl;
    if (ds.some((d) => (perDir.get(d) || 0) >= 3) || (cl && series.has(cl))) continue;
    ds.forEach((d) => perDir.set(d, (perDir.get(d) || 0) + 1)); if (cl) series.add(cl);
    out.push(x);
  }
  return out;
}
// What's kept of a film (the card needs no more): its people's first few, its facts.
const fyTrim = (m) => { const o = {}; for (const k of ["id", "y", "g", "k", "l", "r", "va", "vc", "poster", "im", "cl", "d", "di", "w", "wi", "p", "pi", "m", "mi", "co"]) if (m[k] != null) o[k] = m[k];
  o.c = (m.c || []).slice(0, 12); o.ci = (m.ci || []).slice(0, 12); if (m.vo) { o.vo = m.vo.slice(0, 8); o.voi = (m.voi || []).slice(0, 8); } o.src = "tmdb"; return o; };
// What the list was made from: a film logged, rated, liked or rated again, or a film's cast and crew arriving, changes it,
// and the list is made again with it as a new data point (asked 5 Nov 2026: "the engine should update when I log movies
// … and the ratings I give them and their complete profile … a new data point which the algorithm should take in account")
const fySig = (lib) => { let rated = 0, sum = 0, liked = 0, known = 0;
  for (const f of lib.films) { if (f.rating) { rated++; sum += f.rating * 2; } if (f.liked) liked++; if ((f.rating || f.liked) && metaOf(f)) known++; }
  return `${lib.profile.username || ""}|${lib.entries.length}|${rated}|${sum}|${liked}|${known}`; };
// The list as films the app can show: each opens a card with why.
function fyFilms(which) {
  if (!FY) return [];
  const seen = new Set(), seenKey = new Set();
  for (const f of (MY_LIB && MY_LIB.films) || []) { const m = metaOf(f); if (m && m.id) seen.add(m.id); seenKey.add(titleKey(f.name, f.year)); }
  return (FY[which] || []).filter((x) => !seen.has(x.id) && !seenKey.has(titleKey(x.name, x.year))).map((x, i) => ({ key: `fy:${x.id}`, name: x.name, year: x.year, rating: null, liked: false, entries: [], reviews: 0,
    uri: `https://letterboxd.com/tmdb/${Number(x.id)}/`, fy: x.m, fyRank: i + 1, fyStars: x.stars, fyLove: x.love, fyWhy: x.why, fyWl: !!x.wl }));
}
const fyBadge = (f) => `#${f.fyRank} for you: about ${f.fyStars.toFixed(1)}★, ${Math.round(f.fyLove * 100)}% chance you'd love it${f.fyWl ? " · on your watchlist" : ""}`;
const fyCard = (f) => D.film(f, { badge: fyBadge(f) });

// Made again by itself (once you've made one) when the diary has changed: after lookups are done, at most once an hour,
// checked a little after the page opens and every quarter of an hour. Each new film you log is then part of what it
// learns from, and a film you've logged leaves the list at once (`fyFilms`).
function fyAutoCheck() {
  const lib = MY_LIB;
  if (!lib || state.mode !== "mine" || !FY || FY.user !== (lib.profile.username || "") || FY_JOB.running || job.running) return;
  if (!fyStale(lib) || fyState(lib) !== "ok" || Date.now() - Date.parse(FY.at) < 3600e3) return;
  fyStart(lib, fyRedraw);
}
// Whether a list can be made here, and what's missing.
function fyState(lib) {
  if (IN_VIEWER) return "viewer";
  if (!lib || state.mode !== "mine") return "nodiary";
  if (lib.films.filter((f) => f.rating && metaOf(f)).length < FY_MIN_RATED) return "few";
  if (!tmdbKey()) return SHARED_PENDING ? "wait" : "nokey";
  return "ok";
}
const fyStale = (lib) => !FY || FY.v !== FY_V || FY.sig !== fySig(lib) || Date.now() - Date.parse(FY.at) > FY_DAYS * 864e5;
function fyLoad() { const v = store.get(KEYS.foryou, null); FY = v && v.v === FY_V && Array.isArray(v.all) ? v : null; }
// Makes the list (again); `redraw` is called as it goes.
async function fyStart(lib, redraw) {
  if (FY_JOB.running || fyState(lib) !== "ok") return;
  const ctl = new AbortController();
  Object.assign(FY_JOB, { running: true, step: "Learning your taste from your diary", done: 0, total: 0, err: "", ctl });
  redraw();
  let last = 0;
  try {
    const out = await fyMake(lib, tmdbKey(), ctl.signal, (step, done, total) => { Object.assign(FY_JOB, { step, done, total });
      const now = Date.now(); if (now - last > 250) { last = now; redraw(); } });
    FY = out; store.set(KEYS.foryou, FY); store.flush(); // kept at once: it took a minute of TMDB's time to make
  } catch (e) {
    FY_JOB.err = e && e.code === "auth" ? "TMDB didn't accept the key. Check it in Settings." : e && e.code === "few" ? `This needs at least ${FY_MIN_RATED} rated films with cast & crew.`
      : e && e.code === "stop" ? "" : "Couldn't reach TMDB just now. Try again in a moment.";
  }
  FY_JOB.running = false; FY_JOB.ctl = null;
  redraw();
}
// The page's body, the same on both layouts (`phone` picks the list's look).
function fyBodyHtml(lib, phone) {
  const st = fyState(lib);
  if (st === "viewer") return `<div class="empty">For you reads films from TMDB, which this version inside Claude can't reach. Open it on the website.</div>`;
  if (st === "nodiary") return `<div class="empty">Import your Letterboxd export first.</div>`;
  if (st === "few") return `<div class="empty">This needs at least ${FY_MIN_RATED} rated films with cast &amp; crew details. ${phone ? "" : `Look them up in <button class="linkish" type="button" data-goto="settings">Settings</button>.`}</div>`;
  if (st === "wait") return `<p class="fy-small" role="status">Getting ready…</p>`;
  if (st === "nokey") return `<div class="empty">This reads films from TMDB, so it needs a TMDB key: add one in Settings.</div>`;
  const mine = FY && FY.user === (lib.profile.username || "");
  if (FY_JOB.running) {
    const pc = FY_JOB.total ? Math.round(FY_JOB.done / FY_JOB.total * 100) : 0;
    const run = `<div class="fy-run" role="status"><p class="fy-step">${mine ? "Making your list again: " : ""}${esc(FY_JOB.step)}…${FY_JOB.total ? ` ${fmtN(FY_JOB.done)} of ${fmtN(FY_JOB.total)}` : ""}</p>
      <div class="meter" aria-hidden="true"><span style="width:${pc}%"></span></div><p class="fy-small">${mine ? "The list below is the last one until then." : "Less than a minute. You can keep using the site meanwhile."}</p></div>`;
    // the last list stays while a new one is made
    if (!mine) return run;
    return run + fyListHtml(lib, phone);
  }
  const err = FY_JOB.err ? `<p class="status err" role="alert">${esc(FY_JOB.err)}</p>` : "";
  if (!mine) return `${err}<div class="fy-intro"><p>A hundred films you haven't logged that you'd likely love: found through TMDB's recommendations for the films you loved most, the work of the directors and actors you rate highest, and your watchlist, then ranked by what your own ratings and likes show you go for.</p>
    <button class="btn fy-go" type="button" data-fy="go">Find 100 films for you</button></div>`;
  return err + fyListHtml(lib, phone) + `<p class="fy-foot">Made ${esc(fmtDate(FY.at.slice(0, 10)))} · <button class="linkish" type="button" data-fy="go">Make it again</button></p>`;
}
function fyListHtml(lib, phone) {
  const which = state.fyShow === "fresh" ? "fresh" : "all", films = fyFilms(which);
  const chips = `<div class="fy-chips" role="group" aria-label="Which films">${[["all", "All"], ["fresh", "Not on my watchlist"]].map(([v, l]) =>
    `<button class="chip" type="button" data-fyshow="${v}" aria-pressed="${v === which}">${l}</button>`).join("")}</div>`;
  const grid = films.length ? (phone ? drillBody(fyDrill(films, which), FY_N).html
    : `<ol class="fy-grid">${films.map((f) => `<li><button class="poster fy-p" type="button" ${dl(fyCard(f))}>${artHtml(f)}<span class="fy-rk">${f.fyRank}</span>
        <span class="cap"><span class="fy-t">${esc(f.name)} <span class="muted">${f.year || ""}</span></span><span class="fy-s">${f.fyStars.toFixed(1)}★ · ${Math.round(f.fyLove * 100)}%${f.fyWl ? ' · <span class="fy-wl">watchlist</span>' : ""}</span>
        ${f.fyWhy[0] ? `<span class="fy-why">${esc(f.fyWhy[0])}</span>` : ""}</span></button></li>`).join("")}</ol>`)
    : `<div class="empty">Nothing here yet.</div>`;
  const T = FY.test, w = FY.weights.filter((x) => x.share >= 0.03).slice(0, 7);
  const how = `<details class="fy-how"><summary>How it's worked out</summary>
    <p>From your ${fmtN(T.n)} rated and liked films with details, it learned what you go for: how far your films with each director, writer, actor, genre, decade, country and language sit above or below your usual, and how much each of those matters for you. What counts most for you: ${esc(joinWords(w.map((x) => `${x.name.toLowerCase()} ${Math.round(x.share * 100)}%${x.sign < 0 ? " (against)" : ""}`)))}.</p>
    <p>Tested on your own diary, each film predicted without itself: the ${fmtN(T.top)} it rates highest you gave ${T.topAvg ? T.topAvg.toFixed(2) : "—"}★ on average, against ${T.allAvg ? T.allAvg.toFixed(2) : "—"}★ for all of them, and ${Math.round(T.topLoved * 100)}% of them you rated 4★ or more or liked, against ${Math.round(T.allLoved * 100)}% overall.</p>
    <p>It's made again by itself when you log, rate or like films (once their cast and crew are looked up), so each one is a new data point it learns from; a film you log leaves the list straight away.</p>
    <p>It looked at ${fmtN(FY.considered)} films (TMDB's recommendations for ${fmtN(FY.seeds)} films you loved, your favourite directors' and actors' films, your watchlist), read the ${fmtN(FY.read)} likeliest in full, and kept no more than three by one director and one of a series. The stars are its guess at your rating; the percentage is the chance you'd rate it 4★ or more, or like it.</p></details>`;
  return chips + grid + how;
}
const fyDrill = (films, which) => D.films(which === "fresh" ? "100 films for you, not on your watchlist" : "100 films for you", "Likeliest favourites first", films,
  { sort: "given", ratingOf: (f) => Math.round(f.fyStars * 2) / 2, cardOf: (f) => fyCard(f),
    note: (f) => `#${f.fyRank} · about ${f.fyStars.toFixed(1)}★ · ${Math.round(f.fyLove * 100)}% chance you'd love it${f.fyWl ? " · on your watchlist" : ""}${f.fyWhy[0] ? ` · ${f.fyWhy[0]}` : ""}` });
</script>
