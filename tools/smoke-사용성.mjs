// 사용성 자동 점검 — 서버를 켜둔 채 `node tools/smoke-사용성.mjs [진행자PIN]` 으로 실행한다.
// ① 원클릭 팀 편성(랜덤 + 이름·색 기본값 + 완료)  ② 연습 판(점수·플레이 횟수가 안 남는지)을 확인한다.
// ⚠ 시작할 때 기존 참가자를 지운다. 실제 행사 중에는 돌리지 않는다.
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
console.log('\n[1] 준비 — 진행자 로그인, 참가자 9명');
const 화면 = await 붙기(새소켓());
let 화면뷰 = null;
화면.emit('screen:hello');
화면.on('screen', v => { 화면뷰 = v; });

const 관리 = await 붙기(새소켓());
let 관리뷰 = null;
관리.on('adminView', v => { 관리뷰 = v; });
const 로그인 = await 보내(관리, 'admin:login', { pin: PIN });
if (!로그인.ok) { console.log('  !!  진행자 PIN이 다릅니다.'); process.exit(1); }
const CODE = 로그인.view.joinCode;
const 조작 = (action, payload) => 보내(관리, 'admin', { action, payload });

if (로그인.view.current) await 조작('게임중단');
for (const p of 로그인.view.players) await 조작('내보내기', { playerId: p.id });
await 조작('팀편성_초기화');
await 잠시(400);

const 폰 = [];
for (let i = 0; i < 9; i++) {
  const s = await 붙기(새소켓());
  const r = await 보내(s, 'join', { code: CODE, name: `쓰${i + 1}`, pin: String(3000 + i) });
  if (!r.ok) { console.log(`  !!  쓰${i + 1} 입장 실패: ${r.error}`); 실패++; s.disconnect(); continue; }
  s.on('view', v => { s.뷰 = v; });
  s.뷰 = r.view;
  폰.push(s);
}
await 잠시(300);
확인('9명 입장', 폰.length === 9, `${폰.length}명`);
if (폰.length < 9) { console.log('\n  서버를 새로 켜고 다시 돌려주세요.\n'); process.exit(1); }
확인('편성 전 단계는 none', 관리뷰.teamPhase === 'none', 관리뷰.teamPhase);

// ── 원클릭 팀 편성 ──────────────────────────────────────────
console.log('\n[2] 원클릭 팀 편성');
const 원 = await 조작('팀나누기_원클릭');
await 잠시(400);
확인('원클릭 편성 성공', 원.ok, 원.error);
확인('한 번에 편성 완료(done)', 관리뷰.teamPhase === 'done', 관리뷰.teamPhase);
확인('3팀 3명씩', 관리뷰.teams.every(t => t.members.length === 3),
  관리뷰.teams.map(t => t.members.length).join('/'));
확인('모든 팀에 이름·색이 있다', 관리뷰.teams.every(t => t.name && t.colorId && t.color),
  관리뷰.teams.map(t => `${t.name}(${t.colorId})`).join(', '));
확인('팀 이름이 서로 다르다', new Set(관리뷰.teams.map(t => t.name)).size === 3);
확인('팀 색이 서로 다르다', new Set(관리뷰.teams.map(t => t.colorId)).size === 3);
확인('모든 팀에 대표가 있다', 관리뷰.teams.every(t => t.members.some(m => m.id === t.leaderId)));
확인('휴대폰에 내 팀 이름·색이 간다', 폰.every(s => s.뷰?.내팀?.name && s.뷰?.내팀?.color),
  폰[0].뷰?.내팀?.name);
확인('TV는 팀 소개를 띄운다', 화면뷰.bigScreen === 'teams', 화면뷰.bigScreen);

