/**
 * 서비스워커.
 *
 * ★ 캐시 우선(cache-first)이 아니라 네트워크 우선(network-first)입니다.
 *   블로그 작업대에서 겪었던 "배포했는데 옛날 화면이 계속 나오는" 문제를
 *   아예 만들지 않기 위해서입니다. 오프라인일 때만 캐시를 씁니다.
 *
 *   배포할 때마다 CACHE 값을 올려주세요.
 */
const CACHE = 'vw-v7';

const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      // 성공하면 캐시를 갱신해두고 그대로 돌려줍니다.
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      // 새 페이지 이동인데 오프라인이면 껍데기라도 보여줍니다.
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw new Error('offline');
    }
  })());
});
