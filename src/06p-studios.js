<script>
/* ---------- studios (asked 31 Oct 2026: "a Studio pie chart in insights on both app and web page … studios which
   are most watched by the user") ----------
   TMDB lists the companies that made a film (`co`, kept at lookup in TMDB's order). Each film counts once, under one
   studio, so the pie's slices add up to the films (never double count): the first of its companies that's a studio
   in STUDIOS (Universal for Oppenheimer, which TMDB lists after Syncopy; 20th Century Fox for Alien, after
   Brandywine), else the first it lists (PolyGram for The Big Lebowski). A studio's labels and old names are one
   (Fox 2000 and Twentieth Century-Fox are 20th Century Fox; Warner Bros. Animation is Warner Bros.). On the owner's
   1,557 films (31 Oct 2026): 490 studios, Warner Bros. first with 160, the top six about two films in five. */
const STUDIOS = [
  ["Warner Bros.", /^warner (bros|brothers)\b|^warner (premiere|independent pictures|animation group)\b/i],
  ["20th Century Fox", /^(20th|twentieth) century|^fox (2000|film corporation)\b/i],
  ["Searchlight Pictures", /^(fox )?searchlight pictures\b/i],
  ["Paramount", /^paramount\b/i],
  ["Columbia Pictures", /^columbia pictures\b/i],
  ["Universal Pictures", /^universal (pictures|international|film manufacturing|studios|productions)\b/i],
  ["Metro-Goldwyn-Mayer", /^metro-goldwyn-mayer|^mgm\b|^metro pictures corporation\b/i],
  ["United Artists", /^united artists\b/i],
  ["Walt Disney", /^walt disney (pictures|productions|animation|feature animation)\b|^disney(toon)? /i],
  ["Pixar", /^pixar\b/i],
  ["Marvel Studios", /^marvel (studios|entertainment|enterprises)\b/i],
  ["Lucasfilm", /^lucasfilm\b/i],
  ["RKO Radio Pictures", /^rko\b/i],
  ["DreamWorks", /^dreamworks (pictures|skg)\b|^dreamworks$/i],
  ["DreamWorks Animation", /^dreamworks animation\b/i],
  ["New Line Cinema", /^new line\b/i],
  ["Miramax", /^miramax\b/i],
  ["Dimension Films", /^dimension films\b/i],
  ["The Weinstein Company", /^the weinstein company\b/i],
  ["Lionsgate", /^lions ?gate\b/i],
  ["Summit Entertainment", /^summit entertainment\b/i],
  ["Focus Features", /^focus features\b/i],
  ["TriStar Pictures", /^tri-?star pictures\b/i],
  ["Touchstone Pictures", /^touchstone pictures\b/i],
  ["Hollywood Pictures", /^hollywood pictures\b/i],
  ["Orion Pictures", /^orion pictures\b/i],
  ["Sony Pictures Classics", /^sony pictures classics\b/i],
  ["Sony Pictures Animation", /^sony pictures animation\b/i],
  ["A24", /^a24\b/i],
  ["Neon", /^neon$/i],
  ["Netflix", /^netflix\b/i],
  ["Amazon MGM Studios", /^amazon (studios|mgm studios)\b/i],
  ["Apple Studios", /^apple (studios|original films)\b/i],
  ["StudioCanal", /^(le )?studio ?canal\b/i],
  ["Gaumont", /^gaumont\b/i],
  ["Pathé", /^(soci[ée]t[ée] (nationale |nouvelle )?)?path[ée]\b/i],
  ["The Rank Organisation", /^(j\. arthur |the )?rank organisation\b/i],
  ["Ealing Studios", /^ealing studios\b/i],
  ["Toho", /^toho\b/i],
  ["Shochiku", /^shochiku\b/i],
  ["Daiei", /^daiei\b/i],
  ["Nikkatsu", /^nikkatsu\b/i],
  ["Studio Ghibli", /^studio ghibli\b/i],
  ["Republic Pictures", /^republic pictures\b/i],
  ["Allied Artists", /^allied artists\b/i],
];
// A company as a studio: its family's name when it's one of STUDIOS, else its own name without "Inc." and the like.
function studioName(n) {
  n = String(n || "").trim();
  for (const [name, re] of STUDIOS) if (re.test(n)) return { name, known: true };
  return { name: n.replace(/,?\s+(inc|ltd|llc|corp|corporation|co)\.?$/i, "").trim(), known: false };
}
// A film's studio ("" when TMDB lists none; null when its details were read before studios were kept).
function filmStudio(m) {
  if (!m || m.miss || !Array.isArray(m.co)) return null;
  const all = m.co.map(studioName).filter((s) => s.name);
  return (all.find((s) => s.known) || all[0] || {}).name || "";
}
// The pie: the top STUDIO_SLICES studios and "Other studios" for the rest, unless the rest would be more than
// OTHER_MAX of the films (asked 31 Oct 2026: a big grey slice said nothing; on the owner's films it was three in
// five): then only the top STUDIO_TOP, against each other.
const STUDIO_SLICES = 6, STUDIO_TOP = 7, OTHER_MAX = 0.1;
// The studios of some films, each film once: every studio by films (then rating), the pie's slices, how many films
// the pie holds (`pieTotal`; less than `total` when it shows only the top studios, `topOnly`), films TMDB lists no
// studio for, films not read for studios yet, and the best and worst rated of the studios with `minRated` or more
// rated films.
function studioData(films, metaOf, minRated) {
  const by = new Map(), none = [], later = [];
  for (const f of new Set(films)) {
    const s = filmStudio(metaOf(f));
    if (s === null) { if (metaOf(f)) later.push(f); continue; }
    if (!s) { none.push(f); continue; }
    (by.get(s) || by.set(s, []).get(s)).push(f);
  }
  const avgOf = (fs) => { const r = fs.map((f) => f.rating).filter((x) => x > 0); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null; };
  const all = [...by].map(([name, fs]) => ({ key: name, name, films: fs, avg: avgOf(fs), rated: fs.filter((f) => f.rating > 0).length }))
    .sort((a, b) => b.films.length - a.films.length || (b.avg || 0) - (a.avg || 0) || a.name.localeCompare(b.name));
  const total = all.reduce((n, s) => n + s.films.length, 0);
  const count = (list) => list.reduce((n, s) => n + s.films.length, 0);
  let top = all, rest = [], topOnly = false;
  if (all.length > STUDIO_TOP) {
    rest = all.slice(STUDIO_SLICES);
    if (count(rest) > OTHER_MAX * total) { top = all.slice(0, STUDIO_TOP); rest = []; topOnly = true; }
    else top = all.slice(0, STUDIO_SLICES);
  }
  const slices = top.map((s, i) => ({ ...s, slot: i + 1 }));
  if (rest.length) slices.push({ key: "", name: `Other studios`, films: rest.flatMap((s) => s.films), avg: avgOf(rest.flatMap((s) => s.films)), studios: rest, slot: 0 });
  const judged = all.filter((s) => s.rated >= minRated && s.avg != null).sort((a, b) => b.avg - a.avg);
  return { all, slices, total, pieTotal: count(slices), topOnly, none, later, best: judged.length >= 2 ? judged[0] : null, worst: judged.length >= 2 ? judged[judged.length - 1] : null, minRated };
}
// A pie of the slices, each its own colour (`--pie-1`… on each layout; "Other" `--pie-o`), with a surface-coloured
// edge between slices; every slice opens its films, and says on hover its films, its share of all the films (and of
// the pie, when it shows only the top studios) and your average.
// A studio's name as it goes inside its slice: a label's last word left off (Columbia Pictures, Marvel Studios), and a
// few names everyone shortens (asked 1 Nov 2026: "add studio names inside the colors in pie chart itself").
const PIE_SHORT = { "Metro-Goldwyn-Mayer": "MGM", "RKO Radio Pictures": "RKO", "Other studios": "Other" };
function pieShort(name) {
  if (PIE_SHORT[name]) return PIE_SHORT[name];
  let n = String(name).trim(), m;
  while ((m = n.match(/^(.{2,}?)[\s,]+(Pictures|Picture|Studios|Studio|Films|Productions|Entertainment|Corporation|Company|Inc\.?|Ltd\.?|LLC)$/))) n = m[1];
  return n;
}
// Where a name fits inside a slice from angle a to b (the pie's units: radius 96 about 100,100): flat, at a few
// distances from the middle, else along the slice for a thin one, on one line or two, as large as fits from 11 down to
// 7; nothing if it doesn't fit at all (the key beside names every slice). Each letter's width is guessed from its shape
// (bold: M and W wide, i and l narrow; a plain 0.6 a letter let MGM touch its slice's edge on the phone).
const PIE_R = 96, PIE_C = 100, PIE_LH = 1.15, PIE_PAD = 1.6;
const pieEm = (t) => [...t].reduce((w, c) => w + (/[MWmw@]/.test(c) ? 0.9 : /[A-Z0-9&]/.test(c) ? 0.7 : /[ilj.,'’!|:;\s]/.test(c) ? 0.32 : /[frt()\-]/.test(c) ? 0.42 : 0.6), 0);
function pieLabelAt(name, a, b) {
  const words = pieShort(name).split(/\s+/), splits = [[words.join(" ")]];
  if (words.length > 1) {
    let best = null;
    for (let i = 1; i < words.length; i++) { const l = [words.slice(0, i).join(" "), words.slice(i).join(" ")], m = Math.max(l[0].length, l[1].length); if (!best || m < best.m) best = { l, m }; }
    splits.push(best.l);
  }
  const th = b - a, mid = (a + b) / 2, maxR = PIE_R - 4;
  const inside = (x, y) => {
    const r = Math.hypot(x, y);
    if (r > maxR) return false;
    if (th >= 2 * Math.PI - 1e-9) return true;
    let t = Math.atan2(y, x);
    while (t < a) t += 2 * Math.PI;
    while (t >= a + 2 * Math.PI) t -= 2 * Math.PI;
    const d = r > PIE_PAD ? Math.asin(Math.min(1, PIE_PAD / r)) : Math.PI;
    return t >= a + d && t <= b - d;
  };
  const box = (lines, f) => ({ w: Math.max(...lines.map(pieEm)) * f, h: lines.length * f * PIE_LH });
  const flat = (lines, f) => {
    const { w, h } = box(lines, f);
    for (const k of th >= 2 * Math.PI - 1e-9 ? [0] : [0.58, 0.52, 0.64, 0.46, 0.7, 0.4]) {
      const x = k * PIE_R * Math.cos(mid), y = k * PIE_R * Math.sin(mid);
      if ([[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sy]) => inside(x + sx * w / 2, y + sy * h / 2))) return { x, y, rot: 0, lines, f };
    }
    return null;
  };
  const along = (lines, f) => {
    if (th >= Math.PI) return null;
    const { w, h } = box(lines, f), inner = (h / 2 + PIE_PAD) / Math.sin(th / 2);
    if (inner + w > maxR) return null;
    const rho = (inner + maxR) / 2, deg = mid * 180 / Math.PI;
    return { x: rho * Math.cos(mid), y: rho * Math.sin(mid), rot: Math.cos(mid) < 0 ? deg + 180 : deg, lines, f };
  };
  // flat if it fits at a good size, else along a thin slice, else flat and small
  const tries = [[flat, 11, 8], [along, 11, 7], [flat, 7.5, 7]];
  for (const [how, hi, lo] of tries) for (let f = hi; f >= lo; f -= 0.5) for (const lines of splits) { const L = how(lines, f); if (L) return L; }
  return null;
}
function pieLabel(name, a, b, slot) {
  const L = pieLabelAt(name, a, b);
  if (!L) return "";
  const x = (PIE_C + L.x).toFixed(1), y = (PIE_C + L.y).toFixed(1), lh = L.f * PIE_LH;
  return `<text class="pie-t s${slot}" x="${x}" y="${y}" font-size="${L.f}" text-anchor="middle" aria-hidden="true"${L.rot ? ` transform="rotate(${L.rot.toFixed(1)} ${x} ${y})"` : ""}>${L.lines.map((l, i) => `<tspan x="${x}" dy="${(i ? lh : -(L.lines.length - 1) * lh / 2 + L.f * 0.36).toFixed(2)}">${esc(l)}</tspan>`).join("")}</text>`;
}
function pieSvg(S, toOf) {
  const R = PIE_R, C = PIE_C, pc = (n, of) => { const p = n / of * 100; return p < 1 ? "<1%" : `${Math.round(p)}%`; };
  const tip = (s) => `${plural(s.films.length, "film")} · ${pc(s.films.length, S.total)} of your films${S.topOnly ? ` · ${pc(s.films.length, S.pieTotal)} of the pie` : ""}${s.avg ? ` · your average ${s.avg.toFixed(2)}★` : ""}`;
  const attrs = (s) => `class="pie-s" fill="var(--pie-${s.slot || "o"})" ${dl(toOf(s))} role="button" tabindex="0" data-tip-h="${esc(s.name)}" data-tip="${esc(tip(s))}" aria-label="${esc(`${s.name}: ${tip(s)}`)}"`;
  const label = S.topOnly ? `Your top ${S.slices.length} studios` : "Your films by studio";
  if (S.slices.length === 1) return `<svg class="pie" viewBox="0 0 200 200" role="group" aria-label="${label}"><circle cx="${C}" cy="${C}" r="${R}" ${attrs(S.slices[0])}/>${pieLabel(S.slices[0].name, 0, 2 * Math.PI, S.slices[0].slot || "o")}</svg>`;
  let a = -Math.PI / 2;
  const pt = (t) => `${(C + R * Math.cos(t)).toFixed(2)} ${(C + R * Math.sin(t)).toFixed(2)}`, names = [];
  const paths = S.slices.map((s) => {
    const b = a + s.films.length / S.pieTotal * 2 * Math.PI, d = `M${C} ${C} L${pt(a)} A${R} ${R} 0 ${b - a > Math.PI ? 1 : 0} 1 ${pt(b)} Z`;
    names.push(pieLabel(s.name, a, b, s.slot || "o"));
    a = b;
    return `<path d="${d}" ${attrs(s)}/>`;
  }).join("");
  // the names over every slice, so a slice's edge never cuts across its neighbour's name
  return `<svg class="pie" viewBox="0 0 200 200" role="group" aria-label="${label}">${paths}${names.join("")}</svg>`;
}
// The whole block, for Insights on both layouts: the pie, its key (each studio with its films, share and your
// average), every studio as a list, and a sentence each for the biggest, the best and the worst rated.
// `scope` is "all" or a year; `films` the films of that scope.
function studiosHtml(films, metaOf, scope, phone) {
  const where = scope === "all" ? "" : ` in ${scope}`;
  const S = studioData(films, metaOf, scope === "all" ? 8 : 3);
  const later = S.later.length ? `${plural(S.later.length, "film")} still ${S.later.length === 1 ? "needs its" : "need their"} studio from TMDB: they're read with the next lookup.` : "";
  if (S.all.length < 2) return `<div class="empty">${S.all.length ? `All your films${where} come from one studio, ${esc(S.all[0].name)}.` : `No studios to show${where} yet: they come from TMDB with cast and crew.`}${later ? ` ${later}` : ""}</div>`;
  const filmsTo = (s) => s.studios ? D.names(`Other studios${where}`, `${plural(s.studios.length, "studio")}, ${plural(s.films.length, "film")}`, s.studios.map((x) => ({ ...x, note: noteOf(x) })), { scope })
    : D.films(`${s.name}${where}`, filmsSub(s.films), s.films, { scope });
  const noteOf = (s) => `${plural(s.films.length, "film")}${s.avg ? ` · your average ${s.avg.toFixed(2)}★` : ""}`;
  const pct = (n) => { const p = n / S.total * 100; return p < 1 ? "<1%" : `${Math.round(p)}%`; };
  const key = `<ul class="pie-key">${S.slices.map((s) => `<li><span class="sw" style="background:var(--pie-${s.slot || "o"})" aria-hidden="true"></span>${dlink(filmsTo(s), esc(s.studios ? `Other studios (${fmtN(s.studios.length)})` : s.name))}<span class="pk-n">${fmtN(s.films.length)}</span><span class="pk-p">${pct(s.films.length)}</span><span class="pk-a">${s.avg ? `${s.avg.toFixed(2)}★` : "–"}</span></li>`).join("")}</ul>`;
  const lead = S.all[0], lines = [];
  lines.push(dline(D.films(`${lead.name}${where}`, filmsSub(lead.films), lead.films, { scope }), `${esc(lead.name)} made ${fmtN(lead.films.length)} of your ${fmtN(S.total)} films${where} (${pct(lead.films.length)}), more than any other studio.`));
  if (S.best && S.worst && S.best !== S.worst) lines.push(`Of the studios with ${S.minRated} or more rated films, you rate ${dlink(D.films(`${S.best.name}${where}`, filmsSub(S.best.films), S.best.films, { scope }), esc(S.best.name))}'s highest (${S.best.avg.toFixed(2)}★ over ${S.best.rated}) and ${dlink(D.films(`${S.worst.name}${where}`, filmsSub(S.worst.films), S.worst.films, { scope }), esc(S.worst.name))}'s lowest (${S.worst.avg.toFixed(2)}★ over ${S.worst.rated}).`);
  const every = dlink(D.names(`Studios${where}`, `${plural(S.all.length, "studio")}, each film once, under its studio`, S.all.map((s) => ({ ...s, note: noteOf(s) })), { scope }), `All ${fmtN(S.all.length)} studios`);
  if (S.topOnly) lines.push(`The pie shows your top ${S.slices.length} studios against each other: together they made ${fmtN(S.pieTotal)} of your ${fmtN(S.total)} films${where} (${pct(S.pieTotal)}); the other ${fmtN(S.all.length - S.slices.length)} studios made the rest. The Share column is of all your films${where}.`);
  const foot = `<p class="status pie-note">Each film counts once, under its studio: the first studio TMDB lists for it among the big ones (a studio's labels together), else the first company it lists. ${every}<span class="go" aria-hidden="true">&nbsp;›</span>${S.none.length ? ` · ${plural(S.none.length, "film")} with no studio on TMDB` : ""}${later ? ` · ${later}` : ""}</p>`;
  return `<div class="studios${phone ? " m" : ""}"><div class="pie-wrap">${pieSvg(S, filmsTo)}</div><div class="pie-side"><div class="pie-head" aria-hidden="true"><span></span><span>Studio</span><span class="pk-n">Films</span><span class="pk-p">Share</span><span class="pk-a">Avg</span></div>${key}</div></div>`
    + `<div class="pie-lines">${lines.map((l) => `<p class="lead">${l}</p>`).join("")}</div>` + foot;
}
</script>
