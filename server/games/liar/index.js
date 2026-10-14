// 라이어 게임 (개인전, 15분) — SPEC 5-6
//
// 판마다 카테고리는 모두에게, 제시어는 라이어 한 명만 빼고 알려준다.
// 한 사람씩 20초 동안 제시어를 설명하고 → 자유 토론 1분 → 투표 30초.
// 가장 많이 지목된 사람이 라이어면 라이어에게 제시어를 맞힐 기회(20초)를 준다.
//
// ★ 마피아와 같은 함정: 「누가 라이어인지」는 data/state.json 에 넣지 않는다.
//   · server/secret.js 가 data/secret.json 에만 쓴다.
//   · 뷰에는 '내가 라이어인지'만 담는다. 남이 라이어인지는 데이터에 아예 없다.
//   · 제시어는 라이어의 뷰에 넣지 않는다. TV·진행자 뷰에도 없다(진행자도 참가자다).
//   · 라이어가 공개되는 때는 투표가 끝난 뒤뿐이다. 그때부터는 state 에 적어도 된다.
import { state } from '../../state.js';
import { 비밀읽기, 비밀쓰기, 비밀정리 } from '../../secret.js';

const 판수 = 3;
const 단계시간 = { 설명: 20, 토론: 60, 투표: 30, 맞히기: 20 };   // 초 (SPEC 5-6)

// 판마다 비밀을 다시 읽지 않도록 담아둔다. 서버를 껐다 켜면 secret.json 에서 다시 읽는다.
const 비밀캐시 = new Map();

// 답 비교용 정규화: 공백 제거 + 소문자
function 정규화(답) {
  return String(답 || '').replace(/\s+/g, '').toLowerCase();
}

