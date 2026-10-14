// 5단계 점검 — 새 게임 4종의 규칙이 SPEC과 맞는가
//
//   node tools/smoke-5단계.mjs
//
// 서버를 켤 필요가 없다. 게임 모듈을 직접 불러서 규칙만 확인한다.
// (초성 10문제 × 30초를 소켓으로 돌리면 5분이 걸린다 — 시간을 앞으로 당겨서 본다)
// data/state.json 은 건드리지 않는다. 메모리의 참가자만 가짜로 바꿔 쓰고 되돌린다.
//
// 보는 것:
//   텔레파시     — 라운드마다 일치율 1등 팀만 +1, 게임 1등 팀만 +5, 개인 활약 없음
//   초성 퀴즈    — 정답 유출 방지, 힌트 상시 표시, 오답 2초 잠금, 첫 정답 팀만 1점, 정답 인정
//   눈치 게임    — 0.3초 동시 탈락, 미입력 탈락, 생존 +2
//   반응속도     — 초록 시각 비공개, 부정출발 1000ms, 좋은 3판 평균
import { state } from '../server/state.js';
import telepathy from '../server/games/telepathy/index.js';
import chosung from '../server/games/chosung/index.js';
import nunchi from '../server/games/nunchi/index.js';
import reaction from '../server/games/reaction/index.js';

