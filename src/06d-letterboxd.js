<script>
/* ---------- Letterboxd averages, through an Apify actor ----------
   Letterboxd has no public API and browsers can't read its pages from another site, so an Apify
   actor (solidcode/letterboxd-scraper) reads the member's films page in Apify's cloud and returns
   each film's Letterboxd average. It costs the viewer's Apify credit, so it only runs on a click.
   Titles and years come from Letterboxd itself, so they match the export exactly. */
const LB_ACTOR = "solidcode~letterboxd-scraper";
// Apify's price for this actor on its free plan (paid plans pay a little less): per film, plus a fee per run.
const LB_PRICE_PER_FILM = 0.0036, LB_PRICE_PER_RUN = 0.005;
const runCost = (films) => films * LB_PRICE_PER_FILM + LB_PRICE_PER_RUN;
let LBX = store.get(KEYS.lbx, {}); // film key → { r: average out of 5, n: ratings, slug, at }
const apifyKey = () => store.get(KEYS.apify, "");
const lbJob = { running: false, started: 0, note: "", err: false, badKey: false };
let editApify = false;

async function apify(path, opts = {}) {
  const res = await fetch("https://api.apify.com/v2" + path, {
    ...opts, headers: { "Content-Type": "application/json", Authorization: "Bearer " + apifyKey() },
  });
  if (res.status === 401) throw { code: "auth" };
  if (res.status === 402 || res.status === 403) throw { code: "credit", text: await res.text().catch(() => "") };
  if (!res.ok) throw { code: "http", status: res.status };
  return res.json();
}
const lbMissing = (lib) => lib.films.filter((f) => !LBX[f.key]);
const cost = (n) => n < 0.01 ? "under 1¢" : `about $${n.toFixed(2)}`;

async function startLetterboxd(lib, mode) {
  const user = lib.profile.username;
  if (!user) { Object.assign(lbJob, { note: "Your import has no Letterboxd username. Import the whole export ZIP, which includes profile.csv.", err: true }); renderLookup(); return; }
  const missing = lbMissing(lib).length;
  // "recent" reads the newest films first and stops once it has covered the missing ones
  const input = mode === "recent"
    ? { startUrls: [`https://letterboxd.com/${user}/films/by/date/`], includeReviews: false, maxResults: missing + 25 }
    : { startUrls: [`https://letterboxd.com/${user}/films/`], includeReviews: false, maxResults: 0 };
  Object.assign(lbJob, { running: true, started: Date.now(), note: "", err: false, badKey: false });
  renderLookup();
  try {
    // Apify stops a run after an hour by default; give very large libraries two
    const timeout = mode === "all" && lib.films.length > 1500 ? "?timeout=7200" : "";
    const run = await apify(`/acts/${LB_ACTOR}/runs${timeout}`, { method: "POST", body: JSON.stringify(input) });
    store.set(KEYS.lbRun, { id: run.data.id, dataset: run.data.defaultDatasetId, at: Date.now(), mode });
    await pollLetterboxd(lib);
  } catch (e) { finishLetterboxd(e); }
}