export default {
  id: 'liar',
  name: '라이어 게임',
  type: 'solo',
  minPlayers: 3,
  maxPlayers: 12,
  minutes: 15,
  color: '#22C55E',
  개인전만: true,            // 이 게임 점수는 개인 순위에만 들어간다(팀 점수 제외)
  rules: [
    '제시어 — 카테고리는 모두에게 보이고, 라이어 한 명만 제시어를 모릅니다.',
    '설명 — 한 사람씩 20초 동안 제시어를 설명합니다. 라이어는 아는 척 연기하세요.',
    '투표 — 1분 토론한 뒤 라이어 같은 사람에게 투표합니다.',
    '역전 — 라이어가 지목되면 제시어를 맞힐 기회를 얻습니다. 맞히면 라이어 승!'
  ],
  점수표: [
    ['시민 승 — 라이어를 찍은 사람', '+2'],
    ['시민 승 — 나머지 시민', '+1'],
    ['라이어 승 — 라이어', '+3']
  ],

  // ── 시작 ──────────────────────────────────────────────────
  create(ctx) {
    const playId = ctx?.playId || `임시-${Date.now()}`;
    const 사람들 = Object.values(ctx?.players || state.players);
    const 뽑은문제 = 섞기(ctx?.content?.liar || []).slice(0, 판수);
    const 문제들 = 뽑은문제.length ? 뽑은문제 : [{ 카테고리: '음식', 제시어: '김밥' }];

    // 판마다 라이어를 미리 뽑아 secret.json 에만 적는다.
    const 몰래 = { 라이어들: 문제들.map(() => 사람들[Math.floor(Math.random() * 사람들.length)]?.id) };
    비밀캐시.set(playId, 몰래);
    비밀쓰기(playId, 몰래);
    비밀정리();

    const s = {
      playId,
      round: 1,
      총라운드: 문제들.length,
      // 제시어는 여기 있어도 '누가 라이어인지'는 드러나지 않는다
      문제들: 문제들.map(m => ({ 카테고리: m['카테고리'] || '', 제시어: m['제시어'] || '' })),
      명단: 사람들.map(p => p.id),
      phase: '설명',             // 설명 → 토론 → 투표 → (맞히기) → 판끝 → … → 끝
      endsAt: 0,
      순서: [],
      발언번호: 0,
      표: {},                    // { 찍은사람: 찍힌사람 }
      들킨라이어: null,          // 투표로 지목된 뒤에만 채운다(그때부터 공개)
      추측: null,
      판기록: []                 // 판이 끝날 때마다 결과를 쌓는다 — 이때는 라이어가 이미 공개됐다
    };
    판열기(s);
    return s;
  },

  // ── 휴대폰 입력 ───────────────────────────────────────────
  onInput(s, playerId, input) {
    if (!s.명단.includes(playerId)) return;

    if (s.phase === '투표' && input?.act === '투표') {
      const 대상 = String(input?.target || '');
      if (!s.명단.includes(대상) || 대상 === playerId) return;   // 자기 자신은 못 찍는다
      s.표[playerId] = 대상;
      if (투표할사람(s).every(pid => s.표[pid])) 투표마감(s);     // 다 냈으면 기다리지 않는다
      return;
    }

    if (s.phase === '맞히기' && input?.act === '맞히기') {
      if (playerId !== 라이어(s)) return;                         // 라이어만 답할 수 있다
      const 답 = String(input?.answer ?? '').trim().slice(0, 20);
      if (!답) return;
      s.추측 = 답;
      맞히기마감(s);
    }
  },

  // ── 진행자 조작 ───────────────────────────────────────────
  onAdmin(s, { action, payload } = {}) {
    if (action === '다음') { 다음으로(s); return; }
    if (action === '시간추가') {
      if (s.endsAt) s.endsAt += (Number(payload?.초) || 30) * 1000;
      return;
    }
    if (action === '답인정') {
      // 라이어가 쓴 답이 뜻은 맞는데 표기만 다를 때 — 라이어 승으로 바꾼다
      const 지난 = s.판기록[s.판기록.length - 1];
      if (s.phase !== '판끝' || !지난?.잡혔나 || 지난.승 !== '시민') return;
      s.판기록[s.판기록.length - 1] = 판결과만들기(s, '라이어', true, true);
    }
  },

  // ── 타이머 ────────────────────────────────────────────────
  onTick(s, now) {
    if (s.endsAt && now >= s.endsAt) 다음으로(s);
  },

  // ── 뷰 (정보 등급별, SPEC 4장) ────────────────────────────
  views(s) {
    const 문제 = 지금문제(s);
    const 공개했나 = s.phase === '판끝' || s.phase === '끝';

    const 공개 = {
      round: s.round,
      총라운드: s.총라운드,
      phase: s.phase,
      endsAt: s.endsAt,
      카테고리: 문제.카테고리,
      순서: s.순서.map(pid => ({ id: pid, name: 이름(pid) })),
      발언번호: s.발언번호,
      발언자: s.phase === '설명' ? 이름(s.순서[s.발언번호]) : null,
      // 투표 중에는 '몇 명이 냈는지'만. 누가 누구를 찍었는지는 공개 전에 안 보낸다.
      투표현황: s.phase === '투표'
        ? { 낸사람: Object.keys(s.표).length, 전체: 투표할사람(s).length }
        : null,
      // 라이어가 지목돼 제시어를 맞히는 중 — 이때부터 라이어가 누구인지는 공개다
      들킨라이어: s.phase === '맞히기' ? 이름(s.들킨라이어) : null,
      판결과: 공개했나 ? 결과뷰(s) : null,
      누적: 공개했나 ? 누적순위(s) : null
    };

    return {
      screen: 공개,
      player: (pid) => {
        const 내가라이어 = pid === 라이어(s);
        return {
          ...공개,
          내가라이어,                                    // 내 것만. 남이 라이어인지는 여기 없다.
          제시어: 내가라이어 ? null : 문제.제시어,       // 라이어에게는 제시어를 보내지 않는다
          내차례: s.phase === '설명' && s.순서[s.발언번호] === pid,
          내표: s.표[pid] ? 이름(s.표[pid]) : null,
          내표id: s.표[pid] || null,
          고를사람: s.phase === '투표'
            ? 투표할사람(s).filter(x => x !== pid).map(x => ({ id: x, name: 이름(x) }))
            : [],
          맞히기차례: s.phase === '맞히기' && 내가라이어
        };
      },
      // 진행자도 참가자다. 진행자 뷰에 라이어와 제시어를 넣지 않는다.
      admin: {
        ...공개,
        미투표: s.phase === '투표' ? 투표할사람(s).filter(pid => !s.표[pid]).map(이름) : []
      },
      adminSecret: {
        // '스포일러 보기'를 눌렀을 때만 나간다
        라이어: 이름(라이어(s)),
        제시어: 문제.제시어
      }
    };
  },

  // ── 끝났을 때 점수 (SPEC 5-6) ─────────────────────────────
  result(s) {
    const 합 = 누적점수(s);
    const 점수 = Object.entries(합)
      .filter(([, 점]) => 점 > 0)
      .map(([pid, 점]) => ({ playerId: pid, points: 점, reason: `라이어 게임 ${s.판기록.length}판` }));
    return {
      점수,
      요약: {
        순위: 누적순위(s).map(x => ({ 이름: x.name, 점수: x.점수 })),
        판수: s.판기록.length
      }
    };
  }
};

// ══════════════════════════════════════════════════════════
// 비밀 — 누가 라이어인지는 여기에만 있다
// ══════════════════════════════════════════════════════════
function 비밀가져오기(s) {
  if (비밀캐시.has(s.playId)) return 비밀캐시.get(s.playId);
  const 읽은것 = 비밀읽기(s.playId) || {};
  읽은것.라이어들 ||= [];
  비밀캐시.set(s.playId, 읽은것);
  return 읽은것;
}

function 라이어(s) {
  return 비밀가져오기(s).라이어들[s.round - 1] || null;
}

// ══════════════════════════════════════════════════════════
// 진행
// ══════════════════════════════════════════════════════════
function 판열기(s) {
  s.순서 = 섞기(투표할사람(s));
  s.발언번호 = 0;
  s.표 = {};
  s.들킨라이어 = null;
  s.추측 = null;
  단계시작(s, '설명');
}

