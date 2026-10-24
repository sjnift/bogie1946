<script>
/* ---------- pictures to share: a year in film, all time, and a taste match with a friend ----------
   Drawn on a canvas in the desktop page's colours, as a feed post (1080 × 1350, the shape Instagram and most feeds
   show whole) or a story (1080 × 1920): the numbers, the four best-rated films with posters, and the headlines.
   What a picture shows is a "spec": a year ("2025"), "all", or "match:<friend id>". */
const SHARE = { w: 1080, h: 1350, bg: "#141017", band: "#0C090E", hole: "#2B2331", surface: "#221B28", line: "#3A3042",
  ink: "#F3EEF4", ink2: "#C2B8C6", muted: "#8E8394", gold: "#BE8722", goldInk: "#E6B65A" };
const SHARE_FONTS = { display: '"Big Shoulders Display", "Arial Narrow", sans-serif', mono: '"IBM Plex Mono", ui-monospace, monospace', sans: '"Schibsted Grotesk", system-ui, sans-serif' };
const shareCache = new Map();
// older Safari has no rounded rectangles on a canvas; square corners will do there
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
const SHARE_SIZES = { feed: { h: 1350, label: "Feed post", note: "1080 × 1350 pixels, the size most feeds show whole." },
  story: { h: 1920, label: "Story", note: "1080 × 1920 pixels, for Instagram and WhatsApp stories." } };
let SHARE_SIZE = "feed";
D.share = (Y) => ({ kind: "share", year: Y, title: Y === "all" ? "All time in film" : `${Y} in film`, sub: "A picture to share" });
D.shareMatch = (id, name) => ({ kind: "share", year: `match:${id}`, title: `You and ${name}`, sub: "Your taste match, as a picture to share" });
const shareBodyHtml = (d) => `<div class="share-size" role="group" aria-label="Shape of the picture">${Object.entries(SHARE_SIZES).map(([k, x]) =>
  `<button class="chip" type="button" data-sharesize="${k}" aria-pressed="${k === SHARE_SIZE}">${x.label}</button>`).join("")}</div>
  <div class="share" data-share="${esc(d.year)}"><p class="dr-s">Drawing…</p></div>`;
// The whole diary, whatever filters the page has on: a picture of a year is of all of it.
const shareLib = () => state.mode === "mine" && MY_LIB ? MY_LIB : EXAMPLE_LIB;

async function shareFonts() {
  // the phone page doesn't load these fonts; its stylesheet has to arrive before the fonts can be asked for
  if (!document.querySelector('link[href*="Big+Shoulders"]')) {
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=IBM+Plex+Mono:wght@500&family=Schibsted+Grotesk:wght@500;700&display=swap" });
    await Promise.race([new Promise((resolve) => { link.onload = link.onerror = resolve; document.head.append(link); }), sleep(2500)]);
  }
  try { await Promise.race([Promise.all([`800 100px ${SHARE_FONTS.display}`, `500 20px ${SHARE_FONTS.mono}`, `700 30px ${SHARE_FONTS.sans}`].map((f) => document.fonts.load(f))), sleep(2500)]); } catch {}
}
const loadImg = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img); img.onerror = () => resolve(null);
  img.src = src;
  setTimeout(() => resolve(null), 6000);
});
// Words wrapped to a width, at most `lines` lines, the last cut with an ellipsis.
function wrapText(ctx, text, width, lines) {
  const words = String(text).split(/\s+/), out = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= width || !cur) cur = next; else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; let last = out[lines - 1]; while (last && ctx.measureText(last + "…").width > width) last = last.slice(0, -1); out[lines - 1] = last + "…"; }
  return out;
}
function fitText(ctx, text, width) {
  let t = String(text);
  if (ctx.measureText(t).width <= width) return t;
  while (t && ctx.measureText(t + "…").width > width) t = t.slice(0, -1);
  return t + "…";
}

