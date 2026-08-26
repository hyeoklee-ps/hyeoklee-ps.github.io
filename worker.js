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
      // ★ 모델 파일은 안 바뀌니 오래 캐시하고 싶지만, 'public' + 'immutable' 은
      //   위험한 조합입니다. 같은 URL 에 서로 다른 Range 로 여러 번 요청하는
      //   도중(진행률 표시 방식) 응답 하나가 어그러지면 — 캐시 하나가 잘못된
      //   "전체 길이"로 저장된 채, 캐시를 공유하는 다른 요청·다른 사용자까지
      //   전부 빈 몸통을 받게 되고, 'immutable' 이라 브라우저가 다시는
      //   확인하러 가지 않습니다 (테스트 중 로컬 캐시에서 재현: 한 번 어긋난
      //   뒤로는 재요청마다 "Failed to fetch" 였습니다). 'private' 로 공유
      //   캐시(다른 사람과 겹치는 캐시)에는 안 들어가게 하고, 'no-transform' 으로
      //   중간에서 인코딩을 바꾸지 못하게 해서 이 위험을 줄입니다 — 폰 자신의
      //   캐시는 여전히 씁니다.
      headers.set('cache-control', 'private, max-age=31536000, immutable, no-transform');
      headers.set('access-control-allow-origin', '*');

      return new Response(upstream.body, { status: upstream.status, headers });
    }

    return env.ASSETS.fetch(request);
  },
};
