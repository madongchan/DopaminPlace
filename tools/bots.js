// 가짜 참가자 봇 (SPEC 12장)
//
//   npm run bots -- 11            봇 11명이 입장해 끝까지 자동으로 논다
//   node tools/bots.js 11         같은 말
//   node tools/bots.js 11 3000    다른 포트
//
// 진행자 1명 + 봇 11명이면 혼자서도 전체 흐름을 돌려볼 수 있다.
// 봇은 진짜 참가자와 똑같은 길로만 들어간다 — 서버에 봇 전용 통로는 없다.
import { io } from 'socket.io-client';

const 인원 = Math.max(1, Math.min(30, Number(process.argv[2]) || 11));
const 포트 = Number(process.argv[3]) || 3000;
const URL = `http://localhost:${포트}`;

const 잠시 = (ms) => new Promise(r => setTimeout(r, ms));
const 뽑기 = (a) => a[Math.floor(Math.random() * a.length)];
const 랜덤 = (min, max) => min + Math.random() * (max - min);
const 보내 = (s, ev, d) => new Promise(r => s.emit(ev, d, r));

// ══════════════════════════════════════════════════════════
// 게임별 봇 행동
//   새 게임을 만들면 여기에 한 칸만 더하면 된다.
//   view 는 그 봇이 받은 개인 뷰다(남의 정보는 들어 있지 않다).
// ══════════════════════════════════════════════════════════
const 게임별행동 = {
  telepathy(봇, view, 내기) {
    if (view.phase !== 'input') return;
    if (봇.낸라운드 === view.round) return;        // 라운드당 한 번만
    봇.낸라운드 = view.round;

    // 사람처럼 조금 생각하다 낸다. 팀원끼리 답이 겹치도록
    // 흔한 답 몇 개에서 주로 고르되, 가끔 엉뚱한 답도 낸다.
    const 흔한답 = ['계란', '파', '김치', '치즈', '라면', '만두', '떡', '햄', '콩나물', '버섯'];
    const 답 = Math.random() < 0.75 ? 뽑기(흔한답.slice(0, 4)) : 뽑기(흔한답);
    setTimeout(() => 내기({ answer: 답 }), 랜덤(1200, 8000));
  },

  chosung(봇, view, 내기) {
    if (view.phase !== 'input') return;
    if (!view.입력가능) return;                     // 오답 잠금·우리 팀 정답이면 쉰다
    if (봇.낸라운드 === view.round && Math.random() < 0.6) return;
    봇.낸라운드 = view.round;

    // 봇은 정답을 모른다(서버가 안 보내준다). 초성 글자 수에 맞는 말을 찍는다.
    // 힌트가 열리면 조금 더 그럴듯한 걸 낸다 — 사람처럼 보이게 하는 것뿐이다.
    const 찍기 = ['월요병', '퇴근하고싶다', '치킨', '회식', '연차', '점심시간', '보너스', '휴가'];
    setTimeout(() => 내기({ answer: 뽑기(찍기) }), 랜덤(2000, 9000));
  },

  nunchi(봇, view, 내기) {
    if (view.phase !== '진행') return;
    if (!view.누를수있나) return;
    if (봇.누른판 === view.판) return;               // 한 판에 한 번만
    봇.누른판 = view.판;

    // 눈치 게임이니 서로 다른 때에 누른다. 아예 안 누르는 봇도 있어야
    // '끝까지 안 누른 사람 탈락' 규칙을 실제로 볼 수 있다.
    if (Math.random() < 0.15) return;
    setTimeout(() => 내기({ act: '누름' }), 랜덤(500, 17000));
  },

  reaction(봇, view, 내기) {
    if (view.내이번판 != null) return;               // 이 판은 이미 냈다
    if (봇.낸판 === view.round && view.phase === '초록') return;

    if (view.phase === '빨강') {
      // 가끔 부정 출발 — 벌점 규칙을 확인할 수 있게
      if (Math.random() < 0.08) { 봇.낸판 = view.round; 내기({ ms: 0 }); }
      return;
    }
    if (view.phase !== '초록') return;
    봇.낸판 = view.round;
    // 사람의 반응속도는 대략 180~450ms다
    const ms = Math.round(랜덤(180, 450));
    setTimeout(() => 내기({ ms }), ms);
  },

  mafia(봇, view, 내기) {
    if (view.결과 || view.일시정지) return;
    const 고를것 = view.고를수있는사람 || [];
    if (!고를것.length) return;

    if (view.phase === '밤') {
      if (봇.낸밤 === view.day) return;
      봇.낸밤 = view.day;
      // 마피아 봇은 동료와 같은 사람을 찍어 다수결이 모이게 한다
      let 대상;
      if (view.내역할 === '마피아') {
        const 동료가찍은 = (view.내동료 || []).map(x => x.지목).filter(Boolean)[0];
        const 찾음 = 동료가찍은 ? 고를것.find(p => p.name === 동료가찍은) : null;
        대상 = 찾음 || 뽑기(고를것.filter(p => !p.못고름));
      } else {
        대상 = 뽑기(고를것.filter(p => !p.못고름));
      }
      if (대상) setTimeout(() => 내기({ act: '지목', target: 대상.id }), 랜덤(2000, 25000));
      return;
    }

    if (view.phase === '지목투표') {
      if (봇.낸투표 === view.day + '-' + (view.재투표 ? 'R' : '')) return;
      봇.낸투표 = view.day + '-' + (view.재투표 ? 'R' : '');
      // 가끔은 기권해서 '아무도 지목 안 됨'도 나오게 한다
      const 기권할까 = Math.random() < 0.15;
      const 대상 = 뽑기(고를것);
      setTimeout(() => 내기({
        act: '지목투표', target: 기권할까 || !대상 ? '기권' : 대상.id
      }), 랜덤(1500, 12000));
      return;
    }

    if (view.phase === '찬반투표') {
      if (view.내가변론중인가) return;
      if (봇.낸찬반 === view.day) return;
      봇.낸찬반 = view.day;
      setTimeout(() => 내기({
        act: '찬반', 값: Math.random() < 0.6 ? '찬성' : '반대'
      }), 랜덤(1000, 8000));
    }
  }

  // 병뚜껑 던지기는 휴대폰에서 아무것도 보내지 않는다(진행자가 판정한다).
  // 그래서 봇 행동이 없다.
};

