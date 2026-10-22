// Saved data moves from localStorage into IndexedDB, survives a reload, and a backup carries it to another device.
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { open, seed, assert, noErrors } from "./lib.mjs";

const rows = { profile: [{ Username: "tester" }], watched: [{ Name: "Heat", Year: "1995", Date: "2024-01-01" }], diary: [{ Name: "Heat", Year: "1995", "Watched Date": "2024-02-03", Rating: "4.5" }], ratings: [{ Name: "Heat", Year: "1995", Rating: "4.5" }] };
const meta = { "heat|1995": { src: "tmdb", v: 3, id: 949, d: ["Michael Mann"], c: ["Al Pacino"], w: [], p: [], m: [], g: ["Crime"], k: ["USA"], l: "English", r: 170 } };

export default async function ({ browser, base }) {
  const p = await open(browser, base, "desktop.html", { downloads: true });
  await seed(p, rows, { "cr-meta-v1": meta, "cr-tmdb-key": "k123" });
  const moved = await p.evaluate(async () => ({ ls: Object.keys(localStorage).filter((k) => k.startsWith("cr-")).sort().join(),
    idb: await new Promise((res) => { const r = indexedDB.open("credits-roll"); r.onsuccess = () => { const q = r.result.transaction("kv").objectStore("kv").getAllKeys(); q.onsuccess = () => res(q.result.sort().join()); }; }) }));
  assert(moved.ls === "cr-tmdb-key", `left in localStorage: ${moved.ls}`);
  assert(moved.idb === "cr-meta-v1,cr-rows-v1", `in IndexedDB: ${moved.idb}`);
  await p.evaluate(() => { META["heat|1995"].r = 171; saveMeta(); });
  await p.waitForTimeout(500); await p.reload(); await p.waitForFunction(() => typeof META === "object" && META["heat|1995"]);
  assert(await p.evaluate(() => META["heat|1995"].r) === 171, "a saved change didn't survive a reload");

  await p.check("#backup-keys");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#btn-backup")]);
  const file = path.join(os.tmpdir(), `credits-roll-backup-${Date.now()}.json`);
  await dl.saveAs(file);
  const b = JSON.parse(await readFile(file, "utf8"));
  assert(b.app === "credits-roll" && b.rows.watched.length === 1 && b.meta["heat|1995"] && b.keys.tmdb === "k123", "backup is missing something");

  const q = await open(browser, base, "mobile.html", { phone: true });
  await q.setInputFiles("#file-input", file);
  await q.waitForFunction(() => state.mode === "mine" && MY_LIB);
  const restored = await q.evaluate(() => ({ films: MY_LIB.films.length, dir: META["heat|1995"].d[0], key: store.get(KEYS.tmdb, "") }));
  assert(restored.films === 1 && restored.dir === "Michael Mann" && restored.key === "k123", `restore: ${JSON.stringify(restored)}`);
  noErrors(p, "desktop"); noErrors(q, "phone");
}
