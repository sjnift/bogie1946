// The quiz (06q-quiz.js): every question has one right answer among distinct ones, and that answer is right by the
// diary's own numbers, a film once a round and not again the next; then a round played through on both layouts, the
// score and the best kept, and Play again (a new best, none of the last round's films).
import { open, assert, noErrors } from "./lib.mjs";

// Many rounds, all time and for each year: answers distinct, the right one in range, and the films and counts behind
// the "highest / lowest / first / most" kinds checked against the diary.
const audit = () => {
  const bad = [], lib = shareLib(), years = ["all", ...diaryYears(lib)];
  const value = (k, s, Y) => ({
    rateHigh: (o) => o.film.rating, rateLow: (o) => -o.film.rating, longest: (o) => metaOf(o.film).r, oldest: (o) => -o.film.year,
    mostViews: (o) => viewsIn(o.film, Y),
    watchedFirst: (o) => -Date.parse((Y === "all" ? o.film.entries : o.film.entries.filter((e) => e.date.startsWith(Y)))[0].date),
    topDirector: (o) => (s.directors.most.find((p) => p.name === o.label) || {}).count, topActor: (o) => (s.cast.most.find((p) => p.name === o.label) || {}).count,
    topGenre: (o) => (s.genres.most.find((p) => p.name === o.label) || {}).count, topCountry: (o) => (s.countries.most.find((p) => p.name === o.label) || {}).count,
  })[k];
  const kinds = new Set();
  for (let r = 0; r < 25; r++) for (const Y of years) {
    const s = computeStats(lib, metaOf, Y);
    for (const q of quizQuestions(lib, Y)) {
      kinds.add(q.kind);
      const keys = q.opts.map((o) => `${o.label}|${o.sub || ""}`);
      if (q.opts.length !== 4 || new Set(keys).size !== keys.length) bad.push(`${Y} ${q.kind}: answers ${keys.join(" / ")}`);
      if (!(q.ans >= 0 && q.ans < q.opts.length)) bad.push(`${Y} ${q.kind}: right answer ${q.ans}`);
      // numbers and stars in order; no "Actor" or "Director" under a name; a director or actor's wrong answers from the
      // film's own time when the diary has enough people from then (asked 1 Nov 2026)
      if (q.opts.every((o) => typeof o.v === "number") && q.opts.some((o, i) => i && q.opts[i - 1].v > o.v)) bad.push(`${Y} ${q.kind}: numbers out of order ${keys.join(" / ")}`);
      if (q.opts.some((o) => o.sub === "Actor" || o.sub === "Director")) bad.push(`${Y} ${q.kind}: a role under a name`);
      if (q.kind === "directorOf" || q.kind === "actorIn") {
        const year = +(q.q.match(/\((\d{4})\)\?$/) || [])[1], people = q.kind === "directorOf" ? s.directors.most : s.cast.most;
        const near = (name) => { const p = people.find((x) => x.name === name); return p && p.films.some((f) => f.year && Math.abs(f.year - year) <= 8); };
        const wrong = q.opts.filter((o, i) => i !== q.ans).map((o) => o.label), right = q.opts[q.ans].label;
        const film = lib.films.find((f) => q.q.includes(`${f.name} (${f.year})`)), inIt = film ? new Set(q.kind === "directorOf" ? roleNames(metaOf(film), "d") : castOf(metaOf(film))) : new Set([right]);
        const enough = people.filter((p) => !inIt.has(p.name) && p.films.some((f) => f.year && Math.abs(f.year - year) <= 8)).length >= 3;
        if (year && enough && !wrong.every(near)) bad.push(`${Y} ${q.kind}: wrong answers from another time for ${year}: ${wrong.join(", ")}`);
      }
      const v = value(q.kind, s, Y);
      if (v) { const vs = q.opts.map(v), top = Math.max(...vs); if (vs[q.ans] !== top || vs.filter((x) => x === top).length !== 1) bad.push(`${Y} ${q.kind}: ${q.q} ${keys.join(" / ")} → ${vs.join(",")}, right ${q.ans}`); }
    }
  }
  // a film once a round, and not again the next round (all time, where the diary has plenty)
  let prev = [];
  for (let r = 0; r < 10; r++) {
    const qs = quizQuestions(lib, "all", prev), per = qs.map((q) => [...new Set(qFilms(q))]), fs = per.flat();
    if (fs.length !== new Set(fs).size) bad.push(`all: a film twice in one round (${fs.join(" / ")})`);
    const again = fs.filter((f) => prev.includes(f));
    if (again.length) bad.push(`all: ${again.join(", ")} again the round after`);
    if (qs.length !== 10) bad.push(`all: ${qs.length} questions with films kept apart`);
    prev = [...new Set(fs)];
  }
  return { bad, kinds: [...kinds].sort().join() };
};

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    const panel = phone ? "#sheet" : "#dlg";
    const A = await p.evaluate(audit);
    assert(!A.bad.length, `${file}: ${A.bad.slice(0, 4).join(" | ")}`);
    for (const k of ["rateHigh", "watchedFirst", "topDirector", "directorOf", "onDate", "howMany", "weekday", "topStudio", "season"]) assert(A.kinds.split(",").includes(k), `${file}: no ${k} question in 25 rounds (${A.kinds})`);
    // a round played through: open it from the page, answer each question (right for the first five, wrong after)
    if (phone) await p.click('.storyrow .quizbtn'); else await p.click('#hero-acts button:has-text("Take the quiz")');
    await p.waitForSelector(`${panel} .quiz .qz-opt`);
    const n = await p.evaluate(() => [...QUIZZES.values()].pop().qs.length);
    assert(n === 10, `${file}: ${n} questions in a round`);
    for (let i = 0; i < n; i++) {
      const ans = await p.evaluate(() => { const d = [...QUIZZES.values()].pop(); return d.qs[d.at].ans; });
      const pick = i < 5 ? ans : (ans + 1) % (await p.$$(`${panel} .qz-opt`)).length;
      await p.click(`${panel} .qz-opt[data-qi="${pick}"]`);
      const after = await p.$eval(`${panel} .quiz`, (q) => ({ why: q.querySelector(".qz-why").textContent, right: q.querySelectorAll(".qz-opt.right").length, wrong: q.querySelectorAll(".qz-opt.wrong").length, off: q.querySelectorAll(".qz-opt:not([disabled])").length }));
      assert(after.right === 1 && after.wrong === (i < 5 ? 0 : 1) && after.off === 0 && /^(Right|Not quite)\./.test(after.why), `${file} question ${i + 1}: ${JSON.stringify(after)}`);
      await p.click(`${panel} .qz-next`);
    }
    const end = await p.$eval(`${panel} .qz-end`, (e) => e.innerText.replace(/\s+/g, " "));
    assert(/5 of 10/.test(end) && (end.match(/✓/g) || []).length === 5 && /Your first round here/.test(end), `${file}: the score ${end.slice(0, 160)}`);
    const saved = await p.evaluate(() => ({ ...quizSaved("all"), round: [...new Set([...QUIZZES.values()].pop().qs.flatMap(qFilms))].sort().join() }));
    assert(saved.s === 5 && saved.n === 10 && saved.last.length >= 1 && [...saved.last].sort().join() === saved.round, `${file}: best kept ${JSON.stringify({ ...saved, last: (saved.last || []).length, round: saved.round.split(",").length })}`);
    // play again, all right this time: a new best, and none of the last round's films
    await p.click(`${panel} [data-qagain]`);
    assert(await p.$eval(`${panel} .qz-head`, (h) => /Question 1 of 10/.test(h.textContent)), `${file}: Play again`);
    const again = await p.evaluate((last) => [...QUIZZES.values()].pop().qs.flatMap(qFilms).filter((f) => last.includes(f)), saved.last);
    assert(!again.length, `${file}: the next round asked again about ${again.join(", ")}`);
    for (let i = 0; i < 10; i++) {
      const ans = await p.evaluate(() => { const d = [...QUIZZES.values()].pop(); return d.qs[d.at].ans; });
      await p.click(`${panel} .qz-opt[data-qi="${ans}"]`); await p.click(`${panel} .qz-next`);
    }
    const best = await p.$eval(`${panel} .qz-best`, (e) => [e.textContent, e.classList.contains("up")]);
    assert(best[0] === "A new best, up from 5 of 10." && best[1] && (await p.evaluate(() => quizSaved("all").s)) === 10, `${file}: new best ${JSON.stringify(best)}`);
    noErrors(p, file);
    await p.close();
  }
}
