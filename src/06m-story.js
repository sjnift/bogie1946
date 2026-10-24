<script>
/* ---------- a year (or all time) as a story: cards one after another, a tap (or →) to go on, ← or a tap on the
   left to go back. It opens in the pop-up (computer) or the sheet (phone) like any list, so Back and Close work.
   Always the whole diary, whatever filters the page has on. */
D.story = (Y) => ({ kind: "story", year: Y, title: Y === "all" ? "All time in film" : `${Y} in film`, sub: "Tap or press → to go on" });
let STORY_STUDY = null;
// The study's headline findings for the story, worked out once per diary (it can take a moment on a big one).
function storyFindings(lib, Y) {
  const crowd = state.crowd || defaultCrowd(lib, metaOf), sig = `${DATA_REV}|${crowd}|${Object.keys(META).length}`;
  if (!STORY_STUDY || STORY_STUDY.lib !== lib || STORY_STUDY.sig !== sig) STORY_STUDY = { lib, sig, all: null, years: new Map() };
  if (!STORY_STUDY.all) STORY_STUDY.all = computeStudy(lib, metaOf, crowd);
  if (Y === "all") return STORY_STUDY.all.overview || [];
  if (!STORY_STUDY.years.has(Y)) STORY_STUDY.years.set(Y, computeYearStudy(lib, metaOf, crowd, Y, STORY_STUDY.all));
  return STORY_STUDY.years.get(Y).overview || [];
}
function storyBodyHtml(d) {
  const lib = shareLib(), Y = d.year, all = Y === "all", when = all ? "All time" : Y;
  const { S, best, top } = shareData(lib, Y);
  const who = state.mode === "example" ? "Example diary" : lib.profile.username ? `@${lib.profile.username}` : "Your diary";
  const art = (f) => { const m = metaOf(f); return `<span class="st-art"><span class="st-ph">${esc(f.name)}</span>${showImages && m && m.poster ? `<img src="${IMG}${esc(m.poster)}" alt="" loading="lazy">` : ""}</span>`; };
  const cards = [];
  cards.push(`<p class="st-k">${esc(who)}</p><h3 class="st-big">${esc(when)}<span>in film</span></h3>
    <div class="st-nums"><div><b>${fmtN(S.films.length)}</b><span>films</span></div><div><b>${S.timed ? fmtN(Math.round(S.minutes / 60)) : "—"}</b><span>hours</span></div><div><b>${fmtN(S.entries.length)}</b><span>diary entries</span></div></div>`);
  if (best.length) cards.push(`<p class="st-k">Your highest rated</p><div class="st-posters">${best.slice(0, 4).map((x) => `<figure>${art(x.f)}<figcaption><span class="st-t">${esc(x.f.name)}</span><span class="stars">${stars(x.r)}</span></figcaption></figure>`).join("")}</div>`);
  const person = (label, p) => p && p.count > 1 ? `<p class="st-k">${label}</p><h3 class="st-name">${esc(p.name)}</h3><p class="st-p">${plural(p.count, "film")}${p.avg ? `, ${p.avg.toFixed(1)}★ on average` : ""}</p>
    <div class="st-posters three">${p.films.slice(0, 3).map((f) => `<figure>${art(f)}</figure>`).join("")}</div>` : "";
  const dir = person(all ? "The director you watch most" : "Director of the year", S.directors.most[0]);
  if (dir) cards.push(dir);
  const face = person(all ? "The face you see most" : "The face of the year", S.cast.most[0]);
  if (face) cards.push(face);
  const withMeta = S.films.filter((f) => metaOf(f)).length;
  if (withMeta && S.genres.most.length) {
    const gs = S.genres.most.slice(0, 5), mx = gs[0].count;
    cards.push(`<p class="st-k">What you watched</p><h3 class="st-name">${esc(top ? top[0] : gs[0].name)}</h3><p class="st-p">${top ? `${top[1]}% of your films` : ""}</p>
      <div class="st-bars-list">${gs.map((g) => `<div class="st-row"><span>${esc(g.name)}</span><i><b style="width:${(g.count / mx * 100).toFixed(1)}%"></b></i><span class="num">${pctOf(g.count, withMeta)}%</span></div>`).join("")}</div>`);
  }
  const bm = S.busiestMonth, fav = S.weekday.indexOf(Math.max(...S.weekday));
  if (S.entries.length) cards.push(`<p class="st-k">When you watched</p>
    <div class="st-facts">${bm ? `<div><span>Busiest month</span><b>${MONTHS_LONG[+bm.key.slice(5, 7) - 1]}${all ? ` ${bm.key.slice(0, 4)}` : ""}</b><small>${plural(bm.count, "film")}</small></div>` : ""}
      <div><span>Favourite day</span><b>${WEEKDAYS_LONG[fav]}</b><small>${plural(S.weekday[fav], "film")}</small></div>
      ${S.streak.days > 1 ? `<div><span>Longest streak</span><b>${S.streak.days} days</b><small>in a row</small></div>` : ""}
      ${S.rewatches ? `<div><span>Rewatches</span><b>${fmtN(S.rewatches)}</b><small>films seen again</small></div>` : ""}</div>`);
  cards.push(`<p class="st-k">What stood out</p><div class="st-find" data-storyfind="${esc(Y)}"><p class="st-p">Working it out…</p></div>`);
  cards.push(`<p class="st-k">That's ${esc(all ? "your diary" : Y)}</p><h3 class="st-name">Share it</h3><p class="st-p">As a picture for a feed post or a story.</p>
    <button class="btn primary green st-go" type="button" ${dl(D.share(Y))}>Make the picture</button>`);
  return `<div class="story" tabindex="-1"><div class="st-bars" aria-hidden="true">${cards.map((_, i) => `<i${i ? "" : ' class="done"'}></i>`).join("")}</div>
    ${cards.map((c, i) => `<section class="st-card${i ? "" : " on"}" aria-label="${i + 1} of ${cards.length}">${c}</section>`).join("")}
    <div class="st-nav"><button class="btn small" type="button" data-story-step="-1">Back</button><span class="st-pos" aria-live="polite">1 of ${cards.length}</span><button class="btn small" type="button" data-story-step="1">Next</button></div></div>`;
}
// Fills in the findings card once the story is on screen (the study can take a moment).
function fillStory(root) {
  for (const el of (root || document).querySelectorAll("[data-storyfind]:not([data-busy])")) {
    el.dataset.busy = "1";
    setTimeout(() => {
      if (!el.isConnected) return;
      let list = [];
      try { list = storyFindings(shareLib(), el.dataset.storyfind).slice(0, 2); } catch {}
      el.innerHTML = list.length ? list.map((f) => `<div class="st-f"><span class="st-fk">${esc(f.k || "")}</span><b>${esc(f.big || "")}</b><p>${esc(f.text || "")}</p></div>`).join("")
        : `<p class="st-p">Nothing stood out clearly enough to say. Insights says more as your diary grows.</p>`;
    }, 60);
  }
}
function storyStep(st, by) {
  const cards = [...st.querySelectorAll(".st-card")];
  let i = cards.findIndex((c) => c.classList.contains("on"));
  i = Math.max(0, Math.min(cards.length - 1, i + by));
  cards.forEach((c, j) => c.classList.toggle("on", j === i));
  st.querySelectorAll(".st-bars i").forEach((b, j) => b.classList.toggle("done", j <= i));
  const pos = st.querySelector(".st-pos");
  if (pos) pos.textContent = `${i + 1} of ${cards.length}`;
}
document.addEventListener("click", (e) => {
  const st = e.target.closest && e.target.closest(".story");
  if (!st) return;
  const b = e.target.closest("[data-story-step]");
  if (b) { storyStep(st, +b.dataset.storyStep); return; }
  if (e.target.closest("button, a, [data-list]")) return;
  const r = st.getBoundingClientRect();
  storyStep(st, e.clientX - r.left < r.width * 0.3 ? -1 : 1);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const st = [...document.querySelectorAll(".story")].filter((x) => x.offsetParent).pop();
  if (!st || (e.target.matches && e.target.matches("input, textarea, select"))) return;
  e.preventDefault();
  storyStep(st, e.key === "ArrowRight" ? 1 : -1);
});
</script>
