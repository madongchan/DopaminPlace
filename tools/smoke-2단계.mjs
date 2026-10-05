// 2단계 자동 점검 — 서버를 켜둔 채 `node tools/smoke-2단계.mjs <입장코드> [진행자PIN]` 으로 실행한다.
// 참가자 11명을 흉내 내서 재접속·팀 편성·권한·비밀정보 누출을 확인한다.
import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';
// 입장코드는 진행자로 로그인해서 서버에게 직접 물어본다(손으로 넘기면 틀리기 쉽다).
const PIN = process.argv[2] || '0000';
let CODE = null;

const 잠시 = (ms) => new Promise(r => setTimeout(r, ms));
const 이름들 = ['채림', '햄꾼', '지우', '서준', '민서', '하윤', '도윤', '수아', '예준', '시윤', '나은'];
let 통과 = 0, 실패 = 0;
function 확인(라벨, 조건, 덧붙임 = '') {
  if (조건) { 통과++; console.log(`  OK  ${라벨}${덧붙임 ? ' — ' + 덧붙임 : ''}`); }
  else      { 실패++; console.log(`  !!  ${라벨}${덧붙임 ? ' — ' + 덧붙임 : ''}`); }
}
const 새소켓 = () => io(URL, { forceNew: true });
const 붙기 = async (s) => { await new Promise(r => s.on('connect', r)); return s; };
const 보내고받기 = (s, ev, d) => new Promise(r => s.emit(ev, d, r));

// ── 큰 화면 ─────────────────────────────────────────────────
let 화면뷰 = null;
const 화면 = await 붙기(새소켓());
화면.emit('screen:hello');
화면.on('screen', v => { 화면뷰 = v; });
await 잠시(300);

// ── 진행자 ──────────────────────────────────────────────────
console.log('\n[1] 진행자 로그인');
const 관리 = await 붙기(새소켓());
let 관리뷰 = null;
관리.on('adminView', v => { 관리뷰 = v; });
const 틀린PIN = await 보내고받기(관리, 'admin:login', { pin: '9999' });
확인('틀린 PIN 거부', !틀린PIN.ok, 틀린PIN.error);
const 맞는PIN = await 보내고받기(관리, 'admin:login', { pin: PIN });
확인('맞는 PIN 통과', 맞는PIN.ok === true);
if (!맞는PIN.ok) { console.log('\n진행자 PIN이 달라 멈춥니다. .env의 ADMIN_PIN을 확인하세요.'); process.exit(1); }
관리뷰 = 맞는PIN.view;
CODE = 관리뷰.joinCode;
console.log(`      입장코드 ${CODE} (서버에서 받아옴)`);

// 로그인 안 한 소켓이 진행자 조작을 시도하면 막혀야 한다
const 사칭 = await 붙기(새소켓());
const 사칭결과 = await 보내고받기(사칭, 'admin', { action: '팀나누기_랜덤' });
확인('로그인 안 한 사람의 진행자 조작 차단', !사칭결과.ok, 사칭결과.error);
사칭.disconnect();

// ── 앞선 점검이 남긴 참가자를 치운다 (여러 번 돌려도 되게) ──
{
  const 남은사람 = 관리뷰.players || [];
  if (남은사람.length) {
    console.log('');
    console.log(`[0] 앞선 점검이 남긴 참가자 ${남은사람.length}명을 치웁니다`);
    for (const p of 남은사람) {
      await 보내고받기(관리, 'admin', { action: '내보내기', payload: { playerId: p.id } });
    }
    await 보내고받기(관리, 'admin', { action: '팀편성_초기화' });
    await 잠시(500);
  }
}

// ── 참가자 11명 입장 ────────────────────────────────────────
console.log('\n[2] 참가자 11명 입장');
const 폰 = [];
for (const [i, nm] of 이름들.entries()) {
  const s = await 붙기(새소켓());
  const r = await 보내고받기(s, 'join', { code: CODE, name: nm, pin: String(1000 + i) });
  if (!r.ok) { console.log(`  !!  ${nm} 입장 실패: ${r.error}`); 실패++; s.disconnect(); continue; }
  s.on('view', v => { s.뷰 = v; });
  s.뷰 = r.view; s.이름 = nm; s.핀 = String(1000 + i);
  폰.push(s);
}
await 잠시(400);
확인('11명 모두 입장', 폰.length === 11, `${폰.length}명`);
if (폰.length < 11) {
  console.log('');
  console.log('  입장이 막혔습니다. 서버를 새로 켜고 다시 돌려주세요.');
  console.log(`  통과 ${통과} / 실패 ${실패}`);
  process.exit(1);
}
확인('TV 대기실에 11명', 화면뷰.players.length === 11);

