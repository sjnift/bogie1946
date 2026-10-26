<script>
/* ---------- Letterboxd averages, through an Apify actor ----------
   Letterboxd has no public API and browsers can't read its pages from another site, so an Apify
   actor (solidcode/letterboxd-scraper) reads Letterboxd in Apify's cloud and returns each film's
   average. Apify's free plan needs no card and gives $5 of credit a month, and on that plan runs
   just stop when the credit is used up. So each run is capped to fit inside $5, whatever a run
   finishes is kept, and the next run asks only for the films still missing. Titles and years come
   from Letterboxd itself, so they match the export exactly. */
const LB_ACTOR = "solidcode~letterboxd-scraper";
// Apify's price for this actor on its free plan: per film, plus a fee per run.
const LB_PRICE_PER_FILM = 0.0036, LB_PRICE_PER_RUN = 0.005;
const LB_RUN_CAP = 1300; // films per run: about $4.69, inside the free plan's $5 a month
const runCost = (films) => films * LB_PRICE_PER_FILM + LB_PRICE_PER_RUN;
const cost = (n) => n < 0.01 ? "under 1¢" : `about $${n.toFixed(2)}`;
// film key → { r: average out of 5, n: ratings, slug, at } once found; { tries: 1, v: 2 } when the scraper didn't find it
// by title; { tries: 1, v: 2, few: true, slug } when it came back without an average; and, once the film's own page has
// been read (below), { tries: 1, v: 2, few: 2, slug } when the page shows no average, { tries: 2, v: 2 } when there's
// no page at any address its title gives
let LBX = store.get(KEYS.lbx, {});
const apifyKey = () => store.get(KEYS.apify, "");
const lbJob = { running: false, started: 0, note: "", err: false, badKey: false };
let editApify = false;

async function apify(path, opts = {}) {
  const res = await fetch("https://api.apify.com/v2" + path, {
    ...opts, headers: { "Content-Type": "application/json", Authorization: "Bearer " + apifyKey() },
  });
  if (res.ok) return res.json();
  // Apify says why it refused: { error: { type, message } }. Only a refusal about usage is "out of credit" (a refusal
  // read as that once hid that the page reader needed more access than a token gives: 25 Oct 2026).
  const why = await res.json().then((j) => (j && j.error) || {}).catch(() => ({}));
  const said = { status: res.status, type: String(why.type || ""), said: String(why.message || "").slice(0, 300) };
  if (res.status === 401) throw { code: "auth", ...said };
  if ((res.status === 402 || res.status === 403) && /usage|credit|limit|payment|funds|plan/i.test(said.type + " " + said.said)) throw { code: "credit", ...said };
  throw { code: "http", ...said };
}
const lbFound = (f) => LBX[f.key] && LBX[f.key].r;
// A film looked for by address and not found is left alone (until "Look for them again"). Tries from before both
// addresses were asked for don't count.
const lbTries = (f) => { const x = LBX[f.key]; return x && x.v === 2 ? x.tries || 0 : 0; };
const lbFew = (f) => !lbFound(f) && !!(LBX[f.key] && LBX[f.key].few);
const lbMissing = (lib) => lib.films.filter((f) => !lbFound(f) && lbTries(f) < 1);
// what reading the film's own page settled: no average shown there (too few ratings), or no page at all
const lbTooFew = (lib) => lib.films.filter((f) => lbFew(f) && LBX[f.key].few === 2 && lbSettled(f));
const lbNotFound = (lib) => lib.films.filter((f) => !lbFound(f) && lbTries(f) >= 2 && lbSettled(f));
// every film still without an average that a run can get: never asked, not found by the scraper, or come back without
// one (the scraper leaves the average out for some films that have thousands of ratings: the owner's 132, Oct 2026).
// A page read before the export's own links were used (`pv` under LB_PAGE_V) is read again through the film's link.
const LB_PAGE_V = 2;
const lbLink = (f) => (/^https:\/\/(boxd\.it|letterboxd\.com)\/[\w/.-]+$/.test(f.uri || "") ? f.uri : "");
const lbSettled = (f) => { const x = LBX[f.key] || {}; return (lbTries(f) >= 2 || (lbFew(f) && x.few === 2)) && ((x.pv || 1) >= LB_PAGE_V || !lbLink(f)); };
const lbRemaining = (lib) => lib.films.filter((f) => !lbFound(f) && !lbSettled(f));
// Letterboxd's address for a film: its title in lowercase with hyphens, accents and most punctuation dropped
const LB_LETTERS = { "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i" };
const lbSlug = (name) => String(name).toLowerCase().replace(/½/g, " half ").replace(/[øæœßłđðþı]/g, (c) => LB_LETTERS[c])
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’*.]/g, "").replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Both addresses a film can have: the plain one, and the one with its year that Letterboxd gives a title shared by
// several films. Asking for both in one run costs nothing extra for the one that doesn't exist.
const lbUrls = (f) => { const s = lbSlug(f.name); return s ? [s, ...(f.year ? [`${s}-${f.year}`] : [])] : []; };
const LB_SPARE = 1.05; // the odd plain address that leads to another film of the same name, which Apify still charges for
const lbAddressCap = (n) => Math.min(LB_RUN_CAP, Math.ceil(n * LB_SPARE) + 5);

/* Films missing after the run over the member's films page (it stops at LB_RUN_CAP) are asked for by address, in two
   runs: first each film's address with its year, which only a title shared by several films has, then the plain
   address for the films that didn't have one. Asking for both at once (until Oct 2026) charged two films for every
   shared title, so the run hit its cap early, and the films it never reached were marked not found for good: the
   owner was left with 144 of them. A run that hits its cap now marks nothing; those films are simply asked again. */
async function startLetterboxd(lib, mode) {
  const user = lib.profile.username;
  if (mode === "all") {
    if (!user) { Object.assign(lbJob, { note: "Your import has no Letterboxd username. Import the whole export ZIP, which includes profile.csv.", err: true }); renderLookup(); return; }
    return lbRun(lib, { startUrls: [`https://letterboxd.com/${user}/films/`], includeReviews: false, maxResults: Math.min(lib.films.length + 20, LB_RUN_CAP) }, { mode, phase: "profile" });
  }
  // "rest" (and the older "missing", "retry"): films never asked go to the scraper by address; then every film still
  // without an average has its own Letterboxd page read
  // (a film with its own link from the export skips the scraper: its page is read through the link)
  const fresh = lbMissing(lib).filter((f) => !lbLink(f)).slice(0, Math.floor(LB_RUN_CAP / LB_SPARE) - 5);
  return fresh.length ? lbAddressRun(lib, fresh, "year", { mode: "rest", matched: 0 }) : lbPageRun(lib, { mode: "rest", matched: 0 });
}

