<script>
/* ---------- desktop: Insights, a study of the diary (worked out in 06k-study.js) ---------- */
// The study is worked out again only when the diary, its film details or the crowd change.
let STUDY_CACHE = null;
const studyCrowd = () => state.crowd || defaultCrowd(state.lib, metaOf);
function desktopStudy(Y) {
  const k = studyCrowd(), sig = `${DATA_REV}|${k}|${Object.keys(META).length}|${Object.keys(LBX).length}`;
  if (!STUDY_CACHE || STUDY_CACHE.lib !== state.lib || STUDY_CACHE.sig !== sig) STUDY_CACHE = { lib: state.lib, sig, S: computeStudy(state.lib, metaOf, k), years: new Map() };
  const C = STUDY_CACHE;
  if (!Y) return C.S;
  if (!C.years.has(Y)) C.years.set(Y, computeYearStudy(state.lib, metaOf, k, Y, C.S));
  return C.years.get(Y);
}
function renderInsights() {
  const lib = state.lib;
  const ys = diaryYears(lib);
  if (state.insYear !== "all" && !ys.includes(state.insYear)) state.insYear = "all";
  $(".scopes-row").hidden = !ys.length;
  $("#scopes").innerHTML = ["all", ...[...ys].reverse()].map((y) =>
    `<button class="chip" type="button" data-insyear="${y}" aria-pressed="${y === state.insYear}">${y === "all" ? "All years" : y}</button>`).join("");
  if (state.insYear !== "all") return renderYearInsights(state.insYear);
  const S = desktopStudy();
  $("#hero-title").innerHTML = `Your <span class="accent">insights</span>`;
  $("#hero-sub").innerHTML = S.n.from ? `A study of ${dlink(D.entries("Your diary", entriesSub(lib.entries), lib.entries), plural(S.n.entries, "diary entry", "diary entries"))}, ${fmtDate(S.n.from)} to ${fmtDate(S.n.to)}: what stood apart, how your taste has moved, what your ratings follow, and the habits behind it all. Only clear patterns are reported, and every sentence opens the films behind it.`
    : "Insights come from your diary dates, and this diary has none yet.";
  $("#insights").innerHTML = [
    section("i-glance", "In short", "The strongest finding of each kind.", glanceBlock(S.overview, "No clear patterns yet. They'll show as your diary grows.")),
    section("i-chapters", "Chapters", "Stretches of your diary that stood apart from the rest of it.", chaptersBlock(S.chapters, S.n)),
    section("i-months", "Through the year", "How your watching runs month by month, and how that has changed over the years.", monthsInsBlock(S.months)),
    section("i-studios", "Studios", "Who made the films you watch: each film once, under its studio.", studiosHtml(lib.films, metaOf, "all", false)),
    section("i-tastes", "How your taste has moved", "Your first years of diary against your latest. Only clear, lasting changes are listed.", driftBlock(S.drift)),
    section("i-ratings", "What your ratings follow", "What tells most about how you'll rate a film, and what you like beyond its reputation.", ratingsBlock(S.ratings)),
    section("i-threads", "One film to the next", "How a film led you to more by the same people.", threadsBlock(S.threads)),
    section("i-habits", "Habits, and what they say", "How you watch, and how it shapes what you pick and how you rate it.", findings(S.habits, "No habit stands out clearly yet.")),
  ].join("");
  syncHash();
}
// a sentence that opens the data it describes
const lineItems = (lines, mark) => `<ul class="trend-lines">${lines.map((l) => `<li><span class="mk" aria-hidden="true">${mark(l)}</span><span>${dline(l.to, esc(l.text))}</span></li>`).join("")}</ul>`;
// findings: a short name, then the sentence that opens its films
const findings = (list, empty) => list.length ? `<div class="findings">${list.map((f) => `<div class="finding"><span class="fk">${esc(f.big || "")}</span><span class="ft">${dline(f.to, esc(f.text))}</span></div>`).join("")}</div>`
  : `<div class="empty">${empty}</div>`;
// a poster that opens its film
const posterBtn = (f, cap) => `<button class="poster" type="button" ${dl(D.film(f))}>${artHtml(f)}${cap}</button>`;
const posterStrip = (films) => films.length ? `<div class="posters strip">${films.slice(0, 6).map((f) => posterBtn(f, `<span class="cap">${f.rating ? `<span class="stars">${stars(f.rating)}</span>` : ""}</span>`)).join("")}</div>` : "";

function glanceBlock(glance, empty) {
  if (!glance.length) return `<div class="empty">${empty}</div>`;
  return `<div class="glance">${glance.map((g) => { const inner = `<span class="k">${esc(g.k)}</span><span class="big">${esc(g.big)}</span><span class="gp">${esc(g.text)}${g.to ? '<span class="go" aria-hidden="true">&nbsp;›</span>' : ""}</span>`;
    return g.to ? `<button class="gcard" type="button" ${dl(g.to)}>${inner}</button>` : `<div class="gcard">${inner}</div>`; }).join("")}</div>`;
}

