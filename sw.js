/* Offline cache for the toolkit. Bump CACHE when index.html changes. */
const CACHE = "blog-workbench-v9";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Google Fonts are optional: never let a failed font request break the page.
  if (new URL(req.url).origin !== self.location.origin) {
    e.respondWith(fetch(req).catch(() => new Response("", { status: 200 })));
    return;
  }
  // The topic pool is refreshed weekly and everything else here is cache-first.
  // Serving a stale pool would be worse than showing none, so JSON data files
  // are network-first, falling back to cache only when offline.
  if (new URL(req.url).pathname.endsWith(".json")) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
