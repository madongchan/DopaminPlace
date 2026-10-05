// 점수 기록과 순위 계산 (SPEC 7장)
// 규칙 하나: 점수로그는 '추가만' 한다. 고치거나 지울 때도 새 줄을 더한다.
import crypto from 'node:crypto';
import { state, 저장, 팀원들 } from './state.js';

// ── 기록 ────────────────────────────────────────────────────
export function 플레이ID생성() {
  return crypto.randomBytes(5).toString('hex');
}

export function 점수기록({ playId, gameId, playerId, points, reason, revertOf }) {
  const p = state.players[playerId];
  const 줄 = {
    at: Date.now(),
    playId,
    gameId,
    playerId,
    teamId: p?.teamId ?? null,
    points: Number(points) || 0,
    reason: String(reason || '')
  };
  if (revertOf) 줄.revertOf = revertOf;
  state.scoreLog.push(줄);
  저장();
  return 줄;
}

export function 여러점수기록(playId, gameId, 목록) {
  return 목록.map(({ playerId, points, reason }) =>
    점수기록({ playId, gameId, playerId, points, reason }));
}

// 진행자 수동 가·감점
export function 수동점수(playerId, points, reason) {
  return 점수기록({ playId: '수동', gameId: '수동', playerId, points, reason: reason || '진행자 조정' });
}

// 마지막 기록 되돌리기 — 지우지 않고 반대 부호로 한 줄 더한다.
// 중요: 되돌림 줄은 원본과 **같은 playId·gameId**로 남겨야 한다.
// 다른 playId로 남기면 '최고' 기준이 둘 중 큰 쪽만 골라서 상쇄가 안 된다.
export function 마지막되돌리기() {
  const 이미되돌림 = new Set(state.scoreLog.filter(r => r.revertOf).map(r => r.revertOf));

  for (let i = state.scoreLog.length - 1; i >= 0; i--) {
    const r = state.scoreLog[i];
    if (r.revertOf) continue;                      // 되돌림 줄 자체는 건너뛴다
    const 키 = `${r.at}:${r.playerId}:${i}`;
    if (이미되돌림.has(키)) continue;               // 이미 되돌린 줄도 건너뛴다
    return 점수기록({
      playId: r.playId,
      gameId: r.gameId,
      playerId: r.playerId,
      points: -r.points,
      reason: `되돌림: ${r.reason}`,
      revertOf: 키
    });
  }
  return null;
}

// ── 점수 기준 3종 (SPEC 7장) ────────────────────────────────
// 누적(total): 모든 플레이의 합
// 최고(best):  게임별로 그 사람이 가장 잘한 플레이만
// 최근(latest): 게임별로 가장 최근 플레이만
export function 개인점수(mode = state.settings.scoreMode) {
  // playerId → gameId → playId → { 합, 마지막시각 }
  const 묶음 = new Map();

  for (const r of state.scoreLog) {
    if (!state.players[r.playerId]) continue;      // 내보낸 사람은 뺀다
    if (!묶음.has(r.playerId)) 묶음.set(r.playerId, new Map());
    const 게임별 = 묶음.get(r.playerId);
    if (!게임별.has(r.gameId)) 게임별.set(r.gameId, new Map());
    const 플레이별 = 게임별.get(r.gameId);
    const 이전 = 플레이별.get(r.playId) || { 합: 0, 마지막: 0 };
    플레이별.set(r.playId, { 합: 이전.합 + r.points, 마지막: Math.max(이전.마지막, r.at) });
  }

  const 결과 = {};
  for (const id of Object.keys(state.players)) 결과[id] = 0;

  for (const [playerId, 게임별] of 묶음) {
    let 총합 = 0;
    for (const [, 플레이별] of 게임별) {
      const 플레이들 = [...플레이별.values()];
      if (플레이들.length === 0) continue;
      if (mode === 'total') {
        총합 += 플레이들.reduce((a, b) => a + b.합, 0);
      } else if (mode === 'latest') {
        총합 += [...플레이들].sort((a, b) => b.마지막 - a.마지막)[0].합;
      } else {  // best
        총합 += Math.max(...플레이들.map(p => p.합));
      }
    }
    결과[playerId] = Math.round(총합 * 10) / 10;
  }
  return 결과;
}

