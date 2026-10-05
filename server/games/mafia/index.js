// 마피아 (개인전, 25~30분) — SPEC 5-5
//
// 사회자 없이 서버가 자동으로 진행한다. 진행자도 참가자이기 때문이다.
//
// ★ 이 게임에서 가장 중요한 것은 「역할이 새지 않는 것」이다.
//   · 역할은 data/state.json 에 넣지 않는다 → server/secret.js 가 data/secret.json 에만 쓴다.
//   · 뷰에는 **내 역할만** 담는다. 남의 역할은 데이터에서 아예 빠진다.
//     화면에서 가리는 것으로는 부족하다 — 개발자도구로 다 보인다.
//   · 진행자 뷰에도 역할이 없다. 진행자도 게임에 참여한다.
//     꼭 봐야 하면 '스포일러 보기'(adminSecret)로만 볼 수 있다.
//   · 역할이 다 공개되는 때는 게임이 끝난 뒤(결과가 정해진 뒤)뿐이다.
//
// 밤에는 **모두가 무언가를 누른다**. 특수 역할은 대상을 고르고,
// 시민과 유령은 '의심 가는 사람'을 고른다. 그래야 누가 특수 역할인지 티가 안 난다.
import { state } from '../../state.js';
import { 비밀읽기, 비밀쓰기, 비밀정리 } from '../../secret.js';

const 총일수 = 6;                 // 6일차가 끝나도 결판이 안 나면 마피아 승
const 단계시간 = {                // 초 (SPEC 5-5 표)
  밤: 60,
  아침: 20,
  토론: 120,
  지목투표: 30,
  최후변론: 30,
  찬반투표: 15
};

// 판마다 역할을 다시 읽지 않도록 담아둔다. 서버를 껐다 켜면 secret.json 에서 다시 읽는다.
const 역할캐시 = new Map();