// 대표가 나중에 이름·색을 바꾸는 기존 경로가 살아 있는가
const A = 관리뷰.teams.find(t => t.id === 'A');
const 대표폰 = 폰.find(s => s.뷰.me.id === A.leaderId);
const 안쓰는색 = 관리뷰.palette.find(c => !c.taken).id;
const 바꿈 = await 보내(대표폰, 'team:set', { name: '호떡', colorId: 안쓰는색 });
await 잠시(300);
확인('편성 뒤에도 대표가 이름·색을 바꿀 수 있다',
  바꿈.ok && 관리뷰.teams.find(t => t.id === 'A').name === '호떡', 바꿈.error);

// 다시 섞어도 정해 둔 이름·색은 남는다
await 조작('팀나누기_원클릭');
await 잠시(400);
const A2 = 관리뷰.teams.find(t => t.id === 'A');
확인('다시 섞어도 정한 이름·색은 그대로', A2.name === '호떡' && A2.colorId === 안쓰는색, `${A2.name}(${A2.colorId})`);
확인('다시 섞어도 3명씩', 관리뷰.teams.every(t => t.members.length === 3));

// ── 연습 판 ─────────────────────────────────────────────────
console.log('\n[3] 연습 판 — 점수·플레이 횟수가 남지 않는다');
const 보드of = () => 관리뷰.board.find(b => b.id === 'telepathy');
const 전횟수 = 보드of().playsCount;
const 전결과 = 보드of().lastResult;
const 전점수판 = JSON.stringify(관리뷰.scoreboard);

await 조작('게임고르기', { gameId: 'telepathy' });
await 잠시(300);
확인('규칙 카드가 뜬다', 화면뷰.current?.phase === 'rules');
확인('게임을 고르면 TV가 팀 소개에서 풀린다', 화면뷰.bigScreen === 'auto', 화면뷰.bigScreen);

const 시작 = await 조작('게임시작', { 옵션: { 연습: true } });
await 잠시(300);
확인('연습으로 시작', 시작.ok && 화면뷰.current?.phase === 'playing', 시작.error);
확인('TV 뷰에 연습 표시', 화면뷰.current?.연습 === true);
확인('휴대폰 뷰에 연습 표시', 폰.every(s => s.뷰?.current?.연습 === true));
확인('진행자 뷰에 연습 표시', 관리뷰.current?.연습 === true);

// 전원이 같은 답을 내서 점수가 날 상황을 만든다
const playId = 화면뷰.current.playId;
for (const s of 폰) s.emit('input', { gameId: 'telepathy', playId, payload: { answer: '계란' } });
await 잠시(400);
await 조작('게임조작', { action: '공개' });
await 잠시(300);

// 일부러 '점수 주는' 경로로 끝낸다 — 그래도 남으면 안 된다
const 끝 = await 조작('게임끝내기');
await 잠시(400);
확인('연습을 끝내면 보드로 돌아온다', 끝.ok && 화면뷰.current === null && 관리뷰.current === null, 끝.error);
확인('플레이 횟수가 그대로', 보드of().playsCount === 전횟수, `${전횟수} → ${보드of().playsCount}`);
확인('최근 결과가 그대로', 보드of().lastResult === 전결과, String(보드of().lastResult));
확인('점수판이 그대로', JSON.stringify(관리뷰.scoreboard) === 전점수판);
확인('휴대폰 점수판도 그대로', JSON.stringify(폰[0].뷰.scoreboard) === 전점수판);

// 연습 뒤의 진짜 판은 연습이 아니어야 한다
await 조작('게임고르기', { gameId: 'telepathy' });
await 조작('게임시작');
await 잠시(300);
확인('다음 판은 연습이 아니다', 화면뷰.current?.phase === 'playing' && 화면뷰.current?.연습 === false);
await 조작('게임중단');

// ── 정리 ────────────────────────────────────────────────────
for (const p of 관리뷰.players) await 조작('내보내기', { playerId: p.id });
await 조작('팀편성_초기화');
await 잠시(300);
for (const s of [...폰, 화면, 관리]) s.disconnect();

console.log(`\n결과: 통과 ${통과} · 실패 ${실패}\n`);
process.exit(실패 ? 1 : 0);