// Sprocket bands, the wordmark and who it's of.
function shareFrame(ctx, C, F, who) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, C.w, C.h);
  for (const y0 of [0, C.h - 44]) {
    ctx.fillStyle = C.band; ctx.fillRect(0, y0, C.w, 44);
    ctx.fillStyle = C.hole;
    for (let x = 18; x < C.w; x += 54) { ctx.beginPath(); ctx.roundRect(x, y0 + 14, 30, 16, 4); ctx.fill(); }
  }
  ctx.textBaseline = "alphabetic";
  const top = C.h > 1500 ? 150 : 108;
  ctx.fillStyle = C.goldInk; ctx.font = `500 22px ${F.mono}`; ctx.letterSpacing = "6px";
  ctx.fillText("CREDITS ROLL", 72, top);
  ctx.textAlign = "right"; ctx.fillStyle = C.muted; ctx.fillText(fitText(ctx, who, 560), C.w - 72, top);
  ctx.textAlign = "left"; ctx.letterSpacing = "0px";
}
// Where it came from, at the foot (on a story) or beside a heading.
const shareSite = () => SITE_REPO ? location.host + location.pathname.replace(/[^/]*$/, "") : "";
const shareWho = (lib) => state.mode === "example" ? "EXAMPLE DIARY" : lib.profile.username ? `@${lib.profile.username.toUpperCase()}` : "";
// Four posters in a row from `y`, with a caption under each.
async function sharePosters(ctx, C, F, items, y, withPosters, caption) {
  const M = 72, pw = 216, ph = 324, gap = (C.w - 2 * M - 4 * pw) / 3;
  const imgs = await Promise.all(items.map((x) => { const m = metaOf(x.f); return withPosters && showImages && m && imagePath(m.poster) ? loadImg(`https://image.tmdb.org/t/p/w342${m.poster}`) : null; }));
  items.forEach((x, i) => {
    const px = M + i * (pw + gap);
    ctx.save(); ctx.beginPath(); ctx.roundRect(px, y, pw, ph, 10); ctx.clip();
    ctx.fillStyle = C.surface; ctx.fillRect(px, y, pw, ph);
    if (imgs[i]) ctx.drawImage(imgs[i], px, y, pw, ph);
    else {
      ctx.fillStyle = C.ink; ctx.font = `800 34px ${F.display}`;
      wrapText(ctx, x.f.name.toUpperCase(), pw - 32, 5).forEach((l, j) => ctx.fillText(l, px + 16, y + 54 + j * 36));
      ctx.fillStyle = C.muted; ctx.font = `500 18px ${F.mono}`; ctx.fillText(String(x.f.year || ""), px + 16, y + ph - 20);
    }
    ctx.restore();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(px, y, pw, ph, 10); ctx.stroke();
    caption(x, px, y + ph);
  });
  return y + ph;
}
// Two columns of small headings with a line each, from `y`.
function shareFacts(ctx, C, F, facts, y, step) {
  const M = 72, fw = (C.w - 2 * M - 40) / 2;
  facts.forEach(([k, v], i) => {
    const x = M + (i % 2) * (fw + 40), yy = y + Math.floor(i / 2) * step;
    ctx.fillStyle = C.muted; ctx.font = `500 17px ${F.mono}`; ctx.letterSpacing = "2px"; ctx.fillText(k, x, yy); ctx.letterSpacing = "0px";
    ctx.fillStyle = C.ink; ctx.font = `700 31px ${F.sans}`; ctx.fillText(fitText(ctx, v, fw), x, yy + 38);
  });
}
// A year's numbers, or all time's.
function shareData(lib, Y) {
  if (Y !== "all") {
    const R = computeYearInsights(lib, metaOf, Y, state.crowd || defaultCrowd(lib, metaOf));
    const top = R.cur && R.cur.topGenre && R.cur.withMeta ? [R.cur.topGenre[0], pctOf(R.cur.topGenre[1], R.cur.withMeta)] : null;
    return { S: R.S, best: R.best, avgR: R.cur && R.cur.avgRating ? R.cur.avgRating : R.S.avgRating, top };
  }
  const S = computeStats(lib, metaOf, "all");
  const best = S.films.filter((f) => f.rating).sort((a, b) => b.rating - a.rating || b.entries.length - a.entries.length || (b.year || 0) - (a.year || 0)).slice(0, 4).map((f) => ({ f, r: f.rating }));
  const g = S.genres.most[0], withMeta = S.films.filter((f) => metaOf(f)).length;
  return { S, best, avgR: S.avgRating, top: g && withMeta ? [g.name, pctOf(g.count, withMeta)] : null };
}

