// The pictures to share (a year, all time, a taste match; feed post or story), the year as a story, On this day,
// Watch next, and the site still installing as an app.
import { open, assert, noErrors } from "./lib.mjs";

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    const panel = phone ? "#sheet" : "#dlg";
    const imgSize = async (want, what) => {
      await p.waitForFunction((want) => { const i = document.querySelector(".share-img"); return i && i.complete && `${i.naturalWidth}x${i.naturalHeight}` === want; }, want, { timeout: 15000 }).catch(() => {});
      const size = await p.$eval(".share-img", (img) => [img.naturalWidth, img.naturalHeight].join("x"));
      assert(size === want, `${file} ${what}: image ${size}`);
    };
    const close = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(150); };
    await p.goto(`${base}${file}?example#/insights/2025`); await p.waitForFunction(() => typeof state === "object" && state.lib);
    await p.click(phone ? 'button:has-text("Share 2025 as an image")' : '#y-glance .dlink:has-text("share it as a picture")');
    await p.waitForSelector(".share-img", { timeout: 15000 });
    await imgSize("1080x1350", "2025 feed post");
    await p.click('[data-sharesize="story"]');
    await imgSize("1080x1920", "2025 story");
    await p.click('[data-sharesize="feed"]');
    await close();
    // the year as a story: every card, in turn, and the findings filled in
    await p.click(phone ? 'button:has-text("Play 2025 as a story")' : '#y-glance .dlink:has-text("Play it as a story")');
    await p.waitForSelector(`${panel} .story`);
    const cards = await p.$$eval(`${panel} .st-card`, (x) => x.length);
    for (let i = 1; i < cards; i++) await p.click(`${panel} [data-story-step="1"]`);
    const end = await p.evaluate((panel) => ({ on: [...document.querySelectorAll(`${panel} .st-card`)].findIndex((c) => c.classList.contains("on")), find: document.querySelector(`${panel} [data-storyfind]`).textContent }), panel);
    assert(cards >= 5 && end.on === cards - 1 && !/Working it out/.test(end.find), `${file} story: ${cards} cards, ended on ${end.on}, findings "${end.find.slice(0, 80)}"`);
    await close();
    // all time, from the main page
    await p.goto(`${base}${file}?example#/${phone ? "profile" : ""}`); await p.waitForFunction(() => typeof state === "object" && state.lib);
    await p.evaluate((phone) => phone ? openSheet(D.share("all")) : openDrill(D.share("all")), phone);
    await imgSize("1080x1350", "all time");
    await close();
    // a taste match with an example friend
    await p.evaluate((phone) => { const f = EXAMPLE_FRIENDS[0]; return phone ? openSheet(D.shareMatch(f.id, f.name)) : openDrill(D.shareMatch(f.id, f.name)); }, phone);
    await imgSize("1080x1350", "taste match");
    await close();
    // the world map (computer: under Genre & origin; phone: Stats › Breakdown): the country with the most films is the
    // deepest shade, tells its numbers on hover and opens its films; the key opens the countries of each shade
    await p.goto(`${base}${file}?example#/${phone ? "genres" : ""}`); await p.waitForFunction(() => typeof state === "object" && state.lib);
    await p.waitForSelector(".wsvg");
    const map = await p.evaluate(() => {
      const W = worldData(computeStats(state.lib, metaOf, state.scope).countries), top = W.places[0], el = document.querySelector(`.wsvg [aria-label^="${top.name}:"]`);
      el.scrollIntoView({ block: "center" });
      const b = el.getBBox(), M = el.getScreenCTM();
      let at = null;
      for (let i = 1; i < 16 && !at; i++) for (let j = 1; j < 16 && !at; j++) {
        const pt = new DOMPoint(b.x + b.width * i / 16, b.y + b.height * j / 16);
        if (el.isPointInFill(pt)) { const s = pt.matrixTransform(M); if (document.elementFromPoint(s.x, s.y) === el) at = { x: s.x, y: s.y }; }
      }
      return { name: top.name, count: top.count, cls: el.getAttribute("class"), places: W.places.length, lit: document.querySelectorAll(".wsvg [data-list]").length, at };
    });
    await p.waitForTimeout(200); // the scroll to it hides any tip, so hover once it has settled
    assert(map.at && map.cls.includes("l5") && map.lit === map.places, `${file} world map: ${JSON.stringify(map)}`);
    if (!phone) {
      await p.mouse.move(map.at.x, map.at.y); await p.waitForTimeout(80);
      const tip = await p.$eval("#tip", (t) => [t.hidden, t.querySelector("b") && t.querySelector("b").textContent, t.textContent]);
      assert(!tip[0] && tip[1] === map.name && tip[2].includes(`${map.count} film`), `${file} world map hover: ${JSON.stringify(tip)}`);
      await p.mouse.click(map.at.x, map.at.y);
    } else await p.touchscreen.tap(map.at.x, map.at.y);
    await p.waitForTimeout(250);
    const opened = await p.evaluate((panel) => { const d = document.querySelector(panel); return d && d.open ? d.querySelector("h2, h3").textContent : null; }, panel);
    assert(opened === map.name, `${file} world map click opened ${opened}, not ${map.name}`);
    await close();
    await p.click(".wkey button.wk"); await p.waitForTimeout(200);
    const keyed = await p.evaluate((panel) => { const d = document.querySelector(panel); return d && d.open ? d.querySelector("h2, h3").textContent : null; }, panel);
    assert(/^Countries with /.test(keyed || ""), `${file} world map key opened ${keyed}`);
    await close();
    // the phone's Stats › Years: each year's average rating, the highest in gold and the lowest in purple
    if (phone) {
      await p.evaluate(() => { state.scope = "all"; goTo("profile", { force: true, top: true }); }); await p.waitForTimeout(200);
      const dec = await p.evaluate(() => ({ want: Math.min(2, rankedDecades(computeStats(state.lib, metaOf, "all")).length - 1),
        runs: [...document.querySelectorAll(".decade-run")].map((c) => [c.querySelector(".dr-dec").textContent, c.querySelectorAll(".pitem").length]),
        sizes: [".decade-hero .pitem", ".decade-run .pitem"].map((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().width)) }));
      assert(dec.want === 2 && dec.runs.length === 2 && dec.runs.every(([t, n]) => /^The \d{4}s$/.test(t) && n >= 3) && dec.sizes[1] < dec.sizes[0], `phone second and third best decades: ${JSON.stringify(dec)}`);
      await p.click('[data-bestby="year"]'); await p.waitForTimeout(200);
      const yrs = await p.evaluate(() => ({ want: favourites(computeStats(state.lib, metaOf, "all"), "year").items.slice(0, 3).map((x) => x.name).join(),
        got: [...document.querySelectorAll(".decade-hero .dh-dec, .decade-run .dr-dec")].map((e) => e.textContent).join(), k: document.querySelector(".decade-hero .dh-k").textContent }));
      assert(yrs.got === yrs.want && /^\d{4},\d{4},\d{4}$/.test(yrs.got) && /year/.test(yrs.k), `phone favourite years: ${JSON.stringify(yrs)}`);
      await p.click('[data-bestby="decade"]'); await p.waitForTimeout(200);
      await p.evaluate(() => { state.scope = "all"; goTo("years", { force: true, top: true }); }); await p.waitForTimeout(200);
      const ph = await p.evaluate(() => {
        const cells = [...document.querySelectorAll(".yrow")].filter((r) => /^\d{4}$/.test(r.querySelector(".y").textContent.trim()))
          .map((r) => [...r.querySelectorAll(".c")].find((c) => c.querySelector("small").textContent === "average")).filter((c) => c && /\d/.test(c.textContent));
        const v = (c) => parseFloat(c.querySelector("b").textContent), vals = cells.map(v), once = (x) => vals.filter((y) => y === x).length === 1;
        return { n: cells.length, hi: cells.filter((c) => c.classList.contains("hi")).map(v), lo: cells.filter((c) => c.classList.contains("lo")).map(v), max: Math.max(...vals), min: Math.min(...vals),
          maxOnce: once(Math.max(...vals)), minOnce: once(Math.min(...vals)) };
      });
      const just = (got, want, once) => once ? got.length === 1 && got[0] === want : got.length === 0;
      assert(ph.n >= 3 && just(ph.hi, ph.max, ph.maxOnce) && just(ph.lo, ph.min, ph.minOnce), `phone years, gold and purple: ${JSON.stringify(ph)}`);
    }
    noErrors(p, file);
  }
  // phone pictures: a poster that has loaded fades in (it once stayed invisible: the page listened for "load" on the
  // window, which a picture's load never reaches), and a TMDB that never answers is caught by the check at start
  {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    for (const tmdb of ["answers", "hangs"]) {
      const p = await open(browser, base, "mobile.html", { phone: true });
      await p.context().route(/image\.tmdb\.org/, (r) => tmdb === "answers" ? r.fulfill({ contentType: "image/png", body: png }) : null);
      await p.context().route(/wsrv\.nl/, (r) => r.fulfill({ contentType: "image/png", body: png }));
      await p.evaluate(() => { for (const f of state.lib.films.slice(0, 12)) EXAMPLE_META[f.key] = { ...EXAMPLE_META[f.key], poster: `/x${f.key.length}.png` };
        META["probe|0"] = { poster: "/probe.png" }; IMG_STATE = ""; imgProbe(); DATA_REV++; goTo("profile", { force: true, top: true }); });
      await p.waitForFunction(() => IMG_STATE && IMG_STATE !== "checking", null, { timeout: 12000 }).catch(() => {});
      await p.waitForTimeout(600);
      const pic = await p.evaluate(() => { const shown = [...document.querySelectorAll(".poster img.fade")].filter((i) => i.complete && i.naturalWidth > 0);
        return { state: IMG_STATE, via: IMG_VIA, loaded: shown.length, visible: shown.filter((i) => i.classList.contains("in") && getComputedStyle(i).opacity === "1").length,
          relay: shown.filter((i) => i.src.startsWith("https://wsrv.nl/")).length }; });
      const want = tmdb === "answers" ? "tmdb" : "relay";
      assert(pic.state === want && pic.via === want && pic.loaded >= 3 && pic.visible === pic.loaded && (want === "tmdb" ? !pic.relay : pic.relay === pic.loaded),
        `phone pictures when TMDB ${tmdb}: ${JSON.stringify(pic)}`);
      const line = await p.evaluate(() => picturesBlock(true)); // Settings (the example shows its own box there instead)
      assert(want === "tmdb" ? /straight from TMDB/.test(line) : /wsrv\.nl/.test(line), `phone Settings says how pictures come: "${line}"`);
      noErrors(p, `phone pictures (TMDB ${tmdb})`);
      await p.close();
    }
  }
  const d = await open(browser, base, "desktop.html", { worker: true });
  const otd = await d.evaluate(() => { const T = onThisDay(state.lib, new Date(2026, 4, 3)); return T.entries.length && T.entries.every((e) => Math.abs(dayIndex(`2026${e.date.slice(4)}`) - dayIndex("2026-05-03")) <= 3); });
  assert(otd, "On this day picked the wrong dates");
  // Recently watched on the computer's main page: the eight latest entries, newest first; a year shows its last ones
  const recent = async () => d.evaluate(() => ({ title: $("#recent-h").textContent, dates: [...document.querySelectorAll("#recent .poster .d")].map((x) => x.textContent),
    want: state.lib.entries.filter((e) => state.scope === "all" || e.date.startsWith(state.scope)).slice(-8).reverse().map((e) => fmtDate(e.date)) }));
  let r = await recent();
  assert(r.title === "Recently watched" && r.dates.length === 8 && r.dates.join() === r.want.join(), `recently watched: ${JSON.stringify(r)}`);
  await d.click('[data-scope="2024"]'); await d.waitForTimeout(150);
  r = await recent();
  assert(r.title === "Last watched in 2024" && r.dates.join() === r.want.join() && r.dates.every((x) => x.endsWith("2024")), `last watched in 2024: ${JSON.stringify(r)}`);
  await d.click('[data-scope="all"]'); await d.waitForTimeout(150);
  // the main page (owner, Oct 2026): the best decade in full near the top, highest and lowest rated down in Ratings,
  // every chapter in full sections, trimmed: a row of posters each in Ratings, one calendar in Logged, one row of charts
  // in Year by year, and the countries on the map rather than in Genre & origin
  const lay = await d.evaluate(() => { const ids = [...document.querySelectorAll("#sections .ch-mark, #sections section")].map((e) => e.id);
    const full = (ch) => { const out = []; let m = document.getElementById(ch).nextElementSibling;
      while (m && !m.classList.contains("ch-mark")) { out.push(m.classList.contains("credit") ? m.id : `!${m.className}`); m = m.nextElementSibling; } return out; };
    const rows = (sel) => [...document.querySelectorAll(`${sel} .posters.one-row`)].map((r) => r.children.length);
    return { ids, cards: document.querySelectorAll("#sections .dc, #sections .dash").length,
      films: full("ch-films"), people: full("ch-people"), origin: full("ch-origin"), when: full("ch-when"), ratings: full("ch-ratings"), reviews: full("ch-reviews"), next: full("ch-next"),
      crowdRows: rows("#crowd"), topRows: rows("#top"), seeAll: document.querySelectorAll("#top .row-h .dlink").length,
      calendar: /Last 12 months/.test($("#logged").textContent), charts: document.querySelectorAll("#years .mult").length, rewatchCol: /Rewatches/.test($("#years thead").textContent),
      mapTops: [...document.querySelectorAll("#world .wtops .k")].map((k) => k.textContent),
      crew: [...document.querySelectorAll("#crew .crew-grid > div")].map((c) => [c.querySelector("h3 span").textContent, c.querySelectorAll(".rank-row").length]),
      faces: document.querySelectorAll("#starring .person").length, cats: document.querySelectorAll("#origin .cat-grid h3").length,
      // the best decade, then the second and third with their posters, smaller
      decades: bestDecades(computeStats(state.lib, metaOf, "all")).length, runners: [...document.querySelectorAll("#best-decade .bd-runner")].map((r) => r.querySelectorAll(".poster").length),
      sizes: [document.querySelector("#best-decade .best-decade .poster"), document.querySelector("#best-decade .bd-runner .poster")].map((p) => p && Math.round(p.getBoundingClientRect().width)) }; });
  const at = (id) => lay.ids.indexOf(id);
  assert(at("best-decade") > at("recent") && at("best-decade") < at("ch-films") && at("top") > at("ch-ratings") && at("top") > at("rated"), `main page order: ${lay.ids.join(" ")}`);
  assert(lay.cards === 0 && lay.films.join() === "released,milestones,records,rewatched" && lay.people.join() === "starring,directed,crew,people-years"
    && lay.origin.join() === "origin,world,genre-years,genre-rates" && lay.faces >= 5 && lay.cats === 2
    && lay.when.join() === "logged,months,years,habits" && lay.ratings.join() === "rated,crowd,top" && lay.reviews.join() === "reviews,review-stats" && lay.next.join() === "next",
    `every chapter in full: ${JSON.stringify(lay)}`);
  assert(lay.crowdRows.length >= 2 && lay.crowdRows.every((n) => n >= 1 && n <= 7) && lay.topRows.length >= 1 && lay.topRows.every((n) => n >= 1 && n <= 7) && lay.seeAll >= 1
    && !lay.calendar && lay.charts === 3 && lay.rewatchCol && lay.mapTops.join() === "Most watched,Highest rated"
    && lay.crew.map((c) => c[0]).join() === "Written by,Shot by,Music by" && lay.crew.every((c) => c[1] >= 1 && c[1] <= 5), `the trims: ${JSON.stringify(lay)}`);
  assert(lay.decades >= 3 && lay.runners.length === 2 && lay.runners.every((n) => n >= 3 && n <= 6) && lay.sizes[1] < lay.sizes[0],
    `second and third best decades: ${JSON.stringify({ decades: lay.decades, runners: lay.runners, sizes: lay.sizes })}`);
  // favourite years beside them (asked 31 Oct 2026): the switch shows the top release years the same way, then goes back
  await d.click('#best-decade [data-tab="bestby"][data-val="year"]'); await d.waitForTimeout(150);
  const yrs = await d.evaluate(() => { const F = favourites(computeStats(state.lib, metaOf, "all"), "year");
    return { want: F.items.slice(0, 3).map((x) => x.name).join(), got: [...document.querySelectorAll("#best-decade .bd-title, #best-decade .bd-rtitle")].map((e) => e.textContent.trim()).join(),
      head: $("#best-decade h2").textContent, bar: F.bar, every: F.items.every((x) => x.ratings.length >= F.bar) }; });
  assert(yrs.got === yrs.want && /^\d{4},\d{4},\d{4}$/.test(yrs.got) && yrs.head === "Best years" && yrs.every, `favourite years on the computer: ${JSON.stringify(yrs)}`);
  await d.click('#best-decade [data-tab="bestby"][data-val="decade"]'); await d.waitForTimeout(150);
  assert(/^The \d{4}s$/.test(await d.textContent("#best-decade .bd-title")), "back to decades on the computer");
  // under the faces: actors down to the 21st, directors down to their first row of ties, the same number of rows (and the
  // same height) on Most watched and Highest rated; Show more brings the rest
  const peopleRows = () => d.evaluate(() => Object.fromEntries(["starring", "directed"].map((id) => [id, { r: [...document.querySelectorAll(`#${id} .people-rows .rank-row`)].map((x) => x.querySelector(".r").textContent),
    h: Math.round(document.getElementById(id).getBoundingClientRect().height) }])));
  const most = await peopleRows();
  await d.click('#starring [data-tab="cast"][data-val="best"]'); await d.click('#directed [data-tab="directors"][data-val="best"]'); await d.waitForTimeout(150);
  const best = await peopleRows();
  await d.click('#starring [data-tab="cast"][data-val="most"]'); await d.click('#directed [data-tab="directors"][data-val="most"]'); await d.waitForTimeout(150);
  // (Highest rated can hold fewer people than that: then it shows what it has)
  const bestLen = await d.evaluate(() => { const s = computeStats(state.lib, metaOf, "all"); return { starring: s.cast.best.length, directed: s.directors.best.length }; });
  const lastRank = (r) => parseInt(String(r[r.length - 1]).split("–")[0], 10), tieAt = most.directed.r.findIndex((x) => /–/.test(x));
  const same = (k) => best[k].r.length === Math.min(most[k].r.length, Math.max(0, bestLen[k] - 12)) && (best[k].r.length !== most[k].r.length || bestLen[k] < 12 || best[k].h === most[k].h);
  assert(most.starring.r.length && lastRank(most.starring.r) <= 21 && (tieAt < 0 || tieAt === most.directed.r.length - 1) && same("starring") && same("directed"),
    `people rows: ${JSON.stringify({ most, best, bestLen })}`);
  // Show more opens a list under the faces, Show less closes it again
  const rowsNow = () => d.$$eval("#starring .people-rows .rank-row", (x) => x.length);
  const r0 = await rowsNow();
  if (await d.$("#starring [data-more]")) {
    await d.click("#starring [data-more]"); await d.waitForTimeout(100); const r1 = await rowsNow();
    await d.click("#starring [data-less]"); await d.waitForTimeout(100); const r2 = await rowsNow();
    assert(r1 > r0 && r2 === r0 && await d.$("#starring [data-more]"), `show more, show less: ${[r0, r1, r2]}`);
  }
  // the world map zooms (and the view stays through a redraw), and comes back out
  await d.evaluate(() => document.getElementById("world").scrollIntoView());
  const vb = () => d.$eval("#world .wsvg", (s) => s.getAttribute("viewBox"));
  const vb0 = await vb();
  await d.click('#world [data-wz="in"]'); const vb1 = await vb();
  await d.evaluate(() => renderSections(STATS)); const vb2 = await vb();
  await d.click('#world [data-wz="reset"]'); const vb3 = await vb();
  assert(vb1 !== vb0 && +vb1.split(" ")[2] < +vb0.split(" ")[2] && vb2 === vb1 && vb3 === vb0, `map zoom: ${[vb0, vb1, vb2, vb3].join(" | ")}`);
  // a row's "See all" opens the whole list in the pop-up
  await d.click("#top .row-h .dlink"); await d.waitForTimeout(150);
  const seen = await d.evaluate(() => [$("#dlg").open, $("#dlg h2, #dlg h3").textContent, $("#dlg").querySelectorAll(".drill-row, .film-row, li, .dr").length]);
  assert(seen[0] && seen[1] === "Highest rated", `See all highest rated: ${JSON.stringify(seen)}`);
  await d.keyboard.press("Escape"); await d.waitForTimeout(100);
  // tables that compare their rows: the highest of each column in gold, the lowest in purple; the average rating column
  // marks exactly its top and bottom, the films column leaves out a year still under way
  const marks = await d.evaluate(() => {
    const num = (td) => parseFloat(td.textContent.replace(/[^\d.−-]/g, "").replace("−", "-"));
    const rows = [...$("#years table.data tbody").rows], col = (i) => rows.map((r) => r.cells[i]).filter((td) => /\d/.test(td.textContent));
    const avg = col(3), vals = avg.map(num), films = rows.filter((r) => !/pace/.test(r.cells[0].textContent)).map((r) => r.cells[1]);
    const once = (xs, x) => xs.filter((v) => v === x).length === 1, fv = films.map(num), fmax = Math.max(...fv);
    return { hi: avg.filter((td) => td.classList.contains("hi")).map(num), lo: avg.filter((td) => td.classList.contains("lo")).map(num), max: Math.max(...vals), min: Math.min(...vals),
      maxOnce: once(vals, Math.max(...vals)), minOnce: once(vals, Math.min(...vals)),
      filmsHi: films.filter((td) => td.classList.contains("hi")).map(num), filmsMax: fmax, filmsOnce: once(fv, fmax),
      unit: [hiLo([3, 1, 2, null]), hiLo([0, 0, 0, 0, 5]), hiLo([1, 2]), hiLo([3, 3, 1, 2])].map((x) => x.join("/")).join(" | "),
      // the average rating chart writes only its best year (gold) and worst (purple), not every year's number
      chart: [...document.querySelectorAll("#years .mult .cv")].map((c) => c.innerHTML).filter(Boolean),
      ticks: [yearTick(0, 6, 2021), yearTick(0, 15, 2012), yearTick(1, 15, 2013), yearTick(14, 15, 2026), yearTick(2, 20, 2009)].join(",") };
  });
  // only a single clear winner is marked: a tie at an end leaves it plain
  const just = (got, want, once) => once ? got.length === 1 && got[0] === want : got.length === 0;
  assert(just(marks.hi, marks.max, marks.maxOnce) && just(marks.lo, marks.min, marks.minOnce) && just(marks.filmsHi, marks.filmsMax, marks.filmsOnce)
    && marks.unit === " hi/ lo// | //// hi | / | // lo/" && marks.chart.length <= 2 && marks.chart.every((h) => /^<b class="(hi|lo)">\d\.\d\d<\/b>$/.test(h))
    && marks.ticks === "’21,’12,,’26,", `highest in gold, lowest in purple: ${JSON.stringify(marks)}`);
  // the full sections keep their switches: Highest rated for actors, and for genres
  await d.click('#starring [data-tab="cast"][data-val="best"]'); await d.waitForTimeout(150);
  await d.click('#origin [data-tab="cats"][data-val="best"]'); await d.waitForTimeout(150);
  const sw = await d.evaluate(() => [$('#starring [data-val="best"]').getAttribute("aria-selected"), $('#origin [data-val="best"]').getAttribute("aria-selected")]);
  assert(sw[0] === "true" && sw[1] === "true", `switches in the full sections: ${sw}`);
  await d.click('#starring [data-tab="cast"][data-val="most"]'); await d.click('#origin [data-tab="cats"][data-val="most"]'); await d.waitForTimeout(150);
  // Reviewed on the main page: the latest two, the rest one click away
  const rv = await d.evaluate(() => ({ cards: document.querySelectorAll("#reviews article.review").length, total: reviewsIn(state.lib, null).length,
    first: $("#reviews .rv-title").textContent.trim(), latest: reviewsIn(state.lib, null)[0].film.name, link: $("#reviews .rv-all").textContent }));
  assert(rv.cards === 2 && rv.first.startsWith(rv.latest) && rv.link === `All ${rv.total} reviews`, `reviewed: ${JSON.stringify(rv)}`);
  await d.click("#reviews .rv-all .dlink"); await d.waitForTimeout(150);
  const all = await d.evaluate(() => [$("#dlg").open, $("#dlg").querySelectorAll(".drill-rev").length]);
  assert(all[0] && all[1] === rv.total, `all reviews: ${all}`);
  await d.keyboard.press("Escape"); await d.waitForTimeout(100);
  const wn = await d.evaluate(() => { const W = watchNext(state.lib); return W && W.picks.filter((p) => p.known).map((p) => [p.f.name, +p.pred.toFixed(2), p.why.length]); });
  assert(wn && wn.length && wn.every(([, x]) => x >= 0.5 && x <= 5) && wn.every((x, i) => !i || x[1] <= wn[i - 1][1]), `Watch next: ${JSON.stringify(wn)}`);
  // pictures: where TMDB's picture server can't be reached (the checks cut it off), they come through the relay
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await d.context().route(/wsrv\.nl/, (r) => r.fulfill({ contentType: "image/png", body: png, headers: { "access-control-allow-origin": "*" } }));
  await d.evaluate(() => { for (const f of state.lib.films.slice(0, 8)) EXAMPLE_META[f.key] = { ...EXAMPLE_META[f.key], poster: `/x${f.key.length}.png` }; render(); });
  await d.waitForFunction(() => IMG_VIA === "relay" && [...document.querySelectorAll('img[src^="https://wsrv.nl/"]')].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 }).catch(() => {});
  const relay = await d.evaluate(() => ({ via: IMG_VIA, base: IMG, loaded: [...document.querySelectorAll('img[src^="https://wsrv.nl/"]')].filter((i) => i.complete && i.naturalWidth > 0).length,
    tmdbLeft: document.querySelectorAll('img[src^="https://image.tmdb.org/"]').length }));
  assert(relay.via === "relay" && relay.base.startsWith("https://wsrv.nl/") && relay.loaded >= 1 && relay.tmdbLeft === 0, `pictures through the relay: ${JSON.stringify(relay)}`);
  const pwa = await d.evaluate(async () => { const m = await (await fetch("manifest.webmanifest")).json(); const reg = await navigator.serviceWorker.ready; return [m.name, !!reg.active]; });
  assert(pwa[0] && pwa[1], `install as an app: ${pwa}`);
  noErrors(d, "desktop");
}
