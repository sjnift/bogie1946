<script>
/* ---------- helpers and charts shared by the desktop and phone pages ---------- */
const initials = (name) => name.replace(/[^\p{L}\s-]/gu, "").split(/[\s-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
// A small link to the TMDB page a film was matched to, so a wrong match is easy to spot.
const tmdbLink = (f) => {
  const m = f && META[f.key];
  return m && m.src === "tmdb" && Number(m.id) && !IN_VIEWER ? ` <a class="tmdb-link" href="https://www.themoviedb.org/movie/${Number(m.id)}" target="_blank" rel="noopener" title="See the film this was matched to on TMDB">TMDB ↗</a>` : "";
};
const isoOfDay = (d) => new Date(d * 864e5).toISOString().slice(0, 10);
function niceTick(max) {
  const raw = max * 0.8, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  return Math.max(1, (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p);
}
const personSub = (p) => `${plural(p.count, "film")}${p.avg ? ` · ${p.avg.toFixed(2)} average from ${plural(p.ratings.length, "rating")}` : ""}`;

/* ---------- column chart: weeks, months, years, ratings, decades ---------- */
function colChart(cols, aria, legend, H = 162) {
  const max = Math.max(1, ...cols.map((c) => c.a + (c.b || 0)));
  const tick = niceTick(max);
  const bars = cols.map((c) => {
    const segs = [];
    if (c.a) segs.push(`<div class="seg a" style="height:${(c.a / max * 100).toFixed(2)}%"></div>`);
    if (c.b) segs.push(`<div class="seg b" style="height:${(c.b / max * 100).toFixed(2)}%"></div>`);
    // a column with something behind it opens it
    return c.to ? `<button class="col" type="button" ${dl(c.to)} data-tip="${esc(c.tip)}" aria-label="${esc(c.tip)}">${segs.join("")}</button>`
      : `<div class="col" data-tip="${esc(c.tip)}">${segs.join("")}</div>`;
  }).join("");
  const axis = cols.map((c) => `<span${c.minor ? ' class="minor"' : ""}>${c.label || ""}</span>`).join("");
  return `${legend || ""}<div class="chart"><div class="gridline" style="bottom:${(tick / max * H).toFixed(1)}px"><span>${fmtN(tick)}</span></div>
    <div class="cols" style="height:${H + 8}px" role="img" aria-label="${esc(aria)}">${bars}</div></div><div class="axis" aria-hidden="true">${axis}</div>`;
}
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