// ── 재접속 ──────────────────────────────────────────────────
console.log('\n[3] 재접속');
const 첫사람 = 폰[0];
const 토큰 = 첫사람.뷰.me.token;
첫사람.disconnect();
await 잠시(400);
확인('끊기면 TV에 끊김 표시', 화면뷰.players.find(p => p.name === '채림')?.connected === false);

const 다시1 = await 붙기(새소켓());
const r1 = await 보내고받기(다시1, 'resume', { token: 토큰 });
확인('(1) 토큰으로 복귀', r1.ok && r1.view.me.name === '채림');
다시1.disconnect();
await 잠시(200);

const 다시2 = await 붙기(새소켓());
const r2 = await 보내고받기(다시2, 'resume', { name: '채림', pin: '1000' });
확인('(2) 이름+PIN으로 복귀', r2.ok && r2.view.me.name === '채림', '다른 브라우저·카톡 인앱 대비');

const r3 = await 보내고받기(다시2, 'resume', { name: '채림', pin: '9999' });
확인('틀린 PIN 거부', !r3.ok, r3.error);
const r4 = await 보내고받기(다시2, 'resume', { name: '없는사람', pin: '1000' });
확인('없는 이름 거부', !r4.ok, r4.error);

await 잠시(300);
확인('복귀 후에도 인원 그대로(중복 없음)', 화면뷰.players.length === 11, `${화면뷰.players.length}명`);
폰[0] = 다시2;
폰[0].on('view', v => { 폰[0].뷰 = v; });
폰[0].뷰 = r2.view;

// ── 팀 나누기: 랜덤 ─────────────────────────────────────────
console.log('\n[4] 팀 나누기 — 랜덤 자동');
await 보내고받기(관리, 'admin', { action: '팀나누기_랜덤' });
await 잠시(400);
const 인원 = 화면뷰.teams.map(t => t.members.length);
확인('11명이 4/4/3으로 갈림', JSON.stringify([...인원].sort((a, b) => b - a)) === '[4,4,3]', 인원.join('/'));
확인('모두 팀이 있음', 화면뷰.players.every(p => p.teamId));
확인('팀마다 대표 1명', 화면뷰.teams.every(t => t.leaderId && t.members.some(m => m.id === t.leaderId)));

// ── 팀 이름·색 ──────────────────────────────────────────────
console.log('\n[5] 팀 이름·색 정하기');
const 대표소켓 = (teamId) => 폰.find(s => s.뷰?.me.id === 화면뷰.teams.find(t => t.id === teamId)?.leaderId);

const 대표A = 대표소켓('A');
확인('대표에게 대표 표시가 감', 대표A?.뷰?.대표인가 === true);
if (!대표A || !대표소켓('B') || !대표소켓('C')) {
  console.log('  !!  대표 소켓을 못 찾아 [5]를 건너뜁니다. 서버를 새로 켜고 다시 돌려보세요.');
  console.log('      (팀 대표:', 화면뷰.teams.map(t => `${t.id}=${t.leaderId?.slice(0,8) || '없음'}`).join(' '), ')');
  console.log('');
  console.log(`  통과 ${통과} / 실패 ${실패 + 1}`);
  process.exit(1);
}

const 일반 = 폰.find(s => s.뷰 && !s.뷰.대표인가);
const 사칭팀 = await 보내고받기(일반, 'team:set', { name: '몰래', colorId: 'blue' });
확인('대표 아닌 사람의 팀 설정 차단', !사칭팀.ok, 사칭팀.error);

await 보내고받기(대표A, 'team:set', { name: '초코파이', colorId: 'pink' });
await 잠시(250);
const 대표B = 대표소켓('B');
const 색중복 = await 보내고받기(대표B, 'team:set', { colorId: 'pink' });
확인('다른 팀이 고른 색 차단', !색중복.ok, 색중복.error);
await 보내고받기(대표B, 'team:set', { name: '마라탕', colorId: 'mint' });
await 잠시(250);
const 대표C = 대표소켓('C');
const 이름중복 = await 보내고받기(대표C, 'team:set', { name: '초코파이' });
확인('다른 팀이 쓰는 이름 차단', !이름중복.ok, 이름중복.error);
const 긴이름 = await 보내고받기(대표C, 'team:set', { name: '아홉글자가넘는팀이름' });
확인('9자 이상 팀 이름 차단', !긴이름.ok, 긴이름.error);
await 보내고받기(대표C, 'team:set', { name: '붕어빵', colorId: 'yellow' });
await 잠시(300);

