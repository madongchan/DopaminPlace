// 텔레파시 — 진행자
// 공개 전에는 답 내용이 오지 않는다(진행자도 게임에 참여하므로).
// 공개 뒤에는 비슷한 답을 눌러서 묶을 수 있다.
import { 요소, 비우기, 타이머붙이기, 제출바, 팀사전, 팀색 } from '/js/components.js';

export function 그리기(el, current, 조작, 진행자뷰) {
  const view = current.view;
  const 팀 = 팀사전(진행자뷰.teams);
  비우기(el);

  // 머리: 라운드 · 제시어 · 타이머
  const 숫자 = 요소('span', { class: 'a-초' });
  el.appendChild(요소('div', { class: 'a-g머리' }, [
    요소('span', { class: 'a-g라운드', text: `${view.round}/${view.총라운드}` }),
    요소('span', { class: 'a-g제시어', text: view.prompt || '' }),
    숫자
  ]));
  if (view.phase === 'input') 타이머붙이기(숫자, view.endsAt);

  if (view.phase === 'input') 입력중(el, view, 팀, 조작);
  else 공개중(el, view, 팀, 조작);
}

// ── 입력 중 ─────────────────────────────────────────────────
function 입력중(el, view, 팀, 조작) {
  el.appendChild(제출바(view.제출현황, 팀));

  const 미제출 = view.미제출 || [];
  el.appendChild(요소('div', { class: 'a-미제출' }, [
    요소('span', { class: 'a-라벨', text: '아직 안 낸 사람' }),
    미제출.length
      ? 요소('span', { text: 미제출.map(p => p.name).join(', ') })
      : 요소('span', { class: 'a-다냄', text: '전원 제출 완료' })
  ]));

  el.appendChild(요소('div', { class: 'rowbtns' }, [
    요소('button', { class: 'sm', text: '지금 공개', onclick: () => 조작('공개') }),
    요소('button', { class: 'sm ghost', text: '+30초', onclick: () => 조작('시간추가', { 초: 30 }) })
  ]));
}

// ── 공개 뒤 ─────────────────────────────────────────────────
function 공개중(el, view, 팀, 조작) {
  const 결과 = view.공개결과?.결과 || {};
  const 병합 = view.병합 || {};

  el.appendChild(요소('p', {
    class: 'a-도움',
    text: '비슷한 답은 눌러서 묶을 수 있습니다. 두 개를 차례로 누르세요.'
  }));

  // 묶기용 '첫 번째 선택'을 기억한다.
  let 고른것 = null;

  for (const [tid, r] of Object.entries(결과)) {
    const t = 팀[tid] || {};
    const 색 = 팀색(t.colorId);

    const 칸 = 요소('div', { class: 'a-tp팀', style: { borderColor: 색 } }, [
      요소('div', { class: 'a-tp머리' }, [
        요소('span', { text: t.name || `${tid}팀`, style: { color: 색 } }),
        요소('b', { text: `+${r.점수}`, style: { color: 색 } })
      ])
    ]);

    const 답줄 = 요소('div', { class: 'a-tp답들' });
    for (const 묶 of r.묶음 || []) {
      const 최다 = 묶.정규화 === r.다수답 && 묶.수 >= 2;
      const 칩 = 요소('button', {
        class: 'a-답칩' + (최다 ? ' 최다' : ''),
        text: 묶.수 >= 2 ? `${묶.답} ×${묶.수}` : 묶.답
      });
      칩.onclick = () => {
        if (!고른것) {
          고른것 = { 답: 묶.답, 칩 };
          칩.classList.add('고름');
          return;
        }
        if (고른것.칩 === 칩) { 칩.classList.remove('고름'); 고른것 = null; return; }
        조작('답병합', { from: 고른것.답, to: 묶.답 });
        고른것 = null;
      };
      답줄.appendChild(칩);
    }
    칸.appendChild(답줄);
    el.appendChild(칸);
  }

  // 지금 묶여 있는 것들 — 되돌릴 수 있게
  const 묶인것 = Object.keys(병합);
  if (묶인것.length) {
    const box = 요소('div', { class: 'a-병합목록' }, [요소('span', { class: 'a-라벨', text: '묶은 답' })]);
    for (const from of 묶인것) {
      box.appendChild(요소('button', {
        class: 'xs ghost', text: `${from} → ${병합[from]} ✕`,
        onclick: () => 조작('병합취소', { from })
      }));
    }
    el.appendChild(box);
  }

  const 마지막 = view.round >= view.총라운드;
  el.appendChild(요소('div', { class: 'rowbtns' }, [
    마지막
      ? 요소('span', { class: 'a-도움', text: '마지막 라운드입니다. 아래 「끝내고 점수 주기」를 누르세요.' })
      : 요소('button', { class: 'sm', text: '다음 라운드', onclick: () => 조작('다음') })
  ]));
}