function 단계시작(s, phase) {
  s.phase = phase;
  s.endsAt = Date.now() + 단계시간[phase] * 1000;
}

// 시간이 다 됐거나 진행자가 '다음'을 눌렀을 때 — 지금 단계에 맞게 넘어간다
function 다음으로(s) {
  switch (s.phase) {
    case '설명':
      s.발언번호 += 1;
      if (s.발언번호 >= s.순서.length) 단계시작(s, '토론');
      else 단계시작(s, '설명');
      break;
    case '토론': 단계시작(s, '투표'); break;
    case '투표': 투표마감(s); break;
    case '맞히기': 맞히기마감(s); break;
    case '판끝':
      if (s.round >= s.총라운드) { s.phase = '끝'; s.endsAt = null; break; }
      s.round += 1;
      판열기(s);
      break;
    default: break;
  }
}

function 투표마감(s) {
  const 센것 = new Map();
  for (const 대상 of Object.values(s.표)) 센것.set(대상, (센것.get(대상) || 0) + 1);
  const 최고 = Math.max(0, ...센것.values());
  const 최다들 = [...센것.entries()].filter(([, n]) => n === 최고 && n > 0).map(([k]) => k);

  // 최다 득표가 한 명이고 그 사람이 라이어일 때만 '잡았다'. 동률이면 못 잡은 것이다.
  if (최다들.length === 1 && 최다들[0] === 라이어(s)) {
    s.들킨라이어 = 최다들[0];
    단계시작(s, '맞히기');
    return;
  }
  판끝내기(s, '라이어', false);
}

function 맞히기마감(s) {
  const 맞혔나 = !!s.추측 && 정규화(s.추측) === 정규화(지금문제(s).제시어);
  판끝내기(s, 맞혔나 ? '라이어' : '시민', true);
}

function 판끝내기(s, 승, 잡혔나) {
  s.판기록.push(판결과만들기(s, 승, 잡혔나, false));
  s.phase = '판끝';
  s.endsAt = null;           // 결과는 진행자가 '다음 판'을 누를 때까지 띄워 둔다
}

// 판 결과 — 이때 라이어가 공개된다. 점수도 여기서 정한다 (SPEC 5-6).
function 판결과만들기(s, 승, 잡혔나, 인정) {
  const 라 = 라이어(s);
  const 점수 = {};
  if (승 === '라이어') {
    if (라) 점수[라] = 3;
  } else {
    for (const pid of s.명단) {
      if (pid === 라) continue;
      점수[pid] = s.표[pid] === 라 ? 2 : 1;     // 라이어를 찍은 사람 +2, 나머지 시민 +1
    }
  }
  return { 라이어: 라, 제시어: 지금문제(s).제시어, 승, 잡혔나, 인정, 추측: s.추측, 득표: 득표표(s), 점수 };
}

// ══════════════════════════════════════════════════════════
// 뷰에 쓸 것
// ══════════════════════════════════════════════════════════
function 결과뷰(s) {
  const r = s.판기록[s.판기록.length - 1];
  if (!r) return null;
  return {
    라이어: 이름(r.라이어),
    제시어: r.제시어,
    승: r.승,
    잡혔나: r.잡혔나,
    인정: r.인정,
    추측: r.추측,
    득표: r.득표,
    점수: Object.entries(r.점수)
      .map(([pid, 점]) => ({ name: 이름(pid), 점수: 점 }))
      .sort((a, b) => b.점수 - a.점수)
  };
}

function 득표표(s) {
  const 센것 = new Map();
  for (const 대상 of Object.values(s.표)) 센것.set(대상, (센것.get(대상) || 0) + 1);
  return [...센것.entries()]
    .map(([pid, n]) => ({ name: 이름(pid), 표수: n }))
    .sort((a, b) => b.표수 - a.표수);
}

function 누적점수(s) {
  const 합 = Object.fromEntries(s.명단.map(pid => [pid, 0]));
  for (const r of s.판기록) {
    for (const [pid, 점] of Object.entries(r.점수)) 합[pid] = (합[pid] || 0) + 점;
  }
  return 합;
}

function 누적순위(s) {
  return Object.entries(누적점수(s))
    .map(([pid, 점]) => ({ name: 이름(pid), 점수: 점 }))
    .sort((a, b) => b.점수 - a.점수);
}

// ══════════════════════════════════════════════════════════
// 잔일
// ══════════════════════════════════════════════════════════
function 지금문제(s) {
  return s.문제들[s.round - 1] || { 카테고리: '', 제시어: '' };
}

function 이름(pid) { return state.players[pid]?.name || '(나감)'; }

// 처음 명단에 있고 아직 나가지 않은 사람 — 설명 순서와 투표 인원에 쓴다
function 투표할사람(s) {
  return s.명단.filter(pid => state.players[pid]);
}

function 섞기(배열) {
  const a = [...배열];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
