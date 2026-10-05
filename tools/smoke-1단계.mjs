// 1단계 자동 점검 — 서버를 켜둔 채 `node tools/smoke-1단계.mjs <입장코드>` 로 실행한다.
// (2단계 점검은 입장코드를 서버에서 직접 받아오므로 인자가 필요 없다.)
import { io } from 'socket.io-client';
const URL = 'http://localhost:3000';
const CODE = process.argv[2];
const 잠시 = (ms) => new Promise(r => setTimeout(r, ms));
let 화면뷰 = null;

const 화면 = io(URL);
await new Promise(r => 화면.on('connect', r));
화면.emit('screen:hello');
화면.on('screen', v => { 화면뷰 = v; });
await 잠시(300);
console.log('① TV 연결 →', '입장코드', 화면뷰.joinCode, '/ QR', 화면뷰.qr ? 'O' : 'X', '/ 주소', 화면뷰.url);

function 폰() { return io(URL, { forceNew: true }); }
async function 입장(s, 값) {
  return new Promise(r => s.emit('join', 값, r));
}

// ② 정상 입장 2명
const a = 폰(); await new Promise(r => a.on('connect', r));
const ra = await 입장(a, { code: CODE, name: '채림', pin: '1234' });
const b = 폰(); await new Promise(r => b.on('connect', r));
const rb = await 입장(b, { code: CODE, name: '햄꾼', pin: '5678' });
await 잠시(300);
console.log('② 2명 입장 →', ra.ok && rb.ok ? 'OK' : 'FAIL', '| TV 대기실:', 화면뷰.players.map(p=>p.name+(p.connected?'●':'○')).join(' '));

// ③ 거부 케이스
const c = 폰(); await new Promise(r => c.on('connect', r));
console.log('③ 틀린 입장코드 →', (await 입장(c, { code:'0001', name:'테스트', pin:'1111' })).error);
console.log('   이름 중복    →', (await 입장(c, { code:CODE, name:'채림', pin:'1111' })).error);
console.log('   이름 7자     →', (await 입장(c, { code:CODE, name:'일이삼사오육칠', pin:'1111' })).error);
console.log('   PIN 3자리    →', (await 입장(c, { code:CODE, name:'테스트', pin:'111' })).error);
await 잠시(200);
console.log('   → 거부 후 대기실 인원:', 화면뷰.players.length, '(2명이어야 정상)');

// ④ 비밀정보 누출 검사: TV로 간 데이터에 pinHash·남의 token이 없어야 한다
const 직렬 = JSON.stringify(화면뷰);
console.log('④ TV 데이터에 pinHash/pinSalt/token 포함?',
  /pinHash|pinSalt|"token"/.test(직렬) ? '🔴 누출!' : '없음 ✅');

// ⑤ 끊김 → 재접속(토큰) 복귀
a.disconnect(); await 잠시(400);
console.log('⑤ 채림 끊김 → TV:', 화면뷰.players.map(p=>p.name+(p.connected?'●':'○')).join(' '));
const a2 = 폰(); await new Promise(r => a2.on('connect', r));
// 2단계에서 입장·재접속 응답이 { ok, view } 로 바뀌었다(예전에는 me 가 최상위에 있었다).
const 복귀 = await new Promise(r => a2.emit('resume', { token: ra.view.me.token }, r));
await 잠시(300);
console.log('   토큰 재접속 →', 복귀.ok ? `${복귀.view.me.name} 복귀` : '실패', '| TV:', 화면뷰.players.map(p=>p.name+(p.connected?'●':'○')).join(' '), '| 인원', 화면뷰.players.length);

a2.disconnect(); b.disconnect(); c.disconnect(); 화면.disconnect();
process.exit(0);
