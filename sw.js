/* Offline cache for the toolkit. Bump CACHE when index.html changes. */
const CACHE = "blog-workbench-v23";
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
  // /video/ 는 별도의 앱(영상 작업대)이고 자체 서비스워커를 씁니다.
  // 이 워커는 cache-first 라서, 여기서 손대면 그쪽 앱이 옛 버전에 갇힙니다.
  if (new URL(req.url).pathname.startsWith("/video/")) return;
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
