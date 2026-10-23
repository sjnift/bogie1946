<script>
/* ---------- the daily Letterboxd feed ----------
   A GitHub workflow reads the member's public RSS feed each day into feed/<username>.json on this site.
   Entries the export doesn't have yet are added to the diary when the page opens; the export itself is
   left as it was, so a fresh import simply takes over. */
let FEED = null, FEED_ADDED = [];
// The repository a GitHub Pages copy is published from, for the link that adds a username to the feed.
const SITE_REPO = (() => { const m = location.hostname.match(/^([\w-]+)\.github\.io$/); const repo = location.pathname.split("/")[1]; return m && repo ? `https://github.com/${m[1]}/${repo}` : null; })();
async function loadFeed(user) {
  if (IN_VIEWER || !user || !/^https?:$/.test(location.protocol)) return null;
  try {
    const r = await fetch(`feed/${encodeURIComponent(user.toLowerCase())}.json`, { cache: "no-cache" });
    const feed = r.ok ? await r.json() : null;
    return feed && Array.isArray(feed.items) ? feed : null;
  } catch { return null; }
}
// The export's rows plus the feed's entries it doesn't have: diary, watched, rating, like and review.
function withFeed(rows, feed) {
  if (!rows || !feed) return { rows, added: [] };
  const out = { ...rows, diary: [...(rows.diary || [])], watched: [...(rows.watched || [])], ratings: [...(rows.ratings || [])], reviews: [...(rows.reviews || [])], likes: [...(rows.likes || [])] };
  const k = (r) => filmKey(r.Name, r.Year);
  // the export's spelling of each title, so a feed film is the same film however its title is written
  const spelled = new Map();
  for (const r of [...out.watched, ...out.diary, ...out.ratings]) if (!spelled.has(titleKey(r.Name, r.Year))) spelled.set(titleKey(r.Name, r.Year), r.Name);
  // An entry logged before the export's newest one is in the export already, perhaps with its date
  // changed since; adding it again would count that viewing twice.
  const exportedUpTo = out.diary.reduce((m, r) => (r.Date || "") > m ? r.Date : m, "");
  // what the export has, by the title key, so a differently written title still counts as the same film
  const t = (r) => titleKey(r.Name, r.Year);
  const inDiary = new Set(out.diary.map((r) => `${t(r)}|${r["Watched Date"] || r.Date}`));
  const watched = new Set(out.watched.map(t)), rated = new Set(out.ratings.map(t)), liked = new Set(out.likes.map(t));
  const added = [];
  for (const x of [...feed.items].sort((a, b) => a.watched.localeCompare(b.watched))) {
    const title = spelled.get(titleKey(x.title, x.year)) || unescapeText(x.title);
    const base = { Name: title, Year: x.year ? String(x.year) : "" }, fk = k(base), tk = t(base);
    if (x.tmdb) KNOWN_IDS[fk] = x.tmdb;
    if (inDiary.has(`${tk}|${x.watched}`) || (x.logged && x.logged < exportedUpTo)) continue;
    inDiary.add(`${tk}|${x.watched}`);
    const entry = { ...base, Date: x.logged || x.watched, "Watched Date": x.watched, Rating: x.rating ? String(x.rating) : "", Rewatch: x.rewatch ? "Yes" : "", Tags: "" };
    out.diary.push(entry);
    if (!watched.has(tk)) { out.watched.push({ ...base, Date: x.logged || x.watched, "Letterboxd URI": "" }); watched.add(tk); }
    if (x.rating && !rated.has(tk)) { out.ratings.push({ ...base, Rating: String(x.rating) }); rated.add(tk); }
    if (x.liked && !liked.has(tk)) { out.likes.push(base); liked.add(tk); }
    if (x.review) out.reviews.push({ ...entry, Review: x.review });
    added.push({ ...x, title });
  }
  return { rows: out, added };
}
// Builds your library from the saved export and whatever the feed adds.
function myLibrary() {
  const saved = store.get(KEYS.rows, null);
  if (!saved) return null;
  const user = ((saved.profile || [])[0] || {}).Username || "";
  const fit = FEED && user && FEED.user.toLowerCase() === user.toLowerCase();
  const { rows, added } = withFeed(saved, fit ? FEED : null);
  FEED_ADDED = added;
  return buildLibrary(rows);
}
// The feed's line in the Cast & crew box, or how to switch it on.
function feedBlock(lib, phone) {
  if (IN_VIEWER || !lib || state.mode !== "mine") return "";
  const title = phone ? `<p class="title" style="margin-top:6px">Daily diary updates</p>` : `<h3 class="sub-h">Daily diary updates</h3>`;
  const user = lib.profile.username;
  if (FEED && user && FEED.user.toLowerCase() === user.toLowerCase()) {
    const newest = FEED.items[0];
    const es = lib.entries.filter((e) => FEED_ADDED.some((x) => filmKey(x.title, x.year) === e.film.key && x.watched === e.date));
    return title + `<p class="status">Your Letterboxd feed is read once a day.${newest ? ` Newest entry: ${esc(newest.title)}, ${fmtDate(newest.watched)}.` : ""}
      ${es.length ? `${dlink(D.entries("From your Letterboxd feed", `${entriesSub(es)} logged since your export`, es), plural(es.length, "diary entry", "diary entries"))} came from it since your export.` : "Your export already has everything in it."}</p>`;
  }
  if (!user || !SITE_REPO) return "";
  return title + `<p class="status">New diary entries can show up here each day without a fresh export. Add <b>${esc(user)}</b> on a line of its own to
    <a href="${SITE_REPO}/edit/main/feed-users.txt" target="_blank" rel="noopener">feed-users.txt</a> in your GitHub repository and commit it.
    Your diary must be public on Letterboxd; the entries are then also public on this site.</p>`;
}

