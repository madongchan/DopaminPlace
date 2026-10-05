// 반응속도 — 진행자
// 초록으로 바뀔 시각은 여기서도 보여주지 않는다 — 진행자도 참가자이기 때문이다.
// (꼭 봐야 하면 서버의 '스포일러 보기'로만 볼 수 있다)
import { 요소, 비우기 } from '/js/components.js';

export function 그리기(el, current, 조작) {
  const view = current.view;
  비우기(el);

  el.appendChild(요소('div', { class: 'a-g머리' }, [
    요소('span', { class: 'a-g라운드', text: `${view.round}/${view.총라운드}` }),
    요소('span', { class: 'a-g제시어', text: 상태말(view) })
  ]));

  el.appendChild(요소('div', { class: 'a-미제출' }, [
    요소('span', { class: 'a-라벨', text: '누른 사람' }),
    요소('span', { text: `${view.낸사람} / ${view.전체}명` })
  ]));

  const 미제출 = view.미제출 || [];
  if (미제출.length && (view.phase === '빨강' || view.phase === '초록')) {
    el.appendChild(요소('div', { class: 'a-미제출' }, [
      요소('span', { class: 'a-라벨', text: '아직 안 누름' }),
      요소('span', { text: 미제출.map(p => p.name).join(', ') })
    ]));
  }

  // 지금까지 기록
  const 순위 = view.순위 || [];
  if (순위.length) {
    const box = 요소('div', { class: 'a-rt순위' }, [요소('span', { class: 'a-라벨', text: '기록' })]);
    for (const x of 순위) {
      box.appendChild(요소('div', { class: 'a-rt줄' }, [
        요소('span', { text: `${x.rank}위 ${x.name}` }),
        요소('b', { text: `${x.기록}ms` })
      ]));
    }
    el.appendChild(box);
  }

  const 버튼들 = 요소('div', { class: 'rowbtns' });
  if (view.phase === '빨강' || view.phase === '초록') {
    버튼들.appendChild(요소('button', {
      class: 'sm ghost', text: '이 라운드 건너뛰기', onclick: () => 조작('건너뛰기')
    }));
  } else if (view.phase === '끝') {
    버튼들.appendChild(요소('span', {
      class: 'a-도움', text: `${view.총라운드}라운드가 다 끝났습니다. 아래 「끝내고 점수 주기」를 누르세요.`
    }));
  } else {
    버튼들.appendChild(요소('button', {
      class: 'sm', text: view.round === 0 ? '첫 라운드 시작' : '다음 라운드', onclick: () => 조작('다음')
    }));
  }
  el.appendChild(버튼들);

  el.appendChild(요소('p', {
    class: 'a-도움',
    text: '시간은 각자 휴대폰에서 잽니다. 초록으로 바뀔 시각은 진행자에게도 보이지 않습니다.'
  }));
}

function 상태말(view) {
  if (view.phase === '빨강') return '준비 중 (곧 초록)';
  if (view.phase === '초록') return '초록! 누르는 중';
  if (view.phase === '대기') return '시작 전';
  if (view.phase === '끝') return '게임 끝';
  return '라운드 끝';
}
