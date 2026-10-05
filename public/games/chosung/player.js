// 초성 퀴즈 — 참가자 휴대폰
// 답을 써서 보내면 서버가 맞았는지 판정한다. 틀리면 2초 동안 잠긴다.
// 텔레파시와 달리 글자를 칠 때마다 보내면 안 된다 — 한 글자 한 글자가 오답 판정을 받는다.
import { 요소, 비우기, 타이머붙이기 } from '/js/components.js';

export function 그리기(el, current, 보내기) {
  const view = current.view;
  비우기(el);

  el.appendChild(요소('div', { class: 'p-라운드', text: `${view.round} / ${view.총라운드} 문제` }));
  el.appendChild(요소('div', { class: 'cs-p초성', text: view.초성 || '' }));

  if (view.phase !== 'input') { 공개(el, view); return; }

  const 숫자 = 요소('span', { class: 'p-초' });
  el.appendChild(요소('div', { class: 'p-타이머' }, [숫자]));
  타이머붙이기(숫자, view.endsAt);

  if (view.힌트) {
    el.appendChild(요소('div', { class: 'cs-p힌트', text: `힌트 · ${view.힌트}` }));
  }

  if (!view.내팀) {
    el.appendChild(요소('div', { class: 'wait', text: '팀이 없어 참여할 수 없습니다. 진행자에게 말해주세요.' }));
    return;
  }
  if (view.내팀맞혔나) {
    el.appendChild(요소('div', { class: 'cs-p맞음', text: '우리 팀 정답!' }));
    el.appendChild(요소('div', { class: 'wait', text: '다음 문제를 기다려주세요' }));
    return;
  }

  입력(el, view, 보내기);
}

// ── 답 쓰기 ─────────────────────────────────────────────────
function 입력(el, view, 보내기) {
  const 입력칸 = 요소('input', {
    class: 'name', type: 'text', maxlength: '30',
    placeholder: '답을 쓰세요', autocomplete: 'off', enterkeyhint: 'send'
  });
  const 버튼 = 요소('button', { class: 'cs-보내기', text: '보내기' });
  const 상태 = 요소('div', { class: 'p-상태' });

  const 보내자 = () => {
    const v = 입력칸.value.trim();
    if (!v) return;
    보내기({ answer: v });
    입력칸.value = '';
    상태.textContent = `"${v}" 보냈습니다`;
  };

  버튼.addEventListener('click', 보내자);
  입력칸.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); 보내자(); }
  });

  el.appendChild(입력칸);
  el.appendChild(버튼);
  el.appendChild(상태);

  // 오답 뒤 잠금 — 남은 시간을 숫자로 보여준다
  if (!view.입력가능 && view.재입력까지 > 0) {
    입력칸.disabled = true;
    버튼.disabled = true;
    const 잠금 = 요소('div', { class: 'cs-p잠금' });
    el.appendChild(잠금);
    const 끝 = Date.now() + view.재입력까지;
    const 그려 = () => {
      const 남음 = 끝 - Date.now();
      if (남음 <= 0) {
        잠금.textContent = '다시 쓸 수 있습니다';
        입력칸.disabled = false;
        버튼.disabled = false;
        clearInterval(돌리기);
        입력칸.focus();
        return;
      }
      잠금.textContent = `틀렸습니다 — ${(남음 / 1000).toFixed(1)}초 뒤에 다시 쓸 수 있습니다`;
    };
    const 돌리기 = setInterval(그려, 100);
    그려();
  } else {
    setTimeout(() => 입력칸.focus(), 80);
  }

  const 내오답 = view.내오답 || [];
  if (내오답.length) {
    el.appendChild(요소('div', { class: 'cs-p오답' }, [
      요소('span', { class: 'cs-p오답말', text: '내가 쓴 것' }),
      요소('span', { text: 내오답.join(', ') })
    ]));
  }
}

// ── 공개 ────────────────────────────────────────────────────
function 공개(el, view) {
  el.appendChild(요소('div', { class: 'cs-p정답', text: view.정답 || '' }));
  if (view.힌트) el.appendChild(요소('div', { class: 'cs-p힌트', text: `힌트 · ${view.힌트}` }));

  const 맞힌 = view.맞힌 || [];
  if (맞힌.length) {
    const box = 요소('div', { class: 'p-공개' });
    for (const x of 맞힌) {
      box.appendChild(요소('div', { class: 'p-공개줄' }, [
        요소('span', { text: `${x.순서}등 ${x.teamId}팀 (${x.name})` }),
        요소('b', { text: `+${x.점수}` })
      ]));
    }
    el.appendChild(box);
  } else {
    el.appendChild(요소('div', { class: 'cs-p맞음 없음', text: '아무도 못 맞혔습니다' }));
  }

  el.appendChild(요소('div', {
    class: 'wait',
    text: view.phase === 'done' ? '게임이 끝났습니다' : 'TV 화면을 봐주세요'
  }));
}
