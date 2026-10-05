// 초성 퀴즈 (팀전, 10분) — SPEC 5-2
//
// 10문제. 문제당 30초, 15초가 지나면 카테고리 힌트가 열린다.
// 누구나 답을 쓸 수 있고, 틀리면 2초 뒤에 다시 쓸 수 있다.
// 문제마다 먼저 맞힌 팀 3점 · 두 번째 2점 · 세 번째 1점.
//
// 비밀 규칙: 문제를 푸는 동안 정답은 화면으로 나가면 안 된다.
// 그래서 뷰의 `정답`은 공개 단계에서만 채우고, 그 전에는 adminSecret에만 둔다.
import { 팀원들 } from '../../state.js';
import { 팀순위점수 } from '../../scoring.js';

const 문제수 = 10;
const 문제초 = 30;
const 힌트초 = 15;         // 시작 뒤 15초가 지나면 힌트
const 재입력대기 = 2000;   // 오답 뒤 2초
const 등수점수 = [3, 2, 1];
const 개인최대 = 3;        // 개인 활약은 최대 +3
const 오답보낼수 = 12;     // 진행자 화면에 한 번에 보여줄 오답 줄 수
const 팀ID들 = ['A', 'B', 'C'];

// 답 비교용 정규화: 공백 제거 + 소문자 (SPEC 5-2)
function 정규화(답) {
  return String(답 || '').replace(/\s+/g, '').toLowerCase();
}

