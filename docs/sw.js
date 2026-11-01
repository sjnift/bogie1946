// Lets Credits Roll install as an app and open offline. Our own pages and scripts are checked with the server each time
// (never taken from the browser's short-term cache), so a new version shows up on the next open; but on a connection
// that's there and hardly moving, the saved copy is shown after WAIT instead of a blank screen, and the new one is saved
// for the next open. The fonts and the import's readers never change under the same name, so the saved copy is used.
// Calls to TMDB, OMDb, Apify and GitHub, poster images, and the diary kept on the site (saved by the app itself) are left alone.
const CACHE = "credits-roll-v4";
const WAIT = 4000;
const SHELL = ["./", "index.html", "mobile.html", "desktop.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
  "vendor/papaparse.min.js", "vendor/jszip.min.js", "fonts.css", "fonts/schibsted-grotesk-latin.woff2", "fonts/big-shoulders-display-latin.woff2",
  "fonts/ibm-plex-mono-latin-400.woff2", "fonts/ibm-plex-mono-latin-500.woff2"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const keep = (req, res) => { if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };
const saved = (req) => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match(new URL(req.url).pathname.endsWith("desktop.html") ? "desktop.html" : "mobile.html") : undefined));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const ours = url.origin === self.location.origin;
  const library = url.hostname === "cdnjs.cloudflare.com";
  if ((!ours && !library) || (ours && url.pathname.includes("/diary/"))) return;
  if (library || /\/(fonts|vendor)\//.test(url.pathname)) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => keep(req, res))));
    return;
  }
  const net = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((res) => keep(req, res));
  e.waitUntil(net.catch(() => {}));
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const give = (res) => { if (!done && res) { done = true; resolve(res); } };
    net.then(give, () => saved(req).then((hit) => { if (hit) give(hit); else if (!done) { done = true; resolve(Response.error()); } }));
    setTimeout(() => saved(req).then(give), WAIT);
  }));
});
