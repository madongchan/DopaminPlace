// 3단계 완료 기준 확인 — 「서버 재시작 후 점수가 유지된다」
//
// 쓰는 법:
//   1) node tools/smoke-3단계.mjs         (게임을 돌려 점수를 만든다)
//   2) 서버를 끄고 다시 켠다
//   3) node tools/smoke-3단계-재시작.mjs   (이 파일)
//
// 아무것도 바꾸지 않고 읽기만 한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 잠시 = (ms) => new Promise(r => setTimeout(r, ms));

let 통과 = 0, 실패 = 0;
function 확인(라벨, 조건, 덧 = '') {
  if (조건) { 통과++; console.log(`  OK  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
  else { 실패++; console.log(`  !!  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
}

console.log('\n[재시작 후] 저장된 상태 확인');

// ── 파일에 남은 것 ──────────────────────────────────────────
const 상태파일 = path.join(루트, 'data', 'state.json');
if (!fs.existsSync(상태파일)) {
  console.log('  !!  data/state.json 이 없습니다. 먼저 smoke-3단계를 돌려주세요.\n');
  process.exit(1);
}
const st = JSON.parse(fs.readFileSync(상태파일, 'utf8'));

확인('참가자가 남아 있다', Object.keys(st.players).length > 0,
  `${Object.keys(st.players).length}명`);
확인('팀 편성이 남아 있다', Object.values(st.players).some(p => p.teamId));
확인('점수로그가 남아 있다', (st.scoreLog || []).length > 0, `${(st.scoreLog || []).length}줄`);

const games = st.board?.games;
확인('board.games가 객체다 (배열이면 저장 때 속성이 사라진다)',
  !!games && !Array.isArray(games) && typeof games === 'object',
  Array.isArray(games) ? '배열 — 버그' : '객체');
확인('플레이 횟수가 남아 있다', (games?.telepathy?.playsCount ?? 0) > 0,
  `텔레파시 ${games?.telepathy?.playsCount ?? 0}회`);
확인('보드 최근 결과가 남아 있다', !!games?.telepathy?.lastResult,
  games?.telepathy?.lastResult ?? '없음');
확인('점수 기준이 남아 있다', !!st.settings?.scoreMode, st.settings?.scoreMode);

// ── 서버가 실제로 그 값을 내보내는지 ────────────────────────
const 화면 = io('http://localhost:3000', { forceNew: true });
await new Promise(r => 화면.on('connect', r));
let 뷰 = null;
화면.emit('screen:hello');
화면.on('screen', v => { 뷰 = v; });
await 잠시(600);

확인('서버가 점수판을 내보낸다', (뷰?.scoreboard?.개인 ?? []).length > 0,
  `${뷰?.scoreboard?.개인?.length ?? 0}명`);
확인('점수가 0이 아니다', (뷰?.scoreboard?.개인?.[0]?.points ?? 0) > 0,
  뷰?.scoreboard?.개인?.[0]
    ? `1위 ${뷰.scoreboard.개인[0].name} ${뷰.scoreboard.개인[0].points}점`
    : '');

const 보드텔 = (뷰?.board ?? []).find(b => b.id === 'telepathy');
확인('보드에 플레이 횟수가 보인다', (보드텔?.playsCount ?? 0) > 0,
  `${보드텔?.playsCount ?? 0}회 · ${보드텔?.lastResult ?? ''}`);

// 파일 값과 서버 값이 이어지는지
const 서버1위 = 뷰?.scoreboard?.개인?.[0];
const 파일에있나 = 서버1위 ? !!st.players[서버1위.id] : false;
확인('점수판 1위가 저장 파일에도 있다', 파일에있나, 서버1위?.name ?? '');

console.log('\n' + '-'.repeat(54));
console.log(`  통과 ${통과} / 실패 ${실패}`);
console.log('-'.repeat(54) + '\n');

화면.disconnect();
process.exit(실패 > 0 ? 1 : 0);
