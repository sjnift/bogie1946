<script>
/* ---------- logging a film on this site (asked 5 Nov 2026: "add an option to log films on the website itself similar
   to letterboxd ui ux and update data on the website. use tmdb as the search resource"). A panel in the pop-up or the
   sheet (a drill of kind `log`, like the quiz), in Letterboxd's order: find the film on TMDB, then the day you watched
   it, a rating in half stars, a like, "I've watched this film before" and a review. Saved to KEYS.logs, which
   `withLogs` (06h-more) adds to the diary, so every page takes it in at once, and every device through the diary on
   the site. Nothing goes to Letterboxd (it has no way in); a viewing logged there as well comes back through the feed
   or an export and then counts once. Edit and Delete sit by the entry on the film card. The panel's fields are never
   redrawn while in use (the Safari freeze): typing only refreshes the results under the box, and the stars and the
   heart change in place. */
D.log = (o = {}) => ({ kind: "log", title: o.edit ? "Edit your log" : "Log a film", sub: "", ...o });
const LOGGERS = new Map();
let LOG_SEQ = 0;
const LOG_RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const logToday = () => isoDay(new Date());
const logsAll = () => store.get(KEYS.logs, []) || [];
// Who can log: someone with their own diary here and a way to search TMDB (not inside Claude, where TMDB can't be reached).
const canLog = () => !IN_VIEWER && !!MY_LIB && state.mode === "mine";

function logBodyHtml(d) {
  if (!d.lid) {
    d.lid = `lg${++LOG_SEQ}`;
    LOGGERS.set(d.lid, d);
    d.form = { watched: logToday(), rating: null, liked: false, rewatch: false, review: "" };
    const x = d.edit && logsAll().find((y) => y.id === d.edit && !y.deleted);
    if (x) { d.pick = { id: x.tmdb, title: x.title, year: x.year, poster: x.poster }; d.form = { watched: x.watched, rating: x.rating, liked: x.liked, rewatch: x.rewatch, review: x.review }; d.was = x; }
  }
  return `<div class="logp" data-lid="${d.lid}">${logInner(d)}</div>`;
}
function logInner(d) {
  if (d.done) return logDoneHtml(d);
  if (d.pick) return logFormHtml(d);
  return logSearchHtml(d);
}
function logRedraw(d) {
  const el = document.querySelector(`.logp[data-lid="${d.lid}"]`);
  if (el) el.innerHTML = inPanel(() => logInner(d)); // its links live as long as the pop-up or sheet, through the page's redraws
  const q = el && el.querySelector(".lg-q, .lg-review");
  if (q && q.classList.contains("lg-q")) q.focus({ preventScroll: true });
}