/* ---------- backups: the same diary on another device ---------- */
function backupData(withKeys) {
  const b = { app: "credits-roll", v: 1, at: new Date().toISOString(), rows: store.get(KEYS.rows, null), meta: META, photos: PHOTOS, lbx: LBX, friends: store.get(KEYS.friends, []) };
  if (withKeys) b.keys = { tmdb: store.get(KEYS.tmdb, ""), omdb: store.get(KEYS.omdb, ""), apify: store.get(KEYS.apify, "") };
  return b;
}
function downloadBackup(withKeys) {
  const blob = new Blob([JSON.stringify(backupData(withKeys))], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `credits-roll-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const isBackupFile = (files) => files.length === 1 && /\.json$/i.test(files[0].name);
// Restores a backup made on another device: its export replaces this one; details and averages are added.
async function restoreBackup(file) {
  let b;
  try { b = JSON.parse(await file.text()); } catch { throw new Error("That file isn't a Credits Roll backup."); }
  if (!b || b.app !== "credits-roll" || !b.rows) throw new Error("That file isn't a Credits Roll backup.");
  store.set(KEYS.rows, b.rows);
  META = { ...META, ...(b.meta || {}) }; PHOTOS = { ...PHOTOS, ...(b.photos || {}) }; LBX = { ...LBX, ...(b.lbx || {}) };
  saveMeta(); store.set(KEYS.lbx, LBX);
  if (Array.isArray(b.friends) && b.friends.length) { store.set(KEYS.friends, b.friends); loadFriends(); }
  for (const [k, v] of Object.entries(b.keys || {})) if (v && KEYS[k]) store.set(KEYS[k], v);
  return `Restored the backup from ${fmtDate(String(b.at || "").slice(0, 10))}${b.keys ? ", keys included" : ""}.`;
}

/* ---------- search ---------- */
let SEARCH_INDEX = null;
function searchIndex(lib) {
  if (SEARCH_INDEX && SEARCH_INDEX.lib === lib && SEARCH_INDEX.n === Object.keys(META).length) return SEARCH_INDEX;
  const people = new Map(), cats = new Map();
  const ROLE = { d: "Director", c: "Actor", w: "Writer", p: "Cinematographer", m: "Composer" };
  for (const f of lib.films) {
    const m = metaOf(f);
    if (!m) continue;
    for (const role of ["d", "c", "w", "p", "m"]) for (const name of role === "c" ? m.c.slice(0, CAST_DEPTH) : m[role]) {
      const k = personKey(name);
      let p = people.get(k);
      if (!p) { p = { key: k, name, films: new Set(), roles: new Map(), k }; people.set(k, p); }
      p.films.add(f); p.roles.set(role, (p.roles.get(role) || 0) + 1);
    }
    for (const [field, vals] of [["g", m.g], ["k", m.k], ["l", m.l ? [m.l] : []]]) for (const v of new Set(vals)) {
      let c = cats.get(v);
      if (!c) { c = { name: v, field, films: [], k: personKey(v) }; cats.set(v, c); }
      c.films.push(f);
    }
  }
  SEARCH_INDEX = { lib, n: Object.keys(META).length, films: lib.films.map((f) => ({ f, k: personKey(f.name) })),
    people: [...people.values()].map((p) => ({ ...p, films: [...p.films], role: [...p.roles].sort((a, b) => b[1] - a[1])[0][0], roleName: ROLE })), cats: [...cats.values()] };
  return SEARCH_INDEX;
}
function searchResultsHtml(d) {
  const lib = state.lib, q = personKey(d.q || "");
  if (!q) return `<p class="dr-s search-hint">Type a film's title, or the name of a director, actor, writer, genre, country or language.</p>`;
  const score = (k) => k === q ? 4 : k.startsWith(q) ? 3 : (" " + k).includes(" " + q) ? 2 : k.includes(q) ? 1 : 0;
  const I = searchIndex(lib);
  const films = I.films.map((x) => ({ f: x.f, s: score(x.k) })).filter((x) => x.s).sort((a, b) => b.s - a.s || b.f.entries.length - a.f.entries.length || (b.f.rating || 0) - (a.f.rating || 0)).slice(0, 12).map((x) => x.f);
  const people = I.people.map((p) => ({ p, s: score(p.k) })).filter((x) => x.s).sort((a, b) => b.s - a.s || b.p.films.length - a.p.films.length).slice(0, 8).map((x) => x.p);
  const cats = I.cats.map((c) => ({ c, s: score(c.k) })).filter((x) => x.s).sort((a, b) => b.s - a.s || b.c.films.length - a.c.films.length).slice(0, 5).map((x) => x.c);
  if (!films.length && !people.length && !cats.length) return `<div class="empty">Nothing in your diary matches “${esc(d.q)}”.</div>`;
  const group = (title, html) => html ? `<section class="drill-group"><h4><span>${title}</span></h4>${html}</section>` : "";
  return group("Films", films.map((f) => filmRowHtml(f, {})).join("")) +
    group("People", people.map((p) => { const ratings = p.films.filter((f) => f.rating).map((f) => f.rating);
      const person = { key: p.key, name: p.name, films: p.films, ratings, count: p.films.length, avg: avg(ratings) };
      return nameRowHtml({ ...person, note: `${p.roleName[p.role]} · ${personSub(person)}`, to: { ...DR.person(person), role: p.role } }, {}); }).join("")) +
    group("Genres and places", cats.map((c) => nameRowHtml({ name: c.name, films: c.films, note: `${{ g: "Genre", k: "Country", l: "Language" }[c.field]} · ${filmsSub(c.films)}` }, {})).join(""));
}
const searchBodyHtml = (d) => `<div class="search-box"><label class="sr-only" for="search-q">Search your diary</label>
  <input id="search-q" type="search" autocomplete="off" spellcheck="false" placeholder="Films, people, genres…" value="${esc(d.q || "")}"></div>
  <div id="search-results">${searchResultsHtml(d)}</div>`;

/* ---------- on this day ---------- */
// Films watched on today's date in earlier years, or within three days of it when there are none.
function onThisDay(lib, now = new Date()) {
  const y = now.getFullYear(), iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = iso(now), md = today.slice(5);
  const past = lib.entries.filter((e) => +e.date.slice(0, 4) < y);
  let es = past.filter((e) => e.date.slice(5) === md), week = false;
  if (!es.length) {
    week = true;
    es = past.filter((e) => { const same = `${y}${e.date.slice(4)}`; return /^\d{4}-\d{2}-\d{2}$/.test(same) && Math.abs(dayIndex(same) - dayIndex(today)) <= 3; });
  }
  es = es.sort((a, b) => b.date.localeCompare(a.date));
  const when = `${now.getDate()} ${MONTHS_LONG[now.getMonth()]}`;
  return { entries: es, week, title: week ? "This week in past years" : `On ${when}`,
    sub: week ? `Films you watched within three days of ${when} in earlier years` : `Films you watched on ${when} in earlier years`,
    to: es.length ? D.entries(week ? "This week in past years" : `On ${when}`, entriesSub(es), es) : null };
}

/* ---------- watch next: your watchlist, ranked by how much you'd likely enjoy each film ----------
   Starts from your average rating, then moves it by how you rate the film's director, its leads and its
   genres (small samples count for less), and by its crowd score as far as your ratings follow the crowd. */
function watchNext(lib) {
  const rated = lib.films.filter((f) => f.rating);
  if (!lib.watchlistFilms.length || rated.length < 5) return null;
  const base = avg(rated.map((f) => f.rating));
  const dirs = new Map(), cast = new Map(), genres = new Map();
  const add = (map, k, name, r) => { let x = map.get(k); if (!x) map.set(k, x = { name, n: 0, sum: 0 }); x.n++; x.sum += r; };
  for (const f of rated) {
    const m = metaOf(f); if (!m) continue;
    new Set(m.d).forEach((n) => add(dirs, personKey(n), n, f.rating)); new Set(m.c.slice(0, 6)).forEach((n) => add(cast, personKey(n), n, f.rating)); new Set(m.g).forEach((g) => add(genres, g, g, f.rating));
  }
  const lean = (x, k) => x ? (x.sum - x.n * base) / (x.n + k) : 0; // pulled towards your average when there are few films
  const crowdOf = (f, m) => { const lb = LBX[f.key]; return lb && lb.r ? lb.r : m && m.ir && (m.iv || 0) >= 100 ? m.ir / 2 : m && m.va && (m.vc || 0) >= 25 ? m.va / 2 : null; };
  const pairs = rated.map((f) => ({ you: f.rating, c: crowdOf(f, metaOf(f)) })).filter((x) => x.c);
  const follow = pairs.length >= 10 ? Math.max(0, pearson(pairs.map((x) => x.you), pairs.map((x) => x.c)) || 0) : 0.3;
  const crowdMean = pairs.length ? avg(pairs.map((x) => x.c)) : null;
  const picks = lib.watchlistFilms.map((w) => {
    const m = metaOf(w), parts = [];
    if (m) {
      const ds = m.d.map((n) => ({ n, x: dirs.get(personKey(n)) })).filter((d) => d.x);
      if (ds.length) { const v = avg(ds.map((d) => lean(d.x, 2))); parts.push({ v, why: `You rate ${ds[0].n}'s films ${(ds[0].x.sum / ds[0].x.n).toFixed(1)}★ on average (${plural(ds[0].x.n, "film")})` }); }
      const cs = m.c.slice(0, 4).map((n) => ({ n, x: cast.get(personKey(n)) })).filter((c) => c.x && c.x.n >= 2);
      if (cs.length) { const best = cs.sort((a, b) => b.x.n - a.x.n)[0]; parts.push({ v: avg(cs.map((c) => lean(c.x, 3))) * 0.6, why: `${best.n} is in ${plural(best.x.n, "film")} you've rated, ${(best.x.sum / best.x.n).toFixed(1)}★ on average` }); }
      const gs = m.g.map((g) => genres.get(g)).filter(Boolean);
      if (gs.length) { const v = avg(gs.map((g) => lean(g, 5))) * 0.8, top = [...gs].sort((a, b) => Math.abs(lean(b, 5)) - Math.abs(lean(a, 5)))[0];
        parts.push({ v, why: `You rate ${top.name} ${(top.sum / top.n).toFixed(1)}★ on average` }); }
      const c = crowdOf(w, m);
      if (c && crowdMean) parts.push({ v: (c - crowdMean) * follow * 0.8, why: `${LBX[w.key] && LBX[w.key].r ? "Letterboxd members" : m.ir ? "IMDb users" : "TMDB users"} give it ${(c).toFixed(1)}★ out of 5` });
    }
    const pred = Math.max(0.5, Math.min(5, base + parts.reduce((s, p) => s + p.v, 0)));
    const why = parts.filter((p) => Math.abs(p.v) >= 0.05).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 2).map((p) => p.why);
    return { f: w, m, pred, why, known: !!m, runtime: m && m.r };
  }).sort((a, b) => b.known - a.known || b.pred - a.pred);
  return { base, picks, missing: picks.filter((p) => !p.known).length };
}
const WN_LENGTHS = [["any", "Any length"], ["100", "Under 1¾ hours"], ["130", "Under 2¼ hours"], ["long", "Long ones"]];
const wnFits = (p, len) => len === "any" || (p.runtime ? (len === "long" ? p.runtime >= 140 : p.runtime <= +len) : false);
const wnDrill = (list, title) => { const by = new Map(list.map((p) => [p.f, p]));
  return D.films(title, `${plural(list.length, "film")} from your watchlist, the likeliest favourites first`, list.map((p) => p.f), { sort: "given", ratingOf: (f) => Math.round(by.get(f).pred * 2) / 2,
    note: (f) => { const p = by.get(f); return p.known ? `About ${p.pred.toFixed(1)}★ for you${p.runtime ? ` · ${p.runtime} min` : ""}${p.why[0] ? ` · ${p.why[0]}` : ""}` : "No details yet"; } }); };