export default {
  id: 'mafia',
  name: '마피아',
  type: 'solo',
  minPlayers: 8,
  maxPlayers: 12,
  minutes: 30,
  color: '#A82F14',
  rules: [
    '밤에는 모두가 휴대폰에서 한 사람을 고릅니다.',
    '역할 카드는 꾹 누르고 있는 동안만 보입니다. 남에게 보여주지 마세요.',
    '낮에는 토론하고, 투표로 한 명을 지목합니다.',
    '마피아를 모두 찾으면 시민 승, 마피아 수가 나머지와 같아지면 마피아 승입니다.'
  ],

  // ── 시작 ──────────────────────────────────────────────────
  create(ctx) {
    const playId = ctx?.playId || `임시-${Date.now()}`;
    const 사람들 = Object.values(ctx?.players || state.players);
    const { 역할: 역할맵, 마피아들 } = 역할나누기(사람들);

    // 역할뿐 아니라 '누가 그 역할인지 드러나는 것'은 전부 secret.json 에만 쓴다 (SPEC 5-5).
    // 경찰기록·군인방패·군인알림·점수메모는 참가자 id 로 묶여 있어서
    // state.json 에 두면 그 파일만 열어도 누가 경찰이고 군인인지 드러난다.
    const 몰래 = {
      역할: 역할맵,
      마피아들,
      경찰기록: {},        // { 경찰id: [{ day, 대상, 마피아냐 }] } — 본인에게만 나간다
      군인방패: {},        // { 군인id: true } 아직 한 번 버틸 수 있나
      군인알림: {},        // { 군인id: day } 본인에게만
      점수메모: {}         // { pid: { 경찰적중, 의사막음, 찬성적중 } }
    };
    for (const [pid, r] of Object.entries(역할맵)) {
      if (r === '군인') 몰래.군인방패[pid] = true;   // 군인에게 방패 하나
    }
    역할캐시.set(playId, 몰래);
    비밀쓰기(playId, 몰래);
    비밀정리();

    const s = {
      playId,
      day: 1,
      총일수,
      phase: '밤',
      endsAt: 0,
      일시정지: false,
      남은시간: null,
      생존: Object.fromEntries(사람들.map(p => [p.id, true])),
      명단: 사람들.map(p => p.id),
      밤지목: {},
      // 이름에 역할이 드러나지 않게 한다. 값은 '지난밤 지켜진 사람'일 뿐이라
      // 누가 의사인지는 알 수 없어서 state 에 두어도 된다.
      지난보호: null,      // 같은 사람 연속 보호 금지에 쓴다
      유령예측: {},        // { 유령id: [찍은 사람 id...] }
      아침소식: null,
      지목표: {},
      재투표: false,
      최다득표: null,
      찬반: {},
      처형소식: null,
      기록: [],
      결과: null
    };

    단계시작(s, '밤');
    s.기록.push('1일차 밤이 되었습니다.');
    return s;
  },

  // ── 휴대폰 입력 ───────────────────────────────────────────
  onInput(s, playerId, input) {
    if (s.결과 || s.일시정지) return;
    if (!s.명단.includes(playerId)) return;

    const act = input?.act;
    const 살아있나 = !!s.생존[playerId];

    // 밤 — 모두가 한 사람을 고른다
    if (s.phase === '밤' && act === '지목') {
      const 대상 = String(input?.target || '');
      if (!s.명단.includes(대상)) return;
      if (!s.생존[대상]) return;               // 죽은 사람은 고를 수 없다
      if (대상 === playerId) return;            // 자기 자신은 못 고른다

      if (!살아있나) {
        // 유령은 '마피아 예측'을 찍는다. 밤마다 바꿀 수 있다.
        const 목록 = (s.유령예측[playerId] ||= []);
        목록[s.day - 1] = 대상;
        return;
      }
      // 의사는 같은 사람을 연속으로 보호할 수 없다 (SPEC 5-5)
      if (역할(s, playerId) === '의사' && 대상 === s.지난보호) return;
      s.밤지목[playerId] = 대상;
      return;
    }

    // 지목 투표 — 1명 또는 기권
    if (s.phase === '지목투표' && act === '지목투표') {
      if (!살아있나) return;
      const 대상 = String(input?.target || '');
      if (대상 === '기권') { s.지목표[playerId] = '기권'; 투표다찼나(s); return; }
      if (!s.명단.includes(대상) || !s.생존[대상]) return;
      if (대상 === playerId) return;
      s.지목표[playerId] = 대상;
      투표다찼나(s);
      return;
    }

    // 찬반 투표 — 최후 변론을 한 사람은 투표하지 않는다
    if (s.phase === '찬반투표' && act === '찬반') {
      if (!살아있나) return;
      if (playerId === s.최다득표) return;
      const 값 = input?.값;
      if (값 !== '찬성' && 값 !== '반대') return;
      s.찬반[playerId] = 값;
      찬반다찼나(s);
    }
  },

  // ── 진행자 조작 ───────────────────────────────────────────
  onAdmin(s, { action } = {}) {
    if (action === '일시정지') {
      if (s.결과 || s.일시정지) return;
      s.일시정지 = true;
      s.남은시간 = Math.max(0, (s.endsAt || 0) - Date.now());
      s.endsAt = null;
      s.기록.push('진행자가 잠시 멈췄습니다.');
      return;
    }
    if (action === '재개') {
      if (!s.일시정지) return;
      s.일시정지 = false;
      s.endsAt = Date.now() + (s.남은시간 ?? 0);
      s.남은시간 = null;
      s.기록.push('다시 시작합니다.');
      return;
    }
    if (action === '다음단계') {
      // 시간을 다 기다리지 않고 바로 넘긴다
      if (s.결과) return;
      if (s.일시정지) { s.일시정지 = false; s.남은시간 = null; }
      단계마감(s);
    }
  },

  // ── 타이머 ────────────────────────────────────────────────
  onTick(s, now) {
    if (s.결과 || s.일시정지 || !s.endsAt) return;
    if (now >= s.endsAt) 단계마감(s);
  },

  // ── 뷰 (정보 등급별, SPEC 4장) ────────────────────────────
  views(s) {
    const 끝났나 = !!s.결과;

    const 공개 = {
      day: s.day,
      총일수: s.총일수,
      phase: s.phase,
      endsAt: s.endsAt,
      일시정지: s.일시정지,
      // 명단과 생존 여부는 공개해도 된다. 역할은 들어 있지 않다.
      사람들: s.명단.map(pid => ({
        id: pid, name: 이름(pid), teamId: 팀(pid), 살아있나: !!s.생존[pid]
      })),
      산사람수: 산사람(s).length,
      아침소식: s.phase === '아침' ? s.아침소식 : null,
      최다득표: s.최다득표 ? 이름(s.최다득표) : null,
      처형소식: s.처형소식,
      // 지목 투표 중에는 '몇 명이 냈는지'만. 누가 누구를 찍었는지는 끝까지 안 보낸다.
      투표현황: s.phase === '지목투표'
        ? { 낸사람: Object.keys(s.지목표).length, 전체: 산사람(s).length }
        : null,
      득표: s.phase === '지목투표' ? null : 득표표(s),
      찬반현황: s.phase === '찬반투표'
        ? { 낸사람: Object.keys(s.찬반).length, 전체: Math.max(0, 산사람(s).length - 1) }
        : null,
      기록: s.기록.slice(-8),
      결과: s.결과,
      // 역할은 게임이 끝난 뒤에만 공개된다
      역할공개: 끝났나 ? 역할표(s) : null
    };

    return {
      screen: 공개,
      player: (pid) => 내뷰(s, 공개, pid),
      // 진행자도 참가자다. 진행자 뷰에 역할을 넣지 않는다.
      admin: {
        ...공개,
        밤낸사람: s.phase === '밤'
          ? { 낸사람: 밤낸사람수(s), 전체: s.명단.length }
          : null,
        재투표했나: s.재투표
      },
      adminSecret: {
        // '스포일러 보기'를 눌렀을 때만 나간다
        역할표: 역할표(s)
      }
    };
  },

  // ── 끝났을 때 점수 (SPEC 5-5 점수표) ──────────────────────
  result(s) {
    const { 역할: 역할맵, 마피아들 } = 역할가져오기(s);
    const 시민승 = s.결과 === '시민승';
    const 점수 = [];

    for (const pid of s.명단) {
      const r = 역할맵[pid];
      if (!r) continue;
      const 마피아편 = r === '마피아';

      if (s.결과 && 마피아편 !== 시민승) {
        점수.push({ playerId: pid, points: 4, reason: 시민승 ? '시민 승리' : '마피아 승리' });
      }
      if (s.생존[pid]) {
        점수.push({ playerId: pid, points: 1, reason: '끝까지 생존' });
      }

      const 메모칸 = 역할가져오기(s).점수메모[pid] || {};
      if (메모칸.경찰적중) {
        점수.push({ playerId: pid, points: 메모칸.경찰적중, reason: `경찰이 마피아를 찾음 ${메모칸.경찰적중}회` });
      }
      if (메모칸.의사막음) {
        점수.push({ playerId: pid, points: 메모칸.의사막음 * 2, reason: `의사가 막음 ${메모칸.의사막음}회` });
      }
      if (메모칸.찬성적중) {
        점수.push({ playerId: pid, points: 메모칸.찬성적중, reason: `처형된 마피아에 찬성 ${메모칸.찬성적중}회` });
      }
    }

    // 유령 예측 — 맞힌 마피아 한 명당 +1 (같은 사람을 여러 번 찍어도 한 번만)
    for (const [pid, 찍은것] of Object.entries(s.유령예측)) {
      const 맞힌 = new Set((찍은것 || []).filter(t => t && 마피아들.includes(t)));
      if (맞힌.size > 0) {
        점수.push({ playerId: pid, points: 맞힌.size, reason: `유령 예측 적중 ${맞힌.size}명` });
      }
    }

    return {
      점수,
      요약: {
        결과: s.결과 || '중간에 끝남',
        일차: s.day,
        마피아: 마피아들.map(이름),
        생존: 산사람(s).map(이름)
      }
    };
  }
};

