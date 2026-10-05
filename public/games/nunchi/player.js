// 눈치 게임 — 참가자 휴대폰
// 한 화면에 한 가지 행동만 (SPEC 9장). 누를 수 있을 때는 버튼 하나만 크게 보인다.
import { 요소, 비우기, 타이머붙이기 } from '/js/components.js';

export function 그리기(el, current, 보내기) {
  const view = current.view;
  비우기(el);

  el.appendChild(요소('div', { class: 'p-라운드', text: `${view.판} / ${view.총판} 판` }));

  if (view.phase !== '진행') { 쉬는중(el, view); return; }

  const 숫자 = 요소('span', { class: 'p-초' });
  el.appendChild(요소('div', { class: 'p-타이머' }, [숫자]));
  타이머붙이기(숫자, view.endsAt);

  if (view.누를수있나) 누르기(el, 보내기);
  else 눌렀음(el, view);
}

// ── 아직 안 누름 — 큰 버튼 하나 ─────────────────────────────
function 누르기(el, 보내기) {
  const 버튼 = 요소('button', { class: 'nc-큰버튼', text: '누르기' });
  let 눌렀다 = false;
  const 누름 = (e) => {
    e.preventDefault();
    if (눌렀다) return;
    눌렀다 = true;                       // 두 번 눌러도 한 번만 보낸다
    버튼.disabled = true;
    버튼.textContent = '보냈습니다';
    보내기({ act: '누름' });
  };
  // 휴대폰에서는 touchstart 가 click 보다 빠르다 — 눈치 게임은 이 차이가 크다
  버튼.addEventListener('touchstart', 누름, { passive: false });
  버튼.addEventListener('click', 누름);

  el.appendChild(버튼);
  el.appendChild(요소('p', { class: 'sub', text: '다른 사람과 겹치면 둘 다 탈락입니다.' }));
}

// ── 이미 누름 ───────────────────────────────────────────────
function 눌렀음(el, view) {
  if (view.내탈락) {
    el.appendChild(요소('div', { class: 'nc-결과 탈락', text: '탈락' }));
    el.appendChild(요소('p', { class: 'sub', text: '다음 판을 기다려주세요.' }));
    return;
  }
  el.appendChild(요소('div', { class: 'nc-결과' }, [
    요소('span', { class: 'nc-내번호', text: String(view.내순서 || '') }),
    요소('span', { class: 'nc-내번호말', text: '번째' })
  ]));
  el.appendChild(요소('div', { class: 'wait', text: '아직 살아 있습니다' }));
}

// ── 판 사이 ─────────────────────────────────────────────────
function 쉬는중(el, view) {
  if (view.phase === '끝') {
    el.appendChild(요소('div', { class: 'wait', text: '게임이 끝났습니다' }));
  } else if (view.phase === '대기') {
    el.appendChild(요소('div', { class: 'wait', text: '곧 시작합니다' }));
  } else {
    el.appendChild(요소('div', {
      class: 'nc-결과' + (view.내탈락 ? ' 탈락' : ''),
      text: view.내탈락 ? '이 판은 탈락' : '이 판 생존'
    }));
    el.appendChild(요소('div', { class: 'wait', text: 'TV 화면을 봐주세요' }));
  }
}
