// 라이어 게임 — 참가자 휴대폰
//
// 제시어 카드는 **꾹 누르고 있는 동안만** 보인다. 옆 사람이 흘깃 보는 것을 막으려는 장치다.
// 라이어에게는 서버가 제시어를 보내주지 않는다. 여기서 가리는 것이 아니다.
//
// 카드 밖에 늘 보이는 글은 라이어와 시민이 똑같아야 한다.
// 다르면 화면을 슬쩍 본 사람이 누가 라이어인지 알아챈다.
import { 요소, 비우기, 타이머붙이기 } from '/js/components.js';

export function 그리기(el, current, 보내기) {
  const view = current.view;
  비우기(el);

  el.appendChild(요소('div', {
    class: 'p-라운드',
    text: `${view.round} / ${view.총라운드} 판`
  }));

  if (view.phase === '판끝' || view.phase === '끝') { 결과(el, view); return; }

  el.appendChild(제시어카드(view));

  if (view.endsAt) {
    const 숫자 = 요소('span', { class: 'p-초' });
    el.appendChild(요소('div', { class: 'p-타이머' }, [숫자]));
    타이머붙이기(숫자, view.endsAt);
  }

  if (view.phase === '확인') {
    el.appendChild(요소('div', { class: 'mf-할일', text: '내 제시어를 확인하세요' }));
    el.appendChild(요소('p', { class: 'sub', text: '위 카드를 꾹 누르면 보입니다. 10초 뒤 설명이 시작됩니다.' }));
  } else if (view.phase === '설명') {
    el.appendChild(요소('div', {
      class: 'mf-할일',
      text: view.내차례 ? '내 차례! 한 문장으로 설명하세요' : `${view.발언자 || ''} 님이 설명하는 중`
    }));
    el.appendChild(요소('p', { class: 'sub', text: '제시어를 그대로 말하면 안 됩니다. 라이어가 눈치채지 못하게 설명하세요.' }));
  } else if (view.phase === '토론') {
    el.appendChild(요소('div', { class: 'mf-할일', text: '자유 토론' }));
    el.appendChild(요소('p', { class: 'sub', text: '누가 라이어인지 이야기해보세요. 곧 투표합니다.' }));
  } else if (view.phase === '투표') {
    투표(el, view, 보내기);
  } else if (view.phase === '맞히기') {
    if (view.맞히기차례) 맞히기(el, 보내기);
    else el.appendChild(요소('div', { class: 'wait', text: `라이어 ${view.들킨라이어 || ''} 님이 제시어를 맞히는 중입니다` }));
  }
}

// ── 제시어 카드 — 꾹 누르는 동안만 ──────────────────────────
function 제시어카드(view) {
  const 가린글 = '내 제시어 보기';
  const 글 = 요소('span', { class: 'mf-카드글', text: 가린글 });
  const 안내 = 요소('span', { class: 'mf-카드안내', text: '꾹 누르고 있는 동안만 보입니다' });
  const 카드 = 요소('button', { class: 'mf-카드' }, [글, 안내]);

  const 보이기 = (e) => {
    e.preventDefault();
    카드.classList.add('열림');
    글.textContent = view.내가라이어 ? '당신은 라이어' : (view.제시어 || '?');
    안내.textContent = view.내가라이어
      ? '제시어를 모릅니다. 아는 척 연기하세요.'
      : '라이어에게 들키지 않게 설명하세요.';
  };
  const 가리기 = () => {
    카드.classList.remove('열림');
    글.textContent = 가린글;
    안내.textContent = '꾹 누르고 있는 동안만 보입니다';
  };

  카드.addEventListener('touchstart', 보이기, { passive: false });
  카드.addEventListener('touchend', 가리기);
  카드.addEventListener('touchcancel', 가리기);
  카드.addEventListener('mousedown', 보이기);
  카드.addEventListener('mouseup', 가리기);
  카드.addEventListener('mouseleave', 가리기);
  // 손을 안 뗀 채로 화면이 바뀌어도 가려지도록
  window.addEventListener('blur', 가리기, { once: true });

  return 카드;
}

// ── 투표 ────────────────────────────────────────────────────
function 투표(el, view, 보내기) {
  el.appendChild(요소('div', { class: 'mf-할일', text: '라이어 같은 사람을 고르세요' }));
  const grid = 요소('div', { class: 'mf-고르기' });
  for (const p of view.고를사람 || []) {
    grid.appendChild(요소('button', {
      class: 'mf-고름칸' + (p.id === view.내표id ? ' 고름' : ''),
      text: p.name,
      onclick: () => 보내기({ act: '투표', target: p.id })
    }));
  }
  el.appendChild(grid);
  el.appendChild(요소('p', {
    class: 'sub',
    text: view.내표 ? `${view.내표} 님을 골랐습니다. 모두 낼 때까지 바꿀 수 있어요.` : '한 명을 눌러 투표하세요.'
  }));
}

// ── 라이어가 지목됐을 때 — 제시어 맞히기 ────────────────────
function 맞히기(el, 보내기) {
  el.appendChild(요소('div', { class: 'mf-할일', text: '들켰습니다! 제시어를 맞히면 역전승' }));
  const 입력칸 = 요소('input', {
    class: 'name', type: 'text', maxlength: '20',
    placeholder: '제시어는?', autocomplete: 'off', enterkeyhint: 'send'
  });
  const 버튼 = 요소('button', { class: 'cs-보내기', text: '제출' });
  const 내자 = () => {
    const v = 입력칸.value.trim();
    if (!v) return;
    버튼.disabled = true;
    보내기({ act: '맞히기', answer: v });
  };
  버튼.addEventListener('click', 내자);
  입력칸.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); 내자(); }
  });
  el.appendChild(입력칸);
  el.appendChild(버튼);
  el.appendChild(요소('p', { class: 'sub', text: '한 번만 낼 수 있습니다.' }));
  setTimeout(() => 입력칸.focus(), 80);
}

// ── 판 결과 ─────────────────────────────────────────────────
function 결과(el, view) {
  const r = view.판결과;
  if (!r) return;
  el.appendChild(요소('div', {
    class: 'cs-p맞음' + (r.승 === '시민' ? '' : ' 없음'),
    text: r.승 === '시민' ? '시민 승리!' : '라이어 승리!'
  }));
  const box = 요소('div', { class: 'p-공개' }, [
    줄('라이어', r.라이어),
    줄('제시어', r.제시어)
  ]);
  for (const x of r.점수 || []) box.appendChild(줄(x.name, `+${x.점수}`));
  el.appendChild(box);

  if (view.phase === '끝') {
    const 합 = 요소('div', { class: 'p-공개' });
    (view.누적 || []).forEach((x, i) => 합.appendChild(줄(`${i + 1}위 ${x.name}`, `${x.점수}점`)));
    el.appendChild(합);
  }
  el.appendChild(요소('div', {
    class: 'wait',
    text: view.phase === '끝' ? '게임이 끝났습니다' : 'TV 화면을 봐주세요'
  }));
}

function 줄(왼, 오) {
  return 요소('div', { class: 'p-공개줄' }, [요소('span', { text: 왼 }), 요소('b', { text: 오 })]);
}
