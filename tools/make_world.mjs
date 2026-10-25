// Draws the world map's country shapes into src/06n-world.js (run again only to change the map itself):
//   npm i --no-save d3-geo@3 topojson-client@3 world-atlas@2 i18n-iso-countries@7 && node tools/make_world.mjs
// Natural Earth's 1:110m countries (via world-atlas), Equal Earth projection (equal-area, so a country's shading isn't
// exaggerated by its size), no Antarctica. Countries too small for that scale (Hong Kong, Singapore, Malta…) become dots
// at their place on the 1:50m map. Each shape is keyed by its ISO 3166 code; NAMES gives every English name we know for
// a code, so TMDB's, IMDb's and Letterboxd's spellings all land on the same country.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoEqualEarth, geoPath, geoCentroid, geoArea } from "d3-geo";
import * as topo from "topojson-client";
import countries from "i18n-iso-countries";
const require = createRequire(import.meta.url);
const atlas = (n) => JSON.parse(readFileSync(require.resolve(`world-atlas/countries-${n}.json`)));
const t110 = atlas("110m"), t50 = atlas("50m");
const f110 = topo.feature(t110, t110.objects.countries).features, f50 = topo.feature(t50, t50.objects.countries).features;
const NO_ID = { Kosovo: "XK", "N. Cyprus": "CY", Somaliland: "SO" }; // shapes Natural Earth gives no code
const code = (f) => NO_ID[f.properties.name] || countries.numericToAlpha2(f.id);
const land = f110.filter((f) => f.id !== "010" && code(f)); // no Antarctica
const W = 2000, proj = geoEqualEarth().fitWidth(W, { type: "FeatureCollection", features: land });
const [[, top], [, bottom]] = geoPath(proj).bounds({ type: "FeatureCollection", features: land });
proj.translate([proj.translate()[0], proj.translate()[1] - Math.floor(top)]);
const H = Math.ceil(bottom - top);
// a path in whole units, each ring relative to its start: "M x y l dx dy dx dy … z"
function draw(feature) {
  let out = "", x = 0, y = 0, ring = [];
  const flush = () => { if (new Set(ring.map((p) => p.join())).size >= 3) out += `M${ring[0][0]} ${ring[0][1]}l${ring.slice(1).map(([a, b], i) => { const [pa, pb] = ring[i]; return [a - pa, b - pb]; }).filter(([a, b]) => a || b).map(([a, b]) => `${a}${b < 0 ? "" : " "}${b}`).join(" ").replace(/ -/g, "-")}z`; ring = []; };
  geoPath(proj, { moveTo(a, b) { flush(); x = Math.round(a); y = Math.round(b); ring.push([x, y]); },
    lineTo(a, b) { a = Math.round(a); b = Math.round(b); if (a !== x || b !== y) ring.push([x = a, y = b]); },
    closePath() { flush(); }, arc() {} })(feature);
  flush();
  return out;
}
const shapes = new Map();
for (const f of land) { const c = code(f); shapes.set(c, (shapes.get(c) || "") + draw(f)); }
const dots = f50.filter((f) => code(f) && !shapes.has(code(f)) && !["HM", "AU", "GS", "IO", "PN", "SH", "NF"].includes(code(f))).map((f) => {
  // the biggest piece of the country, so a far-off island doesn't pull the dot out to sea
  const parts = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.map((p) => ({ type: "Polygon", coordinates: p })) : [f.geometry];
  const big = parts.reduce((a, p) => geoArea(p) > geoArea(a) ? p : a);
  const [x, y] = proj(geoCentroid(big));
  return [code(f), Math.round(x), Math.round(y)];
});
// Every English name for each code, plus the spellings film sites use that the ISO list lacks.
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/^the\s+|,\s*the$/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const EXTRA = {
  US: ["usa", "u s a", "america", "united states"], GB: ["uk", "great britain", "britain", "england", "scotland", "wales", "northern ireland"],
  KR: ["south korea", "korea", "republic of korea"], KP: ["north korea"], RU: ["russia", "russian federation"], IR: ["iran", "persia"],
  SY: ["syria", "syrian arab republic"], LA: ["laos", "lao people s democratic republic"], VN: ["vietnam", "viet nam"], TW: ["taiwan"],
  LY: ["libya", "libyan arab jamahiriya"], PS: ["palestine", "palestinian territory", "palestinian territories", "state of palestine"],
  MK: ["macedonia", "north macedonia"], FM: ["micronesia"], CG: ["congo", "republic of the congo", "congo brazzaville"],
  CD: ["democratic republic of the congo", "congo democratic republic of the", "congo kinshasa", "dr congo", "zaire"],
  CI: ["cote d ivoire", "ivory coast"], XK: ["kosovo"], CZ: ["czech republic", "czechia"], TR: ["turkey", "turkiye"],
  SZ: ["eswatini", "swaziland"], CV: ["cape verde", "cabo verde"], MM: ["myanmar", "burma"], VA: ["holy see", "vatican", "vatican city"],
  BN: ["brunei", "brunei darussalam"], TL: ["east timor", "timor leste"], NL: ["netherlands", "holland"], LK: ["sri lanka", "ceylon"],
  ZW: ["zimbabwe", "rhodesia"], BO: ["bolivia"], VE: ["venezuela"], TZ: ["tanzania"], MD: ["moldova"], HK: ["hong kong", "hong kong sar china"],
  MO: ["macao", "macau"], CN: ["china", "people s republic of china"], DE: ["germany", "west germany", "federal republic of germany"],
  BA: ["bosnia and herzegovina", "bosnia"], CY: ["cyprus", "northern cyprus"], SO: ["somalia", "somaliland"], EH: ["western sahara"],
};
const codes = [...shapes.keys(), ...dots.map((d) => d[0])];
const names = {};
for (const c of codes) {
  const all = countries.getNames("en", { select: "all" })[c] || [];
  names[c] = [...new Set([...all, ...(EXTRA[c] || [])].map(norm))].filter(Boolean);
}
// a name shared by two codes ("congo") stays only where EXTRA puts it
const owners = {};
for (const c of codes) for (const n of names[c]) (owners[n] ||= []).push(c);
for (const [n, cs] of Object.entries(owners)) if (cs.length > 1) for (const c of cs) if (!(EXTRA[c] || []).includes(n)) names[c] = names[c].filter((x) => x !== n);
for (const [n, cs] of Object.entries(owners)) if (cs.filter((c) => names[c].includes(n)).length > 1) throw new Error(`"${n}" names ${cs.join(" and ")}`);
// the name a country goes by on the map when you've no films from it (with films, the name your films use)
const LABEL = { US: "USA", GB: "UK", KR: "South Korea", KP: "North Korea", CD: "DR Congo", CG: "Congo", LA: "Laos", SY: "Syria", MD: "Moldova",
  NL: "Netherlands", FK: "Falkland Islands", VA: "Vatican City", BN: "Brunei", FM: "Micronesia", XK: "Kosovo", IR: "Iran", RU: "Russia",
  VN: "Vietnam", TZ: "Tanzania", BO: "Bolivia", VE: "Venezuela", PS: "Palestine", TW: "Taiwan", MO: "Macao", HK: "Hong Kong", CZ: "Czechia",
  VI: "US Virgin Islands", VG: "British Virgin Islands", MF: "Saint Martin", SX: "Sint Maarten" };
