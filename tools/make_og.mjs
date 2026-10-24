// Draws the link-preview picture (src/site/og.png) from tools/og.html. Run once after changing og.html:
//   node tools/make_og.mjs   (needs Playwright and the web, for the fonts)
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto("file://" + here("og.html"), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: here("../src/site/og.png"), type: "png" });
await browser.close();
console.log("wrote src/site/og.png");
