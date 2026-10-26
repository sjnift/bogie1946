<script>
/* ---------- drill-downs: what a click on any number opens ----------
   A drill describes the data behind a stat: the films, diary entries, reviews, people or single film it counts.
   Each link registers one under an id (data-list="…"); the pop-up and the full page render it the same way. */
let LISTS = new Map(), PANEL = new Map(), listSeq = 0, regInto = null;
function drill(d) { const id = "l" + (++listSeq); (regInto || LISTS).set(id, d); return id; }
const drillGet = (id) => PANEL.get(id) || LISTS.get(id);
// Render something whose links belong to the pop-up, so a page re-render can't drop them.
function inPanel(fn) { const was = regInto; regInto = PANEL; try { return fn(); } finally { regInto = was; } }
function reg(title, sub, films, person) { return drill({ kind: "films", title, sub, films, person }); }
const D = {
  films: (title, sub, films, o) => ({ kind: "films", title, sub, films, ...o }),
  entries: (title, sub, entries, o) => ({ kind: "entries", title, sub, entries, ...o }),
  reviews: (title, sub, reviews, o) => ({ kind: "reviews", title, sub, reviews, ...o }),
  names: (title, sub, items, o) => ({ kind: "names", title, sub, items, ...o }),
  plain: (title, sub, items, o) => ({ kind: "plain", title, sub, items, ...o }),
  groups: (title, sub, groups, o) => ({ kind: "groups", title, sub, groups: groups.filter(Boolean), ...o }),
  film: (f, o) => ({ kind: "film", film: f, title: f.name, sub: f.year ? String(f.year) : "", ...o }),
};
const dl = (d) => `data-list="${drill(d)}"`;
// a number or name that opens its drill; a whole sentence that does
const dlink = (d, html) => d ? `<button class="dlink" type="button" ${dl(d)}>${html}</button>` : html;
const dline = (d, html) => d ? `<button class="dline" type="button" ${dl(d)}>${html}<span class="go" aria-hidden="true">&nbsp;›</span></button>` : html;

const PANEL_CAP = 25;
const drillSize = (d) => d.kind === "film" ? 1 : d.kind === "search" || d.kind === "share" || d.kind === "story" || d.kind === "filters" ? 0 : d.kind === "groups" ? d.groups.reduce((s, g) => s + drillSize(g), 0)
  : (d.films || d.entries || d.reviews || d.items || []).length;

/* ----- sub-lines ----- */
const runtimeOf = (f) => { const m = metaOf(f); return (m && m.r) || 0; };
const viewsIn = (f, scope) => !scope || scope === "all" ? f.entries.length : f.entries.filter((e) => e.date.startsWith(scope)).length;
const filmsSub = (films, extra) => {
  const r = films.filter((f) => f.rating);
  return `${plural(films.length, "film")}${r.length ? ` · ${avg(r.map((f) => f.rating)).toFixed(2)} average` : ""}${extra ? ` · ${extra}` : ""}`;
};
const entriesSub = (es, extra) => {
  const n = new Set(es.map((e) => e.film)).size;
  return `${plural(es.length, "diary entry", "diary entries")}${n !== es.length ? ` of ${plural(n, "film")}` : ""}${extra ? ` · ${extra}` : ""}`;
};
const dateSpan = (a, b) => a === b ? fmtDate(a) : a.slice(0, 4) === b.slice(0, 4) ? `${fmtDate(a).replace(/ \d{4}$/, "")} – ${fmtDate(b)}` : `${fmtDate(a)} – ${fmtDate(b)}`;
const monthName = (ym) => `${MONTHS_LONG[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const lbUrl = (f) => /^https?:\/\//.test(f.uri || "") ? f.uri : `https://letterboxd.com/search/films/${encodeURIComponent(`${f.name}${f.year ? ` ${f.year}` : ""}`)}/`;

