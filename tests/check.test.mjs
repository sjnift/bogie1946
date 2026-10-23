// The film data check: each film's release year, countries and language on Letterboxd, TMDB and IMDb, with
// every mismatch listed (and copied as text), on both layouts.
import { open, seed, assert, noErrors } from "./lib.mjs";

const film = (y, k, l, iy, ik, il) => ({ src: "tmdb", v: 5, id: Math.floor(Math.random() * 1e6), im: "tt1", om: "2026-10-23", d: ["Someone"], c: [], w: [], p: [], m: [], g: ["Drama"], k, l, r: 100, y, iy, ik, il });
const rows = { profile: [{ Username: "tester" }], diary: [], ratings: [],
  watched: ["The Ear|1970", "Brick|2005", "Twilight's Last Gleaming|1977", "The Man Who Laughs|1928", "Heat|1995", "Vera Drake|2004", "Amélie|2001", "Somewhere|1990", "Unknown|2001"]
    .map((x) => ({ Name: x.split("|")[0], Year: x.split("|")[1] })) };
const meta = {
  "the ear|1970": film(1990, ["Czechoslovakia"], "Czech", 1970, ["Czechoslovakia"], ["Czech"]),
  "brick|2005": film(2006, ["USA"], "English", 2005, ["USA"], ["English"]),
  "twilight's last gleaming|1977": film(1977, ["USA"], "English", 1977, ["USA", "Germany"], ["English"]),
  "the man who laughs|1928": film(1928, ["USA"], "English", 1928, ["USA"], ["None"]),
  "heat|1995": film(1995, ["USA"], "English", 1995, ["USA"], ["English", "Spanish"]),
  "vera drake|2004": film(2004, ["UK", "France"], "English", 2004, ["UK", "France"], ["English"]),
  "amélie|2001": film(2001, ["France", "Germany"], "French", 2001, ["France", "Germany"], ["English", "French"]),
  "somewhere|1990": film(1990, ["UK"], "English", 1990, ["France"], ["English"]),
  "unknown|2001": { ...film(2001, ["USA"], "English"), om: null, iy: undefined, ik: undefined, il: undefined },
};

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    await seed(p, rows, { "cr-meta-v1": meta });
    const C = await p.evaluate(() => { const C = dataCheck(MY_LIB); return Object.fromEntries(C.groups.map((g) => [g.k, g.items.map((x) => x.name).join()]).concat([["noImdb", C.noImdb], ["films", C.films]])); });
    const want = { year: "The Ear (1970),Brick (2005)", country: "Somewhere (1990)", lang: "The Man Who Laughs (1928)", countryPart: "Twilight's Last Gleaming (1977)", langPart: "Amélie (2001)", noImdb: 1, films: 9 };
    for (const [k, v] of Object.entries(want)) assert(C[k] === v, `${file} ${k}: ${C[k]} (wanted ${v})`);
    const text = await p.evaluate(() => dataCheckText(MY_LIB));
    assert(/- The Ear \(1970\): Letterboxd 1970 · TMDB 1990 · IMDb 1970/.test(text) && /IMDb details are still to come for 1 film/.test(text), `${file} text: ${text}`);

    // the list opens from the lookup box (Settings on a phone)
    if (phone) { await p.click('[data-act="settings"]'); await p.waitForTimeout(100); }
    await p.click('button:has-text("Show the mismatches")'); await p.waitForTimeout(150);
    const panel = phone ? "#sheet" : "#dlg";
    const opened = await p.$eval(panel, (d) => [d.open, d.querySelector("h2, h3").textContent, d.querySelectorAll(".drill-row").length]);
    assert(opened[0] && /Film data check/.test(opened[1]) && opened[2] >= 6, `${file} list: ${opened}`);
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    await p.click("[data-copycheck]"); await p.waitForTimeout(150);
    assert(/Copied|Select all/.test(await p.$eval("[data-copycheck]", (b) => b.textContent)), `${file}: copy button didn't answer`);
    noErrors(p, file);
  }
}
