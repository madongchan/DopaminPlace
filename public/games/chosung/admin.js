// 초성 퀴즈 — 진행자
// 푸는 중에는 정답이 진행자에게도 오지 않는다(진행자도 게임에 참여하므로).
// 오답 로그를 보고 「정답 인정」을 누를 수 있다. 정답이 공개된 뒤에 하는 게 편하다.
import { 요소, 비우기, 타이머붙이기, 팀사전, 팀색, 팀글자색 } from '/js/components.js';

export function 그리기(el, current, 조작, 진행자뷰) {
  const view = current.view;
  const 팀 = 팀사전(진행자뷰.teams);
  비우기(el);

  const 숫자 = 요소('span', { class: 'a-초' });
  el.appendChild(요소('div', { class: 'a-g머리' }, [
    요소('span', { class: 'a-g라운드', text: `${view.round}/${view.총라운드}` }),
    요소('span', { class: 'a-g제시어', text: view.초성 || '' }),
    숫자
  ]));
  if (view.phase === 'input') 타이머붙이기(숫자, view.endsAt);

  // 정답 — 공개된 뒤에만 온다
  el.appendChild(요소('div', { class: 'a-미제출' }, [
    요소('span', { class: 'a-라벨', text: '정답' }),
    view.정답
      ? 요소('b', { text: view.정답 })
      : 요소('span', { class: 'a-도움', text: '공개 전에는 진행자에게도 안 보입니다' })
  ]));

  if (view.힌트) {
    el.appendChild(요소('div', { class: 'a-미제출' }, [
      요소('span', { class: 'a-라벨', text: '힌트' }),
      요소('span', { text: view.힌트 })
    ]));
  }

  // 맞힌 팀
  const 맞힌 = view.맞힌 || [];
  const 맞힌줄 = 요소('div', { class: 'a-cs맞힌' }, [요소('span', { class: 'a-라벨', text: '맞힌 팀' })]);
  if (맞힌.length) {
    for (const x of 맞힌) {
      const t = 팀[x.teamId] || {};
      맞힌줄.appendChild(요소('span', {
        class: 'a-cs칩',
        style: { borderColor: 팀색(t.colorId), color: 팀글자색(t.colorId) },
        text: `${x.순서}등 ${t.name || x.teamId + '팀'} ${x.name} +${x.점수}${x.인정 ? ' (인정)' : ''}`
      }));
    }
  } else {
    맞힌줄.appendChild(요소('span', { class: 'a-도움', text: '아직 없습니다' }));
  }
  el.appendChild(맞힌줄);

  // 오답 로그 + 정답 인정
  const 오답 = view.오답 || [];
  const box = 요소('div', { class: 'a-cs오답' }, [
    요소('span', {
      class: 'a-라벨',
      text: view.오답수 > 오답.length
        ? `오답 ${view.오답수}건 (최근 ${오답.length}건만 보임)`
        : `오답 ${오답.length}건`
    })
  ]);
  if (!오답.length) {
    box.appendChild(요소('span', { class: 'a-도움', text: '아직 없습니다' }));
  } else {
    box.appendChild(요소('p', {
      class: 'a-도움',
      text: '뜻이 맞는데 표기만 다르면 「정답 인정」을 누르세요. 그 팀에 순서대로 점수가 들어갑니다.'
    }));
    for (const o of 오답) {
      const t = 팀[o.teamId] || {};
      box.appendChild(요소('div', { class: 'a-cs오답줄' }, [
        요소('span', {
          class: 'a-cs오답팀',
          text: `${t.name || o.teamId + '팀'} ${o.name}`,
          style: { color: 팀글자색(t.colorId) }
        }),
        요소('span', { class: 'a-cs오답글', text: o.답 }),
        o.인정가능
          ? 요소('button', {
              class: 'xs', text: '정답 인정',
              onclick: () => 조작('정답인정', { 번호: o.번호 })
            })
          : 요소('span', { class: 'a-도움', text: '이 팀은 이미 맞힘' })
      ]));
    }
  }
  el.appendChild(box);

  // 버튼
  const 버튼들 = 요소('div', { class: 'rowbtns' });
  if (view.phase === 'input') {
    if (!view.힌트) {
      버튼들.appendChild(요소('button', { class: 'sm ghost', text: '힌트 열기', onclick: () => 조작('힌트') }));
    }
    버튼들.appendChild(요소('button', { class: 'sm ghost', text: '+15초', onclick: () => 조작('시간추가', { 초: 15 }) }));
    버튼들.appendChild(요소('button', { class: 'sm', text: '정답 공개', onclick: () => 조작('공개') }));
  } else if (view.round >= view.총라운드) {
    버튼들.appendChild(요소('span', {
      class: 'a-도움', text: '마지막 문제입니다. 아래 「끝내고 점수 주기」를 누르세요.'
    }));
  } else {
    버튼들.appendChild(요소('button', { class: 'sm', text: '다음 문제', onclick: () => 조작('다음') }));
  }
  el.appendChild(버튼들);
}