/* ----- step one: find the film ----- */
function logSearchHtml(d) {
  if (!tmdbKey()) return `<p class="dr-s">Logging finds films on TMDB, which needs a TMDB key: add yours in Settings, under Film details.</p>`;
  return `<label class="lg-label" for="${d.lid}-q">Name of film</label>
    <input class="lg-q" id="${d.lid}-q" data-lid="${d.lid}" type="search" placeholder="Search for a film…" autocomplete="off" spellcheck="false" value="${esc(d.q || "")}">
    <div class="lg-results" aria-live="polite">${logResultsHtml(d)}</div>`;
}
// The films of your diary and watchlist by TMDB id, to mark the results you've seen.
function logKnown() {
  const by = new Map();
  if (!MY_LIB) return by;
  for (const f of MY_LIB.films) { const m = metaOf(f); if (m && m.id) by.set(Number(m.id), f); }
  for (const f of MY_LIB.watchlistFilms) { const m = metaOf(f); if (m && m.id && !by.has(Number(m.id))) by.set(Number(m.id), f); }
  return by;
}
function logResultsHtml(d) {
  if (d.err) return `<p class="dr-s">${esc(d.err)}</p>`;
  if (d.busy && !d.hits) return `<p class="dr-s">Searching TMDB…</p>`;
  if (!d.hits) return `<p class="dr-s lg-hint">Type a title to search TMDB. Add the year to narrow it: Rope 1948.</p>`;
  if (!d.hits.length) return `<p class="dr-s">Nothing on TMDB by that name.</p>`;
  const known = logKnown();
  return `<ul class="lg-hits">${d.hits.map((h, i) => {
    const f = known.get(h.id), mine = f && f.entries ? f : null;
    const mark = mine && (mine.entries.length || MY_LIB.films.includes(mine)) ? `<span class="lg-seen">In your diary${mine.rating ? ` · <span class="stars">${stars(mine.rating)}</span>` : ""}</span>`
      : f && f.watchlist ? `<span class="lg-seen wl">On your watchlist</span>` : "";
    return `<li><button class="lg-hit" type="button" data-lg-pick="${i}" data-lid="${d.lid}">${logPoster(h.poster)}
      <span class="lg-hit-t"><b>${esc(h.title)}</b> <span class="lg-y">${h.year || ""}</span>${h.orig && h.orig !== h.title ? `<small>${esc(h.orig)}</small>` : ""}${mark}</span></button></li>`;
  }).join("")}</ul>`;
}
const logPoster = (p, big) => `<span class="lg-art${big ? " big" : ""}">${p && showImages ? `<img src="${imgBase(big ? "w185" : "w92")}${esc(p)}" alt="" loading="lazy">` : ""}</span>`;
// The search itself: a moment after typing stops, the latest answer only.
async function logSearch(d) {
  const raw = String(d.q || "").trim(), m = raw.match(/^(.*?)[\s(]+((?:18|19|20)\d\d)\)?$/), query = (m ? m[1] : raw).trim(), year = m ? m[2] : "";
  const seq = (d.seq = (d.seq || 0) + 1);
  if (query.length < 2) { Object.assign(d, { hits: null, busy: false, err: "" }); return logResults(d); }
  d.busy = true; d.err = ""; logResults(d);
  try {
    const out = await tmdbGet("/search/movie", { query, primary_release_year: year, include_adult: "false" }, tmdbKey());
    if (seq !== d.seq) return;
    d.hits = ((out && out.results) || []).slice(0, 12).map((r) => ({ id: Number(r.id), title: String(r.title || r.original_title || "").slice(0, 300), orig: String(r.original_title || "").slice(0, 300),
      year: /^\d{4}/.test(r.release_date || "") ? +r.release_date.slice(0, 4) : null, poster: /^\/[\w.-]{1,80}$/.test(r.poster_path || "") ? r.poster_path : "" })).filter((h) => h.id && h.title);
  } catch (e) {
    if (seq !== d.seq) return;
    d.err = e && e.code === "auth" ? "TMDB didn't accept the key. Check it in Settings, under Film details." : "Couldn't reach TMDB. Check your connection and try again.";
  }
  d.busy = false; logResults(d);
}
function logResults(d) {
  const el = document.querySelector(`.logp[data-lid="${d.lid}"] .lg-results`);
  if (el) el.innerHTML = logResultsHtml(d);
}

