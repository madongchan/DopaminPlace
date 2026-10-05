// 5단계 점검 — 새 게임 4종의 규칙이 SPEC과 맞는가
//
//   node tools/smoke-5단계.mjs
//
// 서버를 켤 필요가 없다. 게임 모듈을 직접 불러서 규칙만 확인한다.
// (초성 10문제 × 30초를 소켓으로 돌리면 5분이 걸린다 — 시간을 앞으로 당겨서 본다)
// data/state.json 은 건드리지 않는다. 메모리의 참가자만 가짜로 바꿔 쓰고 되돌린다.
//
// 보는 것:
//   초성 퀴즈    — 정답 유출 방지, 힌트 15초, 오답 2초 잠금, 3·2·1점, 정답 인정
//   병뚜껑 던지기 — 팀 번갈아 순서, 되돌리기, 건너뛰기, 팀 평균, 내 차례
//   눈치 게임    — 0.3초 동시 탈락, 미입력 탈락, 생존 +2
//   반응속도     — 초록 시각 비공개, 부정출발 1000ms, 좋은 3판 평균
import { state } from '../server/state.js';
import chosung from '../server/games/chosung/index.js';
import bottlecap from '../server/games/bottlecap/index.js';
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

  // ── 힌트는 15초가 지나야 ──
  확인('15초 전에는 힌트가 닫혀 있다', v.screen.힌트 === null);
  s.시작시각 -= 16000;                                  // 16초 지난 것으로 만든다
  v = chosung.views(s);
  확인('15초가 지나면 힌트가 열린다', v.screen.힌트 === 힌트, v.screen.힌트);

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

  // ── 팀 순서대로 3·2·1점 ──
  s.다음입력 = {};                                      // 2초 지난 것으로 만든다
  chosung.onInput(s, 'a', { answer: 정답 });             // A팀
  확인('먼저 맞힌 팀이 3점', s.팀총점.A === 3, `A=${s.팀총점.A}`);

  chosung.onInput(s, 'b', { answer: 정답 });             // 같은 팀이 또 맞힘
  확인('같은 팀은 두 번 점수받지 않는다', s.맞힌.length === 1);

  chosung.onInput(s, 'c', { answer: [...정답].join(' ') });   // 띄어쓰기를 넣어 제출
  확인('공백을 지우고 비교한다 (띄어 써도 정답)', s.팀총점.B === 2, `B=${s.팀총점.B}`);

  확인('마지막 팀이 남아 아직 푸는 중이다', s.phase === 'input', s.phase);
  chosung.onInput(s, 'e', { answer: 정답 });             // C팀 — 마지막 팀
  확인('세 번째 팀은 1점', s.팀총점.C === 1, `C=${s.팀총점.C}`);
  확인('모든 팀이 맞히면 바로 공개된다', s.phase === 'reveal', s.phase);

  v = chosung.views(s);
  확인('공개 뒤에는 정답이 화면에 나온다', v.screen.정답 === 정답, v.screen.정답);
  확인('맞힌 순서가 점수와 함께 나온다',
    v.screen.맞힌.map(x => `${x.teamId}:${x.점수}`).join(' ') === 'A:3 B:2 C:1',
    v.screen.맞힌.map(x => `${x.teamId}:${x.점수}`).join(' '));

  // ── 진행자 '정답 인정' ──
  {
    참가자세팅([['a', '가', 'A'], ['c', '다', 'B']]);
    const s2 = chosung.create({ content: { chosung: 문제 } });
    chosung.onInput(s2, 'a', { answer: '월요병이요' });   // 뜻은 맞지만 표기가 다르다
    확인('정답 인정 전에는 점수가 없다', !s2.팀총점.A);
    const 줄 = chosung.views(s2).admin.오답[0];
    확인('진행자 로그에 인정 가능 표시가 있다', 줄?.인정가능 === true);
    chosung.onAdmin(s2, { action: '정답인정', payload: { 번호: 줄.번호 } });
    확인('정답 인정으로 팀 점수가 들어간다', s2.팀총점.A === 3, `A=${s2.팀총점.A}`);
    확인('인정한 것은 표시가 남는다', chosung.views(s2).screen.맞힌[0]?.인정 === true);
  }

  // ── 끝났을 때 점수 ──
  {
    참가자세팅([['a', '가', 'A'], ['c', '다', 'B'], ['e', '마', 'C']]);
    const s3 = chosung.create({ content: { chosung: 문제 } });
    s3.팀총점 = { A: 9, B: 5, C: 1 };
    s3.개인첫정답 = { a: 5, c: 1 };                       // a는 5번 맞혔지만 상한은 +3
    const r = chosung.result(s3);
    const 점 = (pid) => r.점수.filter(x => x.playerId === pid).map(x => x.points);
    확인('1등 팀원 +5', 점('a').includes(5), `a = ${점('a').join(', ')}`);
    확인('2등 팀원 +3', 점('c').includes(3), `c = ${점('c').join(', ')}`);
    확인('3등 팀원 +1', 점('e').includes(1), `e = ${점('e').join(', ')}`);
    const 활약 = r.점수.find(x => x.playerId === 'a' && x.reason.includes('활약'));
    확인('개인 활약은 최대 +3', 활약?.points === 3, `5번 맞혔지만 +${활약?.points}`);
  }
}

