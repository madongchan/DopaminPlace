// 초성 퀴즈 — 큰 화면(TV)
// 초성을 크게 보여주고, 어느 팀이 몇 번째로 맞혔는지를 순서대로 띄운다.
// 정답은 서버가 공개 단계에서만 보내준다 — 푸는 중에는 뷰에 아예 없다.
import { 요소, 비우기, 타이머붙이기, 타이머띠, 팀사전, 팀색, 팀글자색 } from '/js/components.js';

export function 그리기(el, { view, name }, 화면뷰) {
  비우기(el);
  const 팀 = 팀사전(화면뷰.teams);

  el.appendChild(요소('div', { class: 'g-머리' }, [
    요소('span', { class: 'g-이름', text: name }),
    요소('span', { class: 'g-라운드', text: `${view.round} / ${view.총라운드} 문제` })
  ]));

  // 초성
  el.appendChild(요소('div', { class: 'cs-초성' }, [요소('span', { text: view.초성 || '' })]));

  if (view.phase === 'input') {
    const 숫자 = 요소('div', { class: 'tp-초' });
    const 띠 = 요소('div', { class: 'tp-띠' });
    el.appendChild(요소('div', { class: 'tp-타이머' }, [숫자, 띠]));
    타이머붙이기(숫자, view.endsAt);
    타이머띠(띠, view.endsAt, 30);
  } else {
    // 공개 — 정답을 크게
    el.appendChild(요소('div', { class: 'cs-정답' }, [
      요소('span', { class: 'cs-정답말', text: '정답' }),
      요소('span', { class: 'cs-정답글', text: view.정답 || '' })
    ]));
  }

  // 힌트 (15초가 지나면 열린다)
  if (view.힌트) {
    el.appendChild(요소('div', { class: 'cs-힌트' }, [
      요소('span', { class: 'cs-힌트말', text: '힌트' }),
      요소('span', { text: view.힌트 })
    ]));
  } else if (view.phase === 'input') {
    el.appendChild(요소('div', { class: 'cs-힌트 닫힘', text: '15초가 지나면 힌트가 열립니다' }));
  }

  el.appendChild(맞힌칸(view, 팀));
  el.appendChild(팀누적(view.팀총점, 팀));
}

// ── 맞힌 순서 ───────────────────────────────────────────────
function 맞힌칸(view, 팀) {
  const wrap = 요소('div', { class: 'cs-맞힌' });
  const 맞힌 = view.맞힌 || [];
  if (!맞힌.length) {
    wrap.appendChild(요소('div', {
      class: 'tp-답없음',
      text: view.phase === 'input' ? '아직 맞힌 팀이 없습니다' : '아무도 못 맞혔습니다'
    }));
    return wrap;
  }
  for (const x of 맞힌) {
    const t = 팀[x.teamId] || {};
    const 색 = 팀색(t.colorId);
    const 글자색 = 팀글자색(t.colorId);
    wrap.appendChild(요소('div', { class: 'cs-맞힌칸', style: { borderColor: 색 } }, [
      요소('span', { class: 'cs-맞힌순서', text: `${x.순서}등` }),
      요소('span', { class: 'cs-맞힌팀', text: t.name || `${x.teamId}팀`, style: { color: 글자색 } }),
      요소('span', { class: 'cs-맞힌이름', text: x.name }),
      요소('span', { class: 'cs-맞힌점', text: `+${x.점수}`, style: { color: 글자색 } }),
      x.인정 ? 요소('span', { class: 'cs-인정', text: '인정' }) : null
    ]));
  }
  return wrap;
}

// ── 팀 누적 ─────────────────────────────────────────────────
function 팀누적(총점, 팀) {
  const wrap = 요소('div', { class: 'tp-누적' });
  const 정렬 = Object.entries(총점 || {}).sort((a, b) => b[1] - a[1]);
  for (const [tid, 점] of 정렬) {
    const t = 팀[tid] || {};
    wrap.appendChild(요소('div', { class: 'tp-누적칸' }, [
      요소('span', { class: 'tp-누적팀', text: t.name || `${tid}팀`, style: { color: 팀글자색(t.colorId) } }),
      요소('span', { class: 'tp-누적점', text: String(점) })
    ]));
  }
  return wrap;
}