// Waits for the run, then reads its results. Also called on page load, so a run started earlier
// is picked up even if the page was closed in the meantime.
async function pollLetterboxd(lib) {
  const r = store.get(KEYS.lbRun, null);
  if (!r || !apifyKey()) return;
  Object.assign(lbJob, { running: true, started: r.at, note: "", err: false });
  renderLookup();
  try {
    for (;;) {
      const run = await apify(`/actor-runs/${r.id}`);
      const st = run.data.status;
      if (st === "SUCCEEDED") break;
      if (st === "FAILED" || st === "ABORTED" || st === "TIMED-OUT") { store.del(KEYS.lbRun); return finishLetterboxd({ code: "run", status: st }); }
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
    store.set(KEYS.lbx, LBX);
    store.del(KEYS.lbRun);
    finishLetterboxd(null, matched, r.mode);
  } catch (e) { finishLetterboxd(e); }
}
function finishLetterboxd(e, matched, mode) {
  lbJob.running = false;
  lbJob.err = !!e;
  lbJob.badKey = !!e && e.code === "auth";
  lbJob.note = !e ? `Done. Added Letterboxd averages for ${plural(matched, "film")}.${mode === "recent" && lbMissing(state.lib || MY_LIB).length ? " Some films are still missing; refresh all to catch them." : ""}`
    : e.code === "auth" ? "Apify didn't accept that token. Copy it again from Apify Console → Settings → API & Integrations."
    : e.code === "credit" ? "Apify refused the run, usually because the account is out of credit or the actor needs to be added to your account first. Open the actor's page on Apify, then try again."
    : e.code === "run" ? `The Apify run ended with "${e.status}". Open Apify Console → Runs to see why, then try again.`
    : e instanceof TypeError ? "Couldn't reach Apify. Check your connection; a run already started is picked up next time you open the page."
    : "Something went wrong talking to Apify. Try again in a minute.";
  scheduleRender();
}

// The Letterboxd part of the Cast & crew box, for both layouts.
function letterboxdBlock(lib, phone) {
  if (IN_VIEWER || !lib) return "";
  const title = phone ? `<p class="title" style="margin-top:6px">Letterboxd averages</p>` : `<h3 class="sub-h">Letterboxd averages</h3>`;
  const btn = (act, label, primary) => phone ? `<button class="btn ${primary ? "green " : ""}block" type="button" data-lb="${act}">${label}</button>` : `<button class="btn${primary ? " primary" : ""}" type="button" data-lb="${act}">${label}</button>`;
  const link = (act, label) => `<button class="linkish" type="button" data-lb="${act}">${label}</button>`;
  const note = lbJob.note ? `<p class="status${lbJob.err ? " err" : ""}" role="status">${esc(lbJob.note)}</p>` : "";
  if (lbJob.running) return title + `<p class="status" id="lb-progress" role="status">${lbProgressText()}</p>`;
  if (!apifyKey() || editApify || lbJob.badKey) {
    const input = `<label class="sr-only" for="apify-key">Apify API token</label><input ${phone ? 'class="key" ' : ""}id="apify-key" type="password" autocomplete="off" spellcheck="false" placeholder="Apify API token (optional)" value="${esc(apifyKey())}">`;
    return title + (phone ? input + btn("save", "Save token") : `<div class="lookup-row">${input}${btn("save", "Save token")}</div>`) +
      `<p class="status">Compares your ratings with Letterboxd's own averages. An <a href="https://apify.com/solidcode/letterboxd-scraper" target="_blank" rel="noopener">Apify actor</a> reads your films page for you,
      billed to your Apify account at about $3.60 per 1,000 films on Apify's free plan, which includes $5 of credit a month. Your token is under Apify Console → Settings → API &amp; Integrations, and is kept in this browser only.</p>` + note;
  }
  const total = lib.films.length, missing = lbMissing(lib).length, have = total - missing;
  const all = cost(runCost(total));
  let body;
  if (!have) body = (phone ? "" : `<div class="lookup-row">`) + btn("all", `Get Letterboxd averages for ${plural(total, "film")}`, true) + (phone ? "" : `<span class="status">Costs ${all}, billed by Apify.</span></div>`) + (phone ? `<p class="status">Costs ${all}, billed by Apify.</p>` : "");
  else if (missing) body = `<p class="status">${fmtN(have)} of ${plural(total, "film")} have Letterboxd averages.</p>` +
    (phone ? "" : `<div class="lookup-row">`) + btn(missing <= 200 ? "recent" : "all", `Get the ${plural(missing, "missing film")}`, true) +
    (phone ? `<p class="status">Costs ${cost(runCost(missing <= 200 ? missing + 25 : total))}. ${link("all", `Refresh all (${all})`)}</p>` : `<span class="status">${cost(runCost(missing <= 200 ? missing + 25 : total))} · ${link("all", `Refresh all (${all})`)}</span></div>`);
  else body = `<p class="status">Every film has a Letterboxd average. ${link("all", `Refresh all (${all})`)}</p>`;
  return title + body + `<p class="status">${link("change", "Change Apify token")}</p>` + note;
}
function lbProgressText() {
  const mins = Math.max(0, Math.round((Date.now() - lbJob.started) / 60000));
  return `Apify is reading your Letterboxd films (started ${mins ? `${mins} min ago` : "just now"}). Big libraries take several minutes; you can close this page and the results are picked up when you come back.`;
}
function lbAction(act, lib) {
  if (act === "save") {
    const key = ($("#apify-key")?.value || "").trim();
    if (!key) { Object.assign(lbJob, { note: "Paste your Apify token first.", err: true }); renderLookup(); return; }
    store.set(KEYS.apify, key); editApify = false; lbJob.badKey = false; lbJob.note = ""; renderLookup();
  } else if (act === "change") { editApify = true; renderLookup(); $("#apify-key")?.focus(); }
  else if (act === "all" || act === "recent") startLetterboxd(lib, act);
}
</script>