// ══════════════════════════════════════════════════════════
// 봇 하나
// ══════════════════════════════════════════════════════════
function 봇만들기(번호, 입장코드) {
  const 봇 = {
    이름: `봇${번호}`,
    핀: String(9000 + 번호),
    소켓: io(URL, { forceNew: true }),
    뷰: null,
    낸라운드: null,
    누른판: null,
    낸판: null,
    낸밤: null,
    낸투표: null,
    낸찬반: null,
    팀정했나: false
  };

  봇.소켓.on('connect', async () => {
    const r = await 보내(봇.소켓, 'join', { code: 입장코드, name: 봇.이름, pin: 봇.핀 });
    if (r?.ok) return 처리(봇, r.view);

    // 이미 그 이름이 있으면 그 자리로 돌아간다(서버를 껐다 켠 뒤 다시 돌릴 때).
    const r2 = await 보내(봇.소켓, 'resume', { name: 봇.이름, pin: 봇.핀 });
    if (r2?.ok) return 처리(봇, r2.view);
    console.log(`  ${봇.이름}: ${r?.error || r2?.error}`);
  });

  봇.소켓.on('view', (v) => 처리(봇, v));
  봇.소켓.on('내보내짐', () => { console.log(`  ${봇.이름} 내보내짐`); 봇.소켓.disconnect(); });

  return 봇;
}

