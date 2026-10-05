// 텔레파시 — 참가자 휴대폰
// 한 화면에 한 가지 행동만 (SPEC 9장). 답을 쓰고, 공개를 기다린다.
import { 요소, 비우기, 타이머붙이기, 타이머띠 } from '/js/components.js';

export function 그리기(el, current, 보내기) {
  const view = current.view;
  비우기(el);

  el.appendChild(요소('div', { class: 'p-라운드', text: `${view.round} / ${view.총라운드} 라운드` }));
  el.appendChild(요소('div', { class: 'p-제시어', text: view.prompt || '' }));

  if (view.phase === 'input') 입력(el, view, 보내기);
  else 기다리기(el, view);
}

// ── 답 쓰기 ─────────────────────────────────────────────────
function 입력(el, view, 보내기) {
  const 숫자 = 요소('span', { class: 'p-초' });
  const 띠 = 요소('div', { class: 'p-띠' });
  el.appendChild(요소('div', { class: 'p-타이머' }, [숫자, 띠]));
  타이머붙이기(숫자, view.endsAt);
  타이머띠(띠, view.endsAt, 20);

  const 입력칸 = 요소('input', {
    class: 'name', type: 'text', maxlength: '20',
    placeholder: '한 단어로', autocomplete: 'off', value: view.내답 || ''
  });
  const 상태 = 요소('div', { class: 'p-상태' });

  // 글자를 칠 때마다 곧바로 보낸다. 마지막에 보낸 것이 내 답이 된다.
  // (버튼을 눌러야만 반영되면, 못 누르고 시간이 끝나는 사람이 생긴다.)
  let 보낸값 = view.내답 || '';
  let 예약 = null;

  const 상태쓰기 = () => {
    상태.textContent = 보낸값 ? `"${보낸값}" 로 냈습니다` : '아직 안 냈습니다';
    상태.classList.toggle('냄', !!보낸값);
  };
  const 보내자 = () => {
    const v = 입력칸.value.trim();
    if (v === 보낸값) return;
    보낸값 = v;
    보내기({ answer: v });
    상태쓰기();
  };

  입력칸.addEventListener('input', () => {
    clearTimeout(예약);
    예약 = setTimeout(보내자, 250);
  });
  입력칸.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { clearTimeout(예약); 보내자(); 입력칸.blur(); }
  });

  el.appendChild(입력칸);
  el.appendChild(상태);
  상태쓰기();

  el.appendChild(요소('p', { class: 'sub', text: '우리 팀원과 같은 답을 쓸수록 점수가 올라갑니다.' }));
  setTimeout(() => 입력칸.focus(), 80);
}

// ── 공개 기다리기 ───────────────────────────────────────────
function 기다리기(el, view) {
  el.appendChild(요소('div', {
    class: 'p-내답',
    text: view.내답 ? `내 답: ${view.내답}` : '이번 라운드는 안 냈어요'
  }));

  const 결과 = Object.entries(view.공개결과?.결과 || {});
  if (결과.length) {
    const box = 요소('div', { class: 'p-공개' });
    for (const [tid, r] of 결과) {
      box.appendChild(요소('div', { class: 'p-공개줄' }, [
        요소('span', { text: `${tid}팀` }),
        요소('b', { text: `+${r.점수}` })
      ]));
    }
    el.appendChild(box);
  }

  el.appendChild(요소('div', {
    class: 'wait',
    text: view.phase === 'done' ? '게임이 끝났습니다' : 'TV 화면을 봐주세요'
  }));
}