/* ----- step two: the log itself ----- */
function logStarsHtml(r) {
  return `<span class="lg-rate" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<span class="lg-star${r >= n ? " full" : r >= n - 0.5 ? " half" : ""}" aria-hidden="false">★
    <button type="button" class="lg-h l" data-lg-rate="${n - 0.5}" role="radio" aria-checked="${r === n - 0.5}" aria-label="${stars(n - 0.5)}"></button><button type="button" class="lg-h r" data-lg-rate="${n}" role="radio" aria-checked="${r === n}" aria-label="${stars(n)}"></button></span>`).join("")}</span>`;
}
function logFormHtml(d) {
  const p = d.pick, f = d.form;
  return `<div class="lg-film">${logPoster(p.poster, true)}<div class="lg-film-t"><p class="lg-t">${esc(p.title)} <span class="lg-y">${p.year || ""}</span></p>
      ${d.edit ? "" : `<button class="linkish" type="button" data-lg-back="${d.lid}">Choose another film</button>`}</div></div>
    <div class="lg-fields">
      <label class="lg-line"><span>Watched on</span><input class="lg-date" type="date" value="${esc(f.watched)}" max="${logToday()}" min="1880-01-01" required></label>
      <label class="lg-line lg-check"><input class="lg-rewatch" type="checkbox"${f.rewatch ? " checked" : ""}> <span>I've watched this film before</span></label>
      <textarea class="lg-review" rows="5" placeholder="Add a review…" aria-label="Review">${esc(f.review || "")}</textarea>
      <div class="lg-rl"><div><span class="lg-k">Rating</span>${logStarsHtml(f.rating)}<span class="lg-rv">${f.rating ? stars(f.rating) : "No rating"}</span></div>
        <div><span class="lg-k">Like</span><button class="lg-like${f.liked ? " on" : ""}" type="button" data-lg-like="${d.lid}" aria-pressed="${!!f.liked}" aria-label="Like">♥</button></div></div>
    </div>
    <p class="lg-err" role="alert"></p>
    <div class="lg-foot"><button class="btn primary green" type="button" data-lg-save="${d.lid}">${d.edit ? "Save changes" : "Save"}</button></div>`;
}
// The stars and the heart change in place, so nothing typed is lost.
function logSetRating(d, r) {
  d.form.rating = d.form.rating === r ? null : r; // the same rating again takes it away, as on Letterboxd
  const el = document.querySelector(`.logp[data-lid="${d.lid}"]`);
  if (!el) return;
  const v = d.form.rating;
  el.querySelectorAll(".lg-star").forEach((s, i) => { s.classList.toggle("full", v >= i + 1); s.classList.toggle("half", v >= i + 0.5 && v < i + 1); });
  el.querySelectorAll("[data-lg-rate]").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.lgRate) === v)));
  el.querySelector(".lg-rv").textContent = v ? stars(v) : "No rating";
}

/* ----- saving, and what then ----- */
// The diary drawn again with the logs as they now are, and the new film's details looked up (by its TMDB id).
function logApply() {
  MY_LIB = myLibrary(); SEARCH_INDEX = null; DATA_REV++;
  render();
  if (!job.running) autoLookup(allFilmsLib());
}
function logSave(d) {
  const el = document.querySelector(`.logp[data-lid="${d.lid}"]`), err = (t) => { const e = el && el.querySelector(".lg-err"); if (e) e.textContent = t; };
  if (!el || !d.pick) return;
  const watched = el.querySelector(".lg-date").value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(watched) || watched > logToday() || watched < "1880-01-01") return err("Pick the day you watched it (not a day still to come).");
  const now = new Date().toISOString(), logs = logsAll();
  const rec = { id: d.edit || `lg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, user: MY_LIB.profile.username || "", tmdb: d.pick.id || null,
    title: d.pick.title, year: d.pick.year || null, poster: d.pick.poster || "", watched, logged: d.was ? d.was.logged || logToday() : logToday(),
    rating: LOG_RATINGS.includes(d.form.rating) ? d.form.rating : null, liked: !!d.form.liked, rewatch: el.querySelector(".lg-rewatch").checked,
    review: el.querySelector(".lg-review").value.slice(0, 20000), at: now };
  store.set(KEYS.logs, mergeLogs(logs, [rec])); // a new log, or the newer copy of one edited
  store.flush();
  logApply();
  d.done = rec;
  logRedraw(d);
}
// The film a log became in the diary (by the entry it made, else by its title).
const logFilm = (rec) => MY_LIB && (MY_LIB.entries.find((e) => e.local === rec.id) || {}).film || (MY_LIB && MY_LIB.films.find((f) => titleKey(f.name, f.year) === titleKey(rec.title, rec.year)));
function logDoneHtml(d) {
  const x = d.done, f = logFilm(x), twice = LOGS_DROPPED.includes(x.id);
  const what = [x.rating ? `<span class="stars">${stars(x.rating)}</span>` : "", x.liked ? '<span class="heart">♥</span>' : "", x.rewatch ? "rewatch" : "", x.review ? "with a review" : ""].filter(Boolean).join(" · ");
  return `<div class="lg-done">${logPoster(x.poster, true)}<div><p class="lg-ok">${d.edit ? "Saved" : "Logged"}</p>
    <p class="lg-t">${esc(x.title)} <span class="lg-y">${x.year || ""}</span></p><p class="dr-s">Watched ${fmtDate(x.watched)}${what ? ` · ${what}` : ""}</p>
    ${twice ? `<p class="dr-s">Your diary already has this viewing from Letterboxd, so it counts once.</p>` : `<p class="dr-s">It's in every stat now. This site doesn't post to Letterboxd: log it there too if you like, and it still counts once.</p>`}
    <div class="lg-foot">${f ? `<button class="btn" type="button" ${dl(D.film(f))}>See the film</button>` : ""}<button class="btn" type="button" data-lg-again="${d.lid}">Log another film</button></div></div></div>`;
}
// Deleting a log: kept as a note that it's gone, so another device's copy doesn't bring it back.
function logDelete(id) {
  store.set(KEYS.logs, mergeLogs(logsAll(), [{ id, deleted: true, at: new Date().toISOString() }]));
  store.flush();
  logApply();
}
// On the film card: an entry logged here, with Edit and Delete (the first tap on Delete asks again).
const logEntryTools = (e, d) => e.local && !d.who && canLog() ? `<span class="fc-local">Logged here · <button class="linkish" type="button" ${dl(D.log({ edit: e.local }))}>Edit</button> ·
  <button class="linkish" type="button" data-lg-del="${esc(e.local)}">Delete</button></span>` : "";

