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
export async function open(browser, base, file, { phone = false, downloads = false } = {}) {
  const ctx = await browser.newContext({ ...(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } }), acceptDownloads: downloads });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|image\.tmdb\.org|api\.themoviedb\.org|omdbapi\.com|api\.apify\.com|letterboxd\.com/, (r) => r.abort());
  await ctx.route(/papaparse/, (r) => r.fulfill({ contentType: "text/javascript", body: PAPA }));
  await ctx.route(/jszip/, (r) => r.fulfill({ contentType: "text/javascript", body: JSZIP }));
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  if (file) { await page.goto(base + file); await page.waitForFunction(() => typeof state === "object" && state.lib); }
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
export async function until(page, fn, what, arg) {
  try { await page.waitForFunction(fn, arg, { timeout: 8000 }); } catch { throw new Error(`timed out waiting for ${what}`); }
}
