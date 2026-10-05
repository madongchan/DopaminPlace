// 병뚜껑 던지기 — 진행자
// 눈으로 보고 0 / 1 / 3 / 5 를 누른다. 잘못 눌렀으면 「되돌리기」.
// 되돌리기는 마지막 한 번만 지우면 차례·기회·총점이 모두 저절로 돌아간다.
import { 요소, 비우기, 팀사전, 팀색, 팀글자색 } from '/js/components.js';

export function 그리기(el, current, 조작, 진행자뷰) {
  const view = current.view;
  const 팀 = 팀사전(진행자뷰.teams);
  비우기(el);

  el.appendChild(요소('div', { class: 'a-g머리' }, [
    요소('span', { class: 'a-g라운드', text: `${view.진행.던진수}/${view.진행.총던지기}` }),
    요소('span', {
      class: 'a-g제시어',
      text: view.지금차례 ? `${view.지금차례.name} — ${view.남은기회}번 남음` : '모두 던졌습니다'
    })
  ]));

  if (view.phase !== 'done' && view.지금차례) {
    // 판정 버튼 — 크게, 손가락으로 누르기 쉽게
    const 판정 = 요소('div', { class: 'a-bc판정' });
    for (const 점 of (view.과녁점수 || [0, 1, 3, 5])) {
      판정.appendChild(요소('button', {
        class: 'a-bc점' + (점 === 0 ? ' 빵' : ''),
        text: `${점}점`,
        onclick: () => 조작('판정', { 점수: 점 })
      }));
    }
    el.appendChild(판정);

    const 낸것 = view.이번차례점수 || [];
    el.appendChild(요소('div', { class: 'a-미제출' }, [
      요소('span', { class: 'a-라벨', text: '이번 차례' }),
      요소('span', { text: 낸것.length ? 낸것.map(p => `${p}점`).join(' · ') : '아직 없음' })
    ]));
  }

  // 되돌리기 / 건너뛰기
  const 버튼들 = 요소('div', { class: 'rowbtns' });
  if (view.되돌릴것) {
    const 되 = view.되돌릴것;
    버튼들.appendChild(요소('button', {
      class: 'sm ghost',
      text: `되돌리기 (${되.name} ${되.건너뜀 ? '건너뜀' : 되.점수 + '점'})`,
      onclick: () => 조작('되돌리기')
    }));
  }
  if (view.phase !== 'done' && view.지금차례) {
    버튼들.appendChild(요소('button', {
      class: 'sm ghost', text: '이 사람 건너뛰기', onclick: () => 조작('건너뛰기')
    }));
  }
  if (view.phase === 'done') {
    버튼들.appendChild(요소('span', {
      class: 'a-도움', text: '모두 던졌습니다. 아래 「끝내고 점수 주기」를 누르세요.'
    }));
  }
  el.appendChild(버튼들);

  // 팀 누적
  const 팀줄 = 요소('div', { class: 'a-bc팀' }, [요소('span', { class: 'a-라벨', text: '팀 (총점÷인원)' })]);
  for (const [tid, c] of Object.entries(view.팀누적 || {})) {
    const t = 팀[tid] || {};
    팀줄.appendChild(요소('span', {
      class: 'a-cs칩',
      style: { borderColor: 팀색(t.colorId), color: 팀글자색(t.colorId) },
      text: `${t.name || tid + '팀'} ${c.평균} (${c.총점}÷${c.인원})`
    }));
  }
  el.appendChild(팀줄);

  // 던지는 순서
  const 순서 = view.순서목록 || [];
  if (순서.length) {
    const box = 요소('div', { class: 'a-bc순서' }, [요소('span', { class: 'a-라벨', text: '던지는 순서' })]);
    for (const x of 순서) {
      const 지금 = view.지금차례 && x.name === view.지금차례.name && !x.끝남;
      box.appendChild(요소('span', {
        class: 'a-bc순서칸' + (x.끝남 ? ' 끝남' : '') + (지금 ? ' 지금' : ''),
        text: `${x.번호}. ${x.name}`
      }));
    }
    el.appendChild(box);
  }
}
