// 4단계 점검 ① — 「봇 11명으로 텔레파시 완주」 (SPEC 13장 4단계 완료 기준)
//
//   node tools/smoke-4단계-봇.mjs [진행자PIN]
//
// 진짜 tools/bots.js 를 띄워서 돌린다. 봇 흉내를 따로 내지 않는다.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIN = process.argv[2] || '0000';
const 잠시 = (ms) => new Promise(r => setTimeout(r, ms));
const 보내 = (s, ev, d) => new Promise(r => s.emit(ev, d, r));

let 통과 = 0, 실패 = 0;
function 확인(라벨, 조건, 덧 = '') {
  if (조건) { 통과++; console.log(`  OK  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
  else { 실패++; console.log(`  !!  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
}

// ── 준비 ────────────────────────────────────────────────────
console.log('\n[1] 자리 비우고 봇 11명 부르기');
const 관리 = io('http://localhost:3000', { forceNew: true });
await new Promise(r => 관리.on('connect', r));
const 로그인 = await 보내(관리, 'admin:login', { pin: PIN });
if (!로그인.ok) { console.log('  !!  진행자 PIN이 다릅니다.\n'); process.exit(1); }

if (로그인.view.current) await 보내(관리, 'admin', { action: '게임중단' });
for (const p of 로그인.view.players) {
  await 보내(관리, 'admin', { action: '내보내기', payload: { playerId: p.id } });
}
await 보내(관리, 'admin', { action: '팀편성_초기화' });
await 잠시(500);

const 화면 = io('http://localhost:3000', { forceNew: true });
await new Promise(r => 화면.on('connect', r));
let v = null;
화면.emit('screen:hello');
화면.on('screen', x => { v = x; });
await 잠시(400);

// 진짜 봇 스크립트를 띄운다
const 봇프로세스 = spawn(process.execPath, [path.join(루트, 'tools', 'bots.js'), '11'], {
  cwd: 루트, stdio: ['ignore', 'pipe', 'pipe']
});
let 봇출력 = '';
봇프로세스.stdout.on('data', d => { 봇출력 += d.toString(); });
봇프로세스.stderr.on('data', d => { 봇출력 += d.toString(); });

const 끝내기 = (코드) => { 봇프로세스.kill(); 관리.disconnect(); 화면.disconnect(); process.exit(코드); };

await 잠시(5000);
확인('봇 11명 입장', v.players.length === 11, `${v.players.length}명`);
확인('봇 이름이 봇1~봇11', v.players.every(p => /^봇\d+$/.test(p.name)));
if (v.players.length !== 11) { console.log('\n  봇이 다 못 들어왔습니다.\n' + 봇출력); 끝내기(1); }

// ── 팀 직접 선택 (봇이 스스로 고르는지) ─────────────────────
console.log('\n[2] 팀 — 봇이 스스로 고르고 이름·색까지 정하는지');
await 보내(관리, 'admin', { action: '팀나누기_직접' });
await 잠시(4500);
const 인원 = v.teams.map(t => t.members.length);
확인('11명이 스스로 팀을 골랐다', 인원.reduce((a, b) => a + b, 0) === 11, 인원.join('/'));
확인('인원이 균등하다 (4/4/3)', Math.max(...인원) - Math.min(...인원) <= 1, 인원.join('/'));

await 보내(관리, 'admin', { action: '팀고르기_마감' });
await 잠시(3500);
확인('봇 대표가 팀 이름을 정했다', v.teams.every(t => t.name), v.teams.map(t => t.name).join(' / '));
확인('봇 대표가 팀 색을 정했다', v.teams.every(t => t.colorId), v.teams.map(t => t.colorId).join(' '));
확인('세 팀 색이 서로 다르다', new Set(v.teams.map(t => t.colorId)).size === 3);

await 보내(관리, 'admin', { action: '팀편성_완료' });
await 잠시(400);

// ── 텔레파시 완주 ───────────────────────────────────────────
console.log('\n[3] 텔레파시 5라운드 — 봇이 알아서 답하는지');
await 보내(관리, 'admin', { action: '게임고르기', payload: { gameId: 'telepathy' } });
await 보내(관리, 'admin', { action: '게임시작' });
await 잠시(600);
확인('게임 시작', v.current?.phase === 'playing');

for (let i = 1; i <= 5; i++) {
  if (i > 1) { await 보내(관리, 'admin', { action: '게임조작', payload: { action: '다음' } }); await 잠시(500); }

  // 봇이 답을 낼 때까지 기다린다 (봇은 1.2~8초 사이에 낸다)
  let 낸사람 = 0;
  for (let t = 0; t < 26; t++) {
    await 잠시(500);
    낸사람 = Object.values(v.current?.view?.제출현황 || {}).reduce((a, c) => a + c.낸사람, 0);
    if (낸사람 >= 11) break;
  }
  확인(`${i}라운드 — 봇 11명 모두 답함`, 낸사람 === 11, `${낸사람}/11`);

  await 보내(관리, 'admin', { action: '게임조작', payload: { action: '공개' } });
  await 잠시(500);
  확인(`${i}라운드 공개`, v.current?.view?.phase === 'reveal',
    Object.entries(v.current?.view?.팀총점 || {}).map(([k, x]) => `${k}=${x}`).join(' '));
}

// ── 점수 반영 ───────────────────────────────────────────────
console.log('\n[4] 점수 반영');
await 보내(관리, 'admin', { action: '게임끝내기' });
await 잠시(800);
확인('보드로 돌아감', v.current === null);
const 텔 = v.board.find(b => b.id === 'telepathy');
확인('플레이 횟수 기록', (텔?.playsCount ?? 0) > 0, 텔?.lastResult ?? '');
확인('11명 모두 점수가 생겼다', v.scoreboard.개인.every(p => p.points > 0),
  `1위 ${v.scoreboard.개인[0].name} ${v.scoreboard.개인[0].points}점`);
확인('팀 점수 3개', v.scoreboard.팀.length === 3,
  v.scoreboard.팀.map(t => `${t.name} ${t.points}`).join(' / '));

console.log('\n' + '-'.repeat(54));
console.log(`  통과 ${통과} / 실패 ${실패}`);
console.log('-'.repeat(54) + '\n');
끝내기(실패 > 0 ? 1 : 0);
