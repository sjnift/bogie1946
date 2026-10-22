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
// film key → { r: average out of 5, n: ratings, slug, at } once found, or { tries } while not yet found
let LBX = store.get(KEYS.lbx, {});
const apifyKey = () => store.get(KEYS.apify, "");
const lbJob = { running: false, started: 0, note: "", err: false, badKey: false };
let editApify = false;

async function apify(path, opts = {}) {
  const res = await fetch("https://api.apify.com/v2" + path, {
    ...opts, headers: { "Content-Type": "application/json", Authorization: "Bearer " + apifyKey() },
  });
  if (res.status === 401) throw { code: "auth" };
  if (res.status === 402 || res.status === 403) throw { code: "credit" };
  if (!res.ok) throw { code: "http", status: res.status };
  return res.json();
}
const lbFound = (f) => LBX[f.key] && LBX[f.key].r;
// A film looked for by address and not found is left alone. Tries from before both addresses were asked for at once don't count.
const lbTries = (f) => { const x = LBX[f.key]; return x && x.v === 2 ? x.tries || 0 : 0; };
const lbMissing = (lib) => lib.films.filter((f) => !lbFound(f) && lbTries(f) < 1);
const lbNotFound = (lib) => lib.films.filter((f) => !lbFound(f) && lbTries(f) >= 1);
// Letterboxd's address for a film: its title in lowercase with hyphens, accents and most punctuation dropped
const LB_LETTERS = { "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i" };
const lbSlug = (name) => String(name).toLowerCase().replace(/½/g, " half ").replace(/[øæœßłđðþı]/g, (c) => LB_LETTERS[c])
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’*.]/g, "").replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Both addresses a film can have: the plain one, and the one with its year that Letterboxd gives a title shared by
// several films. Asking for both in one run costs nothing extra for the one that doesn't exist.
const lbUrls = (f) => { const s = lbSlug(f.name); return s ? [s, ...(f.year ? [`${s}-${f.year}`] : [])] : []; };
const LB_SPARE = 1.15; // a plain address can lead to another film of the same name, which Apify still charges for