function 처리(봇, v) {
  봇.뷰 = v;

  // ① 팀 고르기 — 사람이 적은 팀으로 (서버가 인원 차 1명을 넘기면 막는다)
  if (v.teamPhase === 'picking' && !v.내팀) {
    const 적은팀 = [...(v.팀현황 || [])].sort((a, b) => a.인원 - b.인원)[0];
    if (적은팀) setTimeout(() => 봇.소켓.emit('team:pick', { teamId: 적은팀.id }), 랜덤(400, 2500));
    return;
  }

  // ② 팀 대표면 이름·색 정하기
  if (v.teamPhase === 'naming' && v.대표인가 && !봇.팀정했나) {
    봇.팀정했나 = true;
    const 이름들 = ['붕어빵', '마라탕', '초코파이', '탕후루', '떡볶이', '곱창', '냉면', '호떡'];
    const 이름 = `${뽑기(이름들)}${Math.floor(Math.random() * 90 + 10)}`;

    // 봇 둘이 같은 색을 동시에 고르면 서버가 뒤엣것을 거절한다(색은 팀마다 달라야 한다).
    // 그러면 이름도 같이 안 들어가므로, 거절당하면 다른 색으로 다시 시도한다.
    const 정하기 = async (남은시도 = 6) => {
      const 지금뷰 = 봇.뷰 || v;
      const 안쓴색 = (지금뷰.palette || []).filter(c => !c.taken);
      const 고를색 = 안쓴색.length ? 안쓴색 : (지금뷰.palette || []);
      if (!고를색.length || 남은시도 <= 0) return;
      const r = await 보내(봇.소켓, 'team:set', { name: 이름, colorId: 뽑기(고를색).id });
      if (r?.ok) return;
      await 잠시(랜덤(150, 500));
      return 정하기(남은시도 - 1);
    };
    setTimeout(() => { 정하기(); }, 랜덤(300, 1200));
    return;
  }

  // ③ 게임이 돌고 있으면 그 게임 행동
  const c = v.current;
  if (c?.phase === 'playing' && c.view) {
    const 행동 = 게임별행동[c.gameId];
    if (행동) {
      행동(봇, c.view, (payload) =>
        봇.소켓.emit('input', { gameId: c.gameId, playId: c.playId, payload }));
    }
  }
  // 게임이 끝나면 다음 판을 위해 기록을 지운다
  if (!c || c.phase !== 'playing') {
    봇.낸라운드 = null;
    봇.누른판 = null;
    봇.낸판 = null;
    봇.낸밤 = null;
    봇.낸투표 = null;
    봇.낸찬반 = null;
  }
}

// ══════════════════════════════════════════════════════════
// 시작
// ══════════════════════════════════════════════════════════
console.log(`\n가짜 참가자 ${인원}명을 ${URL} 에 들여보냅니다.\n`);

// 입장코드는 서버에서 직접 받아온다(진행자 PIN 없이도 되도록 큰 화면 뷰를 쓴다).
const 화면 = io(URL, { forceNew: true });
const 입장코드 = await new Promise((resolve, reject) => {
  const 시간초과 = setTimeout(
    () => reject(new Error('서버에 연결하지 못했습니다. 먼저 서버를 켜주세요.')), 8000);
  화면.on('connect', () => 화면.emit('screen:hello'));
  화면.once('screen', (v) => { clearTimeout(시간초과); resolve(v.joinCode); });
}).catch((e) => { console.error('  ' + e.message + '\n'); process.exit(1); });

console.log(`  입장코드 ${입장코드}\n`);

const 봇들 = [];
for (let i = 1; i <= 인원; i++) {
  봇들.push(봇만들기(i, 입장코드));
  await 잠시(120);                 // 한꺼번에 몰리지 않게 조금씩
}

await 잠시(1800);
console.log(`  ${봇들.filter(b => b.뷰).length}명 입장 완료.`);
console.log('');
console.log('  이제 /admin 에서 팀을 나누고 게임을 시작하세요.');
console.log('  봇이 알아서 팀을 고르고, 팀 이름을 정하고, 게임에 답합니다.');
console.log('');
console.log('  끄려면 Ctrl+C');
console.log('');

// 끌 때 깨끗하게 나간다
process.on('SIGINT', () => {
  console.log('\n  봇을 내보냅니다…');
  for (const b of 봇들) b.소켓.disconnect();
  화면.disconnect();
  process.exit(0);
});
