<script>
/* ---------- Back in time: most watched as of a date (asked 1 Nov 2026: "an option to see the user's cumulative most
   watched actor director stat at a particular period in their diary history. For example on 5th june 2022 who were my
   most watched director and actors of all time... on 3rd December 2023 who was my most watched actress of all time";
   reworked the same day after a review, "both aesthetically and functionally") ----------
   A film counts from the day it was first in your diary: its first diary entry, or, for a film marked watched without
   one, the day it was marked (watched.csv's date, `f.added`), whichever came first (`filmSince`; on the owner's export
   the marked day is the first entry's logged day for 1,202 of 1,218 logged films). The films marked as seen on joining
   Letterboxd (`lib.profile.joined`, a week either side; 253 of the owner's on 21–23 Feb 2018) aren't a moment in the
   diary, so the timeline starts when that pile ends (`B.start`) and says so. Each person counts once a film, by the same
   `roleNames` as Most watched, and lists are in Most watched's order (films, then your average, then name), so the
   latest day is the Most watched lists themselves (the `counts` check proves it); tied counts share a rank ("=2").
   Lists: directors, actors and actresses (the on-screen cast by TMDB's gender, `roleGender`: 2 a man, 1 a woman) and
   everyone (the whole on-screen cast, as Starring; it has people TMDB lists as neither, Elliot Page and Ezra Miller in
   the owner's). Everything is worked out once per diary (`asofIndex`: each person's films in order with running
   average, and who led from when, `runs`), so a step of the slider is a lookup (it was 0.15 s on a slowed phone).
   Who led when: a bar per list of each leader's stretch (ties striped), in line with the slider; a tap or drag on it
   picks the day. Desktop: section `asof` in People; phone: Stats › People, the first chip. The controls change only
   the results in place (`asofSet`), never the control being used (the Safari freeze, Oct 2026). */
const ASOF = { day: null, kind: "d", together: false, lib: null, scope: "all", ids: [] };
const ASOF_N = 10, ASOF_PILE = 10, ASOF_PILE_DAYS = 7;
const ASOF_KINDS = [["d", "Directors", "director"], ["m", "Actors", "actor"], ["w", "Actresses", "actress"], ["a", "Everyone", "cast member"]];
const asofKind = (k) => ASOF_KINDS.find((x) => x[0] === k);
const filmSince = (f) => { const d = f.entries && f.entries.length ? f.entries[0].date : null; return d && f.added ? (d < f.added ? d : f.added) : d || f.added || null; };
const asofDays = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const asofAdd = (a, n) => new Date(Date.parse(a) + n * 864e5).toISOString().slice(0, 10);
const asofLong = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
// how many of a sorted list come before `x`
const asofBelow = (a, x) => { let lo = 0, hi = a.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] < x) lo = mid + 1; else hi = mid; } return lo; };

// The diary's films in the order they arrived, and where the timeline starts.
const ASOF_BASE = new WeakMap();
function asofBase(lib) {
  let B = ASOF_BASE.get(lib);
  if (B) return B;
  const films = [], undated = [];
  for (const f of lib.films) { const since = filmSince(f); if (since) films.push({ f, since }); else undated.push(f); }
  films.sort((a, b) => a.since < b.since ? -1 : a.since > b.since ? 1 : a.f.key < b.f.key ? -1 : 1);
  const first = films.length ? films[0].since : null, last = films.length ? films[films.length - 1].since : null;
  // the films marked as already seen when the account was made: counted from the start, which is when they end
  const joined = (lib.profile && lib.profile.joined) || "";
  let start = first, pile = 0;
  if (joined && first && /^\d{4}-\d{2}-\d{2}$/.test(joined)) {
    const lo = asofAdd(joined, -1), hi = asofAdd(joined, ASOF_PILE_DAYS);
    const marked = films.filter(({ f, since }) => since >= lo && since <= hi && since === f.added && !(f.entries.length && f.entries[0].date <= since));
    if (marked.length >= ASOF_PILE) { pile = marked.length; start = marked.reduce((m, x) => x.since > m ? x.since : m, first); }
  }
  B = { films, undated, first, last, start, pile, joined, days: films.map((x) => x.since) };
  ASOF_BASE.set(lib, B);
  return B;
}
// How many films were in by the end of `day`.
const asofIdx = (B, day) => asofBelow(B.days, `${day}~`);

