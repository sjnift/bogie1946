// The quiz (06q-quiz.js): every question has one right answer among distinct ones, and that answer is right by the
// diary's own numbers; then a round played through on both layouts, the score, and Play again.
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
      const v = value(q.kind, s, Y);
      if (v) { const vs = q.opts.map(v), top = Math.max(...vs); if (vs[q.ans] !== top || vs.filter((x) => x === top).length !== 1) bad.push(`${Y} ${q.kind}: ${q.q} ${keys.join(" / ")} → ${vs.join(",")}, right ${q.ans}`); }
    }
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
    if (phone) await p.click('.storyrow .quizbtn'); else await p.getByText("take the quiz").click();
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
    assert(/5 of 10/.test(end) && (end.match(/✓/g) || []).length === 5, `${file}: the score ${end.slice(0, 120)}`);
    await p.click(`${panel} [data-qagain]`);
    assert(await p.$eval(`${panel} .qz-head`, (h) => /Question 1 of 10/.test(h.textContent)), `${file}: Play again`);
    noErrors(p, file);
    await p.close();
  }
}
