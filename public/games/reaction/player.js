// 반응속도 — 참가자 휴대폰
//
// 여기가 이 게임의 핵심이다. 시간은 **휴대폰 안에서** 잰다.
// 초록으로 바뀐 순간부터 손가락이 닿은 순간까지 performance.now() 로 잰 값을 보낸다.
// 서버가 재면 네트워크가 느린 사람이 일방적으로 불리해진다.
//
// 주의: 남이 누를 때마다 화면이 다시 그려진다(낸사람 수가 바뀌니까).
// 그때 초록 시각을 다시 잡으면 기록이 0ms 가 되어버린다.
// 그래서 초록 시각은 모듈 밖에 두고, 라운드가 바뀔 때만 새로 잡는다.
import { 요소, 비우기 } from '/js/components.js';

let 이번 = { round: null, 초록시각: null };

export function 그리기(el, current, 보내기) {
  const view = current.view;

  // 라운드가 바뀌면 초록 시각을 지운다
  if (이번.round !== view.round) 이번 = { round: view.round, 초록시각: null };
  // 초록이 된 것을 처음 본 순간을 기준으로 삼는다
  if (view.phase === '초록' && 이번.초록시각 == null) 이번.초록시각 = performance.now();

  비우기(el);
  el.appendChild(요소('div', { class: 'p-라운드', text: `${view.round} / ${view.총라운드} 라운드` }));

  if (view.phase === '빨강' || view.phase === '초록') 신호판(el, view, 보내기);
  else 쉬는중(el, view);
}

// ── 빨강 / 초록 — 화면 전체가 버튼이다 ──────────────────────
function 신호판(el, view, 보내기) {
  const 초록 = view.phase === '초록';
  const 이미냈다 = view.내이번판 != null;

  const 판 = 요소('button', {
    class: 'rt-판' + (이미냈다 ? ' 냈음' : 초록 ? ' 초록' : ' 빨강')
  }, [
    요소('span', {
      class: 'rt-판글',
      text: 이미냈다 ? `${view.내이번판}ms` : 초록 ? '눌러!' : '기다려'
    })
  ]);

  if (!이미냈다) {
    let 보냈다 = false;
    const 누름 = (e) => {
      e.preventDefault();
      if (보냈다) return;
      보냈다 = true;
      if (view.phase === '초록' && 이번.초록시각 != null) {
        보내기({ ms: Math.round(performance.now() - 이번.초록시각) });
      } else {
        // 아직 빨강인데 눌렀다 — 서버가 부정 출발로 처리한다
        보내기({ ms: 0 });
      }
      판.classList.add('냈음');
    };
    판.addEventListener('touchstart', 누름, { passive: false });
    판.addEventListener('click', 누름);
  }

  el.appendChild(판);
  el.appendChild(요소('p', {
    class: 'sub',
    text: 이미냈다 ? '다음 라운드를 기다려주세요'
      : 초록 ? '지금 바로!' : '초록이 되기 전에 누르면 1초로 기록됩니다'
  }));
}

// ── 라운드 사이 ─────────────────────────────────────────────
function 쉬는중(el, view) {
  const 내기록 = view.내기록 || [];
  if (내기록.length) {
    const box = 요소('div', { class: 'rt-내기록' }, [
      요소('span', { class: 'rt-내기록말', text: '내 기록' })
    ]);
    for (const ms of 내기록) {
      box.appendChild(요소('span', {
        class: 'rt-내칸' + (ms >= 1000 ? ' 나쁨' : ''),
        text: `${ms}ms`
      }));
    }
    el.appendChild(box);
  }


  el.appendChild(요소('div', {
    class: 'wait',
    text: view.phase === '끝' ? '게임이 끝났습니다'
      : view.phase === '대기' ? '곧 시작합니다' : 'TV 화면을 봐주세요'
  }));
}