// ══════════════════════════════════════════════════════════
// 역할
// ══════════════════════════════════════════════════════════

// SPEC 5-5 인원표. 10~12명이 기준이고, 사람이 덜 와도 게임이 막히지 않게
// 8~9명은 같은 짜임(마피아 2 + 특수 3)으로 줄여 쓴다.
function 역할구성(n) {
  if (n >= 11) return { 마피아: 3, 경찰: 1, 의사: 1, 군인: 1 };
  if (n >= 8) return { 마피아: 2, 경찰: 1, 의사: 1, 군인: 1 };
  // 여기부터는 리허설·점검용
  return { 마피아: Math.max(1, Math.floor(n / 4)), 경찰: 1, 의사: 1, 군인: n >= 6 ? 1 : 0 };
}

function 역할나누기(사람들) {
  const 구성 = 역할구성(사람들.length);
  const 역할맵 = {};

  // 마피아는 가능한 한 서로 다른 팀에서 뽑는다 (SPEC 5-5)
  const 팀별 = new Map();
  for (const p of 섞기(사람들)) {
    const t = p.teamId || '없음';
    if (!팀별.has(t)) 팀별.set(t, []);
    팀별.get(t).push(p.id);
  }
  const 팀목록 = 섞기([...팀별.values()]);
  const 마피아들 = [];
  let 돌기 = 0;
  while (마피아들.length < 구성.마피아) {
    let 뽑았나 = false;
    for (const 팀사람들 of 팀목록) {
      if (마피아들.length >= 구성.마피아) break;
      const 후보 = 팀사람들[돌기];
      if (후보) { 마피아들.push(후보); 뽑았나 = true; }
    }
    돌기 += 1;
    if (!뽑았나) break;               // 더 뽑을 사람이 없다
  }
  for (const pid of 마피아들) 역할맵[pid] = '마피아';

  // 나머지에서 특수 역할, 그 뒤는 전부 시민
  const 남은 = 섞기(사람들.map(p => p.id).filter(id => !역할맵[id]));
  for (const [이름표, 수] of [['경찰', 구성.경찰], ['의사', 구성.의사], ['군인', 구성.군인]]) {
    for (let i = 0; i < 수; i++) {
      const pid = 남은.shift();
      if (pid) 역할맵[pid] = 이름표;
    }
  }
  for (const pid of 남은) 역할맵[pid] = '시민';

  return { 역할: 역할맵, 마피아들 };
}

