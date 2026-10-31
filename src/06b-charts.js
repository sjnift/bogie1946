<script>
/* ---------- helpers and charts shared by the desktop and phone pages ---------- */
const initials = (name) => name.replace(/[^\p{L}\s-]/gu, "").split(/[\s-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
// A small link to the TMDB page a film was matched to, so a wrong match is easy to spot.
const tmdbLink = (f) => {
  const m = f && META[f.key];
  return tmdbHref(m) && !IN_VIEWER ? ` <a class="tmdb-link" href="${tmdbHref(m)}" target="_blank" rel="noopener" title="See the film this was matched to on TMDB">TMDB ↗</a>` : "";
};
// A year's label under its column: every year while they fit, every other past 8, every fourth past 16, always the latest.
const yearTick = (i, n, year) => (n - 1 - i) % (n > 16 ? 4 : n > 8 ? 2 : 1) ? "" : `’${String(year).slice(2)}`;
const isoOfDay = (d) => new Date(d * 864e5).toISOString().slice(0, 10);
function niceTick(max) {
  const raw = max * 0.8, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  return Math.max(1, (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p);
}
// Poster title cards: a title with a long word gets a smaller size, so the word isn't broken in two.
const titleFit = (name) => { const w = Math.max(0, ...String(name || "").split(/[\s\-–—/]+/).map((x) => x.length)); return w > 11 ? " xlong" : w > 8 ? " long" : ""; };
// "Highest rated needs 4+ rated films, the most that still gives 2024 a top 10."
const castBarText = (s) => `Highest rated needs ${s.castMinRated}+ rated films${s.castTop ? `, the most that still gives ${s.scope} a top ${CAST_TOP}` : ""}, ${s.scope === "all" ? `${CAST_LEAD} of them` : "one"} billed in the top ${LEAD_TOP}.`;
const personSub = (p) => `${plural(p.count, "film")}${p.avg ? ` · ${p.avg.toFixed(2)} average from ${plural(p.ratings.length, "rating")}` : ""}`;

/* ---------- column chart: weeks, months, years, ratings, decades ---------- */
// `opts`: `grid` false leaves out the gridline (for small trend charts whose columns don't start from zero), `unit`
// names what the gridline counts ("films", "%"), and `values` writes each column's value over it (for averages, whose
// columns all look alike from zero: `base` then starts them a little below the lowest). A plain true/false is `grid`.
function colChart(cols, aria, legend, H = 162, opts = true) {
  const o = typeof opts === "object" ? { grid: true, ...opts } : { grid: opts };
  const base = o.values ? o.base || 0 : 0;
  const max = Math.max(base + 1e-9, ...cols.map((c) => c.a + (c.b || 0))), span = Math.max(1e-9, max - base);
  const grid = o.grid && !o.values;
  const tick = niceTick(max);
  const h = (v) => (Math.max(0, v - base) / span * (o.values ? 82 : 100)).toFixed(2);
  const bars = cols.map((c) => {
    const segs = [];
    if (c.a) segs.push(`<div class="seg a" style="height:${o.values ? h(c.a) : (c.a / max * 100).toFixed(2)}%"></div>`);
    if (c.b) segs.push(`<div class="seg b" style="height:${(c.b / max * 100).toFixed(2)}%"></div>`);
    const val = o.values && c.a ? `<span class="cv">${o.values(c)}</span>` : "";
    // a column with something behind it opens it
    return c.to ? `<button class="col" type="button" ${dl(c.to)} data-tip="${esc(c.tip)}" aria-label="${esc(c.tip)}">${segs.join("")}${val}</button>`
      : `<div class="col" data-tip="${esc(c.tip)}">${segs.join("")}${val}</div>`;
  }).join("");
  const axis = cols.map((c) => `<span${c.minor ? ' class="minor"' : ""}>${c.label || ""}</span>`).join("");
  return `${legend || ""}<div class="chart${o.cls ? ` ${o.cls}` : ""}${grid ? "" : " bare"}${o.values ? " valued" : ""}${grid && o.unit ? " unit" : ""}">${grid ? `<div class="gridline" style="bottom:${(tick / max * H).toFixed(1)}px"><span>${fmtN(tick)}${o.unit ? (o.unit === "%" ? "%" : ` ${o.unit}`) : ""}</span></div>` : ""}
    <div class="cols" style="height:${H + 8}px" role="img" aria-label="${esc(aria)}">${bars}</div></div><div class="axis${o.cls ? ` ${o.cls}` : ""}" aria-hidden="true">${axis}</div>`;
}
// Every release year from the first to the last, like Letterboxd's (asked 31 Oct 2026: "a year wise graph with the
// number of films released in each year I've watched"): how many films (`mode` "films") or your average rating
// ("rating"), years with none left empty; a label every `every` years and a tick every ten; each year opens its films.
// One stretched SVG, not a column of boxes (the owner, the same day: "all the bars are overlapping on each other"): a
// century of years is under 2px a year on a phone, which boxes round to 1px or 2px, so bars came out uneven (and the
// phone's bars took the padding of the switch that shares their class name, 6px each, and piled up); SVG bars share the
// width evenly. A year's whole slot is its target, so a thin bar is easy to tap. In "rating" a dashed line marks your
// average and years with fewer than RY_FEW ratings are paler. The phone puts the gridline's number in a gutter on the left.
const RY_FEW = 3;
function releaseYearsChart(s, mode, H, every) {
  const ys = s.relYears || [];
  if (!ys.length) return `<div class="empty">No release years in this period.</div>`;
  const rating = mode === "rating", rated = ys.filter((x) => x.ratings.length);
  if (rating && !rated.length) return `<div class="empty">None of these films is rated yet.</div>`;
  const by = new Map(ys.map((x) => [x.year, x])), lo = ys[0].year, hi = ys[ys.length - 1].year, n = hi - lo + 1;
  const step = every || (n > 70 ? 20 : 10);
  const all = rated.flatMap((x) => x.ratings), mean = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  const base = rating ? valuesBase(rated.map((x) => x.avg), 0.5) : 0;
  const top = rating ? Math.max(...rated.map((x) => x.avg)) : Math.max(...ys.map((x) => x.count));
  const pct = (v) => rating ? (v - base) / Math.max(1e-9, top - base) * 92 : v / top * 100;
  // a dozen slots at least, so a few years aren't drawn as a few huge bars
  const slots = Math.max(n, 12), off = (slots - n) / 2, pad = 0.14, few = rating && rated.some((x) => x.ratings.length < RY_FEW), bars = [];
  for (let i = 0; i < n; i++) {
    const y = lo + i, x = by.get(y), r = x ? x.ratings.length : 0, v = rating ? (r ? x.avg : 0) : x ? x.count : 0;
    const tip = `${y}: ${x ? plural(x.count, "film") : "no films"}${r ? ` · ${x.avg.toFixed(2)} average from ${plural(r, "rating")}` : ""}`;
    const h = v ? Math.max(pct(v), 0.8) : 0;
    bars.push(`<g class="yr" ${x ? dl(DR.relYear(x)) : ""} data-tip="${esc(tip)}"><rect class="hit" x="${(off + i).toFixed(2)}" y="0" width="1" height="100"/>${h ? `<rect class="bar${rating && r < RY_FEW ? " few" : ""}" x="${(off + i + pad).toFixed(2)}" y="${(100 - h).toFixed(2)}" width="${(1 - 2 * pad).toFixed(2)}" height="${h.toFixed(2)}"/>` : ""}</g>`);
  }
  const tick = niceTick(top);
  const line = rating ? `<div class="ry-line avg" style="bottom:${pct(mean).toFixed(2)}%"></div>`
    : `<div class="ry-line" style="bottom:${pct(tick).toFixed(2)}%"><span>${fmtN(tick)}<em> films</em></span></div>`;
  const ax = [];
  for (let y = Math.ceil(lo / 10) * 10; y <= hi; y += 10) {
    const at = (off + y - lo + 0.5) / slots * 100;
    ax.push(`<i style="left:${at.toFixed(2)}%"></i>`);
    if (y % step === 0) ax.push(`<span${at < 4 ? ' class="l"' : at > 96 ? ' class="r"' : ""} style="left:${at.toFixed(2)}%">${y}</span>`);
  }
  const label = rating ? "Your average rating by year of release" : "Films by year of release";
  return `<div class="ry${rating ? " rating" : ""}"><div class="ry-plot" style="height:${H}px">${line}<svg viewBox="0 0 ${slots} 100" preserveAspectRatio="none" role="img" aria-label="${label}">${bars.join("")}</svg></div>`
    + `<div class="ry-axis" aria-hidden="true">${ax.join("")}</div>`
    + (rating ? `<p class="ry-note">The dashed line is your average rating, ${mean.toFixed(2)}.${few ? ` Paler years have fewer than ${RY_FEW} ratings.` : ""}</p>` : "") + `</div>`;
}
// Where columns of averages start, so their differences show: half a step below the lowest.
const valuesBase = (vals, step) => { const v = vals.filter((x) => x != null && x > 0); return v.length ? Math.max(0, Math.floor(Math.min(...v) / step) * step - step) : 0; };
function timeline(s) {
  const E = s.entries, cols = [];
  const add = (key, label, tipLabel, minor) => cols.push({ key, a: 0, b: 0, label, tipLabel, minor, es: [] });
  let keyOf;
  if (s.scope !== "all") {
    const y = +s.scope, jan1 = dayIndex(`${y}-01-01`), off = weekdayOf(`${y}-01-01`);
    const weeks = Math.floor((dayIndex(`${y}-12-31`) - jan1 + off) / 7) + 1;
    let prevMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const startIso = isoOfDay(Math.max(jan1, jan1 + w * 7 - off));
      const m = +startIso.slice(5, 7) - 1;
      add(w, m !== prevMonth ? MONTHS[m] : "", `Week of ${fmtDate(isoOfDay(jan1 + w * 7 - off))}`, m % 3 !== 0);
      prevMonth = m;
    }
    keyOf = (e) => Math.floor((dayIndex(e.date) - jan1 + off) / 7);
  } else {
    const first = E[0].date, last = E[E.length - 1].date;
    const months = (+last.slice(0, 4) - +first.slice(0, 4)) * 12 + (+last.slice(5, 7) - +first.slice(5, 7)) + 1;
    if (months <= 60) {
      let y = +first.slice(0, 4), m = +first.slice(5, 7) - 1;
      for (let i = 0; i < months; i++) {
        const label = m === 0 ? String(y) : months <= 24 && m % 3 === 0 ? MONTHS[m] : "";
        add(`${y}-${String(m + 1).padStart(2, "0")}`, label, `${MONTHS_LONG[m]} ${y}`, m !== 0);
        if (++m === 12) { m = 0; y++; }
      }
      keyOf = (e) => e.date.slice(0, 7);
    } else {
      const y0 = +first.slice(0, 4), y1 = +last.slice(0, 4);
      for (let y = y0; y <= y1; y++) add(String(y), (y1 - y0 > 16 && y % 2) ? "" : `’${String(y).slice(2)}`, String(y), y % 5 !== 0);
      keyOf = (e) => e.date.slice(0, 4);
    }
  }
  const idx = new Map(cols.map((c, i) => [c.key, i]));
  for (const e of E) { const c = cols[idx.get(keyOf(e))]; if (c) { e.rewatch ? c.b++ : c.a++; c.es.push(e); } }
  for (const c of cols) {
    c.tip = `${c.tipLabel}: ${plural(c.a + c.b, "film")}${c.b ? ` (${plural(c.b, "rewatch", "rewatches")})` : ""}`;
    if (c.es.length) c.to = D.entries(c.tipLabel, entriesSub(c.es), c.es, { order: "asc" });
  }
  return cols;
}
function heatmap(s) {
  let start, end;
  if (s.scope !== "all") { start = dayIndex(`${s.scope}-01-01`); end = dayIndex(`${s.scope}-12-31`); }
  else { end = dayIndex(s.entries[s.entries.length - 1].date); start = end - 364; }
  const pad = weekdayOf(isoOfDay(start));
  const cells = [], months = [], onDay = new Map();
  for (const e of s.entries) { if (!onDay.has(e.date)) onDay.set(e.date, []); onDay.get(e.date).push(e); }
  for (let i = 0; i < pad; i++) cells.push('<i class="pad"></i>');
  for (let d = start; d <= end; d++) {
    const iso = isoOfDay(d), n = s.byDay.get(iso) || 0;
    cells.push(`<i class="${n ? "l" + Math.min(3, n) : ""}" data-tip="${fmtDate(iso)}: ${plural(n, "film")}"${n ? ` ${dl(DR.day(s.entries, iso, onDay.get(iso) || []))}` : ""}></i>`);
  }
  const weeks = Math.ceil((pad + end - start + 1) / 7);
  for (let w = 0; w < weeks; w++) {
    let label = "";
    for (let k = 0; k < 7; k++) { const d = start - pad + w * 7 + k; if (d >= start && d <= end && isoOfDay(d).endsWith("-01")) label = MONTHS[+isoOfDay(d).slice(5, 7) - 1]; }
    months.push(`<span>${label}</span>`);
  }
  return `<div class="cal-wrap"><div class="cal-months" aria-hidden="true">${months.join("")}</div>
    <div class="cal" role="img" aria-label="Calendar of diary entries, ${fmtDate(isoOfDay(start))} to ${fmtDate(isoOfDay(end))}">${cells.join("")}</div></div>
    <div class="heat-key" aria-hidden="true">Fewer <i></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i> More</div>`;
}

</script>