async function drawYear(lib, Y, withPosters, size) {
  const { S, best: allBest, avgR, top } = shareData(lib, Y), C = { ...SHARE, h: SHARE_SIZES[size].h }, F = SHARE_FONTS, story = size === "story", all = Y === "all";
  const cv = Object.assign(document.createElement("canvas"), { width: C.w, height: C.h }), ctx = cv.getContext("2d");
  const M = 72, dy = story ? 150 : 0; // a story has room for more, lower down
  shareFrame(ctx, C, F, shareWho(lib));
  // the year (or all time)
  ctx.fillStyle = C.goldInk; ctx.font = `800 ${all ? 230 : 290}px ${F.display}`;
  ctx.fillText(all ? "ALL TIME" : Y, M - 8, 385 + dy);
  ctx.fillStyle = C.ink; ctx.font = `800 86px ${F.display}`;
  const first = S.entries.length ? S.entries[0].date.slice(0, 4) : "";
  ctx.fillText(all ? (first ? `IN FILM, SINCE ${first}` : "IN FILM") : "IN FILM", M, 470 + dy);
  // the numbers
  const hours = S.timed ? fmtN(Math.round(S.minutes / 60)) : "—";
  const nums = [["FILMS", fmtN(S.films.length)], ["HOURS", hours], ["AVERAGE", avgR ? `${avgR.toFixed(1)}★` : "—"], ["DIARY ENTRIES", fmtN(S.entries.length)]];
  const colW = (C.w - 2 * M) / 4;
  ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, 520 + dy); ctx.lineTo(C.w - M, 520 + dy); ctx.stroke();
  nums.forEach(([k, v], i) => {
    const x = M + i * colW;
    ctx.fillStyle = C.ink; ctx.font = `800 78px ${F.display}`; ctx.fillText(fitText(ctx, v, colW - 16), x, 610 + dy);
    ctx.fillStyle = C.muted; ctx.font = `500 19px ${F.mono}`; ctx.letterSpacing = "2px"; ctx.fillText(k, x, 646 + dy); ctx.letterSpacing = "0px";
  });
  ctx.beginPath(); ctx.moveTo(M, 680 + dy); ctx.lineTo(C.w - M, 680 + dy); ctx.stroke();
  // the four best-rated films
  ctx.fillStyle = C.goldInk; ctx.font = `500 20px ${F.mono}`; ctx.letterSpacing = "4px"; ctx.fillText("HIGHEST RATED", M, 730 + dy); ctx.letterSpacing = "0px";
  if (shareSite() && !story) { ctx.fillStyle = C.muted; ctx.font = `500 17px ${F.mono}`; ctx.textAlign = "right"; ctx.fillText(shareSite(), C.w - M, 730 + dy); ctx.textAlign = "left"; }
  const best = allBest.slice(0, 4);
  const end = await sharePosters(ctx, C, F, best, 752 + dy, withPosters, (x, px, y) => { ctx.fillStyle = C.goldInk; ctx.font = `700 26px ${F.sans}`; ctx.fillText(stars(x.r), px, y + 38); });
  if (!best.length) { ctx.fillStyle = C.muted; ctx.font = `500 26px ${F.sans}`; ctx.fillText(all ? "No rated films yet." : "No rated films this year.", M, 800 + dy); }
  // the headlines
  const dir = S.directors.most[0], star = S.cast.most[0], bm = S.busiestMonth;
  const five = S.spread ? S.spread[9].count : 0;
  const facts = [
    dir && dir.count > 1 && [all ? "MOST WATCHED DIRECTOR" : "DIRECTOR OF THE YEAR", `${dir.name} · ${dir.count}`],
    star && star.count > 1 && ["MOST SEEN ACTOR", `${star.name} · ${star.count}`],
    top && ["TOP GENRE", `${top[0]} · ${top[1]}%`],
    bm && ["BUSIEST MONTH", `${MONTHS_LONG[+bm.key.slice(5, 7) - 1]}${all ? ` ${bm.key.slice(0, 4)}` : ""} · ${plural(bm.count, "film")}`],
    S.streak.days > 1 && ["LONGEST STREAK", `${S.streak.days} days in a row`],
    five && ["FIVE STARS", plural(five, "film")],
    S.countries.most.length > 1 && ["COUNTRIES", `${fmtN(S.countries.total || S.countries.most.length)} · most from ${S.countries.most[0].name}`],
    S.rewatches && ["REWATCHES", fmtN(S.rewatches)],
  ].filter(Boolean).slice(0, story ? 6 : 4);
  shareFacts(ctx, C, F, facts, story ? end + 120 : 1170, story ? 112 : 82);
  if (story && shareSite()) { ctx.fillStyle = C.muted; ctx.font = `500 22px ${F.mono}`; ctx.textAlign = "center"; ctx.fillText(shareSite(), C.w / 2, C.h - 92); ctx.textAlign = "left"; }
  return cv;
}

