<script>
/* ---------- phone: Insights, a study of the diary (worked out in 06k-study.js). The year chips pick all years or
   one; the tabs under them pick a section. ---------- */
const INS_TABS = [["overview", "In short"], ["chapters", "Chapters"], ["taste", "Taste"], ["ratings", "Ratings"], ["threads", "Threads"], ["habits", "Habits"]];
const YEAR_TABS = [["overview", "In short"], ["apart", "Stood out"], ["ratings", "Ratings"], ["threads", "Threads"], ["habits", "Habits"]];
// the crowd picked with the chips, or the one with the most scores
const crowdKey = () => state.crowd || memo("crowd", () => defaultCrowd(state.lib, metaOf));
const allStudy = () => memo(`study|${crowdKey()}`, () => computeStudy(state.lib, metaOf, crowdKey()));
const yearStudy = (Y) => memo(`ystudy|${Y}|${crowdKey()}`, () => computeYearStudy(state.lib, metaOf, crowdKey(), Y, allStudy()));
function insightsScreen() {
  const lib = state.lib;
  const head = ltitle("Insights") + scopeBar("All years");
  if (!lib.entries.length) return head + `<div class="empty" style="padding-top:28px">Insights come from your diary dates, and this diary has none yet.</div>`;
  if (state.scope !== "all") {
    if (!YEAR_TABS.some(([k]) => k === state.yearTab)) state.yearTab = "overview";
    return head + utabs("ytab", YEAR_TABS, state.yearTab) + mYearInsights(state.scope, state.yearTab);
  }
  if (!INS_TABS.some(([k]) => k === state.insTab)) state.insTab = "overview";
  return head + utabs("instab", INS_TABS, state.insTab) + mAllInsights(state.insTab);
}
function mAllInsights(tab) {
  const lib = state.lib, S = allStudy();
  if (tab === "chapters") return mChapters(S.chapters, S.n);
  if (tab === "taste") return mDrift(S.drift);
  if (tab === "ratings") return mRatings(S.ratings);
  if (tab === "threads") return mThreads(S.threads);
  if (tab === "habits") return sh("Habits, and what they say") + mFindings(S.habits, "No habit stands out clearly yet.");
  const intro = `<p class="lead" style="margin-top:16px">A study of ${dlink(D.entries("Your diary", entriesSub(lib.entries), lib.entries), plural(S.n.entries, "diary entry", "diary entries"))}, ${fmtDate(S.n.from)} to ${fmtDate(S.n.to)}. Only clear patterns are reported; tap any of them to see the films behind it.</p>`;
  return intro + (S.overview.length ? mGlance(S.overview, "In short") : `<div class="empty">No clear patterns yet. They'll show as your diary grows.</div>`);
}
const go = '<span class="go" aria-hidden="true"> ›</span>';
// sentences that open the data they describe
const mLines = (lines, mark) => lines.length ? `<div class="lines">${lines.map((l) => `<div class="tline"><span class="mk ${l.dir || ""}" aria-hidden="true">${mark(l)}</span><span>${dline(l.to, esc(l.text))}</span></div>`).join("")}</div>` : "";
// findings: a short name over the sentence that opens its films
const mFindings = (list, empty) => list.length ? `<div class="finds">${list.map((f) => `<div class="find">${f.big ? `<span class="fk">${esc(f.big)}</span>` : ""}${dline(f.to, esc(f.text))}</div>`).join("")}</div>`
  : `<div class="empty">${empty}</div>`;
// posters that open their films
const mPosters = (items, cap) => `<div class="pgrid">${items.map((x) => `<button class="pitem" type="button" ${dl(D.film(x.f))}>${poster(x.f)}${cap(x)}</button>`).join("")}</div>`;
const mStrip = (films) => films.length ? `<div class="scroller">${films.slice(0, 8).map((f) => posterItem(f)).join("")}</div>` : "";