function chaptersBlock(chs, n, strip = true) {
  if (!chs.length) return `<div class="empty">No stretch of your diary stands apart clearly enough yet: your watching has been even, or there isn't enough of it to tell.</div>`;
  const st = strip && n && n.from ? chapterStrip(chs, n.from, n.to) : null;
  const bar = st ? `<div class="ch-strip" aria-hidden="true">${st.years.map((y) => `<span class="yr" style="left:${(y.at * 100).toFixed(2)}%"><i>${y.y}</i></span>`).join("")}
    ${st.items.map((x) => `<button class="seg" type="button" tabindex="-1" ${dl(x.c.to)} style="left:${(x.left * 100).toFixed(2)}%;width:${(x.width * 100).toFixed(2)}%" data-tip="${esc(`${x.c.title} · ${x.c.span}`)}"></button>`).join("")}</div>` : "";
  return bar + `<div class="chapters">${chs.map((c) => `<article class="chapter"><span class="eyebrow">${esc(c.span)} · ${plural(c.n, "film")}</span>
    <h3 class="ch-title">${dlink(c.to, esc(c.title))}</h3><p>${dline(c.to, esc(c.text))}</p>${posterStrip(c.posters)}</article>`).join("")}</div>`;
}

// Through the year: each month's pace against your usual, the months that are reliably busier or quieter, how the
// year's shape has moved, what months bring, and months you rate differently.
function monthsInsBlock(M) {
  if (!M.enough) return `<div class="empty">This needs a year or more of diary, with every month of the year in it.</div>`;
  const leans = M.leans.map((d) => `<div class="thread"><p>${dline(d.to, esc(d.text))}</p>${posterStrip(d.posters)}</div>`).join("");
  return `<div class="mpace">${paceChart(M, 110)}</div><p class="status">How fast you watch in each month across your years, against your usual pace. Click a month to see its films.</p>` +
    findings(M.pace, "") + (M.shifts.length ? `<h3 class="sub-h">How your year has changed</h3>` + findings(M.shifts, "") : "") +
    (leans ? `<h3 class="sub-h">What the months bring</h3><div class="threads">${leans}</div>` : "") +
    (M.ratings.length ? `<h3 class="sub-h">Ratings through the year</h3>` + findings(M.ratings, "") : "");
}
function driftBlock(d) {
  if (!d.enough) return `<div class="empty">Changes in taste need a few years of diary, or a year or two with plenty of films in each stretch.</div>`;
  const rows = d.list.map((x) => { const c = driftCols(x);
    return `<div class="drift"><div class="dt"><h3>${dlink(x.to, esc(x.big))}</h3><p>${dline(x.to, esc(x.text))}</p></div><div class="dc">${colChart(c.cols, x.big, "", 56, { grid: c.grid, unit: c.unit })}</div></div>`; }).join("");
  const steady = d.steady.length ? `<h3 class="sub-h">What hasn't changed</h3>` + lineItems(d.steady, () => "=") : "";
  return (rows ? `<div class="drifts">${rows}</div><p class="status">Each column is a stretch of your diary; click one to see its films.</p>` : `<p class="lead">No clear, lasting change in what you watch: your taste has held its course.</p>`) + steady;
}

function ratingsBlock(R) {
  if (R.n < 20) return `<div class="empty">This needs at least 20 rated films with cast &amp; crew details.</div>`;
  // bars against at least 25%, so a small share never fills the bar
  const shown = R.follow.filter((f) => f.pct >= FOLLOW_MIN), max = Math.max(25, ...shown.map((f) => f.pct));
  const follow = shown.length ? `<p class="lead">${esc(R.followText || "")}</p>
    ${rankRows(shown.map((f) => ({ ...f, name: f.label })), (f) => `${f.pct}%`, (f) => f.pct / max, 1, () => "")}
    <p class="status">How much of the ups and downs in your ratings each thing accounts for. Each film's rating is guessed from the other films that share it, never from itself. Click one to see your averages.</p>` : "";
  const B = R.beyond, them = B.vsCrowd ? "the crowd does" : "usual";
  const beyond = B.up.length || B.down.length ? `<div class="ins-grid">
    <div><h3>You like more than ${them}</h3>${B.up.length ? lineItems(B.up, () => "▲") : `<p class="status">Nothing clear.</p>`}</div>
    <div><h3>You like less than ${them}</h3>${B.down.length ? lineItems(B.down, () => "▼") : `<p class="status">Nothing clear.</p>`}</div></div>
    <p class="status">${B.vsCrowd ? "Your rating against the one a film's crowd score would predict for you, on average for the films that share something." : "Against your own average: crowd scores come with film details."}</p>` : "";
  const judge = R.judge.length ? `<h3 class="sub-h">Tougher, or choosier?</h3>` + findings(R.judge, "") : "";
  const dirs = R.steady.length || R.divide.length ? `<h3 class="sub-h">Directors</h3>` + lineItems([...R.steady.map((x) => ({ ...x, m: "★" })), ...R.divide.map((x) => ({ ...x, m: "↕" }))], (x) => x.m) : "";
  return follow + beyond + judge + dirs || `<div class="empty">Nothing clear in your ratings yet.</div>`;
}

