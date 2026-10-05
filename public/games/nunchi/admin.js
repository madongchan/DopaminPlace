// 눈치 게임 — 진행자
// 판정 근거(누가 누구와 몇 초 차이로 겹쳤는지)를 보여준다.
// 서버가 받은 시각으로 판정하므로, 억울하다는 말이 나오면 이 로그를 보고 설명한다.
import { 요소, 비우기, 타이머붙이기 } from '/js/components.js';

export function 그리기(el, current, 조작) {
  const view = current.view;
  비우기(el);

  const 숫자 = 요소('span', { class: 'a-초' });
  el.appendChild(요소('div', { class: 'a-g머리' }, [
    요소('span', { class: 'a-g라운드', text: `${view.판}/${view.총판} 판` }),
    요소('span', { class: 'a-g제시어', text: 상태말(view) }),
    숫자
  ]));
  if (view.phase === '진행') 타이머붙이기(숫자, view.endsAt);

  // 누른 순서
  const 줄 = 요소('div', { class: 'a-nc순서' });
  if (!view.누른사람 || !view.누른사람.length) {
    줄.appendChild(요소('span', { class: 'a-도움', text: '아직 아무도 안 눌렀습니다' }));
  } else {
    for (const x of view.누른사람) {
      줄.appendChild(요소('span', {
        class: 'a-nc칸' + (x.탈락 ? ' 탈락' : ''),
        text: `${x.순서}. ${x.name}${x.탈락 ? ' (탈락)' : ''}`
      }));
    }
  }
  el.appendChild(줄);

  el.appendChild(요소('div', { class: 'a-미제출' }, [
    요소('span', { class: 'a-라벨', text: '남은 사람' }),
    요소('span', { text: `${view.남은사람}명 · 이번 판 탈락 ${view.탈락수}명` })
  ]));

  // 판정 근거
  const 로그 = view.판정로그 || [];
  if (로그.length) {
    const box = 요소('div', { class: 'a-nc로그' }, [요소('span', { class: 'a-라벨', text: '판정 기록' })]);
    for (const 한줄 of 로그) box.appendChild(요소('div', { class: 'a-nc로그줄', text: 한줄 }));
    el.appendChild(box);
  }

  // 버튼
  const 버튼들 = 요소('div', { class: 'rowbtns' });
  if (view.phase === '진행') {
    버튼들.appendChild(요소('button', { class: 'sm', text: '지금 판 끝내기', onclick: () => 조작('지금끝') }));
  } else if (view.phase === '끝') {
    버튼들.appendChild(요소('span', {
      class: 'a-도움', text: '3판이 다 끝났습니다. 아래 「끝내고 점수 주기」를 누르세요.'
    }));
  } else {
    버튼들.appendChild(요소('button', {
      class: 'sm', text: view.판 === 0 ? '첫 판 시작' : '다음 판', onclick: () => 조작('다음')
    }));
  }
  el.appendChild(버튼들);
}

function 상태말(view) {
  if (view.phase === '진행') return '누르는 중';
  if (view.phase === '대기') return '시작 전';
  if (view.phase === '끝') return '게임 끝';
  return '판 끝';
}
