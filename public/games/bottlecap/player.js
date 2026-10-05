// 병뚜껑 던지기 — 참가자 휴대폰
// 휴대폰으로는 아무것도 보내지 않는다(판정은 진행자가 한다).
// 이 화면의 일은 하나뿐 — 내 차례가 되면 크게 알려주는 것 (SPEC 5-4).
import { 요소, 비우기 } from '/js/components.js';

export function 그리기(el, current) {
  const view = current.view;
  비우기(el);

  if (view.내차례) {
    el.appendChild(요소('div', { class: 'bc-p내차례' }, [
      요소('span', { class: 'bc-p내차례글', text: '내 차례!' }),
      요소('span', { class: 'bc-p기회', text: `${view.내남은기회}번 남음` })
    ]));
    el.appendChild(요소('p', { class: 'sub', text: '과녁에 던지세요. 진행자가 점수를 넣어줍니다.' }));
  } else if (view.phase === 'done') {
    el.appendChild(요소('div', { class: 'wait', text: '모두 던졌습니다' }));
  } else {
    el.appendChild(요소('div', { class: 'bc-p기다림' }, [
      요소('span', { class: 'bc-p기다림말', text: '지금 던지는 사람' }),
      요소('span', { class: 'bc-p기다림이름', text: view.지금차례 ? view.지금차례.name : '—' })
    ]));
    if (view.내순서) {
      el.appendChild(요소('div', { class: 'p-상태', text: `내 순서는 ${view.전체순서}명 중 ${view.내순서}번째입니다` }));
    }
  }

  // 내 기록
  el.appendChild(요소('div', { class: 'bc-p기록' }, [
    요소('span', { text: `내 총점 ${view.내총점}점` }),
    요소('span', { text: `한 번 최고 ${view.내최고}점` })
  ]));

  if (view.다음차례 && !view.내차례) {
    el.appendChild(요소('div', { class: 'wait', text: `다음 · ${view.다음차례.name}` }));
  }
}
