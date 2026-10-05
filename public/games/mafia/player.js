// 마피아 — 참가자 휴대폰
//
// 역할 카드는 **꾹 누르고 있는 동안만** 보인다 (SPEC 5-5).
// 옆 사람이 흘깃 보는 것을 막으려는 장치다. 손을 떼면 바로 가려진다.
//
// 남의 역할은 서버가 보내주지 않는다. 여기서 가리는 것이 아니다.
import { 요소, 비우기, 타이머붙이기 } from '/js/components.js';

const 역할설명 = {
  마피아: '밤마다 한 명을 제거합니다. 동료를 알고 있습니다.',
  경찰: '밤마다 한 명을 조사해 마피아인지 봅니다.',
  의사: '밤마다 한 명을 지킵니다. 같은 사람을 연달아 지킬 수는 없습니다.',
  군인: '공격을 한 번 버팁니다. 아무에게도 말하지 마세요.',
  시민: '토론과 투표로 마피아를 찾아내세요.'
};
const 밤할일 = {
  마피아: '제거할 사람을 고르세요',
  경찰: '조사할 사람을 고르세요',
  의사: '지킬 사람을 고르세요',
  군인: '의심 가는 사람을 고르세요',
  시민: '의심 가는 사람을 고르세요'
};

export function 그리기(el, current, 보내기) {
  const view = current.view;
  비우기(el);

  el.appendChild(요소('div', { class: 'p-라운드', text: `${view.day} / ${view.총일수} 일차` }));

  if (view.결과) { 끝(el, view); return; }

  el.appendChild(역할카드(view));

  if (view.endsAt && !view.일시정지) {
    const 숫자 = 요소('span', { class: 'p-초' });
    el.appendChild(요소('div', { class: 'p-타이머' }, [숫자]));
    타이머붙이기(숫자, view.endsAt);
  }
  if (view.일시정지) {
    el.appendChild(요소('div', { class: 'wait', text: '진행자가 잠시 멈췄습니다' }));
    return;
  }

  if (view.phase === '밤') 밤(el, view, 보내기);
  else if (view.phase === '지목투표') 지목투표(el, view, 보내기);
  else if (view.phase === '찬반투표') 찬반투표(el, view, 보내기);
  else 기다리기(el, view);
}