document.addEventListener("input", (e) => {
  const q = e.target.closest && e.target.closest(".lg-q");
  if (!q) return;
  const d = LOGGERS.get(q.dataset.lid);
  if (!d) return;
  d.q = q.value;
  clearTimeout(d.timer);
  d.timer = setTimeout(() => logSearch(d), 300);
});
document.addEventListener("keydown", (e) => {
  const q = e.target.closest && e.target.closest(".lg-q");
  if (!q || e.key !== "Enter") return;
  const d = LOGGERS.get(q.dataset.lid);
  e.preventDefault();
  if (d && d.hits && d.hits.length) { d.pick = d.hits[0]; logRedraw(d); } else if (d) { clearTimeout(d.timer); logSearch(d); }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-lg-pick], [data-lg-rate], [data-lg-like], [data-lg-back], [data-lg-save], [data-lg-again], [data-lg-del]");
  if (!b) return;
  if (b.dataset.lgDel) {
    if (b.dataset.armed) { logDelete(b.dataset.lgDel); if ($("#dlg")) $("#dlg").close(); else if (typeof closeSheet === "function") closeSheet(); } // the card is out of date: closed
    else { b.dataset.armed = "1"; b.textContent = "Delete? Tap again"; }
    return;
  }
  const root = b.closest(".logp"), d = root && LOGGERS.get(root.dataset.lid);
  if (!d) return;
  if (b.dataset.lgPick != null) { d.pick = d.hits[Number(b.dataset.lgPick)]; logRedraw(d); const t = root.querySelector(".lg-review"); if (t && !matchMedia("(hover: none)").matches) t.focus({ preventScroll: true }); }
  else if (b.dataset.lgRate) logSetRating(d, Number(b.dataset.lgRate));
  else if (b.dataset.lgLike) { d.form.liked = !d.form.liked; b.classList.toggle("on", d.form.liked); b.setAttribute("aria-pressed", String(d.form.liked)); }
  else if (b.dataset.lgBack) { d.pick = null; logRedraw(d); }
  else if (b.dataset.lgSave) logSave(d);
  else if (b.dataset.lgAgain) { Object.assign(d, { done: null, pick: null, edit: null, was: null, hits: null, q: "", form: { watched: logToday(), rating: null, liked: false, rewatch: false, review: "" } }); logRedraw(d); }
});
</script>