// 역할과 '역할이 드러나는 기록'은 전부 여기에 있다. state 에는 없다.
function 역할가져오기(s) {
  if (역할캐시.has(s.playId)) return 역할캐시.get(s.playId);
  // 서버를 껐다 켰으면 secret.json 에서 다시 읽는다
  const 읽은것 = 비밀읽기(s.playId) || {};
  읽은것.역할 ||= {};
  읽은것.마피아들 ||= [];
  읽은것.경찰기록 ||= {};
  읽은것.군인방패 ||= {};
  읽은것.군인알림 ||= {};
  읽은것.점수메모 ||= {};
  역할캐시.set(s.playId, 읽은것);
  return 읽은것;
}

// 비밀이 바뀌면 바로 파일에 남긴다(서버가 꺼져도 이어서 진행할 수 있게)
function 비밀저장(s) {
  비밀쓰기(s.playId, 역할가져오기(s));
}

function 역할(s, pid) {
  return 역할가져오기(s).역할[pid] || null;
}

function 역할표(s) {
  const 맵 = 역할가져오기(s).역할;
  return s.명단.map(pid => ({
    name: 이름(pid), 역할: 맵[pid] || '?', 살아있나: !!s.생존[pid]
  }));
}

// ══════════════════════════════════════════════════════════
// 뷰 — 내 것만 담는다
// ══════════════════════════════════════════════════════════
function 내뷰(s, 공개, pid) {
  const { 역할: 맵, 마피아들 } = 역할가져오기(s);
  const 내역할 = 맵[pid] || null;
  const 살아있나 = !!s.생존[pid];
  const 끝났나 = !!s.결과;

  const 내것 = {
    ...공개,
    내역할,                                  // 내 역할만. 남의 역할은 여기 없다.
    내가살았나: 살아있나,
    유령인가: !살아있나,
    내지목: s.밤지목[pid] ? 이름(s.밤지목[pid]) : null,
    내지목id: s.밤지목[pid] || null,
    내표: s.지목표[pid] || null,
    내찬반: s.찬반[pid] || null,
    고를수있는사람: 고를수있는사람(s, pid),
    // 찬반 투표에서 최후 변론 당사자는 투표하지 않는다
    내가변론중인가: s.최다득표 === pid
  };

  if (!살아있나) {
    // 유령은 밤마다 '마피아 예측'을 찍는다
    const 찍은것 = s.유령예측[pid] || [];
    내것.유령예측 = 찍은것.filter(Boolean).map(이름);
    내것.이번예측 = 찍은것[s.day - 1] ? 이름(찍은것[s.day - 1]) : null;
  }

  if (내역할 === '마피아') {
    // 동료를 알고, 동료가 지금 누구를 찍었는지 실시간으로 본다 (SPEC 5-5)
    내것.내동료 = 마피아들
      .filter(x => x !== pid)
      .map(x => ({
        name: 이름(x),
        살아있나: !!s.생존[x],
        지목: s.phase === '밤' && s.밤지목[x] ? 이름(s.밤지목[x]) : null
      }));
  }
  if (내역할 === '경찰') {
    내것.내조사 = (역할가져오기(s).경찰기록[pid] || []).map(r => ({
      day: r.day, name: 이름(r.대상), 마피아냐: r.마피아냐
    }));
  }
  if (내역할 === '의사') {
    내것.직전보호 = s.지난보호 ? 이름(s.지난보호) : null;   // 연속으로는 못 고른다
  }
  if (내역할 === '군인') {
    const 몰래 = 역할가져오기(s);
    내것.방패남음 = !!몰래.군인방패[pid];
    내것.군인알림 = 몰래.군인알림[pid] || null;              // 본인에게만
  }

  // 끝나기 전에는 남의 역할이 한 글자도 들어가지 않는다.
  if (!끝났나) 내것.역할공개 = null;
  return 내것;
}