function mGlance(glance, title) {
  if (!glance.length) return "";
  return sh(title) + `<div class="icards">${glance.map((g, i) => { const wide = String(g.big).length > 12 || String(g.text).length > 60 || (glance.length % 2 && i === glance.length - 1);
    const inner = `<span class="k">${esc(g.k)}</span><span class="big">${esc(g.big)}</span><span class="p">${esc(g.text)}${g.to ? go : ""}</span>`;
    return g.to ? `<button class="icard${wide ? " wide" : ""}" type="button" ${dl(g.to)}>${inner}</button>` : `<div class="icard${wide ? " wide" : ""}">${inner}</div>`; }).join("")}</div>`;
}

function mChapters(chs, n, title = "Chapters") {
  if (!chs.length) return sh(title) + `<div class="empty">No stretch ${n ? "of your diary" : "of the year"} stands apart clearly enough yet.</div>`;
  const st = n && n.from ? chapterStrip(chs, n.from, n.to) : null;
  const bar = st ? `<div class="ch-strip" aria-hidden="true">${st.years.map((y) => `<span class="yr" style="left:${(y.at * 100).toFixed(2)}%"><i>’${String(y.y).slice(2)}</i></span>`).join("")}
    ${st.items.map((x) => `<button class="seg" type="button" tabindex="-1" ${dl(x.c.to)} style="left:${(x.left * 100).toFixed(2)}%;width:${(x.width * 100).toFixed(2)}%"></button>`).join("")}</div>` : "";
  return sh(title) + (n ? `<p class="note" style="margin:-4px 0 12px">Stretches of your diary that stood apart from the rest of it.</p>` : "") + bar +
    chs.map((c) => `<div class="card chap"><span class="eyebrow">${esc(c.span)} · ${plural(c.n, "film")}</span><p class="ctitle">${dlink(c.to, esc(c.title))}</p>
      <p class="ctext">${dline(c.to, esc(c.text))}</p>${mStrip(c.posters)}</div>`).join("");
}

function mDrift(d) {
  if (!d.enough) return sh("How your taste has moved") + `<div class="empty">Changes in taste need a few years of diary, or a year or two with plenty of films.</div>`;
  const rows = d.list.map((x) => { const c = driftCols(x);
    return `<div class="card drift"><p class="ctitle">${dlink(x.to, esc(x.big))}</p><p class="ctext">${dline(x.to, esc(x.text))}</p>${colChart(c.cols, x.big, "", 48, { grid: c.grid, unit: c.unit })}</div>`; }).join("");
  return sh("How your taste has moved") + `<p class="note" style="margin:-4px 0 12px">Your first years of diary against your latest. Each column is a stretch of it; tap one for its films.</p>` +
    (rows || `<p class="lead">No clear, lasting change in what you watch: your taste has held its course.</p>`) +
    (d.steady.length ? sh("What hasn't changed") + mLines(d.steady, () => "=") : "");
}

function mRatings(R) {
  if (R.n < 20) return sh("What your ratings follow") + `<div class="empty">This needs at least 20 rated films with cast &amp; crew details.</div>`;
  let h = "";
  // bars against at least 25%, so a small share never fills the bar
  const shown = R.follow.filter((f) => f.pct >= FOLLOW_MIN), max = Math.max(25, ...shown.map((f) => f.pct));
  if (shown.length) h += sh("What your ratings follow") + `<p class="lead" style="margin:-4px 0 12px">${esc(R.followText || "")}</p><div class="group">${shown.map((f) =>
    `<button class="prow cat" type="button" ${dl(f.to)}><span class="nm">${esc(f.label)}</span><span class="mini" aria-hidden="true"><span style="width:${(f.pct / max * 100).toFixed(1)}%"></span></span>
    <span class="val" style="text-align:right">${f.pct}%</span>${CHEV}</button>`).join("")}</div>
    <p class="note">How much of the ups and downs in your ratings each accounts for, each film guessed from the others that share it. Tap one for your averages.</p>`;
  const B = R.beyond, them = B.vsCrowd ? "the crowd does" : "usual";
  if (B.up.length) h += sh(`You like more than ${them}`) + mLines(B.up.map((x) => ({ ...x, dir: "up" })), () => "▲");
  if (B.down.length) h += sh(`You like less than ${them}`) + mLines(B.down.map((x) => ({ ...x, dir: "down" })), () => "▼");
  if (R.judge.length) h += sh("Tougher, or choosier?") + mFindings(R.judge, "");
  if (R.steady.length || R.divide.length) h += sh("Directors") + mLines([...R.steady.map((x) => ({ ...x, m: "★" })), ...R.divide.map((x) => ({ ...x, m: "↕" }))], (x) => x.m);
  return h || `<div class="empty">Nothing clear in your ratings yet.</div>`;
}

