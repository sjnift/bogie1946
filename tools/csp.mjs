// Locks a built page down (run by build.sh on the site's pages). A content security policy lets only the page's own
// scripts run (each by its SHA-256, plus the files next to it), so text that somehow slipped into the page as markup
// still couldn't run; pictures, fonts and calls may only come from the places the app uses. Pages also refuse to
// show inside another site's frame (so nobody can lay invisible buttons over them), and send no referrer.
// Usage: node tools/csp.mjs docs/desktop.html docs/mobile.html docs/index.html
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const UNFRAMED = `<style id="unframed">html{display:none}</style>
<script>if (self === top) document.getElementById("unframed").remove(); else top.location = self.location.href;</script>`;
const policy = (hashes) => [
  "default-src 'none'",
  `script-src 'self' ${hashes.map((h) => `'sha256-${h}'`).join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://image.tmdb.org",
  "connect-src 'self' https://api.themoviedb.org https://www.omdbapi.com https://api.apify.com https://api.github.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

for (const file of process.argv.slice(2)) {
  let html = readFileSync(file, "utf8");
  if (!html.includes('<meta charset="utf-8">')) throw new Error(`${file}: no <meta charset="utf-8"> to put the policy after`);
  html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${UNFRAMED}`);
  const hashes = [...new Set([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => createHash("sha256").update(m[1], "utf8").digest("base64")))];
  html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${policy(hashes)}">\n<meta name="referrer" content="no-referrer">`);
  writeFileSync(file, html);
}