// Each person's films in order (with their running total of ratings), each list's people by films now, and the runs
// of who led each list ("=" for a shared top), worked out once per diary and its film details.
const ASOF_INDEX = new WeakMap();
function asofIndex(lib) {
  const B = asofBase(lib), c = ASOF_INDEX.get(lib);
  if (c && c.meta === META && c.rev === META_REV) return c;
  const people = { d: new Map(), m: new Map(), w: new Map(), a: new Map() }, top = {}, runs = {};
  for (const k of Object.keys(people)) { top[k] = { max: 0, at: new Set() }; runs[k] = []; }
  const unread = new Int32Array(B.films.length + 1);
  const add = (k, name, i, place, f, known) => {
    const key = known || personKey(name), M = people[k];
    if (!key) return;
    let P = M.get(key);
    if (!P) M.set(key, (P = { key, name, pos: [], ord: [], films: [], rsum: [], rn: [] }));
    if (P.pos[P.pos.length - 1] === i) return; // once a film
    const n = P.pos.length;
    P.pos.push(i); P.ord.push(i * 1000 + place); P.films.push(f);
    P.rsum.push((n ? P.rsum[n - 1] : 0) + (f.rating || 0)); P.rn.push((n ? P.rn[n - 1] : 0) + (f.rating ? 1 : 0));
    const T = top[k];
    if (n + 1 > T.max) { T.max = n + 1; T.at = new Set([key]); } else if (n + 1 === T.max) T.at.add(key);
  };
  B.films.forEach(({ f }, i) => {
    const m = metaOf(f);
    let un = 0;
    if (m) {
      const dk = roleKeys(m, "d");
      roleNames(m, "d").forEach((n, j) => add("d", n, i, j, f, dk[j]));
      const cast = roleNames(m, "c"), ck = roleKeys(m, "c"), sex = roleGender(m, "c");
      if (cast.length && !m.cg && !(m.src === "tmdb" && (m.v || 0) >= 15)) un = 1;
      cast.forEach((n, j) => { add("a", n, i, j, f, ck[j]); const g = sex.get(ck[j]); if (g === 2) add("m", n, i, j, f, ck[j]); else if (g === 1) add("w", n, i, j, f, ck[j]); });
    }
    unread[i + 1] = unread[i] + un;
    for (const k of Object.keys(runs)) {
      const T = top[k];
      if (!T.max) continue;
      const state = T.at.size === 1 ? [...T.at][0] : "=", R = runs[k], last = R[R.length - 1];
      if (!last || last.state !== state) R.push({ at: i, state, keys: [...T.at].slice(0, 4), n: T.at.size, max: T.max });
    }
  });
  const lists = {};
  for (const k of Object.keys(people)) lists[k] = [...people[k].values()].sort((a, b) => b.pos.length - a.pos.length);
  const I = { meta: META, rev: META_REV, B, people, lists, runs, unread };
  ASOF_INDEX.set(lib, I);
  return I;
}
// A list as it stood after the first `idx` films: everyone (n Infinity) or the top n and anyone tied with the nth, in
// Most watched's order, each with their shared rank. A person's `films` are those by then.
const ASOF_ROW = { get films() { return this.P.films.slice(0, this.count); } };
const asofCmp = (a, b) => b.count - a.count || (b.avg || 0) - (a.avg || 0) || a.name.localeCompare(b.name);
function asofRows(list, idx, n = Infinity) {
  let out = [], thr = 0;
  for (const P of list) {
    if (P.pos.length < thr) break; // nobody further down can reach the list
    if (P.pos[0] >= idx) continue;
    const c = asofBelow(P.pos, idx);
    if (c < thr) continue;
    out.push(Object.assign(Object.create(ASOF_ROW), { P, key: P.key, name: P.name, count: c, avg: P.rn[c - 1] ? P.rsum[c - 1] / P.rn[c - 1] : 0, ord: P.ord[c - 1], now: P.pos.length }));
    if (n !== Infinity && out.length >= 4 * n) { out.sort(asofCmp); thr = out[n - 1].count; out = out.filter((p) => p.count >= thr); }
  }
  out.sort(asofCmp);
  if (n !== Infinity && out.length > n) { const t = out[n - 1].count; out = out.filter((p, i) => i < n || p.count === t); }
  let rank = 0;
  out.forEach((p, i) => { if (!i || p.count !== out[i - 1].count) rank = i + 1; p.rank = rank; });
  out.forEach((p, i) => { p.tied = (i > 0 && out[i - 1].count === p.count) || (i + 1 < out.length && out[i + 1].count === p.count); });
  return out;
}
// Everyone's count by the end of `day` (n: only the top n of each list), who led each list, and since when.
function asofCount(lib, day, n = Infinity) {
  const I = asofIndex(lib), B = I.B, idx = asofIdx(B, day), lists = {}, lead = {}, since = {};
  for (const [k] of ASOF_KINDS) {
    lists[k] = asofRows(I.lists[k], idx, n);
    const R = I.runs[k], r = R[asofBelow(R.map((x) => x.at), idx) - 1];
    lead[k] = r || null;
    since[k] = r && r.state !== "=" ? B.films[r.at].since : null;
  }
  return { day, films: idx, unread: I.unread[idx], lists, lead, since };
}
// The line under a list's first: since when they've led, or who they're level with and who got there first.
function asofLead(L, one, since) {
  const top = L[0], level = L.filter((p) => p.count === top.count);
  if (level.length === 1) return `On top since ${fmtDate(since)}.`;
  const others = level.slice(1), first = level.reduce((a, b) => (b.ord < a.ord ? b : a));
  const names = others.slice(0, 2).map((p) => p.name), more = others.length - names.length;
  return `Level with ${joinAnd(more ? [...names, plural(more, "other")] : names)} on ${plural(top.count, "film")}; ${first.name} got there first.`;
}

