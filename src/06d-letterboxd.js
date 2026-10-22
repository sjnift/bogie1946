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
const lbMissing = (lib) => lib.films.filter((f) => !lbFound(f) && ((LBX[f.key] || {}).tries || 0) < 2);
const lbNotFound = (lib) => lib.films.filter((f) => !lbFound(f) && ((LBX[f.key] || {}).tries || 0) >= 2);
// Letterboxd's address for a film: its title in lowercase with hyphens, then with the year if the plain one was taken
const lbSlug = (name) => String(name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/['’]/g, "").replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function startLetterboxd(lib, mode) {
  const user = lib.profile.username;
  let input, keys = [];
  if (mode === "all") {
    if (!user) { Object.assign(lbJob, { note: "Your import has no Letterboxd username. Import the whole export ZIP, which includes profile.csv.", err: true }); renderLookup(); return; }
    input = { startUrls: [`https://letterboxd.com/${user}/films/`], includeReviews: false, maxResults: Math.min(lib.films.length + 20, LB_RUN_CAP) };
  } else {
    const films = lbMissing(lib).slice(0, LB_RUN_CAP);
    keys = films.map((f) => f.key);
    const urls = films.map((f) => `https://letterboxd.com/film/${lbSlug(f.name)}${(LBX[f.key] || {}).tries && f.year ? `-${f.year}` : ""}/`);
    input = { startUrls: urls, includeReviews: false, maxResults: urls.length };
  }
  Object.assign(lbJob, { running: true, started: Date.now(), note: "", err: false, badKey: false });
  renderLookup();
  try {
    const run = await apify(`/acts/${LB_ACTOR}/runs`, { method: "POST", body: JSON.stringify(input) });
    store.set(KEYS.lbRun, { id: run.data.id, dataset: run.data.defaultDatasetId, at: Date.now(), mode, keys });
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
    const byTitle = new Map(lib.films.map((f) => [`${personKey(f.name)}|${f.year || ""}`, f]));
    const today = new Date().toISOString().slice(0, 10);
    let matched = 0;
    for (const it of items) {
      if (it.recordType && it.recordType !== "film") continue;
      const f = byTitle.get(`${personKey(it.title || "")}|${it.year || ""}`);
      if (!f || !(Number(it.averageRating) > 0)) continue;
      LBX[f.key] = { r: Number(it.averageRating), n: Number(it.ratingsCount) || 0, slug: it.filmSlug || null, at: today };
      matched++;
    }
    // a film asked for by address that didn't come back gets its year added next time, then is left alone
    if (status === "SUCCEEDED") for (const k of r.keys || []) if (!(LBX[k] && LBX[k].r)) LBX[k] = { tries: ((LBX[k] || {}).tries || 0) + 1 };
    store.set(KEYS.lbx, LBX);
    store.del(KEYS.lbRun);
    finishLetterboxd(status === "SUCCEEDED" ? null : { code: "stopped" }, matched);
  } catch (e) { finishLetterboxd(e); }
}
function finishLetterboxd(e, matched = 0) {
  lbJob.running = false;
  lbJob.err = !!e && e.code !== "stopped";
  lbJob.badKey = !!e && e.code === "auth";
  const left = lbMissing(state.lib || MY_LIB).length;
  const rest = left ? ` ${plural(left, "film is", "films are")} still missing; get ${left === 1 ? "it" : "them"} with the button above, next month if this month's free credit is used up.` : "";
  lbJob.note = !e ? `Done. Added Letterboxd averages for ${plural(matched, "film")}.${rest}`
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
    const n = Math.min(missing.length, LB_RUN_CAP);
    body = `<p class="status">${fmtN(found)} of ${plural(total, "film")} have Letterboxd averages.</p>` +
      row(btn("missing", `Get ${n < missing.length ? `${fmtN(n)} of the ` : "the "}${plural(missing.length, "missing film")}`), `Uses ${cost(runCost(n))} of Apify credit.`);
  } else body = `<p class="status">${fmtN(found)} of ${plural(total, "film")} have Letterboxd averages. ${link("all", `Refresh them (${cost(runCost(Math.min(total, LB_RUN_CAP)))})`)}</p>`;
  const goneNote = gone ? `<p class="status">${plural(gone, "film")} couldn't be found on Letterboxd by name, so ${gone === 1 ? "it's" : "they're"} left out of Letterboxd comparisons.</p>` : "";
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