function mThreads(T, empty = "No film has led to a run of others yet: four or more by one person within a few months.") {
  let h = "";
  const card = (x) => `<div class="card chap"><p class="ctext">${dline(x.to, esc(x.text))}</p>${mStrip(x.films)}</div>`;
  if (T.gateways.length) h += sh("Doors that opened") + T.gateways.map(card).join("");
  if ((T.chains || []).length) h += sh("Chains") + `<p class="note" style="margin:-4px 0 12px">Runs where each film shared someone with one you'd watched in the days before.</p>` + T.chains.map(card).join("");
  return h || `<div class="empty">${empty}</div>`;
}

/* ----- one year ----- */
function mYearInsights(Y, tab) {
  const lib = state.lib, R = yearStudy(Y);
  if (tab === "apart") {
    let h = sh(`What set ${esc(Y)} apart`);
    h += R.differ.length ? R.differ.map((d) => `<div class="card chap"><p class="ctitle">${dlink(d.to, esc(d.big))}</p><p class="ctext">${dline(d.to, esc(d.text))}</p>${mStrip(d.posters)}</div>`).join("")
      : `<div class="empty">${R.first ? `${esc(Y)} is where your diary starts, so there's little to compare it with.` : `Nothing about ${esc(Y)} stands out clearly from your other years.`}</div>`;
    const films = [...new Set(lib.entries.filter((e) => e.date.startsWith(Y)).map((e) => e.film))];
    const newOnes = (label, list, field) => list.length ? `${label}: ${list.map((v) => { const fs = films.filter((f) => { const m = metaOf(f); return m && (field === "l" ? m.l === v : m[field].includes(v)); });
      return dlink(D.films(`${v} in ${Y}`, filmsSub(fs), fs, { scope: Y }), esc(v)); }).join(", ")}.` : "";
    if (R.newCountries.length || R.newLangs.length) h += sh("First seen this year") + `<p class="lead">${newOnes("Countries", R.newCountries, "k")} ${newOnes("Languages", R.newLangs, "l")}</p>`;
    return h + mChapters(R.chapters, null, `${esc(Y)}, month by month`);
  }
  if (tab === "ratings") return sh(`Ratings in ${esc(Y)}`) + mFindings(R.ratings, `Not enough rated films in ${esc(Y)}.`);
  if (tab === "threads") return mThreads(R.threads, `No run of films by one person began in ${esc(Y)}.`);
  if (tab === "habits") return sh(`Habits in ${esc(Y)}`) + mFindings(R.habits, `${esc(Y)} was much like your other years.`);
  const es = lib.entries.filter((e) => e.date.startsWith(Y));
  return `<p class="lead" style="margin-top:16px">How ${dlink(D.entries(`Diary of ${Y}`, entriesSub(es), es), `${esc(Y)}'s ${plural(es.length, "diary entry", "diary entries")}`)} compared with the rest of your diary.</p>` +
    (es.length ? `<div class="storyrow" style="margin-top:14px"><button class="btn green" type="button" ${dl(D.story(Y))}>${ICON.next}Play ${esc(Y)} as a story</button>
      <button class="btn" type="button" ${dl(D.share(Y))}>${ICON.share}Share ${esc(Y)} as an image</button></div>` : "") +
    (R.overview.length ? mGlance(R.overview, `${esc(Y)} in short`) : `<div class="empty">Nothing about ${esc(Y)} stands out clearly from your other years yet.</div>`);
}
</script>