export default {
  id: 'chosung',
  name: '초성 퀴즈',
  type: 'team',
  minPlayers: 2,
  maxPlayers: 12,
  minutes: 10,
  color: '#FF8A00',
  rules: [
    '초성만 보고 단어를 맞힙니다.',
    '누구나 답을 쓸 수 있고, 틀리면 2초 뒤에 다시 쓸 수 있습니다.',
    '15초가 지나면 힌트가 열립니다.',
    '먼저 맞힌 팀이 3점, 두 번째 2점, 세 번째 1점입니다.'
  ],

  // ── 시작 ──────────────────────────────────────────────────
  create(ctx) {
    const 뽑은문제 = 섞기(ctx.content?.chosung || []).slice(0, 문제수);
    const 쓸문제 = 뽑은문제.length
      ? 뽑은문제
      : [{ 초성: 'ㅌㄱ', 정답: '퇴근', 힌트: '모두가 기다리는 것' }];
    const s = {
      round: 1,
      총라운드: 쓸문제.length,
      문제들: 쓸문제,
      phase: 'input',            // input → reveal → (다음 문제) → done
      시작시각: 0,
      endsAt: 0,
      맞힌: [],                  // [{ teamId, playerId, 인정 }] — 맞힌 순서대로
      오답: [],                  // [{ playerId, 답, at }] — 이번 문제
      다음입력: {},              // { playerId: 다시 쓸 수 있는 시각 }
      팀총점: {},
      개인첫정답: {},            // { playerId: 횟수 }
      라운드기록: []
    };
    문제열기(s);
    return s;
  },

  // ── 휴대폰 입력 ───────────────────────────────────────────
  onInput(s, playerId, input) {
    if (s.phase !== 'input') return;
    const 지금 = Date.now();
    if (지금 > s.endsAt) return;                       // 시간이 지나면 받지 않는다

    const 팀 = 팀찾기(playerId);
    if (!팀) return;                                   // 팀이 없으면 팀전에 참여할 수 없다
    if (s.맞힌.some(x => x.teamId === 팀)) return;      // 우리 팀은 이미 맞혔다
    if ((s.다음입력[playerId] || 0) > 지금) return;     // 오답 뒤 2초는 기다린다

    const 답 = String(input?.answer ?? '').trim().slice(0, 30);
    if (!답) return;

    if (정규화(답) === 정규화(지금문제(s).정답)) {
      정답처리(s, playerId, 팀, false);
      return;
    }
    // 오답 — 로그에 남기고(진행자가 '정답 인정'을 할 수 있게) 2초 잠근다
    s.오답.push({ playerId, 답, at: 지금 });
    s.다음입력[playerId] = 지금 + 재입력대기;
  },

  // ── 진행자 조작 ───────────────────────────────────────────
  onAdmin(s, { action, payload } = {}) {
    const d = payload || {};

    if (action === '정답인정') {
      // 오답 로그의 한 줄을 정답으로 인정한다 (맞는 뜻인데 표기가 다른 경우)
      if (s.phase !== 'input' && s.phase !== 'reveal') return;
      const 줄 = s.오답[Number(d.번호)];
      if (!줄) return;
      const 팀 = 팀찾기(줄.playerId);
      if (!팀) return;
      if (s.맞힌.some(x => x.teamId === 팀)) return;    // 그 팀은 이미 맞혔다
      정답처리(s, 줄.playerId, 팀, true);
      return;
    }
    if (action === '힌트') {                            // 힌트를 바로 열어준다
      if (s.phase === 'input') {
        s.시작시각 = Math.min(s.시작시각, Date.now() - 힌트초 * 1000);
      }
      return;
    }
    if (action === '시간추가') {
      if (s.phase === 'input') s.endsAt += (Number(d.초) || 15) * 1000;
      return;
    }
    if (action === '공개') {                            // 시간 전에 정답을 보여준다
      if (s.phase === 'input') 문제마감(s);
      return;
    }
    if (action === '다음') {
      if (s.phase !== 'reveal') return;
      if (s.round >= s.총라운드) { s.phase = 'done'; return; }
      s.round += 1;
      문제열기(s);
      return;
    }
  },

  // ── 타이머 만료 ───────────────────────────────────────────
  onTick(s, now) {
    if (s.phase === 'input' && now >= s.endsAt) 문제마감(s);
  },

  // ── 뷰 (정보 등급별, SPEC 4장) ────────────────────────────
  views(s) {
    const 문제 = 지금문제(s);
    const 푸는중 = s.phase === 'input';
    const 공개 = {
      round: s.round,
      총라운드: s.총라운드,
      phase: s.phase,
      초성: 문제.초성,
      // 힌트는 15초가 지나야 열린다
      힌트: 힌트열렸나(s) ? (문제.힌트 || '') : null,
      // 정답은 푸는 중에는 절대 내보내지 않는다
      정답: 푸는중 ? null : 문제.정답,
      endsAt: 푸는중 ? s.endsAt : null,
      맞힌: s.맞힌.map((x, i) => ({
        순서: i + 1,
        teamId: x.teamId,
        name: 이름(x.playerId),
        점수: 등수점수[i] ?? 0,
        인정: !!x.인정
      })),
      남은팀: 있는팀들().filter(t => !s.맞힌.some(x => x.teamId === t)),
      // 아직 점수가 없는 팀도 0으로 넣는다 — 큰 화면에서 팀이 사라져 보이면 안 된다
      팀총점: Object.fromEntries(있는팀들().map(t => [t, s.팀총점[t] || 0]))
    };

    return {
      screen: 공개,
      player: (pid) => {
        const 내팀 = 팀찾기(pid);
        const 맞혔나 = !!내팀 && s.맞힌.some(x => x.teamId === 내팀);
        const 대기 = Math.max(0, (s.다음입력[pid] || 0) - Date.now());
        return {
          ...공개,
          내팀,
          내팀맞혔나: 맞혔나,
          입력가능: 푸는중 && !!내팀 && !맞혔나 && 대기 === 0,
          재입력까지: 대기,
          // 내가 쓴 오답만 보여준다 (남의 오답은 그 자체가 힌트다)
          내오답: s.오답.filter(o => o.playerId === pid).map(o => o.답)
        };
      },
      admin: {
        ...공개,
        // 오답 로그 — 진행자가 보고 '정답 인정'을 누를 수 있다.
        // 전부 보내면 휴대폰에서 끝없이 스크롤된다. 아직 못 맞힌 팀 것만, 최근 12건까지.
        오답수: s.오답.length,
        오답: s.오답
          .map((o, i) => ({ 번호: i, playerId: o.playerId, 답: o.답 }))
          .filter(o => {
            const 팀 = 팀찾기(o.playerId);
            return !!팀 && !s.맞힌.some(x => x.teamId === 팀);
          })
          .slice(-오답보낼수)
          .reverse()
          .map(o => ({
            번호: o.번호,
            name: 이름(o.playerId),
            teamId: 팀찾기(o.playerId),
            답: o.답,
            인정가능: true
          })),
        개인첫정답: { ...s.개인첫정답 }
      },
      adminSecret: {
        // 진행자도 게임에 참여하므로, '스포일러 보기'를 눌렀을 때만 정답이 나간다
        정답: 푸는중 ? 문제.정답 : null
      }
    };
  },

  // ── 끝났을 때 점수 (SPEC 5-2 + 5장 공통 배점) ─────────────
  result(s) {
    const 팀결과 = 있는팀들().map(id => ({ id, points: s.팀총점[id] || 0 }));
    const 점수 = 팀순위점수(팀결과);

    // 개인 활약: 팀에서 처음 맞힌 사람 +1 (최대 +3)
    for (const [pid, 횟수] of Object.entries(s.개인첫정답)) {
      const 점 = Math.min(개인최대, 횟수);
      if (점 > 0) 점수.push({ playerId: pid, points: 점, reason: '초성 퀴즈 활약' });
    }

    return {
      점수,
      요약: {
        팀결과,
        문제수: s.라운드기록.length,
        맞힌문제: s.라운드기록.filter(r => r.맞힌.length > 0).length
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

function 지금문제(s) {
  return s.문제들[s.round - 1] || { 초성: '', 정답: '', 힌트: '' };
}

function 이름(playerId) {
  for (const t of 팀ID들) {
    const 찾음 = 팀원들(t).find(p => p.id === playerId);
    if (찾음) return 찾음.name;
  }
  return '(나감)';
}

function 팀찾기(playerId) {
  for (const t of 팀ID들) {
    if (팀원들(t).some(p => p.id === playerId)) return t;
  }
  return null;
}

function 있는팀들() {
  return 팀ID들.filter(t => 팀원들(t).length > 0);
}

function 힌트열렸나(s) {
  if (s.phase !== 'input') return true;          // 공개 뒤에는 힌트도 같이 보여준다
  return Date.now() - s.시작시각 >= 힌트초 * 1000;
}

function 문제열기(s) {
  s.phase = 'input';
  s.시작시각 = Date.now();
  s.endsAt = s.시작시각 + 문제초 * 1000;
  s.맞힌 = [];
  s.오답 = [];
  s.다음입력 = {};
}

// 맞혔다 — 팀 점수와 개인 활약을 준다.
function 정답처리(s, playerId, 팀, 인정) {
  const 순서 = s.맞힌.length;                    // 0이면 첫 번째
  s.맞힌.push({ teamId: 팀, playerId, 인정 });

  const 점 = 등수점수[순서] ?? 0;
  s.팀총점[팀] = (s.팀총점[팀] || 0) + 점;

  // 그 팀에서 처음 맞힌 사람이므로 개인 활약 대상이다
  s.개인첫정답[playerId] = (s.개인첫정답[playerId] || 0) + 1;

  // 모든 팀이 맞혔으면 더 기다릴 이유가 없다.
  // (타이머만 믿으면 다 맞히고도 30초를 멀뚱히 기다리게 된다)
  if (s.맞힌.length >= 있는팀들().length) 문제마감(s);
}

function 문제마감(s) {
  const 문제 = 지금문제(s);
  s.phase = 'reveal';
  s.라운드기록.push({
    초성: 문제.초성,
    정답: 문제.정답,
    맞힌: s.맞힌.map(x => ({ teamId: x.teamId, name: 이름(x.playerId), 인정: !!x.인정 })),
    오답수: s.오답.length
  });
}