/* Each remaining film's own Letterboxd page, read through Apify's general page reader (apify/jsdom-scraper: nothing per
   film, only a few cents of running time), with the reading done here (LB_PAGE_FN): the average from the page's
   structured data, else its "x out of 5" line, else the ratings summary Letterboxd loads beside the page. Each page
   says its year, so a plain address that leads to another film of the same name is told apart. Each film is reached
   through its own link from the export (Letterboxd URI: a boxd.it short link that leads to the film's page), not an
   address made from its title: older films often keep an address from an earlier title (129 of the owner's 132 had
   no page at the title's address, 25 Oct 2026). The reader must be one
   Apify lists with limited access: apify/cheerio-scraper wants full access to the account, and Apify wouldn't start
   it with the owner's token (25 Oct 2026, a 403 the app then misread as "credit used up"). The page function reads
   only the page's text (`body`), so it works in either. */
const LB_READER = "apify~jsdom-scraper";
const LB_PAGE_FN = `async function pageFunction(context) {
  const { request, response, body, window } = context, u = request.userData || {};
  const doc = window && window.document && window.document.documentElement;
  const html = String(body || (doc ? doc.outerHTML : "") || "");
  const num = (x) => { const n = parseFloat(String(x).replace(/,/g, "")); return isFinite(n) ? n : null; };
  const status = response ? response.status || response.statusCode || null : null;
  const attrs = (tag) => { const o = {}, re = /([\\w:-]+)\\s*=\\s*"([^"]*)"/g; let a; while ((a = re.exec(tag))) o[a[1].toLowerCase()] = a[2]; return o; };
  const tags = (name) => html.match(new RegExp("<" + name + "\\\\b[^>]*>", "gi")) || [];
  const meta = (k, v) => { for (const t of tags("meta")) { const a = attrs(t); if (a[k] === v) return a.content || ""; } return ""; };
  const ld = (html.match(/<script[^>]*application\\/ld\\+json[^>]*>[\\s\\S]*?<\\/script>/gi) || []).join(" ");
  let r = null, n = null, m;
  if ((m = ld.match(/"ratingValue"\\s*:\\s*"?([\\d.]+)/))) r = num(m[1]);
  if ((m = ld.match(/"ratingCount"\\s*:\\s*"?([\\d,]+)/))) n = num(m[1]);
  if (!r && (m = meta("name", "twitter:data2").match(/([\\d.]+)\\s+out of 5/))) r = num(m[1]);
  if (!r && (m = html.match(/[Ww]eighted average of ([\\d.]+) based on ([\\d,]+)/))) { r = num(m[1]); n = num(m[2]); }
  if (!r && (m = html.match(/class="[^"]*average-rating[^"]*"[^>]*>\\s*(?:<[^>]+>\\s*)*([0-5](?:\\.\\d+)?)\\s*</))) r = num(m[1]);
  const og = meta("property", "og:title"), y = (og.match(/\\((\\d{4})\\)\\s*$/) || ld.match(/"startDate"\\s*:\\s*"(\\d{4})/) || [])[1];
  let canon = request.loadedUrl || request.url;
  for (const t of tags("link")) { const a = attrs(t); if (a.rel === "canonical" && a.href) canon = a.href; }
  const slug = u.slug || (String(canon).match(/\\/film\\/([^/]+)\\//) || [])[1] || null, year = u.year || (y ? Number(y) : null);
  const gone = status === 404;
  if (!gone && !u.csi && slug && (!r || !n)) for (const part of r ? ["rating-histogram"] : ["rating-histogram", "ratings-summary"])
    await context.enqueueRequest({ url: "https://letterboxd.com/csi/film/" + slug + "/" + part + "/", userData: { key: u.key, sure: u.sure, csi: true, slug, year } });
  return { key: u.key, sure: !!u.sure, csi: !!u.csi, slug, year, r, n, status, gone };
}`;
function lbPageRun(lib, carry) {
  const byKey = new Map(lib.films.map((f) => [f.key, f]));
  const films = (carry.only ? carry.only.map((k) => byKey.get(k)).filter(Boolean) : lbRemaining(lib)).slice(0, 1500), urls = [];
  for (const f of films) {
    // the film's own link from the export; without one (a film only in the daily feed), both addresses its title gives
    // (the one with the year is that film's for sure). uniqueKey: two films of the same title each get theirs read.
    const link = lbLink(f);
    if (link) urls.push({ url: link, uniqueKey: `${link}|${f.key}`, userData: { key: f.key, sure: true } });
    else for (const s of lbUrls(f)) urls.push({ url: `https://letterboxd.com/film/${s}/`, uniqueKey: `${s}|${f.key}`, userData: { key: f.key, sure: s !== lbSlug(f.name) } });
  }
  if (!urls.length) return finishLetterboxd(null, carry.matched);
  // Apify's shared data-centre addresses first; pages Letterboxd turned away there are tried once more through home
  // connections (its residential addresses: a few cents more, from the same credit)
  const proxy = carry.home ? { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] } : { useApifyProxy: true };
  return lbRun(lib, { startUrls: urls, pageFunction: LB_PAGE_FN, proxyConfiguration: proxy, linkSelector: "", maxCrawlingDepth: 1,
    maxConcurrency: 4, maxRequestRetries: 4, pageLoadTimeoutSecs: 30, maxPagesPerCrawl: urls.length * 3 + 10 },
    { mode: carry.mode, matched: carry.matched, started: carry.started, home: !!carry.home, phase: "page", actor: LB_READER, keys: films.map((f) => f.key) });
}
// One of the two address runs for these films: "year" (films without a year go straight on to the plain run) or "plain".
function lbAddressRun(lib, films, phase, carry) {
  const slugs = {}, keys = [], rest = [];
  for (const f of films) {
    const s = lbSlug(f.name);
    if (!s) continue;
    if (phase === "year" && !f.year) { rest.push(f.key); continue; }
    slugs[phase === "year" ? `${s}-${f.year}` : s] = f.key; keys.push(f.key);
  }
  if (!keys.length) return phase === "year" && rest.length ? lbAddressRun(lib, rest.map((k) => lib.films.find((f) => f.key === k)), "plain", carry) : finishLetterboxd(null, carry.matched);
  return lbRun(lib, { startUrls: Object.keys(slugs).map((s) => `https://letterboxd.com/film/${s}/`), includeReviews: false, maxResults: lbAddressCap(keys.length) },
    { ...carry, phase, keys, slugs, rest });
}
async function lbRun(lib, input, meta) {
  Object.assign(lbJob, { running: true, started: meta.started || Date.now(), note: "", err: false, badKey: false });
  renderLookup();
  try {
    const run = await apify(`/acts/${meta.actor || LB_ACTOR}/runs${meta.actor ? "?memory=1024&timeout=1200" : ""}`, { method: "POST", body: JSON.stringify(input) });
    store.set(KEYS.lbRun, { ...meta, id: run.data.id, dataset: run.data.defaultDatasetId, at: meta.started || Date.now(), asked: input.maxResults });
    await pollLetterboxd(lib);
  } catch (e) { finishLetterboxd(e); }
}

