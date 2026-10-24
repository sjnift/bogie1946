<script>
/* ---------- the study: what the diary says about taste and habits, and why ----------
   Worked out from the diary alone, the same for both layouts: the stretches that stood apart from the rest (chapters),
   how taste has moved (drifts), what ratings follow and what's liked beyond a film's reputation, how one film led to
   another (threads), and the habits behind it all. Nothing the Stats page shows is repeated here.
   A finding is only said when it's big enough to matter and unlikely to be chance: a difference has to be STUDY_Z
   standard errors or more from what the rest of the diary would give (about 1 in 700 by chance). Every sentence opens
   the films or diary entries it rests on. Taste is read from first watches (each film once, on the day it was first
   seen), habits from every diary entry. */
const STUDY_Z = 3;
const sq = (x) => x * x;
const medianOf = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
const sdOf = (a) => { if (a.length < 2) return 0; const m = avg(a); return Math.sqrt(a.reduce((t, x) => t + sq(x - m), 0) / (a.length - 1)); };
// how far k of n is from what a share p0 would give, in standard errors
const zShare = (k, n, p0) => n && p0 > 0 && p0 < 1 ? (k - n * p0) / Math.sqrt(n * p0 * (1 - p0)) : 0;
// two averages, or two shares, apart in standard errors
const zMeans = (a, b) => { if (a.length < 4 || b.length < 4) return 0; const v = sq(sdOf(a)) / a.length + sq(sdOf(b)) / b.length; return v ? (avg(a) - avg(b)) / Math.sqrt(v) : 0; };
const zProps = (k1, n1, k2, n2) => { if (!n1 || !n2) return 0; const p = (k1 + k2) / (n1 + n2), v = p * (1 - p) * (1 / n1 + 1 / n2); return v ? (k1 / n1 - k2 / n2) / Math.sqrt(v) : 0; };
const pc = (x) => Math.round(x * 100);
const joinAnd = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// "February – June 2022", "November 2023 – March 2024", "May 2024"
const monthSpan = (a, b) => a.slice(0, 7) === b.slice(0, 7) ? monthName(a) : a.slice(0, 4) === b.slice(0, 4) ? `${MONTHS_LONG[+a.slice(5, 7) - 1]} – ${monthName(b)}` : `${monthName(a)} – ${monthName(b)}`;
// A straight line through points weighted by how many films each stands for: where it starts and ends, and how sure
// the slope is (its t: slope over its standard error).
function fitLine(pts) {
  pts = pts.filter((p) => p.w > 0 && p.y != null && isFinite(p.y));
  if (pts.length < 4) return null;
  let W = 0, mx = 0, my = 0;
  for (const p of pts) { W += p.w; mx += p.w * p.x; my += p.w * p.y; }
  mx /= W; my /= W;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) { sxx += p.w * sq(p.x - mx); sxy += p.w * (p.x - mx) * (p.y - my); syy += p.w * sq(p.y - my); }
  if (!sxx) return null;
  const b = sxy / sxx, a = my - b * mx;
  let sse = 0;
  for (const p of pts) sse += p.w * sq(p.y - a - b * p.x);
  const se = Math.sqrt(sse / (pts.length - 2) / sxx);
  const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
  return { b, t: se ? b / se : (b ? Math.sign(b) * 99 : 0), r2: syy ? 1 - sse / syy : 0, from: a + b * x0, to: a + b * x1 };
}

/* ----- what each film is, as the study sees it ----- */
const PLACE = { "United States of America": "the US", "United Kingdom": "the UK", "Soviet Union": "the Soviet Union", Netherlands: "the Netherlands", Philippines: "the Philippines",
  "Czech Republic": "the Czech Republic", "Dominican Republic": "the Dominican Republic", "United Arab Emirates": "the UAE", "Russian Federation": "Russia" };
const placeName = (k) => PLACE[k] || k;
const GENRE_NOUN = { Documentary: "documentaries", Animation: "animated films", "TV Movie": "TV films", Western: "westerns" };
const genreNoun = (g) => GENRE_NOUN[g] || `${g.toLowerCase()} films`;
// The things a film can be, each with how to say it: "61% were crime films", "from the 1940s", "in Japanese", "by …".
const FACETS = {
  g: { vals: (x) => x.g, were: genreNoun, season: (v) => `${v} season`, meta: true },
  dec: { vals: (x) => x.dec ? [x.dec] : [], were: (v) => `from the ${v}s`, season: (v) => `${v}s season` },
  l: { vals: (x) => x.l ? [x.l] : [], were: (v) => `in ${v}`, season: (v) => `${v} season`, meta: true },
  k: { vals: (x) => x.k, were: (v) => `from ${placeName(v)}`, season: (v) => `${placeName(v).replace(/^the /, "")} season`, meta: true },
  d: { vals: (x) => x.d, were: (v) => `by ${v}`, season: (v) => `${v} season`, meta: true, person: true },
  c: { vals: (x) => x.c, were: (v) => `with ${v}`, season: (v) => `${v} season`, meta: true, person: true },
};
const rtBand = (r) => r < 90 ? "Under 90 minutes" : r < 120 ? "90 minutes to 2 hours" : r < 150 ? "2 to 2½ hours" : "2½ hours or more";
const popBand = (q) => q >= 0.8 ? "Most popular fifth" : q >= 0.4 ? "Middle" : q > 0.2 ? "Less known" : "Least known fifth";
const ageWord = (n) => `${Math.round(n)} year${Math.round(n) === 1 ? "" : "s"} old`;

// Every film once, as first seen in the diary, with what the study needs to know about it.
function studyBase(lib, metaOf, crowdKey) {
  const crowd = CROWDS[crowdKey] || CROWDS.tmdb;
  const E = lib.entries;
  // how many people have rated a film, from whichever source covers most of the diary
  const srcs = [["Letterboxd", (f) => LBX[f.key] && LBX[f.key].n], ["IMDb", (f, m) => m && m.iv], ["TMDB", (f, m) => m && m.vc]];
  const inDiary = [...new Set(E.map((e) => e.film))];
  const cover = srcs.map(([, get]) => inDiary.filter((f) => get(f, metaOf(f))).length);
  const [popSrc, popGet] = srcs[cover.indexOf(Math.max(...cover))];
  const xs = [], seen = new Set(), seenDir = new Set();
  for (const e of E) {
    const f = e.film, m = metaOf(f);
    if (!seen.has(f)) {
      seen.add(f);
      if (!e.rewatch) {
        const cs = crowd.score(m, f), votes = popGet(f, m);
        const x = { f, e, date: e.date, m: !!m, g: m ? [...new Set(m.g)] : [], k: m ? [...new Set(m.k)] : [], l: (m && m.l) || null,
          d: m ? [...new Set(m.d)] : [], c: m ? [...new Set(m.c.slice(0, 6))] : [], w: m ? [...new Set(m.w || [])] : [],
          dec: f.year ? Math.floor(f.year / 10) * 10 : null, age: f.year ? Math.max(0, +e.date.slice(0, 4) - f.year) : null, rt: (m && m.r) || null,
          crowd: cs ? cs / 2 : null, votes: votes || null, rating: f.rating || null, rAt: e.rating || null };
        x.newDir = x.d.length > 0 && x.d.every((n) => !seenDir.has(personKey(n)));
        xs.push(x);
      }
    }
    if (m) for (const n of m.d) seenDir.add(personKey(n));
  }
  // where each film stands in popularity within this diary, 0 (least rated) to 1 (most)
  const withVotes = xs.filter((x) => x.votes).sort((a, b) => a.votes - b.votes);
  withVotes.forEach((x, i) => { x.popQ = withVotes.length > 1 ? i / (withVotes.length - 1) : 0.5; });
  for (const x of xs) if (x.popQ === undefined) x.popQ = null;
  const byFilm = new Map(xs.map((x) => [x.f, x]));
  return { lib, crowd, crowdKey, popSrc, xs, byFilm, E, counts: facetCounts(xs) };
}
function facetCounts(xs) {
  const out = { n: { dec: xs.filter((x) => x.dec).length, meta: xs.filter((x) => x.m).length } };
  for (const [id, fc] of Object.entries(FACETS)) { const m = new Map(); for (const x of xs) for (const v of fc.vals(x)) bump(m, v); out[id] = m; }
  return out;
}

/* ----- what sets a group of films apart from the rest of the diary ----- */
// `strict` is for chapters: people need four films and an eighth of the stretch before they count.
function standouts(F, B, strict) {
  const out = [], C = B.counts;
  const nOf = (fid, list) => fid === "dec" ? list.filter((x) => x.dec).length : list.filter((x) => x.m).length;
  for (const [fid, fc] of Object.entries(FACETS)) {
    const n = nOf(fid, F), N = fid === "dec" ? C.n.dec : C.n.meta;
    if (n < 6 || N - n < 6) continue;
    const here = new Map();
    for (const x of F) for (const v of fc.vals(x)) bump(here, v);
    for (const [v, k] of here) {
      const p0 = ((C[fid].get(v) || 0) - k) / (N - n), share = k / n;
      const minK = fc.person ? (strict ? 4 : 3) : Math.max(4, Math.ceil(n * 0.08));
      const minGap = fc.person ? (strict ? 0.12 : 0.05) : 0.08;
      if (k < minK || share - p0 < minGap || share < 1.6 * p0) continue;
      const z = zShare(k, n, Math.max(p0, 0.5 / N));
      if (z < STUDY_Z) continue;
      out.push({ fid, v, k, n, share, p0, z, xs: F.filter((x) => fc.vals(x).includes(v)) });
    }
  }
  return out.sort((a, b) => b.z - a.z);
}
// "61% were crime films, against 18% the rest of the time"
const standoutText = (s, rest = "the rest of the time") => `${pc(s.share)}% were ${FACETS[s.fid].were(s.v)}, against ${pc(s.p0)}% ${rest}`;
// The other things that set a stretch apart, leaving out ones that are the same films again (Japan and Japanese).
function alsoText(st) {
  const main = st[0], picked = [];
  for (const s of st.slice(1)) {
    if (picked.length === 2) break;
    if (s.fid === main.fid && !FACETS[s.fid].person) continue;
    const same = (a, b) => a.xs.filter((x) => b.xs.includes(x)).length >= 0.8 * Math.min(a.xs.length, b.xs.length);
    if ([main, ...picked].some((p) => same(p, s))) continue;
    picked.push(s);
  }
  return picked.map((s) => FACETS[s.fid].person ? `${s.k} ${FACETS[s.fid].were(s.v)}` : `${pc(s.share)}% ${FACETS[s.fid].were(s.v)}`);
}
const xsFilms = (xs) => xs.map((x) => x.f);
const bestFirst = (xs) => [...xs].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.crowd || 0) - (a.crowd || 0));