const label = Object.fromEntries(codes.map((c) => [c, LABEL[c] || countries.getName(c, "en", { select: "alias" }) || countries.getName(c, "en") || c]));
const odd = Object.entries(label).filter(([, l]) => /[,(]/.test(l));
if (odd.length) console.log("labels to look at:", odd);
// countries that no longer exist: their films are named under the map, and on each country that came out of them
const GONE = { "Soviet Union": { codes: ["RU", "UA", "BY", "KZ", "UZ", "TM", "KG", "TJ", "GE", "AM", "AZ", "MD", "LT", "LV", "EE"], names: ["soviet union", "ussr", "union of soviet socialist republics"] },
  Yugoslavia: { codes: ["RS", "HR", "SI", "BA", "MK", "ME", "XK"], names: ["yugoslavia", "socialist federal republic of yugoslavia"] },
  "Serbia and Montenegro": { codes: ["RS", "ME", "XK"], names: ["serbia and montenegro"] },
  Czechoslovakia: { codes: ["CZ", "SK"], names: ["czechoslovakia"] },
  "East Germany": { codes: ["DE"], names: ["east germany", "german democratic republic"] },
  "Netherlands Antilles": { codes: ["CW", "SX", "BQ"], names: ["netherlands antilles"] } };
const js = `<script>
/* ---------- the world map's countries: drawn by tools/make_world.mjs from Natural Earth (public domain). Don't edit by hand. ---------- */
const WORLD = { w: ${W}, h: ${H},
  shapes: ${JSON.stringify([...shapes].sort((a, b) => a[0].localeCompare(b[0])))},
  dots: ${JSON.stringify(dots.sort((a, b) => a[0].localeCompare(b[0])))},
  names: ${JSON.stringify(names)},
  label: ${JSON.stringify(label)},
  gone: ${JSON.stringify(GONE)} };
</script>
`;
writeFileSync(new URL("../src/06n-world.js", import.meta.url), js);
console.log(`src/06n-world.js: ${shapes.size} shapes, ${dots.length} dots, ${W}×${H}, ${(js.length / 1024).toFixed(1)} KB`);
