// 눈치 게임 — 큰 화면(TV)
// 누가 몇 번째로 눌렀는지가 이 게임의 재미다. 숫자를 크게 보여준다.
import { 요소, 비우기, 타이머붙이기, 타이머띠, 순위막대, 팀사전 } from '/js/components.js';

export function 그리기(el, { view, name }, 화면뷰) {
  비우기(el);
  const 팀 = 팀사전(화면뷰.teams);

  el.appendChild(요소('div', { class: 'g-머리' }, [
    요소('span', { class: 'g-이름', text: name }),
    요소('span', { class: 'g-라운드', text: `${view.판} / ${view.총판} 판` })
  ]));

  if (view.phase === '진행') 진행중(el, view);
  else 쉬는중(el, view);

  el.appendChild(누른칸(view));

  if (view.phase !== '진행' && view.순위 && view.순위.length) {
    el.appendChild(요소('div', { class: 'nc-순위' }, [
      요소('h3', { text: '지금 순위' }),
      순위막대(view.순위.map(x => ({
        name: x.name, points: x.점수, rank: x.rank, colorId: (팀[x.teamId] || {}).colorId
      })), { 단위: '점' })
    ]));
  }
}

// ── 판이 도는 중 ────────────────────────────────────────────
function 진행중(el, view) {
  const 숫자 = 요소('div', { class: 'tp-초' });
  const 띠 = 요소('div', { class: 'tp-띠' });
  el.appendChild(요소('div', { class: 'tp-타이머' }, [숫자, 띠]));
  타이머붙이기(숫자, view.endsAt);
  타이머띠(띠, view.endsAt, 20);

  el.appendChild(요소('div', { class: 'nc-남음' }, [
    요소('span', { class: 'nc-남음수', text: String(view.남은사람) }),
    요소('span', { class: 'nc-남음말', text: '명이 아직 안 눌렀습니다' })
  ]));
}

// ── 판 사이 ─────────────────────────────────────────────────
function 쉬는중(el, view) {
  let 말;
  if (view.phase === '대기') 말 = '진행자가 「다음 판」을 누르면 시작합니다';
  else if (view.phase === '끝') 말 = '게임이 끝났습니다';
  else 말 = `${view.판}판이 끝났습니다 — 탈락 ${view.탈락수}명`;
  el.appendChild(요소('div', { class: 'tp-안내', text: 말 }));
}

// ── 누른 사람 숫자판 ────────────────────────────────────────
function 누른칸(view) {
  const wrap = 요소('div', { class: 'nc-숫자판' });
  if (!view.누른사람 || !view.누른사람.length) {
    wrap.appendChild(요소('div', { class: 'tp-답없음', text: '아직 아무도 안 눌렀습니다' }));
    return wrap;
  }
  for (const x of view.누른사람) {
    wrap.appendChild(요소('div', { class: 'nc-칸' + (x.탈락 ? ' 탈락' : '') }, [
      요소('span', { class: 'nc-번호', text: String(x.순서) }),
      요소('span', { class: 'nc-이름', text: x.name }),
      x.탈락 ? 요소('span', { class: 'nc-탈락딱지', text: '탈락' }) : null
    ]));
  }
  return wrap;
}