function threadsBlock(T, empty = "No film has led to a run of others yet: four or more by one person within a few months.") {
  const gates = T.gateways.map((g) => `<div class="thread"><p>${dline(g.to, esc(g.text))}</p>${posterStrip(g.films)}</div>`).join("");
  const chains = (T.chains || []).map((c) => `<div class="thread"><p>${dline(c.to, esc(c.text))}</p>${posterStrip(c.films)}</div>`).join("");
  if (!gates && !chains) return `<div class="empty">${empty}</div>`;
  return (gates ? `<h3 class="sub-h">Doors that opened</h3><div class="threads">${gates}</div>` : "") +
    (chains ? `<h3 class="sub-h">Chains</h3><p class="status">Runs where each film shared someone with one you'd watched in the days before.</p><div class="threads">${chains}</div>` : "");
}

/* ----- one year, against the rest of the diary ----- */
// the year's chapters, then what each season leaned toward against the rest of the year
function monthsBlock(R, Y) {
  const seasons = R.seasons.length ? (R.chapters.length ? `<h3 class="sub-h">Season by season</h3>` : "") + lineItems(R.seasons, () => "◆") : "";
  if (!R.chapters.length && !seasons) return `<div class="empty">No stretch of ${esc(Y)} stands apart: you kept much the same mix all year.</div>`;
  return (R.chapters.length ? chaptersBlock(R.chapters, null, false) : "") + seasons;
}
function renderYearInsights(Y) {
  const lib = state.lib, R = desktopStudy(Y);
  $("#hero-title").innerHTML = `<span class="accent">${esc(Y)}</span> insights`;
  $("#hero-sub").innerHTML = `How ${dlink(D.entries(`Diary of ${Y}`, entriesSub(lib.entries.filter((e) => e.date.startsWith(Y))), lib.entries.filter((e) => e.date.startsWith(Y))), `${esc(Y)}'s ${plural(R.n.entries, "diary entry", "diary entries")}`)} compared with the rest of your diary.`;
  const differ = R.differ.length ? `<div class="threads">${R.differ.map((d) => `<div class="thread"><p>${dline(d.to, esc(d.text))}</p>${posterStrip(d.posters)}</div>`).join("")}</div>`
    : `<div class="empty">${R.first ? `${esc(Y)} is where your diary starts, so there's little to compare it with.` : `Nothing about ${esc(Y)} stands out clearly from your other years.`}</div>`;
  const newOnes = (label, list, field) => list.length ? `${label}: ${list.map((v) => { const fs = [...new Set(lib.entries.filter((e) => e.date.startsWith(Y)).map((e) => e.film))].filter((f) => { const m = metaOf(f); return m && (field === "l" ? m.l === v : m[field].includes(v)); });
    return dlink(D.films(`${v} in ${Y}`, filmsSub(fs), fs, { scope: Y }), esc(v)); }).join(", ")}.` : "";
  const places = R.newCountries.length || R.newLangs.length ? `<p class="lead" style="margin-top:14px">${newOnes(`First seen in ${esc(Y)}: countries`, R.newCountries, "k")} ${newOnes("Languages", R.newLangs, "l")}</p>` : "";
  $("#insights").innerHTML = [
    section("y-glance", `${esc(Y)} in short`, `The year's clearest differences. ${dlink(R.n.entries && D.story(Y), "▶ Play it as a story")} · ${dlink(R.n.entries && D.share(Y), "share it as a picture")}`, glanceBlock(R.overview, `Nothing about ${esc(Y)} stands out clearly from your other years yet.`)),
    section("y-differ", "What set it apart", `What ${esc(Y)}'s films were made of, against your other years.`, differ + places),
    section("y-studios", `Studios in ${esc(Y)}`, `Who made the films you watched in ${esc(Y)}: each film once, under its studio.`, studiosHtml([...new Set(lib.entries.filter((e) => e.date.startsWith(Y)).map((e) => e.film))], metaOf, Y, false)),
    section("y-chapters", `${esc(Y)}, month by month`, "Stretches of the year that stood apart, and what each season leaned toward.", monthsBlock(R, Y)),
    section("y-ratings", `Ratings in ${esc(Y)}`, "The year against your usual, with the crowd's view of the same films.", findings(R.ratings, `Not enough rated films in ${esc(Y)}.`)),
    section("y-threads", `Threads in ${esc(Y)}`, "Runs of films by the same people that began this year.", threadsBlock(R.threads, `No run of films by one person began in ${esc(Y)}.`)),
    section("y-habits", `Habits in ${esc(Y)}`, "How the year's watching differed from your usual.", findings(R.habits, `${esc(Y)} was much like your other years.`)),
  ].join("");
  syncHash();
}
</script>
