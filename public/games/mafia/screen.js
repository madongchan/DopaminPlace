// 마피아 — 큰 화면(TV)
// 밤에는 어둡게, 낮에는 밝게. 단계마다 할 일을 한 줄로 크게 알려준다.
// 역할은 게임이 끝나기 전까지 서버가 보내주지 않는다. 여기서 숨기는 게 아니다.
import { 요소, 비우기, 타이머붙이기, 타이머띠, 팀사전, 팀글자색 } from '/js/components.js';

const 단계글 = {
  밤: '밤이 되었습니다',
  아침: '아침이 밝았습니다',
  토론: '토론 시간',
  지목투표: '지목 투표',
  최후변론: '최후 변론',
  찬반투표: '찬반 투표',
  끝: '게임 끝'
};
const 단계안내 = {
  밤: '모두 휴대폰에서 한 사람을 고르세요',
  아침: '지난밤에 무슨 일이 있었을까요',
  토론: '누가 마피아일지 이야기해보세요',
  지목투표: '휴대폰에서 한 명을 지목하거나 기권하세요',
  최후변론: '지목된 사람이 마지막으로 말합니다',
  찬반투표: '처형에 찬성인지 반대인지 고르세요'
};
const 단계길이 = { 밤: 60, 아침: 20, 토론: 120, 지목투표: 30, 최후변론: 30, 찬반투표: 15 };

export function 그리기(el, { view, name }, 화면뷰) {
  비우기(el);
  const 팀 = 팀사전(화면뷰.teams);
  el.classList.toggle('밤중', view.phase === '밤');

  el.appendChild(요소('div', { class: 'g-머리' }, [
    요소('span', { class: 'g-이름', text: name }),
    요소('span', { class: 'g-라운드', text: `${view.day} / ${view.총일수} 일차` })
  ]));

  if (view.결과) { 끝화면(el, view, 팀); return; }

  // 단계 이름 + 타이머
  el.appendChild(요소('div', { class: 'mf-단계' }, [
    요소('span', { class: 'mf-단계글', text: 단계글[view.phase] || view.phase }),
    view.일시정지 ? 요소('span', { class: 'mf-멈춤', text: '잠시 멈춤' }) : null
  ]));

  if (view.endsAt && !view.일시정지) {
    const 숫자 = 요소('div', { class: 'tp-초' });
    const 띠 = 요소('div', { class: 'tp-띠' });
    el.appendChild(요소('div', { class: 'tp-타이머' }, [숫자, 띠]));
    타이머붙이기(숫자, view.endsAt);
    타이머띠(띠, view.endsAt, 단계길이[view.phase] || 60);
  }

  // 단계별 가운데 내용
  if (view.phase === '아침') 아침(el, view);
  else if (view.phase === '최후변론') 변론(el, view);
  else if (view.phase === '찬반투표') 찬반(el, view);
  else if (view.phase === '지목투표') 투표중(el, view);
  else el.appendChild(요소('div', { class: 'tp-안내', text: 단계안내[view.phase] || '' }));

  if (view.처형소식 && view.phase !== '찬반투표') 처형알림(el, view);
  if (view.phase !== '지목투표' && view.득표?.length) 득표판(el, view);

  el.appendChild(사람들칸(view, 팀));
  el.appendChild(기록칸(view));
}

// ── 아침 ────────────────────────────────────────────────────
function 아침(el, view) {
  const 소식 = view.아침소식 || {};
  el.appendChild(요소('div', { class: 'mf-소식' }, [
    소식.죽은사람
      ? 요소('span', { class: 'mf-죽음', text: `${소식.죽은사람} 님이 당했습니다` })
      : 요소('span', { class: 'mf-무사', text: '아무 일도 없었습니다' })
  ]));
  if (소식.의심받은사람) {
    el.appendChild(요소('div', { class: 'mf-의심' }, [
      요소('span', { class: 'mf-의심말', text: '가장 의심받은 사람' }),
      요소('span', { class: 'mf-의심이름', text: 소식.의심받은사람 })
    ]));
  }
}