/* ----- ready-made drills for the stats both layouts show ----- */
const DR = {
  films: (s, title) => D.films(title || (s.scope === "all" ? "All films" : `Films of ${s.scope}`), filmsSub(s.films), s.films, { scope: s.scope, sort: "watched" }),
  diary: (s) => D.entries(s.scope === "all" ? "Your diary" : `Diary of ${s.scope}`, entriesSub(s.entries), s.entries),
  rated: (s) => D.films("Rated films", filmsSub(s.films.filter((f) => f.rating)), s.films.filter((f) => f.rating), { scope: s.scope }),
  liked: (s) => D.films("Liked films", filmsSub(s.films.filter((f) => f.liked)), s.films.filter((f) => f.liked), { scope: s.scope }),
  rewatches: (s) => { const es = s.entries.filter((e) => e.rewatch); return D.entries("Rewatches", entriesSub(es, `${s.entries.length ? Math.round(es.length / s.entries.length * 100) : 0}% of the diary`), es); },
  runtime: (s) => {
    const fs = s.films.filter((f) => runtimeOf(f));
    return D.films("Hours, film by film", `${fmtN(Math.round(s.minutes / 60))} hours over ${plural(fs.length, "film")} with a known runtime`, fs, { scope: s.scope, sort: "runtime",
      note: (f) => { const v = viewsIn(f, s.scope); return `${runtimeOf(f)} min${v > 1 ? ` × ${v} viewings = ${fmtN(runtimeOf(f) * v)} min` : ""}`; } });
  },
  released: (s, y) => { const fs = s.films.filter((f) => String(f.year) === String(y)); return D.films(`Released in ${y}`, filmsSub(fs), fs, { scope: s.scope }); },
  inDiary: (s) => { const fs = s.films.filter((f) => f.entries.length); return D.films("Films in your diary", filmsSub(fs), fs, { scope: s.scope, sort: "watched" }); },
  watchlist: (lib) => D.plain("Watchlist", plural(lib.watchlistFilms.length, "film"), lib.watchlistFilms),
  streak: (s) => {
    const end = s.streak.end, start = end - s.streak.days + 1;
    const es = s.entries.filter((e) => { const d = dayIndex(e.date); return d >= start && d <= end; });
    return D.entries("Longest streak", `${s.streak.days} days in a row, ${dateSpan(isoOfDay(start), isoOfDay(end))} · ${entriesSub(es)}`, es, { order: "asc" });
  },
  day: (es, iso, list = es.filter((e) => e.date === iso)) => D.entries(fmtDate(iso), `${WEEKDAYS_LONG[weekdayOf(iso)]} · ${entriesSub(list)}`, list, { order: "asc" }),
  month: (es, ym) => { const list = es.filter((e) => e.date.startsWith(ym)); return D.entries(monthName(ym), entriesSub(list), list, { order: "asc" }); },
  year: (es, y) => { const list = es.filter((e) => e.date.startsWith(y)); return D.entries(`Diary of ${y}`, entriesSub(list), list); },
  weekday: (es, i) => {
    const list = es.filter((e) => weekdayOf(e.date) === i);
    return D.entries(`${WEEKDAYS_LONG[i]}s`, entriesSub(list, `${es.length ? Math.round(list.length / es.length * 100) : 0}% of the diary`), list);
  },
  rating: (films, r) => { const fs = films.filter((f) => f.rating === r); return D.films(`Rated ${stars(r)}`, plural(fs.length, "film"), fs, { sort: "watched" }); },
  decade: (x) => D.films(`The ${x.decade}s`, filmsSub(x.films), x.films, { sort: "old" }),
  film: (f, o) => D.film(f, o),
  person: (p, o) => D.films(p.name, personSub(p), p.films, { person: p, ...o }),
};
// Every week, month or year of the diary with its count, each opening its entries.
const unitsDrill = (cols, unit, per) => D.names(`Diary entries by ${unit}`, `${per.toFixed(1)} a ${unit} on average`,
  cols.filter((c) => c.to).reverse().map((c) => ({ name: c.tipLabel, value: fmtN(c.es.length), note: entriesSub(c.es), to: c.to })));
// Every film in a library with one person in it: a director, writer or one of the top-billed cast.
function personDrill(lib, name, role, among = lib.films) {
  const k = personKey(name);
  const films = among.filter((f) => { const m = metaOf(f); return m && roleNames(m, role).some((n) => personKey(n) === k); });
  const ratings = films.filter((f) => f.rating).map((f) => f.rating);
  return DR.person({ key: k, name, films, ratings, count: films.length, avg: avg(ratings) }, { lib });
}
// How many films of a library count each person in a role, by `personKey` (kept until the library or the people change).
const COUNTED = new WeakMap();
function countedIn(lib, role) {
  const P = peopleIndex();
  let c = COUNTED.get(lib.films);
  if (!c || c.P !== P) COUNTED.set(lib.films, (c = { P }));
  if (!c[role]) {
    c[role] = new Map();
    for (const f of lib.films) { const m = metaOf(f); if (m) for (const n of roleNames(m, role)) { const k = personKey(n); c[role].set(k, (c[role].get(k) || 0) + 1); } }
  }
  return c[role];
}
// Every film in a library with one genre, country or language.
function catDrill(lib, v, field) {
  const films = lib.films.filter((f) => { const m = metaOf(f); return m && (field === "l" ? m.l === v : (m[field] || []).includes(v)); });
  return D.films(v, filmsSub(films), films, { lib });
}

