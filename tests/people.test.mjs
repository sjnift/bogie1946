// People are TMDB's people, by id: two actors who share a name (Paul Guilfoyle, 1902–1961, and Paul Guilfoyle, born
// 1949: the owner found the younger one credited with 1940s films, 26 Oct 2026) are counted, shown, pictured and looked
// up apart, labelled by TMDB's dates (or their films' years until those come); a credit TMDB's dates make impossible
// isn't counted; the people check says so on both layouts.
import { open, seed, assert, noErrors } from "./lib.mjs";

const meta = (id, y, c, ci, d = ["A Director"], di = [900], more = {}) => ({ src: "tmdb", v: 13, id, y, d, di, c, ci, w: [], p: [], m: [], g: ["Crime"], k: ["USA"], l: "English", r: 90, ...more });
// a star at the top of four films, then far down a big cast (a cameo), and far down another as a named extended cameo
const crowd = (n, id) => Array.from({ length: n }, (_, i) => `Extra Player ${id}-${i}`), crowdIds = (n, base) => Array.from({ length: n }, (_, i) => base + i);
const pad = (i) => String(i).padStart(2, "0"), ensemble = (name, base) => [Array.from({ length: 32 }, (_, i) => (i === 20 ? "Ensemble A20" : name(i))), Array.from({ length: 32 }, (_, i) => (i === 20 ? 70 : base + i))];
const walkOn = (id, y, more) => meta(id, y, [...crowd(25, id), "Big Star", ...crowd(5, id).map((x) => x + "b")], [...crowdIds(25, id * 1000), 50, ...crowdIds(5, id * 1000 + 500)], undefined, undefined, more);
const films = [
  ["Old Noir", 1946, meta(1, 1946, ["Paul Guilfoyle", "Lead A"], [104714, 1])],
  ["Another Noir", 1948, meta(2, 1948, ["Paul Guilfoyle"], [104714])],
  ["Modern One", 1987, meta(3, 1987, ["Paul Guilfoyle", "Lead B"], [925, 2])],
  ["Later One", 1999, meta(4, 1999, ["Paul Guilfoyle"], [925])],
  ["Too Early", 1946, meta(5, 1946, ["Young Star"], [3])],
  ["Right Time", 1995, meta(6, 1995, ["Young Star"], [3])],
  // one person TMDB keeps twice (one IMDb id), under two spellings: one person
  ["Twice Kept", 2001, meta(7, 2001, ["Lu Qi"], [31])], ["Kept Again", 2003, meta(8, 2003, ["Lü Qi"], [32])], ["Third Time", 2005, meta(9, 2005, ["Lü Qi"], [32])],
  ...[10, 11, 12, 13].map((id) => [`Star Vehicle ${id}`, 2016 + id, meta(id, 2016 + id, ["Big Star", "Co Star"], [50, 51])]),
  ["Team Up", 2030, walkOn(14, 2030)], ["Team Up Again", 2031, walkOn(15, 2031, { ce: [50] })],
  // a small role credited long after the person died (TMDB's wrong person of that name); a lead released long after
  ["Ghost Lead", 1980, meta(17, 1980, ["Old Ghost", "Someone A"], [60, 61])], ["Ghost Bit", 2003, meta(18, 2003, ["Lead X", "Lead Y", "Lead Z", "Old Ghost"], [62, 63, 64, 60])],
  // a cartoon's voices: apart from on-screen acting
  ["A Cartoon", 2012, meta(16, 2012, [], [], undefined, undefined, { vo: ["Big Star", "Voice Pro"], voi: [50, 52] })],
  // small parts: a star billed 17th of 34 among people far less known (TMDB's popularity, `so`) is a walk-on; the lower
  // half of a big cast doesn't count, nor a bit part below the top 8 (`un`), but one in the top 8 does
  ["Stand Out", 2030, meta(19, 2030, [...crowd(16, 19), "Big Star", ...crowd(17, 19).map((x) => x + "c")], [...crowdIds(16, 19000), 50, ...crowdIds(17, 19500)], undefined, undefined, { so: [50], un: [19003, 19010] })],
  // the same player 21st of 32 in a cast billed alphabetically (counts) and in one that isn't (doesn't)
  ["In Order", 2010, meta(20, 2010, ...ensemble((i) => `Pat A${pad(i)}`, 20000))], ["Not In Order", 2011, meta(21, 2011, ...ensemble((i) => `Lee Z${pad(31 - i)}`, 21000))],
  // a documentary: a star interviewed 33rd of 40 counts, as does everyone it lists (no order of size there)
  ["Star Doc", 2028, meta(25, 2028, [...crowd(32, 25), "Big Star", ...crowd(7, 25).map((x) => x + "d")], [...crowdIds(32, 25000), 50, ...crowdIds(7, 25500)], undefined, undefined, { g: ["Documentary"] })],
  // a series (TMDB's collection): its first film's lead back 11th in the second (a walk-on), 10th in the third (counts)
  // a real part reviewed by hand (05b-parts, PART_FIXES: TMDB's Se7en, 807, and Kevin Spacey, 1979), billed 39th of 40
  ["Se7en", 1995, meta(807, 1995, [...crowd(38, 807), "Kevin Spacey", "Last Player"], [...crowdIds(38, 807000), 1979, 807999])],
  ...[[22, 2000, 0], [23, 2002, 10], [24, 2004, 9]].map(([id, y, at]) => [`Series Part ${id - 21}`, y, meta(id, y, crowd(12, id).map((x, i) => (i === at ? "Series Hero" : x)), crowdIds(12, id * 1000).map((x, i) => (i === at ? 80 : x)), undefined, undefined, { cl: 900 })]),
];
const persons = { 104714: { birthday: "1902-07-14", deathday: "1961-06-27", imdb_id: "nm0002116", profile_path: "/old.jpg" },
  925: { birthday: "1949-04-28", deathday: null, imdb_id: "nm0002117", profile_path: "/new.jpg" }, 3: { birthday: "1970-01-01", imdb_id: "nm0000003" },
  31: { birthday: "1925-01-01", imdb_id: "nm0000031" }, 32: { birthday: "1925-01-01", imdb_id: "nm0000031" },
  60: { birthday: "1910-01-01", deathday: "1975-06-01", imdb_id: "nm0000060" } };