async function startLetterboxd(lib, mode) {
  const user = lib.profile.username;
  let input, keys = [], slugs = {};
  if (mode === "all") {
    if (!user) { Object.assign(lbJob, { note: "Your import has no Letterboxd username. Import the whole export ZIP, which includes profile.csv.", err: true }); renderLookup(); return; }
    input = { startUrls: [`https://letterboxd.com/${user}/films/`], includeReviews: false, maxResults: Math.min(lib.films.length + 20, LB_RUN_CAP) };
  } else {
    const films = lbMissing(lib).slice(0, Math.floor(LB_RUN_CAP / LB_SPARE));
    keys = films.map((f) => f.key);
    for (const f of films) for (const s of lbUrls(f)) slugs[s] = f.key;
    input = { startUrls: Object.keys(slugs).map((s) => `https://letterboxd.com/film/${s}/`), includeReviews: false, maxResults: Math.min(LB_RUN_CAP, Math.ceil(films.length * LB_SPARE) + 5) };
  }
  Object.assign(lbJob, { running: true, started: Date.now(), note: "", err: false, badKey: false });
  renderLookup();
  try {
    const run = await apify(`/acts/${LB_ACTOR}/runs`, { method: "POST", body: JSON.stringify(input) });
    store.set(KEYS.lbRun, { id: run.data.id, dataset: run.data.defaultDatasetId, at: Date.now(), mode, keys, slugs, asked: input.maxResults });
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
    for (let offset = 0; ; offset += 1000) {
      const page = await apify(`/datasets/${r.dataset}/items?clean=true&offset=${offset}&limit=1000&fields=recordType,title,year,filmSlug,averageRating,ratingsCount`);
      items.push(...page);
      if (page.length < 1000) break;
    }
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
    const hit = new Set();
    for (const it of items) {
      if (it.recordType && it.recordType !== "film") continue;
      films++;
      const f = match(it);
      if (!f) { stray++; continue; }
      if (!(Number(it.averageRating) > 0)) continue;
      if (!lbFound(f)) matched++;
      hit.add(f.key);
      LBX[f.key] = { r: Number(it.averageRating), n: Number(it.ratingsCount) || 0, slug: it.filmSlug || null, at: today };
    }
    // a film asked for by both its addresses that didn't come back isn't on Letterboxd under its title
    if (status === "SUCCEEDED") for (const k of r.keys || []) if (!(LBX[k] && LBX[k].r)) LBX[k] = { tries: 1, v: 2 };
    lbJob.stats = { updated: hit.size - matched, stray: r.mode === "all" ? stray : 0, capped: r.mode === "all" && films >= (r.asked || Infinity) };
    store.set(KEYS.lbx, LBX);
    store.del(KEYS.lbRun);
    finishLetterboxd(status === "SUCCEEDED" ? null : { code: "stopped" }, matched);
  } catch (e) { finishLetterboxd(e); }
}
function finishLetterboxd(e, matched = 0) {
  lbJob.running = false;
  lbJob.err = !!e && e.code !== "stopped";
  lbJob.badKey = !!e && e.code === "auth";
  const left = lbMissing(state.lib || MY_LIB).length, st = lbJob.stats || {};
  const rest = left ? ` ${plural(left, "film is", "films are")} still missing${st.capped ? `, because one run stops at ${fmtN(LB_RUN_CAP)} films to stay inside the free credit` : ""}; get ${left === 1 ? "it" : "them"} with the button above, next month if this month's free credit is used up.` : "";
  const got = `${st.updated ? ` Updated ${plural(st.updated, "film")} already there.` : ""}${st.stray ? ` ${plural(st.stray, "film")} from your Letterboxd profile didn't match a film in this import, so ${st.stray === 1 ? "it was" : "they were"} left out.` : ""}`;
  lbJob.note = !e ? `Done.${matched || !st.updated ? ` Added Letterboxd averages for ${plural(matched, "film")}.` : ""}${got}${rest}`
    : e.code === "stopped" ? `Apify stopped the run early, usually because this month's free credit ran out. Kept the ${plural(matched, "film")} it finished.${rest}`
    : e.code === "auth" ? "Apify didn't accept that token. Copy it again from Apify Console → Settings → API & Integrations."
    : e.code === "credit" ? "Apify wouldn't start the run. On the free plan that means this month's $5 of credit is used up; it comes back at the start of next month."
    : e instanceof TypeError ? "Couldn't reach Apify. Check your connection; a run already started is picked up next time you open the page."
    : "Something went wrong talking to Apify. Try again in a minute.";
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
    const input = `<label class="sr-only" for="apify-key">Apify API token</label><input ${phone ? 'class="key" ' : ""}id="apify-key" type="password" autocomplete="off" spellcheck="false" placeholder="Apify API token (optional)" value="${esc(apifyKey())}">`;
    const save = phone ? `<button class="btn block" type="button" data-lb="save">Save token</button>` : `<button class="btn" type="button" data-lb="save">Save token</button>`;
    return title + (phone ? input + save : `<div class="lookup-row">${input}${save}</div>`) +
      `<p class="status">Compares your ratings with Letterboxd's own averages. An <a href="https://apify.com/solidcode/letterboxd-scraper" target="_blank" rel="noopener">Apify actor</a> reads Letterboxd for you.
      ${free} Make a free account at <a href="https://console.apify.com/sign-up" target="_blank" rel="noopener">apify.com</a>; your token is under Settings → API &amp; Integrations, and stays in this browser.</p>` + note;
  }
  const total = lib.films.length, missing = lbMissing(lib), found = lib.films.filter(lbFound).length, gone = lbNotFound(lib).length;
  let body;
  if (!found && !gone) {
    const n = Math.min(total, LB_RUN_CAP);
    body = row(btn("all", total > LB_RUN_CAP ? `Get averages for the first ${fmtN(n)} of ${plural(total, "film")}` : `Get Letterboxd averages for ${plural(total, "film")}`),
      `Uses ${cost(runCost(n))} of Apify credit.${total > LB_RUN_CAP ? " The rest come next month, inside the free credit." : ""}`);
  } else if (missing.length) {
    const n = Math.min(missing.length, Math.floor(LB_RUN_CAP / LB_SPARE));
    body = `<p class="status">${fmtN(found)} of ${plural(total, "film")} have Letterboxd averages; ${dlink(D.films("Missing Letterboxd averages", plural(missing.length, "film"), missing, { sort: "name" }), `${fmtN(missing.length)} don't yet`)}.</p>` +
      row(btn("missing", `Get ${n < missing.length ? `${fmtN(n)} of the ` : "the "}${plural(missing.length, "missing film")}`), `Uses up to ${cost(runCost(Math.ceil(n * LB_SPARE)))} of Apify credit. Each film is looked up by its Letterboxd address, with and without its year.`);
  } else body = `<p class="status">${fmtN(found)} of ${plural(total, "film")} have Letterboxd averages. ${link("all", `Refresh them (${cost(runCost(Math.min(total, LB_RUN_CAP)))})`)}</p>`;
  const goneList = gone && D.films("Not found on Letterboxd", "Not found at either of the addresses their titles give", lbNotFound(lib), { sort: "name" });
  const goneNote = gone ? `<p class="status">${dlink(goneList, plural(gone, "film"))} couldn't be found on Letterboxd by title, so ${gone === 1 ? "it's" : "they're"} left out of Letterboxd comparisons.</p>` : "";
  return title + body + goneNote + `<p class="status">${free} ${link("change", "Change Apify token")}</p>` + note;
}
function lbProgressText() {
  const mins = Math.max(0, Math.round((Date.now() - lbJob.started) / 60000));
  return `Apify is reading Letterboxd for you (started ${mins ? `${mins} min ago` : "just now"}). Big libraries take several minutes; you can close this page and the results are picked up when you come back.`;
}
function lbAction(act, lib) {
  if (act === "save") {
    const key = ($("#apify-key")?.value || "").trim();
    if (!key) { Object.assign(lbJob, { note: "Paste your Apify token first.", err: true }); renderLookup(); return; }
    store.set(KEYS.apify, key); editApify = false; lbJob.badKey = false; lbJob.note = ""; renderLookup();
  } else if (act === "change") { editApify = true; renderLookup(); $("#apify-key")?.focus(); }
  else if (act === "all" || act === "missing") startLetterboxd(lib, act);
}
</script>
