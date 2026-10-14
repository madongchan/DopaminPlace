// 끈끈이 동전잡기 — 큰 화면(TV)
// 게임은 화면 밖에서 한다. TV에는 진행자가 입력한 등수만 띄운다.
import { 요소, 비우기, 팀사전, 팀색, 팀글자색 } from '/js/components.js';

const 등수점수 = [5];   // 1등 팀만 점수 (server/scoring.js 팀등수점수와 같게)

export function 그리기(el, { view, name }, 화면뷰) {
  비우기(el);
  const 팀 = 팀사전(화면뷰.teams);

  el.appendChild(요소('div', { class: 'g-머리' }, [
    요소('span', { class: 'g-이름', text: name }),
    요소('span', { class: 'g-라운드', text: '오프라인' })
  ]));

  const 순위 = view.순위 || [];
  el.appendChild(요소('div', {
    class: 'tp-안내',
    text: 순위.length ? '결과' : '게임 진행 중 — 끝나면 진행자가 등수를 입력합니다'
  }));

  const wrap = 요소('div', { class: 'cs-맞힌' });
  순위.forEach((tid, i) => {
    const t = 팀[tid] || {};
    wrap.appendChild(요소('div', { class: 'cs-맞힌칸', style: { borderColor: 팀색(t.colorId) } }, [
      요소('span', { class: 'cs-맞힌순서', text: `${i + 1}등` }),
      요소('span', { class: 'cs-맞힌팀', text: t.name || `${tid}팀`, style: { color: 팀글자색(t.colorId) } }),
      요소('span', { class: 'cs-맞힌이름', text: '' }),
      요소('span', { class: 'cs-맞힌점', text: `+${등수점수[i] ?? 0}`, style: { color: 팀글자색(t.colorId) } })
    ]));
  });
  el.appendChild(wrap);
}
