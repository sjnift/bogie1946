// The pictures to share (a year, all time, a taste match; feed post or story), the year as a story, On this day,
// Watch next, and the site still installing as an app.
import { open, assert, noErrors, desktopChapters } from "./lib.mjs";

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
    await p.click(phone ? 'button:has-text("Share 2025 as an image")' : '#y-glance button:has-text("Share as a picture")');
    await p.waitForSelector(".share-img", { timeout: 15000 });
    await imgSize("1080x1350", "2025 feed post");
    await p.click('[data-sharesize="story"]');
    await imgSize("1080x1920", "2025 story");
    await p.click('[data-sharesize="feed"]');
    await close();
    // the year as a story: every card, in turn, and the findings filled in
    await p.click(phone ? 'button:has-text("Play 2025 as a story")' : '#y-glance button:has-text("Play as a story")');
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
    if (!phone) await p.click('#jump [data-chapter="origin"]'); // the computer's Genres & countries chapter
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
      const notYet = await p.textContent("#screen .empty").catch(() => "");
      assert(/^Not enough yet: only 2 release years have 5 or more rated films, and a list needs 3\.$/.test(notYet), `phone favourite years, not enough yet: ${notYet}`);
      await p.evaluate(() => { YEAR_BAR[1] = 3; });
      await p.click('[data-bestby="decade"]'); await p.waitForTimeout(150);
      await p.click('[data-bestby="year"]'); await p.waitForTimeout(200);
      const yrs = await p.evaluate(() => ({ want: favourites(computeStats(state.lib, metaOf, "all"), "year").items.slice(0, 3).map((x) => x.name).join(),
        got: [...document.querySelectorAll(".decade-hero .dh-dec, .decade-run .dr-dec")].map((e) => e.textContent).join(), k: document.querySelector(".decade-hero .dh-k").textContent }));
      assert(yrs.got === yrs.want && /^\d{4},\d{4},\d{4}$/.test(yrs.got) && /year/.test(yrs.k), `phone favourite years: ${JSON.stringify(yrs)}`);
      await p.evaluate(() => { YEAR_BAR[1] = 5; });
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
    // films by year of release (asked 31 Oct 2026; then "all the bars are overlapping on each other"): a bar a year, all
    // the same width and each inside its own slot, also for a century in a phone's width; a year opens its films; the
    // rating view has the dashed average line
    await p.goto(`${base}${file}?example${phone ? "#/genres" : "#/"}`); await p.waitForFunction(() => typeof state === "object" && state.lib);
    if (!phone) await p.click('#jump [data-chapter="films"]'); // the computer's Films chapter
    await p.waitForSelector(".ry svg");
    const ry = await p.evaluate(() => {
      const measure = (root) => {
        const gs = [...root.querySelectorAll(".yr")], bars = [];
        let inside = true;
        for (const g of gs) { const b = g.querySelector(".bar"), h = g.querySelector(".hit").getBoundingClientRect(); if (!b) continue; const r = b.getBoundingClientRect(); bars.push(r); if (r.left < h.left - 0.01 || r.right > h.right + 0.01) inside = false; }
        const ws = bars.map((r) => r.width), apart = bars.every((r, i) => !i || bars[i - 1].right <= r.left + 0.01);
        return { n: gs.length, bars: bars.length, spread: Math.max(...ws) - Math.min(...ws), w: Math.min(...ws), inside, apart, tall: bars.map((r) => r.height) };
      };
      const s = computeStats(state.lib, metaOf, "all"), ys = s.relYears, span = ys[ys.length - 1].year - ys[0].year + 1;
      const real = measure(document.querySelector(".ry")), max = Math.max(...ys.map((x) => x.count));
      const box = document.createElement("div"); box.style.width = "300px";
      box.innerHTML = releaseYearsChart({ relYears: Array.from({ length: 107 }, (_, i) => ({ year: 1920 + i, films: [], ratings: [3], count: 1 + (i % 7), avg: 3 })) }, "films", 130);
      document.body.append(box); const century = measure(box); box.remove();
      return { span, real, century, top: ys.findIndex((x) => x.count === max), max, tallest: Math.max(...real.tall), mean: (() => { const a = ys.flatMap((x) => x.ratings); return (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2); })() };
    });
    const ok = (m, n) => m.n === n && m.inside && m.apart && m.spread < 0.05 && m.w > 1;
    assert(ok(ry.real, ry.span) && ry.real.bars > 5 && ok(ry.century, 107), `${file} films by year of release: ${JSON.stringify({ ...ry, real: { ...ry.real, tall: 0 }, century: { ...ry.century, tall: 0 } })}`);
    const topYear = await p.evaluate((i) => { const g = [...document.querySelectorAll(".ry .yr")].filter((x) => x.querySelector(".bar"))[i]; return g.dataset.tip; }, ry.top);
    await p.locator(".ry .yr[data-list]").nth(ry.top).click();
    await p.waitForSelector(`${panel}[open], ${panel}.open`, { timeout: 3000 }).catch(() => {});
    const relOpen = await p.evaluate((panel) => { const d = document.querySelector(panel); const h = d && d.querySelector("h2, h3"); return h ? h.textContent : null; }, panel);
    assert(relOpen === `Released in ${topYear.slice(0, 4)}`, `${file} a year of release opened ${relOpen} (wanted ${topYear})`);
    await close();
    await p.click(phone ? '[data-relmode="rating"]' : '[data-tab="released"][data-val="rating"]'); await p.waitForTimeout(200);
    const rt = await p.evaluate(() => ({ line: !!document.querySelector(".ry.rating .ry-line.avg"), note: (document.querySelector(".ry.rating .ry-note") || {}).textContent || "",
      trend: document.querySelectorAll(".ry.rating polyline.trend").length, tips: [...document.querySelectorAll(".ry.rating .yr")].filter((g) => / · films of \d{4}–\d{4} \d\.\d\d$/.test(g.dataset.tip)).length,
      // the line is the average of every rating of the films released within two years either side
      check: (() => { const ys = computeStats(state.lib, metaOf, "all").relYears, mid = ys[Math.floor(ys.length / 2)].year, r = ys.filter((x) => Math.abs(x.year - mid) <= 2).flatMap((x) => x.ratings);
        const g = [...document.querySelectorAll(".ry.rating .yr")].find((g) => g.dataset.tip.startsWith(`${mid}:`));
        return [g && g.dataset.tip.split(" ").pop(), r.length >= 5 ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(2) : "none"]; })() }));
    assert(rt.line && rt.note.includes(`your average rating, ${ry.mean}`) && rt.trend >= 1 && /solid line/.test(rt.note) && rt.tips >= 10 && rt.check[0] === rt.check[1],
      `${file} rating by year of release: ${JSON.stringify(rt)} (average ${ry.mean})`);
    // favourite years are ranked with caution for few films (asked 31 Oct 2026), and need enough of them
    const fav = await p.evaluate(() => {
      const yr = (year, ratings) => ({ year, ratings, count: ratings.length, avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, films: [], top: [] });
      const rep = (v, n) => Array(n).fill(v);
      const few = favourites({ relYears: [yr(1950, rep(4, 6)), yr(1960, rep(3.9, 30)), yr(1970, rep(2, 30)), yr(1980, rep(3, 30)), yr(1990, rep(2.5, 30))] }, "year");
      const thin = favourites({ relYears: [yr(1950, rep(4, 6)), yr(1960, rep(3.9, 6)), yr(1970, rep(2, 4)), yr(1980, rep(3, 3))] }, "year");
      const real = favourites(computeStats(state.lib, metaOf, "all"), "year");
      return { few: few.items.map((x) => x.name).join(), thin: thin.items.length, empty: favEmpty(thin, "2024"), bar: real.bar, sorted: real.items.every((x, i, a) => !i || a[i - 1].score >= x.score), enough: real.items.every((x) => x.ratings.length >= real.bar) };
    });
    assert(fav.few.startsWith("1960,1950") && fav.thin === 0 && /^Not enough yet: only 2 release years have 5 or more rated films watched in 2024, and a list needs 3\.$/.test(fav.empty) && fav.bar >= 5 && fav.sorted && fav.enough,
      `${file} favourite years ranked with caution: ${JSON.stringify(fav)}`);
    await p.click(phone ? '[data-relmode="films"]' : '[data-tab="released"][data-val="films"]'); await p.waitForTimeout(150);
    // a big diary's first drawing of a visit: the top of the page at once, the people a moment later (1 Nov 2026), here
    // with the bar lowered so the example counts as big
    {
      await p.goto(`${base}${file}?example${phone ? "#/profile" : "#/"}`); await p.waitForFunction(() => typeof state === "object" && state.lib); await p.waitForTimeout(300);
      const first = await p.evaluate((phone) => { PEOPLE_QUICK_FROM = 0; PEOPLE_WARMED = null; PEOPLE_WARMING = null; META_REV++; if (phone) DATA_REV++; else state.chapter = "people"; render();
        return { soon: !!document.querySelector(".soon"), people: phone ? /Most watched actors/.test(document.querySelector("#screen").textContent) : !!document.querySelector("#starring"),
          top: phone ? !!document.querySelector("#screen .tiles, #screen .card") : !!document.querySelector("#recent, #best-decade") }; }, phone);
      await p.waitForFunction((phone) => !document.querySelector(".soon") && (phone ? /Most watched actors/.test(document.querySelector("#screen").textContent) : !!document.querySelector("#starring")), phone, { timeout: 5000 }).catch(() => {});
      const then = await p.evaluate((phone) => ({ soon: !!document.querySelector(".soon"), people: phone ? /Most watched actors/.test(document.querySelector("#screen").textContent) : !!document.querySelector("#starring"), warm: peopleWarm() }), phone);
      await p.evaluate(() => { PEOPLE_QUICK_FROM = 300; if (typeof CHAPTERS === "object") state.chapter = "films"; });
      assert(first.soon && !first.people && first.top && !then.soon && then.people && then.warm, `${file} people a moment after the rest: ${JSON.stringify({ first, then })}`);
    }
    // the review of 1 Nov 2026: tied places are shared ("=2"), and a diary that never marks a rewatch leaves out what would
    // only read 0 (desktop: Liked takes the tile, no Rewatches column; phone: Back in time takes the tile)
    {
      await p.goto(`${base}${file}?example${phone ? "#/profile" : "#/"}`); await p.waitForFunction(() => typeof state === "object" && state.lib); await p.waitForTimeout(300);
      const r = await p.evaluate((phone) => {
        const ties = tieRanks([3, 2, 2, 1, 1, 1].map((c) => ({ c })), (x) => x.c).join(" ");
        const before = everRewatched(EXAMPLE_LIB), saved = EXAMPLE_LIB.entries.map((e) => e.rewatch);
        const look = () => phone ? { tile: /Rewatches/.test(document.querySelector("#screen .tiles").textContent), alt: /Back in time/.test(document.querySelector("#screen .tiles").textContent) }
          : { tile: /Rewatches/.test(document.querySelector("#tiles").textContent), alt: /Liked/.test(document.querySelector("#tiles").textContent),
            column: [...document.querySelectorAll("#sections th")].some((t) => t.textContent === "Rewatches") };
        if (!phone) { state.chapter = "when"; render(); } // the computer's Year by year table is in When you watch
        const was = look();
        EXAMPLE_LIB.entries.forEach((e) => { e.rewatch = false; }); if (phone) DATA_REV++; render();
        const none = look();
        EXAMPLE_LIB.entries.forEach((e, i) => { e.rewatch = saved[i]; }); if (!phone) state.chapter = "films"; if (phone) DATA_REV++; render();
        return { ties, before, was, none };
      }, phone);
      assert(r.ties === "1 =2 =2 =4 =4 =4" && r.before && r.was.tile && !r.none.tile && r.none.alt && (phone || (r.was.column && !r.none.column)),
        `${file} shared places and a diary with no rewatches: ${JSON.stringify(r)}`);
    }
    // your lists (5 Nov 2026): the computer's Lists chapter and the phone's Profile row, a card each; a card opens the list
    // in its own order with the films not seen marked and its notes; on the computer "N to go" opens only those
    {
      await p.goto(`${base}${file}?example${phone ? "#/profile" : "#/"}`); await p.waitForFunction(() => typeof state === "object" && state.lib); await p.waitForTimeout(300);
      if (!phone) await p.click('#jump [data-chapter="lists"]');
      const cards = await p.$$eval(phone ? ".scroller.lists .lcard" : "#lists .lcard", (x) => x.map((c) => c.textContent.replace(/\s+/g, " ").trim()));
      await p.click(phone ? ".scroller.lists .lcard" : "#lists .lmain"); await p.waitForTimeout(250);
      const rowsOf = () => p.evaluate((phone) => { const d = document.querySelector(phone ? "#sheet" : "#dlg");
        return { rows: [...d.querySelectorAll(".drill-row .dr-s")].map((e) => e.textContent), text: d.innerText }; }, phone);
      const open = await rowsOf();
      assert(cards.length === 2 && /Favourite performances/.test(cards[0]) && /Seen 3 of 5/.test(cards[0]) && /Favourite performances/.test(open.text) && open.rows.length === 5
        && open.rows.filter((r) => /^Not seen yet/.test(r)).length === 2 && / · The lead$/.test(open.rows[0]) && open.rows.some((r) => r === "Not seen yet · Victor Sjöström"),
        `${file} lists: ${JSON.stringify({ cards, open })}`);
      if (!phone) {
        await p.keyboard.press("Escape"); await p.waitForTimeout(100);
        await p.click("#lists .lseen .dlink"); await p.waitForTimeout(250);
        const left = await rowsOf();
        assert(left.rows.length === 2 && left.rows.every((r) => /^Not seen yet/.test(r)), `${file} a list's films not seen yet: ${JSON.stringify(left.rows)}`);
        await p.keyboard.press("Escape");
      }
    }
    // a poster's title card never breaks a word (it showed "MANHATTA / N" where pictures didn't load, 1 Nov 2026): with
    // breaking turned off, no card's longest word runs past its edge, here in the wide stand-in font the checks have
    if (phone) { await p.goto(`${base}${file}?example#/profile`); await p.waitForFunction(() => typeof state === "object" && state.lib); }
    else { await p.goto(`${base}${file}?example#/`); await p.waitForFunction(() => typeof state === "object" && state.lib); }
    await p.waitForTimeout(300);
    const titles = await p.evaluate((sel) => { const out = { n: 0, over: [] };
      for (const t of document.querySelectorAll(sel)) { if (!t.offsetWidth) continue; out.n++; t.style.overflowWrap = "normal"; t.style.wordBreak = "normal";
        const over = t.scrollWidth > t.clientWidth + 1; t.style.overflowWrap = ""; t.style.wordBreak = ""; if (over) out.over.push(`${t.firstChild.textContent} ${getComputedStyle(t).fontSize}`); }
      return out; }, phone ? ".poster .ph" : ".poster .art .t");
    assert(titles.n >= 8 && !titles.over.length, `${file} title cards that break a word: ${titles.over.slice(0, 5).join(" | ")} (of ${titles.n})`);
    // the studios pie has each studio's name inside its slice (asked 1 Nov 2026): every slice of a top-seven pie named,
    // inside the pie, a label's last word left off and Metro-Goldwyn-Mayer as MGM
    const pie = await p.evaluate(() => {
      const owner = [["Warner Bros.", 160], ["20th Century Fox", 113], ["Paramount", 111], ["Columbia Pictures", 90], ["Universal Pictures", 86], ["Metro-Goldwyn-Mayer", 51], ["United Artists", 44]];
      const slices = owner.map(([n, k], i) => ({ name: n, films: Array(k).fill(0), slot: i + 1 })), box = document.createElement("div");
      box.className = "studios"; box.innerHTML = `<div class="pie-wrap">${pieSvg({ slices, pieTotal: 655, total: 1556, topOnly: true }, () => D.films("x", "", []))}</div>`;
      document.body.append(box);
      const svg = box.querySelector(".pie").getBoundingClientRect(), labels = [...box.querySelectorAll(".pie-t")];
      const out = { n: labels.length, names: labels.map((t) => [...t.querySelectorAll("tspan")].map((x) => x.textContent).join(" ")).join(),
        inside: labels.every((t) => { const r = t.getBoundingClientRect(); return r.left >= svg.left && r.right <= svg.right && r.top >= svg.top && r.bottom <= svg.bottom; }) };
      box.remove();
      return out;
    });
    assert(pie.n === 7 && pie.inside && pie.names === "Warner Bros.,20th Century Fox,Paramount,Columbia,Universal,MGM,United Artists", `${file} studio names in the pie: ${JSON.stringify(pie)}`);
    // back in time (asked 1 Nov 2026, reworked the same day): a year's end, the slider, a typed date and a click on the
    // timeline move the results, never the control being used; each list is Most watched up to that day, in its order,
    // with shared ranks; who led when is drawn for the lists on show; a person opens their films up to that day
    // on Insights since 5 Nov 2026 (the phone's second tab; the computer's section after Chapters), not on the Stats page
    await p.goto(`${base}${file}?example#/insights`); await p.waitForFunction(() => typeof state === "object" && state.lib);
    if (phone) await p.click('[data-instab="asof"]');
    await p.waitForSelector(".asof .asof-range");
    const place = await p.evaluate((phone) => phone ? [...document.querySelectorAll("[data-instab]")].map((t) => t.dataset.instab).slice(0, 2).join()
      : [...document.querySelectorAll("#insights > section")].map((s) => s.id).slice(0, 3).join(), phone);
    assert(place === (phone ? "overview,asof" : "i-glance,i-chapters,i-asof"), `${file} back in time's place on Insights: ${place}`);
    const jump = await p.$eval("[data-asof-day]", (b) => b.dataset.asofDay);
    await p.click(`[data-asof-day="${jump}"]`); await p.waitForTimeout(120);
    const at = () => p.evaluate(() => ({ date: document.querySelector(".asof-date").value, range: +document.querySelector(".asof-range").value, big: document.querySelector(".asof-big").textContent,
      stat: document.querySelector(".asof-stat").textContent, on: [...document.querySelectorAll(".asof-jump.on")].map((b) => b.dataset.asofDay).join(),
      cols: [...document.querySelectorAll(".asof-col")].map((c) => c.dataset.kind).join(), bars: [...document.querySelectorAll(".asof-bar")].map((c) => c.dataset.kind).join(),
      mark: getComputedStyle(document.querySelector(".asof")).getPropertyValue("--at").trim(),
      first: [...document.querySelectorAll(".asof-col")].map((c) => { const b = c.querySelector(".asof-hero"); return b ? [b.querySelector(".asof-hn b").textContent, parseInt(b.querySelector(".asof-hs").textContent, 10)] : null; }),
      ranks: [...document.querySelectorAll(".asof-col")].map((c) => [...c.querySelectorAll(".asof-rk")].map((r) => r.textContent).join(" ")) }));
    const want = (day) => p.evaluate((day) => { const C = asofCount(ASOF.lib, day), I = asofIndex(ASOF.lib);
      return { top: Object.fromEntries(ASOF_KINDS.map(([k]) => [k, C.lists[k][0] ? [C.lists[k][0].name, C.lists[k][0].count] : null])),
        ranks: Object.fromEntries(ASOF_KINDS.map(([k]) => [k, C.lists[k].slice(1, ASOF_N).map((p) => `${p.tied ? "=" : ""}${p.rank}`).join(" ")])),
        films: asofIdx(I.B, day), long: asofLong(day), at: asofAt(I.B, day).toFixed(2) + "%" }; }, day);
    const a1 = await at(), w1 = await want(jump), shown = phone ? ["d"] : ["d", "m", "w"];
    assert(a1.date === jump && a1.on === jump && a1.big === w1.long && a1.stat.startsWith(`${w1.films} films by then`) && a1.mark === w1.at && a1.cols === shown.join() && a1.bars === "d,m,w"
      && shown.every((k, i) => JSON.stringify(a1.first[i]) === JSON.stringify(w1.top[k]) && a1.ranks[i] === w1.ranks[k]), `${file} back in time, a year's end: ${JSON.stringify({ a1, w1 })}`);
    // the slider: the date box and the marker follow; a typed date: the slider follows; a click on the timeline's middle
    await p.$eval(".asof-range", (r) => { r.value = String(Math.floor(+r.max / 2)); r.dispatchEvent(new Event("input", { bubbles: true })); }); await p.waitForTimeout(120);
    const a2 = await at(), half = await p.evaluate(() => asofAdd(asofBase(ASOF.lib).start, Math.floor(+document.querySelector(".asof-range").max / 2)));
    assert(a2.date === half && a2.big === (await want(half)).long, `${file} back in time, the slider: ${JSON.stringify({ a2, half })}`);
    await p.fill(".asof-date", jump); await p.waitForTimeout(120);
    const a3 = await at();
    assert(a3.range === await p.evaluate((d) => asofDays(asofBase(ASOF.lib).start, d), jump) && JSON.stringify(a3.first[0]) === JSON.stringify(w1.top.d), `${file} back in time, a typed date: ${JSON.stringify(a3)}`);
    const bar = await (await p.$(".asof-bar")).boundingBox();
    await p.mouse.click(bar.x + bar.width / 2, bar.y + bar.height / 2); await p.waitForTimeout(120);
    const a5 = await at(), mid = await p.evaluate(() => { const B = asofBase(ASOF.lib); return asofAdd(B.start, Math.round(asofSpan(B) / 2)); });
    assert(Math.abs(await p.evaluate(([a, b]) => asofDays(a, b), [a5.date, mid])) <= 2 && a5.date === (await p.evaluate(() => ASOF.day)), `${file} back in time, a click on the timeline: ${a5.date}, not about ${mid}`);
    await p.fill(".asof-date", jump); await p.waitForTimeout(120);
    // the other lists: the phone's switch, the computer's everyone together
    if (phone) {
      await p.click('[data-asof-kind="w"]'); await p.waitForTimeout(120);
      const a4 = await at();
      assert(a4.cols === "w" && JSON.stringify(a4.first[0]) === JSON.stringify(w1.top.w) && a4.date === jump, `${file} back in time, actresses: ${JSON.stringify(a4)}`);
      await p.click('[data-asof-kind="a"]'); await p.waitForTimeout(120);
      const a6 = await at();
      assert(a6.cols === "a" && a6.bars === "d,a" && JSON.stringify(a6.first[0]) === JSON.stringify(w1.top.a), `${file} back in time, everyone: ${JSON.stringify(a6)}`);
      await p.click('[data-asof-kind="w"]'); await p.waitForTimeout(120);
    } else {
      await p.click('[data-asof-together="1"]'); await p.waitForTimeout(120);
      const a6 = await at();
      assert(a6.cols === "d,a" && a6.bars === "d,a" && JSON.stringify(a6.first[1]) === JSON.stringify(w1.top.a), `${file} back in time, everyone together: ${JSON.stringify(a6)}`);
      await p.click('[data-asof-together="0"]'); await p.waitForTimeout(120);
    }
    // who leads, said: one since a day, or level with others and who got there first
    const leads = await p.evaluate(() => [asofLead([{ name: "A", count: 3, ord: 9 }, { name: "B", count: 3, ord: 4 }, { name: "C", count: 2, ord: 1 }], "director", "2022-01-01"), asofLead([{ name: "A", count: 3, ord: 1 }, { name: "B", count: 2, ord: 2 }], "actress", "2022-01-01")]);
    assert(leads[0] === "Level with B on 3 films; B got there first." && leads[1] === "On top since 1 Jan 2022.", `${file} back in time, who leads: ${JSON.stringify(leads)}`);
    // the films marked as seen on joining Letterboxd: the timeline starts when they end, and says so
    const pile = await p.evaluate(() => { const f = (k, added, d) => ({ key: k, added, entries: d ? [{ date: d }] : [] });
      const films = [...Array.from({ length: 12 }, (_, i) => f(`m${i}`, `2020-01-1${i % 3}`)), f("x", "2020-01-05", "2020-01-05"), f("y", "2020-03-01", "2020-03-01"), f("z", "2021-06-01", "2021-05-30")];
      const B = asofBase({ films, profile: { joined: "2020-01-10" } }), C = asofBase({ films: films.slice(12), profile: { joined: "2020-01-10" } });
      return [B.first, B.start, B.pile, B.last, C.start, C.pile]; });
    assert(JSON.stringify(pile) === JSON.stringify(["2020-01-05", "2020-01-12", 12, "2021-05-30", "2020-01-05", 0]), `${file} back in time, the sign-up pile: ${JSON.stringify(pile)}`);
    await p.click(".asof-hero"); await p.waitForTimeout(200);
    const who = await p.evaluate((panel) => { const d = document.querySelector(panel); return d ? [d.querySelector("h2, h3") && d.querySelector("h2, h3").textContent, d.textContent] : null; }, panel);
    const lead = phone ? w1.top.w : w1.top.d;
    assert(who && who[0] === lead[0] && who[1].includes(`${lead[1] === 1 ? "1 film" : `${lead[1]} films`} by ${await p.evaluate((d) => fmtDate(d), jump)}`), `${file} back in time opened ${JSON.stringify(who && [who[0], who[1].slice(0, 120)])}`);
    await close();
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
  // the main page (owner, Oct 2026; one chapter at a time since 5 Nov 2026, "homepage is too cluttered"): under the tiles
  // Recently watched, On this day and the best decade, always; then the chapter tabs, and only the chosen chapter, every
  // section in full, trimmed: a row of posters each in Ratings, one calendar in Logged, one row of charts in Year by
  // year, and the countries on the map rather than in Genre & origin
  const chap = async (id) => { await d.click(`#jump [data-chapter="${id}"]`); await d.waitForTimeout(80); };
  const lay = { glance: await d.$$eval("#glance > section", (x) => x.map((e) => e.id)), chapters: {}, cards: 0, others: [] };
  const allIds = ["recent", "onthisday", "best-decade", "released", "milestones", "records", "rewatched", "starring", "voices", "directed", "crew", "people-years",
    "origin", "world", "genre-years", "genre-rates", "logged", "months", "seasons", "years", "habits", "rated", "crowd", "top", "reviews", "review-stats", "lists", "next"];
  lay.tabs = await desktopChapters(d, async (id) => {
    const got = await d.evaluate((allIds) => ({ ids: [...document.querySelectorAll("#sections > section")].map((e) => e.id), cards: document.querySelectorAll("#sections .dc, #sections .dash").length,
      // only the chosen chapter is on the page, and the bar sits between the top and it
      onPage: allIds.filter((x) => document.getElementById(x)), order: $("#glance").compareDocumentPosition($("#jump")) & 4 && $("#jump").compareDocumentPosition($("#sections")) & 4 }), allIds);
    lay.chapters[id] = got.ids; lay.cards += got.cards;
    const extra = got.onPage.filter((x) => !got.ids.includes(x) && !lay.glance.includes(x));
    if (extra.length || !got.order) lay.others.push(`${id}: ${extra.join()} ${got.order ? "" : "out of order"}`);
  });
  const C = lay.chapters;
  assert(lay.glance.join() === "recent,onthisday,best-decade" || lay.glance.join() === "recent,best-decade", `the top of the main page: ${lay.glance}`);
  assert(lay.tabs.join() === "films,people,origin,when,ratings,reviews,lists,next" && !lay.others.length && lay.cards === 0 && C.lists.join() === "lists"
    && C.films.join() === "released,milestones,records,rewatched" && C.people.join() === "starring,directed,crew,people-years"
    && C.origin.join() === "origin,world,genre-years,genre-rates" && C.when.join() === "logged,months,seasons,years,habits"
    && C.ratings.join() === "rated,crowd,top" && C.reviews.join() === "reviews,review-stats" && C.next.join() === "next",
    `one chapter at a time, each in full: ${JSON.stringify(lay)}`);
  // the chapter is remembered for the next visit, and a tab clicked further down the page shows its chapter from the top
  await chap("ratings");
  await d.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await chap("when");
  const pos = await d.evaluate(() => ({ bar: Math.round($("#jump").getBoundingClientRect().top), ch: Math.round($("#sections").getBoundingClientRect().top), h: $("#jump").offsetHeight,
    saved: store.get(KEYS.view, {}).chapter }));
  assert(pos.bar === 0 && Math.abs(pos.ch - pos.h) <= 2 && pos.saved === "when", `a tab further down shows its chapter from the top: ${JSON.stringify(pos)}`);
  await d.keyboard.press("ArrowRight"); await d.waitForTimeout(80);
  assert(await d.evaluate(() => state.chapter === "ratings" && document.activeElement.dataset.chapter === "ratings"), "the arrow keys move along the tabs");
  await d.reload(); await d.waitForFunction(() => typeof state === "object" && state.lib); await d.waitForTimeout(200);
  assert(await d.evaluate(() => state.chapter === "ratings" && !!document.getElementById("crowd")), "the chapter wasn't remembered");
  // the trims, chapter by chapter
  const trims = {};
  await chap("ratings");
  Object.assign(trims, await d.evaluate(() => { const rows = (sel) => [...document.querySelectorAll(`${sel} .posters.one-row`)].map((r) => r.children.length);
    return { crowdRows: rows("#crowd"), topRows: rows("#top"), seeAll: document.querySelectorAll("#top .row-h .dlink").length }; }));
  await chap("when");
  Object.assign(trims, await d.evaluate(() => ({ calendar: /Last 12 months/.test($("#logged").textContent), charts: document.querySelectorAll("#years .mult").length,
    rewatchCol: /Rewatches/.test($("#years thead").textContent) })));
  await chap("origin");
  Object.assign(trims, await d.evaluate(() => ({ mapTops: [...document.querySelectorAll("#world .wtops .k")].map((k) => k.textContent), cats: document.querySelectorAll("#origin .cat-grid h3").length })));
  await chap("people");
  Object.assign(trims, await d.evaluate(() => ({ crew: [...document.querySelectorAll("#crew .crew-grid > div")].map((c) => [c.querySelector("h3 span").textContent, c.querySelectorAll(".rank-row").length]),
    faces: document.querySelectorAll("#starring .person").length })));
  assert(trims.crowdRows.length >= 2 && trims.crowdRows.every((n) => n >= 1 && n <= 7) && trims.topRows.length >= 1 && trims.topRows.every((n) => n >= 1 && n <= 7) && trims.seeAll >= 1
    && !trims.calendar && trims.charts === 3 && trims.rewatchCol && trims.mapTops.join() === "Most watched,Highest rated" && trims.cats === 2 && trims.faces >= 5
    && trims.crew.map((c) => c[0]).join() === "Written by,Shot by,Music by" && trims.crew.every((c) => c[1] >= 1 && c[1] <= 5), `the trims: ${JSON.stringify(trims)}`);
  // the best decade, then the second and third with their posters, smaller
  const dec = await d.evaluate(() => ({ decades: bestDecades(computeStats(state.lib, metaOf, "all")).length, runners: [...document.querySelectorAll("#best-decade .bd-runner")].map((r) => r.querySelectorAll(".poster").length),
    sizes: [document.querySelector("#best-decade .best-decade .poster"), document.querySelector("#best-decade .bd-runner .poster")].map((p) => p && Math.round(p.getBoundingClientRect().width)) }));
  assert(dec.decades >= 3 && dec.runners.length === 2 && dec.runners.every((n) => n >= 3 && n <= 6) && dec.sizes[1] < dec.sizes[0], `second and third best decades: ${JSON.stringify(dec)}`);
  // favourite years beside them (asked 31 Oct 2026): the switch shows the top release years the same way, then goes back
  // the example diary has only two release years with 5 rated films: not enough for a list, and it says so; then with the
  // bar lowered for the check, the list itself
  await d.click('#best-decade [data-tab="bestby"][data-val="year"]'); await d.waitForTimeout(150);
  const notYet = await d.textContent("#best-decade .empty").catch(() => "");
  assert(/^Not enough yet: only 2 release years have 5 or more rated films, and a list needs 3\.$/.test(notYet), `favourite years on the computer, not enough yet: ${notYet}`);
  await d.evaluate(() => { YEAR_BAR[1] = 3; });
  await d.click('#best-decade [data-tab="bestby"][data-val="decade"]'); await d.waitForTimeout(100);
  await d.click('#best-decade [data-tab="bestby"][data-val="year"]'); await d.waitForTimeout(150);
  const yrs = await d.evaluate(() => { const F = favourites(computeStats(state.lib, metaOf, "all"), "year");
    return { want: F.items.slice(0, 3).map((x) => x.name).join(), got: [...document.querySelectorAll("#best-decade .bd-title, #best-decade .bd-rtitle")].map((e) => e.textContent.trim()).join(),
      head: $("#best-decade h2").textContent, bar: F.bar, every: F.items.every((x) => x.ratings.length >= F.bar) }; });
  assert(yrs.got === yrs.want && /^\d{4},\d{4},\d{4}$/.test(yrs.got) && yrs.head === "Best years" && yrs.every, `favourite years on the computer: ${JSON.stringify(yrs)}`);
  await d.evaluate(() => { YEAR_BAR[1] = 5; });
  await d.click('#best-decade [data-tab="bestby"][data-val="decade"]'); await d.waitForTimeout(150);
  assert(/^The \d{4}s$/.test(await d.textContent("#best-decade .bd-title")), "back to decades on the computer");
  // under the faces: actors down to the 21st, directors down to their first row of ties, the same number of rows (and the
  // same height) on Most watched and Highest rated; Show more brings the rest
  await chap("people");
  const peopleRows = () => d.evaluate(() => Object.fromEntries(["starring", "directed"].map((id) => [id, { r: [...document.querySelectorAll(`#${id} .people-rows .rank-row`)].map((x) => x.querySelector(".r").textContent),
    h: Math.round(document.getElementById(id).getBoundingClientRect().height) }])));
  const most = await peopleRows();
  await d.click('#starring [data-tab="cast"][data-val="best"]'); await d.click('#directed [data-tab="directors"][data-val="best"]'); await d.waitForTimeout(150);
  const best = await peopleRows();
  await d.click('#starring [data-tab="cast"][data-val="most"]'); await d.click('#directed [data-tab="directors"][data-val="most"]'); await d.waitForTimeout(150);
  // (Highest rated can hold fewer people than that: then it shows what it has)
  const bestLen = await d.evaluate(() => { const s = computeStats(state.lib, metaOf, "all"); return { starring: s.cast.best.length, directed: s.directors.best.length }; });
  const lastRank = (r) => parseInt(String(r[r.length - 1]).replace("=", "").split("–")[0], 10), tieAt = most.directed.r.findIndex((x) => /–/.test(x));
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
  await chap("origin");
  await d.evaluate(() => document.getElementById("world").scrollIntoView());
  const vb = () => d.$eval("#world .wsvg", (s) => s.getAttribute("viewBox"));
  const vb0 = await vb();
  await d.click('#world [data-wz="in"]'); const vb1 = await vb();
  await d.evaluate(() => renderSections(STATS)); const vb2 = await vb();
  await d.click('#world [data-wz="reset"]'); const vb3 = await vb();
  assert(vb1 !== vb0 && +vb1.split(" ")[2] < +vb0.split(" ")[2] && vb2 === vb1 && vb3 === vb0, `map zoom: ${[vb0, vb1, vb2, vb3].join(" | ")}`);
  // a row's "See all" opens the whole list in the pop-up
  await chap("ratings");
  await d.click("#top .row-h .dlink"); await d.waitForTimeout(150);
  const seen = await d.evaluate(() => [$("#dlg").open, $("#dlg h2, #dlg h3").textContent, $("#dlg").querySelectorAll(".drill-row, .film-row, li, .dr").length]);
  assert(seen[0] && seen[1] === "Highest rated", `See all highest rated: ${JSON.stringify(seen)}`);
  await d.keyboard.press("Escape"); await d.waitForTimeout(100);
  // tables that compare their rows: the highest of each column in gold, the lowest in purple; the average rating column
  // marks exactly its top and bottom, the films column leaves out a year still under way
  await chap("when");
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
  const sw = [];
  for (const [ch, sec, tab] of [["people", "starring", "cast"], ["origin", "origin", "cats"]]) {
    await chap(ch);
    await d.click(`#${sec} [data-tab="${tab}"][data-val="best"]`); await d.waitForTimeout(150);
    sw.push(await d.evaluate((sec) => $(`#${sec} [data-val="best"]`).getAttribute("aria-selected"), sec));
    await d.click(`#${sec} [data-tab="${tab}"][data-val="most"]`); await d.waitForTimeout(150);
  }
  assert(sw[0] === "true" && sw[1] === "true", `switches in the full sections: ${sw}`);
  // Reviewed on the main page: the latest two, the rest one click away
  await chap("reviews");
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
