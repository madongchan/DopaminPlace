// 마피아 — 진행자
//
// 진행자도 참가자다. 그래서 이 화면에는 역할이 오지 않는다(서버가 안 보낸다).
// 진행자가 하는 일은 셋뿐 — 잠시 멈추기, 다음 단계로 밀기, 중단하기.
import { 요소, 비우기, 타이머붙이기, 팀사전, 팀글자색 } from '/js/components.js';

const 단계글 = {
  밤: '밤 (60초)',
  아침: '아침 (20초)',
  토론: '토론 (2분)',
  지목투표: '지목 투표 (30초)',
  최후변론: '최후 변론 (30초)',
  찬반투표: '찬반 투표 (15초)',
  끝: '게임 끝'
};

export function 그리기(el, current, 조작, 진행자뷰) {
  const view = current.view;
  const 팀 = 팀사전(진행자뷰.teams);
  비우기(el);

  const 숫자 = 요소('span', { class: 'a-초' });
  el.appendChild(요소('div', { class: 'a-g머리' }, [
    요소('span', { class: 'a-g라운드', text: `${view.day}/${view.총일수}일차` }),
    요소('span', { class: 'a-g제시어', text: 단계글[view.phase] || view.phase }),
    숫자
  ]));
  if (view.endsAt && !view.일시정지) 타이머붙이기(숫자, view.endsAt);

  if (view.결과) {
    줄넣기(el, '결과', view.결과 === '시민승' ? '시민 승리' : '마피아 승리');
  }

  // 진행 상황 — 몇 명이 냈는지만
  if (view.phase === '밤' && view.밤낸사람) {
    줄넣기(el, '밤에 고른 사람', `${view.밤낸사람.낸사람} / ${view.밤낸사람.전체}명`);
  }
  if (view.투표현황) {
    줄넣기(el, '지목 투표', `${view.투표현황.낸사람} / ${view.투표현황.전체}명`);
    if (view.재투표했나) 줄넣기(el, '', '동률이라 재투표 중입니다');
  }
  if (view.찬반현황) {
    줄넣기(el, '찬반 투표', `${view.찬반현황.낸사람} / ${view.찬반현황.전체}명`);
  }
  if (view.최다득표) 줄넣기(el, '지목된 사람', view.최다득표);

  if (view.아침소식 && view.phase === '아침') {
    줄넣기(el, '지난밤',
      view.아침소식.죽은사람 ? `${view.아침소식.죽은사람} 사망` : '아무 일도 없었음');
  }
  if (view.처형소식) {
    줄넣기(el, '투표 결과', view.처형소식.처형
      ? `${view.처형소식.name} 처형 (찬성 ${view.처형소식.찬성} · 반대 ${view.처형소식.반대})`
      : `처형 없음 (찬성 ${view.처형소식.찬성} · 반대 ${view.처형소식.반대})`);
  }

  // 생존자
  el.appendChild(요소('div', { class: 'a-미제출' }, [
    요소('span', { class: 'a-라벨', text: `생존 ${view.산사람수}명` })
  ]));
  const 줄 = 요소('div', { class: 'a-nc순서' });
  for (const p of view.사람들 || []) {
    줄.appendChild(요소('span', {
      class: 'a-nc칸' + (p.살아있나 ? '' : ' 탈락'),
      text: p.name,
      style: p.살아있나 ? { color: 팀글자색((팀[p.teamId] || {}).colorId) } : {}
    }));
  }
  el.appendChild(줄);

  // 기록
  if ((view.기록 || []).length) {
    const box = 요소('div', { class: 'a-nc로그' }, [
      요소('span', { class: 'a-라벨', text: '진행 기록' })
    ]);
    for (const 한줄 of view.기록) box.appendChild(요소('div', { class: 'a-nc로그줄', text: 한줄 }));
    el.appendChild(box);
  }

  // 버튼
  const 버튼들 = 요소('div', { class: 'rowbtns' });
  if (!view.결과) {
    버튼들.appendChild(요소('button', {
      class: 'sm ghost',
      text: view.일시정지 ? '다시 시작' : '잠시 멈춤',
      onclick: () => 조작(view.일시정지 ? '재개' : '일시정지')
    }));
    버튼들.appendChild(요소('button', {
      class: 'sm', text: '다음 단계로', onclick: () => 조작('다음단계')
    }));
  } else {
    버튼들.appendChild(요소('span', {
      class: 'a-도움', text: '게임이 끝났습니다. 아래 「끝내고 점수 주기」를 누르세요.'
    }));
  }
  el.appendChild(버튼들);

  el.appendChild(요소('p', {
    class: 'a-도움',
    text: '진행자에게도 역할은 보이지 않습니다. 대표님도 참가자이기 때문입니다.'
  }));
}

function 줄넣기(el, 라벨, 값) {
  el.appendChild(요소('div', { class: 'a-미제출' }, [
    요소('span', { class: 'a-라벨', text: 라벨 }),
    요소('span', { text: 값 })
  ]));
}
