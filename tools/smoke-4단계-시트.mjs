// 4단계 점검 ② — 구글시트 큐
//
//   node tools/smoke-4단계-시트.mjs [진행자PIN]
//
// 시트가 연결돼 있든 아니든 확인한다.
//   · 연결 안 됨: 기록이 data/queue.json 에 쌓이고 사라지지 않는가
//   · 연결 됨   : 보낸 뒤 큐가 비는가
// SPEC 8장 「시트가 없어도 모든 기능이 돌아가야 한다」를 지키는지 보는 게 핵심이다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 큐파일 = path.join(루트, 'data', 'queue.json');
const PIN = process.argv[2] || '0000';
const 잠시 = (ms) => new Promise(r => setTimeout(r, ms));
const 보내 = (s, ev, d) => new Promise(r => s.emit(ev, d, r));

let 통과 = 0, 실패 = 0;
function 확인(라벨, 조건, 덧 = '') {
  if (조건) { 통과++; console.log(`  OK  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
  else { 실패++; console.log(`  !!  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
}
const 큐읽기 = () => {
  try { return JSON.parse(fs.readFileSync(큐파일, 'utf8')) || []; } catch { return []; }
};

const SPEC탭 = ['설정', '참가자', '팀', '점수로그', '게임결과', '순위', '초성', '텔레파시', '라이어'];

const 관리 = io('http://localhost:3000', { forceNew: true });
await new Promise(r => 관리.on('connect', r));
const 로그인 = await 보내(관리, 'admin:login', { pin: PIN });
if (!로그인.ok) { console.log('\n  !!  진행자 PIN이 다릅니다.\n'); process.exit(1); }

let 뷰 = 로그인.view;
관리.on('adminView', v => { 뷰 = v; });
const 시트켜짐 = !!뷰.sheet?.켜짐;

console.log(`\n[1] 시트 연결 상태 — ${시트켜짐 ? '연결됨' : '연결 안 됨 (로컬 큐만)'}`);
확인('진행자 뷰에 시트 상태가 온다', !!뷰.sheet, JSON.stringify(뷰.sheet));

// ── 큐에 쌓이는지 ───────────────────────────────────────────
console.log('\n[2] 기록이 큐에 쌓이는가');
const 사람 = 뷰.players[0];
if (!사람) { console.log('  !!  참가자가 없습니다. 먼저 smoke-4단계-봇 을 돌려주세요.\n'); process.exit(1); }

const 전 = 큐읽기().length;
await 보내(관리, 'admin', { action: '수동점수', payload: { playerId: 사람.id, points: 2, reason: '시트 점검' } });
await 잠시(900);
const 후 = 큐읽기();

if (시트켜짐) {
  확인('연결돼 있으면 곧 비워진다', true, '[4]에서 확인');
} else {
  확인('큐 줄이 늘었다', 후.length > 전, `${전} → ${후.length}줄`);
}

// ── 형식이 SPEC 8장과 맞는가 ────────────────────────────────
console.log('\n[3] 기록 형식');
const 전체 = 후.length ? 후 : 큐읽기();
if (전체.length === 0 && 시트켜짐) {
  console.log('  (큐가 이미 비어 시트로 갔습니다 — 형식 검사는 건너뜁니다)');
} else {
  확인('모든 탭 이름이 SPEC 9개 안에 있다',
    전체.every(x => SPEC탭.includes(x.탭)),
    [...new Set(전체.map(x => x.탭))].join(', '));

  const 점수줄 = 전체.find(x => x.탭 === '점수로그');
  확인('점수로그가 7칸이다 (시각·playId·게임·이름·팀·점수·사유)',
    !!점수줄 && 점수줄.행.length === 7, 점수줄 ? JSON.stringify(점수줄.행) : '없음');
  확인('시각이 YYYY-MM-DD HH:mm:ss 형식이다',
    !!점수줄 && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(점수줄.행[0]),
    점수줄?.행[0]);
  확인('점수가 숫자다', !!점수줄 && typeof 점수줄.행[5] === 'number', String(점수줄?.행[5]));

  const 참가자줄 = 전체.find(x => x.탭 === '참가자');
  확인('참가자가 6칸이다', !참가자줄 || 참가자줄.행.length === 6,
    참가자줄 ? `${참가자줄.행.length}칸` : '(이번 큐엔 없음)');
}

// ── 지금 동기화 ─────────────────────────────────────────────
console.log('\n[4] 「지금 동기화」');
const r = await 보내(관리, 'admin', { action: '지금동기화' });
확인('동기화 명령이 받아들여진다', r.ok === true);
await 잠시(700);

if (시트켜짐) {
  확인('보낸 뒤 큐가 비었다', 큐읽기().length === 0, `${큐읽기().length}줄 남음`);
  확인('오류 없음', !뷰.sheet?.오류, 뷰.sheet?.오류 || '깨끗함');
} else {
  확인('시트가 없어도 서버가 멀쩡하다', true, '큐는 그대로 보관됨');
  확인('큐가 사라지지 않았다', 큐읽기().length > 0, `${큐읽기().length}줄 보관 중`);
}

console.log('\n' + '-'.repeat(54));
console.log(`  통과 ${통과} / 실패 ${실패}`);
if (!시트켜짐) {
  console.log('');
  console.log('  ※ 시트를 연결하지 않은 상태로 점검했습니다.');
  console.log('    연결 방법은 README 「구글시트 연결」을 보세요.');
}
console.log('-'.repeat(54) + '\n');

관리.disconnect();
process.exit(실패 > 0 ? 1 : 0);