// ── 최후 변론 ───────────────────────────────────────────────
function 변론(el, view) {
  el.appendChild(요소('div', { class: 'mf-변론' }, [
    요소('span', { class: 'mf-변론말', text: '최후 변론' }),
    요소('span', { class: 'mf-변론이름', text: view.최다득표 || '' })
  ]));
}

// ── 찬반 투표 ───────────────────────────────────────────────
function 찬반(el, view) {
  el.appendChild(요소('div', { class: 'mf-변론' }, [
    요소('span', { class: 'mf-변론말', text: '처형할까요?' }),
    요소('span', { class: 'mf-변론이름', text: view.최다득표 || '' })
  ]));
  const c = view.찬반현황 || { 낸사람: 0, 전체: 0 };
  el.appendChild(요소('div', { class: 'tp-안내', text: `${c.낸사람} / ${c.전체} 명이 냈습니다` }));
}

// ── 지목 투표 중 ────────────────────────────────────────────
function 투표중(el, view) {
  const c = view.투표현황 || { 낸사람: 0, 전체: 0 };
  el.appendChild(요소('div', { class: 'tp-안내', text: 단계안내.지목투표 }));
  el.appendChild(요소('div', { class: 'mf-센것' }, [
    요소('span', { class: 'mf-센수', text: `${c.낸사람}` }),
    요소('span', { class: 'mf-센말', text: `/ ${c.전체} 명이 냈습니다` })
  ]));
}

function 처형알림(el, view) {
  const p = view.처형소식;
  el.appendChild(요소('div', { class: 'mf-처형' + (p.처형 ? '' : ' 무죄') }, [
    요소('span', {
      text: p.처형 ? `${p.name} 님이 처형되었습니다` : '처형하지 않았습니다'
    }),
    요소('span', { class: 'mf-처형수', text: `찬성 ${p.찬성} · 반대 ${p.반대}` })
  ]));
}

function 득표판(el, view) {
  const wrap = 요소('div', { class: 'mf-득표' });
  for (const x of view.득표) {
    wrap.appendChild(요소('div', { class: 'mf-득표칸' }, [
      요소('span', { class: 'mf-득표이름', text: x.name }),
      요소('span', { class: 'mf-득표수', text: `${x.표수}표` })
    ]));
  }
  el.appendChild(wrap);
}

// ── 생존자 카드 ─────────────────────────────────────────────
function 사람들칸(view, 팀) {
  const grid = 요소('div', { class: 'mf-사람들' });
  for (const p of view.사람들 || []) {
    grid.appendChild(요소('div', { class: 'mf-사람' + (p.살아있나 ? '' : ' 죽음') }, [
      요소('span', {
        class: 'mf-사람이름', text: p.name,
        style: p.살아있나 ? { color: 팀글자색((팀[p.teamId] || {}).colorId) } : {}
      }),
      p.살아있나 ? null : 요소('span', { class: 'mf-사람딱지', text: '탈락' })
    ]));
  }
  return grid;
}

function 기록칸(view) {
  const wrap = 요소('div', { class: 'mf-기록' });
  for (const 줄 of (view.기록 || []).slice(-3)) {
    wrap.appendChild(요소('div', { class: 'mf-기록줄', text: 줄 }));
  }
  return wrap;
}

// ── 끝 — 이때 비로소 역할이 공개된다 ────────────────────────
function 끝화면(el, view, 팀) {
  el.appendChild(요소('div', { class: 'mf-결과' + (view.결과 === '시민승' ? ' 시민' : ' 마피아') }, [
    요소('span', { text: view.결과 === '시민승' ? '시민 승리!' : '마피아 승리!' })
  ]));

  const 표 = 요소('div', { class: 'mf-역할표' });
  for (const x of view.역할공개 || []) {
    표.appendChild(요소('div', {
      class: 'mf-역할칸' + (x.역할 === '마피아' ? ' 마피아' : '') + (x.살아있나 ? '' : ' 죽음')
    }, [
      요소('span', { class: 'mf-역할이름', text: x.name }),
      요소('span', { class: 'mf-역할글', text: x.역할 })
    ]));
  }
  el.appendChild(표);
  el.appendChild(기록칸(view));
  void 팀;
}
