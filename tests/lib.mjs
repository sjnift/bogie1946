// Shared pieces for the checks: a small static server for docs/, a browser, and pages with the
// CSV and ZIP readers served locally and every outside service cut off unless a check stands in for it.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const PAPA = await readFile(require.resolve("papaparse/papaparse.min.js"), "utf8");
const JSZIP = await readFile(require.resolve("jszip/dist/jszip.min.js"), "utf8");
export const JSZip = require("jszip");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css" };
export function serve() {
  const server = http.createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(DOCS, p.endsWith("/") ? p + "index.html" : p);
    if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
    try { const body = await readFile(file); res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body); }
    catch { res.writeHead(404).end("not found"); }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ base: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })));
}
export const launch = () => chromium.launch();

// A page in a fresh browser profile. `phone` sizes it like a phone; routes added later by a check win.
// The service worker is off unless asked for, since its requests would slip past the stand-ins. With nothing
// imported the pages show the made-up example diary only with ?example in the address, which checks use.
export const EX = "?example";
export async function open(browser, base, file, { phone = false, downloads = false, worker = false, example = true } = {}) {
  const ctx = await browser.newContext({ ...(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } }),
    acceptDownloads: downloads, serviceWorkers: worker ? "allow" : "block", reducedMotion: "reduce" });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|image\.tmdb\.org|wsrv\.nl|goatcounter\.com|api\.themoviedb\.org|omdbapi\.com|api\.apify\.com|api\.github\.com|cdn\.jsdelivr\.net|letterboxd\.com/, (r) => r.abort());
  await ctx.route(/papaparse/, (r) => r.fulfill({ contentType: "text/javascript", body: PAPA }));
  await ctx.route(/jszip/, (r) => r.fulfill({ contentType: "text/javascript", body: JSZIP }));
  // the diary kept on the site: none, unless a check stands in for it
  await ctx.route(/\/diary\//, (r) => r.fulfill({ status: 404, body: "not found" }));
  // and no TMDB key shared with visitors, unless a check stands in for it
  await ctx.route(/\/share\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  await ctx.route(/\/taste\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  await ctx.route(/\/visits\.json/, (r) => r.fulfill({ status: 404, body: "not found" }));
  // anything the page's security policy blocks counts as an error: a feature it would quietly break
  await ctx.addInitScript(() => addEventListener("securitypolicyviolation", (e) => console.error(`CSP blocked ${e.violatedDirective}: ${e.blockedURI || "inline code"}`)));
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && m.text().startsWith("CSP blocked")) page.errors.push(m.text()); });
  if (file) { await page.goto(base + file + (example ? EX : "")); await page.waitForFunction(() => typeof state === "object" && state.lib); }
  return page;
}
// Saves an export into a page's browser the way an older version did, then reloads so the page picks it up.
export async function seed(page, rows, extra = {}) {
  await page.evaluate(([rows, extra]) => {
    localStorage.setItem("cr-rows-v1", JSON.stringify(rows));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, JSON.stringify(v));
  }, [rows, extra]);
  await page.reload();
  await page.waitForFunction(() => typeof state === "object" && state.lib && (!localStorage.getItem("cr-rows-v1")));
}
export function assert(ok, message) { if (!ok) throw new Error(message); }
export function noErrors(page, where) { assert(!page.errors.length, `${where}: page errors: ${page.errors.join(" | ")}`); }
export const text = (page, sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, " ").trim());
// Waits for a condition in the page, with a clear message when it never comes.
export async function until(page, fn, what, arg, timeout = 8000) {
  try { await page.waitForFunction(fn, arg, { timeout }); } catch { throw new Error(`timed out waiting for ${what}`); }
}
// Every screen and section of the phone layout, opened in turn; `each` runs on each with a name for it.
export async function phoneTour(m, each) {
  const tab = async (v) => { await m.click(`.tabbar [data-view="${v}"]`); await m.waitForTimeout(60); };
  await tab("profile"); await each("profile");
  await tab("diary"); await each("diary");
  await tab("stats");
  for (const v of ["films", "people", "genres", "years", "crowd"]) { await m.click(`#screen .seg [data-view="${v}"]`); await m.waitForTimeout(60); await each(v); }
  // and each Stats view for a year
  const y0 = await m.$$eval("#scopes [data-scope]", (x) => x.map((b) => b.dataset.scope).filter((y) => y !== "all")[0]);
  if (y0) {
    await m.click(`[data-scope="${y0}"]`);
    for (const v of ["films", "people", "genres", "years", "crowd"]) { await m.click(`#screen .seg [data-view="${v}"]`); await m.waitForTimeout(60); await each(`${v} ${y0}`); }
    await m.click('[data-scope="all"]');
  }
  await tab("insights"); await m.click('[data-scope="all"]');
  for (const t of await m.$$eval("[data-instab]", (x) => x.map((b) => b.dataset.instab))) { await m.click(`[data-instab="${t}"]`); await m.waitForTimeout(60); await each(`insights ${t}`); }
  await m.click('[data-instab="overview"]');
  const years = await m.$$eval("#scopes [data-scope]", (x) => x.map((b) => b.dataset.scope).filter((y) => y !== "all"));
  for (const y of years.slice(0, 2)) {
    await m.click(`[data-scope="${y}"]`);
    for (const t of await m.$$eval("[data-ytab]", (x) => x.map((b) => b.dataset.ytab))) { await m.click(`[data-ytab="${t}"]`); await m.waitForTimeout(60); await each(`insights ${y} ${t}`); }
    await m.click('[data-ytab="overview"]');
  }
  await m.click('[data-scope="all"]');
  await tab("compare");
  for (const t of await m.$$eval("[data-cmptab]", (x) => x.map((b) => b.dataset.cmptab))) { await m.click(`[data-cmptab="${t}"]`); await m.waitForTimeout(60); await each(`compare ${t}`); }
  if (await m.$('[data-cmptab="overview"]')) await m.click('[data-cmptab="overview"]');
  if (await m.$('[data-cmp="all"]')) { await m.click('[data-cmp="all"]'); await each("compare everyone"); }
  await tab("profile");
}