// 밤에 고를 수 있는 사람 (자기 자신 제외, 살아 있는 사람만)
function 고를수있는사람(s, pid) {
  const 목록 = s.명단
    .filter(x => s.생존[x] && x !== pid)
    .map(x => ({ id: x, name: 이름(x), teamId: 팀(x) }));

  // 의사는 직전에 보호한 사람을 또 고를 수 없다
  if (s.phase === '밤' && 역할(s, pid) === '의사' && s.지난보호) {
    return 목록.map(x => ({ ...x, 못고름: x.id === s.지난보호 }));
  }
  return 목록;
}

// ══════════════════════════════════════════════════════════
// 단계 진행
// ══════════════════════════════════════════════════════════
function 단계시작(s, phase) {
  s.phase = phase;
  s.endsAt = Date.now() + (단계시간[phase] || 30) * 1000;
}

function 단계마감(s) {
  switch (s.phase) {
    case '밤': 밤마감(s); break;
    case '아침': 단계시작(s, '토론'); break;
    case '토론': s.지목표 = {}; s.재투표 = false; 단계시작(s, '지목투표'); break;
    case '지목투표': 지목투표마감(s); break;
    case '최후변론': s.찬반 = {}; 단계시작(s, '찬반투표'); break;
    case '찬반투표': 찬반마감(s); break;
    default: break;
  }
}