// ── 역할 카드 — 꾹 누르는 동안만 ────────────────────────────
function 역할카드(view) {
  const 가린글 = view.유령인가 ? '나는 유령' : '내 역할 보기';
  const 글 = 요소('span', { class: 'mf-카드글', text: 가린글 });
  const 안내 = 요소('span', { class: 'mf-카드안내', text: '꾹 누르고 있는 동안만 보입니다' });
  const 카드 = 요소('button', { class: 'mf-카드' }, [글, 안내]);

  const 보이기 = (e) => {
    e.preventDefault();
    카드.classList.add('열림');
    글.textContent = view.내역할 || '?';
    안내.textContent = 역할설명[view.내역할] || '';
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

// ── 밤 ──────────────────────────────────────────────────────
function 밤(el, view, 보내기) {
  if (view.유령인가) {
    el.appendChild(요소('div', { class: 'mf-할일', text: '마피아일 것 같은 사람을 고르세요' }));
    el.appendChild(요소('p', { class: 'sub', text: '맞히면 끝날 때 점수를 받습니다. 말은 하지 마세요.' }));
  } else {
    el.appendChild(요소('div', { class: 'mf-할일', text: 밤할일[view.내역할] || '한 사람을 고르세요' }));
  }

  // 마피아는 동료와 동료의 선택이 보인다
  if (view.내동료 && view.내동료.length) {
    const box = 요소('div', { class: 'mf-동료' }, [
      요소('span', { class: 'mf-동료말', text: '동료' })
    ]);
    for (const x of view.내동료) {
      box.appendChild(요소('div', { class: 'mf-동료줄' + (x.살아있나 ? '' : ' 죽음') }, [
        요소('span', { text: x.name }),
        요소('span', { class: 'mf-동료지목', text: x.지목 ? `→ ${x.지목}` : '아직' })
      ]));
    }
    el.appendChild(box);
  }

  // 경찰의 조사 결과
  if (view.내조사 && view.내조사.length) {
    const box = 요소('div', { class: 'mf-조사' }, [
      요소('span', { class: 'mf-동료말', text: '내 조사 결과' })
    ]);
    for (const r of view.내조사) {
      box.appendChild(요소('div', { class: 'mf-조사줄' + (r.마피아냐 ? ' 마피아' : '') }, [
        요소('span', { text: `${r.day}일차 ${r.name}` }),
        요소('b', { text: r.마피아냐 ? '마피아!' : '아님' })
      ]));
    }
    el.appendChild(box);
  }

  if (view.내역할 === '군인' && view.군인알림) {
    el.appendChild(요소('div', {
      class: 'mf-군인알림', text: `${view.군인알림}일차 밤, 공격을 버텼습니다`
    }));
  }
  if (view.내역할 === '의사' && view.직전보호) {
    el.appendChild(요소('div', {
      class: 'p-상태', text: `어젯밤에 ${view.직전보호} 님을 지켰습니다 (연달아는 안 됩니다)`
    }));
  }

  const 지금고른것 = view.유령인가 ? view.이번예측 : view.내지목;
  el.appendChild(사람고르기(view, 지금고른것, (id) => 보내기({ act: '지목', target: id })));
}

// ── 지목 투표 ───────────────────────────────────────────────
function 지목투표(el, view, 보내기) {
  if (!view.내가살았나) { 기다리기(el, view); return; }
  el.appendChild(요소('div', { class: 'mf-할일', text: '처형할 사람을 지목하세요' }));

  const 고른사람 = (view.사람들 || []).find(p => p.id === view.내표);
  const 고른이름 = view.내표 === '기권' ? '기권' : (고른사람 ? 고른사람.name : null);

  el.appendChild(사람고르기(view, 고른이름, (id) => 보내기({ act: '지목투표', target: id })));
  el.appendChild(요소('button', {
    class: 'mf-기권' + (view.내표 === '기권' ? ' 고름' : ''),
    text: '기권',
    onclick: () => 보내기({ act: '지목투표', target: '기권' })
  }));
}

// ── 찬반 투표 ───────────────────────────────────────────────
function 찬반투표(el, view, 보내기) {
  if (!view.내가살았나) { 기다리기(el, view); return; }
  if (view.내가변론중인가) {
    el.appendChild(요소('div', { class: 'mf-할일', text: '지금 변론 중입니다' }));
    el.appendChild(요소('div', { class: 'wait', text: '본인은 투표하지 않습니다' }));
    return;
  }

  el.appendChild(요소('div', { class: 'mf-할일', text: `${view.최다득표 || ''} 님을 처형할까요?` }));
  const 줄 = 요소('div', { class: 'mf-찬반' });
  for (const 값 of ['찬성', '반대']) {
    줄.appendChild(요소('button', {
      class: 'mf-찬반버튼' + (값 === '찬성' ? ' 찬성' : ' 반대') + (view.내찬반 === 값 ? ' 고름' : ''),
      text: 값,
      onclick: () => 보내기({ act: '찬반', 값 })
    }));
  }
  el.appendChild(줄);
}

// ── 사람 고르기 (공통) ──────────────────────────────────────
function 사람고르기(view, 고른이름, 누르면) {
  const grid = 요소('div', { class: 'mf-고르기' });
  const 목록 = view.고를수있는사람 || [];
  for (const p of 목록) {
    const 버튼 = 요소('button', {
      class: 'mf-고름칸' + (p.name === 고른이름 ? ' 고름' : '') + (p.못고름 ? ' 막힘' : ''),
      text: p.name
    });
    if (p.못고름) 버튼.disabled = true;
    else 버튼.onclick = () => 누르면(p.id);
    grid.appendChild(버튼);
  }
  if (!목록.length) {
    grid.appendChild(요소('div', { class: 'wait', text: '고를 사람이 없습니다' }));
  }
  return grid;
}

// ── 기다리기 ────────────────────────────────────────────────
function 기다리기(el, view) {
  if (!view.내가살았나) {
    el.appendChild(요소('div', { class: 'mf-유령', text: '탈락했습니다' }));
    el.appendChild(요소('p', {
      class: 'sub', text: '말은 하지 마세요. 밤마다 마피아를 예측할 수 있습니다.'
    }));
  }
  el.appendChild(요소('div', { class: 'wait', text: 'TV 화면을 봐주세요' }));
}

// ── 끝 ──────────────────────────────────────────────────────
function 끝(el, view) {
  el.appendChild(요소('div', {
    class: 'mf-p결과' + (view.결과 === '시민승' ? ' 시민' : ' 마피아'),
    text: view.결과 === '시민승' ? '시민 승리!' : '마피아 승리!'
  }));
  const 표 = 요소('div', { class: 'mf-p역할표' });
  for (const x of view.역할공개 || []) {
    표.appendChild(요소('div', { class: 'mf-p역할줄' + (x.역할 === '마피아' ? ' 마피아' : '') }, [
      요소('span', { text: x.name }),
      요소('b', { text: x.역할 })
    ]));
  }
  el.appendChild(표);
}