// Waits for the run, then keeps whatever it found, even if it stopped early. Also called on page
// load, so a run started earlier is picked up after the page was closed.
async function pollLetterboxd(lib) {
  const r = store.get(KEYS.lbRun, null);
  if (!r || !apifyKey()) return;
  Object.assign(lbJob, { running: true, started: r.at, note: "", err: false });
  renderLookup();
  try {
    let status;
    for (;;) {
      status = (await apify(`/actor-runs/${r.id}`)).data.status;
      if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) break;
      renderLookupProgress();
      await sleep(8000);
    }
    const items = [];
    const fields = r.phase === "page" ? "key,sure,csi,slug,year,r,n,status,gone" : "recordType,title,year,filmSlug,averageRating,ratingsCount";
    for (let offset = 0; ; offset += 1000) {
      const page = await apify(`/datasets/${r.dataset}/items?clean=true&offset=${offset}&limit=1000&fields=${fields}`);
      items.push(...page);
      if (page.length < 1000) break;
    }
    if (r.phase === "page") return lbPageResults(lib, r, status, items);
    // Match each film Apify returns to one in the diary: by title and year, then by title alone when only one
    // film has it and the years are within one, then by the address it was asked for.
    const byTitle = new Map(), byKey = new Map(lib.films.map((f) => [f.key, f]));
    for (const f of lib.films) { const t = personKey(f.name); if (!byTitle.has(t)) byTitle.set(t, []); byTitle.get(t).push(f); }
    const near = (f, y) => !y || !f.year || Math.abs(f.year - y) <= 1;
    const match = (it) => {
      const y = Number(it.year) || null, list = byTitle.get(personKey(String(it.title || "").replace(/\s*\(\d{4}\)\s*$/, ""))) || [];
      const f = list.find((x) => x.year === y) || (list.length === 1 && near(list[0], y) ? list[0] : null);
      if (f) return f;
      const asked = byKey.get((r.slugs || {})[it.filmSlug]);
      return asked && near(asked, y) ? asked : null;
    };
    const today = new Date().toISOString().slice(0, 10);
    let matched = 0, films = 0, stray = 0;
    const hit = new Set(), seen = new Set();
    for (const it of items) {
      if (it.recordType && it.recordType !== "film") continue;
      films++;
      const f = match(it);
      if (!f) { stray++; continue; }
      seen.add(f.key);
      // on Letterboxd, but with too few ratings there for an average
      if (!(Number(it.averageRating) > 0)) { if (!lbFound(f)) LBX[f.key] = { tries: 1, v: 2, few: true, slug: it.filmSlug || null }; continue; }
      if (!lbFound(f)) matched++;
      hit.add(f.key);
      LBX[f.key] = { r: Number(it.averageRating), n: Number(it.ratingsCount) || 0, slug: it.filmSlug || null, at: today };
    }
    const capped = films >= (r.asked || Infinity), total = (r.matched || 0) + matched;
    const left = (r.keys || []).filter((k) => !seen.has(k));
    store.set(KEYS.lbx, LBX);
    store.del(KEYS.lbRun);
    // the films whose address with the year didn't exist: their plain address next
    if (r.phase === "year" && status === "SUCCEEDED") {
      const next = [...left, ...(r.rest || [])].map((k) => byKey.get(k)).filter(Boolean);
      if (next.length) return lbAddressRun(lib, next, "plain", { mode: r.mode, matched: total, started: r.at });
    }
    // a film asked for at both its addresses that didn't come back isn't found by the scraper; unless the run stopped
    // at its cap first, when those it didn't reach stay missing and are asked for next time
    else if (r.phase !== "profile" && r.mode !== "all" && status === "SUCCEEDED" && !capped) for (const k of left) LBX[k] = { tries: 1, v: 2 };
    // then every film still without an average has its own page read
    if (r.mode === "rest" && status === "SUCCEEDED" && r.phase !== "profile") { store.set(KEYS.lbx, LBX); return lbPageRun(lib, { mode: "rest", matched: total, started: r.at }); }
    lbJob.stats = { updated: hit.size - matched, stray: r.mode === "all" ? stray : 0, capped: capped && (r.mode === "all" ? "profile" : "address") };
    store.set(KEYS.lbx, LBX);
    finishLetterboxd(status === "SUCCEEDED" ? null : { code: "stopped" }, total);
  } catch (e) {
    // a run this token can't see (started with the token used before): forget it rather than ask for it at every start
    // (reading a run never costs credit, so a refusal here means the run isn't this token's)
    if (e && ((e.code === "http" && e.status === 404) || e.code === "credit")) { store.del(KEYS.lbRun); e = { code: "gone" }; }
    finishLetterboxd(e);
  }
}
// What the films' own pages said: an average (from a page of the right year), a page with none, or no page at all.
// A film whose pages Apify couldn't load is left as it was, to be asked again.
function lbPageResults(lib, r, status, items) {
  const today = new Date().toISOString().slice(0, 10), byKey = new Map(lib.films.map((f) => [f.key, f]));
  const got = new Map();
  for (const it of items) {
    const f = it && byKey.get(it.key);
    if (!f) continue;
    const g = got.get(f.key) || got.set(f.key, { reached: false, gone: 0 }).get(f.key);
    const y = Number(it.year) || null, right = it.sure || !y || !f.year || Math.abs(y - f.year) <= 1;
    if (!right) continue; // another film of the same name
    if (it.gone) { g.gone++; continue; }
    g.reached = true; g.slug = g.slug || it.slug || null;
    if (Number(it.r) > 0 && !(g.r > 0)) Object.assign(g, { r: Number(it.r), n: Number(it.n) || 0, slug: it.slug || g.slug });
    else if (!g.n && Number(it.n) > 0) g.n = Number(it.n); // the count from the ratings summary beside the page
  }
  let matched = 0;
  const unread = [];
  for (const k of r.keys || []) {
    const g = got.get(k), was = LBX[k] || {};
    if (g && g.r > 0) { LBX[k] = { r: g.r, n: g.n, slug: g.slug, at: today }; matched++; }
    else if (g && g.reached) LBX[k] = { tries: 1, v: 2, few: 2, pv: LB_PAGE_V, slug: g.slug || was.slug || null };
    // no page only when every address asked for said so (one turned away is read again)
    else if (g && g.gone >= (lbLink(byKey.get(k)) ? 1 : lbUrls(byKey.get(k)).length) && status === "SUCCEEDED") LBX[k] = { tries: 2, v: 2, pv: LB_PAGE_V };
    else unread.push(k);
  }
  store.set(KEYS.lbx, LBX);
  store.del(KEYS.lbRun);
  const total = (r.matched || 0) + matched;
  if (unread.length && !r.home) return lbPageRun(lib, { mode: r.mode, matched: total, started: r.at, home: true, only: unread });
  lbJob.stats = { unread: unread.length };
  finishLetterboxd(status === "SUCCEEDED" || r.home ? null : { code: "stopped" }, total);
}
function finishLetterboxd(e, matched = 0) {
  lbJob.running = false;
  lbJob.err = !!e && e.code !== "stopped";
  lbJob.badKey = !!e && e.code === "auth";
  const left = lbRemaining(state.lib || MY_LIB).length, st = lbJob.stats || {};
  const rest = left ? ` ${plural(left, "film is", "films are")} still without an average${st.capped === "profile" ? `, because one run stops at ${fmtN(LB_RUN_CAP)} films to stay inside the free credit` : ""}${st.unread ? `: Letterboxd didn't let Apify in for ${st.unread === left ? (left === 1 ? "it" : "them") : `${fmtN(st.unread)} of them`} this time` : ""}; get ${left === 1 ? "it" : "them"} with the button above${st.unread ? " in a while" : ", next month if this month's free credit is used up"}.` : "";
  const got = `${st.updated ? ` Updated ${plural(st.updated, "film")} already there.` : ""}${st.stray ? ` ${plural(st.stray, "film")} from your Letterboxd profile didn't match a film in this import, so ${st.stray === 1 ? "it was" : "they were"} left out.` : ""}`;
  lbJob.note = !e ? `Done.${matched || !st.updated ? ` Added Letterboxd averages for ${plural(matched, "film")}.` : ""}${got}${rest}`
    : e.code === "stopped" ? `Apify stopped the run early, usually because this month's free credit ran out. Kept the ${plural(matched, "film")} it finished.${rest}`
    : e.code === "auth" ? "Apify didn't accept that token. Copy it again from Apify Console → Settings → API & Integrations."
    : e.code === "credit" ? `Apify wouldn't start the run because of this month's credit${e.said ? ` ("${e.said}")` : ""}. On the free plan it comes back at the start of next month.`
    : e instanceof TypeError ? "Couldn't reach Apify. Check your connection; a run already started is picked up next time you open the page."
    : e.code === "gone" ? "A run started with your previous Apify token can't be read with this one, so it was set aside. Start a new one with the button above."
    : e.said ? `Apify wouldn't do it. It said: "${e.said}"` : "Something went wrong talking to Apify. Try again in a minute.";
  scheduleRender();
}

