// 반응속도 (개인전, 5분) — SPEC 5-8
//
// 5라운드. 휴대폰이 '준비…'(빨강) → 서버가 정한 2~5초 뒤 초록 → 탭.
// 점수는 판마다 바로 준다 — 가장 빨리 누른 1·2·3등 +3 / +2 / +1, 5판 합계가 내 점수(2026-10-15 담당자 결정).
// 초록 전에 누르거나 안 누르면 그 판은 탈락(점수 없음).
//
// 중요: 시간은 **휴대폰 안에서** 잰다(초록이 뜬 순간부터 탭까지 performance.now()).
// 서버가 재면 사람마다 네트워크 속도가 달라 불공평해진다.
// 서버는 '언제 초록으로 바꿀지'만 정하고, 휴대폰이 보낸 ms를 받아 적는다.
import { state } from '../../state.js';

const 라운드수 = 5;
const 판점수 = [3, 2, 1];      // 판마다 1·2·3등
const 반칙 = '반칙';           // 초록 전에 누름 — 그 판에 다시 못 누르게 막는 표시일 뿐, 따로 기록하지 않는다
const 최소대기 = 2000, 최대대기 = 5000;
const 라운드제한 = 6000;       // 초록 뒤 6초 안에 안 누르면 그 라운드 포기

export default {
  id: 'reaction',
  name: '반응속도',
  type: 'solo',
  // 보드 칸·규칙 카드에 그림으로 보이는 배점 요약 (메달 = 1·2·3등 동그라미). 자세한 건 아래 점수표
  배점: [{ 글: '판마다' }, { 메달: 1, 점: 3 }, { 메달: 2, 점: 2 }, { 메달: 3, 점: 1 }],
  점수표: [
    ['판마다 가장 빨리 누른 1·2·3등', '+3 / +2 / +1'],
    ['초록이 되기 전에 누르거나 안 누르면', '그 판 탈락'],
    ['5판 점수를 모두 더한 것이 내 점수', '']
  ],
  점수표2배: true,            // 점수표 줄이 실제 점수라 2배 판에서 함께 두 배로 보인다
  minPlayers: 2,
  maxPlayers: 12,
  minutes: 5,
  color: '#FF3D6E',
  rules: [
    '화면이 빨간색일 때는 기다립니다.',
    '초록색으로 바뀌는 순간 화면을 누르세요.',
    '판마다 가장 빨리 누른 1·2·3등이 +3 / +2 / +1을 바로 받습니다.',
    '초록색이 되기 전에 누르거나 안 누르면 그 판은 탈락입니다(점수 없음).',
    '5판 점수를 모두 더합니다.'
  ],

  create(ctx) {
    return {
      round: 0,                 // 아직 시작 안 함
      총라운드: ctx?.settings?.연습 ? 1 : 라운드수,   // 연습 판은 예시 한 판만
      phase: '대기',            // 대기 → 빨강 → 초록 → 라운드끝 → 끝
      초록시각: null,           // 초록으로 바뀐 순간 (서버 시계)
      바뀔시각: null,           // 빨강에서 초록으로 바뀔 예정 시각
      기록: {},                 // { playerId: [{ ms, 점 }, …] } — 판마다 한 칸 (그 판 탈락이면 ms 가 null)
      총점: {},                 // { playerId: 판 점수 합계 }
      이번라운드: {}            // { playerId: ms | '반칙' }
    };
  },

  onInput(s, playerId, input) {
    if (s.phase === '빨강') {
      // 아직 초록이 아닌데 눌렀다 — 부정 출발
      if (s.이번라운드[playerId] == null) s.이번라운드[playerId] = 반칙;
      return;
    }
    if (s.phase !== '초록') return;
    if (s.이번라운드[playerId] != null) return;      // 한 판에 한 번만

    const ms = Number(input?.ms);
    if (!Number.isFinite(ms)) return;
    // 사람이 낼 수 없는 값은 막는다(50ms보다 빠르면 미리 누르고 있던 것)
    s.이번라운드[playerId] = Math.round(Math.min(라운드제한, Math.max(50, ms)));

    // 마지막 사람이 누르면 바로 끝낸다.
    // (타이머만 믿으면 최대 1초를 멀뚱히 기다리게 된다)
    if (다냈나(s)) 라운드마감(s);
  },

  onAdmin(s, { action } = {}) {
    if (action === '다음') {
      if (s.phase === '대기' || s.phase === '라운드끝') 라운드시작(s);
      return;
    }
    if (action === '건너뛰기') {
      if (s.phase === '빨강' || s.phase === '초록') 라운드마감(s);
    }
  },

  onTick(s, now) {
    if (s.phase === '빨강' && now >= s.바뀔시각) {
      s.phase = '초록';
      s.초록시각 = now;
      return;
    }
    if (s.phase === '초록' && (다냈나(s) || now - s.초록시각 > 라운드제한)) {
      라운드마감(s);
    }
  },

  views(s) {
    const 공개 = {
      round: s.round,
      총라운드: s.총라운드,
      phase: s.phase,
      // 초록으로 바뀌는 시각은 절대 안 보낸다 — 알면 미리 누를 수 있다.
      낸사람: Object.keys(s.이번라운드).length,
      전체: 참가자들().length,
      순위: 순위내기(s)
    };
    return {
      screen: 공개,
      player: (pid) => ({
        ...공개,
        내상태: s.phase === '초록' ? '눌러' : s.phase === '빨강' ? '기다려' : '쉬는중',
        내이번판: s.이번라운드[pid] ?? null,
        내기록: s.기록[pid] || []
      }),
      admin: { ...공개, 미제출: 미제출자(s) },
      adminSecret: { 바뀔시각: s.바뀔시각 }     // 진행자가 궁금하면 볼 수 있게
    };
  },

  result(s) {
    const 순위 = 순위내기(s);
    return {
      // 판마다 받은 점수의 합 그대로. 0점인 사람도 줄을 남긴다('최근' 기준이 맞게)
      점수: 순위.map(x => ({ playerId: x.id, points: x.총점, reason: `반응속도 ${x.판수}판 합계` })),
      요약: { 순위: 순위.map(x => ({ 이름: x.name, 기록: `${x.총점}점` })) }
    };
  }
};

