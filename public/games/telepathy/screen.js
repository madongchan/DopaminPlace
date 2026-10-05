// 텔레파시 — 큰 화면(TV)
// 서버가 보낸 뷰만 그린다. 입력 중에는 답이 아예 오지 않으므로 그릴 것도 없다.
import { 요소, 비우기, 타이머붙이기, 타이머띠, 제출바, 팀사전, 팀색 } from '/js/components.js';

export function 그리기(el, { view, name }, 화면뷰) {
  비우기(el);
  const 팀 = 팀사전(화면뷰.teams);

  // 위: 게임 이름 · 라운드
  el.appendChild(요소('div', { class: 'g-머리' }, [
    요소('span', { class: 'g-이름', text: name }),
    요소('span', { class: 'g-라운드', text: `${view.round} / ${view.총라운드}` })
  ]));

  // 제시어
  el.appendChild(요소('div', { class: 'tp-제시어' }, [
    요소('span', { text: view.prompt || '' })
  ]));

  if (view.phase === 'input') 입력화면(el, view, 팀);
  else 공개화면(el, view, 팀);

  // 아래: 팀 누적
  el.appendChild(팀누적(view.팀총점, 팀));
}

// ── 입력 중 ─────────────────────────────────────────────────
function 입력화면(el, view, 팀) {
  const 띠 = 요소('div', { class: 'tp-띠' });
  const 숫자 = 요소('div', { class: 'tp-초' });

  el.appendChild(요소('div', { class: 'tp-타이머' }, [숫자, 띠]));
  타이머붙이기(숫자, view.endsAt);
  타이머띠(띠, view.endsAt, 20);

  el.appendChild(요소('div', { class: 'tp-안내', text: '휴대폰에 답을 적어주세요' }));
  el.appendChild(제출바(view.제출현황, 팀));
}

// ── 공개 ────────────────────────────────────────────────────
function 공개화면(el, view, 팀) {
  const 결과 = view.공개결과?.결과 || {};
  const wrap = 요소('div', { class: 'tp-공개' });

  for (const [tid, r] of Object.entries(결과)) {
    const t = 팀[tid] || {};
    const 색 = 팀색(t.colorId);

    const 카드 = 요소('div', { class: 'tp-팀카드', style: { borderColor: 색 } }, [
      요소('div', { class: 'tp-팀머리' }, [
        요소('span', { class: 'tp-팀이름', text: t.name || `${tid}팀`, style: { color: 색 } }),
        요소('span', { class: 'tp-팀점수', text: `+${r.점수}`, style: { color: 색 } })
      ])
    ]);

    const 답들 = 요소('div', { class: 'tp-답들' });
    for (const 묶음 of r.묶음 || []) {
      const 최다 = 묶음.정규화 === r.다수답 && 묶음.수 >= 2;
      답들.appendChild(요소('div', {
        class: 'tp-답' + (최다 ? ' 최다' : ''),
        style: 최다 ? { borderColor: 색, color: 색 } : {}
      }, [
        요소('span', { class: 'tp-답글', text: 묶음.답 }),
        묶음.수 >= 2 ? 요소('span', { class: 'tp-답수', text: `×${묶음.수}` }) : null
      ]));
    }
    if (!(r.묶음 || []).length) {
      답들.appendChild(요소('div', { class: 'tp-답없음', text: '아무도 안 냈어요' }));
    }

    카드.appendChild(답들);
    wrap.appendChild(카드);
  }
  el.appendChild(wrap);
}

// ── 팀 누적 ─────────────────────────────────────────────────
function 팀누적(총점, 팀) {
  const wrap = 요소('div', { class: 'tp-누적' });
  const 정렬 = Object.entries(총점 || {}).sort((a, b) => b[1] - a[1]);
  for (const [tid, 점] of 정렬) {
    const t = 팀[tid] || {};
    wrap.appendChild(요소('div', { class: 'tp-누적칸' }, [
      요소('span', { class: 'tp-누적팀', text: t.name || `${tid}팀`, style: { color: 팀색(t.colorId) } }),
      요소('span', { class: 'tp-누적점', text: String(점) })
    ]));
  }
  return wrap;
}
