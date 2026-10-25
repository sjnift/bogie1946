<script>
/* ---------- the world map: where your films were made, the more films the deeper the colour (asked Oct 2026). Each
   country shows its numbers on hover and opens its films; both layouts draw it (desktop under Genre & origin, phone in
   Stats › Breakdown). Shapes and names are in WORLD (06n-world.js). ---------- */
const normCountry = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/^the\s+|,\s*the$/g, "").replace(/[^a-z0-9]+/g, " ").trim();
let WORLD_INDEX = null;
function worldIndex() {
  if (WORLD_INDEX) return WORLD_INDEX;
  const code = new Map(), gone = new Map();
  for (const [c, names] of Object.entries(WORLD.names)) for (const n of names) code.set(n, c);
  for (const [name, g] of Object.entries(WORLD.gone)) for (const n of g.names) gone.set(n, name);
  return (WORLD_INDEX = { code, gone });
}
// The period's countries on the map: one place per code, its films each counted once (two spellings of a country are
// one place), the countries that no longer exist, and any name the map doesn't know.
function worldData(countries) {
  const { code, gone } = worldIndex();
  const at = new Map(), old = new Map(), off = [];
  for (const c of countries.most) {
    const n = normCountry(c.name), g = gone.get(n), k = code.get(n);
    const into = g ? old : k ? at : null, key = g || k;
    if (!into) { off.push(c); continue; }
    if (!into.has(key)) into.set(key, { code: k || null, name: g || c.name, names: [], films: new Set() });
    const x = into.get(key);
    x.names.push(c.name);
    for (const f of c.films) x.films.add(f);
  }
  const done = (x) => { const films = [...x.films], r = films.filter((f) => f.rating); return { ...x, films, count: films.length, ratings: r.map((f) => f.rating), avg: r.length ? avg(r.map((f) => f.rating)) : 0 }; };
  const places = [...at.values()].map(done).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { places, by: new Map(places.map((p) => [p.code, p])), gone: [...old.values()].map(done).sort((a, b) => b.count - a.count), off };
}
// Five steps of shading, spaced so a long tail of countries with a film or two still shows apart from the few with hundreds.
function worldSteps(max) {
  const nice = [2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000];
  const cuts = [1];
  for (let k = 1; k < 5; k++) {
    const want = Math.pow(max, k / 5), n = nice.filter((x) => x > cuts[cuts.length - 1] && x <= max).sort((a, b) => Math.abs(Math.log(a / want)) - Math.abs(Math.log(b / want)))[0];
    if (n) cuts.push(n);
  }
  const lo = [...new Set(cuts)].sort((a, b) => a - b);
  return lo.map((a, i) => ({ lo: a, hi: i + 1 < lo.length ? lo[i + 1] - 1 : Infinity, cls: `l${i + 1 + (5 - lo.length)}` }));
}
const stepLabel = (st) => st.hi === Infinity ? `${fmtN(st.lo)}+` : st.hi === st.lo ? fmtN(st.lo) : `${fmtN(st.lo)}–${fmtN(st.hi)}`;
// The map, its key, and the countries that are no longer on it. o.scope is the year (or "all"), o.total the period's films.
function worldMapHtml(countries, o) {
  const W = worldData(countries), Y = o.scope === "all" ? "" : o.scope;
  if (!W.places.length && !W.gone.length && !W.off.length) return "";
  const steps = worldSteps(W.places.length ? W.places[0].count : 1);
  const stepOf = (n) => steps.find((st) => n >= st.lo && n <= st.hi);
  const filmsTo = (p) => D.films(p.name, filmsSub(p.films), p.films, { scope: o.scope });
  // what came from a country that no longer exists, said on each country that came out of it
  const formerly = new Map();
  for (const g of W.gone) for (const c of WORLD.gone[g.name].codes) formerly.set(c, [...(formerly.get(c) || []), g]);
  const tipOf = (p, c) => {
    const lines = [];
    if (p) {
      const share = o.total ? p.count / o.total * 100 : 0;
      lines.push(`${plural(p.count, "film")}${Y ? ` in ${Y}` : ""} · ${share < 1 ? "under 1" : Math.round(share)}% of ${filterOn() ? "these" : "your"} films`);
      if (p.ratings.length) lines.push(`Your average ${p.avg.toFixed(2)}★ from ${plural(p.ratings.length, "rated film")}`);
      const lead = (key, one) => { const n = new Map(); for (const f of p.films) { const m = metaOf(f); for (const v of new Set(one ? (m && m[key] ? [m[key]] : []) : (m && m[key]) || [])) n.set(v, (n.get(v) || 0) + 1); }
        return [...n].sort((a, b) => b[1] - a[1])[0]; };
      const g = lead("g"), l = lead("l", true);
      if (g || l) lines.push(`Mostly ${[g && g[0].toLowerCase(), l && `in ${l[0]}`].filter(Boolean).join(", ")}`);
      const best = p.films.filter((f) => f.rating).sort((a, b) => b.rating - a.rating || (b.year || 0) - (a.year || 0))[0];
      if (best) lines.push(`Highest rated: ${best.name}${best.year ? ` (${best.year})` : ""} ${stars(best.rating)}`);
    } else lines.push(`No films${Y ? ` in ${Y}` : ""}`);
    for (const g of formerly.get(c) || []) lines.push(`Also ${plural(g.count, "film")} from ${g.name === "Soviet Union" ? "the " : ""}${g.name}`);
    return lines.join("\n");
  };
  const attrs = (c) => {
    const p = W.by.get(c), name = p ? p.name : WORLD.label[c] || c;
    return `${p ? `class="wc ${stepOf(p.count).cls}" ${dl(filmsTo(p))}` : `class="wc"`} data-tip-h="${esc(name)}" data-tip="${esc(tipOf(p, c))}" aria-label="${esc(name)}: ${p ? plural(p.count, "film") : "no films"}"`;
  };
  // countries with films go last, the most last, so their outline shows over their neighbours'
  const order = (c) => (W.by.get(c) || { count: 0 }).count;
  const shapes = WORLD.shapes.slice().sort((a, b) => order(a[0]) - order(b[0])).map(([c, d]) => `<path d="${d}" ${attrs(c)}/>`).join("");
  const dots = WORLD.dots.filter(([c]) => W.by.has(c)).map(([c, x, y]) => `<circle cx="${x}" cy="${y}" r="9" ${attrs(c)}/>`).join("");
  const key = `<div class="wkey" aria-label="Key"><span class="wk"><i class="wc"></i>None</span>${steps.map((st) => {
    const ps = W.places.filter((p) => p.count >= st.lo && p.count <= st.hi);
    const label = `<i class="wc ${st.cls}"></i>${stepLabel(st)}`;
    return ps.length ? `<button class="wk" type="button" ${dl(D.names(`Countries with ${stepLabel(st)} ${st.lo === 1 && st.hi === 1 ? "film" : "films"}`, `${plural(ps.length, "country", "countries")}${Y ? ` · ${Y}` : ""}`,
      ps.map((p) => ({ name: p.name, films: p.films, value: fmtN(p.count), note: filmsSub(p.films), to: filmsTo(p) }))))}>${label}</button>` : `<span class="wk">${label}</span>`;
  }).join("")}<span class="wk-unit">films</span></div>`;
  const elsewhere = [...W.gone, ...W.off.map((c) => ({ name: c.name, films: c.films, count: c.count }))];
  const gone = elsewhere.length ? `<p class="wgone">Not on today's map: ${elsewhere.map((p) => `${dlink(D.films(p.name, filmsSub(p.films), p.films, { scope: o.scope }), esc(p.name))} <span class="muted">${fmtN(p.count)}</span>`).join(", ")}.</p>` : "";
  // on the computer the countries' column is gone from Genre & origin, so the map says who leads, in two lines
  const toOf = (c) => D.films(c.name, filmsSub(c.films), c.films, { scope: o.scope });
  const lead = (label, list, value) => list.length ? `<p class="wtops"><span class="k">${label}</span> ${list.slice(0, 6).map((c) => `${dlink(toOf(c), esc(c.name))} <span class="muted">${value(c)}</span>`).join(" · ")}</p>` : "";
  const tops = o.tops ? lead("Most watched", countries.most, (c) => fmtN(c.count))
    + lead("Highest rated", countries.best, (c) => c.avg.toFixed(2))
    + (countries.most.length > 6 ? `<p class="wtops">${dlink(D.names("Countries", `${plural(countries.most.length, "country", "countries")}, most watched first`, countries.most.map((c) => ({ name: c.name, films: c.films, value: fmtN(c.count),
      note: `${plural(c.count, "film")}${c.avg ? ` · ${c.avg.toFixed(2)} average` : ""}`, to: toOf(c) }))), `All ${fmtN(countries.most.length)} countries ›`)}</p>` : "") : "";
  return `<div class="wmap"><svg class="wsvg" viewBox="0 0 ${WORLD.w} ${WORLD.h}" role="group" aria-label="World map of where your films were made">${shapes}${dots}</svg>${key}${tops}${gone}</div>`;
}
</script>