// 팀 점수 = 팀원 개인 점수의 평균 (인원이 달라도 공정하게, SPEC 7장)
export function 팀점수(mode = state.settings.scoreMode) {
  const 개인 = 개인점수(mode);
  const 결과 = {};
  for (const id of Object.keys(state.teams)) {
    const 원들 = 팀원들(id);
    결과[id] = 원들.length
      ? Math.round((원들.reduce((a, p) => a + (개인[p.id] || 0), 0) / 원들.length) * 10) / 10
      : 0;
  }
  return 결과;
}

// ── 점수판 뷰 ───────────────────────────────────────────────
export function 점수판(mode = state.settings.scoreMode) {
  const 개인 = 개인점수(mode);
  const 팀 = 팀점수(mode);

  const 개인순위 = Object.values(state.players)
    .map(p => ({
      id: p.id, name: p.name, teamId: p.teamId,
      points: 개인[p.id] || 0, connected: p.connected
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'ko'));
  순위매기기(개인순위);

  const 팀순위 = Object.values(state.teams)
    .map(t => ({
      id: t.id, name: t.name || `${t.id}팀`, colorId: t.colorId,
      points: 팀[t.id] || 0, 인원: 팀원들(t.id).length
    }))
    .filter(t => t.인원 > 0)
    .sort((a, b) => b.points - a.points);
  순위매기기(팀순위);

  return { mode, 개인: 개인순위, 팀: 팀순위 };
}

// 동점이면 같은 등수를 준다 (1, 2, 2, 4 …)
function 순위매기기(목록) {
  let 등수 = 0, 앞점수 = null;
  목록.forEach((x, i) => {
    if (x.points !== 앞점수) { 등수 = i + 1; 앞점수 = x.points; }
    x.rank = 등수;
  });
  return 목록;
}

// ── 팀전 공통 배점 (SPEC 5장 머리말) ────────────────────────
// 팀 순위 1·2·3등 → 팀원 전원 +5 / +3 / +1
export const 팀등수점수 = [5, 3, 1];

export function 팀순위점수(팀결과) {
  // 팀결과: [{ id, points }] — 게임 안에서 낸 팀 점수
  const 결과 = [];
  const 정렬 = [...팀결과].sort((a, b) => b.points - a.points);
  let 등수 = 0, 앞점수 = null;
  정렬.forEach((t, i) => {
    if (t.points !== 앞점수) { 등수 = i + 1; 앞점수 = t.points; }
    const 점수 = 팀등수점수[등수 - 1] ?? 0;
    for (const p of 팀원들(t.id)) {
      결과.push({ playerId: p.id, points: 점수, reason: `팀 ${등수}등` });
    }
  });
  return 결과;
}

// ── 개인전 공통 배점 (SPEC 5장 머리말) ──────────────────────
// 1·2·3위 +5 / +3 / +2, 나머지 참여자 +1
export const 개인등수점수 = [5, 3, 2];

// 목록: [{ playerId, 값 }] — 값이 클수록 잘한 것.
// (작을수록 좋은 게임은 값에 -를 붙여 넘긴다. 예: 반응속도 -320ms)
export function 개인전점수(목록) {
  const 결과 = [];
  const 정렬 = [...목록].sort((a, b) => b.값 - a.값);

  let 등수 = 0, 앞값 = null;
  정렬.forEach((x, i) => {
    if (x.값 !== 앞값) { 등수 = i + 1; 앞값 = x.값; }
    const 점수 = 개인등수점수[등수 - 1] ?? 1;      // 4등부터는 참여 점수 +1
    결과.push({
      playerId: x.playerId,
      points: 점수,
      reason: 등수 <= 3 ? `개인 ${등수}등` : '참여'
    });
  });
  return 결과;
}
