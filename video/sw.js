/**
 * 서비스워커.
 *
 * ★ 캐시 우선(cache-first)이 아니라 네트워크 우선(network-first)입니다.
 *   블로그 작업대에서 겪었던 "배포했는데 옛날 화면이 계속 나오는" 문제를
 *   아예 만들지 않기 위해서입니다. 오프라인일 때만 캐시를 씁니다.
 *
 *   배포할 때마다 CACHE 값을 올려주세요.
 */
const CACHE = 'vw-v10';

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

  // ★ /hf/ 는 음성인식 모델 파일 중계입니다(worker.js) — 한 번 받으면
  //   절대 안 바뀌는 내용(모델+리비전으로 정해짐)인데, 위 network-first
  //   규칙을 그대로 적용하면 "이미 받아둔 300MB짜리 모델"도 새 영상을
  //   불러올 때마다(=다시 받아쓰기 할 때마다) 매번 새로 내려받습니다
  //   (실사용자 신고로 확인, 2026-08-28). 이 경로는 아예 건드리지 않고
  //   브라우저 기본 캐시(+ worker.js 가 이미 immutable 로 표시해둔 것)에
  //   맡깁니다 — 블로그 작업대 sw.js 의 /video/ 예외와 같은 이유입니다.
  if (url.pathname.startsWith('/hf/')) return;

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