// ══════════════════════════════════════════════════════════
console.log('\n[병뚜껑 던지기]');
{
  참가자세팅([
    ['a', '가', 'A'], ['b', '나', 'A'],
    ['c', '다', 'B'], ['d', '라', 'B']
  ]);
  const s = bottlecap.create();

  확인('전원이 순서에 든다', s.순서.length === 4, `${s.순서.length}명`);
  const 팀순 = s.순서.map(id => state.players[id].teamId).join('');
  확인('팀을 번갈아 돈다', 팀순 === 'ABAB' || 팀순 === 'BABA', 팀순);

  let v = bottlecap.views(s);
  const 첫 = s.순서[0];
  확인('지금 던지는 사람이 나온다',
    v.screen.지금차례?.name === state.players[첫].name, v.screen.지금차례?.name);
  확인('다음 사람도 미리 보여준다',
    v.screen.다음차례?.name === state.players[s.순서[1]].name, v.screen.다음차례?.name);
  확인('처음 기회는 3번', v.screen.남은기회 === 3);
  확인('「내 차례」는 그 사람에게만 뜬다',
    v.player(첫).내차례 === true && v.player(s.순서[1]).내차례 === false);

  // ── 판정 입력 ──
  bottlecap.onAdmin(s, { action: '판정', payload: { 점수: 5 } });
  v = bottlecap.views(s);
  확인('가운데 5점이 들어간다', v.screen.이번차례점수.join(',') === '5',
    v.screen.이번차례점수.join(','));
  확인('기회가 하나 줄었다', v.screen.남은기회 === 2);
  확인('아직 같은 사람 차례다', v.screen.지금차례?.name === state.players[첫].name);

  bottlecap.onAdmin(s, { action: '판정', payload: { 점수: 7 } });     // 과녁에 없는 값
  확인('0·1·3·5 아닌 값은 받지 않는다', s.기록.length === 1, `기록 ${s.기록.length}줄`);

  bottlecap.onAdmin(s, { action: '판정', payload: { 점수: 3 } });
  bottlecap.onAdmin(s, { action: '판정', payload: { 점수: 0 } });
  v = bottlecap.views(s);
  확인('3번 던지면 다음 사람으로 넘어간다',
    v.screen.지금차례?.name === state.players[s.순서[1]].name, v.screen.지금차례?.name);
  확인('개인 총점이 쌓인다', v.player(첫).내총점 === 8, `${v.player(첫).내총점}점 (5+3+0)`);
  확인('개인 최고 기록이 남는다', v.player(첫).내최고 === 5);

  // ── 되돌리기 ──
  bottlecap.onAdmin(s, { action: '되돌리기' });
  v = bottlecap.views(s);
  확인('되돌리면 차례가 돌아온다',
    v.screen.지금차례?.name === state.players[첫].name, v.screen.지금차례?.name);
  확인('되돌리면 기회도 돌아온다', v.screen.남은기회 === 1, `${v.screen.남은기회}번 남음`);
  확인('되돌리면 총점에서도 빠진다', v.player(첫).내총점 === 8, `${v.player(첫).내총점}점`);

  // ── 건너뛰기 ──
  const 전 = s.기록.length;
  bottlecap.onAdmin(s, { action: '건너뛰기' });
  확인('건너뛰면 남은 기회가 0점으로 채워진다', s.기록.length === 전 + 1,
    `${전} → ${s.기록.length}줄 (남은 1번만 채움)`);
  확인('건너뛴 것은 표시가 남는다', s.기록[s.기록.length - 1].건너뜀 === true);
  확인('건너뛰면 다음 사람 차례가 된다',
    bottlecap.views(s).screen.지금차례?.name === state.players[s.순서[1]].name);

  // ── 팀 점수 = 총점 ÷ 인원 ──
  {
    참가자세팅([
      ['a', '가', 'A'], ['b', '나', 'A'],      // A팀 2명
      ['c', '다', 'B']                          // B팀 1명
    ]);
    const s2 = bottlecap.create();
    s2.기록 = [
      { playerId: 'a', 점수: 5, 건너뜀: false },
      { playerId: 'b', 점수: 5, 건너뜀: false },
      { playerId: 'c', 점수: 5, 건너뜀: false }
    ];
    const t = bottlecap.views(s2).screen.팀누적;
    확인('팀 점수는 총점 ÷ 인원이다', t.A.평균 === 5 && t.B.평균 === 5,
      `A ${t.A.총점}점÷${t.A.인원}명=${t.A.평균} · B ${t.B.총점}점÷${t.B.인원}명=${t.B.평균}`);

    s2.기록 = [{ playerId: 'a', 점수: 10, 건너뜀: false }];
    const t2 = bottlecap.views(s2).screen.팀누적;
    확인('인원이 많으면 평균이 낮아진다 (인원 보정)', t2.A.평균 === 5,
      `A ${t2.A.총점}점÷${t2.A.인원}명=${t2.A.평균}`);
  }

  // ── 끝났을 때 점수 ──
  {
    참가자세팅([['a', '가', 'A'], ['c', '다', 'B'], ['e', '마', 'C']]);
    const s3 = bottlecap.create();
    s3.기록 = [
      { playerId: 'a', 점수: 5 }, { playerId: 'a', 점수: 5 }, { playerId: 'a', 점수: 5 },
      { playerId: 'c', 점수: 3 }, { playerId: 'c', 점수: 3 }, { playerId: 'c', 점수: 3 },
      { playerId: 'e', 점수: 1 }, { playerId: 'e', 점수: 1 }
    ];
    bottlecap.onAdmin(s3, { action: '판정', payload: { 점수: 1 } });   // 마지막 한 번
    확인('전원이 다 던지면 끝난다', s3.phase === 'done', `${s3.phase} / 기록 ${s3.기록.length}줄`);

    const r = bottlecap.result(s3);
    const 점 = (pid) => r.점수.filter(x => x.playerId === pid);
    const 글 = (pid) => 점(pid).map(x => `+${x.points}(${x.reason})`).join(' ');
    확인('개인 총점 1위 +2', 점('a').some(x => x.points === 2 && x.reason.includes('1위')), 글('a'));
    확인('개인 총점 2위 +1', 점('c').some(x => x.points === 1 && x.reason.includes('2위')), 글('c'));
    확인('3위에게는 개인 활약 점수가 없다', !점('e').some(x => x.reason.includes('병뚜껑 개인')), 글('e'));
    확인('팀 1등은 +5', 점('a').some(x => x.points === 5 && x.reason.includes('1등')));
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