// The Letterboxd part of the Cast & crew box, for both layouts.
function letterboxdBlock(lib, phone) {
  if (IN_VIEWER || !lib) return "";
  const title = phone ? `<p class="title" style="margin-top:6px">Letterboxd averages</p>` : `<h3 class="sub-h">Letterboxd averages</h3>`;
  const btn = (act, label) => phone ? `<button class="btn green block" type="button" data-lb="${act}">${label}</button>` : `<button class="btn primary" type="button" data-lb="${act}">${label}</button>`;
  const link = (act, label) => `<button class="linkish" type="button" data-lb="${act}">${label}</button>`;
  const row = (button, text) => phone ? `${button}<p class="status">${text}</p>` : `<div class="lookup-row">${button}<span class="status">${text}</span></div>`;
  const note = lbJob.note ? `<p class="status${lbJob.err ? " err" : ""}" role="status">${esc(lbJob.note)}</p>` : "";
  const free = `Free with Apify's free plan: no card needed, and its $5 of credit a month covers about ${fmtN(LB_RUN_CAP)} films. On that plan nothing is ever charged; runs just stop when the month's credit is used up.`;
  if (lbJob.running) return title + `<p class="status" id="lb-progress" role="status">${lbProgressText()}</p>`;
  if (!apifyKey() || editApify || lbJob.badKey) {
    // anyone's own free Apify account (asked Oct 2026: visitors make their own, nothing of the owner's is shared)
    const input = `<label class="sr-only" for="apify-key">Apify API token</label><input ${phone ? 'class="key" ' : ""}id="apify-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your Apify API token" value="${esc(apifyKey())}">`;
    const save = phone ? `<button class="btn block" type="button" data-lb="save">Save token</button>` : `<button class="btn" type="button" data-lb="save">Save token</button>`;
    const steps = apifyKey() && !lbJob.badKey ? "" : `<p class="status">Compare your ratings with Letterboxd members' averages for the same films. Letterboxd has no public way in, so
      <a href="https://apify.com/solidcode/letterboxd-scraper" target="_blank" rel="noopener">Apify</a> reads its pages for you, with a free account of your own:</p>
      <ol class="steps lb-steps"><li><a href="https://console.apify.com/sign-up" target="_blank" rel="noopener">Create a free Apify account</a>. No card needed.</li>
        <li>In Apify, open <a href="https://console.apify.com/settings/integrations" target="_blank" rel="noopener">Settings → API &amp; Integrations</a> and copy your personal API token.</li>
        <li>Paste it here and press Save token. Then get the averages for your films with one button.</li></ol>`;
    return title + steps + (phone ? input + save : `<div class="lookup-row">${input}${save}</div>`) +
      `<p class="status">${free} Your token is saved in this browser only${SITE_ON && SITE ? " (and in your locked diary on this site)" : ""}.</p>` + note;
  }
  const total = lib.films.length, missing = lbRemaining(lib), fresh = lbMissing(lib).length, found = lib.films.filter(lbFound).length, gone = lbNotFound(lib).length, few = lbTooFew(lib);
  const askCost = (n) => cost(n * LB_PRICE_PER_FILM * LB_SPARE + 3 * LB_PRICE_PER_RUN + 0.03);
  let body;
  if (!found && !gone) {
    const n = Math.min(total, LB_RUN_CAP);
    body = row(btn("all", total > LB_RUN_CAP ? `Get averages for the first ${fmtN(n)} of ${plural(total, "film")}` : `Get Letterboxd averages for ${plural(total, "film")}`),
      `Uses ${cost(runCost(n))} of Apify credit.${total > LB_RUN_CAP ? " The rest come next month, inside the free credit." : ""}`);
  } else if (missing.length) {
    const n = Math.min(lbMissing(lib).filter((f) => !lbLink(f)).length, Math.floor(LB_RUN_CAP / LB_SPARE) - 5);
    body = `<p class="status">${fmtN(found)} of ${plural(total, "film")} have Letterboxd averages; ${dlink(D.films("Without a Letterboxd average yet", plural(missing.length, "film"), missing, { sort: "name" }), `${fmtN(missing.length)} don't yet`)}.</p>` +
      row(btn("rest", `Get the remaining ${plural(missing.length, "film")}`), `Uses ${n ? askCost(n) : "a few cents"} of Apify credit. ${n ? `${n === missing.length ? "They're" : `${fmtN(n)} not asked for before are`} looked up by their Letterboxd address; then any still without an average have their own Letterboxd page read for it.` : "Each film's own Letterboxd page is read for its average."}`);
  } else body = `<p class="status">${fmtN(found)} of ${plural(total, "film")} have Letterboxd averages. ${link("all", `Refresh them (${cost(runCost(Math.min(total, LB_RUN_CAP)))})`)}</p>`;
  const goneList = gone && D.films("Not found on Letterboxd", "Their Letterboxd links didn't lead to a page", lbNotFound(lib), { sort: "name" });
  const goneNote = gone ? `<p class="status">${dlink(goneList, plural(gone, "film"))} couldn't be opened on Letterboxd, so ${gone === 1 ? "it's" : "they're"} left out of Letterboxd comparisons.</p>` : "";
  const fewNote = few.length ? `<p class="status">${dlink(D.films("No average on Letterboxd", "Their Letterboxd pages show no average: too few ratings there", few, { sort: "name" }), plural(few.length, "film"))}
    ${few.length === 1 ? "shows" : "show"} no average on ${few.length === 1 ? "its" : "their"} Letterboxd page: too few ratings there.</p>` : "";
  return title + body + goneNote + fewNote + `<p class="status">${free} ${link("change", "Change Apify token")}</p>` + note;
}
// Under "against the crowd" on both layouts, until this diary has its first Letterboxd averages.
function lbHint(phone) {
  if (IN_VIEWER || !MY_LIB || state.mode === "example" || lbJob.running || MY_LIB.films.some(lbFound)) return "";
  const where = phone ? `<button class="linkish" type="button" data-act="settings">Settings</button>` : `<a class="lb-go" href="#/settings">Settings → Film details</a>`;
  return `<p class="note">${apifyKey() ? `Compare with Letterboxd members too: get their averages for your films in ${where}.`
    : `Compare with Letterboxd members too: connect a free Apify account of your own in ${where}, then get their averages for your films.`}</p>`;
}
function lbProgressText() {
  const mins = Math.max(0, Math.round((Date.now() - lbJob.started) / 60000));
  return `Apify is reading Letterboxd for you (started ${mins ? `${mins} min ago` : "just now"}). Big libraries take several minutes; you can close this page and the results are picked up when you come back.`;
}
function lbAction(act, lib) {
  if (act === "save") {
    const key = ($("#apify-key")?.value || "").trim();
    if (!key) { Object.assign(lbJob, { note: "Paste your Apify token first.", err: true }); renderLookup(); return; }
    // asked of Apify before it's kept, so a token copied wrong is caught now rather than at the first run
    Object.assign(lbJob, { note: "Checking the token with Apify…", err: false }); renderLookup();
    fetch("https://api.apify.com/v2/users/me", { headers: { Authorization: "Bearer " + key } }).then((r) => r.status !== 401).catch(() => true).then((ok) => {
      if (!ok) { Object.assign(lbJob, { note: "Apify didn't accept that token. Copy it again from Settings → API & Integrations in your Apify account.", err: true }); renderLookup(); return; }
      store.set(KEYS.apify, key); editApify = false; lbJob.badKey = false;
      Object.assign(lbJob, { note: lib && lib.films.some(lbFound) ? "Token saved." : "Token saved. Now get the Letterboxd averages for your films with the button above.", err: false });
      renderLookup();
    });
  } else if (act === "change") { editApify = true; renderLookup(); $("#apify-key")?.focus(); }
  else if (act === "all" || act === "rest" || act === "missing" || act === "retry") startLetterboxd(lib, act === "all" ? "all" : "rest");
  else if (act === "ic-start") startCastCheck(lib);
}
/* ---------- The owner's cast, checked against IMDb (asked 26 Oct 2026) ----------
   "In my case cross check it with IMDb data and apply it to my people stats." IMDb keeps the fullest cast lists and
   says which roles are uncredited, voice or archive footage, but neither this site nor the container it's built in can
   read IMDb (it lets no other site in). So, as for Letterboxd's pages, Apify's page reader opens each film's full cast
   page on IMDb (/title/tt…/fullcredits/) through the owner's own Apify account, and our page function reads the cast
   from it: IMDb's data (`__NEXT_DATA__`, the page since 2025), else the cast table of the older page, else each name
   with its character link. Letterboxd's rule (`roleSkip`) is then applied to IMDb's roles:
   - a role TMDB counts that IMDb marks uncredited, as a cameo, as archive footage or cut, comes off (`cr`);
   - a credited role with a character on IMDb that TMDB doesn't count (missing there, or uncredited, or with no
     character) goes on (`ca`), under the spelling TMDB uses for that person elsewhere in the diary when there is one
     (IMDb writes "Kang-ho Song" where TMDB has "Song Kang-ho");
   - a role IMDb lists with no character takes nothing off: that is IMDb not knowing, not a cameo.
   `cq` is when it was checked, `cp` that IMDb's page held only part of a very long cast. Only the owner's own diary
   (`isSiteOwner`) offers it. It tries CAST_TRIAL films first and goes on only if IMDb let Apify read them, and only
   when the rest would cost no more than CAST_BUDGET, worked out from what the trial cost. */