const rows = { profile: [{ Username: "tester" }], watched: films.map(([n, y]) => ({ Name: n, Year: String(y) })), ratings: [], diary: films.map(([n, y], i) => ({ Name: n, Year: String(y), "Watched Date": `2024-0${i + 1}-02`, Rating: "4" })) };
const metas = Object.fromEntries(films.map(([n, y, m]) => [`${n.toLowerCase()}|${y}`, m]));

async function standIn(p, asked) {
  await p.context().route(/api\.themoviedb\.org/, (r) => {
    const u = new URL(r.request().url()), json = (o, status = 200) => r.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
    const m = u.pathname.match(/^\/3\/person\/(\d+)$/);
    if (m) { asked.push(+m[1]); return persons[m[1]] ? json({ id: +m[1], ...persons[m[1]] }) : json({}, 404); }
    if (/\/3\/person\/\d+\/movie_credits/.test(u.pathname)) { asked.push(`credits ${u.pathname.split("/")[3]}`); return json({ cast: [], crew: [] }); }
    json({ results: [] });
  });
}
// On a film's card, "Change who counts": a bit player at the foot of the bill switched on and back off (back to the
// rules), then the reviewed part switched off. Each step: counted? and the choices kept with the film.
async function switchParts(page, openCard, within) {
  await page.evaluate(openCard);
  await page.click(`${within} .fc-who .linkish`);
  await page.waitForSelector(`${within} .ppanel`);
  const step = () => page.evaluate(() => { const m = META["se7en|1995"], c = castOf(m); return `${c.includes("Last Player") ? 1 : 0},${c.includes("Kevin Spacey") ? 1 : 0},${Object.values(m.po || {}).join("")}`; });
  const out = [await step()];
  for (const pid of [807999, 807999, 1979]) { await page.click(`${within} [data-part][data-pid="${pid}"]`); out.push(await step()); }
  return out.join("|");
}
const counted = (page) => page.evaluate(() => { const s = computeStats(MY_LIB, metaOf, "all"), of = (n) => (s.cast.most.find((x) => x.name === n) || {}).count || 0;
  const voice = (n) => (s.voice.most.find((x) => x.name === n) || {}).count || 0;
  return { old: of("Paul Guilfoyle (1902–1961)"), young: of("Paul Guilfoyle (born 1949)"), plain: of("Paul Guilfoyle"), star: of("Young Star"), twice: [of("Lu Qi"), of("Lü Qi")].join(),
    big: of("Big Star"), bigFilms: personDrill(MY_LIB, "Big Star", "c").films.map((f) => f.name).filter((n) => /Team/.test(n)).join(), bigVoice: voice("Big Star"), voicePro: [of("Voice Pro"), voice("Voice Pro")].join(),
    cameos: peopleCheck(MY_LIB).cameos.map((x) => `${x.name}: ${x.note}`).sort().join(" | "),
    small: (() => { const m = META["stand out|2030"], sp = smallPartsOf(m), counted = castOf(m);
      return [counted.includes("Extra Player 19-3"), counted.includes("Extra Player 19-10"), sp.find((x) => x.name === "Extra Player 19-10").why, sp.find((x) => x.name === "Extra Player 19-0c").why,
        counted.includes("Extra Player 19-15"), counted.includes("Extra Player 19-0c"), smallWhy(sp.find((x) => x.name === "Extra Player 19-0c"))].join(); })(),
    ensemble: [of("Ensemble A20"), personDrill(MY_LIB, "Ensemble A20", "c").films.map((f) => f.name).join()].join(),
    series: personDrill(MY_LIB, "Series Hero", "c").films.map((f) => f.name).sort().join(), doc: castOf(META["star doc|2028"]).length,
    spacey: [of("Kevin Spacey"), of("Last Player"), smallPartsOf(META["se7en|1995"]).some((x) => x.name === "Kevin Spacey")].join(),
    ghost: [of("Old Ghost"), personDrill(MY_LIB, "Old Ghost", "c").films.map((f) => f.name).join(), peopleCheck(MY_LIB).late.map((x) => x.name).join()].join(" / "),
    oldFilms: personDrill(MY_LIB, "Paul Guilfoyle (1902–1961)", "c").films.map((f) => f.name).sort().join(), photos: [PHOTOS["paul guilfoyle 1902 1961"], PHOTOS["paul guilfoyle born 1949"]].join() }; });

