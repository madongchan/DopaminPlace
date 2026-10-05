// 병뚜껑 던지기 (팀전·오프라인, 15분) — SPEC 5-4
//
// 바닥에 테이프로 과녁을 만든다. 가운데 5점 · 중간 3점 · 바깥 1점 · 밖 0점.
// 한 사람이 3번 던지고, 팀 순서는 랜덤이며 팀 안에서 한 명씩 돌아간다.
// 진행자가 눈으로 보고 0 / 1 / 3 / 5 버튼을 눌러 점수를 넣는다.
//
// 오프라인 게임이라 비밀이 없다 — 방에 있는 사람 모두가 결과를 본다.
// 대신 '지금 던지는 사람'을 크게 보여주고, 그 사람 휴대폰에 「내 차례!」를 띄운다.
//
// 되돌리기 규칙: 기록 배열 하나만 정본으로 두고 나머지(현재 차례, 남은 기회,
// 개인 총점)는 전부 기록에서 다시 계산한다. 그래서 마지막 한 줄만 지우면
// 모든 값이 저절로 되돌아간다. (텔레파시의 병합 되돌리기와 같은 방식)
import { state, 팀원들 } from '../../state.js';
import { 팀순위점수 } from '../../scoring.js';

const 던질횟수 = 3;              // 1인 3회
const 과녁점수 = [0, 1, 3, 5];   // 진행자가 누를 수 있는 값
const 개인활약 = [2, 1];         // 개인 총점 1위 +2, 2위 +1
const 팀ID들 = ['A', 'B', 'C'];

export default {
  id: 'bottlecap',
  name: '병뚜껑 던지기',
  type: 'offline',
  minPlayers: 4,
  maxPlayers: 12,
  minutes: 15,
  color: '#22C55E',
  rules: [
    '바닥 과녁에 병뚜껑을 던집니다. 가운데 5점, 중간 3점, 바깥 1점입니다.',
    '한 사람이 3번 던집니다.',
    '내 차례가 되면 휴대폰에 「내 차례!」가 뜹니다.',
    '팀 점수는 팀원 총점을 팀 인원으로 나눈 값입니다.'
  ],

  // ── 시작 ──────────────────────────────────────────────────
  create() {
    return {
      phase: 'throw',            // throw → done
      순서: 던질순서(),          // [playerId] — 한 칸이 한 사람의 3회 차례
      기록: []                   // [{ playerId, 점수, 건너뜀 }] — 던진 순서대로
    };
  },

  // 휴대폰에서는 아무것도 보내지 않는다. 판정은 진행자만 한다.
  onInput() {},

  // ── 진행자 조작 ───────────────────────────────────────────
  onAdmin(s, { action, payload } = {}) {
    const d = payload || {};

    if (action === '판정') {
      if (s.phase !== 'throw') return;
      const 점 = Number(d.점수);
      if (!과녁점수.includes(점)) return;          // 0·1·3·5 만 받는다
      const 사람 = 지금사람(s);
      if (!사람) return;
      s.기록.push({ playerId: 사람, 점수: 점, 건너뜀: false });
      끝났나확인(s);
      return;
    }
    if (action === '되돌리기') {
      // 마지막 한 줄만 지운다. 차례·남은 기회는 기록에서 다시 계산되므로 저절로 돌아간다.
      if (!s.기록.length) return;
      s.기록.pop();
      s.phase = 'throw';
      return;
    }
    if (action === '건너뛰기') {
      // 자리에 없는 사람은 넘긴다. 남은 기회를 0점으로 채워 차례를 넘긴다.
      if (s.phase !== 'throw') return;
      const 사람 = 지금사람(s);
      if (!사람) return;
      const 남음 = 남은기회(s);
      for (let i = 0; i < 남음; i++) {
        s.기록.push({ playerId: 사람, 점수: 0, 건너뜀: true });
      }
      끝났나확인(s);
      return;
    }
  },

  // 시간으로 넘어가는 단계가 없다 — 진행자가 누르는 만큼만 진행된다.
  onTick() {},

  // ── 뷰 (SPEC 4장) ─────────────────────────────────────────
  views(s) {
    const 지금 = 지금사람(s);
    const 다음 = s.순서[차례번호(s) + 1] || null;
    const 셈 = 계산(s);

    const 공개 = {
      phase: s.phase,
      지금차례: 지금 ? { name: 이름(지금), teamId: 팀(지금) } : null,
      다음차례: 다음 ? { name: 이름(다음), teamId: 팀(다음) } : null,
      남은기회: 남은기회(s),
      이번차례점수: 이번차례기록(s).map(r => r.점수),
      진행: { 던진수: s.기록.length, 총던지기: s.순서.length * 던질횟수 },
      팀누적: 셈.팀누적,
      개인기록: 셈.개인기록
    };

    return {
      screen: 공개,
      player: (pid) => ({
        ...공개,
        // 「내 차례!」는 서버가 판단해서 내려준다 (화면이 판단하면 틀릴 수 있다)
        내차례: !!지금 && 지금 === pid,
        내남은기회: 지금 === pid ? 남은기회(s) : null,
        내총점: 셈.개인총점[pid] || 0,
        내최고: 셈.개인최고[pid] || 0,
        내순서: s.순서.indexOf(pid) + 1 || null,
        전체순서: s.순서.length
      }),
      admin: {
        ...공개,
        과녁점수,
        되돌릴것: 마지막기록(s),
        순서목록: s.순서.map((id, i) => ({
          번호: i + 1, name: 이름(id), teamId: 팀(id), 끝남: i < 차례번호(s)
        }))
      },
      adminSecret: {}            // 오프라인 게임이라 감출 것이 없다
    };
  },

  // ── 끝났을 때 점수 (SPEC 5-4 + 5장 공통 배점) ─────────────
  result(s) {
    const 셈 = 계산(s);

    // 팀 점수 = 팀원 총점 ÷ 팀 인원 (인원이 다른 팀 보정)
    const 팀결과 = 있는팀들().map(id => ({ id, points: 셈.팀누적[id]?.평균 ?? 0 }));
    const 점수 = 팀순위점수(팀결과);

    // 개인 활약: 개인 총점 1위 +2, 2위 +1
    const 정렬 = [...셈.개인기록].sort((a, b) => b.총점 - a.총점);
    let 등수 = 0, 앞 = null;
    정렬.forEach((x, i) => {
      if (x.총점 !== 앞) { 등수 = i + 1; 앞 = x.총점; }
      const 점 = 개인활약[등수 - 1];
      if (점 && x.총점 > 0) {
        점수.push({ playerId: x.id, points: 점, reason: `병뚜껑 개인 ${등수}위` });
      }
    });

    return {
      점수,
      요약: {
        팀결과,
        개인1위: 정렬[0] ? { 이름: 정렬[0].name, 총점: 정렬[0].총점 } : null,
        던진수: s.기록.length
      }
    };
  }
};