function 밤마감(s) {
  const 몰래 = 역할가져오기(s);
  const 맵 = 몰래.역할;
  const 산 = 산사람(s);

  // ① 마피아의 대상 — 다수결, 동률이면 랜덤 (SPEC 5-5)
  const 마피아산사람 = 산.filter(pid => 맵[pid] === '마피아');
  const 공격 = 다수결(마피아산사람.map(pid => s.밤지목[pid]).filter(Boolean));

  // ② 의사 보호 · ③ 경찰 조사
  const 의사 = 산.find(pid => 맵[pid] === '의사');
  const 보호 = 의사 ? s.밤지목[의사] : null;

  const 경찰 = 산.find(pid => 맵[pid] === '경찰');
  const 조사 = 경찰 ? s.밤지목[경찰] : null;
  if (경찰 && 조사) {
    const 마피아냐 = 맵[조사] === '마피아';
    (몰래.경찰기록[경찰] ||= []).push({ day: s.day, 대상: 조사, 마피아냐 });
    if (마피아냐) 메모(s, 경찰).경찰적중 += 1;
  }

  // ④ 결과
  let 죽은사람 = null;
  let 아무일없음 = false;
  if (공격) {
    if (보호 && 보호 === 공격) {
      아무일없음 = true;
      if (의사) 메모(s, 의사).의사막음 += 1;
    } else if (맵[공격] === '군인' && 몰래.군인방패[공격]) {
      몰래.군인방패[공격] = false;
      몰래.군인알림[공격] = s.day;            // 본인에게만 알린다
      아무일없음 = true;
    } else {
      s.생존[공격] = false;
      죽은사람 = 공격;
    }
  } else {
    아무일없음 = true;
  }

  // ⑤ 가장 의심받은 사람 — 시민들이 찍은 것만 센다
  //    (특수 역할이 찍은 것은 의심이 아니라 그 역할의 행동이다)
  const 의심표 = 산
    .filter(pid => 맵[pid] === '시민')
    .map(pid => s.밤지목[pid])
    .filter(Boolean);
  const 의심받은 = 다수결(의심표);

  s.아침소식 = {
    죽은사람: 죽은사람 ? 이름(죽은사람) : null,
    // 의사가 막았는지 군인이 버텼는지는 구분해 보여주지 않는다 (SPEC 5-5)
    아무일없음,
    의심받은사람: 의심받은 ? 이름(의심받은) : null
  };
  s.기록.push(죽은사람
    ? `${s.day}일차 밤 — ${이름(죽은사람)} 님이 당했습니다.`
    : `${s.day}일차 밤 — 아무 일도 없었습니다.`);

  s.지난보호 = 보호 || null;
  s.밤지목 = {};
  s.최다득표 = null;
  s.처형소식 = null;
  비밀저장(s);

  if (승패확인(s)) return;
  단계시작(s, '아침');
}

function 지목투표마감(s) {
  const 표들 = Object.values(s.지목표).filter(v => v && v !== '기권');
  if (표들.length === 0) {
    s.기록.push('아무도 지목되지 않았습니다.');
    밤으로(s);
    return;
  }

  const 센것 = 세기(표들);
  const 최고 = Math.max(...센것.values());
  const 최다들 = [...센것.entries()].filter(([, n]) => n === 최고).map(([k]) => k);

  if (최다들.length > 1) {
    if (!s.재투표) {
      s.재투표 = true;
      s.지목표 = {};
      s.기록.push('동률입니다. 한 번만 다시 투표합니다.');
      단계시작(s, '지목투표');
      return;
    }
    s.기록.push('또 동률이라 이번에는 아무도 처형하지 않습니다.');
    밤으로(s);
    return;
  }

  s.최다득표 = 최다들[0];
  s.기록.push(`${이름(s.최다득표)} 님이 지목되었습니다. 최후 변론을 듣습니다.`);
  단계시작(s, '최후변론');
}

function 찬반마감(s) {
  const 대상 = s.최다득표;
  const 찬성한사람 = Object.entries(s.찬반).filter(([, v]) => v === '찬성').map(([k]) => k);
  const 찬성 = 찬성한사람.length;
  const 반대 = Object.values(s.찬반).filter(v => v === '반대').length;
  // 투표할 수 있는 사람은 '살아 있는 사람 중 변론 당사자를 뺀' 수다
  const 투표가능 = Math.max(0, 산사람(s).length - 1);
  const 과반 = 찬성 > 투표가능 / 2;

  if (대상 && 과반) {
    s.생존[대상] = false;
    const 마피아였나 = 역할(s, 대상) === '마피아';
    if (마피아였나) {
      for (const pid of 찬성한사람) 메모(s, pid).찬성적중 += 1;
    }
    s.처형소식 = { name: 이름(대상), 찬성, 반대, 처형: true };
    s.기록.push(`${이름(대상)} 님이 처형되었습니다. (찬성 ${찬성} · 반대 ${반대})`);
    비밀저장(s);
  } else {
    s.처형소식 = { name: 대상 ? 이름(대상) : null, 찬성, 반대, 처형: false };
    s.기록.push(`과반이 안 되어 처형하지 않습니다. (찬성 ${찬성} · 반대 ${반대})`);
  }

  s.최다득표 = null;
  if (승패확인(s)) return;
  밤으로(s);
}

