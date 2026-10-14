// 반응속도 — 큰 화면(TV)
// 빨강에서 초록으로 바뀌는 순간이 전부다. 화면 전체가 색으로 바뀐다.
// 초록으로 바뀔 시각은 서버가 보내지 않는다 — 알면 미리 누를 수 있다.
import { 요소, 비우기 } from '/js/components.js';

export function 그리기(el, { view, name }) {
  비우기(el);


  el.appendChild(요소('div', { class: 'g-머리' }, [
    요소('span', { class: 'g-이름', text: name }),
    요소('span', { class: 'g-라운드', text: `${view.round} / ${view.총라운드}` })
  ]));

  if (view.phase === '빨강' || view.phase === '초록') 신호등(el, view);
  else 쉬는중(el, view);
}

// ── 빨강 / 초록 ─────────────────────────────────────────────
function 신호등(el, view) {
  const 초록 = view.phase === '초록';
  el.appendChild(요소('div', { class: 'rt-신호' + (초록 ? ' 초록' : ' 빨강') }, [
    요소('span', { class: 'rt-신호글', text: 초록 ? '지금!' : '준비…' })
  ]));
  el.appendChild(요소('div', {
    class: 'tp-안내',
    text: 초록 ? `${view.낸사람} / ${view.전체} 명 눌렀습니다` : '초록이 되면 휴대폰을 누르세요'
  }));
}

// ── 라운드 사이 — 기록 보여주기 ─────────────────────────────
function 쉬는중(el, view) {
  let 말;
  if (view.phase === '대기') 말 = '진행자가 「다음 라운드」를 누르면 시작합니다';
  else if (view.phase === '끝') 말 = '게임이 끝났습니다';
  else 말 = `${view.round}라운드가 끝났습니다`;
  el.appendChild(요소('div', { class: 'tp-안내', text: 말 }));

  const 순위 = view.순위 || [];
  if (!순위.length) {
    el.appendChild(요소('div', { class: 'tp-답없음', text: '아직 기록이 없습니다' }));
    return;
  }

  // 줄 = 등수 · 이름 · 합계 막대 · 이번 판(기록과 받은 점수) · 합계 점수
  const 최고점 = Math.max(1, ...순위.map(x => x.총점));
  const wrap = 요소('div', { class: 'rt-기록판' });
  for (const x of 순위) {
    wrap.appendChild(요소('div', { class: 'rt-줄' + (x.rank === 1 ? ' 으뜸' : '') }, [
      요소('span', { class: 'rt-등수', text: `${x.rank}위` }),
      요소('span', { class: 'rt-이름', text: x.name }),
      요소('span', { class: 'rt-바' }, [
        요소('i', { style: { width: `${(Math.max(0.04, x.총점 / 최고점) * 100).toFixed(1)}%` } })
      ]),
      요소('span', { class: 'rt-이번' + (x.이번판?.점 ? '' : ' 나쁨'), text: 이번판글(x.이번판) }),
      요소('span', { class: 'rt-ms', text: `${x.총점}점` })
    ]));
  }
  el.appendChild(wrap);
  el.appendChild(요소('div', { class: 'tp-안내작게', text: '판마다 가장 빠른 1·2·3등 +3 / +2 / +1 · 초록 전에 누르거나 안 누르면 그 판 탈락' }));
}

// 이번 판 한 칸 — '231ms +3' / '탈락'
function 이번판글(판) {
  if (!판) return '';
  if (판.ms == null) return '탈락';
  return `${판.ms}ms +${판.점}`;
}
