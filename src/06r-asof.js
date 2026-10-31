<script>
/* ---------- most watched as of a date (asked 1 Nov 2026: "an option to see the user's cumulative most watched actor
   director stat at a particular period in their diary history. For example on 5th june 2022 who were my most watched
   director and actors of all time... on 3rd December 2023 who was my most watched actress of all time") ----------
   A film counts from the day it was first in your diary: its first diary entry, or, for a film marked watched without
   one, the day it was marked (watched.csv's date, `f.added`), whichever came first (`filmSince`). Up to a day, each
   person counts once a film, by the same `roleNames` as Most watched, so on the latest day the counts are the all-time
   list's (the `counts` check proves it). Actors and actresses are the on-screen cast by the gender TMDB lists
   (`roleGender`: 2 a man, 1 a woman); someone TMDB lists as neither is in neither. Ties go to who got there first, and
   the first of each list says since when they've led. Desktop: section `asof` in People; phone: Stats › People, chip
   "Back in time". A date box, a slider along the diary and a jump to the end of each year change only the results
   (`asofOut`), never the controls being used, so nothing is redrawn under a finger (the Safari freeze, Oct 2026). */
const ASOF = { day: null, kind: "d", lib: null, scope: "all" };
const ASOF_N = 10;
const filmSince = (f) => { const d = f.entries && f.entries.length ? f.entries[0].date : null; return d && f.added ? (d < f.added ? d : f.added) : d || f.added || null; };
const ASOF_BASE = new WeakMap();
function asofBase(lib) {
  let B = ASOF_BASE.get(lib);
  if (B) return B;
  const films = [], undated = [];
  for (const f of lib.films) { const since = filmSince(f); if (since) films.push({ f, since }); else undated.push(f); }
  films.sort((a, b) => a.since < b.since ? -1 : a.since > b.since ? 1 : a.f.key < b.f.key ? -1 : 1);
  B = { films, undated, first: films.length ? films[0].since : null, last: films.length ? films[films.length - 1].since : null };
  ASOF_BASE.set(lib, B);
  return B;
}
const ASOF_KINDS = [["d", "Directors", "director"], ["m", "Actors", "actor"], ["w", "Actresses", "actress"]];
// Everyone's count up to and including `day`: directors, actors (men) and actresses (women), each in order.
function asofCount(lib, day) {
  const B = asofBase(lib), maps = { d: new Map(), m: new Map(), w: new Map() }, lead = { d: null, m: null, w: null }, since = {};
  let films = 0, unread = 0, seq = 0;
  const bump = (k, name, day, f) => {
    const key = personKey(name), M = maps[k];
    let p = M.get(key);
    if (!p) M.set(key, (p = { key, name, count: 0, films: [], seq: 0 }));
    p.count++; p.films.push(f); p.seq = ++seq;
    const L = lead[k];
    if (!L || (L !== p && p.count > L.count)) { lead[k] = p; since[k] = day; }
  };
  for (const { f, since: d } of B.films) {
    if (d > day) break;
    films++;
    const m = metaOf(f);
    if (!m) continue;
    for (const name of new Set(roleNames(m, "d"))) bump("d", name, d, f);
    const cast = roleNames(m, "c"), sex = roleGender(m, "c");
    if (cast.length && !m.cg && !(m.src === "tmdb" && (m.v || 0) >= 15)) unread++;
    for (const name of new Set(cast)) { const g = sex.get(personKey(name)); if (g === 2) bump("m", name, d, f); else if (g === 1) bump("w", name, d, f); }
  }
  const lists = {};
  for (const [k] of ASOF_KINDS) lists[k] = [...maps[k].values()].sort((a, b) => b.count - a.count || a.seq - b.seq || a.name.localeCompare(b.name));
  return { day, films, unread, lists, since, lead };
}
const asofDays = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const asofAdd = (a, n) => new Date(Date.parse(a) + n * 864e5).toISOString().slice(0, 10);
const asofClamp = (B, d) => !d || d < B.first ? B.first : d > B.last ? B.last : d;
// The day shown: the one picked, else the end of the year chosen above, else the latest.
function asofDay(B, scope) {
  if (ASOF.day && ASOF.lib && asofBase(ASOF.lib) === B) return asofClamp(B, ASOF.day);
  return asofClamp(B, scope && scope !== "all" ? `${scope}-12-31` : B.last);
}
// The whole thing: the controls and the results. `phone` shows one list at a time with a switch.
function asofHtml(lib, scope, phone) {
  const B = asofBase(lib);
  if (!B.films.length) return `<div class="empty">Back in time needs films with dates in your diary.</div>`;
  if ((ASOF.lib && asofBase(ASOF.lib) !== B) || ASOF.scope !== scope) ASOF.day = null; // another diary, filter or year: start again
  ASOF.lib = lib; ASOF.scope = scope;
  const day = asofDay(B, scope), span = asofDays(B.first, B.last);
  const years = []; for (let y = +B.first.slice(0, 4); y < +B.last.slice(0, 4); y++) years.push(y);
  const jump = (d, label, title) => `<button class="asof-jump${d === day ? " on" : ""}" type="button" data-asof-day="${d}" title="${esc(title)}">${esc(label)}</button>`;
  return `<div class="asof" data-phone="${phone ? 1 : 0}">
    <div class="asof-ctl">
      <label class="asof-when"><span>As of</span><input type="date" class="asof-date" value="${day}" min="${B.first}" max="${B.last}" aria-label="The day to look back to"></label>
      <input type="range" class="asof-range" min="0" max="${span}" step="1" value="${asofDays(B.first, day)}" aria-label="Move through your diary">
      <div class="asof-ends" aria-hidden="true"><span>${esc(fmtDate(B.first))}</span><span>${esc(fmtDate(B.last))}</span></div>
      <div class="asof-jumps">${years.map((y) => jump(`${y}-12-31`, String(y), `The end of ${y}`)).join("")}${jump(B.last, "Latest", "Your latest diary entry")}</div>
    </div>
    <div class="asof-out" aria-live="polite">${asofOut(lib, day, phone)}</div></div>`;
}
// The results for a day: who led each list, and the top ten of each (the phone, one list at a time).
const ASOF_NOW = new WeakMap();
function asofNow(lib) {
  const B = asofBase(lib), c = ASOF_NOW.get(lib);
  if (c && c.meta === META && c.rev === META_REV) return c.C;
  const C = asofCount(lib, B.last);
  ASOF_NOW.set(lib, { meta: META, rev: META_REV, C });
  return C;
}
function asofOut(lib, day, phone) {
  const B = asofBase(lib), C = asofCount(lib, day), now = asofNow(lib);
  const nowOf = (k, key) => { const p = now.lists[k].find((x) => x.key === key); return p ? p.count : 0; };
  const row = (k, p, i) => {
    const ph = showImages && PHOTOS[p.key], n = nowOf(k, p.key);
    return `<li><button class="asof-p" type="button" ${dl(D.films(p.name, `${plural(p.count, "film")} by ${fmtDate(day)}`, p.films))}>
      <span class="asof-rk">${i + 1}</span><span class="asof-face">${ph ? `<img src="${IMG}${esc(ph)}" alt="" loading="lazy">` : `<i>${esc(initials(p.name))}</i>`}</span>
      <span class="asof-nm">${esc(p.name)}</span><span class="asof-ct">${plural(p.count, "film")}${n !== p.count ? `<small>now ${fmtN(n)}</small>` : ""}</span></button></li>`;
  };
  const list = ([k, label, one]) => {
    const L = C.lists[k], top = L[0];
    return `<div class="asof-col" data-kind="${k}"><h3 class="asof-h">${label}</h3>
      ${top ? `<p class="asof-lead">${esc(top.name)}, your most watched ${one} since ${esc(fmtDate(C.since[k]))}.</p>` : ""}
      ${L.length ? `<ol class="asof-list">${L.slice(0, ASOF_N).map((p, i) => row(k, p, i)).join("")}</ol>` : `<div class="empty">No ${label.toLowerCase()} yet${k !== "d" && C.unread ? " (their casts are still being read)" : ""}.</div>`}</div>`;
  };
  const kinds = phone ? ASOF_KINDS.filter(([k]) => k === ASOF.kind) : ASOF_KINDS;
  const sw = phone ? `<div class="seg small asof-kinds" role="group">${ASOF_KINDS.map(([k, l]) => `<button type="button" data-asof-kind="${k}" aria-pressed="${k === ASOF.kind}">${l}</button>`).join("")}</div>` : "";
  const notes = [
    `By ${fmtDate(day)} you had ${plural(C.films, "film")} in your diary${C.films < B.films.length ? `, of ${fmtN(B.films.length)} now` : ""}.`,
    B.undated.length ? `${plural(B.undated.length, "film")} with no date ${B.undated.length === 1 ? "isn't" : "aren't"} counted.` : "",
    C.unread ? `${plural(C.unread, "film")} still ${C.unread === 1 ? "needs its" : "need their"} cast read again to tell actors from actresses; ${C.unread === 1 ? "it fills" : "they fill"} in by themselves.` : "",
    "Actors and actresses as TMDB lists them. Click anyone for their films up to that day.",
  ].filter(Boolean).join(" ");
  return `<p class="asof-sum">${notes}</p>${sw}<div class="asof-cols">${kinds.map(list).join("")}</div>`;
}
// The controls change the results in place: the slider and the date box follow each other, a year's end or Latest jumps
// there, and on the phone the switch picks the list. At most one count a frame while the slider is dragged.
let ASOF_FRAME = 0;
function asofSet(root, day, from) {
  const lib = ASOF.lib;
  if (!lib || !root) return;
  const B = asofBase(lib);
  day = asofClamp(B, day);
  ASOF.day = day;
  const range = root.querySelector(".asof-range"), date = root.querySelector(".asof-date");
  if (range && from !== range) range.value = String(asofDays(B.first, day));
  if (date && from !== date) date.value = day;
  for (const b of root.querySelectorAll("[data-asof-day]")) b.classList.toggle("on", b.dataset.asofDay === day);
  if (ASOF_FRAME) cancelAnimationFrame(ASOF_FRAME);
  ASOF_FRAME = requestAnimationFrame(() => {
    ASOF_FRAME = 0;
    const out = root.querySelector(".asof-out");
    if (out) out.innerHTML = asofOut(lib, ASOF.day, root.dataset.phone === "1");
  });
}
document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t || !t.closest) return;
  const root = t.closest(".asof");
  if (!root || !ASOF.lib) return;
  const B = asofBase(ASOF.lib);
  if (t.classList.contains("asof-range")) asofSet(root, asofAdd(B.first, Number(t.value) || 0), t);
  else if (t.classList.contains("asof-date") && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) asofSet(root, t.value, t);
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t && t.classList && t.classList.contains("asof-date") && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) asofSet(t.closest(".asof"), t.value, t);
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-asof-day], [data-asof-kind]");
  if (!b) return;
  const root = b.closest(".asof");
  if (!root) return;
  e.preventDefault(); e.stopPropagation();
  if (b.dataset.asofKind) {
    ASOF.kind = b.dataset.asofKind;
    const out = root.querySelector(".asof-out");
    if (out) out.innerHTML = asofOut(ASOF.lib, ASOF.day || asofDay(asofBase(ASOF.lib), ASOF.scope), true);
  } else asofSet(root, b.dataset.asofDay, b);
});
</script>