// You and a friend: the taste match, what you share, what you both loved, where you part most.
async function drawMatch(lib, id, withPosters, size) {
  const profiles = comparePeople().map((p) => tasteProfile(p, metaOf)), A = profiles[0], B = profiles.find((p) => p.id === id);
  if (!B) throw new Error("no friend");
  const X = comparePair(A, B, metaOf), C = { ...SHARE, h: SHARE_SIZES[size].h }, F = SHARE_FONTS, story = size === "story", M = 72, dy = story ? 140 : 0;
  const cv = Object.assign(document.createElement("canvas"), { width: C.w, height: C.h }), ctx = cv.getContext("2d");
  const me = state.mode === "example" ? "YOU" : lib.profile.username ? `@${lib.profile.username.toUpperCase()}` : "YOU";
  shareFrame(ctx, C, F, "TASTE MATCH");
  ctx.fillStyle = C.ink; ctx.font = `800 80px ${F.display}`;
  wrapText(ctx, `${me} & @${String(B.name).toUpperCase()}`, C.w - 2 * M, 2).forEach((l, i) => ctx.fillText(l, M, 220 + dy + i * 78));
  // the score
  const sc = X.match.score;
  ctx.fillStyle = C.goldInk; ctx.font = `800 300px ${F.display}`;
  const scoreText = sc != null ? String(sc) : "—";
  ctx.fillText(scoreText, M - 8, 560 + dy);
  const sw = ctx.measureText(scoreText).width;
  ctx.fillStyle = C.muted; ctx.font = `800 80px ${F.display}`; ctx.fillText("/100", M + sw + 6, 560 + dy);
  ctx.fillStyle = C.ink; ctx.font = `800 64px ${F.display}`;
  ctx.fillText(fitText(ctx, (sc != null ? matchWords(sc) : "Not enough films rated by both yet").toUpperCase(), C.w - 2 * M), M, 650 + dy);
  // the numbers
  const nums = [["FILMS IN COMMON", fmtN(X.shared.length)], ["WITHIN ½★", sc != null ? `${X.match.within}%` : "—"], ["APART, ON AVERAGE", sc != null ? `${X.match.mad.toFixed(1)}★` : "—"]];
  const colW = (C.w - 2 * M) / 3;
  ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, 700 + dy); ctx.lineTo(C.w - M, 700 + dy); ctx.stroke();
  nums.forEach(([k, v], i) => {
    const x = M + i * colW;
    ctx.fillStyle = C.ink; ctx.font = `800 72px ${F.display}`; ctx.fillText(fitText(ctx, v, colW - 16), x, 786 + dy);
    ctx.fillStyle = C.muted; ctx.font = `500 18px ${F.mono}`; ctx.letterSpacing = "2px"; ctx.fillText(k, x, 820 + dy); ctx.letterSpacing = "0px";
  });
  ctx.beginPath(); ctx.moveTo(M, 852 + dy); ctx.lineTo(C.w - M, 852 + dy); ctx.stroke();
  // what you both loved, or failing that what you both saw
  const loved = X.bothLoved.slice(0, 4), items = loved.length ? loved : [...X.pairs].sort((a, b) => (b.a + b.b) - (a.a + a.b)).slice(0, 4);
  ctx.fillStyle = C.goldInk; ctx.font = `500 20px ${F.mono}`; ctx.letterSpacing = "4px"; ctx.fillText(loved.length ? "YOU BOTH LOVED" : "YOU BOTH RATED", M, 900 + dy); ctx.letterSpacing = "0px";
  const end = await sharePosters(ctx, C, F, items, 922 + dy, withPosters, (x, px, y) => {
    ctx.font = `600 20px ${F.sans}`; ctx.fillStyle = C.muted; ctx.fillText("YOU", px, y + 34); ctx.fillStyle = C.goldInk; ctx.fillText(stars(x.a), px + 52, y + 34);
    ctx.fillStyle = C.muted; ctx.fillText("THEM", px, y + 62); ctx.fillStyle = C.goldInk; ctx.fillText(stars(x.b), px + 52, y + 62);
  });
  // where you part most
  const odds = [...X.aHigher, ...X.bHigher].sort((a, b) => Math.abs(b.a - b.b) - Math.abs(a.a - a.b))[0];
  const facts = [
    odds && ["MOST AT ODDS", `${odds.f.name}: you ${stars(odds.a)}, them ${stars(odds.b)}`],
    X.forA[0] && ["THEY'D TELL YOU TO WATCH", `${X.forA[0].f.name}${X.forA[0].f.year ? ` (${X.forA[0].f.year})` : ""}`],
    X.forB[0] && ["YOU'D TELL THEM TO WATCH", `${X.forB[0].f.name}${X.forB[0].f.year ? ` (${X.forB[0].f.year})` : ""}`],
  ].filter(Boolean);
  const fy = story ? end + 150 : 1335 - 82 * Math.ceil(facts.slice(0, 2).length / 2) - 40;
  facts.slice(0, story ? 3 : 1).forEach(([k, v], i) => {
    const y = fy + i * 104;
    ctx.fillStyle = C.muted; ctx.font = `500 17px ${F.mono}`; ctx.letterSpacing = "2px"; ctx.fillText(k, M, y); ctx.letterSpacing = "0px";
    ctx.fillStyle = C.ink; ctx.font = `700 31px ${F.sans}`; ctx.fillText(fitText(ctx, v, C.w - 2 * M), M, y + 40);
  });
  if (shareSite()) { ctx.fillStyle = C.muted; ctx.font = `500 ${story ? 22 : 17}px ${F.mono}`; ctx.textAlign = story ? "center" : "right"; ctx.fillText(shareSite(), story ? C.w / 2 : C.w - M, story ? C.h - 92 : 900 + dy); ctx.textAlign = "left"; }
  return cv;
}

