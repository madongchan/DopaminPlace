// 눈치 게임 (개인전, 5분) — SPEC 5-7
//
// 3판. '시작' 후 휴대폰에 큰 버튼 하나.
// 누르는 순서대로 서버가 1, 2, 3… 을 부여하고 큰 화면에 숫자가 뜬다.
// 앞사람과 0.3초 이내에 누르면 동시 입력 — 겹친 사람 모두 탈락.
// 20초 안에 끝까지 안 누른 사람도 탈락.
//
// 판정은 **서버가 받은 시각** 기준이다(SPEC 5-7).
// 네트워크 차이는 게임의 일부로 인정한다 — 대신 판정 근거를 진행자에게 보여준다.
import { state } from '../../state.js';
import { 개인전점수 } from '../../scoring.js';

const 총판수 = 3;
const 동시간격 = 300;      // 0.3초 안에 겹치면 동시 입력
const 판시간 = 20000;      // 한 판 20초
const 생존점수 = 2;        // 살아남으면 +2

export default {
  id: 'nunchi',
  name: '눈치 게임',
  type: 'solo',
  minPlayers: 3,
  maxPlayers: 12,
  minutes: 5,
  color: '#8B5CF6',
  rules: [
    '큰 버튼을 눌러 숫자를 하나씩 차지합니다.',
    '다른 사람과 0.3초 안에 겹쳐 누르면 둘 다 탈락입니다.',
    '20초가 끝날 때까지 안 누른 사람도 탈락입니다.',
    '3판을 합쳐 순위를 정합니다.'
  ],

  create() {
    return {
      판: 0,
      총판: 총판수,
      phase: '대기',        // 대기 → 진행 → 판끝 → 끝
      시작시각: null,
      endsAt: null,
      누른사람: [],         // [{ id, 순서, at }]
      탈락: [],             // 이번 판에 탈락한 사람
      점수: {},             // { playerId: 누적 점수 }
      판정로그: []          // 진행자가 볼 판정 근거
    };
  },

  onInput(s, playerId, input) {
    if (s.phase !== '진행') return;
    if (input?.act !== '누름') return;
    if (s.누른사람.some(x => x.id === playerId)) return;   // 한 판에 한 번만

    const 지금 = Date.now();
    s.누른사람.push({ id: playerId, 순서: s.누른사람.length + 1, at: 지금 });

    // 바로 앞사람과 0.3초 안이면 둘 다 탈락
    const 앞 = s.누른사람[s.누른사람.length - 2];
    if (앞) {
      const 차이 = 지금 - 앞.at;
      if (차이 < 동시간격) {
        for (const id of [앞.id, playerId]) {
          if (!s.탈락.includes(id)) s.탈락.push(id);
        }
        s.판정로그.push(
          `${앞.순서}번 ${이름(앞.id)} · ${s.누른사람.length}번 ${이름(playerId)}` +
          ` — ${(차이 / 1000).toFixed(2)}초 차이로 동시 탈락`
        );
      }
    }

    // 전원이 눌렀으면 바로 끝낸다
    const 남은 = 참가자들().filter(id => !s.누른사람.some(x => x.id === id));
    if (남은.length === 0) 판마감(s, '전원이 눌렀습니다');
  },

  onAdmin(s, { action } = {}) {
    if (action === '다음') {
      if (s.phase === '대기' || s.phase === '판끝') 판시작(s);
      return;
    }
    if (action === '지금끝') {
      if (s.phase === '진행') 판마감(s, '진행자가 끝냈습니다');
    }
  },

  onTick(s, now) {
    if (s.phase === '진행' && now >= s.endsAt) 판마감(s, '20초가 다 됐습니다');
  },

  views(s) {
    const 공개 = {
      판: s.판,
      총판: s.총판,
      phase: s.phase,
      endsAt: s.phase === '진행' ? s.endsAt : null,
      // 누가 몇 번째로 눌렀는지는 공개해도 된다 — 큰 화면의 재미다
      누른사람: s.누른사람.map(x => ({
        순서: x.순서, name: 이름(x.id), 탈락: s.탈락.includes(x.id)
      })),
      탈락수: s.탈락.length,
      남은사람: 참가자들().filter(id => !s.누른사람.some(x => x.id === id)).length,
      순위: 순위내기(s)
    };
    return {
      screen: 공개,
      player: (pid) => ({
        ...공개,
        내가눌렀나: s.누른사람.some(x => x.id === pid),
        내순서: s.누른사람.find(x => x.id === pid)?.순서 ?? null,
        내탈락: s.탈락.includes(pid),
        누를수있나: s.phase === '진행' && !s.누른사람.some(x => x.id === pid)
      }),
      admin: { ...공개, 판정로그: s.판정로그.slice(-12) },
      adminSecret: {}
    };
  },

  result(s) {
    const 순위 = 순위내기(s);
    return {
      점수: 개인전점수(순위.map(x => ({ playerId: x.id, 값: x.점수 }))),
      요약: { 순위: 순위.map(x => ({ 이름: x.name, 점수: x.점수 })) }
    };
  }
};

// ══════════════════════════════════════════════════════════
function 참가자들() { return Object.keys(state.players); }
function 이름(id) { return state.players[id]?.name || '(나감)'; }

function 판시작(s) {
  if (s.판 >= s.총판) { s.phase = '끝'; return; }
  s.판 += 1;
  s.phase = '진행';
  s.누른사람 = [];
  s.탈락 = [];
  s.시작시각 = Date.now();
  s.endsAt = s.시작시각 + 판시간;
}

function 판마감(s, 이유) {
  // 끝까지 안 누른 사람도 탈락 (SPEC 5-7)
  const 안누른 = 참가자들().filter(id => !s.누른사람.some(x => x.id === id));
  for (const id of 안누른) {
    if (!s.탈락.includes(id)) s.탈락.push(id);
  }
  if (안누른.length) {
    s.판정로그.push(`끝까지 안 누름 — ${안누른.map(이름).join(', ')} 탈락`);
  }
  s.판정로그.push(`${s.판}판 끝 (${이유})`);

  // 살아남은 사람에게 +2
  for (const id of 참가자들()) {
    if (!s.탈락.includes(id)) s.점수[id] = (s.점수[id] || 0) + 생존점수;
  }

  s.phase = s.판 >= s.총판 ? '끝' : '판끝';
}

function 순위내기(s) {
  const 목록 = 참가자들()
    .map(id => ({
      id, name: 이름(id),
      teamId: state.players[id]?.teamId || null,
      점수: s.점수[id] || 0
    }))
    .sort((a, b) => b.점수 - a.점수);

  let 등수 = 0, 앞 = null;
  return 목록.map((x, i) => {
    if (x.점수 !== 앞) { 등수 = i + 1; 앞 = x.점수; }
    return { ...x, rank: 등수 };
  });
}
