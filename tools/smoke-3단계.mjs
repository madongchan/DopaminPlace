// 3단계 자동 점검 — 서버를 켜둔 채 `node tools/smoke-3단계.mjs [진행자PIN]` 으로 실행한다.
// 참가자 9명(3팀 × 3명)으로 텔레파시 한 판을 끝까지 돌리고,
// 팀 점수 계산 · 비밀정보 · 점수판 3기준 · 수동 조정까지 확인한다.
import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';
const PIN = process.argv[2] || '0000';
const 잠시 = (ms) => new Promise(r => setTimeout(r, ms));
const 보내 = (s, ev, d) => new Promise(r => s.emit(ev, d, r));
const 새소켓 = () => io(URL, { forceNew: true });
const 붙기 = async (s) => { await new Promise(r => s.on('connect', r)); return s; };

let 통과 = 0, 실패 = 0;
function 확인(라벨, 조건, 덧 = '') {
  if (조건) { 통과++; console.log(`  OK  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
  else { 실패++; console.log(`  !!  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
}

// ── 준비 ────────────────────────────────────────────────────
console.log('\n[1] 준비 — 진행자 로그인, 참가자 9명, 3팀 편성');
const 화면 = await 붙기(새소켓());
let 화면뷰 = null;
화면.emit('screen:hello');
화면.on('screen', v => { 화면뷰 = v; });

const 관리 = await 붙기(새소켓());
const 로그인 = await 보내(관리, 'admin:login', { pin: PIN });
if (!로그인.ok) { console.log('  !!  진행자 PIN이 다릅니다.'); process.exit(1); }
const CODE = 로그인.view.joinCode;

// 앞선 점검이 남긴 사람 치우기
for (const p of 로그인.view.players) {
  await 보내(관리, 'admin', { action: '내보내기', payload: { playerId: p.id } });
}
await 보내(관리, 'admin', { action: '팀편성_초기화' });
await 잠시(400);

// 보드의 플레이 횟수는 일부러 누적된다(SPEC 「완료 n회」).
// 그래서 절대값이 아니라 '이번에 얼마나 늘었는지'를 본다.
const 시작횟수 = (로그인.view.board?.find(b => b.id === 'telepathy')?.playsCount) ?? 0;

const 이름들 = ['가1', '가2', '가3', '나1', '나2', '나3', '다1', '다2', '다3'];
const 폰 = [];
for (const [i, nm] of 이름들.entries()) {
  const s = await 붙기(새소켓());
  const r = await 보내(s, 'join', { code: CODE, name: nm, pin: String(2000 + i) });
  if (!r.ok) { console.log(`  !!  ${nm} 입장 실패: ${r.error}`); 실패++; s.disconnect(); continue; }
  s.on('view', v => { s.뷰 = v; });
  s.뷰 = r.view; s.이름 = nm;
  폰.push(s);
}
await 잠시(300);
확인('9명 입장', 폰.length === 9, `${폰.length}명`);
if (폰.length < 9) { console.log('\n  서버를 새로 켜고 다시 돌려주세요.\n'); process.exit(1); }

await 보내(관리, 'admin', { action: '팀나누기_랜덤' });
await 잠시(400);
확인('3팀 3명씩', 화면뷰.teams.every(t => t.members.length === 3),
  화면뷰.teams.map(t => t.members.length).join('/'));

const 소켓of = (pid) => 폰.find(s => s.뷰?.me.id === pid);
const 팀원 = (tid) => 화면뷰.teams.find(t => t.id === tid).members.map(m => m.id);

// ── 보드 ────────────────────────────────────────────────────
console.log('\n[2] 게임 보드');
확인('보드에 게임이 보인다', (화면뷰.board || []).length >= 1,
  (화면뷰.board || []).map(b => b.name).join(', '));
const 텔 = (화면뷰.board || []).find(b => b.id === 'telepathy');
확인('텔레파시 블록 정보', !!텔 && 텔.type === 'team' && 텔.minutes === 10,
  텔 ? `${텔.name} · ${텔.type} · ${텔.minutes}분 · ${텔.playsCount}회` : '없음');

// ── 규칙 카드 → 시작 ────────────────────────────────────────
console.log('\n[3] 규칙 카드 → 시작');
await 보내(관리, 'admin', { action: '게임고르기', payload: { gameId: 'telepathy' } });
await 잠시(300);
확인('규칙 카드가 뜬다', 화면뷰.current?.phase === 'rules', 화면뷰.current?.rules?.[0]);
확인('규칙이 휴대폰에도 간다', 폰[0].뷰?.current?.phase === 'rules');

const 중복 = await 보내(관리, 'admin', { action: '게임고르기', payload: { gameId: 'telepathy' } });
확인('진행 중 다른 게임 못 고름', !중복.ok, 중복.error);

await 보내(관리, 'admin', { action: '게임시작' });
await 잠시(300);
확인('게임 시작', 화면뷰.current?.phase === 'playing');
확인('1라운드 제시어가 있다', !!화면뷰.current?.view?.prompt, 화면뷰.current?.view?.prompt);
확인('타이머 endsAt이 온다', typeof 화면뷰.current?.view?.endsAt === 'number');

const playId = 화면뷰.current.playId;

// ── 답 넣기 (팀마다 일치율을 다르게) ────────────────────────
console.log('\n[4] 5라운드 진행 — A팀 2/3(공백 무시), B팀 2/3, C팀 전부 다름');
const 답표 = {
  A: ['계란', '계 란', '스팸'],     // 공백만 다른 답은 같게 세어야 한다
  B: ['파', '파', '김치'],
  C: ['치즈', '떡', '만두']
};

async function 한라운드() {
  for (const t of ['A', 'B', 'C']) {
    팀원(t).forEach((pid, i) => {
      const s = 소켓of(pid);
      if (s) s.emit('input', { gameId: 'telepathy', playId, payload: { answer: 답표[t][i] } });
    });
  }
  await 잠시(400);
}

await 한라운드();
확인('입력 중 화면에 답 내용이 없다',
  !JSON.stringify(화면뷰.current.view).includes('계란'), '제출 인원만 보임');
확인('제출 현황이 보인다', 화면뷰.current.view.제출현황?.A?.낸사람 === 3,
  JSON.stringify(화면뷰.current.view.제출현황));
확인('내 답은 나에게만 온다', 소켓of(팀원('A')[0]).뷰.current.view.내답 === '계란');
확인('남의 답은 내 뷰에 없다',
  !JSON.stringify(소켓of(팀원('B')[0]).뷰.current.view).includes('계란'));

await 보내(관리, 'admin', { action: '게임조작', payload: { action: '공개' } });
await 잠시(350);
확인('공개 단계로 넘어감', 화면뷰.current.view.phase === 'reveal');
const r1 = 화면뷰.current.view.공개결과?.결과;
확인('A팀 2/3 일치 → 0.67 (공백 무시 확인)', r1?.A?.점수 === 0.67,
  `A=${r1?.A?.점수} B=${r1?.B?.점수} C=${r1?.C?.점수}`);
확인('B팀 2/3 → 0.67', r1?.B?.점수 === 0.67);
확인('C팀 전부 다름 → 0.33', r1?.C?.점수 === 0.33);
확인('공개 후에는 답이 보인다', JSON.stringify(r1).includes('계란'));

// 병합: A팀 '스팸'을 '계란'과 같은 것으로 묶는다
await 보내(관리, 'admin', { action: '게임조작', payload: { action: '답병합', payload: { from: '스팸', to: '계란' } } });
await 잠시(300);
확인('답 병합 → A팀 3/3 = 1.0', 화면뷰.current.view.공개결과.결과.A.점수 === 1,
  `A=${화면뷰.current.view.공개결과.결과.A.점수}`);
await 보내(관리, 'admin', { action: '게임조작', payload: { action: '병합취소', payload: { from: '스팸' } } });
await 잠시(300);
확인('병합 취소 → 0.67로 되돌아감', 화면뷰.current.view.공개결과.결과.A.점수 === 0.67);

// 나머지 4라운드
for (let i = 2; i <= 5; i++) {
  await 보내(관리, 'admin', { action: '게임조작', payload: { action: '다음' } });
  await 잠시(300);
  확인(`${i}라운드 시작`, 화면뷰.current.view.round === i && 화면뷰.current.view.phase === 'input');
  await 한라운드();
  await 보내(관리, 'admin', { action: '게임조작', payload: { action: '공개' } });
  await 잠시(300);
}
const 총점 = 화면뷰.current.view.팀총점;
확인('팀 총점 누적 (0.67×5 / 0.67×5 / 0.33×5)',
  총점.A === 3.35 && 총점.B === 3.35 && 총점.C === 1.65,
  `A=${총점.A} B=${총점.B} C=${총점.C}`);

// ── 끝내고 점수 반영 ────────────────────────────────────────
console.log('\n[5] 점수 반영');
await 보내(관리, 'admin', { action: '게임끝내기' });
await 잠시(500);
확인('게임이 보드로 돌아감', 화면뷰.current === null);
const 보드텔 = 화면뷰.board.find(b => b.id === 'telepathy');
확인('플레이 횟수 +1', 보드텔.playsCount === 시작횟수 + 1,
  `${시작횟수} → ${보드텔.playsCount}`);
확인('보드에 최근 결과', !!보드텔.lastResult, 보드텔.lastResult);

const sb = 화면뷰.scoreboard;
확인('점수판 기본 기준은 최고(best)', sb.mode === 'best');
const A점 = sb.팀.find(t => t.id === 'A')?.points;
const C점 = sb.팀.find(t => t.id === 'C')?.points;
확인('A팀이 C팀보다 높다', A점 > C점, `A=${A점} C=${C점}`);
확인('개인 점수가 9명 모두 있다', sb.개인.length === 9);
확인('개인 1위가 0점이 아니다', sb.개인[0].points > 0, `${sb.개인[0].name} ${sb.개인[0].points}점`);
확인('점수판에 PIN 해시·토큰 없음', !/pinHash|pinSalt|"token"/.test(JSON.stringify(sb)));

// ── 두 번째 판 (점수 기준 3종을 구별하려면 판이 둘 있어야 한다) ──
console.log('\n[6] 두 번째 판 — 이번엔 C팀이 1등하도록 뒤집는다');
답표.A = ['가지', '오이', '호박'];      // A팀 전부 다름 → 0.33
답표.C = ['치즈', '치즈', '치즈'];      // C팀 전부 같음 → 1.0

await 보내(관리, 'admin', { action: '게임고르기', payload: { gameId: 'telepathy' } });
await 보내(관리, 'admin', { action: '게임시작' });
await 잠시(400);
const playId2 = 화면뷰.current.playId;
확인('두 번째 playId는 다르다', playId2 !== playId, `${playId} → ${playId2}`);

async function 한라운드2() {
  for (const t of ['A', 'B', 'C']) {
    팀원(t).forEach((pid, i) => {
      const sk = 소켓of(pid);
      if (sk) sk.emit('input', { gameId: 'telepathy', playId: playId2, payload: { answer: 답표[t][i] } });
    });
  }
  await 잠시(400);
}
for (let i = 1; i <= 5; i++) {
  if (i > 1) { await 보내(관리, 'admin', { action: '게임조작', payload: { action: '다음' } }); await 잠시(300); }
  await 한라운드2();
  await 보내(관리, 'admin', { action: '게임조작', payload: { action: '공개' } });
  await 잠시(300);
}
const 총점2 = 화면뷰.current.view.팀총점;
확인('두 번째 판 C팀 만점', 총점2.C === 5, `A=${총점2.A} B=${총점2.B} C=${총점2.C}`);
await 보내(관리, 'admin', { action: '게임끝내기' });
await 잠시(500);
확인('플레이 횟수 +2', 화면뷰.board.find(b => b.id === 'telepathy').playsCount === 시작횟수 + 2,
  `${시작횟수} → ${화면뷰.board.find(b => b.id === 'telepathy').playsCount}`);

// ── 점수 기준 3종 ───────────────────────────────────────────
console.log('\n[7] 점수 기준 3종 — 판이 둘이라 값이 달라야 한다');
const 값 = {};
for (const mode of ['best', 'latest', 'total']) {
  await 보내(관리, 'admin', { action: '점수기준', payload: { mode } });
  await 잠시(300);
  const A = 화면뷰.scoreboard.팀.find(t => t.id === 'A')?.points;
  const C = 화면뷰.scoreboard.팀.find(t => t.id === 'C')?.points;
  값[mode] = { A, C };
  확인(`기준 '${mode}' 전환`, 화면뷰.scoreboard.mode === mode, `A=${A} C=${C}`);
}
확인('누적 > 최고 (두 판을 다 더하므로)', 값.total.A > 값.best.A,
  `누적 ${값.total.A} vs 최고 ${값.best.A}`);
확인('최고 > 최근 (A팀은 1판을 잘했다)', 값.best.A > 값.latest.A,
  `최고 ${값.best.A} vs 최근 ${값.latest.A}`);
확인('최근 기준에선 C팀이 A팀을 앞선다', 값.latest.C > 값.latest.A,
  `C ${값.latest.C} vs A ${값.latest.A}`);

const 없는기준 = await 보내(관리, 'admin', { action: '점수기준', payload: { mode: '엉터리' } });
확인('없는 기준 거부', !없는기준.ok, 없는기준.error);
await 보내(관리, 'admin', { action: '점수기준', payload: { mode: 'best' } });
await 잠시(250);

// ── 진행자 수동 조정 ────────────────────────────────────────
console.log('\n[8] 수동 가점과 되돌리기');
const 대상 = 화면뷰.scoreboard.개인[0];
const 전 = 화면뷰.scoreboard.개인.find(p => p.id === 대상.id).points;
await 보내(관리, 'admin', { action: '수동점수', payload: { playerId: 대상.id, points: 3, reason: '진행 도움' } });
await 잠시(300);
const 후 = 화면뷰.scoreboard.개인.find(p => p.id === 대상.id).points;
확인('수동 +3 반영', 후 === 전 + 3, `${전} → ${후}`);
await 보내(관리, 'admin', { action: '점수되돌리기' });
await 잠시(300);
확인('되돌리기', 화면뷰.scoreboard.개인.find(p => p.id === 대상.id).points === 전);

console.log('\n' + '-'.repeat(54));
console.log(`  통과 ${통과} / 실패 ${실패}`);
console.log('-'.repeat(54) + '\n');

for (const s of 폰) s.disconnect();
관리.disconnect(); 화면.disconnect();
process.exit(실패 > 0 ? 1 : 0);
