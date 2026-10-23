// No made-up diary: with nothing imported each layout shows how to import; once a diary is imported it is
// what shows, every time, with no way to swap it for the example; and it is saved before the page can close.
import { open, assert, noErrors, JSZip } from "./lib.mjs";

async function exportZip() {
  const z = new JSZip();
  z.file("profile.csv", "Date Joined,Username,Given Name\n2020-01-01,tester,\n");
  z.file("watched.csv", "Date,Name,Year,Letterboxd URI\n2026-03-01,Heat,1995,x\n");
  z.file("diary.csv", "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2026-03-02,Heat,1995,x,4.5,,,2026-03-01\n");
  return z.generateAsync({ type: "nodebuffer" });
}

export default async function ({ browser, base }) {
  const zip = await exportZip();
  for (const [file, phone] of [["desktop.html", false], ["mobile.html", true]]) {
    const p = await open(browser, base, file, { phone, example: false });
    const blank = await p.evaluate(() => ({ text: document.body.innerText, example: /example diary/i.test(document.body.innerText), tabs: !!document.querySelector(".tabbar") && getComputedStyle(document.querySelector(".tabbar")).display !== "none" }));
    assert(/Import/.test(blank.text) && /Export your data/.test(blank.text) && !blank.example && !blank.tabs, `${file} with nothing imported: ${blank.text.slice(0, 200)}`);
    await p.setInputFiles("#file-input", [{ name: "export.zip", mimeType: "application/zip", buffer: zip }]);
    await p.waitForFunction(() => MY_LIB && state.mode === "mine");
    await p.reload(); // straight away: the import must already be saved
    await p.waitForFunction(() => typeof state === "object" && state.lib);
    const after = await p.evaluate(() => ({ mode: state.mode, films: state.lib.films.map((f) => f.name).join(), example: /example diary/i.test(document.body.innerText) }));
    assert(after.mode === "mine" && after.films === "Heat" && !after.example, `${file} after a reload: ${JSON.stringify(after)}`);
    if (phone) {
      await p.click('[data-act="settings"]'); await p.waitForTimeout(100);
      assert(!/example/i.test(await p.$eval("#screen", (e) => e.innerText)), "Settings still offers the example diary");
    } else assert(!(await p.$("#btn-example")), "the desktop still offers the example diary");
    // an address asking for the example still shows your own diary
    await p.goto(base + file + "?example"); await p.waitForFunction(() => typeof state === "object" && state.lib);
    assert(await p.evaluate(() => state.mode) === "mine", `${file}: ?example replaced your diary`);
    noErrors(p, file);
  }
}