확인('TV에 팀 이름 3개 표시', 화면뷰.teams.every(t => t.name), 화면뷰.teams.map(t => t.name).join(' / '));
확인('TV에 팀 색 3개 표시', 화면뷰.teams.every(t => t.color), 화면뷰.teams.map(t => t.color).join(' '));

// ── 비밀정보 누출 ───────────────────────────────────────────
console.log('\n[6] 비밀정보 누출 검사');
확인('TV 데이터에 PIN 해시·토큰 없음', !/pinHash|pinSalt|"token"/.test(JSON.stringify(화면뷰)));
확인('진행자 데이터에 PIN 해시 없음', !/pinHash|pinSalt/.test(JSON.stringify(관리뷰)));
const 남의토큰 = 폰[1].뷰.me.token;
확인('내 뷰에 남의 토큰 없음', !JSON.stringify(폰[0].뷰).includes(남의토큰));

// ── 팀 직접 선택 ────────────────────────────────────────────
console.log('\n[7] 팀 나누기 — 직접 선택');
await 보내고받기(관리, 'admin', { action: '팀나누기_직접' });
await 잠시(400);
확인('모두 팀이 풀림', 화면뷰.players.every(p => !p.teamId));
확인('휴대폰이 팀 고르기 화면으로', 폰[0].뷰?.teamPhase === 'picking');

const p1 = await 보내고받기(폰[0], 'team:pick', { teamId: 'A' });
확인('첫 사람 A팀 선택', p1.ok);
const p2 = await 보내고받기(폰[1], 'team:pick', { teamId: 'A' });
확인('A팀 2명째는 막힘(인원 차 1명 제한)', !p2.ok, p2.error);
await 보내고받기(폰[1], 'team:pick', { teamId: 'B' });
await 보내고받기(폰[2], 'team:pick', { teamId: 'C' });
const p4 = await 보내고받기(폰[3], 'team:pick', { teamId: 'A' });
확인('한 바퀴 돈 뒤 A팀 2명째 허용', p4.ok);
await 잠시(300);
확인('고르는 중에도 인원 균등 유지',
  Math.max(...화면뷰.teams.map(t => t.members.length)) - Math.min(...화면뷰.teams.map(t => t.members.length)) <= 1,
  화면뷰.teams.map(t => t.members.length).join('/'));

// ── 진행자 수동 조작 ────────────────────────────────────────
console.log('\n[8] 진행자 수동 조작');
const 옮길사람 = 화면뷰.teams.find(t => t.id === 'A').members[0];
await 보내고받기(관리, 'admin', { action: '팀이동', payload: { playerId: 옮길사람.id, teamId: 'C' } });
await 잠시(250);
확인('진행자는 인원 제한 없이 이동 가능',
  화면뷰.teams.find(t => t.id === 'C').members.some(m => m.id === 옮길사람.id));

const 이름바꾸기 = await 보내고받기(관리, 'admin', { action: '이름변경', payload: { playerId: 옮길사람.id, name: '새이름' } });
확인('이름 변경', 이름바꾸기.ok);
const 이름겹침 = await 보내고받기(관리, 'admin', { action: '이름변경', payload: { playerId: 폰[1].뷰.me.id, name: '새이름' } });
확인('겹치는 이름으로 변경 차단', !이름겹침.ok, 이름겹침.error);

const 옛코드 = 화면뷰.joinCode;
await 보내고받기(관리, 'admin', { action: '입장코드재발급' });
await 잠시(250);
확인('입장코드 재발급', 화면뷰.joinCode !== 옛코드, `${옛코드} -> ${화면뷰.joinCode}`);

// ── 마무리 ──────────────────────────────────────────────────
console.log('\n' + '-'.repeat(52));
console.log(`  통과 ${통과} / 실패 ${실패}`);
console.log('-'.repeat(52) + '\n');

for (const s of 폰) s.disconnect();
관리.disconnect(); 화면.disconnect();
process.exit(실패 > 0 ? 1 : 0);
