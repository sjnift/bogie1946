// A one-off look, from GitHub's runner, at whether Letterboxd lets an honest automated reader see a member's films
// pages (robots.txt and the pages themselves), and how a film's rating is written there. Prints GitHub notices.
const UA = "Mozilla/5.0 (compatible; CreditsRollFeed/1.0; +https://github.com/sjnift/bogie1946)";
const note = (title, msg) => console.log(`::notice title=${title}::${String(msg).replace(/%/g, "%25").replace(/\r?\n/g, "%0A").slice(0, 3800)}`);
const get = async (url) => { const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" } }); return { r, text: await r.text() }; };
const robots = await get("https://letterboxd.com/robots.txt");
note("robots", `status ${robots.r.status}\n` + robots.text.split("\n").filter((l) => /^(user-agent|disallow|allow|crawl-delay)/i.test(l.trim())).join("\n"));
for (const path of ["/bogie1946/films/", "/bogie1946/films/page/2/", "/bogie1946/films/ratings/"]) {
  const { r, text } = await get("https://letterboxd.com" + path);
  const count = (re) => (text.match(re) || []).length;
  note(`page ${path}`, `status ${r.status} server ${r.headers.get("server")} cf-mitigated ${r.headers.get("cf-mitigated") || "-"} length ${text.length}\n` +
    `griditem ${count(/griditem/g)} poster-container ${count(/poster-container/g)} data-film-slug ${count(/data-film-slug/g)} data-item-slug ${count(/data-item-slug/g)} ` +
    `poster-viewingdata ${count(/poster-viewingdata/g)} rated- ${count(/rated-\d+/g)} icon-liked ${count(/icon-liked/g)} data-item-name ${count(/data-item-name/g)} paginate ${count(/paginate-page/g)}\n` +
    `title: ${(text.match(/<title>([^<]*)<\/title>/) || [])[1] || "-"}`);
  if (path === "/bogie1946/films/") {
    const i = Math.max(text.indexOf("griditem"), text.indexOf("poster-container"));
    if (i > 0) { note("first film", text.slice(i - 100, i + 1700)); }
    const p = text.indexOf("paginate-pages");
    if (p > 0) note("pagination", text.slice(p, p + 900));
  }
}