// ══════════════════════════════════════════════════════════
// 안쪽 일
// ══════════════════════════════════════════════════════════

function 섞기(배열) {
  const a = [...배열];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function 이름(playerId) { return state.players[playerId]?.name || '(나감)'; }
function 팀(playerId) { return state.players[playerId]?.teamId || null; }
function 있는팀들() { return 팀ID들.filter(t => 팀원들(t).length > 0); }

// 팀 순서는 랜덤, 팀 안에서 한 명씩 돌아가며 던진다 (SPEC 5-4).
// A팀1 → B팀1 → C팀1 → A팀2 → B팀2 → … 인원이 다르면 남은 팀만 계속 돈다.
function 던질순서() {
  const 팀별 = 섞기(있는팀들()).map(t => 섞기(팀원들(t).map(p => p.id)));
  const 순서 = [];
  const 최대 = Math.max(0, ...팀별.map(x => x.length));
  for (let i = 0; i < 최대; i++) {
    for (const 팀사람들 of 팀별) {
      if (팀사람들[i]) 순서.push(팀사람들[i]);
    }
  }
  return 순서;
}

// 기록 길이만으로 차례가 정해진다 — 그래서 되돌리기가 간단해진다.
function 차례번호(s) { return Math.floor(s.기록.length / 던질횟수); }
function 지금사람(s) { return s.순서[차례번호(s)] || null; }
function 남은기회(s) { return 던질횟수 - (s.기록.length % 던질횟수); }

function 이번차례기록(s) {
  return s.기록.slice(차례번호(s) * 던질횟수);
}

function 마지막기록(s) {
  if (!s.기록.length) return null;
  const 마 = s.기록[s.기록.length - 1];
  return { name: 이름(마.playerId), 점수: 마.점수, 건너뜀: !!마.건너뜀 };
}

function 끝났나확인(s) {
  if (s.기록.length >= s.순서.length * 던질횟수) s.phase = 'done';
}

// 개인 총점·최고와 팀 누적을 기록에서 매번 다시 센다.
function 계산(s) {
  const 개인총점 = {}, 개인최고 = {};
  for (const r of s.기록) {
    개인총점[r.playerId] = (개인총점[r.playerId] || 0) + r.점수;
    개인최고[r.playerId] = Math.max(개인최고[r.playerId] || 0, r.점수);
  }

  const 팀누적 = {};
  for (const t of 있는팀들()) {
    const 원들 = 팀원들(t);
    const 총점 = 원들.reduce((합, p) => 합 + (개인총점[p.id] || 0), 0);
    팀누적[t] = {
      총점,
      인원: 원들.length,
      평균: 원들.length ? Math.round((총점 / 원들.length) * 100) / 100 : 0
    };
  }

  // 개인 기록은 순서에 든 사람 전원을 담는다(아직 안 던진 사람도 0점으로 보인다)
  const 개인기록 = s.순서.map(id => ({
    id,
    name: 이름(id),
    teamId: 팀(id),
    총점: 개인총점[id] || 0,
    최고: 개인최고[id] || 0
  })).sort((a, b) => b.총점 - a.총점);

  return { 개인총점, 개인최고, 팀누적, 개인기록 };
}
