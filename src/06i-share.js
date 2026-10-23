<script>
/* ---------- a year in film, as a picture to share ----------
   Drawn on a canvas at 1080 × 1350 (the shape Instagram and most feeds show whole), in the desktop page's
   colours: the year, the numbers, the four best-rated films with posters, and the year's headlines. */
const SHARE = { w: 1080, h: 1350, bg: "#141017", band: "#0C090E", hole: "#2B2331", surface: "#221B28", line: "#3A3042",
  ink: "#F3EEF4", ink2: "#C2B8C6", muted: "#8E8394", gold: "#BE8722", goldInk: "#E6B65A" };
const SHARE_FONTS = { display: '"Big Shoulders Display", "Arial Narrow", sans-serif', mono: '"IBM Plex Mono", ui-monospace, monospace', sans: '"Schibsted Grotesk", system-ui, sans-serif' };
const shareCache = new Map();
// older Safari has no rounded rectangles on a canvas; square corners will do there
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
D.share = (Y) => ({ kind: "share", year: Y, title: `${Y} in film`, sub: "A picture of your year to share" });
const shareBodyHtml = (d) => `<div class="share" data-share="${esc(d.year)}"><p class="dr-s">Drawing your year…</p></div>`;

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

async function drawYear(lib, Y, withPosters) {
  const R = computeYearInsights(lib, metaOf, Y, state.crowd || defaultCrowd(lib, metaOf)), S = R.S, C = SHARE, F = SHARE_FONTS;
  const cv = Object.assign(document.createElement("canvas"), { width: C.w, height: C.h }), ctx = cv.getContext("2d");
  const M = 72;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, C.w, C.h);
  // sprocket bands top and bottom, as on the page
  for (const y0 of [0, C.h - 44]) {
    ctx.fillStyle = C.band; ctx.fillRect(0, y0, C.w, 44);
    ctx.fillStyle = C.hole;
    for (let x = 18; x < C.w; x += 54) { ctx.beginPath(); ctx.roundRect(x, y0 + 14, 30, 16, 4); ctx.fill(); }
  }
  ctx.textBaseline = "alphabetic";
  // wordmark and member
  ctx.fillStyle = C.goldInk; ctx.font = `500 22px ${F.mono}`; ctx.letterSpacing = "6px";
  ctx.fillText("CREDITS ROLL", M, 108);
  ctx.textAlign = "right"; ctx.fillStyle = C.muted;
  const who = state.mode === "example" ? "EXAMPLE DIARY" : lib.profile.username ? `@${lib.profile.username.toUpperCase()}` : "";
  ctx.fillText(who, C.w - M, 108);
  ctx.textAlign = "left"; ctx.letterSpacing = "0px";
  // the year
  ctx.fillStyle = C.goldInk; ctx.font = `800 290px ${F.display}`;
  ctx.fillText(Y, M - 8, 385);
  ctx.fillStyle = C.ink; ctx.font = `800 86px ${F.display}`;
  ctx.fillText("IN FILM", M, 470);
  // the numbers
  const hours = S.timed ? fmtN(Math.round(S.minutes / 60)) : "—";
  const avgR = R.cur && R.cur.avgRating ? R.cur.avgRating : S.avgRating;
  const nums = [["FILMS", fmtN(S.films.length)], ["HOURS", hours], ["AVERAGE", avgR ? `${avgR.toFixed(1)}★` : "—"], ["DIARY ENTRIES", fmtN(S.entries.length)]];
  const colW = (C.w - 2 * M) / 4;
  ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, 520); ctx.lineTo(C.w - M, 520); ctx.stroke();
  nums.forEach(([k, v], i) => {
    const x = M + i * colW;
    ctx.fillStyle = C.ink; ctx.font = `800 78px ${F.display}`; ctx.fillText(fitText(ctx, v, colW - 16), x, 610);
    ctx.fillStyle = C.muted; ctx.font = `500 19px ${F.mono}`; ctx.letterSpacing = "2px"; ctx.fillText(k, x, 646); ctx.letterSpacing = "0px";
  });
  ctx.beginPath(); ctx.moveTo(M, 680); ctx.lineTo(C.w - M, 680); ctx.stroke();
  // the four best-rated films
  ctx.fillStyle = C.goldInk; ctx.font = `500 20px ${F.mono}`; ctx.letterSpacing = "4px"; ctx.fillText("HIGHEST RATED", M, 730); ctx.letterSpacing = "0px";
  // where it came from
  if (SITE_REPO) { ctx.fillStyle = C.muted; ctx.font = `500 17px ${F.mono}`; ctx.textAlign = "right"; ctx.fillText(location.host + location.pathname.replace(/[^/]*$/, ""), C.w - M, 730); ctx.textAlign = "left"; }
  const best = R.best.slice(0, 4), pw = 216, ph = 324, gap = (C.w - 2 * M - 4 * pw) / 3;
  const imgs = await Promise.all(best.map((x) => { const m = metaOf(x.f); return withPosters && showImages && m && imagePath(m.poster) ? loadImg(`https://image.tmdb.org/t/p/w342${m.poster}`) : null; }));
  best.forEach((x, i) => {
    const px = M + i * (pw + gap), py = 752;
    ctx.save(); ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.clip();
    ctx.fillStyle = C.surface; ctx.fillRect(px, py, pw, ph);
    if (imgs[i]) ctx.drawImage(imgs[i], px, py, pw, ph);
    else {
      ctx.fillStyle = C.ink; ctx.font = `800 34px ${F.display}`;
      wrapText(ctx, x.f.name.toUpperCase(), pw - 32, 5).forEach((l, j) => ctx.fillText(l, px + 16, py + 54 + j * 36));
      ctx.fillStyle = C.muted; ctx.font = `500 18px ${F.mono}`; ctx.fillText(String(x.f.year || ""), px + 16, py + ph - 20);
    }
    ctx.restore();
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.stroke();
    ctx.fillStyle = C.goldInk; ctx.font = `700 26px ${F.sans}`; ctx.fillText(stars(x.r), px, py + ph + 38);
  });
  if (!best.length) { ctx.fillStyle = C.muted; ctx.font = `500 26px ${F.sans}`; ctx.fillText("No rated films this year.", M, 800); }
  // the year's headlines
  const dir = S.directors.most[0], star = S.cast.most[0], top = R.cur && R.cur.topGenre, bm = S.busiestMonth;
  const facts = [
    dir && dir.count > 1 && ["DIRECTOR OF THE YEAR", `${dir.name} · ${dir.count}`],
    star && star.count > 1 && ["MOST SEEN ACTOR", `${star.name} · ${star.count}`],
    top && R.cur.withMeta && ["TOP GENRE", `${top[0]} · ${pctOf(top[1], R.cur.withMeta)}%`],
    bm && ["BUSIEST MONTH", `${MONTHS_LONG[+bm.key.slice(5, 7) - 1]} · ${plural(bm.count, "film")}`],
    S.streak.days > 1 && ["LONGEST STREAK", `${S.streak.days} days in a row`],
    S.rewatches && ["REWATCHES", fmtN(S.rewatches)],
  ].filter(Boolean).slice(0, 4);
  const fw = (C.w - 2 * M - 40) / 2;
  facts.forEach(([k, v], i) => {
    const x = M + (i % 2) * (fw + 40), y = 1170 + Math.floor(i / 2) * 82;
    ctx.fillStyle = C.muted; ctx.font = `500 17px ${F.mono}`; ctx.letterSpacing = "2px"; ctx.fillText(k, x, y); ctx.letterSpacing = "0px";
    ctx.fillStyle = C.ink; ctx.font = `700 31px ${F.sans}`; ctx.fillText(fitText(ctx, v, fw), x, y + 38);
  });
  return cv;
}
// Draws the year (posters if their server allows it) and shows it with ways to keep it.
async function makeShareImage(lib, Y) {
  const ck = `${state.mode}|${Y}|${Object.keys(META).length}`;
  if (shareCache.has(ck)) return shareCache.get(ck);
  await shareFonts();
  const toBlob = (cv) => new Promise((resolve, reject) => { try { cv.toBlob((b) => b ? resolve(b) : reject(new Error("no image")), "image/png"); } catch (e) { reject(e); } });
  let blob;
  try { blob = await toBlob(await drawYear(lib, Y, true)); } catch { blob = await toBlob(await drawYear(lib, Y, false)); } // posters that can't be copied leave title cards
  const out = { blob, url: URL.createObjectURL(blob), name: `credits-roll-${Y}.png` };
  shareCache.set(ck, out);
  return out;
}
function fillShare(root) {
  for (const el of (root || document).querySelectorAll(".share[data-share]:not([data-busy])")) {
    el.dataset.busy = "1";
    const Y = el.dataset.share;
    makeShareImage(state.lib, Y).then((img) => {
      if (!el.isConnected) return;
      const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([img.blob], img.name, { type: "image/png" })] }));
      el.innerHTML = `<img class="share-img" src="${img.url}" alt="${esc(Y)} in film: films, hours, highest-rated films and the year's headlines">
        <div class="share-row">${canShare ? `<button class="btn small primary green" type="button" data-sharego="${esc(Y)}">Share</button>` : ""}
        <a class="btn small${canShare ? "" : " primary green"}" href="${img.url}" download="${img.name}">Download the image</a></div>
        <p class="dr-s">${IN_VIEWER ? "If the download doesn't start here, right-click or long-press the picture to save it." : "1080 × 1350 pixels, the size most feeds show whole."}</p>`;
    }).catch(() => { if (el.isConnected) el.innerHTML = `<p class="dr-s">Couldn't draw the image in this browser.</p>`; });
  }
}
async function shareGo(Y) {
  const img = await makeShareImage(state.lib, Y);
  try { await navigator.share({ files: [new File([img.blob], img.name, { type: "image/png" })], title: `${Y} in film` }); } catch {}
}
</script>
