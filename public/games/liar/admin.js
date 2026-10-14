// 라이어 게임 — 진행자
// 진행자도 참가자다. 누가 라이어인지와 제시어는 판이 끝나기 전까지 여기 오지 않는다.
// 시간이 되면 서버가 알아서 넘기므로, 버튼은 빨리 넘기고 싶을 때만 누르면 된다.
import { 요소, 비우기, 타이머붙이기 } from '/js/components.js';

const 단계글 = { 확인: '제시어 확인 (10초)', 설명: '설명', 토론: '토론', 투표: '투표', 맞히기: '라이어가 제시어를 맞히는 중', 판끝: '판 결과', 끝: '끝' };

export function 그리기(el, current, 조작) {
  const view = current.view;
  비우기(el);

  const 숫자 = 요소('span', { class: 'a-초' });
  el.appendChild(요소('div', { class: 'a-g머리' }, [
    요소('span', { class: 'a-g라운드', text: `${view.round}/${view.총라운드}판` }),
    요소('span', { class: 'a-g제시어', text: 단계글[view.phase] || view.phase }),
    숫자
  ]));
  if (view.endsAt) 타이머붙이기(숫자, view.endsAt);

  const 줄 = (라벨, 글) => el.appendChild(요소('div', { class: 'a-미제출' }, [
    요소('span', { class: 'a-라벨', text: 라벨 }), 요소('span', { text: 글 })
  ]));
  const 버튼들 = 요소('div', { class: 'rowbtns' });
  const 버튼 = (글, action, payload, 모양 = 'sm') => 버튼들.appendChild(
    요소('button', { class: 모양, text: 글, onclick: () => 조작(action, payload) }));

  if (view.phase === '확인') {
    줄('지금', '모두 휴대폰에서 제시어를 확인하는 중 — 10초 뒤 설명이 시작됩니다');
    버튼('바로 설명 시작', '다음');
  } else if (view.phase === '설명') {
    줄('지금 설명', `${view.발언자 || ''} (${view.발언번호 + 1}/${(view.순서 || []).length})`);
    버튼('다음 사람으로', '다음');
  } else if (view.phase === '토론') {
    버튼('+30초', '시간추가', { 초: 30 }, 'sm ghost');
    버튼('토론 끝 → 투표', '다음');
  } else if (view.phase === '투표') {
    const c = view.투표현황 || { 낸사람: 0, 전체: 0 };
    줄('투표', `${c.낸사람}/${c.전체}명`);
    if ((view.미투표 || []).length) 줄('아직 안 낸 사람', view.미투표.join(', '));
    버튼('투표 마감', '다음');
  } else if (view.phase === '맞히기') {
    줄('지목된 라이어', view.들킨라이어 || '');
    버튼('기다리지 않고 마감', '다음', undefined, 'sm ghost');
  } else {
    const r = view.판결과;
    if (r) {
      줄('결과', `${r.승 === '시민' ? '시민 승' : '라이어 승'} · 라이어 ${r.라이어} · 제시어 ${r.제시어}`);
      if (r.잡혔나) 줄('라이어가 쓴 답', r.추측 || '(못 냄)');
    }
    if (view.phase === '판끝') {
      // 뜻은 맞는데 표기만 다를 때 — 진행자가 라이어 승으로 바꿔줄 수 있다
      if (r?.잡혔나 && r.승 === '시민' && r.추측) 버튼('라이어 답 인정 (라이어 승으로)', '답인정', undefined, 'sm ghost');
      버튼(view.round >= view.총라운드 ? '합계 보기' : '다음 판', '다음');
    } else {
      버튼들.appendChild(요소('span', {
        class: 'a-도움', text: '게임이 끝났습니다. 아래 「끝내고 점수 주기」를 누르세요.'
      }));
    }
  }
  el.appendChild(버튼들);
}
