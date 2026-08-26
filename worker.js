/**
 * 영상 작업대용 Cloudflare Worker.
 *
 * 하는 일은 두 가지뿐입니다.
 *   1) /hf/* 로 오는 요청을 huggingface.co 로 대신 받아다 줍니다 (음성인식 모델).
 *   2) 나머지는 video/ 폴더의 정적 파일을 그대로 내보냅니다.
 *
 * ★ 1번이 필요한 이유:
 *   HuggingFace 는 브라우저가 *.workers.dev 출처에서 직접 요청하면 막습니다.
 *   (curl 로는 CORS 헤더가 정상으로 오는데, 실제 브라우저 요청만 차단됩니다.
 *    같은 요청이 hyeoklee-ps.github.io 에서는 통과합니다 — 재현 확인함)
 *   Worker 가 대신 받아오면 페이지 입장에서는 같은 출처라 CORS 자체가 사라집니다.
 */

const HF = 'https://huggingface.co/';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/hf/')) {
      // 경로 뒤쪽을 그대로 huggingface.co 에 붙입니다.
      const target = HF + url.pathname.slice('/hf/'.length) + url.search;

      const upstream = await fetch(target, {
        method: 'GET',
        headers: {
          // 브라우저 헤더를 그대로 넘기면 다시 차단당합니다. 최소한만 보냅니다.
          'user-agent': 'video-workbench/1.0',
          // 큰 모델 파일을 이어받을 수 있도록 구간 요청은 넘겨줍니다.
          ...(request.headers.get('range') ? { range: request.headers.get('range') } : {}),
        },
        redirect: 'follow',
      });

      const headers = new Headers();
      for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag']) {
        const v = upstream.headers.get(k);
        if (v) headers.set(k, v);
      }
      // 모델 파일은 내용이 바뀌지 않으므로 오래 캐시합니다.
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      headers.set('access-control-allow-origin', '*');

      return new Response(upstream.body, { status: upstream.status, headers });
    }

    return env.ASSETS.fetch(request);
  },
};