export default async function ({ browser, base }) {
  const p = await open(browser, base, "desktop.html"), asked = [];
  await standIn(p, asked);
  await seed(p, rows, { "cr-meta-v1": metas, "cr-tmdb-key": "k123" });
  // before TMDB's dates come, the two are told apart by their films' years
  const early = await p.evaluate(() => { const keep = FACTS; FACTS = {}; META_REV++; const l = [...peopleIndex().label.values()].sort(); FACTS = keep; META_REV++; return l.join(" | "); });
  assert(early === "Lu Qi (film of 2001) | Lü Qi (films 2003–2005) | Paul Guilfoyle (films 1946–1948) | Paul Guilfoyle (films 1987–1999)", `namesakes before their dates: ${early}`);
  await p.waitForFunction(() => !factsJob.running && FACTS[925] && FACTS[104714] && FACTS[3], null, { timeout: 8000 });
  const c = await counted(p);
  assert(c.old === 2 && c.young === 2 && c.plain === 0, `two people of one name counted apart: ${JSON.stringify(c)}`);
  assert(c.oldFilms === "Another Noir,Old Noir" && c.photos === "/old.jpg,/new.jpg", `each with their own films and face: ${JSON.stringify(c)}`);
  assert(c.star === 1, `a credit before the person was born isn't counted: ${c.star}`);
  assert(c.twice === "3,0", `one person TMDB keeps twice is counted once, under one name: ${c.twice}`);
  assert(c.big === 6 && c.bigFilms === "Team Up Again" && c.doc === 40, `a star far down a cast is a cameo, a named extended cameo isn't: ${c.big} ${c.bigFilms}`);
  assert(c.cameos === "Big Star in Stand Out (2030): Not counted: a star far down the cast | Big Star in Team Up (2030): Not counted: a star far down the cast | Series Hero in Series Part 2 (2002): Not counted: a lead earlier in the series, back in a small part", `the cameos are listed: ${c.cameos}`);
  assert(c.series === "Series Part 1,Series Part 3", `a lead back far down a later film of the series is a walk-on: ${c.series}`);
  assert(c.small === "true,false,bit,deep,true,false,billed 18th of 34", `small parts: ${c.small}`);
  assert(c.ensemble === "1,In Order", `a cast billed alphabetically counts in full: ${c.ensemble}`);
  assert(c.spacey === "1,0,false", `a part reviewed by hand counts, the rest of the bill still doesn't: ${c.spacey}`);
  assert(c.bigVoice === 1 && c.voicePro === "0,1", `voice roles counted apart: ${c.bigVoice} ${c.voicePro}`);
  assert(c.ghost === "1 / Ghost Lead / Old Ghost in Ghost Bit (2003)", `a small role long after a death isn't counted, a lead is: ${c.ghost}`);
  // only people in two or more films, or who share a name, have their dates asked for
  assert([...new Set(asked)].sort().join() === "104714,3,31,32,50,51,60,70,80,900,925", `asked TMDB for: ${asked}`);
  // the filmography of each is theirs, by TMDB's id, not the better known of the two
  await p.evaluate(() => filmography("Paul Guilfoyle (1902–1961)", "c"));
  assert(asked.includes("credits 104714") && !asked.includes("credits 925"), `filmography asked for: ${asked}`);
  // anyone can change who counts on a film's card: a switch the rules agree with goes back to them
  const switched = await switchParts(p, () => openDrill(D.film(MY_LIB.films.find((f) => f.name === "Se7en"))), "#dlg");
  assert(switched === "0,1,|1,1,1|0,1,|0,0,0", `who counts, changed on the card: ${switched}`);
  await p.keyboard.press("Escape");
  await p.click("#btn-settings");
  await p.waitForFunction(() => /people check/i.test($("#lookup").innerText), null, { timeout: 5000 });
  const box = (await p.innerText("#lookup")).replace(/\s+/g, " ");
  assert(/small parts in your films aren't counted either/.test(box) && /2 people in your diary share a name/.test(box) && /1 credit is impossible by TMDB's own dates/.test(box) && /Dates checked for \d+ of \d+ people/.test(box), `the people check: ${box.slice(box.search(/people check/i), box.search(/people check/i) + 600)}`);
  noErrors(p, "desktop");

  // the phone counts them apart too
  const m = await open(browser, base, "mobile.html", { phone: true });
  await standIn(m, []);
  await seed(m, rows, { "cr-meta-v1": metas, "cr-tmdb-key": "k123" });
  await m.waitForFunction(() => !factsJob.running && FACTS[925], null, { timeout: 8000 });
  const mc = await counted(m);
  assert(mc.old === 2 && mc.young === 2 && mc.plain === 0 && mc.star === 1 && mc.spacey === "1,0,false", `phone: ${JSON.stringify(mc)}`);
  const mswitched = await switchParts(m, () => openSheet(D.film(MY_LIB.films.find((f) => f.name === "Se7en"))), "#sheet");
  assert(mswitched === "0,1,|1,1,1|0,1,|0,0,0", `phone: who counts, changed on the card: ${mswitched}`);
  await m.evaluate(() => closeSheet());
  await m.click("#nav-right [data-act=\"settings\"]");
  await m.waitForFunction(() => /People check/i.test(document.body.innerText) && /2 people in your diary share a name/.test(document.body.innerText), null, { timeout: 5000 });
  noErrors(m, "phone");
  await p.close(); await m.close();
}
