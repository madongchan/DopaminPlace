// 끈끈이 동전잡기 (팀전·오프라인)
//
// 게임은 화면 밖에서 한다. 여기서 하는 일은 하나뿐이다 —
// 끝난 뒤 진행자가 1등부터 순서대로 팀을 누르면 그 등수대로 점수를 준다.
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
    '끝나면 진행자가 1등부터 순서대로 팀을 입력합니다.'
  ],
  점수표: [
    ['1등 팀', '팀원 모두 +5']
  ],

  create() {
    return { 순위: [] };          // 1등부터 차례로 팀 id
  },

  onAdmin(s, { action, payload } = {}) {
    if (action === '등수') {
      const 팀 = payload?.teamId;
      if (!있는팀들().includes(팀) || s.순위.includes(팀)) return;
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
    // 먼저 눌린 팀일수록 게임 점수가 높다 → 공통 배점(1등 팀만 +5)으로 바꾼다
    const 팀결과 = s.순위.map((id, i) => ({ id, points: s.순위.length - i }));
    return { 점수: 팀순위점수(팀결과), 요약: { 팀결과 } };
  }
};

function 있는팀들() {
  return 팀ID들.filter(t => 팀원들(t).length > 0);
}