let 통과 = 0, 실패 = 0;
function 확인(라벨, 조건, 덧 = '') {
  if (조건) { 통과++; console.log(`  OK  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
  else { 실패++; console.log(`  !!  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
}

// ── 가짜 참가자 ─────────────────────────────────────────────
const 원래참가자 = state.players;
function 참가자세팅(목록) {
  state.players = {};
  목록.forEach(([id, name, teamId], i) => {
    state.players[id] = { id, name, teamId, connected: true, joinedAt: 1000 + i };
  });
}
const 이름들 = (점수맵) =>
  Object.entries(점수맵).map(([k, v]) => `${state.players[k]?.name}=${v}`).join(' ');

// ══════════════════════════════════════════════════════════
console.log('\n[텔레파시 — 라운드 1등 팀만 +1, 게임 1등 팀만 +5]');
{
  참가자세팅([
    ['a', '가', 'A'], ['b', '나', 'A'], ['c', '다', 'A'],
    ['d', '라', 'B'], ['e', '마', 'B'], ['f', '바', 'B'],
    ['g', '사', 'C'], ['h', '아', 'C'], ['i', '자', 'C']
  ]);
  const s = telepathy.create({ content: { telepathy: ['라면 재료', '여름 하면'] } });
  const 낸다 = (답들) => { for (const [pid, 답] of Object.entries(답들)) telepathy.onInput(s, pid, { answer: 답 }); };

  // 1라운드: A 3/3, B 2/3, C 모두 다름 → A만 +1
  낸다({ a: '계란', b: '계란', c: '계란', d: '파', e: '파', f: '김치', g: '치즈', h: '떡', i: '만두' });
  telepathy.onTick(s, s.endsAt);
  const 결 = s.라운드기록[0].결과;
  확인('일치율이 가장 높은 팀만 +1', 결.A.점수 === 1 && 결.B.점수 === 0 && 결.C.점수 === 0,
    `A ${결.A.일치}=${결.A.점수} · B ${결.B.일치}=${결.B.점수} · C ${결.C.일치}=${결.C.점수}`);

  // 2라운드: A·B 둘 다 2/3 → 동점이면 둘 다 +1, C는 혼자 쓴 답뿐이라 0
  telepathy.onAdmin(s, { action: '다음' });
  낸다({ a: '수박', b: '수박', c: '바다', d: '수박', e: '수박', f: '모기', g: '바다', h: '모기', i: '휴가' });
  telepathy.onTick(s, s.endsAt);
  확인('동점이면 공동으로 +1', s.팀총점.A === 2 && s.팀총점.B === 1 && s.팀총점.C === 0,
    `A ${s.팀총점.A} · B ${s.팀총점.B} · C ${s.팀총점.C}`);

  const r = telepathy.result(s);
  const 받은 = Object.fromEntries(r.점수.map(x => [x.playerId, x.points]));
  확인('게임 1등 팀만 팀원 모두 +5', 받은.a === 5 && 받은.b === 5 && 받은.c === 5 && !받은.d && !받은.g,
    JSON.stringify(받은));
  확인('개인 활약 점수는 없다', !r.점수.some(x => x.reason.includes('활약')));
}

// ══════════════════════════════════════════════════════════
console.log('\n[초성 퀴즈]');
{
  참가자세팅([
    ['a', '가', 'A'], ['b', '나', 'A'],
    ['c', '다', 'B'], ['d', '라', 'B'],
    ['e', '마', 'C']
  ]);

  const 문제 = [{ 초성: 'ㅇㅇㅂ', 정답: '월요병', 힌트: '매주 찾아오는 병' }];
  const s = chosung.create({ content: { chosung: 문제 } });
  const 정답 = s.문제들[0].정답;
  const 힌트 = s.문제들[0].힌트;

  // ── 정답이 새어 나가지 않는가 (SPEC 4장) ──
  let v = chosung.views(s);
  확인('푸는 중에는 큰 화면에 정답이 없다', v.screen.정답 === null);
  확인('푸는 중에는 휴대폰에도 정답이 없다', v.player('a').정답 === null);
  확인('정답은 adminSecret 에만 있다', v.adminSecret.정답 === 정답);
  const 나가는글 = JSON.stringify(v.screen) + JSON.stringify(v.player('a')) + JSON.stringify(v.admin);
  확인('화면으로 나가는 데이터에 정답 글자가 없다', !나가는글.includes(정답), `찾은 말 "${정답}"`);

  // ── 힌트는 처음부터 보인다 ──
  확인('힌트가 시작하자마자 큰 화면에 보인다', v.screen.힌트 === 힌트, v.screen.힌트);
  확인('힌트가 휴대폰에도 보인다', v.player('a').힌트 === 힌트);

  // ── 오답은 2초 잠금 ──
  chosung.onInput(s, 'a', { answer: '금요일' });
  v = chosung.views(s);
  확인('오답이 진행자 로그에 남는다', v.admin.오답.length === 1, v.admin.오답[0]?.답);
  확인('오답 뒤에는 입력이 잠긴다', v.player('a').입력가능 === false);
  확인('잠금은 2초다',
    v.player('a').재입력까지 > 1500 && v.player('a').재입력까지 <= 2000,
    `${v.player('a').재입력까지}ms`);
  확인('내 오답만 내 화면에 보인다',
    v.player('a').내오답.length === 1 && v.player('c').내오답.length === 0);

  chosung.onInput(s, 'a', { answer: 정답 });
  확인('잠긴 동안 낸 정답은 무효다', s.맞힌.length === 0);

  // ── 가장 먼저 맞힌 팀만 점수를 얻는다 ──
  s.다음입력 = {};                                      // 2초 지난 것으로 만든다
  chosung.onInput(s, 'c', { answer: [...정답].join(' ') });   // B팀 — 띄어쓰기를 넣어 제출
  확인('공백을 지우고 비교한다 (띄어 써도 정답)', s.팀총점.B === 1, `B=${s.팀총점.B}`);
  확인('가장 먼저 맞힌 팀이 1점', s.팀총점.B === 1 && !s.팀총점.A && !s.팀총점.C);
  확인('한 팀이 맞히면 그 문제는 바로 공개된다', s.phase === 'reveal', s.phase);

  chosung.onInput(s, 'a', { answer: 정답 });             // 공개된 뒤에 다른 팀이 낸 정답
  확인('두 번째로 맞힌 팀은 점수가 없다', !s.팀총점.A && s.맞힌.length === 1, `A=${s.팀총점.A ?? 0}`);

  v = chosung.views(s);
  확인('공개 뒤에는 정답이 화면에 나온다', v.screen.정답 === 정답, v.screen.정답);
  확인('맞힌 팀이 점수와 함께 나온다',
    v.screen.맞힌.map(x => `${x.teamId}:${x.점수}`).join(' ') === 'B:1',
    v.screen.맞힌.map(x => `${x.teamId}:${x.점수}`).join(' '));
  확인('이미 맞힌 팀이 있으면 다른 오답은 인정할 수 없다', v.admin.오답.every(o => o.인정가능 === false));

  // ── 진행자 '정답 인정' ──
  {
    참가자세팅([['a', '가', 'A'], ['c', '다', 'B']]);
    const s2 = chosung.create({ content: { chosung: 문제 } });
    chosung.onInput(s2, 'a', { answer: '월요병이요' });   // 뜻은 맞지만 표기가 다르다
    확인('정답 인정 전에는 점수가 없다', !s2.팀총점.A);
    const 줄 = chosung.views(s2).admin.오답[0];
    확인('진행자 로그에 인정 가능 표시가 있다', 줄?.인정가능 === true);
    chosung.onAdmin(s2, { action: '정답인정', payload: { 번호: 줄.번호 } });
    확인('정답 인정으로 팀 점수가 들어간다', s2.팀총점.A === 1, `A=${s2.팀총점.A}`);
    확인('인정하면 그 문제는 바로 공개된다', s2.phase === 'reveal', s2.phase);
    확인('인정한 것은 표시가 남는다', chosung.views(s2).screen.맞힌[0]?.인정 === true);
  }

  // ── 끝났을 때 점수 ──
  {
    참가자세팅([['a', '가', 'A'], ['c', '다', 'B'], ['e', '마', 'C']]);
    const s3 = chosung.create({ content: { chosung: 문제 } });
    s3.팀총점 = { A: 9, B: 5, C: 1 };
    s3.개인첫정답 = { a: 5, c: 1 };
    const r = chosung.result(s3);
    const 점 = (pid) => r.점수.filter(x => x.playerId === pid).map(x => x.points);
    확인('1등 팀원만 +5', 점('a').join() === '5', `a = ${점('a').join(', ')}`);
    확인('2·3등 팀은 0점', 점('c').join() === '0' && 점('e').join() === '0', `c = ${점('c')} · e = ${점('e')}`);
    확인('개인 활약 점수는 없다', !r.점수.some(x => x.reason.includes('활약')));
  }
}

// ══════════════════════════════════════════════════════════
console.log('\n[눈치 게임]');
{
  참가자세팅([['a', '가', 'A'], ['b', '나', 'A'], ['c', '다', 'B'], ['d', '라', 'B'], ['e', '마', 'C']]);
  const s = nunchi.create();
  nunchi.onAdmin(s, { action: '다음' });

  nunchi.onInput(s, 'a', { act: '누름' });
  await new Promise(r => setTimeout(r, 400));           // 0.3초보다 길게 벌린다
  nunchi.onInput(s, 'b', { act: '누름' });
  const v = nunchi.views(s);
  확인('순서가 1, 2로 매겨진다',
    v.screen.누른사람.map(x => `${x.순서}번 ${x.name}`).join(' / ') === '1번 가 / 2번 나',
    v.screen.누른사람.map(x => `${x.순서}번 ${x.name}`).join(' / '));
  확인('0.3초 넘게 벌리면 안 겹친다', s.탈락.length === 0);

  await new Promise(r => setTimeout(r, 400));           // 나 → 다 도 충분히 벌린다
  nunchi.onInput(s, 'c', { act: '누름' });
  nunchi.onInput(s, 'd', { act: '누름' });               // 다 바로 뒤 — 이 둘만 겹친다
  확인('0.3초 안에 겹치면 둘 다 탈락', s.탈락.length === 2, `탈락 ${s.탈락.length}명`);
  확인('왜 탈락했는지 진행자에게 보인다',
    nunchi.views(s).admin.판정로그.some(x => x.includes('동시 탈락')),
    nunchi.views(s).admin.판정로그.slice(-1)[0]);

  nunchi.onAdmin(s, { action: '지금끝' });
  확인('끝까지 안 누른 사람도 탈락', s.탈락.includes('e'), `탈락 ${s.탈락.length}명`);
  확인('생존자에게만 +2', s.점수.a === 2 && s.점수.b === 2 && !s.점수.e, 이름들(s.점수));
}

// ══════════════════════════════════════════════════════════
console.log('\n[반응속도]');
{
  참가자세팅([['a', '가', 'A'], ['b', '나', 'A'], ['c', '다', 'B']]);
  const s = reaction.create();
  reaction.onAdmin(s, { action: '다음' });

  const v = reaction.views(s);
  확인('초록으로 바뀔 시각은 화면에 안 나온다',
    v.screen.바뀔시각 === undefined && v.player('a').바뀔시각 === undefined);
  확인('진행자만 스포일러로 볼 수 있다', typeof v.adminSecret.바뀔시각 === 'number');

  reaction.onInput(s, 'a', { ms: 200 });                 // 아직 빨강 — 부정출발
  확인('빨강일 때 누르면 부정출발 1000ms', s.이번라운드.a === 1000, `${s.이번라운드.a}ms`);

  reaction.onTick(s, s.바뀔시각 + 1);                    // 초록으로 바꾼다
  확인('시간이 되면 초록으로 바뀐다', s.phase === '초록', s.phase);

  reaction.onInput(s, 'b', { ms: 250 });
  reaction.onInput(s, 'c', { ms: 400 });
  확인('마지막 사람이 내면 라운드가 바로 끝난다', s.phase === '라운드끝', s.phase);

  const 순위 = reaction.views(s).screen.순위
    .map(x => `${x.rank}위 ${x.name} ${x.기록}ms`).join(' / ');
  확인('순위가 나온다', 순위 === '1위 나 250ms / 2위 다 400ms / 3위 가 1000ms', 순위);
  const 가 = reaction.views(s).screen.순위.find(x => x.name === '가');
  확인('부정출발한 판은 이번 판 기록에 1000ms 로 나간다', 가?.이번판 === 1000, `${가?.이번판}ms`);

  // 좋은 3판 평균 (5판 중)
  const s2 = reaction.create();
  s2.기록 = { a: [500, 300, 200, 400, 1000] };           // 좋은 3개 = 200, 300, 400
  확인('기록은 좋은 3판의 평균이다',
    reaction.views(s2).screen.순위[0]?.기록 === 300,
    `${reaction.views(s2).screen.순위[0]?.기록}ms (200·300·400 평균)`);
  확인('가장 빠른 사람이 +5', reaction.result(s2).점수[0]?.points === 5);
}

// ══════════════════════════════════════════════════════════
state.players = 원래참가자;      // 건드린 것을 되돌린다
console.log(`\n  통과 ${통과} / 실패 ${실패}\n`);
process.exit(실패 ? 1 : 0);
