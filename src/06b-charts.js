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
// Poster title cards: a title with a long word gets a smaller size, so the word isn't broken in two.
const titleLen = (name) => Math.max(1, ...String(name || "").split(/[\s\-–—/]+/).map((x) => x.length));
const titleFit = (name) => { const w = titleLen(name); return w > 11 ? " xlong" : w > 8 ? " long" : ""; };
// with `--len` the card works out a size its longest word fits at, by its own width (where the browser can; else titleFit)
const titleLenAttr = (name) => ` style="--len:${titleLen(name)}"`;
// "Highest rated needs 4+ rated films, the most that still gives 2024 a top 10."
const castBarText = (s) => `Highest rated needs ${s.castMinRated}+ rated films${s.castTop ? `, the most that still gives ${s.scope} a top ${CAST_TOP}` : ""}, ${s.scope === "all" ? `${CAST_LEAD} of them` : "one"} billed in the top ${LEAD_TOP}.`;
const personSub = (p) => `${plural(p.count, "film")}${p.avg ? ` · ${p.avg.toFixed(2)} average from ${plural(p.ratings.length, "rating")}` : ""}`;

/* ---------- the axes every bar chart shares ---------- */
// Asked 6 Nov 2026: "all the bar charts in the website have no clearly labelled x and y axis" (one faint gridline with
// its number off to the right, and "1940" alone under a decade of years). Every bar chart now has its y axis's name
// over a column of labels down the left, a hairline at each label, its x labels and its x axis's name under them.
// A nice step for about `n` intervals over `range`: 1, 2, 2.5 or 5 times a power of ten (whole numbers for counts).
function niceStep(range, n, ints) {
  const raw = Math.max(range, 1e-9) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  const s = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 && !(ints && p < 10) ? 2.5 : m <= 5 ? 5 : 10) * p;
  return ints ? Math.max(1, Math.round(s)) : s;
}
// The y scale: from `lo` (0, or the value the columns start from, rounded down to a step) to a step at or over the
// highest (`fit`), or to the highest itself at `frac` of the height, the rest left for values written over columns.
// `at(v)` is where v sits, 0 at the baseline and 1 at the top; `ticks` are the values with a line and a label.
function yScale(lo, max, H, { fit = true, frac = 1, ints = false, step: fixed } = {}) {
  const n = H >= 120 ? 4 : H >= 80 ? 3 : 2;
  const step = fixed || niceStep(max - Math.max(0, lo), n, ints);
  const base = lo > 0 ? Math.floor(lo / step + 1e-9) * step : 0;
  const top = fit ? base + Math.max(1, Math.ceil((max - base) / step - 1e-9)) * step : Math.max(max, base + step / 4);
  const at = (v) => (v - base) / (top - base) * frac;
  const ticks = [];
  for (let k = 0; k < 40; k++) { const t = +(base + k * step).toFixed(6); if (at(t) > 1.0001) break; ticks.push(t); }
  return { base, top, step, at, ticks };
}
// Ticks: whole numbers in full under 10,000, compact past it; ratings as stars ("3½★").
const tickN = (v) => v >= 10000 ? `${+(v / 1000).toFixed(1)}K` : fmtN(+v.toFixed(2));
const tickStar = (v) => { const half = Math.abs(v * 2 - Math.round(v * 2)) < 1e-6, w = Math.floor(v + 1e-9), h = v - w > 0.25; return half ? `${w || (h ? "" : "0")}${h ? "½" : ""}★` : `${v.toFixed(2)}★`; };
// The frame around a plot: the y axis's name, the labels down the left (each at its line), the x labels and name.
function axisFrame(S, H, plot, xLabels, o) {
  const fmt = o.yFmt || ((t) => `${tickN(t)}${o.unit === "%" ? "%" : ""}`);
  const labels = S.ticks.map((t) => [S.at(t), fmt(t)]);
  // the label column's width, in the labels' own size: a digit is about 0.62 of it, a star, ½ or % about 1
  const w = Math.max(1, ...labels.map(([, l]) => [...l].reduce((n, ch) => n + (/[★½%]/.test(ch) ? 1 : ch === "." ? 0.35 : 0.66), 0)));
  return `<div class="cx${o.cls ? ` ${o.cls}` : ""}" style="--yw:${(w + 0.3).toFixed(2)}em">` + (o.y ? `<div class="cx-yt">${esc(o.y)}</div>` : "")
    + `<div class="cx-y" style="height:${H}px" aria-hidden="true">${labels.map(([a, l]) => `<span style="bottom:${(a * 100).toFixed(2)}%">${l}</span>`).join("")}</div>`
    + `<div class="cx-p">${plot}</div><div class="cx-x">${xLabels}</div>` + (o.x ? `<div class="cx-xt">${esc(o.x)}</div>` : "") + `</div>`;
}
// The y and x names of a chart whose bars carry their own numbers (the weekdays): no scale, just the names.
const axisNames = (y, body, x) => `<div class="cx plain">${y ? `<div class="cx-yt">${esc(y)}</div>` : ""}<div class="cx-p">${body}</div>${x ? `<div class="cx-xt">${esc(x)}</div>` : ""}</div>`;