/* ----- the view ----- */
const asofClamp = (B, d) => !d || d < B.start ? B.start : d > B.last ? B.last : d;
function asofDay(B, scope) {
  if (ASOF.day && ASOF.lib && asofBase(ASOF.lib) === B) return asofClamp(B, ASOF.day);
  return asofClamp(B, scope && scope !== "all" ? `${scope}-12-31` : B.last);
}
const asofSpan = (B) => Math.max(1, asofDays(B.start, B.last));
const asofAt = (B, d) => Math.max(0, Math.min(100, asofDays(B.start, d) / asofSpan(B) * 100));
// The lists on show: phone, the one picked; computer, directors with actors and actresses apart, or everyone together.
const asofShown = (phone) => phone ? [ASOF.kind] : ASOF.together ? ["d", "a"] : ["d", "m", "w"];
const asofBars = (phone) => phone ? (ASOF.kind === "a" ? ["d", "a"] : ["d", "m", "w"]) : asofShown(false);
// Who led when: each list's leaders in stretches, a colour each (in order of first leading), ties striped.
function asofReigns(lib, kinds, phone) {
  const I = asofIndex(lib), B = I.B;
  const rows = kinds.map((k) => {
    const R = I.runs[k], colour = new Map(), segs = [];
    R.forEach((r, i) => {
      const nx = R[i + 1], from = B.films[r.at].since, to = nx ? B.films[nx.at].since : B.last;
      if (nx && to <= B.start) return; // over before the timeline starts
      const a = asofAt(B, from < B.start ? B.start : from), b = nx ? asofAt(B, to) : 100;
      if (b - a <= 0 && nx) return;
      const tie = r.state === "=", P = !tie && I.people[k].get(r.state);
      if (P && !colour.has(r.state)) colour.set(r.state, colour.size % 7 + 1);
      const names = r.keys.map((x) => (I.people[k].get(x) || {}).name).filter(Boolean);
      const when = `${fmtDate(from < B.start ? B.start : from)} to ${nx ? fmtDate(to) : "now"}`;
      const tip = tie ? `Level at the top, ${when}: ${joinAnd(r.n > names.length ? [...names.slice(0, 3), plural(r.n - 3, "other")] : names)}, ${r.max} each at first`
        : `${P.name}, ${when}`;
      segs.push(`<span class="asof-seg ${tie ? "lvl" : `c${colour.get(r.state)}`}" style="left:${a.toFixed(2)}%;width:${Math.max(0.4, b - a).toFixed(2)}%" data-tip="${esc(tip)}">${!tie && b - a >= (phone ? 22 : 12) ? `<i>${esc(P.name)}</i>` : ""}</span>`);
    });
    return `<span class="asof-rl">${asofKind(k)[1]}</span><div class="asof-bar" data-kind="${k}" aria-hidden="true">${segs.join("")}<i class="asof-mark"></i></div>`;
  });
  const years = [];
  for (let y = +B.start.slice(0, 4) + 1; y <= +B.last.slice(0, 4); y++) years.push(`<span style="left:${asofAt(B, `${y}-01-01`).toFixed(2)}%">${phone ? `’${String(y).slice(2)}` : y}</span>`);
  return rows.join("") + `<span></span><div class="asof-yrs" aria-hidden="true">${years.join("")}</div>`;
}
// On the computer's main page: drawn at once when its working out is in hand, else a moment after the page appears
// (worked out the first time, a quarter of a second for the owner's diary, it held up the whole page; 1 Nov 2026).
const asofReady = (lib) => { const c = ASOF_INDEX.get(lib); return !!(c && c.meta === META && c.rev === META_REV); };
function asofSoon(lib, scope) {
  if (asofReady(lib)) return asofHtml(lib, scope, false);
  const first = !ASOF.soon;
  ASOF.soon = { lib, scope };
  if (first) (window.requestIdleCallback || ((fn) => setTimeout(fn, 150)))(() => {
    const w = ASOF.soon, el = document.querySelector("[data-asof-soon]");
    ASOF.soon = null;
    if (el && w && state.lib === w.lib) el.outerHTML = asofHtml(w.lib, w.scope, false);
  }, { timeout: 1200 });
  return `<div class="asof-soon" data-asof-soon><p class="status">Working out who led when…</p></div>`;
}
// The whole thing: the day, the timeline and its controls, the lists, and the small print.
function asofHtml(lib, scope, phone) {
  const B = asofBase(lib);
  if (!B.films.length) return `<div class="empty">Back in time needs films with dates in your diary.</div>`;
  if ((ASOF.lib && asofBase(ASOF.lib) !== B) || ASOF.scope !== scope) ASOF.day = null; // another diary, filter or year: start again
  ASOF.lib = lib; ASOF.scope = scope;
  const day = asofDay(B, scope), span = asofSpan(B), at = asofAt(B, day);
  const years = []; for (let y = +B.start.slice(0, 4); y < +B.last.slice(0, 4); y++) years.push(y);
  const jump = (d, label, title) => `<button class="asof-jump${d === day ? " on" : ""}" type="button" data-asof-day="${d}" title="${esc(title)}">${esc(label)}</button>`;
  const mode = phone ? `<div class="seg small four asof-kinds" role="group">${ASOF_KINDS.map(([k, l]) => `<button type="button" data-asof-kind="${k}" aria-pressed="${k === ASOF.kind}">${l}</button>`).join("")}</div>`
    : `<div class="asof-mode" role="group" aria-label="The cast">${[[false, "Actors and actresses"], [true, "Everyone together"]].map(([v, l]) => `<button type="button" data-asof-together="${v ? 1 : 0}" aria-pressed="${ASOF.together === v}">${l}</button>`).join("")}</div>`;
  return `<div class="asof" data-phone="${phone ? 1 : 0}" style="--at:${at.toFixed(2)}%">
    <div class="asof-head"><div class="asof-dayline">${asofDayLine(lib, day)}</div>
      <label class="asof-pick"><span>Pick a date</span><input type="date" class="asof-date" value="${day}" min="${B.start}" max="${B.last}"></label></div>
    <div class="asof-scrub">
      <span class="asof-rl asof-rl-k"></span><input type="range" class="asof-range" min="0" max="${span}" step="1" value="${asofDays(B.start, day)}" aria-label="Move through your diary">
      ${asofReigns(lib, asofBars(phone), phone)}
    </div>
    <div class="asof-jumps">${B.pile ? jump(B.start, "Joined", `When you joined Letterboxd, with the ${B.pile} films you marked as seen`) : ""}${years.map((y) => jump(`${y}-12-31`, String(y), `The end of ${y}`)).join("")}${jump(B.last, "Latest", "Your latest diary entry")}</div>
    ${mode}
    <div class="asof-out" aria-live="polite">${asofOut(lib, day, phone)}</div>
    <p class="asof-fine">${asofFine(lib)}</p></div>`;
}
function asofDayLine(lib, day) {
  const B = asofBase(lib), n = asofIdx(B, day);
  return `<span class="asof-k">As of</span><b class="asof-big">${esc(asofLong(day))}</b><span class="asof-stat">${n === B.films.length ? `All ${fmtN(n)} films so far` : `${fmtN(n)} films by then · ${fmtN(B.films.length)} now`}</span>`;
}
function asofFine(lib) {
  const B = asofBase(lib), I = asofIndex(lib), unread = I.unread[B.films.length];
  return [
    "Counted as in Most watched, each film once, from the day it first appears in your diary (or the day you marked it watched).",
    B.pile ? `The ${fmtN(B.pile)} films you marked as seen when you joined Letterboxd (${fmtDate(B.joined)}) count from the start.` : "",
    B.undated.length ? `${plural(B.undated.length, "film")} with no date ${B.undated.length === 1 ? "isn't" : "aren't"} counted.` : "",
    unread ? `${plural(unread, "film")} still ${unread === 1 ? "needs its" : "need their"} cast read again to tell actors from actresses; ${unread === 1 ? "it fills" : "they fill"} in by itself.` : "",
    "Actors and actresses as TMDB lists them; Everyone is the whole cast, as in Starring.",
  ].filter(Boolean).join(" ");
}
// The lists for a day: each one's first in a card with their photo, then the rest down to the tenth.
function asofOut(lib, day, phone) {
  const C = asofCount(lib, day, ASOF_N), ids = [];
  const link = (p) => { const id = drill(D.films(p.name, `${plural(p.count, "film")} by ${fmtDate(day)}`, p.films)); ids.push(id); return `data-list="${id}"`; };
  const face = (p, cls) => { const ph = showImages && PHOTOS[p.key]; return `<span class="asof-face${cls}">${ph ? `<img src="${IMG}${esc(ph)}" alt="" loading="lazy">` : `<i>${esc(initials(p.name))}</i>`}</span>`; };
  const nowNote = (p) => p.now !== p.count ? `<small>now ${fmtN(p.now)}</small>` : "";
  const rank = (p) => `${p.tied ? "=" : ""}${p.rank}`;
  const list = (k) => {
    const [, label, one] = asofKind(k), L = C.lists[k], top = L[0];
    if (!top) return `<div class="asof-col" data-kind="${k}"><h3 class="asof-h">${label}</h3><div class="empty">No ${label.toLowerCase()} yet${k !== "d" && C.unread ? "; their casts are still being read" : ""}.</div></div>`;
    return `<div class="asof-col" data-kind="${k}"><h3 class="asof-h">${label}</h3>
      <button class="asof-hero" type="button" ${link(top)}>${face(top, " big")}<span class="asof-hn"><span class="asof-hk">${top.tied ? "Joint first" : `Most watched ${one}`}</span><b>${esc(top.name)}</b>
        <span class="asof-hs">${plural(top.count, "film")}${top.now !== top.count ? ` · now ${fmtN(top.now)}` : ""}</span></span></button>
      <p class="asof-lead">${esc(asofLead(L, one, C.since[k]))}</p>
      ${L.length > 1 ? `<ol class="asof-list">${L.slice(1, ASOF_N).map((p) => `<li><button class="asof-p" type="button" ${link(p)}><span class="asof-rk">${rank(p)}</span>${face(p, "")}<span class="asof-nm">${esc(p.name)}</span><span class="asof-ct">${plural(p.count, "film")}${nowNote(p)}</span></button></li>`).join("")}</ol>` : ""}</div>`;
  };
  ASOF.ids = ids;
  return `<div class="asof-cols n${asofShown(phone).length}">${asofShown(phone).map(list).join("")}</div>`;
}
// The controls change the results in place: the slider, the date box and the timeline's marker follow each other, a
// year's end or Joined or Latest jumps there, a tap or drag on the timeline picks the day under it. The lists are worked
// out at most once a frame; the links of the lists they replace are let go.
let ASOF_FRAME = 0;
function asofSet(root, day, from) {
  const lib = ASOF.lib;
  if (!lib || !root) return;
  const B = asofBase(lib);
  day = asofClamp(B, day);
  ASOF.day = day;
  const range = root.querySelector(".asof-range"), date = root.querySelector(".asof-date");
  if (range && from !== range) range.value = String(asofDays(B.start, day));
  if (date && from !== date) date.value = day;
  root.style.setProperty("--at", `${asofAt(B, day).toFixed(2)}%`);
  for (const b of root.querySelectorAll("[data-asof-day]")) b.classList.toggle("on", b.dataset.asofDay === day);
  if (ASOF_FRAME) cancelAnimationFrame(ASOF_FRAME);
  ASOF_FRAME = requestAnimationFrame(() => { ASOF_FRAME = 0; asofRedraw(root); });
}
function asofRedraw(root, bars) {
  const lib = ASOF.lib, phone = root.dataset.phone === "1", day = ASOF.day || asofDay(asofBase(lib), ASOF.scope);
  for (const id of ASOF.ids) LISTS.delete(id);
  const line = root.querySelector(".asof-dayline"), out = root.querySelector(".asof-out"), scrub = root.querySelector(".asof-scrub");
  if (line) line.innerHTML = asofDayLine(lib, day);
  if (out) out.innerHTML = asofOut(lib, day, phone);
  if (bars && scrub) { const r = scrub.querySelector(".asof-range"); for (const el of [...scrub.children]) if (el !== r && !el.classList.contains("asof-rl-k")) el.remove(); scrub.insertAdjacentHTML("beforeend", asofReigns(lib, asofBars(phone), phone)); }
}
document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t || !t.closest) return;
  const root = t.closest(".asof");
  if (!root || !ASOF.lib) return;
  const B = asofBase(ASOF.lib);
  if (t.classList.contains("asof-range")) asofSet(root, asofAdd(B.start, Number(t.value) || 0), t);
  else if (t.classList.contains("asof-date") && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) asofSet(root, t.value, t);
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t && t.classList && t.classList.contains("asof-date") && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) asofSet(t.closest(".asof"), t.value, t);
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-asof-day], [data-asof-kind], [data-asof-together]");
  if (!b) return;
  const root = b.closest(".asof");
  if (!root || !ASOF.lib) return;
  e.preventDefault(); e.stopPropagation();
  if (b.dataset.asofKind || b.dataset.asofTogether) {
    if (b.dataset.asofKind) ASOF.kind = b.dataset.asofKind; else ASOF.together = b.dataset.asofTogether === "1";
    for (const x of root.querySelectorAll("[data-asof-kind], [data-asof-together]")) x.setAttribute("aria-pressed", String(x.dataset.asofKind ? x.dataset.asofKind === ASOF.kind : (x.dataset.asofTogether === "1") === ASOF.together));
    asofRedraw(root, true);
  } else asofSet(root, b.dataset.asofDay, b);
});
// a tap on the timeline goes to the day under it, and a drag along it moves through the days
let ASOF_DRAG = null;
const asofPoint = (bar, x) => { const r = bar.getBoundingClientRect(), B = asofBase(ASOF.lib); return asofAdd(B.start, Math.round(Math.max(0, Math.min(1, (x - r.left) / r.width)) * asofSpan(B))); };
document.addEventListener("pointerdown", (e) => {
  const bar = e.target.closest && e.target.closest(".asof-bar");
  if (!bar || !ASOF.lib || e.button > 0) return;
  ASOF_DRAG = bar;
  asofSet(bar.closest(".asof"), asofPoint(bar, e.clientX));
});
document.addEventListener("pointermove", (e) => { if (ASOF_DRAG && e.buttons) asofSet(ASOF_DRAG.closest(".asof"), asofPoint(ASOF_DRAG, e.clientX)); });
document.addEventListener("pointerup", () => { ASOF_DRAG = null; });
document.addEventListener("pointercancel", () => { ASOF_DRAG = null; });
</script>
