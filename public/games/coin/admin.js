// 끈끈이 동전잡기 — 진행자
// 게임이 끝나면 1등부터 순서대로 팀을 누른다. 잘못 눌렀으면 되돌린다.
import { 요소, 비우기, 팀사전, 팀색, 팀글자색 } from '/js/components.js';

export function 그리기(el, current, 조작, 진행자뷰) {
  const view = current.view;
  const 팀 = 팀사전(진행자뷰.teams);
  const 이름 = (tid) => 팀[tid]?.name || `${tid}팀`;
  비우기(el);

  const 순위 = view.순위 || [];
  el.appendChild(요소('div', { class: 'a-미제출' }, [
    요소('span', { class: 'a-라벨', text: '입력한 등수' }),
    요소('span', { text: 순위.length ? 순위.map((t, i) => `${i + 1}등 ${이름(t)}`).join(' · ') : '아직 없습니다' })
  ]));

  const 버튼들 = 요소('div', { class: 'rowbtns' });
  const 남은 = view.남은팀 || [];
  if (남은.length) {
    버튼들.appendChild(요소('span', { class: 'a-라벨', text: `${순위.length + 1}등 팀을 누르세요` }));
    for (const tid of 남은) {
      버튼들.appendChild(요소('button', {
        class: 'sm ghost', text: 이름(tid),
        style: { borderColor: 팀색(팀[tid]?.colorId), color: 팀글자색(팀[tid]?.colorId) },
        onclick: () => 조작('등수', { teamId: tid })
      }));
    }
  } else {
    버튼들.appendChild(요소('span', { class: 'a-도움', text: '다 입력했습니다. 아래 「끝내고 점수 주기」를 누르세요.' }));
  }
  if (순위.length) {
    버튼들.appendChild(요소('button', { class: 'sm ghost', text: '되돌리기', onclick: () => 조작('되돌리기') }));
  }
  el.appendChild(버튼들);
}