// Draws a picture (posters if their server allows it) and keeps it for this spec, shape and data.
async function makeShareImage(spec, size = SHARE_SIZE) {
  const lib = shareLib();
  const ck = `${state.mode}|${spec}|${size}|${Object.keys(META).length}|${DATA_REV}`;
  if (shareCache.has(ck)) return shareCache.get(ck);
  await shareFonts();
  const toBlob = (cv) => new Promise((resolve, reject) => { try { cv.toBlob((b) => b ? resolve(b) : reject(new Error("no image")), "image/png"); } catch (e) { reject(e); } });
  const draw = (withPosters) => spec.startsWith("match:") ? drawMatch(lib, spec.slice(6), withPosters, size) : drawYear(lib, spec, withPosters, size);
  let blob;
  try { blob = await toBlob(await draw(true)); } catch { blob = await toBlob(await draw(false)); } // posters that can't be copied leave title cards
  const slug = spec.startsWith("match:") ? "taste-match" : spec === "all" ? "all-time" : spec;
  const out = { blob, url: URL.createObjectURL(blob), name: `credits-roll-${slug}${size === "story" ? "-story" : ""}.png` };
  shareCache.set(ck, out);
  return out;
}
const shareAlt = (spec) => spec.startsWith("match:") ? "Your taste match: the score, films in common, what you both loved" : `${spec === "all" ? "All time" : spec} in film: films, hours, highest-rated films and the headlines`;
function fillShare(root) {
  for (const el of (root || document).querySelectorAll(".share[data-share]:not([data-busy])")) {
    el.dataset.busy = "1";
    const spec = el.dataset.share, size = SHARE_SIZE;
    makeShareImage(spec, size).then((img) => {
      if (!el.isConnected || size !== SHARE_SIZE) return;
      const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([img.blob], img.name, { type: "image/png" })] }));
      el.innerHTML = `<img class="share-img${size === "story" ? " story" : ""}" src="${img.url}" alt="${esc(shareAlt(spec))}">
        <div class="share-row">${canShare ? `<button class="btn small primary green" type="button" data-sharego="${esc(spec)}">Share</button>` : ""}
        <a class="btn small${canShare ? "" : " primary green"}" href="${img.url}" download="${img.name}">Download the image</a></div>
        <p class="dr-s">${IN_VIEWER ? "If the download doesn't start here, right-click or long-press the picture to save it." : SHARE_SIZES[size].note}</p>`;
    }).catch(() => { if (el.isConnected) el.innerHTML = `<p class="dr-s">Couldn't draw the image in this browser.</p>`; });
  }
}
async function shareGo(spec) {
  const img = await makeShareImage(spec);
  try { await navigator.share({ files: [new File([img.blob], img.name, { type: "image/png" })], title: spec.startsWith("match:") ? "Our taste match" : `${spec === "all" ? "All time" : spec} in film` }); } catch {}
}
// The shape: a feed post or a story, redrawn in place.
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-sharesize]");
  if (!b) return;
  SHARE_SIZE = b.dataset.sharesize;
  const box = b.closest(".share-size").parentElement;
  for (const x of box.querySelectorAll("[data-sharesize]")) x.setAttribute("aria-pressed", String(x.dataset.sharesize === SHARE_SIZE));
  for (const el of box.querySelectorAll(".share[data-share]")) { delete el.dataset.busy; el.innerHTML = `<p class="dr-s">Drawing…</p>`; }
  fillShare(box);
});
</script>
