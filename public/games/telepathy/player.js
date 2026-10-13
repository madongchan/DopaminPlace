// 텔레파시 — 참가자 휴대폰
// 한 화면에 한 가지 행동만 (SPEC 9장). 답을 쓰고 「제출」을 누른 뒤 공개를 기다린다.
//
// 답은 「제출」을 눌렀을 때만 서버로 간다. 글자를 칠 때마다 보내면 한 사람이 한 라운드에
// 열 번 넘게 보내고, 그때마다 서버가 모두에게 새 화면을 돌린다.
//
// 주의: 남이 제출할 때마다 내 화면도 다시 그리라는 연락이 온다(제출 인원이 바뀌니까).
// 그때 입력칸을 새로 만들면 쓰던 글자와 한글 조합이 날아간다.
// 그래서 같은 라운드 동안에는 입력칸을 그대로 두고 상태 글만 고친다.
import { 요소, 비우기, 타이머붙이기, 타이머띠 } from '/js/components.js';

let 지금 = null;     // { key, 입력칸, 상태, 버튼, 보낸값 } — 이번 라운드의 입력 화면

export function 그리기(el, current, 보내기) {
  const view = current.view;
  const key = `${current.playId}:${view.round}`;

  const 같은라운드 = 지금?.key === key && el.contains(지금.입력칸);
  if (view.phase === 'input' && 같은라운드 && 지금.endsAt === view.endsAt) {
    지금.보낸값 = view.내답 || 지금.보낸값;
    상태쓰기();
    return;
  }

  // 진행자가 시간을 늘렸을 때는 타이머 때문에 다시 그린다 — 쓰던 글은 옮겨 준다
  const 쓰던글 = 같은라운드 ? 지금.입력칸.value : null;
  지금 = null;
  비우기(el);
  el.appendChild(요소('div', { class: 'p-라운드', text: `${view.round} / ${view.총라운드} 라운드` }));
  el.appendChild(요소('div', { class: 'p-제시어', text: view.prompt || '' }));

  if (view.phase === 'input') 입력(el, view, 보내기, key, 쓰던글);
  else 기다리기(el, view);
}

// ── 답 쓰기 ─────────────────────────────────────────────────
function 입력(el, view, 보내기, key, 쓰던글) {
  const 숫자 = 요소('span', { class: 'p-초' });
  const 띠 = 요소('div', { class: 'p-띠' });
  el.appendChild(요소('div', { class: 'p-타이머' }, [숫자, 띠]));
  타이머붙이기(숫자, view.endsAt);
  타이머띠(띠, view.endsAt, 20);

  const 입력칸 = 요소('input', {
    class: 'name', type: 'text', maxlength: '20',
    placeholder: '한 단어로', autocomplete: 'off', enterkeyhint: 'send', value: 쓰던글 ?? (view.내답 || '')
  });
  const 버튼 = 요소('button', { class: 'cs-보내기', text: '제출' });
  const 상태 = 요소('div', { class: 'p-상태' });
  지금 = { key, 입력칸, 상태, 버튼, 보낸값: view.내답 || '', endsAt: view.endsAt };

  const 내자 = () => {
    const v = 입력칸.value.trim();
    if (!v) { 상태.textContent = '답을 쓰고 「제출」을 눌러주세요'; return; }
    보내기({ answer: v });
    지금.보낸값 = v;
    상태쓰기();
    입력칸.blur();
  };

  버튼.addEventListener('click', 내자);
  입력칸.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); 내자(); }
  });
  입력칸.addEventListener('input', 상태쓰기);

  el.appendChild(입력칸);
  el.appendChild(버튼);
  el.appendChild(상태);
  상태쓰기();

  el.appendChild(요소('p', {
    class: 'sub',
    text: '팀원과 상의하지 말고 각자 쓰세요. 시간 안에 「제출」을 눌러야 반영됩니다.'
  }));
  setTimeout(() => 입력칸.focus(), 80);
}

function 상태쓰기() {
  if (!지금) return;
  const { 입력칸, 상태, 버튼, 보낸값 } = 지금;
  const 쓴것 = 입력칸.value.trim();
  if (!보낸값) {
    상태.textContent = '아직 안 냈습니다';
    버튼.textContent = '제출';
  } else if (쓴것 === 보낸값) {
    상태.textContent = `"${보낸값}" 제출했습니다`;
    버튼.textContent = '제출 완료';
  } else {
    상태.textContent = `"${보낸값}" 로 내 둔 상태 — 고친 답은 다시 제출하세요`;
    버튼.textContent = '다시 제출';
  }
  상태.classList.toggle('냄', !!보낸값 && 쓴것 === 보낸값);
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
