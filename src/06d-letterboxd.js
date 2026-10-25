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
// film key → { r: average out of 5, n: ratings, slug, at } once found; { tries: 1, v: 2 } when not found by title; and
// { tries: 1, v: 2, few: true, slug } when the film is on Letterboxd but has too few ratings there for an average
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
// A film looked for by address and not found is left alone (until "Look for them again"). Tries from before both
// addresses were asked for don't count.
const lbTries = (f) => { const x = LBX[f.key]; return x && x.v === 2 ? x.tries || 0 : 0; };
const lbFew = (f) => !lbFound(f) && !!(LBX[f.key] && LBX[f.key].few);
const lbMissing = (lib) => lib.films.filter((f) => !lbFound(f) && lbTries(f) < 1);
const lbNotFound = (lib) => lib.films.filter((f) => !lbFound(f) && lbTries(f) >= 1 && !lbFew(f));
const lbTooFew = (lib) => lib.films.filter(lbFew);
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
  const films = (mode === "retry" ? lbNotFound(lib) : lbMissing(lib)).slice(0, Math.floor(LB_RUN_CAP / LB_SPARE) - 5);
  return lbAddressRun(lib, films, "year", { mode, matched: 0 });
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
    const run = await apify(`/acts/${LB_ACTOR}/runs`, { method: "POST", body: JSON.stringify(input) });
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
    // a film asked for at both its addresses that didn't come back isn't on Letterboxd under its title; unless the run
    // stopped at its cap first, when those it didn't reach stay missing and are asked for next time
    else if (r.phase !== "profile" && r.mode !== "all" && status === "SUCCEEDED" && !capped) for (const k of left) LBX[k] = { tries: 1, v: 2 };
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
function finishLetterboxd(e, matched = 0) {
  lbJob.running = false;
  lbJob.err = !!e && e.code !== "stopped";
  lbJob.badKey = !!e && e.code === "auth";
  const left = lbMissing(state.lib || MY_LIB).length, st = lbJob.stats || {};
  const rest = left ? ` ${plural(left, "film is", "films are")} still missing${st.capped === "profile" ? `, because one run stops at ${fmtN(LB_RUN_CAP)} films to stay inside the free credit` : ""}; get ${left === 1 ? "it" : "them"} with the button above, next month if this month's free credit is used up.` : "";
  const got = `${st.updated ? ` Updated ${plural(st.updated, "film")} already there.` : ""}${st.stray ? ` ${plural(st.stray, "film")} from your Letterboxd profile didn't match a film in this import, so ${st.stray === 1 ? "it was" : "they were"} left out.` : ""}`;
  lbJob.note = !e ? `Done.${matched || !st.updated ? ` Added Letterboxd averages for ${plural(matched, "film")}.` : ""}${got}${rest}`
    : e.code === "stopped" ? `Apify stopped the run early, usually because this month's free credit ran out. Kept the ${plural(matched, "film")} it finished.${rest}`
    : e.code === "auth" ? "Apify didn't accept that token. Copy it again from Apify Console → Settings → API & Integrations."
    : e.code === "credit" ? "Apify wouldn't start the run. On the free plan that means this month's $5 of credit is used up; it comes back at the start of next month."
    : e instanceof TypeError ? "Couldn't reach Apify. Check your connection; a run already started is picked up next time you open the page."
    : e.code === "gone" ? "A run started with your previous Apify token can't be read with this one, so it was set aside. Start a new one with the button above."
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
      ${free} Make a free account at <a href="https://console.apify.com/sign-up" target="_blank" rel="noopener">apify.com</a>; your token is under Settings → API &amp; Integrations. It's saved in this browser (and in your locked diary on this site, if it's there).</p>` + note;
  }
  const total = lib.films.length, missing = lbMissing(lib), found = lib.films.filter(lbFound).length, gone = lbNotFound(lib).length, few = lbTooFew(lib);
  const askCost = (n) => cost(n * LB_PRICE_PER_FILM * LB_SPARE + 2 * LB_PRICE_PER_RUN);
  let body;
  if (!found && !gone) {
    const n = Math.min(total, LB_RUN_CAP);
    body = row(btn("all", total > LB_RUN_CAP ? `Get averages for the first ${fmtN(n)} of ${plural(total, "film")}` : `Get Letterboxd averages for ${plural(total, "film")}`),
      `Uses ${cost(runCost(n))} of Apify credit.${total > LB_RUN_CAP ? " The rest come next month, inside the free credit." : ""}`);
  } else if (missing.length) {
    const n = Math.min(missing.length, Math.floor(LB_RUN_CAP / LB_SPARE) - 5);
    body = `<p class="status">${fmtN(found)} of ${plural(total, "film")} have Letterboxd averages; ${dlink(D.films("Missing Letterboxd averages", plural(missing.length, "film"), missing, { sort: "name" }), `${fmtN(missing.length)} don't yet`)}.</p>` +
      row(btn("missing", `Get ${n < missing.length ? `${fmtN(n)} of the ` : "the "}${plural(missing.length, "missing film")}`), `Uses about ${askCost(n)} of Apify credit. Each film is looked up by its Letterboxd address, with its year first, then without.`);
  } else body = `<p class="status">${fmtN(found)} of ${plural(total, "film")} have Letterboxd averages. ${link("all", `Refresh them (${cost(runCost(Math.min(total, LB_RUN_CAP)))})`)}</p>`;
  const goneList = gone && D.films("Not found on Letterboxd", "Not found at either of the addresses their titles give", lbNotFound(lib), { sort: "name" });
  const goneNote = gone ? `<p class="status">${dlink(goneList, plural(gone, "film"))} couldn't be found on Letterboxd by title, so ${gone === 1 ? "it's" : "they're"} left out of Letterboxd comparisons.
    ${missing.length ? "" : link("retry", `Look for ${gone === 1 ? "it" : "them"} again (${askCost(Math.min(gone, LB_RUN_CAP))})`)}</p>` : "";
  const fewNote = few.length ? `<p class="status">${dlink(D.films("Too few ratings on Letterboxd", "On Letterboxd, but with too few ratings there for an average", few, { sort: "name" }), plural(few.length, "film"))}
    ${few.length === 1 ? "is" : "are"} on Letterboxd but ${few.length === 1 ? "has" : "have"} too few ratings there for an average.</p>` : "";
  return title + body + goneNote + fewNote + `<p class="status">${free} ${link("change", "Change Apify token")}</p>` + note;
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
  else if (act === "all" || act === "missing" || act === "retry") startLetterboxd(lib, act);
}
</script>