// ══════════════════════════════════════════════════════════
function 참가자들() {
  return Object.keys(state.players);
}

function 다냈나(s) {
  const 사람들 = 참가자들();
  return 사람들.length > 0 && 사람들.every(id => s.이번라운드[id] != null);
}

function 라운드시작(s) {
  if (s.round >= s.총라운드) { s.phase = '끝'; return; }
  s.round += 1;
  s.phase = '빨강';
  s.이번라운드 = {};
  s.초록시각 = null;
  // 2~5초 사이 아무 때나. 사람이 박자를 외우지 못하게 매번 다르게.
  s.바뀔시각 = Date.now() + 최소대기 + Math.random() * (최대대기 - 최소대기);
}

// 판을 닫으며 바로 점수를 준다 — 제대로 누른 사람 중 빠른 순 1·2·3등 +3 / +2 / +1 (같은 ms면 같은 등수)
function 라운드마감(s) {
  const 누른 = 참가자들()
    .filter(id => typeof s.이번라운드[id] === 'number')
    .sort((a, b) => s.이번라운드[a] - s.이번라운드[b]);
  const 이번점수 = {};
  let 등수 = 0, 앞 = null;
  누른.forEach((id, i) => {
    const ms = s.이번라운드[id];
    if (ms !== 앞) { 등수 = i + 1; 앞 = ms; }
    이번점수[id] = 판점수[등수 - 1] ?? 0;
  });
  for (const id of 참가자들()) {
    const 값 = s.이번라운드[id];
    const 점 = 이번점수[id] || 0;
    (s.기록[id] ||= []).push({ ms: typeof 값 === 'number' ? 값 : null, 점 });
    s.총점[id] = (s.총점[id] || 0) + 점;
  }
  s.phase = s.round >= s.총라운드 ? '끝' : '라운드끝';
}

function 미제출자(s) {
  return 참가자들()
    .filter(id => s.이번라운드[id] == null)
    .map(id => ({ id, name: state.players[id]?.name }));
}

// 순위 = 판 점수 합계가 높은 순. 같으면 같은 등수(보기 좋게 가장 빠른 기록 순으로 늘어놓기만 한다)
function 순위내기(s) {
  const 최고 = (id) => Math.min(...(s.기록[id] || []).map(x => x.ms ?? Infinity));
  const 목록 = 참가자들()
    .filter(id => (s.기록[id] || []).length)
    .map(id => ({
      id,
      name: state.players[id]?.name || '',
      teamId: state.players[id]?.teamId || null,
      판수: s.기록[id].length,
      이번판: s.기록[id].at(-1),        // 방금 끝난 판 { ms, 점 }
      총점: s.총점[id] || 0
    }))
    .sort((a, b) => b.총점 - a.총점 || 최고(a.id) - 최고(b.id));

  let 등수 = 0, 앞 = null;
  return 목록.map((x, i) => {
    if (x.총점 !== 앞) { 등수 = i + 1; 앞 = x.총점; }
    return { ...x, rank: 등수 };
  });
}
