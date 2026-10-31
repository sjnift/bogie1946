<script>
/* ---------- the quiz (asked 31 Oct 2026: "an interactive quiz on the website and app for the user, derived from their
   watching habits and diary data") ----------
   Ten questions a round, each made from the diary by one of QUIZ_KINDS (each kind at most once a round, in a random
   order), always with four answers (asked 31 Oct 2026), exactly one right: every kind picks its answers so that no two
   tie on what's asked. The numbers come from `computeStats`, as on the Stats page, so the quiz never counts anything
   differently. Like the story it opens in the pop-up (computer) or the sheet (phone), so Back and Close work; it follows
   the year chips (a year's quiz asks about that year), always on the whole diary, whatever filters are on. After each
   answer: right or not, why (the real numbers), and the films behind it. The `quiz` check plays rounds on both layouts
   and proves every question has one right answer among distinct ones. */
D.quiz = (Y) => ({ kind: "quiz", year: Y, title: Y === "all" ? "Your diary quiz" : `Your ${Y} quiz`, sub: `How well do you know ${Y === "all" ? "your diary" : `your ${Y}`}?` });
const QUIZ_N = 10;
const qPick = (arr, n) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const qOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const qFilm = (f, sub) => ({ label: f.name, sub: sub != null ? sub : f.year || "", film: f });
// a question: its answers shuffled, the right one remembered
function qMake(q, opts, right, why, to) {
  const order = qPick(opts.map((_, i) => i), opts.length);
  return { q, opts: order.map((i) => opts[i]), ans: order.indexOf(right), why, to };
}
// the right answer has the highest (or lowest) value of the four, and alone: the other three are all below (above) it
function qExtreme(q, items, val, show, why, high = true, to) {
  const ok = items.filter((x) => val(x) != null && Number.isFinite(val(x)));
  const beats = (a, b) => high ? val(a) > val(b) : val(a) < val(b);
  const can = ok.filter((x) => ok.filter((y) => beats(x, y)).length >= 3);
  if (!can.length) return null;
  const best = qOne(can), four = [best, ...qPick(ok.filter((y) => beats(best, y)), 3)];
  return qMake(q, four.map(show), 0, why(best, four), to && to(best, four));
}
// numbers near the right one, all different
function qNumbers(right) {
  const out = new Set([right]);
  for (const k of qPick([0.5, 0.65, 0.8, 1.2, 1.35, 1.6, 2], 7)) { const v = Math.max(0, Math.round(right * k)); if (v !== right) out.add(v); if (out.size === 4) break; }
  for (let d = 1; out.size < 4; d++) out.add(right + d);
  return [...out];
}
const QUIZ_KINDS = {
  rateHigh: (c) => qExtreme("Which of these did you rate highest?", c.rated, (f) => f.rating, (f) => qFilm(f),
    (b, four) => `You gave ${b.name} ${stars(b.rating)}; ${four.filter((f) => f !== b).map((f) => `${f.name} ${stars(f.rating)}`).join(", ")}.`, true, (b) => D.film(b)),
  rateLow: (c) => qExtreme("Which of these did you rate lowest?", c.rated, (f) => f.rating, (f) => qFilm(f),
    (b, four) => `You gave ${b.name} ${stars(b.rating)}; ${four.filter((f) => f !== b).map((f) => `${f.name} ${stars(f.rating)}`).join(", ")}.`, false, (b) => D.film(b)),
  ratingOf: (c) => {
    if (!c.rated.length) return null;
    const f = qOne(c.rated), others = qPick([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].filter((r) => r !== f.rating), 3);
    return qMake(`What did you rate ${f.name}${f.year ? ` (${f.year})` : ""}?`, [f.rating, ...others].map((r) => ({ label: stars(r), stars: true })), 0, `You gave it ${stars(f.rating)}.`, D.film(f));
  },
  watchedFirst: (c) => qExtreme(`Which of these did you watch first${c.all ? "" : ` in ${c.Y}`}?`, c.logged, (f) => Date.parse(c.first.get(f)), (f) => qFilm(f),
    (b, four) => `${b.name} on ${fmtDate(c.first.get(b))}; ${four.filter((f) => f !== b).map((f) => `${f.name} ${fmtDate(c.first.get(f))}`).join(", ")}.`, false, (b) => D.film(b)),
  onDate: (c) => {
    const byDay = new Map();
    for (const e of c.E) (byDay.get(e.date) || byDay.set(e.date, []).get(e.date)).push(e);
    const days = [...byDay].filter(([, es]) => es.length === 1);
    if (!days.length) return null;
    const [day, [e]] = qOne(days), t = Date.parse(day);
    const near = [...new Set(c.E.filter((x) => x.date !== day && x.film !== e.film && Math.abs(Date.parse(x.date) - t) < 120 * 864e5).map((x) => x.film))];
    const pool = near.length >= 3 ? near : [...new Set(c.E.filter((x) => x.film !== e.film).map((x) => x.film))];
    if (pool.length < 3) return null;
    return qMake(`Which film did you watch on ${fmtDate(day)}?`, [e.film, ...qPick(pool, 3)].map((f) => qFilm(f)), 0, `${e.film.name}${e.rating ? `, which you rated ${stars(e.rating)}` : ""}.`, DR.day(c.E, day, [e]));
  },
  topDirector: (c) => qExtreme("Whose films have you watched the most?", c.s.directors.most.slice(0, 15), (p) => p.count, (p) => ({ label: p.name, sub: "Director" }),
    (b, four) => `${b.name}, ${plural(b.count, "film")}; ${four.filter((p) => p !== b).map((p) => `${p.name} ${p.count}`).join(", ")}.`, true, (b) => D.films(b.name, filmsSub(b.films), b.films, { scope: c.Y })),
  topActor: (c) => qExtreme("Which of these actors have you seen in the most films?", c.s.cast.most.slice(0, 20), (p) => p.count, (p) => ({ label: p.name, sub: "Actor" }),
    (b, four) => `${b.name}, ${plural(b.count, "film")}; ${four.filter((p) => p !== b).map((p) => `${p.name} ${p.count}`).join(", ")}.`, true, (b) => D.films(b.name, filmsSub(b.films), b.films, { scope: c.Y })),
  directorOf: (c) => {
    const films = c.F.filter((f) => { const m = metaOf(f); return m && roleNames(m, "d").length === 1; });
    if (!films.length) return null;
    const f = qOne(films), d = roleNames(metaOf(f), "d")[0];
    const others = qPick(c.s.directors.most.map((p) => p.name).filter((n) => n !== d), 3);
    if (others.length < 3) return null;
    return qMake(`Who directed ${f.name}${f.year ? ` (${f.year})` : ""}?`, [d, ...others].map((n) => ({ label: n })), 0, `${d} directed it.`, D.film(f));
  },
  actorIn: (c) => {
    const films = c.F.filter((f) => { const m = metaOf(f); return m && castOf(m).length >= 3; });
    if (!films.length) return null;
    const f = qOne(films), cast = castOf(metaOf(f)), a = qOne(cast.slice(0, 3)), inIt = new Set(cast);
    const others = qPick(c.s.cast.most.slice(0, 60).map((p) => p.name).filter((n) => !inIt.has(n)), 3);
    if (others.length < 3) return null;
    return qMake(`Which of these actors is in ${f.name}${f.year ? ` (${f.year})` : ""}?`, [a, ...others].map((n) => ({ label: n })), 0, `${a} is in it.`, D.film(f));
  },
  longest: (c) => qExtreme("Which of these is the longest?", c.F.filter((f) => metaOf(f) && metaOf(f).r), (f) => metaOf(f).r, (f) => qFilm(f),
    (b, four) => `${b.name}, ${metaOf(b).r} minutes; ${four.filter((f) => f !== b).map((f) => `${f.name} ${metaOf(f).r}`).join(", ")}.`, true, (b) => D.film(b)),
  oldest: (c) => qExtreme("Which of these came out first?", c.F.filter((f) => f.year), (f) => f.year, (f) => qFilm(f, ""),
    (b, four) => `${b.name}, ${b.year}; ${four.filter((f) => f !== b).map((f) => `${f.name} ${f.year}`).join(", ")}.`, false, (b) => D.film(b)),
  mostViews: (c) => {
    const seen = c.F.filter((f) => viewsIn(f, c.Y) > 0);
    if (!seen.some((f) => viewsIn(f, c.Y) > 1)) return null;
    return qExtreme("Which of these have you watched the most times?", seen, (f) => viewsIn(f, c.Y), (f) => qFilm(f),
      (b, four) => `${b.name}, ${viewsIn(b, c.Y)} times; ${four.filter((f) => f !== b).map((f) => `${f.name} ${viewsIn(f, c.Y)}`).join(", ")}.`, true, (b) => D.film(b));
  },
  howMany: (c) => {
    if (c.all) {
      const ys = diaryYears(c.lib).filter((y) => c.E.filter((e) => e.date.startsWith(y)).length >= 5 && y !== new Date().toISOString().slice(0, 4));
      if (!ys.length) return null;
      const y = qOne(ys), es = c.E.filter((e) => e.date.startsWith(y)), nums = qNumbers(es.length);
      return qMake(`How many diary entries did you log in ${y}?`, nums.map((n) => ({ label: fmtN(n) })), 0, `${fmtN(es.length)} entries in ${y}.`, D.entries(`Diary of ${y}`, entriesSub(es), es));
    }
    const ms = [...new Set(c.E.map((e) => e.date.slice(0, 7)))].filter((m) => c.E.filter((e) => e.date.startsWith(m)).length >= 3);
    if (!ms.length) return null;
    const m = qOne(ms), es = c.E.filter((e) => e.date.startsWith(m)), nums = qNumbers(es.length);
    return qMake(`How many diary entries did you log in ${monthName(m)}?`, nums.map((n) => ({ label: fmtN(n) })), 0, `${fmtN(es.length)} entries.`, DR.month(c.E, m));
  },
  weekday: (c) => {
    const w = c.s.weekday, max = Math.max(...w);
    if (!c.E.length || w.filter((n) => n === max).length > 1) return null;
    const top = w.indexOf(max), others = qPick([0, 1, 2, 3, 4, 5, 6].filter((i) => i !== top), 3);
    return qMake(`On which day of the week do you watch the most${c.all ? "" : ` in ${c.Y}`}?`, [top, ...others].map((i) => ({ label: WEEKDAYS_LONG[i] })), 0,
      `${WEEKDAYS_LONG[top]}, ${plural(max, "film")}; ${others.map((i) => `${WEEKDAYS_LONG[i]} ${w[i]}`).join(", ")}.`, DR.weekday(c.E, top));
  },
  topGenre: (c) => qExtreme("Which genre do you watch the most?", c.s.genres.most.slice(0, 10), (g) => g.count, (g) => ({ label: g.name }),
    (b, four) => `${b.name}, ${plural(b.count, "film")}; ${four.filter((g) => g !== b).map((g) => `${g.name} ${g.count}`).join(", ")}.`, true, (b) => D.films(b.name, filmsSub(b.films), b.films, { scope: c.Y })),
  topCountry: (c) => qExtreme("Films from which country have you watched the most?", c.s.countries.most.slice(0, 12), (g) => g.count, (g) => ({ label: g.name }),
    (b, four) => `${b.name}, ${plural(b.count, "film")}; ${four.filter((g) => g !== b).map((g) => `${g.name} ${g.count}`).join(", ")}.`, true, (b) => D.films(b.name, filmsSub(b.films), b.films, { scope: c.Y })),
  bestDecade: (c) => qExtreme("Which decade's films do you rate highest?", favourites(c.s, "decade").items, (x) => +x.avg.toFixed(2), (x) => ({ label: x.name }),
    (b, four) => `${b.name}, ${b.avg.toFixed(2)}★ on average; ${four.filter((x) => x !== b).map((x) => `${x.name.replace(/^The /, "the ")} ${x.avg.toFixed(2)}`).join(", ")}.`, true, (b) => b.to),
  fiveStars: (c) => {
    const five = c.rated.filter((f) => f.rating === 5);
    if (!five.length) return null;
    return qMake(`How many films have you rated five stars${c.all ? "" : ` in ${c.Y}`}?`, qNumbers(five.length).map((n) => ({ label: fmtN(n) })), 0, plural(five.length, "film") + ".", D.films("Five stars", filmsSub(five), five, { scope: c.Y }));
  },
  notWatched: (c) => {
    if (!c.all || !c.lib.watchlistFilms.length || c.logged.length < 3) return null;
    const w = qOne(c.lib.watchlistFilms);
    return qMake("Which of these haven't you watched yet?", [w, ...qPick(c.logged, 3)].map((f) => qFilm(f)), 0, `${w.name} is still on your watchlist.`, null);
  },
  topStudio: (c) => {
    const S = studioData(c.F, metaOf, 1);
    return qExtreme("Which studio made the most of your films?", S.all.slice(0, 10), (x) => x.films.length, (x) => ({ label: x.name }),
      (b, four) => `${b.name}, ${plural(b.films.length, "film")}; ${four.filter((x) => x !== b).map((x) => `${x.name} ${x.films.length}`).join(", ")}.`, true, (b) => D.films(b.name, filmsSub(b.films), b.films, { scope: c.Y }));
  },
  season: (c) => {
    const SD = seasonData(c.lib, metaOf, c.all ? null : c.Y);
    if (!SD) return null;
    return qExtreme("In which season do you watch the most films a month?", SD.seasons.filter((x) => x.days && x.E.length), (x) => +x.pace.toFixed(1), (x) => ({ label: x.name, sub: x.when }),
      (b, four) => `${b.name}, ${b.pace.toFixed(1)} a month; ${four.filter((x) => x !== b).map((x) => `${x.name.toLowerCase()} ${x.pace.toFixed(1)}`).join(", ")}.`, true, (b) => seasonEnts(b.name, b.E));
  },
  firstFilm: (c) => {
    if (c.E.length < 4) return null;
    const e = c.E[0], others = [...new Set(c.E.slice(1, 25).map((x) => x.film))].filter((f) => f !== e.film);
    if (others.length < 3) return null;
    return qMake(c.all ? "What's the first film in your diary?" : `What was the first film you logged in ${c.Y}?`, [e.film, ...qPick(others, 3)].map((f) => qFilm(f)), 0, `${e.film.name}, on ${fmtDate(e.date)}.`, D.film(e.film));
  },
};
// A round of questions for a scope ("all" or a year), each kind once at most.
function quizQuestions(lib, Y) {
  const s = computeStats(lib, metaOf, Y), all = Y === "all", E = s.entries, F = s.films, first = new Map();
  for (const e of E) if (!first.has(e.film)) first.set(e.film, e.date);
  const c = { lib, Y, all, s, E, F, rated: F.filter((f) => f.rating), logged: [...first.keys()], first };
  const out = [];
  for (const k of qPick(Object.keys(QUIZ_KINDS), Object.keys(QUIZ_KINDS).length)) {
    let q = null;
    try { q = QUIZ_KINDS[k](c); } catch { q = null; }
    if (q && q.opts.length === 4 && new Set(q.opts.map((o) => `${o.label}|${o.sub || ""}`)).size === q.opts.length) out.push({ ...q, kind: k });
    if (out.length === QUIZ_N) break;
  }
  return out;
}
const QUIZZES = new Map();
let QUIZ_SEQ = 0;
function quizBodyHtml(d) {
  if (!d.qid) { d.qid = `q${++QUIZ_SEQ}`; QUIZZES.set(d.qid, d); }
  if (!d.qs) Object.assign(d, { qs: quizQuestions(shareLib(), d.year), at: 0, picks: [] });
  return `<div class="quiz" data-qid="${d.qid}">${quizInner(d)}</div>`;
}
const QUIZ_VERDICTS = [[1, "You know your diary inside out."], [0.7, "You know your diary well."], [0.4, "Not bad: your diary still has a few surprises."], [0, "Your diary has plenty left to surprise you."]];
function quizInner(d) {
  const qs = d.qs, n = qs.length, score = d.picks.filter((p, i) => p === qs[i].ans).length;
  if (n < 3) return `<p class="dr-s">Your diary needs a few more films and dates for a quiz. Log some more and come back.</p>`;
  if (d.at >= n) {
    const verdict = QUIZ_VERDICTS.find(([min]) => score / n >= min)[1];
    return `<div class="qz-end"><p class="qz-k">Your score</p><p class="qz-score"><b>${score}</b> of ${n}</p><p class="qz-verdict">${esc(verdict)}</p>
      <ol class="qz-list">${qs.map((q, i) => `<li class="${d.picks[i] === q.ans ? "right" : "wrong"}"><span class="qz-mk" aria-hidden="true">${d.picks[i] === q.ans ? "✓" : "✗"}</span><span>${esc(q.q)} <b>${esc(q.opts[q.ans].label)}</b></span></li>`).join("")}</ol>
      <button class="btn primary green" type="button" data-qagain="${d.qid}">Play again</button></div>`;
  }
  const q = qs[d.at], picked = d.picks[d.at], done = picked != null;
  const art = (o) => o.film && showImages && metaOf(o.film) && metaOf(o.film).poster ? `<img class="qz-art" src="${IMG}${esc(metaOf(o.film).poster)}" alt="" loading="lazy">` : "";
  const opt = (o, i) => `<button class="qz-opt${done ? (i === q.ans ? " right" : i === picked ? " wrong" : " off") : ""}${o.film ? " film" : ""}" type="button" data-qa="${d.qid}" data-qi="${i}"${done ? " disabled" : ""}>
    ${art(o)}<span class="qz-l"><span class="qz-t${o.stars ? " stars" : ""}">${esc(o.label)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span>${done && i === q.ans ? `<span class="qz-mk" aria-hidden="true">✓</span>` : done && i === picked ? `<span class="qz-mk" aria-hidden="true">✗</span>` : ""}</button>`;
  const after = done ? `<div class="qz-why" role="status"><b>${picked === q.ans ? "Right." : "Not quite."}</b> ${q.to ? dlink(q.to, esc(q.why)) : esc(q.why)}</div>
    <button class="btn primary green qz-next" type="button" data-qnext="${d.qid}">${d.at + 1 < n ? "Next question" : "See your score"}</button>` : "";
  return `<div class="qz-head"><span>Question ${d.at + 1} of ${n}</span><span>${score} right</span></div><div class="qz-bar" aria-hidden="true"><i style="width:${(d.at / n * 100).toFixed(1)}%"></i></div>
    <h3 class="qz-q">${esc(q.q)}</h3><div class="qz-opts${q.opts.some((o) => o.film) ? " films" : ""}">${q.opts.map(opt).join("")}</div>${after}`;
}
function quizRedraw(d) {
  for (const el of document.querySelectorAll(`.quiz[data-qid="${d.qid}"]`)) {
    const into = typeof inPanel === "function" ? inPanel : (f) => f();
    el.innerHTML = into(() => quizInner(d));
    const focus = el.querySelector(".qz-next, .qz-opt:not([disabled]), [data-qagain]");
    if (focus) focus.focus({ preventScroll: true });
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-qa], [data-qnext], [data-qagain]");
  if (!b) return;
  const d = QUIZZES.get(b.dataset.qa || b.dataset.qnext || b.dataset.qagain);
  if (!d) return;
  e.preventDefault(); e.stopPropagation();
  if (b.dataset.qa) { if (d.picks[d.at] == null) d.picks[d.at] = +b.dataset.qi; }
  else if (b.dataset.qnext) d.at++;
  else Object.assign(d, { qs: quizQuestions(shareLib(), d.year), at: 0, picks: [] });
  quizRedraw(d);
});
</script>
