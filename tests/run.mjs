// Runs every check in tests/*.test.mjs against the built site in docs/, one after another.
// Usage: npm test            (all)       node tests/run.mjs links routes   (just those)
import { readdir } from "node:fs/promises";
import path from "node:path";
import { ROOT, serve, launch } from "./lib.mjs";

const only = process.argv.slice(2);
const files = (await readdir(path.join(ROOT, "tests"))).filter((f) => f.endsWith(".test.mjs") && (!only.length || only.some((o) => f.startsWith(o)))).sort();
const server = await serve(), browser = await launch();
let failed = 0;
for (const f of files) {
  const started = Date.now();
  try {
    const { default: check } = await import(path.join(ROOT, "tests", f));
    await check({ browser, base: server.base });
    console.log(`✓ ${f.replace(".test.mjs", "")} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (e) {
    failed++;
    console.log(`✗ ${f.replace(".test.mjs", "")}: ${e && e.message ? e.message : e}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=${f}::${String(e && e.message || e).replace(/\n/g, " ")}`);
  }
}
await browser.close(); server.close();
console.log(failed ? `\n${failed} of ${files.length} checks failed.` : `\nAll ${files.length} checks passed.`);
process.exit(failed ? 1 : 0);
