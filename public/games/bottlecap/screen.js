// 병뚜껑 던지기 — 큰 화면(TV)
// 오프라인 게임이라 사람들이 TV를 보며 던진다.
// '지금 던지는 사람'을 가장 크게, 남은 기회와 팀별 누적을 함께 보여준다.
import { 요소, 비우기, 팀사전, 팀색, 팀글자색 } from '/js/components.js';

export function 그리기(el, { view, name }, 화면뷰) {
  비우기(el);
  const 팀 = 팀사전(화면뷰.teams);

  el.appendChild(요소('div', { class: 'g-머리' }, [
    요소('span', { class: 'g-이름', text: name }),
    요소('span', {
      class: 'g-라운드',
      text: `${view.진행.던진수} / ${view.진행.총던지기} 번`
    })
  ]));

  if (view.phase === 'done' || !view.지금차례) {
    el.appendChild(요소('div', { class: 'tp-안내', text: '모두 던졌습니다' }));
  } else {
    el.appendChild(지금차례칸(view, 팀));
  }

  el.appendChild(팀누적칸(view.팀누적, 팀));
  el.appendChild(개인칸(view.개인기록, 팀));
}

// ── 지금 던지는 사람 ────────────────────────────────────────
function 지금차례칸(view, 팀) {
  const t = 팀[view.지금차례.teamId] || {};
  const 색 = 팀색(t.colorId);

  const wrap = 요소('div', { class: 'bc-차례', style: { borderColor: 색 } }, [
    요소('span', { class: 'bc-차례말', text: '지금 던지는 사람' }),
    요소('span', { class: 'bc-차례이름', text: view.지금차례.name, style: { color: 팀글자색(t.colorId) } }),
    요소('span', { class: 'bc-차례팀', text: t.name || `${view.지금차례.teamId}팀` })
  ]);

  // 남은 기회 — 뚜껑 세 개
  const 기회 = 요소('div', { class: 'bc-기회' });
  for (let i = 0; i < 3; i++) {
    기회.appendChild(요소('span', {
      class: 'bc-뚜껑' + (i < view.남은기회 ? '' : ' 씀'),
      style: i < view.남은기회 ? { background: 팀글자색(t.colorId) } : {}
    }));
  }
  wrap.appendChild(기회);

  // 이번 차례에 낸 점수
  const 낸것 = view.이번차례점수 || [];
  if (낸것.length) {
    const 줄 = 요소('div', { class: 'bc-이번' });
    for (const p of 낸것) {
      줄.appendChild(요소('span', { class: 'bc-이번점' + (p === 0 ? ' 빵' : ''), text: `${p}점` }));
    }
    wrap.appendChild(줄);
  }

  if (view.다음차례) {
    wrap.appendChild(요소('div', { class: 'bc-다음', text: `다음 · ${view.다음차례.name}` }));
  }
  return wrap;
}

// ── 팀별 누적 (총점 ÷ 인원) ─────────────────────────────────
function 팀누적칸(팀누적, 팀) {
  const wrap = 요소('div', { class: 'bc-팀들' });
  const 정렬 = Object.entries(팀누적 || {}).sort((a, b) => b[1].평균 - a[1].평균);
  for (const [tid, c] of 정렬) {
    const t = 팀[tid] || {};
    const 색 = 팀색(t.colorId);
    wrap.appendChild(요소('div', { class: 'bc-팀칸', style: { borderColor: 색 } }, [
      요소('span', { class: 'bc-팀이름', text: t.name || `${tid}팀`, style: { color: 팀글자색(t.colorId) } }),
      요소('span', { class: 'bc-팀평균', text: String(c.평균), style: { color: 팀글자색(t.colorId) } }),
      요소('span', { class: 'bc-팀셈', text: `${c.총점}점 ÷ ${c.인원}명` })
    ]));
  }
  return wrap;
}

// ── 개인 최고 기록 ──────────────────────────────────────────
function 개인칸(개인기록, 팀) {
  const wrap = 요소('div', { class: 'bc-개인' }, [
    요소('h3', { text: '개인 기록' })
  ]);
  // TV 1080p 안에서 아래 점수판과 겹치지 않는 줄 수만 보여준다
  const 목록 = (개인기록 || []).slice(0, 5);
  if (!목록.length) {
    wrap.appendChild(요소('div', { class: 'tp-답없음', text: '아직 없습니다' }));
    return wrap;
  }
  for (const x of 목록) {
    const t = 팀[x.teamId] || {};
    wrap.appendChild(요소('div', { class: 'bc-개인줄' }, [
      요소('span', { class: 'bc-개인이름', text: x.name, style: { color: 팀글자색(t.colorId) } }),
      요소('span', { class: 'bc-개인총', text: `${x.총점}점` }),
      요소('span', { class: 'bc-개인최고', text: `최고 ${x.최고}` })
    ]));
  }
  return wrap;
}