function 밤으로(s) {
  s.지목표 = {};
  s.찬반 = {};
  s.재투표 = false;
  s.최다득표 = null;

  // 이미 승부가 났으면 새 밤을 열지 않는다
  if (승패확인(s)) return;

  if (s.day >= s.총일수) {
    // 6일차가 끝나도 결판이 안 나면 마피아 승 (SPEC 5-5)
    끝내기(s, '마피아승', `${s.총일수}일이 지나 마피아가 이겼습니다.`);
    return;
  }
  s.day += 1;
  s.밤지목 = {};
  s.기록.push(`${s.day}일차 밤이 되었습니다.`);
  단계시작(s, '밤');
}

function 승패확인(s) {
  const 맵 = 역할가져오기(s).역할;
  const 산 = 산사람(s);
  const 마 = 산.filter(pid => 맵[pid] === '마피아').length;
  const 나머지 = 산.length - 마;

  if (마 === 0) { 끝내기(s, '시민승', '마피아를 모두 찾았습니다. 시민 승리!'); return true; }
  if (마 >= 나머지) { 끝내기(s, '마피아승', '마피아 수가 시민과 같아졌습니다. 마피아 승리!'); return true; }
  return false;
}

function 끝내기(s, 결과, 말) {
  s.결과 = 결과;
  s.phase = '끝';
  s.endsAt = null;
  s.최다득표 = null;
  s.기록.push(말);
}

// ══════════════════════════════════════════════════════════
// 잔일
// ══════════════════════════════════════════════════════════
function 이름(pid) { return state.players[pid]?.name || '(나감)'; }
function 팀(pid) { return state.players[pid]?.teamId || null; }
function 산사람(s) { return s.명단.filter(pid => s.생존[pid]); }

function 메모(s, pid) {
  const 몰래 = 역할가져오기(s);
  return (몰래.점수메모[pid] ||= { 경찰적중: 0, 의사막음: 0, 찬성적중: 0 });
}

function 섞기(배열) {
  const a = [...배열];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function 세기(목록) {
  const m = new Map();
  for (const x of 목록) m.set(x, (m.get(x) || 0) + 1);
  return m;
}

// 가장 많이 나온 것. 동률이면 그중 하나를 랜덤으로 (SPEC 5-5)
function 다수결(목록) {
  if (!목록.length) return null;
  const m = 세기(목록);
  const 최고 = Math.max(...m.values());
  const 최다들 = [...m.entries()].filter(([, n]) => n === 최고).map(([k]) => k);
  return 최다들[Math.floor(Math.random() * 최다들.length)];
}

// 지목 투표가 끝나고 공개해도 되는 득표수 (누가 찍었는지는 담지 않는다)
function 득표표(s) {
  const 표들 = Object.values(s.지목표).filter(v => v && v !== '기권');
  if (!표들.length) return [];
  return [...세기(표들).entries()]
    .map(([pid, n]) => ({ name: 이름(pid), 표수: n }))
    .sort((a, b) => b.표수 - a.표수);
}

function 밤낸사람수(s) {
  const 산것 = Object.keys(s.밤지목).length;
  const 유령것 = Object.values(s.유령예측).filter(목록 => !!목록?.[s.day - 1]).length;
  return 산것 + 유령것;
}

// 살아 있는 사람이 전부 냈으면 기다릴 이유가 없다.
// (타이머만 믿으면 다 내고도 30초를 멀뚱히 기다리게 된다)
function 투표다찼나(s) {
  if (Object.keys(s.지목표).length >= 산사람(s).length) 단계마감(s);
}

function 찬반다찼나(s) {
  if (Object.keys(s.찬반).length >= Math.max(0, 산사람(s).length - 1)) 단계마감(s);
}
