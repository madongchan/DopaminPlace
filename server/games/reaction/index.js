// 반응속도 (개인전, 5분) — SPEC 5-8
//
// 5라운드. 휴대폰이 '준비…'(빨강) → 서버가 정한 2~5초 뒤 초록 → 탭.
//
// 중요: 시간은 **휴대폰 안에서** 잰다(초록이 뜬 순간부터 탭까지 performance.now()).
// 서버가 재면 사람마다 네트워크 속도가 달라 불공평해진다.
// 서버는 '언제 초록으로 바꿀지'만 정하고, 휴대폰이 보낸 ms를 받아 적는다.
import { state } from '../../state.js';
import { 개인전점수 } from '../../scoring.js';

const 라운드수 = 5;
const 좋은것세기 = 3;          // 5라운드 중 좋은 3개의 평균이 기록
const 부정출발벌점 = 1000;     // 초록 전에 누르면 그 라운드는 1000ms
const 최소대기 = 2000, 최대대기 = 5000;
const 라운드제한 = 6000;       // 초록 뒤 6초 안에 안 누르면 그 라운드 포기

export default {
  id: 'reaction',
  name: '반응속도',
  type: 'solo',
  minPlayers: 2,
  maxPlayers: 12,
  minutes: 5,
  color: '#FF3D6E',
  rules: [
    '화면이 빨간색일 때는 기다립니다.',
    '초록색으로 바뀌는 순간 화면을 누르세요.',
    '초록색이 되기 전에 누르면 그 판은 1초로 기록됩니다.',
    '5번 중 잘한 3번의 평균으로 순위를 정합니다.'
  ],

  create() {
    return {
      round: 0,                 // 아직 시작 안 함
      총라운드: 라운드수,
      phase: '대기',            // 대기 → 빨강 → 초록 → 라운드끝 → 끝
      초록시각: null,           // 초록으로 바뀐 순간 (서버 시계)
      바뀔시각: null,           // 빨강에서 초록으로 바뀔 예정 시각
      기록: {},                 // { playerId: [ms, ms, …] }
      이번라운드: {}            // { playerId: ms }
    };
  },

  onInput(s, playerId, input) {
    if (s.phase === '빨강') {
      // 아직 초록이 아닌데 눌렀다 — 부정 출발
      if (s.이번라운드[playerId] == null) s.이번라운드[playerId] = 부정출발벌점;
      return;
    }
    if (s.phase !== '초록') return;
    if (s.이번라운드[playerId] != null) return;      // 한 판에 한 번만

    const ms = Number(input?.ms);
    if (!Number.isFinite(ms)) return;
    // 사람이 낼 수 없는 값은 막는다(50ms보다 빠르면 미리 누르고 있던 것)
    s.이번라운드[playerId] = Math.round(Math.min(부정출발벌점, Math.max(50, ms)));

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
      // 반응속도는 작을수록 좋다 — 값에 -를 붙여 넘긴다
      점수: 개인전점수(순위.map(x => ({ playerId: x.id, 값: -x.기록 }))),
      요약: { 순위: 순위.map(x => ({ 이름: x.name, 기록: x.기록 })) }
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

function 라운드마감(s) {
  for (const id of 참가자들()) {
    const ms = s.이번라운드[id] ?? 부정출발벌점;     // 안 누른 사람도 1000ms
    (s.기록[id] ||= []).push(ms);
  }
  s.phase = s.round >= s.총라운드 ? '끝' : '라운드끝';
}

function 미제출자(s) {
  return 참가자들()
    .filter(id => s.이번라운드[id] == null)
    .map(id => ({ id, name: state.players[id]?.name }));
}

// 기록 = 5라운드 중 좋은 3개의 평균 (SPEC 5-8)
function 개인기록(목록) {
  if (!목록?.length) return null;
  const 정렬 = [...목록].sort((a, b) => a - b).slice(0, 좋은것세기);
  return Math.round(정렬.reduce((a, b) => a + b, 0) / 정렬.length);
}

function 순위내기(s) {
  const 목록 = 참가자들()
    .map(id => ({
      id,
      name: state.players[id]?.name || '',
      teamId: state.players[id]?.teamId || null,
      판수: (s.기록[id] || []).length,
      이번판: (s.기록[id] || []).at(-1) ?? null,     // 방금 끝난 판의 기록 (평균에 가려지지 않게 따로 보낸다)
      기록: 개인기록(s.기록[id])
    }))
    .filter(x => x.기록 != null)
    .sort((a, b) => a.기록 - b.기록);

  let 등수 = 0, 앞 = null;
  return 목록.map((x, i) => {
    if (x.기록 !== 앞) { 등수 = i + 1; 앞 = x.기록; }
    return { ...x, rank: 등수 };
  });
}