/* ----- stretches of time ----- */
const PERIOD_UNITS = {
  month: { key: (d) => d.slice(0, 7), label: (a) => monthName(a), axis: (a) => MONTHS[+a.slice(5, 7) - 1][0], minor: () => false },
  quarter: { key: (d) => `${d.slice(0, 4)}-${Math.floor((+d.slice(5, 7) - 1) / 3)}`, label: (a, b) => monthSpan(a, b), axis: (a) => +a.slice(5, 7) === 1 ? `’${a.slice(2, 4)}` : "", minor: (a) => +a.slice(5, 7) !== 1 },
  half: { key: (d) => `${d.slice(0, 4)}-${+d.slice(5, 7) > 6 ? 1 : 0}`, label: (a, b) => monthSpan(a, b), axis: (a) => +a.slice(5, 7) === 1 ? `’${a.slice(2, 4)}` : "", minor: (a) => +a.slice(5, 7) !== 1 },
  year: { key: (d) => d.slice(0, 4), label: (a) => a.slice(0, 4), axis: (a) => `’${a.slice(2, 4)}`, minor: () => false },
};
// Small enough to see change, big enough to hold a few dozen films each.
function pickUnit(xs) {
  if (xs.length < 2) return "year";
  const months = (+xs[xs.length - 1].date.slice(0, 4) - +xs[0].date.slice(0, 4)) * 12 + (+xs[xs.length - 1].date.slice(5, 7) - +xs[0].date.slice(5, 7)) + 1;
  if (months >= 15 && xs.length / (months / 3) >= 24) return "quarter";
  if (months >= 24 && xs.length / (months / 6) >= 20) return "half";
  return "year";
}
// Every period from the first film to the last, empty ones included, with the films first seen in each and the
// diary entries made in each. `within` keeps to one year.
function studyPeriods(B, unit, within) {
  const U = PERIOD_UNITS[unit], xs = within ? B.xs.filter((x) => x.date.startsWith(within)) : B.xs;
  const E = within ? B.E.filter((e) => e.date.startsWith(within)) : B.E;
  if (!E.length) return [];
  const first = within ? `${within}-01-01` : E[0].date, last = within ? `${within}-12-31` : E[E.length - 1].date;
  const out = [], byKey = new Map();
  for (let y = +first.slice(0, 4), mo = +first.slice(5, 7); y * 12 + mo <= +last.slice(0, 4) * 12 + +last.slice(5, 7); mo === 12 ? (y++, mo = 1) : mo++) {
    const from = `${y}-${String(mo).padStart(2, "0")}-01`, k = U.key(from);
    let p = byKey.get(k);
    if (!p) { p = { key: k, from, F: [], E: [] }; byKey.set(k, p); out.push(p); }
    p.to = isoOfDay(dayIndex(mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`) - 1);
  }
  for (const p of out) { p.label = U.label(p.from, p.to); p.axis = U.axis(p.from); p.minor = U.minor(p.from); }
  for (const x of xs) { const p = byKey.get(U.key(x.date)); if (p) p.F.push(x); }
  for (const e of E) { const p = byKey.get(U.key(e.date)); if (p) p.E.push(e); }
  out.forEach((p, i) => { p.i = i; });
  return out;
}

/* ----- chapters: stretches that stood apart ----- */
function chapters(B, periods, minFilms = 8, bar = STUDY_Z + 0.5, most = 8) {
  const marks = periods.map((p) => p.F.length >= minFilms ? standouts(p.F, B, true) : []);
  // neighbouring periods that stand out for the same thing make one chapter
  const runs = [];
  let cur = null;
  periods.forEach((p, i) => {
    const keys = marks[i].slice(0, 2).map((s) => `${s.fid}|${s.v}`);
    if (cur && keys.some((k) => cur.keys.has(k))) { cur.periods.push(p); keys.forEach((k) => cur.keys.add(k)); return; }
    if (cur) runs.push(cur);
    cur = keys.length ? { periods: [p], keys: new Set(keys) } : null;
  });
  if (cur) runs.push(cur);
  return runs.map((r) => {
    const F = r.periods.flatMap((p) => p.F), from = r.periods[0].from, to = r.periods[r.periods.length - 1].to;
    const st = standouts(F, B, true);
    if (F.length < 10 || !st.length || st[0].z < bar) return null;
    const top = st[0], span = monthSpan(from, to), also = alsoText(st);
    const matching = top.xs, rest = F.filter((x) => !matching.includes(x));
    const months = (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + +to.slice(5, 7) - +from.slice(5, 7) + 1;
    const title = FACETS[top.fid].season(top.v).replace(/ season$/, months > 6 ? " phase" : " season");
    return { title, span, from, until: to, n: F.length, top, st,
      text: `${span}: ${standoutText(top)}.${also.length ? ` Also ${joinAnd(also)}.` : ""}`,
      posters: xsFilms(bestFirst(matching).slice(0, 6)),
      to: D.groups(title, `${span} · ${plural(F.length, "film")} seen for the first time`, [
        D.films(capFirst(FACETS[top.fid].were(top.v)), filmsSub(xsFilms(matching), `${pc(top.share)}% of the stretch`), xsFilms(matching)),
        rest.length && D.films("Everything else you saw then", filmsSub(xsFilms(rest)), xsFilms(rest))]) };
  }).filter(Boolean).sort((a, b) => b.top.z - a.top.z).slice(0, most).sort((a, b) => a.from.localeCompare(b.from));
}

/* ----- drifts: how taste has moved ----- */
// Each one a share of films, or a typical value, worked out period by period and fitted with a straight line.
function driftDefs(B) {
  const top = [...B.counts.g].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g]) => g);
  const langs = [...B.counts.l].filter(([l, n]) => l !== "English" && n >= Math.max(8, B.counts.n.meta * 0.03)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l);
  const C = B.crowd, fmtC = (v) => crowdScore(B.crowdKey in CROWDS ? B.crowdKey : "tmdb", v);
  const share = (id, big, name, test, needs = (x) => x.m) => ({ id, kind: "share", big, name, test, needs, min: 0.08,
    text: (a, b, y0, y1) => `${capFirst(name)} ${b > a ? "have grown" : "have shrunk"} from about ${pc(a)}% of the films you saw for the first time in ${y0} to ${pc(b)}% in ${y1}.` });
  return [
    ...top.map((g) => share(`g:${g}`, capFirst(genreNoun(g)), genreNoun(g), (x) => x.g.includes(g))),
    { ...share("nonEng", "World cinema", "films not in English", (x) => x.l !== "English", (x) => !!x.l), big2: "More English" },
    ...langs.map((l) => share(`l:${l}`, `Films in ${l}`, `films in ${l}`, (x) => x.l === l, (x) => !!x.l)),
    { ...share("fresh", "New releases", "new releases (films from that year or the one before)", (x) => x.age <= 1, (x) => x.age != null), big2: "Fewer new releases" },
    { id: "newDir", kind: "share", big: "Exploring", big2: "Old favourites", name: "directors new to you", test: (x) => x.newDir, needs: (x) => x.d.length, min: 0.08,
      text: (a, b, y0, y1) => b > a ? `You're exploring more: ${pc(b)}% of the films you saw for the first time in ${y1} were by directors you'd never seen before, against ${pc(a)}% in ${y0}.`
        : `You're going back to directors you know: ${pc(b)}% of your new films in ${y1} were by someone you'd never seen before, against ${pc(a)}% in ${y0}.` },
    { id: "age", kind: "median", big: "Older films", big2: "Newer films", name: "age when you saw it", val: (x) => x.age, min: 5, fmt: (v) => ageWord(v), sort: "old", note: (x) => `${ageWord(x.age)} when you saw it`,
      text: (a, b, y0, y1) => `You've moved toward ${b > a ? "older" : "newer"} films: the typical film you saw in ${y0} was about ${ageWord(a)} at the time; in ${y1}, about ${ageWord(b)}.` },
    { id: "rt", kind: "mean", big: "Longer films", big2: "Shorter films", name: "length", val: (x) => x.rt, min: 8, fmt: (v) => `${Math.round(v)} min`, sort: "runtime", note: (x) => `${x.rt} min`,
      text: (a, b, y0, y1) => `Your films have got ${b > a ? "longer" : "shorter"}: ${Math.round(a)} minutes on average in ${y0}, ${Math.round(b)} in ${y1}.` },
    { id: "votes", kind: "logmedian", big: "Off the beaten path", big2: "Better-known films", name: `${B.popSrc} ratings`, val: (x) => x.votes, min: Math.log(1.8), fmt: (v) => fmtN(Math.round(v)), note: (x) => `${fmtN(x.votes)} ${B.popSrc} ratings`,
      text: (a, b, y0, y1) => `You've moved ${b < a ? "off the beaten path" : "toward better-known films"}: the typical film you watched in ${y1} had about ${fmtN(roundish(b))} ${B.popSrc} ratings, against ${fmtN(roundish(a))} in ${y0}.` },
    { id: "crowd", kind: "mean", big: "Better-regarded films", big2: "Less acclaimed films", name: `${C.label}'s score`, val: (x) => x.crowd, min: 0.15, fmt: fmtC, note: (x) => `${C.short} ${fmtC(x.crowd)}`,
      text: (a, b, y0, y1) => `You're picking ${b > a ? "better-regarded" : "less acclaimed"} films: ${C.label} give what you watched in ${y1} ${fmtC(b)} on average, against ${fmtC(a)} in ${y0}.` },
    { id: "range", kind: "range", big: "A wider world", big2: "A narrower world", name: "range of countries", min: 1.5, fmt: (v) => v.toFixed(1),
      text: (a, b, y0, y1) => `Your range has ${b > a ? "widened" : "narrowed"}: any 20 films you watched in ${y0} came from about ${Math.round(a)} countries; in ${y1}, from about ${Math.round(b)}.` },
  ];
}
// "2019–21" for the years a run of periods covers
const periodYears = (ps) => { const a = ps[0].from.slice(0, 4), b = ps[ps.length - 1].to.slice(0, 4); return a === b ? a : `${a}–${b.slice(2)}`; };
const roundish = (v) => v >= 10000 ? Math.round(v / 1000) * 1000 : v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v);
// How many countries 20 films picked at random from a period would cover, going by each film's first country.
function countryRange(F, R = 20) {
  const ks = F.map((x) => x.k[0]).filter(Boolean), n = ks.length;
  if (n < R) return null;
  const m = new Map(); for (const k of ks) bump(m, k);
  let e = 0;
  for (const ni of m.values()) { let miss = 1; for (let j = 0; j < R; j++) { if (n - ni - j <= 0) { miss = 0; break; } miss *= (n - ni - j) / (n - j); } e += 1 - miss; }
  return e;
}
function periodValue(def, F) {
  const xs = F.filter((x) => def.kind === "share" ? def.needs(x) : def.kind === "range" ? x.k.length : def.val(x) != null && def.val(x) > 0 || (def.id === "age" && x.age === 0));
  if (def.kind === "share") return { y: xs.length ? xs.filter(def.test).length / xs.length : null, w: xs.length, xs };
  if (def.kind === "range") return { y: countryRange(xs), w: xs.length >= 20 ? xs.length : 0, xs };
  const vals = xs.map(def.val);
  if (def.kind === "mean") return { y: vals.length ? avg(vals) : null, w: vals.length, xs };
  if (def.kind === "median") return { y: medianOf(vals), w: vals.length, xs };
  return { y: vals.length ? Math.log(medianOf(vals)) : null, w: vals.length, xs }; // logmedian
}
function drifts(B, periods) {
  const P = periods.filter((p) => p.F.length >= 6);
  if (P.length < 4) return { list: [], steady: [], enough: false };
  const third = Math.max(1, Math.floor(P.length / 3)), early = P.slice(0, third), late = P.slice(-third);
  const y0 = periodYears(early), y1 = periodYears(late);
  // the value over a run of periods, each weighted by its films
  const wavg = (qs) => { const v = qs.filter((q) => q.w > 0 && q.y != null), W = v.reduce((t, q) => t + q.w, 0); return W ? v.reduce((t, q) => t + q.w * q.y, 0) / W : null; };
  const list = [], steady = [];
  for (const def of driftDefs(B)) {
    const pts = P.map((p) => ({ p, ...periodValue(def, p.F), x: p.i })), byP = new Map(pts.map((q) => [q.p, q]));
    if (pts.filter((q) => q.w > 0 && q.y != null).length < 4) continue;
    const fit = fitLine(pts);
    if (!fit) continue;
    // the line says whether it's a real move; what's said is what was actually watched, early on and lately
    const ya = wavg(pts.slice(0, third)), yb = wavg(pts.slice(-third));
    if (ya == null || yb == null) continue;
    const un = (v) => def.kind === "logmedian" ? Math.exp(v) : v;
    const a = un(ya), b = un(yb), moved = def.kind === "logmedian" ? Math.abs(yb - ya) : Math.abs(b - a);
    const films = (ps) => ps.flatMap((p) => byP.get(p).xs.filter((x) => def.kind !== "share" || def.test(x)));
    const listOf = (title, xs) => D.films(title, filmsSub(xsFilms(xs)), xsFilms(xs), def.note ? { sort: def.sort || "rating", note: (f) => def.note(B.byFilm.get(f)) } : {});
    const to = D.groups(capFirst(def.name), `${y1} against ${y0}`, [listOf(y1, films(late)), listOf(y0, films(early))]);
    const series = pts.map((q) => {
      const v = q.y == null ? null : def.kind === "share" ? pc(q.y) : def.kind === "logmedian" ? Math.exp(q.y) : q.y;
      const shown = v == null ? "too few films" : def.kind === "share" ? `${v}%` : def.fmt(v);
      const xs = def.kind === "share" ? q.xs.filter(def.test) : q.xs;
      return { v, label: q.p.axis, minor: q.p.minor, tip: `${q.p.label}: ${shown}`, to: xs.length ? listOf(`${capFirst(def.name)} · ${q.p.label}`, xs) : null };
    });
    if (Math.abs(fit.t) >= STUDY_Z && moved >= def.min && Math.sign(fit.b) === Math.sign(b - a)) {
      list.push({ id: def.id, big: b > a ? def.big : (def.big2 || `Fewer ${def.name}`), text: def.text(a, b, y0, y1), t: fit.t, r2: fit.r2, up: b > a, to, series, kind: def.kind });
    } else if (def.id.startsWith("g:") && Math.abs(fit.t) < 1.5) {
      const all = films(P), share = all.length / P.reduce((s, p) => s + p.F.filter((x) => x.m).length, 0);
      if (share >= 0.15) steady.push({ share, text: `${capFirst(def.name)} have held steady at about ${pc(share)}% of what you see for the first time, year after year.`, to });
    }
  }
  // the clearest moves first; a language's own line only if "not in English" doesn't already say it
  list.sort((p, q) => Math.abs(q.t) - Math.abs(p.t));
  const out = list.filter((d) => !(d.id.startsWith("l:") && list.some((o) => o.id === "nonEng" && o.up === d.up && Math.abs(o.t) >= Math.abs(d.t))));
  return { list: out.slice(0, 8), steady: steady.sort((p, q) => q.share - p.share).slice(0, 2), enough: true, from: P[0].from, unit: P };
}

/* ----- ratings: what they follow, what you like beyond reputation, and whether you've grown tougher ----- */
function ratingStudy(B, periods) {
  const rated = B.xs.filter((x) => x.rating);
  const out = { n: rated.length, follow: [], beyond: { up: [], down: [], vsCrowd: false }, judge: [], steady: [], divide: [] };
  if (rated.length < 20) return out;
  const mu = avg(rated.map((x) => x.rating)), SST = rated.reduce((s, x) => s + sq(x.rating - mu), 0);
  if (!SST) return out;
  const C = B.crowd, fmtC = (v) => crowdScore(B.crowdKey in CROWDS ? B.crowdKey : "tmdb", v);

  // How much of the ups and downs in your ratings each thing accounts for: each film's rating guessed from the
  // other films that share it (directors, decade…), never from itself, against guessing your average every time.
  const groupFit = (valsOf, k = 3) => {
    const sum = new Map(), cnt = new Map(), members = new Map();
    for (const x of rated) for (const v of valsOf(x)) { sum.set(v, (sum.get(v) || 0) + x.rating); bump(cnt, v); if (!members.has(v)) members.set(v, []); members.get(v).push(x); }
    let sse = 0;
    for (const x of rated) {
      let p = 0, m = 0;
      for (const v of valsOf(x)) { const n = cnt.get(v) - 1; if (n > 0) { p += (sum.get(v) - x.rating + k * mu) / (n + k); m++; } }
      sse += sq(x.rating - (m ? p / m : mu));
    }
    const values = [...cnt].filter(([, n]) => n >= 2).map(([v, n]) => ({ v, n, avg: sum.get(v) / n, sh: (sum.get(v) + k * mu) / (n + k), xs: members.get(v) })).sort((a, b) => b.sh - a.sh);
    return { r2: 1 - sse / SST, values };
  };
  const withCrowd = rated.filter((x) => x.crowd != null);
  let line = null;
  if (withCrowd.length >= 20) {
    const mx = avg(withCrowd.map((x) => x.crowd)), my = avg(withCrowd.map((x) => x.rating));
    let sxx = 0, sxy = 0;
    for (const x of withCrowd) { sxx += sq(x.crowd - mx); sxy += (x.crowd - mx) * (x.rating - my); }
    if (sxx) { const b = sxy / sxx; line = { a: my - b * mx, b }; }
  }
  const factors = [];
  if (line) {
    let sse = 0;
    for (const x of rated) sse += sq(x.rating - (x.crowd != null ? line.a + line.b * x.crowd : mu));
    factors.push({ id: "crowd", label: `${C.short} score`, short: `the ${C.short} score`, r2: 1 - sse / SST, to: crowdDrill(xsFilms(withCrowd), B.crowdKey, `You against ${C.label}`) });
  }
  const valuesDrill = (title, values) => D.names(title, `${plural(values.length, "kind")} · your average, steadied toward your overall one where there are few films`,
    values.map((x) => { const fs = xsFilms(x.xs); return { name: String(x.v), value: x.sh.toFixed(2), note: `${plural(x.n, "rated film")} · ${x.avg.toFixed(2)} as rated`, films: fs, to: D.films(String(x.v), filmsSub(fs), fs) }; }));
  const defs = [
    ["d", "Who directed it", "who directed it", (x) => x.d],
    ["c", "Who's in it", "who's in it", (x) => x.c],
    ["w", "Who wrote it", "who wrote it", (x) => x.w],
    ["g", "Its genres", "its genres", (x) => x.g],
    ["dec", "Its decade", "its decade", (x) => x.dec ? [`${x.dec}s`] : []],
    ["k", "Where it's from", "where it's from", (x) => x.k.map(placeName)],
    ["l", "Its language", "its language", (x) => x.l ? [x.l] : []],
    ["rt", "Its length", "its length", (x) => x.rt ? [rtBand(x.rt)] : []],
    ["pop", "How well known it is", "how well known it is", (x) => x.popQ != null ? [popBand(x.popQ)] : []],
  ];
  for (const [id, label, short, vals] of defs) {
    const fit = groupFit(vals);
    factors.push({ id, label, short, r2: fit.r2, to: valuesDrill(`${label}, by your rating`, fit.values.slice(0, 100)) });
  }
  // when you saw it: the ratings you gave in the fortnight either side
  {
    const sorted = [...rated].sort((a, b) => a.date.localeCompare(b.date)), days = sorted.map((x) => dayIndex(x.date));
    let sse = 0, lo = 0, hi = 0, sum = 0;
    for (let i = 0; i < sorted.length; i++) {
      while (hi < sorted.length && days[hi] <= days[i] + 14) sum += sorted[hi++].rating;
      while (days[lo] < days[i] - 14) sum -= sorted[lo++].rating;
      const n = hi - lo - 1;
      sse += sq(sorted[i].rating - (sum - sorted[i].rating + 3 * mu) / (n + 3));
    }
    factors.push({ id: "when", label: "When you saw it", short: "when you saw it (the ratings you gave around then)", r2: 1 - sse / SST,
      to: D.films("Rated films, by when you saw them", filmsSub(xsFilms(sorted)), xsFilms(sorted), { sort: "watched" }) });
  }
  out.follow = factors.map((f) => ({ ...f, pct: Math.max(0, Math.round(f.r2 * 100)) })).sort((a, b) => b.r2 - a.r2);
  const dir = out.follow.find((f) => f.id === "d");
  const fl = out.follow.filter((f) => f.pct >= 1 && !(f.id === "w" && dir && Math.abs(f.pct - dir.pct) <= 5));
  if (fl.length) {
    const low = out.follow.find((f) => f.id === "g");
    out.followText = `What tells most about how you'll rate a film is ${fl[0].short}: it accounts for ${fl[0].pct}% of the ups and downs in your ratings` +
      (fl[1] ? `, then ${fl[1].short} (${fl[1].pct}%)${fl[2] ? ` and ${fl[2].short} (${fl[2].pct}%)` : ""}` : "") + "." +
      (low && fl.indexOf(low) > 2 ? ` Its genres account for only ${low.pct}%.` : "");
  }

  // What you like more, or less, than a film's reputation says you should: your rating against the one the crowd's
  // score would predict for you, averaged over the films that share something.
  const base = line ? withCrowd : rated;
  const resid = new Map(base.map((x) => [x, x.rating - (line ? line.a + line.b * x.crowd : mu)]));
  const spread = sdOf([...resid.values()]);
  out.beyond.vsCrowd = !!line;
  const groups = [];
  for (const [fid, fc] of Object.entries(FACETS)) {
    if (fid === "c") continue;
    const m = new Map();
    for (const x of base) for (const v of fc.vals(x)) { if (!m.has(v)) m.set(v, []); m.get(v).push(x); }
    for (const [v, xs] of m) groups.push({ name: fid === "d" ? `Films by ${v}` : fid === "g" ? capFirst(genreNoun(v)) : fid === "dec" ? `Films from the ${v}s` : fid === "l" ? `Films in ${v}` : `Films from ${placeName(v)}`, xs, min: fid === "d" ? 4 : 6, person: fid === "d" });
  }
  const bands = [
    ["Films under 90 minutes", (x) => x.rt && x.rt < 90], ["Films of 2½ hours or more", (x) => x.rt >= 150],
    ["Films seen within a year of release", (x) => x.age != null && x.age <= 1], ["Films 50 or more years old when you saw them", (x) => x.age >= 50],
    [`The most popular films (top fifth by ${B.popSrc} ratings)`, (x) => x.popQ >= 0.8], [`Little-known films (bottom fifth by ${B.popSrc} ratings)`, (x) => x.popQ != null && x.popQ <= 0.2],
    ["Popular new releases", (x) => x.popQ >= 0.8 && x.age != null && x.age <= 2], ["Films by directors new to you", (x) => x.newDir],
  ];
  for (const [name, test] of bands) groups.push({ name, xs: base.filter(test), min: 6 });
  const found = groups.filter((g) => g.xs.length >= g.min && g.xs.length <= base.length * 0.7).map((g) => {
    const rs = g.xs.map((x) => resid.get(x)), mean = avg(rs), z = spread ? mean / (spread / Math.sqrt(rs.length)) : 0;
    return { ...g, mean, sh: rs.reduce((s, r) => s + r, 0) / (rs.length + 5), z };
  }).filter((g) => Math.abs(g.sh) >= 0.2 && Math.abs(g.z) >= 2.5);
  const beyondItem = (g) => {
    const xs = [...g.xs].sort((a, b) => resid.get(b) - resid.get(a)), up = g.mean > 0;
    const text = line ? `${g.name}: you rate them ${Math.abs(g.mean).toFixed(1)}★ ${up ? "higher" : "lower"} than their reputation would predict for you (${plural(xs.length, "film")}).`
      : `${g.name}: you rate them ${Math.abs(g.mean).toFixed(1)}★ ${up ? "above" : "below"} your average (${plural(xs.length, "film")}).`;
    return { name: g.name, big: g.name, text, up, mean: g.mean, to: D.films(g.name, `${plural(xs.length, "film")} · ${signed(g.mean)}★ against ${line ? "what their reputation predicts" : "your average"}`, xsFilms(xs),
      { sort: "given", note: (f) => { const x = B.byFilm.get(f); return line ? `You ${stars(x.rating)} · ${C.short} ${fmtC(x.crowd)} · ${signed(resid.get(x))}★` : `You ${stars(x.rating)}`; } }) };
  };
  // one line per thing: a director who is the whole of a country's films isn't said twice
  const pickBeyond = (list) => {
    const out2 = [];
    for (const g of list) {
      if (g.person && out2.some((o) => o.person)) continue;
      if (out2.some((o) => g.xs.filter((x) => o.xs.includes(x)).length >= 0.7 * g.xs.length)) continue;
      out2.push(g); if (out2.length === 4) break;
    }
    return out2.map(beyondItem);
  };
  out.beyond.up = pickBeyond(found.filter((g) => g.mean > 0).sort((a, b) => b.z - a.z));
  out.beyond.down = pickBeyond(found.filter((g) => g.mean < 0).sort((a, b) => a.z - b.z));

  // Tougher or choosier: your ratings at the time against the crowd's view of the same films, period by period.
  const P = periods.filter((p) => p.F.filter((x) => x.rAt).length >= 6);
  if (P.length >= 4) {
    const pt = (p, f) => { const xs = p.F.filter((x) => x.rAt && f(x) != null); return { x: p.i, w: xs.length, y: xs.length ? avg(xs.map(f)) : null }; };
    const you = fitLine(P.map((p) => pt(p, (x) => x.rAt))), cr = fitLine(P.map((p) => pt(p, (x) => x.crowd != null ? x.crowd : null)));
    const gap = fitLine(P.map((p) => pt(p, (x) => x.crowd != null ? x.rAt - x.crowd : null)));
    const sdFit = fitLine(P.map((p) => { const rs = p.F.filter((x) => x.rAt).map((x) => x.rAt); return { x: p.i, w: rs.length, y: rs.length >= 6 ? sdOf(rs) : null }; }));
    const third = Math.max(1, Math.floor(P.length / 3)), early = P.slice(0, third), late = P.slice(-third);
    const y0 = periodYears(early), y1 = periodYears(late);
    const rows = (ps) => ps.flatMap((p) => p.F.filter((x) => x.rAt));
    const yrs = periodYears;
    const mean = (ps, f) => { const v = rows(ps).map(f).filter((x) => x != null); return v.length ? avg(v) : null; };
    const yA = mean(early, (x) => x.rAt), yB = mean(late, (x) => x.rAt), cA = mean(early, (x) => x.crowd), cB = mean(late, (x) => x.crowd);
    const listOf = (ps) => { const xs = rows(ps).sort((a, b) => b.rAt - a.rAt); return D.films(yrs(ps), `${plural(xs.length, "film")} · ${avg(xs.map((x) => x.rAt)).toFixed(2)} as rated then`, xsFilms(xs),
      { sort: "given", ratingOf: (f) => B.byFilm.get(f).rAt, note: (f) => { const x = B.byFilm.get(f); return x.crowd != null ? `${C.short} ${fmtC(x.crowd)}` : "No crowd score"; } }); };
    const to = D.groups("Your ratings then and now", `${y1} against ${y0}`, [listOf(late), listOf(early)]);
    // (a slightly lower bar than elsewhere: a period's ratings swing with what was watched, which blurs a slow change)
    const sig = (f, a, b, min) => f && a != null && b != null && Math.abs(f.t) >= 2.5 && Math.abs(b - a) >= min && Math.sign(f.b) === Math.sign(b - a);
    const yMoved = sig(you, yA, yB, 0.15), cMoved = sig(cr, cA, cB, 0.1);
    const r = (v) => `${v.toFixed(1)}★`;
    const gA = mean(early, (x) => x.crowd != null ? x.rAt - x.crowd : null), gB = mean(late, (x) => x.crowd != null ? x.rAt - x.crowd : null);
    const gMoved = gA != null && gB != null && sig(gap, gA, gB, 0.12);
    const apart = (g, who = "") => Math.abs(g) < 0.05 ? `level with ${who || "them"}` : `${Math.abs(g).toFixed(1)}★ ${g > 0 ? "above" : "below"}${who ? ` ${who}` : ""}`;
    if (yMoved) {
      const down = yB < yA;
      const films = cMoved && Math.sign(cB - cA) === Math.sign(yB - yA) && !gMoved;
      out.judge.push({ big: films ? (down ? "Less acclaimed picks" : "Choosier") : (down ? "Tougher" : "Kinder"), to,
        text: films ? `Your average rating went from about ${r(yA)} in ${y0} to ${r(yB)} in ${y1}, and the standing of what you choose moved the same way (${C.label}: ${fmtC(cA)} to ${fmtC(cB)}). It's the films that changed, not how hard you judge.`
          : `Your average rating went from about ${r(yA)} in ${y0} to ${r(yB)} in ${y1}${gA != null ? `, more than the films explain: you rated them ${apart(gA, C.label)} in ${y0}, and ${apart(gB)} in ${y1}. You've grown ${down ? "tougher" : "kinder"}` : `: you've grown ${down ? "tougher" : "kinder"}`}.` });
    } else if (gMoved) {
      const tougher = gB < gA;
      out.judge.push({ big: tougher ? "Tougher" : "Kinder", to,
        text: `Next to ${C.label}, you've grown ${tougher ? "tougher" : "kinder"}: you rated films ${apart(gA, "them")} on average in ${y0}, and ${apart(gB)} in ${y1}.` });
    } else if (you && Math.abs(you.t) < 2 && Math.abs(yB - yA) < 0.1) {
      out.judge.push({ big: "Steady", to, text: `Your ratings have held steady since ${y0}, at about ${r(avg(rows(P).map((x) => x.rAt)))} on average${cr && !cMoved ? ", and so has the standing of the films you choose" : ""}.` });
    }
    if (sdFit && Math.abs(sdFit.t) >= STUDY_Z && Math.abs(sdFit.to - sdFit.from) >= 0.15)
      out.judge.push({ big: sdFit.to > sdFit.from ? "Wider range" : "Narrower range", to,
        text: sdFit.to > sdFit.from ? "You use more of the scale than you used to: your ratings spread wider now, with more very high and very low marks." : "Your ratings have narrowed: you give fewer very high and very low marks than you used to." });
  }

  // Directors who never let you down, and the ones who divide you
  const byDir = new Map();
  for (const x of rated) for (const d of x.d) { if (!byDir.has(d)) byDir.set(d, []); byDir.get(d).push(x); }
  const dirs = [...byDir].filter(([, xs]) => xs.length >= 4).map(([name, xs]) => { const rs = xs.map((x) => x.rating); return { name, xs, mean: avg(rs), min: Math.min(...rs), max: Math.max(...rs), sd: sdOf(rs) }; });
  const dTo = (d) => D.films(d.name, filmsSub(xsFilms(d.xs)), xsFilms(d.xs), { person: { key: personKey(d.name), name: d.name, films: xsFilms(d.xs) } });
  out.steady = dirs.filter((d) => d.min >= 3.5 && d.mean >= mu + 0.3).sort((a, b) => b.min - a.min || b.mean - a.mean || b.xs.length - a.xs.length).slice(0, 3)
    .map((d) => ({ name: d.name, text: `${d.name} has never let you down: ${plural(d.xs.length, "film")}, none below ${stars(d.min)}.`, to: dTo(d) }));
  out.divide = dirs.filter((d) => d.max - d.min >= 2.5).sort((a, b) => b.sd - a.sd).slice(0, 3)
    .map((d) => ({ name: d.name, text: `${d.name} divides you: ${plural(d.xs.length, "film")}, from ${stars(d.min)} to ${stars(d.max)}.`, to: dTo(d) }));
  return out;
}

/* ----- threads: how one film led to another ----- */
function threadStudy(B) {
  const xs = B.xs, days = xs.map((x) => dayIndex(x.date));
  const watched = (x) => `Watched ${fmtDate(x.date)}`;
  // gateways: the film that started a run of four or more by one person within 120 days
  const people = new Map();
  const add = (name, role, x) => { const k = `${role}|${personKey(name)}`; if (!people.has(k)) people.set(k, { name, role, xs: [] }); people.get(k).xs.push(x); };
  for (const x of xs) { for (const n of x.d) add(n, "d", x); for (const n of x.c.slice(0, 3)) add(n, "c", x); }
  const runs = [];
  for (const p of people.values()) {
    if (p.xs.length < 4) continue;
    const ds = p.xs.map((x) => dayIndex(x.date));
    let best = null;
    for (let i = 0, j = 0; i < ds.length; i++) { while (j + 1 < ds.length && ds[j + 1] - ds[i] <= 120) j++; if (!best || j - i > best.j - best.i) best = { i, j }; }
    if (best.j - best.i + 1 < 4) continue;
    runs.push({ ...p, run: p.xs.slice(best.i, best.j + 1), before: best.i, days: ds[best.j] - ds[best.i] });
  }
  runs.sort((a, b) => b.run.length - a.run.length || (a.role === "d" ? -1 : 1) - (b.role === "d" ? -1 : 1) || a.days - b.days);
  const gateways = [];
  for (const r of runs) {
    if (gateways.some((g) => r.run.filter((x) => g.run.includes(x)).length >= 0.6 * r.run.length)) continue;
    const opener = r.run[0], more = r.run.length - 1, weeks = Math.max(1, Math.round(r.days / 7));
    const when = weeks <= 2 ? `${plural(r.days + 1, "day")}` : weeks < 9 ? `${weeks} weeks` : `${Math.round(r.days / 30)} months`;
    const text = r.before === 0 ? `${opener.f.name} (${fmtDate(opener.date)}) opened the door to ${r.name}: ${more} more of their films followed within ${when}.`
      : `In ${monthName(opener.date)} you went back to ${r.name} (you'd seen ${r.before === 1 ? "one of their films" : `${r.before} of their films`} before) and watched ${r.run.length} in ${when}, starting with ${opener.f.name}.`;
    gateways.push({ name: r.name, text, run: r.run, films: xsFilms(r.run), date: opener.date,
      to: D.films(r.name, `${r.run.length} films in ${when}${r.before ? ` · ${plural(r.before, "film")} seen before` : ""}`, xsFilms(r.run), { sort: "given", note: (f) => watched(B.byFilm.get(f)), person: { key: personKey(r.name), name: r.name, films: xsFilms(r.run) } }) });
    if (gateways.length === 6) break;
  }
  // chains: one film leading to the next within ten days through someone in both, five films or more
  const ppl = xs.map((x) => { const m = new Map(); for (const n of [...x.d, ...x.c, ...x.w]) m.set(personKey(n), n); return m; });
  const len = xs.map(() => 1), prev = xs.map(() => -1), via = xs.map(() => "");
  for (let i = 0; i < xs.length; i++) {
    for (let j = i - 1; j >= 0 && days[i] - days[j] <= 10; j--) {
      if (len[j] + 1 <= len[i]) continue;
      for (const [k, name] of ppl[i]) if (ppl[j].has(k)) { len[i] = len[j] + 1; prev[i] = j; via[i] = name; break; }
    }
  }
  const used = new Set(), chains = [];
  for (const end of xs.map((_, i) => i).sort((a, b) => len[b] - len[a])) {
    if (len[end] < 5 || chains.length === 3) break;
    const path = [];
    for (let i = end; i >= 0; i = prev[i]) path.unshift(i);
    if (path.some((i) => used.has(i))) continue;
    const vias = [...new Set(path.slice(1).map((i) => via[i]))];
    if (vias.length < 2) continue;
    path.forEach((i) => used.add(i));
    const a = xs[path[0]], z = xs[path[path.length - 1]];
    const viaOf = new Map(path.map((i, n) => [xs[i].f, n ? `via ${via[i]}` : "Where it started"]));
    chains.push({ films: path.map((i) => xs[i].f), date: a.date,
      text: `${dateSpan(a.date, z.date)}: one film led to the next ${path.length - 1} times in a row, through ${joinAnd(vias.slice(0, 3))}${vias.length > 3 ? " and others" : ""}, from ${a.f.name} to ${z.f.name}.`,
      to: D.films("One film to the next", `${dateSpan(a.date, z.date)} · ${plural(path.length, "film")}`, path.map((i) => xs[i].f), { sort: "given", note: (f) => `${viaOf.get(f)} · ${fmtDate(B.byFilm.get(f).date)}` }) });
  }
  // the directors you keep coming back to, year after year
  const loyal = [...people.values()].filter((p) => p.role === "d").map((p) => ({ ...p, years: [...new Set(p.xs.map((x) => x.date.slice(0, 4)))].sort() }))
    .filter((p) => p.years.length >= 4).sort((a, b) => b.years.length - a.years.length || b.xs.length - a.xs.length).slice(0, 3)
    .map((p) => ({ name: p.name, text: `You keep coming back to ${p.name}: ${plural(p.xs.length, "film")} across ${p.years.length} different years (${p.years[0]} to ${p.years[p.years.length - 1]}).`,
      to: D.films(p.name, `${plural(p.xs.length, "film")} · ${p.years.join(", ")}`, xsFilms(p.xs), { sort: "given", note: (f) => watched(B.byFilm.get(f)), person: { key: personKey(p.name), name: p.name, films: xsFilms(p.xs) } }) }));
  return { gateways, chains, loyal };
}

/* ----- habits, and what they say ----- */
function habitStudy(B) {
  const out = [], E = B.E, xs = B.xs, fmtC = (v) => crowdScore(B.crowdKey in CROWDS ? B.crowdKey : "tmdb", v);
  if (E.length < 20) return out;
  const isWe = (d) => weekdayOf(d) >= 5;
  const ents = (title, es, o) => D.entries(title, entriesSub(es), es, o);
  const fl = (title, list, o) => D.films(title, filmsSub(xsFilms(list)), xsFilms(list), o);

  // weekends against weekdays: what changes in what you pick
  {
    const we = xs.filter((x) => isWe(x.date)), wd = xs.filter((x) => !isWe(x.date));
    const tests = [
      { big: "Longer at weekends", val: (x) => x.rt, min: 8, say: (a, b) => `At weekends you go for longer films: ${Math.round(a)} minutes on average, against ${Math.round(b)} on weekdays.`, sort: "runtime", note: (x) => `${x.rt} min` },
      { big: "Older at weekends", val: (x) => x.age, min: 5, say: (a, b) => `At weekends you reach further back: the films are ${ageWord(a)} on average when you see them, against ${ageWord(b)} on weekdays.`, sort: "old", note: (x) => ageWord(x.age) },
      { big: "Kinder at weekends", val: (x) => x.rAt, min: 0.15, say: (a, b) => `You rate weekend films ${Math.abs(a - b).toFixed(1)}★ ${a > b ? "higher" : "lower"} than weekday ones (${a.toFixed(2)} against ${b.toFixed(2)}).`, note: (x) => `You ${stars(x.rAt)}` },
    ];
    for (const t of tests) {
      const a = we.filter((x) => t.val(x) != null), b = wd.filter((x) => t.val(x) != null);
      const va = a.map(t.val), vb = b.map(t.val), z = zMeans(va, vb), d = avg(va) - avg(vb);
      if (Math.abs(z) < STUDY_Z || Math.abs(d) < t.min) continue;
      const big = d < 0 ? t.big.replace("Longer", "Shorter").replace("Older", "Newer").replace("Kinder", "Tougher") : t.big;
      out.push({ big, z: Math.abs(z), text: t.say(avg(va), avg(vb)), to: D.groups(big, "Weekends against weekdays",
        [fl("Weekends", a, { sort: t.sort || "rating", note: (f) => t.note(B.byFilm.get(f)) }), fl("Weekdays", b, { sort: t.sort || "rating", note: (f) => t.note(B.byFilm.get(f)) })]) });
    }
  }
  // seasons: a genre that belongs to one month, year after year
  {
    const withM = xs.filter((x) => x.m), years = (list) => [...new Set(list.map((x) => x.date.slice(0, 4)))].sort();
    const all = new Map(); for (const x of withM) for (const g of x.g) bump(all, g);
    const cands = [];
    for (let mo = 0; mo < 12; mo++) {
      const inM = withM.filter((x) => +x.date.slice(5, 7) - 1 === mo), restN = withM.length - inM.length;
      if (inM.length < 10 || restN < 10) continue;
      const gs = new Map(); for (const x of inM) for (const g of x.g) bump(gs, g);
      for (const [g, k] of gs) {
        const p0 = (all.get(g) - k) / restN, share = k / inM.length, z = zShare(k, inM.length, Math.max(p0, 0.5 / restN));
        if (k < 6 || z < STUDY_Z + 0.5 || share < 1.8 * p0 || share - p0 < 0.1) continue;
        const hits = inM.filter((x) => x.g.includes(g)), ys = years(inM), hy = ys.filter((y) => { const l = inM.filter((x) => x.date.startsWith(y)); return l.length && l.filter((x) => x.g.includes(g)).length / l.length > p0 * 1.5; });
        if (hy.length < 2 || hy.length < ys.length / 2) continue;
        cands.push({ mo, g, z, share, p0, hits, hy, ys });
      }
    }
    for (const c of cands.sort((a, b) => b.z - a.z).filter((c, i, a) => a.findIndex((o) => o.mo === c.mo) === i).slice(0, 2)) {
      const M = MONTHS_LONG[c.mo];
      out.push({ big: `${M} is for ${genreNoun(c.g)}`, z: c.z, season: { g: c.g, mo: c.mo }, text: `${M} is ${c.g.toLowerCase()} month: ${pc(c.share)}% of the films you see for the first time in ${M} are ${genreNoun(c.g)}, against ${pc(c.p0)}% the rest of the year (${c.hy.length === c.ys.length ? `every year since ${c.ys[0]}` : joinAnd(c.hy)}).`,
        to: D.groups(`${capFirst(genreNoun(c.g))} in ${M}`, joinAnd(c.hy), c.hy.slice().reverse().map((y) => { const l = c.hits.filter((x) => x.date.startsWith(y)); return l.length && fl(`${M} ${y}`, l); })) });
    }
  }
  // the month you rewatch most
  {
    const rw = E.filter((e) => e.rewatch);
    if (rw.length >= 10) {
      let best = null;
      for (let mo = 0; mo < 12; mo++) {
        const inM = E.filter((e) => +e.date.slice(5, 7) - 1 === mo), k = inM.filter((e) => e.rewatch).length, n = inM.length;
        const z = zProps(k, n, rw.length - k, E.length - n);
        if (n >= 15 && z >= STUDY_Z && k / n - (rw.length - k) / (E.length - n) >= 0.06 && (!best || z > best.z)) best = { mo, k, n, z, inM };
      }
      if (best) { const M = MONTHS_LONG[best.mo], rest = (rw.length - best.k) / (E.length - best.n);
        out.push({ big: `${M} is for rewatching`, z: best.z, text: `${M} is when you go back to old favourites: ${pc(best.k / best.n)}% of ${M}'s diary is rewatches, against ${pc(rest)}% the rest of the year.`,
          to: ents(`Rewatches in ${M}`, best.inM.filter((e) => e.rewatch)) }); }
    }
  }
  // coming back after a break of two weeks or more
  {
    const dates = [...new Set(E.map((e) => e.date))];
    const backs = [];
    for (let i = 1; i < dates.length; i++) { const gap = dayIndex(dates[i]) - dayIndex(dates[i - 1]); if (gap >= 15) backs.push({ date: dates[i], gap: gap - 1 }); }
    const firstBack = new Set(backs.map((b) => b.date));
    const after = E.filter((e) => firstBack.has(e.date)), others = E.filter((e) => !firstBack.has(e.date));
    const k1 = after.filter((e) => e.rewatch).length, k2 = others.filter((e) => e.rewatch).length;
    const z = zProps(k1, after.length, k2, others.length);
    if (backs.length >= 4 && z >= 2.5 && k1 / after.length - k2 / others.length >= 0.1) {
      const gapOf = new Map(backs.map((b) => [b.date, b.gap]));
      out.push({ big: "Comfort after a break", z, text: `After a break of two weeks or more (${plural(backs.length, "time")}), you come back with a rewatch ${pc(k1 / after.length)}% of the time, against ${pc(k2 / others.length)}% otherwise.`,
        to: ents("Back after a break", after, { order: "asc", note: (e) => `After ${plural(gapOf.get(e.date), "day")} off` }) });
    }
  }
  // busy months against quiet ones: what changes when you watch a lot
  {
    const months = new Map();
    for (const x of xs) { const k = x.date.slice(0, 7); if (!months.has(k)) months.set(k, []); months.get(k).push(x); }
    const ms = [...months.values()].filter((l) => l.length >= 3).sort((a, b) => b.length - a.length);
    if (ms.length >= 16) {
      const q = Math.floor(ms.length / 4), busy = ms.slice(0, q).flat(), quiet = ms.slice(-q).flat();
      const tests = [
        { val: (x) => x.rt, min: 8, word: (d) => d < 0 ? "shorter" : "longer", say: (a, b) => `${Math.round(a)} minutes on average in your busiest months, ${Math.round(b)} in your quietest`, sort: "runtime", note: (x) => `${x.rt} min` },
        { val: (x) => x.age, min: 5, word: (d) => d < 0 ? "newer" : "older", say: (a, b) => `${ageWord(a)} on average when you saw them in your busiest months, ${ageWord(b)} in your quietest`, sort: "old", note: (x) => ageWord(x.age) },
        { val: (x) => x.crowd, min: 0.15, word: (d) => d < 0 ? "less acclaimed" : "better regarded", say: (a, b) => `${B.crowd.label} give them ${fmtC(a)} on average in your busiest months, ${fmtC(b)} in your quietest`, note: (x) => `${B.crowd.short} ${fmtC(x.crowd)}` },
      ];
      let best = null;
      for (const t of tests) {
        const va = busy.filter((x) => t.val(x) != null).map(t.val), vb = quiet.filter((x) => t.val(x) != null).map(t.val), z = zMeans(va, vb), d = avg(va) - avg(vb);
        if (Math.abs(z) >= STUDY_Z && Math.abs(d) >= t.min && (!best || Math.abs(z) > best.z)) best = { t, z: Math.abs(z), d, a: avg(va), b: avg(vb) };
      }
      if (best) out.push({ big: `Busy means ${best.t.word(best.d)}`, z: best.z, text: `The more you watch, the ${best.t.word(best.d)} the films: ${best.t.say(best.a, best.b)}.`,
        to: D.groups(`Busy months, ${best.t.word(best.d)} films`, `Your busiest ${plural(q, "month")} against your quietest`,
          [fl("Busiest months", busy, { sort: best.t.sort || "rating", note: (f) => best.t.note(B.byFilm.get(f)) }), fl("Quietest months", quiet, { sort: best.t.sort || "rating", note: (f) => best.t.note(B.byFilm.get(f)) })]) });
    }
  }
  // marathon days: do you rate differently when you watch three or more in a day?
  {
    const perDay = new Map(); for (const e of E) bump(perDay, e.date);
    const rated = xs.filter((x) => x.rAt), many = rated.filter((x) => perDay.get(x.date) >= 3), one = rated.filter((x) => perDay.get(x.date) === 1);
    const z = zMeans(many.map((x) => x.rAt), one.map((x) => x.rAt)), d = avg(many.map((x) => x.rAt)) - avg(one.map((x) => x.rAt));
    if (many.length >= 10 && Math.abs(z) >= 2.5 && Math.abs(d) >= 0.2)
      out.push({ big: d < 0 ? "Marathons rate lower" : "Marathons rate higher", z: Math.abs(z), text: `On days you watch three or more, you rate the films ${Math.abs(d).toFixed(1)}★ ${d < 0 ? "lower" : "higher"} than on days you watch just one (${avg(many.map((x) => x.rAt)).toFixed(2)} against ${avg(one.map((x) => x.rAt)).toFixed(2)}).`,
        to: D.groups("Marathon days against single-film days", "Ratings given at the time", [fl("Days with three or more", many, { ratingOf: (f) => B.byFilm.get(f).rAt }), fl("Days with one", one, { ratingOf: (f) => B.byFilm.get(f).rAt })]) });
  }
  // logging and rating: how the way you keep the diary has changed
  {
    const third = Math.floor(E.length / 3);
    if (third >= 30) {
      const early = E.slice(0, third), late = E.slice(-third), yrs = (es) => { const a = es[0].date.slice(0, 4), b = es[es.length - 1].date.slice(0, 4); return a === b ? a : `${a}–${b.slice(2)}`; };
      const share = (es, f) => { const l = es.filter((e) => f(e) != null); return { k: l.filter(f).length, n: l.length, l }; };
      const same = (e) => e.logged ? e.logged === e.date : null, rated = (e) => !!e.rating;
      for (const [f, big, say] of [[same, "Logging", (a, b) => `You log ${b > a ? "faster" : "later"} than you used to: ${pc(b)}% of films on the day you watched them in ${yrs(late)}, against ${pc(a)}% in ${yrs(early)}.`],
        [rated, "Rating", (a, b) => `You rate ${b > a ? "more" : "fewer"} of the films you log: ${pc(b)}% in ${yrs(late)}, against ${pc(a)}% in ${yrs(early)}.`]]) {
        const A = share(early, f), Z = share(late, f), z = zProps(Z.k, Z.n, A.k, A.n);
        if (A.n >= 30 && Z.n >= 30 && Math.abs(z) >= STUDY_Z && Math.abs(Z.k / Z.n - A.k / A.n) >= 0.1)
          out.push({ big, z: Math.abs(z), text: say(A.k / A.n, Z.k / Z.n), to: D.groups(big, `${yrs(late)} against ${yrs(early)}`, [ents(yrs(late), Z.l), ents(yrs(early), A.l)]) });
      }
    }
  }
  // rewatches: do your ratings hold up on a second look?
  {
    const pairs = [];
    for (const f of new Set(E.filter((e) => e.rewatch && e.rating).map((e) => e.film))) {
      const es = f.entries.filter((e) => e.rating).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
      for (let i = 1; i < es.length; i++) if (es[i].rewatch) pairs.push({ e: es[i], was: es[i - 1].rating, now: es[i].rating });
    }
    if (pairs.length >= 8) {
      const up = pairs.filter((p) => p.now > p.was), down = pairs.filter((p) => p.now < p.was), same = pairs.length - up.length - down.length;
      const to = D.groups("Ratings on a second look", plural(pairs.length, "rewatch", "rewatches"), [
        up.length && D.entries("Rated higher", entriesSub(up.map((p) => p.e)), up.map((p) => p.e), { note: (e) => { const p = pairs.find((q) => q.e === e); return `${stars(p.was)} before, ${stars(p.now)} now`; } }),
        down.length && D.entries("Rated lower", entriesSub(down.map((p) => p.e)), down.map((p) => p.e), { note: (e) => { const p = pairs.find((q) => q.e === e); return `${stars(p.was)} before, ${stars(p.now)} now`; } })]);
      out.push({ big: "Second looks", z: 2, to: up.length + down.length ? to : D.entries("Rewatches you rated", entriesSub(pairs.map((p) => p.e)), pairs.map((p) => p.e)), text: same === pairs.length ? `When you rewatch a film you'd rated, you give it the same rating every time (${plural(pairs.length, "rewatch", "rewatches")}).` : `When you rewatch a film you'd rated, your rating holds ${pc(same / pairs.length)}% of the time` +
        (up.length + down.length ? `; when it moves, it goes ${up.length >= down.length ? `up ${up.length} times for every ${Math.max(1, down.length)} down` : `down ${down.length} times for every ${Math.max(1, up.length)} up`}.` : ".") });
    }
  }
  return out.sort((a, b) => b.z - a.z);
}

/* ----- against the crowd ----- */
// Films you rated against a crowd's score: how far apart, how closely you follow them, where you part ways most.
function crowdStudy(B, films, ratingOf = (f) => f.rating) {
  const C = B.crowd, key = B.crowdKey in CROWDS ? B.crowdKey : "tmdb", rated = films.filter((f) => ratingOf(f));
  const pairs = rated.map((f) => { const s = C.score(metaOf(f), f); return s ? { f, you: ratingOf(f), crowd: s / 2, diff: ratingOf(f) - s / 2 } : null; }).filter(Boolean);
  const out = { key, label: C.label, short: C.short, n: pairs.length, available: {}, to: crowdDrill(rated, key, `You against ${C.label}`, ratingOf), higher: [], lower: [], gems: [] };
  for (const k of Object.keys(CROWDS)) out.available[k] = rated.filter((f) => CROWDS[k].score(metaOf(f), f)).length;
  if (pairs.length >= 3) {
    out.r = pairs.length >= 5 ? pearson(pairs.map((p) => p.you), pairs.map((p) => p.crowd)) : null;
    out.meanDiff = avg(pairs.map((p) => p.diff));
    out.higher = pairs.filter((p) => p.diff >= 0.75).sort((a, b) => b.diff - a.diff || b.you - a.you).slice(0, 12);
    out.lower = pairs.filter((p) => p.diff <= -0.75).sort((a, b) => a.diff - b.diff || a.you - b.you).slice(0, 12);
  }
  const popularity = (f) => { const x = LBX[f.key], m = metaOf(f); return x && x.n ? { n: x.n, src: "Letterboxd" } : m && m.iv ? { n: m.iv, src: "IMDb" } : m && m.vc ? { n: m.vc, src: "TMDB" } : null; };
  out.gems = rated.filter((f) => ratingOf(f) >= 4.5).map((f) => ({ f, pop: popularity(f) }))
    .filter((x) => x.pop && x.pop.n < { Letterboxd: 5000, IMDb: 25000, TMDB: 1000 }[x.pop.src]).sort((a, b) => ratingOf(b.f) - ratingOf(a.f) || a.pop.n - b.pop.n).slice(0, 12);
  return out;
}

/* ----- pieces both layouts draw ----- */
// A drift's periods as columns. Shares start from zero; typical values (age, length…) from a little under the
// lowest, so a change shows, and then the chart has no gridline to misread.
function driftCols(d) {
  const vs = d.series.filter((c) => c.v != null).map((c) => c.v), lo = Math.min(...vs), hi = Math.max(...vs);
  const floor = d.kind === "share" || !vs.length ? 0 : Math.max(0, lo - (hi - lo) * 0.35 - 1e-6);
  return { grid: !floor, cols: d.series.map((c) => ({ a: c.v == null ? 0 : Math.max(0.0001, c.v - floor), b: 0, label: c.label, minor: c.minor, tip: c.tip, to: c.to })) };
}
// Where each chapter falls between the diary's first and last day, as shares of the whole.
function chapterStrip(chs, from, to) {
  const a = dayIndex(from), span = Math.max(1, dayIndex(to) - a + 1);
  const years = [];
  for (let y = +from.slice(0, 4) + 1; y <= +to.slice(0, 4); y++) years.push({ y, at: (dayIndex(`${y}-01-01`) - a) / span });
  return { years, items: chs.map((c) => ({ c, left: Math.max(0, (dayIndex(c.from) - a) / span), width: Math.max(0.006, (dayIndex(c.until) - dayIndex(c.from) + 1) / span) })) };
}

/* ----- the whole study ----- */
// A chapter that's only a seasonal habit (horror every October) is said once, as the habit.
const notSeasonal = (list, habits) => list.filter((c) => !habits.some((h) => h.season && c.top.fid === "g" && c.top.v === h.season.g &&
  dayIndex(c.until) - dayIndex(c.from) < 100 && [c.from, c.until].some((d) => +d.slice(5, 7) - 1 === h.season.mo)));
function computeStudy(lib, metaOf, crowdKey) {
  const B = studyBase(lib, metaOf, crowdKey);
  const unit = pickUnit(B.xs), periods = studyPeriods(B, unit);
  const S = { B, unit, periods, n: { films: B.xs.length, entries: B.E.length, from: B.E.length ? B.E[0].date : null, to: B.E.length ? B.E[B.E.length - 1].date : null } };
  S.chapters = chapters(B, periods);
  S.drift = drifts(B, periods);
  S.ratings = ratingStudy(B, periods);
  S.threads = threadStudy(B);
  S.habits = habitStudy(B);
  S.chapters = notSeasonal(S.chapters, S.habits);
  S.crowd = crowdStudy(B, [...new Set(B.E.map((e) => e.film))]);
  // the short version: the strongest finding of each kind
  const o = [], R = S.ratings, T = S.threads;
  if (S.chapters.length) { const c = S.chapters[S.chapters.length - 1]; o.push({ k: S.chapters.length > 1 ? `Latest of ${S.chapters.length} chapters` : "A chapter", big: c.title, text: c.text, to: c.to }); }
  if (S.drift.list.length) { const d = S.drift.list[0]; o.push({ k: "Biggest shift", big: d.big, text: d.text, to: d.to }); }
  if (R.follow.length && R.follow[0].pct >= 3) o.push({ k: "Your ratings follow", big: capFirst(R.follow[0].short.replace(/ \(.*\)$/, "")), text: R.followText, to: R.follow[0].to });
  if (R.beyond.up.length) { const b = R.beyond.up[0]; o.push({ k: R.beyond.vsCrowd ? "You like more than the crowd" : "You like most", big: b.big, text: b.text, to: b.to }); }
  if (R.judge.length && R.judge[0].big !== "Steady") o.push({ k: "Tougher or choosier?", big: R.judge[0].big, text: R.judge[0].text, to: R.judge[0].to });
  if (T.gateways.length) { const g = T.gateways[0]; o.push({ k: "A door that opened", big: g.name, text: g.text, to: g.to }); }
  if (S.habits.length) { const h = S.habits[0]; o.push({ k: "A habit", big: h.big, text: h.text, to: h.to }); }
  S.overview = o;
  return S;
}

/* ----- one year, against the rest of the diary ----- */
// `S` is the whole diary's study when it's worked out already.
function computeYearStudy(lib, metaOf, crowdKey, Y, S = computeStudy(lib, metaOf, crowdKey)) {
  const B = S.B;
  const xsY = B.xs.filter((x) => x.date.startsWith(Y)), xsO = B.xs.filter((x) => !x.date.startsWith(Y));
  const EY = B.E.filter((e) => e.date.startsWith(Y)), EO = B.E.filter((e) => !e.date.startsWith(Y));
  const R = { Y, B, n: { films: xsY.length, entries: EY.length }, first: B.E.length && B.E[0].date.startsWith(Y) };
  const fl = (title, list, o) => D.films(title, filmsSub(xsFilms(list)), xsFilms(list), o);
  const other = "in your other years", fmtC = (v) => crowdScore(B.crowdKey in CROWDS ? B.crowdKey : "tmdb", v);
  // what set the year apart: what it was made of, then how its films differed
  const sts = [];
  for (const s of standouts(xsY, B)) { if (sts.length === 4) break; if (!sts.some((o) => s.xs.filter((x) => o.xs.includes(x)).length >= 0.8 * Math.min(s.xs.length, o.xs.length))) sts.push(s); }
  R.differ = sts.map((s) => {
    const also = s.xs;
    return { big: capFirst(FACETS[s.fid].were(s.v)), text: `${pc(s.share)}% of the films you saw for the first time in ${Y} were ${FACETS[s.fid].were(s.v)}, against ${pc(s.p0)}% ${other}.`,
      posters: xsFilms(bestFirst(also).slice(0, 6)), to: fl(`${capFirst(FACETS[s.fid].were(s.v))}, ${Y}`, also) };
  });
  if (EO.length >= 20 && xsY.length >= 10) {
    const tests = [
      { big: "Older films", big2: "Newer films", val: (x) => x.age, min: 5, say: (a, b) => `${Y}'s films were ${a > b ? "older" : "newer"} than usual: ${ageWord(a)} on average when you saw them, against ${ageWord(b)} ${other}.`, sort: "old", note: (x) => ageWord(x.age) },
      { big: "Longer films", big2: "Shorter films", val: (x) => x.rt, min: 8, say: (a, b) => `You watched ${a > b ? "longer" : "shorter"} films in ${Y}: ${Math.round(a)} minutes on average, against ${Math.round(b)} ${other}.`, sort: "runtime", note: (x) => `${x.rt} min` },
      { big: "Better-regarded films", big2: "Less acclaimed films", val: (x) => x.crowd, min: 0.15, say: (a, b) => `You chose ${a > b ? "better-regarded" : "less acclaimed"} films in ${Y}: ${B.crowd.label} give them ${fmtC(a)} on average, against ${fmtC(b)} ${other}.`, note: (x) => `${B.crowd.short} ${fmtC(x.crowd)}` },
    ];
    for (const t of tests) {
      const a = xsY.filter((x) => t.val(x) != null), b = xsO.filter((x) => t.val(x) != null);
      const va = a.map(t.val), vb = b.map(t.val), z = zMeans(va, vb), d = avg(va) - avg(vb);
      if (Math.abs(z) >= STUDY_Z && Math.abs(d) >= t.min) R.differ.push({ big: d > 0 ? t.big : t.big2, text: t.say(avg(va), avg(vb)), posters: [], to: D.groups(d > 0 ? t.big : t.big2, `${Y} against ${other}`, [fl(Y, a, { sort: t.sort || "rating", note: (f) => t.note(B.byFilm.get(f)) }), fl("Other years", b, { sort: t.sort || "rating", note: (f) => t.note(B.byFilm.get(f)) })]) });
    }
    const props = [
      [["More world cinema", "More in English"], "Not in English", (x) => x.l ? x.l !== "English" : null, (a, b) => `${pc(a)}% of ${Y}'s new films weren't in English, against ${pc(b)}% ${other}.`],
      [["More new releases", "Fewer new releases"], "New releases", (x) => x.age != null ? x.age <= 1 : null, (a, b) => `${pc(a)}% of what you saw in ${Y} was a new release, against ${pc(b)}% ${other}.`],
      [["Exploring", "Old favourites"], "New directors", (x) => x.d.length ? x.newDir : null, (a, b) => `${pc(a)}% of ${Y}'s new films were by directors you'd never seen before, against ${pc(b)}% ${other}.`],
    ];
    for (const [bigs, big, f, say] of props) {
      const a = xsY.filter((x) => f(x) != null), b = xsO.filter((x) => f(x) != null), ka = a.filter(f).length, kb = b.filter(f).length;
      const z = zProps(ka, a.length, kb, b.length);
      if (a.length >= 10 && Math.abs(z) >= STUDY_Z && Math.abs(ka / a.length - kb / b.length) >= 0.08)
        R.differ.push({ big: bigs[z > 0 ? 0 : 1], text: say(ka / a.length, kb / b.length), posters: [], to: fl(`${big}, ${Y}`, a.filter(f)) });
    }
  }
  // the year's own chapters, month by month
  R.chapters = notSeasonal(chapters(B, studyPeriods(B, "month", Y), 6, STUDY_Z + 1.5, 4), S.habits);
  // ratings: the year against your usual, with the crowd's view of the same films
  {
    const ry = xsY.filter((x) => x.rAt), ro = xsO.filter((x) => x.rAt), out = [];
    if (ry.length >= 10 && ro.length >= 20) {
      const a = avg(ry.map((x) => x.rAt)), b = avg(ro.map((x) => x.rAt)), z = zMeans(ry.map((x) => x.rAt), ro.map((x) => x.rAt));
      const cy = ry.filter((x) => x.crowd != null), co = ro.filter((x) => x.crowd != null);
      const gapY = cy.length >= 8 ? avg(cy.map((x) => x.rAt - x.crowd)) : null, gapO = co.length >= 8 ? avg(co.map((x) => x.rAt - x.crowd)) : null;
      const zg = gapY != null && gapO != null ? zMeans(cy.map((x) => x.rAt - x.crowd), co.map((x) => x.rAt - x.crowd)) : 0;
      const to = D.groups(`Ratings in ${Y}`, `Against ${other}`, [fl(Y, ry, { ratingOf: (f) => B.byFilm.get(f).rAt }), fl("Other years", ro, { ratingOf: (f) => B.byFilm.get(f).rAt })]);
      const moved = Math.abs(z) >= 2.5 && Math.abs(a - b) >= 0.15, harder = Math.abs(zg) >= 2.5 && Math.abs(gapY - gapO) >= 0.15;
      if (moved || harder) {
        const dir = a > b ? "higher" : "lower";
        out.push({ big: harder ? (gapY < gapO ? "Tougher" : "Kinder") : (a > b ? "Better films" : "Weaker films"), to,
          text: `You rated ${Y}'s films ${Math.abs(a - b).toFixed(1)}★ ${dir} than usual (${a.toFixed(2)} against ${b.toFixed(2)}).` + (gapY == null ? ""
            : harder ? ` Next to ${B.crowd.label}, you were ${gapY < gapO ? "tougher" : "kinder"} than usual too: it was you, not just the films.`
            : ` But ${B.crowd.label} rate them ${dir} too: it was the films, not you.`) });
      } else out.push({ big: "As usual", to, text: `You rated ${Y}'s films much as you always do: ${a.toFixed(2)} on average, against ${b.toFixed(2)} ${other}.` });
    }
    R.ratings = out;
  }
  // threads that began in the year
  const T = S.threads;
  R.threads = { gateways: T.gateways.filter((g) => g.date.startsWith(Y)), chains: T.chains.filter((c) => c.date.startsWith(Y)) };
  // habits: the year against your usual
  {
    const out = [], ents = (title, es, o) => D.entries(title, entriesSub(es), es, o);
    if (EY.length >= 15 && EO.length >= 30) {
      const pairs = [
        ["Weekends", (e) => weekdayOf(e.date) >= 5, (a, b) => `${pc(a)}% of ${Y}'s diary fell on a weekend, against ${pc(b)}% ${other}.`],
        ["Rewatches", (e) => e.rewatch, (a, b) => `${pc(a)}% of ${Y}'s diary was rewatches, against ${pc(b)}% ${other}.`],
        ["Same-day logging", (e) => e.logged ? e.logged === e.date : null, (a, b) => `You logged ${pc(a)}% of ${Y}'s films the day you watched them, against ${pc(b)}% ${other}.`],
      ];
      for (const [big, f, say] of pairs) {
        const a = EY.filter((e) => f(e) != null), b = EO.filter((e) => f(e) != null), ka = a.filter(f).length, kb = b.filter(f).length, z = zProps(ka, a.length, kb, b.length);
        if (a.length >= 15 && Math.abs(z) >= 2.5 && Math.abs(ka / a.length - kb / b.length) >= 0.08) out.push({ big, text: say(ka / a.length, kb / b.length), to: ents(`${big}, ${Y}`, a.filter(f)) });
      }
      const perDay = new Map(); for (const e of B.E) bump(perDay, e.date);
      const mdY = [...perDay].filter(([d, n]) => d.startsWith(Y) && n >= 3), daysY = [...perDay.keys()].filter((d) => d.startsWith(Y)).length;
      const mdO = [...perDay].filter(([d, n]) => !d.startsWith(Y) && n >= 3), daysO = perDay.size - daysY;
      const zm = zProps(mdY.length, daysY, mdO.length, daysO);
      if (mdY.length >= 3 && Math.abs(zm) >= 2.5) { const es = EY.filter((e) => perDay.get(e.date) >= 3);
        out.push({ big: "Marathon days", text: `${plural(mdY.length, "day")} in ${Y} had three or more films: ${pc(mdY.length / daysY)}% of the days you watched anything, against ${pc(mdO.length / Math.max(1, daysO))}% ${other}.`, to: ents(`Marathon days, ${Y}`, es, { order: "asc" }) }); }
    }
    // the longest gap in the year
    const dates = [...new Set(EY.map((e) => e.date))];
    let gap = null;
    for (let i = 1; i < dates.length; i++) { const g = dayIndex(dates[i]) - dayIndex(dates[i - 1]) - 1; if (g >= 14 && (!gap || g > gap.g)) gap = { g, a: dates[i - 1], b: dates[i] }; }
    if (gap) { const es = EY.filter((e) => e.date === gap.a || e.date === gap.b);
      out.push({ big: "Longest break", text: `Your longest break in ${Y} ran ${plural(gap.g, "day")}, from ${fmtDate(isoOfDay(dayIndex(gap.a) + 1))} to ${fmtDate(isoOfDay(dayIndex(gap.b) - 1))}.`, to: ents("Either side of the break", es, { order: "asc" }) }); }
    R.habits = out;
  }
  // discovery: places and languages that first turned up in the year
  {
    const firstYear = (pick) => { const m = new Map(); for (const x of B.xs) for (const v of pick(x)) if (!m.has(v)) m.set(v, x.date.slice(0, 4)); return m; };
    const newIn = (m) => [...m].filter(([, y]) => y === Y).map(([v]) => v);
    R.newCountries = R.first ? [] : newIn(firstYear((x) => x.k));
    R.newLangs = R.first ? [] : newIn(firstYear((x) => x.l ? [x.l] : []));
  }
  R.crowd = crowdStudy(B, [...new Set(EY.map((e) => e.film))], (f) => { const es = EY.filter((e) => e.film === f && e.rating); return es.length ? es[es.length - 1].rating : f.rating; });
  // the short version
  const o = [];
  if (R.differ.length) o.push({ k: "What set it apart", big: R.differ[0].big, text: R.differ[0].text, to: R.differ[0].to });
  if (R.chapters.length) { const c = R.chapters[0]; o.push({ k: R.chapters.length > 1 ? `${R.chapters.length} chapters` : "A chapter", big: c.title, text: c.text, to: c.to }); }
  if (R.ratings.length && R.ratings[0].big !== "As usual") o.push({ k: "Your ratings", big: R.ratings[0].big, text: R.ratings[0].text, to: R.ratings[0].to });
  if (R.threads.gateways.length) { const g = R.threads.gateways[0]; o.push({ k: "A door that opened", big: g.name, text: g.text, to: g.to }); }
  if (R.habits.length) { const h = R.habits[0]; o.push({ k: "Habits", big: h.big, text: h.text, to: h.to }); }
  R.overview = o;
  return R;
}
</script>