const CAST_CHECK_FIELDS = ["cq", "ca", "cr", "cp", "cn", "can"];
const CAST_TRIAL = 5, CAST_BUDGET = 1.5, CAST_PER_RUN = 2000;
const icJob = { running: false, started: 0, note: "", err: false, stats: null };
const castChecked = () => (MY_LIB && isSiteOwner() ? MY_LIB.films.filter((f) => META[f.key] && META[f.key].cq).length : 0);
const castToCheck = (lib) => lib.films.filter((f) => { const m = META[f.key]; return m && !m.miss && /^tt\d+$/.test(m.im || "") && !m.cq; });
const castCheckOn = (lib) => !IN_VIEWER && !!lib && !!lib.profile && String(lib.profile.username || "").toLowerCase() === SITE_OWNER;
const CAST_PAGE_FN = `async function pageFunction(context) {
  const { request, response, body, window } = context, u = request.userData || {};
  const doc = window && window.document && window.document.documentElement;
  const html = String(body || (doc ? doc.outerHTML : "") || "");
  const status = response ? response.status || response.statusCode || null : null;
  const plain = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;|&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#160;/g, " ").replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\\s+/g, " ").trim();
  const people = new Map();
  let total = 0, layout = "";
  const add = (id, name, role) => {
    if (!/^nm\\d+$/.test(id || "") || !name) return;
    const x = people.get(id), r = String(role || "").trim();
    if (!x) people.set(id, [id, String(name).trim().slice(0, 120), r.slice(0, 300)]);
    else if (r && !x[2].includes(r)) x[2] = (x[2] ? x[2] + " / " : "") + r.slice(0, 200);
  };
  const str = (v) => (typeof v === "string" ? v : v && typeof v === "object" ? String(v.text || v.name && (typeof v.name === "string" ? v.name : v.name.text) || (v.nameText && v.nameText.text) || v.value || "") : "");
  const strs = (v) => (Array.isArray(v) ? v : v && Array.isArray(v.edges) ? v.edges.map((e) => e && e.node) : v ? [v] : []).map(str).filter(Boolean);
  const CREW = /^(director|writer|producer|composer|cinematographer|editor|casting|production|art|set|costume|make|sound|special|visual|stunt|camera|animation|editorial|location|music|script|transportation|miscellaneous|thanks|crew)/;
  // IMDb's own data for the page: the cast category's people, with their characters and attributes
  const walk = (node, cast, depth) => {
    if (!node || typeof node !== "object" || depth > 60) return;
    if (Array.isArray(node)) { for (const x of node) walk(x, cast, depth + 1); return; }
    const cid = String(node.id || (node.category && node.category.id) || "").toLowerCase();
    const cname = String(typeof node.name === "string" ? node.name : (node.category && (node.category.text || node.category.name)) || "").toLowerCase();
    if (cid === "cast" || cid === "actor" || cid === "actress" || cid === "self" || cname === "cast") cast = true;
    else if (cid && !/^nm\\d+$/.test(cid) && CREW.test(cid)) cast = false;
    if (cast && typeof node.total === "number" && node.total > total) total = node.total;
    const pid = /^nm\\d+$/.test(node.id || "") ? node.id : /^nm\\d+$/.test(node.nameId || "") ? node.nameId : node.name && /^nm\\d+$/.test(node.name.id || "") ? node.name.id : "";
    if (cast && pid) {
      const name = node.rowTitle || (node.nameText && node.nameText.text) || (node.name && node.name.nameText && node.name.nameText.text) || (typeof node.name === "string" ? node.name : "") || node.title || "";
      const chars = strs(node.characters || node.character || node.characterNames).join(" / ");
      const attrs = strs(node.attributes || node.attribute).map((a) => (/^\\(/.test(a) ? a : "(" + a + ")")).join(" ");
      if (typeof name === "string" && name) add(pid, name, [chars, attrs].filter(Boolean).join(" "));
    }
    for (const k in node) if (node[k] && typeof node[k] === "object") walk(node[k], cast, depth + 1);
  };
  const nd = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\\s\\S]*?)<\\/script>/);
  if (nd) { try { walk(JSON.parse(nd[1]), false, 0); if (people.size) layout = "data"; } catch (e) {} }
  // the older page: a table of the cast, each row a name and its character
  const table = !people.size && html.match(/<table[^>]*class="[^"]*cast_list[^"]*"[^>]*>([\\s\\S]*?)<\\/table>/i);
  if (table) {
    for (const row of table[1].split(/<tr[\\s>]/i)) {
      const a = row.match(/<a[^>]+href="\\/name\\/(nm\\d+)[^"]*"[^>]*>\\s*([^<]+?)\\s*<\\/a>/i), ch = row.match(/<td[^>]*class="[^"]*character[^"]*"[^>]*>([\\s\\S]*?)<\\/td>/i);
      if (a) add(a[1], plain(a[2]), ch ? plain(ch[1]) : "");
    }
    if (people.size) layout = "table";
  }
  // else each name that has a character link after it, and what's written by it
  if (!people.size) {
    for (const chunk of html.split(/(?=<a[^>]+href="\\/name\\/nm\\d+)/i).slice(1)) {
      const a = chunk.match(/^<a[^>]+href="\\/name\\/(nm\\d+)[^"]*"[^>]*>([\\s\\S]*?)<\\/a>/i);
      const ch = chunk.match(/<a[^>]+href="\\/title\\/tt\\d+\\/characters\\/[^"]*"[^>]*>([\\s\\S]*?)<\\/a>/i);
      if (!a || !ch || !plain(a[2])) continue;
      const near = plain(chunk.slice(0, 1500)), attrs = (near.match(/\\((?:uncredited|voice|archive[^)]*|as [^)]+|credit only|scenes? deleted|deleted scenes?|cameo[^)]*)\\)/gi) || []).join(" ");
      add(a[1], plain(a[2]), [plain(ch[1]), attrs].filter(Boolean).join(" "));
    }
    if (people.size) layout = "links";
  }
  const cast = [...people.values()];
  return { key: u.key, tt: u.tt, status, layout, n: cast.length, total: Math.max(total, cast.length), more: total > cast.length, cast };
}`;

