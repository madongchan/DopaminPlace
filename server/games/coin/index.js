// 끈끈이 동전잡기 (팀전·오프라인)
//
// 게임은 화면 밖에서 한다. 여기서 하는 일은 하나뿐이다 —
// 끝난 뒤 진행자가 1등 팀 하나를 누르면 그 팀만 점수를 받는다(팀전은 1등 팀만 — 2026-10-15).
// 휴대폰 입력은 없다.
import { 팀원들 } from '../../state.js';
import { 팀순위점수 } from '../../scoring.js';

const 팀ID들 = ['A', 'B', 'C'];

export default {
  id: 'coin',
  name: '끈끈이 동전잡기',
  type: 'offline',
  minPlayers: 2,
  maxPlayers: 12,
  minutes: 10,
  color: '#FFD400',
  rules: [
    '화면 밖에서 하는 팀 대항 게임입니다. 진행자의 설명을 따라주세요.',
    '끝나면 진행자가 1등 팀을 입력합니다.'
  ],
  // 보드 칸·규칙 카드에 그림으로 보이는 배점 요약 (메달 = 1·2·3등 동그라미). 자세한 건 아래 점수표
  배점: [{ 메달: 1, 글: '1등 팀 전원', 점: 5 }],
  점수표: [
    ['진행자가 1등 팀을 입력', '']
  ],

  create() {
    return { 순위: [] };          // [1등 팀 id] — 하나만 담는다
  },

  onAdmin(s, { action, payload } = {}) {
    if (action === '등수') {
      const 팀 = payload?.teamId;
      if (!있는팀들().includes(팀) || s.순위.length) return;   // 1등 팀 하나만 고른다
      s.순위.push(팀);
      return;
    }
    if (action === '되돌리기') s.순위.pop();
  },

  views(s) {
    const 공개 = {
      순위: [...s.순위],
      남은팀: 있는팀들().filter(t => !s.순위.includes(t))
    };
    return { screen: 공개, player: () => 공개, admin: 공개, adminSecret: {} };
  },

  result(s) {
    // 고른 팀이 1등 → 공통 배점(1등 팀만 +5). 나머지 팀은 0점 줄을 남긴다('최근' 기준이 맞게)
    const 팀결과 = 있는팀들().map(id => ({ id, points: id === s.순위[0] ? 1 : 0 }));
    return { 점수: 팀순위점수(팀결과), 요약: { 팀결과 } };
  }
};

function 있는팀들() {
  return 팀ID들.filter(t => 팀원들(t).length > 0);
}
