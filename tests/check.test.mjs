// The film data check: each film's release year, countries and language on Letterboxd, TMDB and IMDb. What
// looks wrong comes first (a TMDB film dated years away, nothing in common, no match), then films corrected by
// hand, then differences that aren't errors; the list opens on both layouts and copies as text.
import { open, seed, assert, noErrors } from "./lib.mjs";

let next = 1;
const film = (y, k, l, iy, ik, il, more = {}) => ({ src: "tmdb", v: 13, id: next++, im: "tt1", om: "2026-10-23", d: ["Someone"], c: [], w: [], p: [], m: [], g: ["Drama"], k, l, r: 100, y, iy, ik, il, ...more });
const titles = ["The Ear|1970", "A Cop|1972", "Brick|2005", "Twilight's Last Gleaming|1977", "The Man Who Laughs|1928", "Heat|1995", "Amélie|2001",
  "Somewhere|1990", "Unknown|2001", "Nowhere|2000", "The Prowler|1951", "Spirited Away|2001"];
const rows = { profile: [{ Username: "tester" }], diary: [], ratings: [], watched: titles.map((x) => ({ Name: x.split("|")[0], Year: x.split("|")[1] })) };
const meta = {
  "the ear|1970": film(1990, ["Czechoslovakia"], "Czech", 1970, ["Czechoslovakia"], ["Czech"], { id: 88953 }), // checked by hand: the right film
  "a cop|1972": film(1947, ["USA"], "English", 1947, ["USA"], ["English"]), // a 1947 film for a 1972 one
  "brick|2005": film(2006, ["USA"], "English", 2005, ["USA"], ["English"]),
  "twilight's last gleaming|1977": film(1977, ["USA"], "English", 1977, ["USA", "Germany"], ["English"]),
  "the man who laughs|1928": film(1928, ["USA"], "English", 1928, ["USA"], ["None"]),
  "heat|1995": film(1995, ["USA"], "English", 1995, ["USA"], ["English", "Spanish"]),
  "amélie|2001": film(2001, ["France", "Germany"], "French", 2001, ["France", "Germany"], ["English", "French"]),
  "somewhere|1990": film(1990, ["UK"], "English", 1990, ["France"], ["English"]),
  "unknown|2001": film(2001, ["USA"], "English", undefined, undefined, undefined, { om: null }),
  "nowhere|2000": { src: "tmdb", v: 6, miss: true },
  "the prowler|1951": film(1951, ["USA"], "English", 1951, ["USA"], ["English"], { why: "an American film; TMDB lists it as British" }),
  "spirited away|2001": film(2001, ["Japan"], "Japanese", 2003, ["Japan"], ["Japanese"]),
};

export default async function ({ browser, base }) {
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone });
    await seed(p, rows, { "cr-meta-v1": meta });
    const C = await p.evaluate(() => { const C = dataCheck(MY_LIB); return Object.fromEntries(C.groups.map((g) => [g.k, g.items.map((x) => x.name).join()]).concat([["noImdb", C.noImdb], ["total", C.total]])); });
    const want = { look: "A Cop (1972),Somewhere (1990),The Man Who Laughs (1928)", nomatch: "Nowhere (2000)", fixed: "The Prowler (1951)", yearSmall: "The Ear (1970),Brick (2005)",
      imdbYear: "Spirited Away (2001)", countryPart: "Twilight's Last Gleaming (1977)", langPart: "Amélie (2001)", noImdb: 1, total: 4 };
    for (const [k, v] of Object.entries(want)) assert(C[k] === v, `${file} ${k}: ${C[k]} (wanted ${v})`);
    const text = await p.evaluate(() => dataCheckText(MY_LIB));
    assert(/- A Cop \(1972\): Letterboxd 1972 · TMDB 1947: maybe matched to the wrong film/.test(text) && /Small differences, not errors:\n(.*\n)*- IMDb's year is the US release: 1 film/.test(text)
      && !/Spirited Away/.test(text) && /IMDb details are still to come for 1 film/.test(text), `${file} text: ${text}`);

    // the list opens from the lookup box (Settings on a phone)
    await p.click(phone ? '[data-act="settings"]' : "#btn-settings"); await p.waitForTimeout(100);
    await p.click('button:has-text("Show the list")'); await p.waitForTimeout(150);
    const panel = phone ? "#sheet" : "#dlg";
    const opened = await p.$eval(panel, (d) => [d.open, d.querySelector("h2, h3").textContent, d.querySelectorAll(".drill-row").length, d.textContent.includes("(not an error)")]);
    assert(opened[0] && /Film data check/.test(opened[1]) && opened[2] >= 10 && opened[3], `${file} list: ${opened}`);
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    await p.click("[data-copycheck]"); await p.waitForTimeout(150);
    assert(/Copied|Select all/.test(await p.$eval("[data-copycheck]", (b) => b.textContent)), `${file}: copy button didn't answer`);
    noErrors(p, file);
  }
}
