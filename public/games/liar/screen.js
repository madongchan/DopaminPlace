// 라이어 게임 — 큰 화면(TV)
// TV는 라이어를 포함한 모두가 본다. 그래서 제시어는 판이 끝나기 전까지 여기 오지 않는다.
// 누가 라이어인지도 투표로 지목되기 전까지는 서버가 보내주지 않는다. 여기서 숨기는 게 아니다.
import { 요소, 비우기, 타이머붙이기, 타이머띠 } from '/js/components.js';

const 단계길이 = { 설명: 20, 토론: 60, 투표: 30, 맞히기: 20 };
// 한 판이 흘러가는 순서. 위쪽에 늘 띄워 지금 어디인지 보이게 한다.
const 흐름 = [['설명', '설명'], ['토론', '토론'], ['투표', '투표'], ['맞히기', '라이어의 반격']];

export function 그리기(el, { view, name }) {
  비우기(el);

  el.appendChild(요소('div', { class: 'g-머리' }, [
    요소('span', { class: 'g-이름', text: name }),
    요소('span', { class: 'g-라운드', text: `${view.round} / ${view.총라운드} 판` })
  ]));

  if (view.phase === '판끝' || view.phase === '끝') { 결과(el, view); return; }

  el.appendChild(요소('div', { class: 'mf-흐름' }, 흐름.map(([id, 글]) =>
    요소('span', { class: 'mf-흐름칸' + (id === view.phase ? ' 지금' : ''), text: 글 }))));

  el.appendChild(요소('div', { class: 'lr-카테고리' }, [
    요소('span', { class: 'lr-카테고리말', text: '카테고리' }),
    요소('span', { class: 'lr-카테고리글', text: view.카테고리 || '' })
  ]));

  const 숫자 = 요소('div', { class: 'tp-초' });
  const 띠 = 요소('div', { class: 'tp-띠' });
  el.appendChild(요소('div', { class: 'tp-타이머' }, [숫자, 띠]));
  타이머붙이기(숫자, view.endsAt);
  타이머띠(띠, view.endsAt, 단계길이[view.phase] || 30);

  if (view.phase === '설명') 설명(el, view);
  else if (view.phase === '토론') {
    el.appendChild(요소('div', { class: 'tp-안내', text: '자유 토론 — 누가 라이어일까요?' }));
  } else if (view.phase === '투표') {
    const c = view.투표현황 || { 낸사람: 0, 전체: 0 };
    el.appendChild(요소('div', { class: 'tp-안내', text: '휴대폰에서 라이어 같은 사람을 고르세요' }));
    el.appendChild(요소('div', { class: 'mf-센것' }, [
      요소('span', { class: 'mf-센수', text: `${c.낸사람}` }),
      요소('span', { class: 'mf-센말', text: `/ ${c.전체} 명이 투표했습니다` })
    ]));
  } else if (view.phase === '맞히기') {
    el.appendChild(요소('div', { class: 'mf-변론' }, [
      요소('span', { class: 'mf-변론말', text: '라이어가 지목됐습니다' }),
      요소('span', { class: 'mf-변론이름', text: view.들킨라이어 || '' })
    ]));
    el.appendChild(요소('div', { class: 'tp-안내', text: '라이어가 제시어를 맞히면 역전승입니다' }));
  }
}

// ── 한 사람씩 설명 ──────────────────────────────────────────
function 설명(el, view) {
  const 순서 = view.순서 || [];
  el.appendChild(요소('div', { class: 'mf-변론' }, [
    요소('span', { class: 'mf-변론말', text: `${view.발언번호 + 1} / ${순서.length} 번째 설명` }),
    요소('span', { class: 'mf-변론이름', text: view.발언자 || '' })
  ]));
  const 줄 = 요소('div', { class: 'mf-사람들' });
  순서.forEach((p, i) => {
    줄.appendChild(요소('div', {
      class: 'mf-사람' + (i < view.발언번호 ? ' lr-끝' : '') + (i === view.발언번호 ? ' lr-지금' : '')
    }, [요소('span', { class: 'mf-사람이름', text: p.name })]));
  });
  el.appendChild(줄);
}

// ── 판 결과 — 이때 비로소 라이어와 제시어가 공개된다 ────────
function 결과(el, view) {
  const r = view.판결과;
  if (!r) return;

  el.appendChild(요소('div', { class: 'mf-결과' + (r.승 === '시민' ? ' 시민' : ' 마피아') }, [
    요소('span', { text: r.승 === '시민' ? '시민 승리!' : '라이어 승리!' })
  ]));
  el.appendChild(요소('div', { class: 'lr-공개' }, [
    요소('div', { class: 'lr-공개칸' }, [요소('span', { class: 'lr-공개말', text: '라이어' }), 요소('b', { text: r.라이어 })]),
    요소('div', { class: 'lr-공개칸' }, [요소('span', { class: 'lr-공개말', text: '제시어' }), 요소('b', { text: r.제시어 })])
  ]));
  el.appendChild(요소('div', { class: 'tp-안내', text: 풀이(r) }));

  if (r.득표?.length) el.appendChild(칩줄('받은 표', r.득표.map(x => [x.name, `${x.표수}표`])));
  if (r.점수?.length) el.appendChild(칩줄('이번 판 점수', r.점수.map(x => [x.name, `+${x.점수}`])));

  if (view.phase === '끝') {
    el.appendChild(칩줄('합계', (view.누적 || []).map((x, i) => [`${i + 1}위 ${x.name}`, `${x.점수}점`])));
  } else {
    el.appendChild(요소('div', { class: 'mf-기록' }, [
      요소('div', { class: 'mf-기록줄', text: '진행자가 다음 판을 시작합니다' })
    ]));
  }
}

function 풀이(r) {
  if (!r.잡혔나) return '라이어를 찾아내지 못했습니다';
  if (r.승 === '라이어') {
    return r.인정
      ? `라이어를 찾았지만, 라이어가 쓴 「${r.추측}」을 정답으로 인정했습니다`
      : `라이어를 찾았지만, 라이어가 제시어를 맞혔습니다`;
  }
  return r.추측
    ? `라이어를 찾았고, 라이어가 쓴 「${r.추측}」은 틀렸습니다`
    : '라이어를 찾았고, 라이어는 답을 내지 못했습니다';
}

function 칩줄(제목, 줄들) {
  const wrap = 요소('div', { class: 'mf-득표' }, [요소('span', { class: 'lr-칩제목', text: 제목 })]);
  for (const [이름, 값] of 줄들) {
    wrap.appendChild(요소('div', { class: 'mf-득표칸' }, [
      요소('span', { class: 'mf-득표이름', text: 이름 }),
      요소('span', { class: 'mf-득표수', text: 값 })
    ]));
  }
  return wrap;
}