/* ----- rendering, shared by the pop-up and the full page ----- */
function thumb(f, big) {
  const m = metaOf(f);
  const img = showImages && m && m.poster ? `<img src="${IMG}${esc(m.poster)}" alt="" loading="lazy">` : "";
  return `<span class="thumb${big ? " big" : ""}" aria-hidden="true"><span class="tt">${big ? esc(f.name) : esc(initials(f.name) || "?")}</span>${img}</span>`;
}
const SORTS = {
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name),
  runtime: (a, b) => runtimeOf(b) - runtimeOf(a) || a.name.localeCompare(b.name),
  short: (a, b) => runtimeOf(a) - runtimeOf(b) || a.name.localeCompare(b.name),
  old: (a, b) => (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name),
  watched: (a, b) => lastSeen(b).localeCompare(lastSeen(a)) || (b.rating || 0) - (a.rating || 0),
  name: (a, b) => a.name.localeCompare(b.name),
};
const lastSeen = (f) => f.entries.length ? f.entries[f.entries.length - 1].date : "";
function itemsOf(d) {
  if (d.kind === "films") return d.sort === "given" ? d.films : [...d.films].sort(SORTS[d.sort || "rating"]);
  if (d.kind === "entries") {
    const es = [...d.entries].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order);
    return d.order === "asc" ? es : es.reverse();
  }
  return d.reviews || d.items || [];
}
const icons = (e, f) => `${e && e.rewatch ? '<span class="ic" title="Rewatch">↻</span>' : ""}${f.liked ? '<span class="ic heart" title="Liked">♥</span>' : ""}${e && e.review ? '<span class="ic" title="Reviewed">≡</span>' : ""}`;
function filmRowHtml(f, d) {
  const n = f.entries.length, last = n ? f.entries[n - 1].date : null;
  const note = d.note ? d.note(f) : last ? `Watched ${fmtDate(last)}${n > 1 ? ` · ${n} viewings` : ""}` : "Logged without a date";
  const r = d.ratingOf ? d.ratingOf(f) : f.rating;
  return `<button class="drill-row" type="button" ${dl(d.cardOf ? d.cardOf(f) : D.film(f, { lib: d.lib, who: d.who }))}>${thumb(f)}
    <span class="dr-main"><span class="dr-t">${esc(f.name)} <span class="dr-y">${f.year || ""}</span></span><span class="dr-s">${esc(note)}</span></span>
    <span class="dr-r"><span class="stars">${stars(r)}</span>${icons(null, f)}</span></button>`;
}
function entryRowsHtml(list, all, d) {
  const per = new Map();
  for (const e of all) per.set(e.date.slice(0, 7), (per.get(e.date.slice(0, 7)) || 0) + 1);
  let html = "", month = "";
  for (const e of list) {
    const m = e.date.slice(0, 7), f = e.film;
    if (m !== month) { month = m; html += `<div class="drill-month"><span>${monthName(m)}</span><span>${fmtN(per.get(m))}</span></div>`; }
    const note = d.note ? d.note(e) : "";
    html += `<button class="drill-row entry" type="button" ${dl(d.cardOf ? d.cardOf(f) : D.film(f, { lib: d.lib, entry: e, who: d.who }))}>
      <span class="dr-d"><b>${+e.date.slice(8, 10)}</b><small>${WEEKDAYS[weekdayOf(e.date)]}</small></span>${thumb(f)}
      <span class="dr-main"><span class="dr-t">${esc(f.name)} <span class="dr-y">${f.year || ""}</span></span>${note ? `<span class="dr-s">${esc(note)}</span>` : ""}</span>
      <span class="dr-r"><span class="stars">${stars(e.rating)}</span>${icons(e, f)}</span></button>`;
  }
  return html;
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Mark a word in a review's HTML without touching its tags.
function markWord(html, w) {
  if (!w) return html;
  const re = new RegExp(`(^|[^\\p{L}])(${escRe(esc(w))}(?:'s)?)(?=[^\\p{L}]|$)`, "giu");
  return html.split(/(<[^>]+>)/).map((part) => part.startsWith("<") ? part : part.replace(re, "$1<mark>$2</mark>")).join("");
}
function reviewRowHtml(r, d) {
  const long = r.words > 70;
  const when = r.date ? `${r.rewatch ? "Rewatched" : "Watched"} ${fmtDate(r.date)}` : "";
  return `<div class="drill-rev"><button class="drill-row" type="button" ${dl(D.film(r.film, { lib: d.lib, who: d.who }))}>${thumb(r.film)}
    <span class="dr-main"><span class="dr-t">${esc(r.film.name)} <span class="dr-y">${r.film.year || ""}</span></span><span class="dr-s">${[when, r.words ? plural(r.words, "word") : ""].filter(Boolean).join(" · ")}</span></span>
    <span class="dr-r"><span class="stars">${stars(r.rating)}</span>${icons(null, r.film)}</span></button>
    ${r.html ? `<div class="rv-text${long ? " clamp" : ""}">${markWord(r.html, d.mark)}</div>${long ? `<button class="linkish" type="button" data-expand>Read more</button>` : ""}` : ""}</div>`;
}
function nameRowHtml(p, d) {
  const films = p.films || [];
  const sub = p.note || (p.ratings ? personSub({ ...p, count: films.length }) : filmsSub(films));
  const to = p.to || D.films(p.name, sub, films, { lib: d.lib, who: d.who, cardOf: d.cardOf, person: p.key && d.faces ? p : null, note: d.filmNote, scope: d.scope });
  return `<button class="drill-row name" type="button" ${dl(to)}><span class="dr-main"><span class="dr-t">${esc(p.name)}</span><span class="dr-s">${esc(sub)}</span></span>
    <span class="dr-r num">${p.value != null ? esc(p.value) : fmtN(films.length)}</span></button>`;
}
const plainRowHtml = (x) => `<div class="drill-row plain"><span class="dr-main"><span class="dr-t">${esc(x.name)} <span class="dr-y">${x.year || ""}</span></span>${x.note ? `<span class="dr-s">${esc(x.note)}</span>` : ""}</span>
  <a class="dr-r" href="${esc(lbUrl(x))}" target="_blank" rel="noopener">Letterboxd ↗</a></div>`;

// The body of a drill, showing at most `cap` items in each list. Returns how many it left out.
function drillBody(d, cap = Infinity) {
  if (d.kind === "film") return { html: filmCardHtml(d), hidden: 0 };
  if (d.kind === "search") return { html: searchBodyHtml(d), hidden: 0 };
  if (d.kind === "share") return { html: shareBodyHtml(d), hidden: 0 };
  if (d.kind === "story") return { html: storyBodyHtml(d), hidden: 0 };
  if (d.kind === "filters") return { html: filtersBodyHtml(), hidden: 0 };
  if (d.kind === "groups") {
    let html = "", hidden = 0;
    for (const g of d.groups) {
      const r = drillBody({ lib: d.lib, scope: d.scope, empty: "None.", ...g }, cap);
      html += `<section class="drill-group"><h4><span>${esc(g.title)}</span><span class="num">${fmtN(drillSize(g))}</span></h4>${g.sub ? `<p class="dr-gsub">${esc(g.sub)}</p>` : ""}${r.html}</section>`;
      hidden += r.hidden;
    }
    return { html: html || `<div class="empty">Nothing here.</div>`, hidden };
  }
  const all = itemsOf(d), shown = all.slice(0, cap);
  if (!all.length) return { html: `<div class="empty">${esc(d.empty || "Nothing here.")}</div>`, hidden: 0 };
  const html = (d.kind === "films" ? filmoPlaceholder(d) : "") + (d.kind === "entries" ? entryRowsHtml(shown, all, d)
    : shown.map((x) => d.kind === "films" ? filmRowHtml(x, d) : d.kind === "reviews" ? reviewRowHtml(x, d) : d.kind === "names" ? nameRowHtml(x, d) : plainRowHtml(x)).join(""));
  return { html, hidden: all.length - shown.length };
}

/* ----- one film: everything you (and anyone you're comparing with) logged for it ----- */
function crowdBits(f, m) {
  const x = LBX[f.key], out = [];
  if (x && x.r) out.push(`Letterboxd <b>${x.r.toFixed(1)}★</b>${x.n ? ` <small>${fmtN(x.n)} ratings</small>` : ""}`);
  if (m && m.ir) out.push(`IMDb <b>${m.ir.toFixed(1)}</b>${m.iv ? ` <small>${fmtN(m.iv)} votes</small>` : ""}`);
  if (m && m.va && (m.vc || 0) >= 25) out.push(`TMDB <b>${m.va.toFixed(1)}</b>`);
  if (m && m.mc) out.push(`Metacritic <b>${esc(m.mc)}</b>`);
  if (m && m.rt) out.push(`Rotten Tomatoes <b>${esc(m.rt)}%</b>`);
  return out;
}
function recordHtml(p, d, solo) {
  const g = p.film;
  const head = `<h4>${solo ? esc(d.who ? `In ${d.who}'s diary` : state.mode === "example" ? "In the example diary" : "In your diary") : esc(p.name)}</h4>`;
  if (!g) return `<section class="fc-sec">${head}<p class="dr-s">${esc(p.missing || "Not logged.")}</p></section>`;
  const line = [g.rating ? `<span class="stars">${stars(g.rating)}</span>` : "Not rated", g.liked ? '<span class="heart">♥</span> Liked' : "",
    g.entries.length ? plural(g.entries.length, "diary entry", "diary entries") : "Logged without a date"].filter(Boolean).join(" · ");
  const rows = [...g.entries].reverse().map((e) => `<div class="fc-entry${d.entry === e ? " on" : ""}"><span>${fmtDate(e.date)}${e.logged && e.logged !== e.date ? ` <small>logged ${fmtDate(e.logged)}</small>` : ""}</span>
    <span><span class="stars">${stars(e.rating)}</span>${e.rewatch ? ' <span title="Rewatch">↻</span>' : ""}${e.review ? ' <span title="Reviewed">≡</span>' : ""}</span></div>`).join("");
  const reviews = p.lib.reviews.filter((r) => r.film === g && r.html).map((r) => `<div class="fc-review"><p class="dr-s">Review${r.date ? `, ${fmtDate(r.date)}` : ""}</p><div class="rv-text">${r.html}</div></div>`).join("");
  return `<section class="fc-sec">${head}<p class="fc-line">${line}</p>${rows ? `<div class="fc-entries">${rows}</div>` : ""}${reviews}</section>`;
}
function filmCardHtml(d) {
  const f = d.film, m = metaOf(f), lib = d.lib || state.lib;
  const who = d.people || [{ lib, film: lib.films.includes(f) ? f : lib.films.find((x) => x.key === f.key) }];
  const facts = [], tags = [];
  if (m) {
    if (roleNames(m, "d").length) facts.push(`<p class="fc-dir">Directed by ${roleNames(m, "d").map((n) => dlink(personDrill(lib, n, "d"), esc(n))).join(", ")}</p>`);
    if (m.r) facts.push(`<p>${esc(m.r)} min</p>`);
    tags.push(...[...new Set(m.g)].map((g) => dlink(catDrill(lib, g, "g"), esc(g))), ...[...new Set(m.k)].map((k) => dlink(catDrill(lib, k, "k"), esc(k))), ...(m.l ? [dlink(catDrill(lib, m.l, "l"), esc(m.l))] : []));
  }
  const crowd = crowdBits(f, m);
  const chips = (title, role) => roleNames(m, role).length ? `<section class="fc-sec"><h4>${title}</h4><div class="fc-chips">${roleNames(m, role).slice(0, 12).map((n) => dlink(personDrill(lib, n, role), esc(n))).join("")}</div></section>` : "";
  const cameos = m ? cameosOf(m) : [], small = m ? smallPartsOf(m) : [];
  // small parts: up to six people counted in other films of the diary by name, then a link to them all (each opens
  // their counted films; worked out only for the rows shown)
  const met = small.filter((p) => countedIn(lib, p.role).get(personKey(p.name))), named = met.slice(0, 6), rest = small.length - named.length;
  const smallList = () => D.names("Small parts, not counted", `${f.name}: billed below the principal cast, or a bit part`,
    small.map((p) => { const it = { key: personKey(p.name), name: p.name, films: [f], note: smallWhy(p) };
      return met.includes(p) ? Object.defineProperty(it, "to", { get: () => personDrill(lib, p.name, p.role), enumerable: true }) : it; }));
  const smallLine = !small.length ? "" : `<p class="dr-s fc-cameos">Small parts, not counted: ${named.map((p) => esc(p.name)).join(", ")}${
    !named.length ? dlink(smallList(), plural(small.length, "part")) : rest ? ` and ${dlink(smallList(), `${fmtN(rest)} more`)}` : ` (${dlink(smallList(), "why")})`}.</p>`;
  const cast = m ? chips("Cast", "c") + chips("Voices", "v") + (cameos.length ? `<p class="dr-s fc-cameos">Cameos, not counted: ${cameos.slice(0, 8).map((c) => `${esc(c.name)} (${esc(cameoWhy(c.why))})`).join(", ")}${cameos.length > 8 ? ` and ${cameos.length - 8} more` : ""}.</p>` : "") + smallLine : "";
  const tm = META[f.key];
  const links = [`<a href="${esc(lbUrl(f))}" target="_blank" rel="noopener">Letterboxd ↗</a>`,
    tmdbHref(tm) && !IN_VIEWER ? `<a href="${tmdbHref(tm)}" target="_blank" rel="noopener">TMDB ↗</a>` : "",
    m && /^tt\d+$/.test(m.im || "") ? `<a href="https://www.imdb.com/title/${m.im}/" target="_blank" rel="noopener">IMDb ↗</a>` : ""].filter(Boolean).join("");
  return `<div class="fcard">${d.badge ? `<p class="fc-badge">${esc(d.badge)}</p>` : ""}<div class="fc-top">${thumb(f, true)}<div class="fc-facts">
      ${facts.join("")}${m ? "" : `<p class="dr-s">No cast &amp; crew details yet.</p>`}
      ${crowd.length ? `<p class="fc-crowd">${crowd.join('<span class="sep"> · </span>')}</p>` : ""}${tags.length ? `<p class="fc-tags">${tags.join("")}</p>` : ""}</div></div>
    ${who.map((p) => recordHtml(p, d, !d.people)).join("")}${cast}<p class="fc-links">${links}</p>${fixHtml(f)}</div>`;
}
// "Wrong film?" under a card: paste the right film's TMDB or IMDb link and the match is kept from then on.
let FIXING = null, FIX_NOTE = { key: null, text: "" };
function fixHtml(f) {
  if (IN_VIEWER || state.mode !== "mine" || !MY_LIB || !(MY_LIB.films.some((x) => x.key === f.key) || MY_LIB.watchlistFilms.some((x) => x.key === f.key))) return "";
  const note = FIX_NOTE.key === f.key && FIX_NOTE.text ? `<p class="dr-s fix-note" role="status">${esc(FIX_NOTE.text)}</p>` : "";
  if (FIXING !== f.key) return `<div class="fc-fix"><button class="linkish" type="button" data-fix="${esc(f.key)}">${META[f.key] && META[f.key].pin ? "Matched by hand. Change it?" : "Wrong film?"}</button>${note}</div>`;
  return `<div class="fc-fix open"><label for="fix-input">Paste the right film's link from themoviedb.org or imdb.com</label>
    <div class="fix-row"><input id="fix-input" type="url" autocomplete="off" spellcheck="false" placeholder="https://www.themoviedb.org/movie/…">
    <button class="btn small" type="button" data-fixsave="${esc(f.key)}">Use this film</button><button class="linkish" type="button" data-fixcancel>Cancel</button></div>${note}</div>`;
}
// Runs a fix from the card; the page and the open card are drawn again after.
async function runFix(key, repaint) {
  const f = MY_LIB.films.find((x) => x.key === key) || MY_LIB.watchlistFilms.find((x) => x.key === key);
  const input = document.getElementById("fix-input");
  if (!f || !input) return;
  const text = input.value;
  FIX_NOTE = { key, text: "Looking it up on TMDB…" }; repaint();
  try {
    const m = await fixMatch(f, text);
    FIXING = null; FIX_NOTE = { key, text: `Matched to ${m.tv ? `TMDB's TV ${m.ep ? "episode" : "programme"}` : `TMDB film ${m.id}`}${m.d.length ? `, directed by ${m.d.join(" and ")}` : ""}. Every stat uses it now.` };
    SEARCH_INDEX = null; DATA_REV++; render(); repaint();
  } catch (e) {
    FIX_NOTE = { key, text: (e && e.message) || "Couldn't reach TMDB." }; repaint();
    const again = document.getElementById("fix-input"); if (again) { again.value = text; again.focus(); }
  }
}
</script>