// People are the same across TMDB and IMDb when their names are, in any order ("Song Kang-ho", "Kang-ho Song").
const nameOrderKey = (n) => personKey(n).split(" ").filter(Boolean).sort().join(" ");
// What IMDb's cast says of one film, put against what TMDB counts: what to add and what to take off.
function castCheckOf(m, cast, spelling) {
  const tmdb = new Map(), idOf = new Map((m.c || []).map((n, i) => [n, Number((m.ci || [])[i]) || 0]));
  for (const n of m.c || []) { tmdb.set(personKey(n), n); tmdb.set(nameOrderKey(n), n); }
  const add = [], off = [], cn = {}, can = {};
  // a role IMDb credits goes on only when it isn't a small part by IMDb's own billing (05-core, `smallPart`)
  const small = (i, roles) => (i >= PRINCIPAL && cast.length > BIG_CAST && (i >= cast.length / 2 || i >= BIG_CAST)) || (i >= BIT_FROM && roles.every((r) => bitPart(r)));
  for (const [i, [nm, name, role]] of cast.entries()) {
    const roles = String(role || "").split(" / ").map((r) => r.trim());
    const why = roles.map((r) => roleSkip(r)), counts = why.some((w) => !w);
    const known = tmdb.get(personKey(name)) || tmdb.get(nameOrderKey(name));
    // which IMDb person TMDB's person of that name is in this film, to see whether TMDB has the right one (05-core)
    if (known && idOf.get(known)) cn[idOf.get(known)] = nm;
    // taken off only on IMDb's word that the role isn't one (no character on IMDb is IMDb not knowing)
    if (known && !counts && why.every((w) => w && w !== "no character")) off.push(known);
    else if (!known && counts && !small(i, roles) && !roles.some((r) => VOICE.test(r) || BACKGROUND_VOICES.test(r) || playsSelf(name, r))) { const n = spelling.get(nameOrderKey(name)) || name; add.push(n); can[n] = nm; }
  }
  return { ca: [...new Set(add)], cr: [...new Set(off)], cn, can };
}
function startCastCheck(lib) {
  const films = castCheckOn(lib) ? castToCheck(lib) : [];
  if (!films.length || icJob.running || !apifyKey()) return;
  return castRun(lib, films.slice(0, CAST_TRIAL), { phase: "trial", started: Date.now() });
}
function castRun(lib, films, meta) {
  const urls = films.map((f) => { const tt = META[f.key].im;
    return { url: `https://www.imdb.com/title/${tt}/fullcredits/`, uniqueKey: `${tt}|${f.key}`, headers: { "Accept-Language": "en-US,en;q=0.9" }, userData: { key: f.key, tt } }; });
  Object.assign(icJob, { running: true, started: meta.started || Date.now(), note: "", err: false });
  renderLookup();
  return apify(`/acts/${LB_READER}/runs?memory=1024&timeout=3600`, { method: "POST", body: JSON.stringify({ startUrls: urls, pageFunction: CAST_PAGE_FN,
    proxyConfiguration: { useApifyProxy: true }, linkSelector: "", maxCrawlingDepth: 0, maxConcurrency: 6, maxRequestRetries: 3, pageLoadTimeoutSecs: 45,
    maxPagesPerCrawl: urls.length + 5 }) })
    .then((run) => { store.set(KEYS.icRun, { ...meta, id: run.data.id, dataset: run.data.defaultDatasetId, at: meta.started || Date.now(), keys: films.map((f) => f.key) }); return pollCastCheck(lib); })
    .catch((e) => finishCastCheck(e));
}
// Waits for the run (also on page load, so a run started earlier is picked up), then keeps what IMDb said.
async function pollCastCheck(lib) {
  const r = store.get(KEYS.icRun, null);
  if (!r || !apifyKey() || !lib) return;
  Object.assign(icJob, { running: true, started: r.at, note: "", err: false });
  renderLookup();
  try {
    let run;
    for (;;) {
      run = (await apify(`/actor-runs/${r.id}`)).data;
      if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) break;
      renderLookupProgress();
      await sleep(8000);
    }
    const items = [];
    for (let offset = 0; ; offset += 500) {
      const page = await apify(`/datasets/${r.dataset}/items?clean=true&offset=${offset}&limit=500&fields=key,tt,status,layout,n,total,more,cast`);
      items.push(...page);
      if (page.length < 500) break;
    }
    store.del(KEYS.icRun);
    const byKey = new Map(lib.films.map((f) => [f.key, f])), today = new Date().toISOString().slice(0, 10);
    // the spelling TMDB uses for each person anywhere in the diary
    const spelling = new Map();
    for (const f of lib.films) for (const n of (META[f.key] && META[f.key].c) || []) if (!spelling.has(nameOrderKey(n))) spelling.set(nameOrderKey(n), n);
    let read = 0, added = 0, off = 0;
    for (const it of items) {
      const f = it && byKey.get(it.key), m = f && META[f.key];
      if (!m || !Array.isArray(it.cast) || !it.n || m.im !== it.tt) continue;
      const cast = it.cast.filter((x) => Array.isArray(x) && /^nm\d+$/.test(x[0]) && typeof x[1] === "string").map((x) => [x[0], x[1], String(x[2] || "")]);
      const d = castCheckOf(m, cast, spelling);
      META[f.key] = { ...m, cq: today, ca: d.ca, cr: d.cr, cn: d.cn, can: d.can, ...(it.more ? { cp: true } : {}) };
      read++; added += d.ca.length; off += d.cr.length;
    }
    saveMeta();
    const st = { read: (r.read || 0) + read, added: (r.added || 0) + added, off: (r.off || 0) + off, asked: (r.keys || []).length, got: read };
    const cost = Number(run.usageTotalUsd) || 0, spent = (r.spent || 0) + cost;
    if (r.phase === "trial") {
      // IMDb let Apify in for most of the trial: go on with the rest, if it fits the budget
      if (read < Math.min(3, st.asked)) return finishCastCheck({ code: "blocked", got: read, asked: st.asked });
      const rest = castToCheck(lib), each = cost && read ? cost / st.asked : 0.0008, projected = each * rest.length + 0.01;
      if (rest.length && projected <= CAST_BUDGET) return castRun(lib, rest.slice(0, CAST_PER_RUN), { phase: "rest", started: r.at, ...st, spent });
      icJob.stats = { ...st, spent, projected: rest.length ? projected : 0 };
      return finishCastCheck(null);
    }
    icJob.stats = { ...st, spent };
    finishCastCheck(run.status === "SUCCEEDED" ? null : { code: "stopped" });
  } catch (e) {
    if (e && ((e.code === "http" && e.status === 404) || e.code === "credit")) store.del(KEYS.icRun);
    finishCastCheck(e);
  }
}
function finishCastCheck(e) {
  icJob.running = false;
  icJob.err = !!e && e.code !== "stopped";
  const st = icJob.stats || {}, left = MY_LIB ? castToCheck(MY_LIB).length : 0;
  const did = st.read ? `Checked ${plural(st.read, "film")} on IMDb: ${plural(st.added || 0, "role")} IMDb credits went on, and ${plural(st.off || 0, "role")} IMDb marks uncredited, as a cameo or as archive footage came off.` : "";
  icJob.note = !e ? `${did}${st.projected ? ` The other ${plural(left, "film")} would use about $${st.projected.toFixed(2)} of Apify credit: start them with the button above when you like.` : left ? ` ${plural(left, "film is", "films are")} still to check.` : ""}`.trim() || "Done."
    : e.code === "blocked" ? `IMDb didn't let Apify read its cast pages (${e.got} of ${e.asked} came back), so nothing more was tried and almost no credit was used. Try again another day.`
    : e.code === "stopped" ? `Apify stopped early, usually because this month's free credit ran out. ${did} The rest are checked next time.`
    : e.code === "auth" ? "Apify didn't accept your token. Change it in Letterboxd averages above."
    : e.code === "credit" ? `Apify wouldn't start the run because of this month's credit${e.said ? ` ("${e.said}")` : ""}. It comes back at the start of next month.`
    : e instanceof TypeError ? "Couldn't reach Apify. Check your connection; a run already started is picked up next time you open the page."
    : e.said ? `Apify wouldn't do it. It said: "${e.said}"` : "Something went wrong talking to Apify. Try again in a minute.";
  scheduleRender();
}
function castProgressText() {
  const mins = Math.max(0, Math.round((Date.now() - icJob.started) / 60000));
  return `Apify is reading IMDb's cast lists for you (started ${mins ? `${mins} min ago` : "just now"}). You can close this page; the results are picked up when you come back.`;
}
// The films whose cast IMDb put right, and the people it added or took off, for the box below and its links.
function castChanges(lib) {
  const add = new Map(), off = new Map(), films = [];
  for (const f of lib.films) {
    const m = META[f.key];
    if (!m || !m.cq || (!(m.ca || []).length && !(m.cr || []).length)) continue;
    films.push(f);
    for (const [map, list] of [[add, m.ca || []], [off, m.cr || []]]) for (const n of list) {
      const k = personKey(n), p = map.get(k) || map.set(k, { key: k, name: n, films: [] }).get(k);
      p.films.push(f);
    }
  }
  const sorted = (map) => [...map.values()].sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
  return { films, add: sorted(add), off: sorted(off) };
}
// In the Cast & crew box, under Letterboxd averages, on both layouts: the owner's diary only.
function castCheckBlock(lib, phone) {
  if (!castCheckOn(lib)) return "";
  const title = phone ? `<p class="title" style="margin-top:6px">Cast checked on IMDb</p>` : `<h3 class="sub-h">Cast checked on IMDb</h3>`;
  const note = icJob.note ? `<p class="status${icJob.err ? " err" : ""}" role="status">${esc(icJob.note)}</p>` : "";
  const what = `<p class="status">Who counts as cast follows Letterboxd's rule: every credited role, but not cameos, uncredited roles or archive footage. For your diary, each film's full cast list on IMDb puts TMDB's right: roles IMDb marks uncredited, as a cameo or as archive footage come off, and credited roles IMDb has that TMDB lacks go on.</p>`;
  if (icJob.running) return title + `<p class="status" id="ic-progress" role="status">${castProgressText()}</p>`;
  if (!apifyKey()) return title + what + `<p class="status">It reads IMDb through your Apify account: save your Apify token in Letterboxd averages above first.</p>`;
  const todo = castToCheck(lib), done = lib.films.filter((f) => META[f.key] && META[f.key].cq).length, ch = castChanges(lib);
  const btn = (label) => phone ? `<button class="btn green block" type="button" data-lb="ic-start">${label}</button>` : `<button class="btn primary" type="button" data-lb="ic-start">${label}</button>`;
  const row = (button, text) => phone ? `${button}<p class="status">${text}</p>` : `<div class="lookup-row">${button}<span class="status">${text}</span></div>`;
  const changes = done ? `<p class="status">${fmtN(done)} of ${plural(lib.films.length, "film")} checked. IMDb ${ch.add.length ? dlink(D.names("Added from IMDb", "Credited on IMDb, not counted on TMDB", ch.add), `added ${plural(ch.add.length, "person", "people")}`) : "added nobody"}
    and ${ch.off.length ? dlink(D.names("Taken off by IMDb", "Uncredited, a cameo or archive footage on IMDb", ch.off), `took off ${plural(ch.off.length, "person", "people")}`) : "took nobody off"}${ch.films.length ? `, in ${dlink(D.films("Cast put right by IMDb", plural(ch.films.length, "film"), ch.films, { sort: "name" }), plural(ch.films.length, "film"))}` : ""}.</p>` : "";
  const start = todo.length ? row(btn(done ? `Check the other ${plural(todo.length, "film")}` : `Check ${plural(todo.length, "film")} on IMDb`),
    `Tries ${CAST_TRIAL} films first and goes on only if IMDb lets Apify in, using well under $${CAST_BUDGET.toFixed(2)} of your Apify credit for the lot (it says first if it would be more).`) : "";
  return title + what + changes + start + note;
}
</script>