/* ---------- filmographies: how much of a director's or actor's work you've seen ---------- */
// The role a person mostly has in your diary: directing, acting, writing, camera or music.
function roleIn(lib, name) {
  const k = personKey(name), n = { d: 0, c: 0, w: 0, p: 0, m: 0 };
  for (const f of lib.films) { const m = metaOf(f); if (!m) continue; for (const r of Object.keys(n)) if ((r === "c" ? m.c.slice(0, CAST_DEPTH) : m[r]).some((x) => personKey(x) === k)) n[r]++; }
  return Object.keys(n).sort((a, b) => n[b] - n[a] || (a === "d" ? -1 : 0))[0];
}
const filmoBusy = new Set();
async function filmography(name, role) {
  const ck = `${personKey(name)}|${role}`, cache = store.get(KEYS.filmo, {}), c = cache[ck];
  if (c && Date.now() - c.at < 30 * 864e5) return c;
  const key = tmdbKey();
  const s = await tmdbGet("/search/person", { query: name, include_adult: "false" }, key);
  const dept = { d: "Directing", c: "Acting", w: "Writing", p: "Camera", m: "Sound" }[role];
  const person = ((s && s.results) || []).filter((p) => personKey(p.name) === personKey(name))
    .sort((a, b) => (b.known_for_department === dept) - (a.known_for_department === dept) || (b.popularity || 0) - (a.popularity || 0))[0];
  let out = { at: Date.now(), none: true };
  if (person) {
    const cr = await tmdbGet(`/person/${person.id}/movie_credits`, {}, key);
    const jobs = { d: ["Director"], w: ["Screenplay", "Writer", "Story"], p: ["Director of Photography"], m: ["Original Music Composer", "Music"] }[role];
    const today = new Date().toISOString().slice(0, 10);
    const list = role === "c" ? ((cr && cr.cast) || []).filter((x) => !/\b(self|himself|herself|themselves)\b|uncredited|archive/i.test(x.character || ""))
      : ((cr && cr.crew) || []).filter((x) => jobs.includes(x.job));
    const seen = new Set(), credits = [];
    for (const x of list.sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""))) {
      if (seen.has(x.id) || x.video || !x.release_date || x.release_date > today || (x.vote_count || 0) < (role === "c" ? 10 : 3)) continue;
      seen.add(x.id); credits.push({ id: x.id, title: x.title, year: +x.release_date.slice(0, 4) });
    }
    out = { at: Date.now(), id: person.id, credits };
  }
  cache[ck] = out; store.set(KEYS.filmo, cache);
  return out;
}
const filmoPlaceholder = (d) => {
  if (IN_VIEWER || state.mode !== "mine" || !tmdbKey() || !d.person || !d.person.name || (d.lib && d.lib !== MY_LIB)) return "";
  return `<div class="filmo" data-filmo="${esc(d.person.name)}" data-role="${d.role || roleIn(MY_LIB, d.person.name)}"><p class="dr-s">Checking TMDB for the full filmography…</p></div>`;
};
// Fills in any filmography placeholders on screen, once TMDB answers.
function fillFilmo(root) {
  for (const el of (root || document).querySelectorAll(".filmo[data-filmo]:not([data-busy])")) {
    el.dataset.busy = "1";
    const name = el.dataset.filmo, role = el.dataset.role;
    filmography(name, role).then((c) => {
      if (!el.isConnected) return;
      if (c.none || !c.credits || !c.credits.length) { el.innerHTML = `<p class="dr-s">TMDB has no filmography to compare with.</p>`; return; }
      const lib = MY_LIB, ids = new Map(), byTitle = new Map();
      for (const f of lib.films) { const m = META[f.key]; if (m && m.id) ids.set(m.id, f); byTitle.set(`${personKey(f.name)}|${f.year}`, f); }
      const seen = (x) => ids.get(x.id) || byTitle.get(`${personKey(x.title)}|${x.year}`) || byTitle.get(`${personKey(x.title)}|${x.year - 1}`) || byTitle.get(`${personKey(x.title)}|${x.year + 1}`);
      const have = c.credits.filter(seen), left = c.credits.filter((x) => !seen(x));
      const wl = new Set(lib.watchlistFilms.map((w) => `${personKey(w.name)}|${w.year}`));
      const roleWord = { d: "directed", c: "acted in", w: "written", p: "shot", m: "scored" }[role];
      const pct = Math.round(have.length / c.credits.length * 100);
      el.innerHTML = `<div class="filmo-head"><span><b>Seen ${fmtN(have.length)} of ${fmtN(c.credits.length)}</b> films ${esc(name)} has ${roleWord}</span><span class="num">${pct}%</span></div>
        <div class="filmo-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
        ${left.length ? `<details class="filmo-left"><summary>${plural(left.length, "film")} you haven't seen</summary>${left.map((x) => `<div class="drill-row plain"><span class="dr-main"><span class="dr-t">${esc(x.title)} <span class="dr-y">${x.year}</span></span>${wl.has(`${personKey(x.title)}|${x.year}`) ? `<span class="dr-s">On your watchlist</span>` : ""}</span>
          <a class="dr-r" href="https://www.themoviedb.org/movie/${x.id}" target="_blank" rel="noopener">TMDB ↗</a></div>`).join("")}</details>` : `<p class="dr-s">You've seen every one.</p>`}`;
    }).catch(() => { if (el.isConnected) el.innerHTML = `<p class="dr-s">Couldn't reach TMDB for the filmography.</p>`; });
  }
}
</script>