/* ---------- column chart: weeks, months, years, ratings, decades ---------- */
// `opts`: `y` and `x` name the axes ("Films", "Rating given"); `unit` "%" writes ticks as percentages; `yFmt` writes
// a tick its own way (stars); `base` starts the columns from that value, not 0 (typical values that drift a little:
// the baseline's label says where); `values` writes a column's value over it (averages, which start from `base` too).
function colChart(cols, aria, legend, H = 162, opts = true) {
  const o = typeof opts === "object" ? opts : {};
  const valued = !!o.values, lo = o.base || 0;
  const max = Math.max(lo + 1e-9, ...cols.map((c) => c.a + (c.b || 0)));
  const ints = !valued && !lo && cols.every((c) => Number.isInteger(c.a) && Number.isInteger(c.b || 0));
  const S = yScale(lo, max, H, { fit: !valued, frac: valued ? 0.82 : 1, ints: ints || o.ints, step: o.step });
  const pct = (v) => (Math.max(0, S.at(v)) * 100).toFixed(2), span = (v) => (v / (S.top - S.base) * (valued ? 0.82 : 1) * 100).toFixed(2);
  const bars = cols.map((c) => {
    const segs = [];
    if (c.a) segs.push(`<div class="seg a" style="height:${pct(c.a)}%"></div>`);
    if (c.b) segs.push(`<div class="seg b" style="height:${span(c.b)}%"></div>`);
    const val = valued && c.a ? `<span class="cv">${o.values(c)}</span>` : "";
    // a column with something behind it opens it
    return c.to ? `<button class="col" type="button" ${dl(c.to)} data-tip="${esc(c.tip)}" aria-label="${esc(c.tip)}">${segs.join("")}${val}</button>`
      : `<div class="col" data-tip="${esc(c.tip)}">${segs.join("")}${val}</div>`;
  }).join("");
  const lines = S.ticks.filter((t) => t > S.base + 1e-9).map((t) => `<div class="gridline" style="bottom:${(S.at(t) * H).toFixed(1)}px"></div>`).join("");
  const axis = cols.map((c) => `<span${c.minor ? ' class="minor"' : ""}>${c.label || ""}</span>`).join("");
  const plot = `<div class="chart${valued ? " valued" : ""}">${lines}<div class="cols" style="height:${H + 8}px" role="group" aria-label="${esc(aria)}">${bars}</div></div>`;
  return (legend || "") + axisFrame(S, H, plot, `<div class="axis">${axis}</div>`, { ...o, y: o.y ?? (o.unit && o.unit !== "%" ? capFirst(o.unit) : "") });
}
// Every release year from the first to the last, like Letterboxd's (asked 31 Oct 2026: "a year wise graph with the
// number of films released in each year I've watched"): how many films (`mode` "films") or your average rating
// ("rating"), years with none left empty; each year opens its films. One stretched SVG, not a column of boxes (the
// owner, the same day: "all the bars are overlapping on each other"): a century of years is under 2px a year on a
// phone, which boxes round to 1px or 2px, so bars came out uneven; SVG bars share the width evenly. A year's whole slot
// is its target, so a thin bar is easy to tap. In "rating" a dashed line marks your average and years with fewer than
// RY_FEW ratings are paler; a line follows your average for the films of the five years around each year (RY_SPAN either
// side, asked 31 Oct 2026, so the drift shows through single years' ups and downs), where those have RY_TREND_MIN
// ratings. Year labels (6 Nov 2026): every year for a short stretch (the 1940s had shown "1940" alone), then every 2,
// 5, 10 or 20, as many as fit (`wide`: the computer's width), with a tick at each label and each tenth year.
const RY_FEW = 3, RY_SPAN = 2, RY_TREND_MIN = 5;
function releaseYearsChart(s, mode, H, wide) {
  const ys = s.relYears || [];
  if (!ys.length) return `<div class="empty">No release years in this period.</div>`;
  const rating = mode === "rating", rated = ys.filter((x) => x.ratings.length);
  if (rating && !rated.length) return `<div class="empty">None of these films is rated yet.</div>`;
  const by = new Map(ys.map((x) => [x.year, x])), lo = ys[0].year, hi = ys[ys.length - 1].year, n = hi - lo + 1;
  const room = wide ? 16 : 7, step = [1, 2, 5, 10, 20, 25, 50].find((k) => Math.floor(hi / k) - Math.ceil(lo / k) + 1 <= room) || 50;
  const all = rated.flatMap((x) => x.ratings), mean = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  const top = rating ? Math.max(...rated.map((x) => x.avg)) : Math.max(...ys.map((x) => x.count));
  const S = rating ? yScale(valuesBase(rated.map((x) => x.avg), 0.5), top, H, { fit: false, frac: 0.92, step: top - valuesBase(rated.map((x) => x.avg), 0.5) > 1.6 ? 1 : 0.5 })
    : yScale(0, top, H, { ints: true });
  const pct = (v) => S.at(v) * 100;
  // the trend: every rating of the films released within RY_SPAN years either side
  const trend = (y) => { if (!rating) return null; const r = []; for (let k = y - RY_SPAN; k <= y + RY_SPAN; k++) { const x = by.get(k); if (x) r.push(...x.ratings); } return r.length >= RY_TREND_MIN ? r.reduce((a, b) => a + b, 0) / r.length : null; };
  const span = (y) => `${Math.max(lo, y - RY_SPAN)}–${Math.min(hi, y + RY_SPAN)}`;
  // a dozen slots at least, so a few years aren't drawn as a few huge bars
  const slots = Math.max(n, 12), off = (slots - n) / 2, pad = 0.14, few = rating && rated.some((x) => x.ratings.length < RY_FEW), bars = [];
  for (let i = 0; i < n; i++) {
    const y = lo + i, x = by.get(y), r = x ? x.ratings.length : 0, v = rating ? (r ? x.avg : 0) : x ? x.count : 0;
    const t = trend(y), tip = `${y}: ${x ? plural(x.count, "film") : "no films"}${r ? ` · ${x.avg.toFixed(2)} average from ${plural(r, "rating")}` : ""}${t != null ? ` · films of ${span(y)} ${t.toFixed(2)}` : ""}`;
    const h = v ? Math.max(pct(v), 0.8) : 0;
    bars.push(`<g class="yr" ${x ? dl(DR.relYear(x)) : ""} data-tip="${esc(tip)}"><rect class="hit" x="${(off + i).toFixed(2)}" y="0" width="1" height="100"/>${h ? `<rect class="bar${rating && r < RY_FEW ? " few" : ""}" x="${(off + i + pad).toFixed(2)}" y="${(100 - h).toFixed(2)}" width="${(1 - 2 * pad).toFixed(2)}" height="${h.toFixed(2)}"/>` : ""}</g>`);
  }
  // the trend as runs of points, broken where too few films were rated; drawn over the bars with a dark edge
  const runs = [];
  if (rating) { let run = []; for (let i = 0; i < n; i++) { const t = trend(lo + i); if (t == null) { if (run.length > 1) runs.push(run); run = []; } else run.push(`${(off + i + 0.5).toFixed(2)},${(100 - Math.max(pct(t), 0.8)).toFixed(2)}`); } if (run.length > 1) runs.push(run); }
  const trendSvg = runs.map((r) => `<polyline class="trend-edge" points="${r.join(" ")}" vector-effect="non-scaling-stroke"/><polyline class="trend" points="${r.join(" ")}" vector-effect="non-scaling-stroke"/>`).join("");
  // a hairline at each label of the scale, and in "rating" the dashed line at your average
  const line = S.ticks.filter((v) => v > S.base + 1e-9).map((v) => `<div class="ry-line guide" style="bottom:${pct(v).toFixed(2)}%"></div>`).join("")
    + (rating ? `<div class="ry-line avg" style="bottom:${pct(mean).toFixed(2)}%"></div>` : "");
  const ax = [];
  for (let y = lo; y <= hi; y++) {
    const label = y % step === 0, tick = label || y % 10 === 0;
    if (!tick) continue;
    const at = (off + y - lo + 0.5) / slots * 100;
    ax.push(`<i style="left:${at.toFixed(2)}%"></i>`);
    if (label) ax.push(`<span${at < 4 ? ' class="l"' : at > 96 ? ' class="r"' : ""} style="left:${at.toFixed(2)}%">${y}</span>`);
  }
  const label = rating ? "Your average rating by year of release" : "Films by year of release";
  const plot = `<div class="ry-plot" style="height:${H}px">${line}<svg viewBox="0 0 ${slots} 100" preserveAspectRatio="none" role="img" aria-label="${label}">${bars.join("")}${trendSvg}</svg></div>`;
  return `<div class="ry${rating ? " rating" : ""}">` + axisFrame(S, H, plot, `<div class="ry-axis" aria-hidden="true">${ax.join("")}</div>`,
    { y: rating ? "Your average rating" : "Films", x: "Year of release", yFmt: rating ? tickStar : null })
    + (rating ? `<p class="ry-note">${runs.length ? "The solid line is your average for the films of the five years around each year. " : ""}The dashed line is your average rating, ${mean.toFixed(2)}.${few ? ` Paler years have fewer than ${RY_FEW} ratings.` : ""}</p>` : "") + `</div>`;
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
  return `<div class="cal-wrap" tabindex="0" role="region" aria-label="Calendar, scrolls sideways"><div class="cal-months" aria-hidden="true">${months.join("")}</div>
    <div class="cal" role="img" aria-label="Calendar of diary entries, ${fmtDate(isoOfDay(start))} to ${fmtDate(isoOfDay(end))}">${cells.join("")}</div></div>
    <div class="heat-key" aria-hidden="true">Fewer <i></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i> More</div>`;
}

</script>
