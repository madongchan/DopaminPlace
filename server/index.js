// 도파민플레이션 서버 — Express + Socket.IO
// 1단계: 입장코드·QR, 휴대폰 입장, 큰 화면 대기실
import 'dotenv/config';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketServer } from 'socket.io';

import {
  state, 입장코드생성, 참가자추가, 이름중복, 토큰으로찾기,
  접속상태변경, 참가자공개목록, 내정보, 복원, 저장, 참가자삭제,
  팀초기화, 팀요약, 랜덤팀배정, 팀직접선택, 팀강제이동, 팀해산,
  팀설정, 이름PIN으로찾기, 이름변경, 토큰재발급, 색hex, 팀기본값채우기
} from './state.js';
import { 접속주소, LAN주소찾기, QR만들기, 터널주소설정, IP감시시작, 감시주소맞추기 } from './network.js';
import { 게임목록, 게임찾기, 보드정보 } from './games/index.js';
import { 플레이ID생성, 여러점수기록, 수동점수, 마지막되돌리기, 점수판 } from './scoring.js';
import { 문제불러오기 } from './content.js';
import {
  시트준비, 시트켜짐, 시트상태, 지금동기화, 점수줄추가,
  게임결과추가, 참가자추가기록, 팀줄추가, 시트설정
} from './sheets.js';

const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server);

// ── 정적 파일 ───────────────────────────────────────────────
app.use(express.static(path.join(루트, 'public')));
// socket.io 클라이언트를 서버가 직접 제공한다(외부 CDN 금지).
app.use('/vendor/socket.io.js', express.static(
  path.join(루트, 'node_modules', 'socket.io', 'client-dist', 'socket.io.min.js')
));
// anime.js도 같은 이유로 서버가 직접 제공한다(행사장에 인터넷이 없어도 돌아가야 한다).
app.use('/vendor/anime.js', express.static(
  path.join(루트, 'node_modules', 'animejs', 'dist', 'bundles', 'anime.esm.min.js')
));

app.get('/', (req, res) => res.sendFile(path.join(루트, 'public', 'index.html')));
app.get('/screen', (req, res) => res.sendFile(path.join(루트, 'public', 'screen.html')));
app.get('/admin',  (req, res) => res.sendFile(path.join(루트, 'public', 'admin.html')));

// ── 상태 복원 / 입장코드 ────────────────────────────────────
const 복원됨 = 복원();
팀초기화();
// 팀 편성 단계: none(안 나눔) / picking(휴대폰에서 고르는 중) / naming(대표가 이름·색 정하는 중) / done
state.settings.teamPhase ??= 'none';
state.settings.scoreMode ??= 'best';           // 기본은 '최고' (SPEC 7장)
// 큰 화면에 무엇을 띄울지. 'auto'면 상황에 맞게(대기실→보드→게임), 'scoreboard'면 점수판 고정,
// 'teams'면 게임이 없는 동안 팀 소개(원클릭 편성 직후).
state.settings.bigScreen ??= 'auto';
// 보드: 게임별 플레이 횟수와 최근 결과를 기억한다.
state.board ??= { games: {} };
// 예전 상태 파일에는 games가 배열로 저장돼 있을 수 있다.
// 배열에 속성을 붙이면 JSON으로 저장할 때 통째로 사라지므로 객체로 바꾼다.
if (!state.board.games || Array.isArray(state.board.games)) state.board.games = {};
for (const g of 게임목록) state.board.games[g.id] ??= { playsCount: 0, lastResult: null };
state.joinCode = process.env.JOIN_CODE?.trim() || 입장코드생성();
저장();

let 현재주소 = 접속주소(PORT);
let 현재QR = null;

async function QR갱신() {
  현재주소 = 접속주소(PORT);
  현재QR = await QR만들기(현재주소);
}

// ══════════════════════════════════════════════════════════
// 게임 진행 (SPEC 3장)
//   보드 → 규칙 카드 → 진행 → 결과 → (점수 반영) → 보드
// ══════════════════════════════════════════════════════════

function 보드뷰() {
  return 게임목록.map(g => {
    const 기록 = state.board.games[g.id] || { playsCount: 0, lastResult: null };
    const 인원 = Object.keys(state.players).length;
    return {
      ...보드정보(g),
      playsCount: 기록.playsCount,
      lastResult: 기록.lastResult,
      진행중: state.current?.gameId === g.id,
      인원부족: 인원 < g.minPlayers
    };
  });
}

// 게임 고르기 → 규칙 카드
function 게임고르기(gameId) {
  const g = 게임찾기(gameId);
  if (!g) return { ok: false, error: '없는 게임이에요.' };
  if (state.current) return { ok: false, error: '이미 진행 중인 게임이 있어요.' };
  state.current = { gameId, playId: null, phase: 'rules', gameState: null };
  // TV에 팀 소개를 띄워 둔 채였다면 규칙 카드가 끝난 뒤 보드로 돌아오게 한다.
  if (state.settings.bigScreen === 'teams') state.settings.bigScreen = 'auto';
  저장();
  return { ok: true };
}

// 규칙 카드에서 '시작'
async function 게임시작(옵션 = {}) {
  const c = state.current;
  if (!c || c.phase !== 'rules') return { ok: false, error: '규칙 카드 상태가 아니에요.' };
  const g = 게임찾기(c.gameId);
  if (!g) return { ok: false, error: '없는 게임이에요.' };

  // playId를 먼저 만든다 — 마피아처럼 판별 비밀(역할)을 따로 저장하는 게임이
  // 그 판에 비밀을 묶으려면 create 안에서 playId를 알아야 한다.
  c.playId = 플레이ID생성();

  const ctx = {
    playId: c.playId,
    players: state.players,
    teams: state.teams,
    content: await 문제불러오기(),  // 시작할 때마다 문제를 다시 읽는다 (SPEC 8장)
    settings: { ...state.settings, ...옵션 }
  };

  c.gameState = g.create(ctx);
  c.phase = 'playing';
  // 연습 판: 게임 모듈은 모른다. 끝낼 때 점수·횟수를 남기지 않는 것으로만 구분한다.
  c.연습 = !!옵션.연습;
  저장();
  console.log(`[게임] ${g.name} ${c.연습 ? '연습 ' : ''}시작 (playId ${c.playId})`);
  return { ok: true };
}

// 규칙 카드에서 '취소' — 아직 시작 전이라 점수가 없다.
function 게임취소() {
  if (!state.current) return { ok: false, error: '진행 중인 게임이 없어요.' };
  state.current = null;
  저장();
  return { ok: true };
}

// 게임을 끝내고 점수를 반영한다.
function 게임끝내기({ 점수반영 = true } = {}) {
  const c = state.current;
  if (!c) return { ok: false, error: '진행 중인 게임이 없어요.' };
  const g = 게임찾기(c.gameId);
  if (c.연습) 점수반영 = false;   // 연습 판은 어떤 버튼으로 끝내도 점수·플레이 횟수가 남지 않는다

  let 요약 = null;
  if (점수반영 && g && c.gameState) {
    const r = g.result(c.gameState) || {};
    const 줄들 = 여러점수기록(c.playId, c.gameId, r.점수 || []);
    요약 = r.요약 || null;

    // 시트에도 남긴다(큐에 쌓였다가 5초마다 한 번에 간다)
    for (const 줄 of 줄들) {
      const p = state.players[줄.playerId];
      const t = 줄.teamId ? state.teams[줄.teamId] : null;
      점수줄추가(줄, p?.name || '(나감)', t?.name || 줄.teamId || '');
    }
    게임결과추가({ playId: c.playId, gameId: c.gameId, 요약 });

    const 기록 = state.board.games[c.gameId] ||= { playsCount: 0, lastResult: null };
    기록.playsCount += 1;
    기록.lastResult = 최근결과글(c.gameId, 요약);
    console.log(`[게임] ${g.name} 끝 — ${기록.lastResult ?? '결과 없음'}`);
  } else {
    console.log(`[게임] ${g?.name ?? c.gameId} ${c.연습 ? '연습 끝' : '중단'} (점수 없음)`);
  }

  state.current = null;
  저장();
  return { ok: true, 요약 };
}

// 보드 블록에 적을 한 줄 ('1등 초코파이' 같은)
function 최근결과글(gameId, 요약) {
  const 팀결과 = 요약?.팀결과;
  if (Array.isArray(팀결과) && 팀결과.length > 0) {
    const 일등 = [...팀결과].sort((a, b) => b.points - a.points)[0];
    const t = state.teams[일등.id];
    return `1등 ${t?.name || `${일등.id}팀`}`;
  }
  // 개인전에는 팀 결과가 없다. 그럴 때는 1위 사람을 적는다.
  const 순위 = 요약?.순위;
  if (Array.isArray(순위) && 순위.length > 0 && 순위[0]?.이름) {
    return `1위 ${순위[0].이름}`;
  }
  // 마피아처럼 어느 편이 이겼는지가 결과인 게임
  if (typeof 요약?.결과 === 'string' && 요약.결과) {
    const 글 = { 시민승: '시민 승리', 마피아승: '마피아 승리' };
    return 글[요약.결과] || 요약.결과;
  }
  return null;
}

// 타이머 만료를 1초마다 확인한다. 상태가 바뀌면 화면에 다시 보낸다.
setInterval(() => {
  const c = state.current;
  if (!c || c.phase !== 'playing') return;
  const g = 게임찾기(c.gameId);
  if (!g?.onTick) return;
  const 전 = JSON.stringify(c.gameState);
  g.onTick(c.gameState, Date.now());
  if (JSON.stringify(c.gameState) !== 전) { 저장(); 전체갱신(); }
}, 1000);

// ── 뷰 전송 ─────────────────────────────────────────────────
// 비밀 정보(PIN 해시, 남의 토큰)는 여기서 아예 빼고 내보낸다.
function 큰화면뷰() {
  const 팀 = 팀요약();
  return {
    joinCode: state.joinCode,
    url: 현재주소,
    qr: 현재QR,
    // 이 주소가 안 될 때 진행자가 불러줄 대체 주소 (가상 어댑터 제외)
    대체주소: LAN주소찾기().slice(1).map(c => ({ 이름: c.이름, url: `http://${c.주소}:${PORT}` })),
    players: 참가자공개목록(),
    teams: 팀.teams,
    teamPhase: state.settings.teamPhase,
    나뉨: 팀.나뉨,
    board: 보드뷰(),
    scoreboard: 점수판(),
    current: 현재게임뷰('screen'),
    bigScreen: state.settings.bigScreen
  };
}

// 진행 중인 게임의 뷰를 등급에 맞게 꺼낸다 (SPEC 4장).
// 비밀 정보는 여기서 아예 빼고 내보낸다 — 화면에서 숨기는 것으로 끝내지 않는다.
function 현재게임뷰(등급, playerId = null) {
  const c = state.current;
  if (!c) return null;
  const g = 게임찾기(c.gameId);
  if (!g) return null;

  const 기본 = {
    gameId: c.gameId,
    playId: c.playId,
    name: g.name,
    color: g.color,
    type: g.type,
    phase: c.phase,                 // rules | playing
    연습: !!c.연습,                 // 점수가 안 남는 연습 판인가 (TV·휴대폰·진행자 모두에게 알린다)
    rules: g.rules
  };
  if (c.phase !== 'playing' || !c.gameState) return 기본;

  const v = g.views(c.gameState);
  if (등급 === 'screen') return { ...기본, view: v.screen };
  if (등급 === 'player') return { ...기본, view: v.player(playerId) };
  if (등급 === 'admin') return { ...기본, view: v.admin };
  if (등급 === 'adminSecret') return { ...기본, view: v.adminSecret };
  return 기본;
}

function 참가자뷰(player) {
  const 팀 = 팀요약();
  const 내팀 = 팀.teams.find(t => t.id === player.teamId) || null;
  return {
    me: { ...내정보(player), teamId: player.teamId },
    teamPhase: state.settings.teamPhase,
    내팀: 내팀 ? { id: 내팀.id, name: 내팀.name, color: 내팀.color, colorId: 내팀.colorId } : null,
    대표인가: !!(내팀 && 내팀.leaderId === player.id),
    // 팀 고르기 화면에 쓸 인원수(누가 어느 팀인지는 공개해도 되는 정보다)
    팀현황: 팀.teams.map(t => ({ id: t.id, name: t.name, color: t.color, 인원: t.members.length })),
    palette: 팀.palette,
    current: 현재게임뷰('player', player.id),
    scoreboard: 점수판()
  };
}

function 진행자뷰() {
  const 팀 = 팀요약();
  return {
    joinCode: state.joinCode,
    url: 현재주소,
    players: 참가자공개목록(),
    teams: 팀.teams,
    palette: 팀.palette,
    teamPhase: state.settings.teamPhase,
    board: 보드뷰(),
    scoreboard: 점수판(),
    current: 현재게임뷰('admin'),
    bigScreen: state.settings.bigScreen,
    scoreMode: state.settings.scoreMode,
    sheet: 시트상태()
  };
}

// 스포일러는 진행자가 잠금을 풀었을 때만 따로 보낸다 (SPEC 4장).
// 진행자도 게임에 참여하므로 기본은 잠겨 있다.
function 스포일러뷰() {
  return 현재게임뷰('adminSecret');
}

function 큰화면갱신() { io.to('screen').emit('screen', 큰화면뷰()); }
function 진행자갱신() { io.to('admin').emit('adminView', 진행자뷰()); }

// 참가자 한 명에게 자기 뷰를 다시 보낸다(재접속하면 서버가 현재 상태 전체를 다시 준다).
function 참가자갱신(playerId) {
  const p = state.players[playerId];
  if (!p) return;
  for (const s of io.sockets.sockets.values()) {
    if (s.data.playerId === playerId) s.emit('view', 참가자뷰(p));
  }
}

function 전체갱신() {
  큰화면갱신();
  진행자갱신();
  for (const id of Object.keys(state.players)) 참가자갱신(id);
}

// ── Socket.IO ───────────────────────────────────────────────
let ADMIN_PIN_시트 = null;
const ADMIN_PIN_기본 = (process.env.ADMIN_PIN || '0000').trim();
const 진행자PIN = () => (ADMIN_PIN_시트 || ADMIN_PIN_기본);
// 공개 주소로 띄우면 누구나 /admin 을 열 수 있다. 기본 PIN으로는 켜지지 않게 막는다.
if (process.env.RAILWAY_PUBLIC_DOMAIN && ADMIN_PIN_기본 === '0000') {
  console.error('  [!] 공개 서버에서는 기본 PIN(0000)을 쓸 수 없어요. 환경변수 ADMIN_PIN 을 정해주세요.');
  process.exit(1);
}

io.on('connection', (socket) => {

  // ── 큰 화면 ───────────────────────────────────────────────
  socket.on('screen:hello', () => {
    socket.join('screen');
    socket.emit('screen', 큰화면뷰());
  });

  // ── 휴대폰 입장 ───────────────────────────────────────────
  socket.on('join', ({ code, name, pin } = {}, ack) => {
    const 응답 = (결과) => typeof ack === 'function' && ack(결과);

    if (String(code || '').trim() !== state.joinCode) {
      return 응답({ ok: false, error: '입장코드가 달라요.' });
    }
    const 이름 = String(name || '').trim();
    if (이름.length < 1 || 이름.length > 6) {
      return 응답({ ok: false, error: '이름은 1~6자로 넣어주세요.' });
    }
    if (이름중복(이름)) {
      return 응답({ ok: false, error: '이미 쓰는 이름이에요. 다르게 적어주세요.' });
    }
    if (!/^\d{4}$/.test(String(pin || ''))) {
      return 응답({ ok: false, error: 'PIN은 숫자 4자리예요.' });
    }

    const player = 참가자추가({ name: 이름, pin });
    참가자추가기록(player);
    붙이기(socket, player);
    console.log(`[입장] ${player.name} (${참가자공개목록().length}명)`);
    응답({ ok: true, view: 참가자뷰(player) });
    전체갱신();
  });

  // ── 재접속 ────────────────────────────────────────────────
  // ① 토큰(같은 브라우저) ② 이름+PIN(다른 브라우저·시크릿·카톡 인앱)
  socket.on('resume', ({ token, name, pin } = {}, ack) => {
    const 응답 = (결과) => typeof ack === 'function' && ack(결과);

    let player = null;
    if (token) {
      player = 토큰으로찾기(token);
      if (!player) return 응답({ ok: false, error: '저장된 입장 정보가 없어요.', 재입력: true });
    } else {
      if (!name || !/^\d{4}$/.test(String(pin || ''))) {
        return 응답({ ok: false, error: '이름과 비밀번호 4자리를 넣어주세요.' });
      }
      const r = 이름PIN으로찾기(name, pin);
      if (!r.ok) return 응답(r);
      player = r.player;
    }

    붙이기(socket, player);
    console.log(`[복귀] ${player.name}`);
    응답({ ok: true, view: 참가자뷰(player) });
    전체갱신();
  });

  function 붙이기(socket, player) {
    socket.data.playerId = player.id;
    socket.join('players');
    접속상태변경(player.id, true);
  }

  // ── 게임 입력 ─────────────────────────────────────────────
  socket.on('input', ({ gameId, playId, payload } = {}, ack) => {
    const 응답 = (r) => typeof ack === 'function' && ack(r);
    const id = socket.data.playerId;
    if (!id) return 응답({ ok: false, error: '먼저 입장해주세요.' });

    const c = state.current;
    if (!c || c.phase !== 'playing') return 응답({ ok: false, error: '지금은 입력할 때가 아니에요.' });
    // 지난 판의 입력이 늦게 도착하는 것을 막는다.
    if (gameId !== c.gameId || playId !== c.playId) {
      return 응답({ ok: false, error: '화면이 바뀌었어요. 잠시만요.' });
    }

    const g = 게임찾기(c.gameId);
    if (!g?.onInput) return 응답({ ok: false, error: '입력을 받지 않는 게임이에요.' });

    g.onInput(c.gameState, id, payload);
    저장();
    응답({ ok: true });
    전체갱신();
  });

  // ── 팀 고르기 (직접 선택 모드) ────────────────────────────
  socket.on('team:pick', ({ teamId } = {}, ack) => {
    const id = socket.data.playerId;
    if (!id) return typeof ack === 'function' && ack({ ok: false, error: '먼저 입장해주세요.' });
    if (state.settings.teamPhase !== 'picking') {
      return typeof ack === 'function' && ack({ ok: false, error: '지금은 팀을 고르는 시간이 아니에요.' });
    }
    const r = 팀직접선택(id, teamId);
    typeof ack === 'function' && ack(r);
    if (r.ok) 전체갱신();
  });

  // ── 팀 이름·색 정하기 (팀 대표만) ─────────────────────────
  socket.on('team:set', ({ name, colorId } = {}, ack) => {
    const 응답 = (결과) => typeof ack === 'function' && ack(결과);
    const id = socket.data.playerId;
    const p = id && state.players[id];
    if (!p || !p.teamId) return 응답({ ok: false, error: '팀이 아직 없어요.' });
    if (state.teams[p.teamId]?.leaderId !== id) {
      return 응답({ ok: false, error: '팀 대표만 정할 수 있어요.' });
    }
    const r = 팀설정(p.teamId, { name, colorId });
    응답(r);
    if (r.ok) { 팀줄추가(state.teams[p.teamId], 색hex(state.teams[p.teamId].colorId)); 전체갱신(); }
  });

  // ── 진행자 ────────────────────────────────────────────────
  socket.on('admin:login', ({ pin } = {}, ack) => {
    if (String(pin || '').trim() !== 진행자PIN()) {
      console.log('[진행자] 로그인 실패');
      return typeof ack === 'function' && ack({ ok: false, error: 'PIN이 달라요.' });
    }
    socket.join('admin');
    socket.data.admin = true;
    typeof ack === 'function' && ack({ ok: true, view: 진행자뷰() });
  });

  socket.on('admin', async ({ action, payload } = {}, ack) => {
    const 응답 = (결과) => typeof ack === 'function' && ack(결과 || { ok: true });
    if (!socket.data.admin) return 응답({ ok: false, error: '진행자 로그인이 필요해요.' });
    const d = payload || {};
    let r = { ok: true };

    switch (action) {
      case '팀나누기_랜덤':
        랜덤팀배정();
        state.settings.teamPhase = 'naming';
        console.log('[진행자] 팀 랜덤 배정');
        break;

      case '팀나누기_원클릭':
        // 버튼 하나로: 랜덤 배정 + 이름·색 기본값 + 편성 완료. TV에는 팀 소개를 띄운다.
        if (state.current) { r = { ok: false, error: '진행 중인 게임을 먼저 끝내세요.' }; break; }
        랜덤팀배정();
        팀기본값채우기();
        for (const t of Object.values(state.teams)) 팀줄추가(t, 색hex(t.colorId));
        state.settings.teamPhase = 'done';
        state.settings.bigScreen = 'teams';
        console.log('[진행자] 팀 원클릭 편성');
        break;

      case '팀나누기_직접':
        팀해산();
        state.settings.teamPhase = 'picking';
        console.log('[진행자] 팀 직접 선택 시작');
        break;

      case '팀고르기_마감':
        state.settings.teamPhase = 'naming';
        break;

      case '팀편성_완료':
        state.settings.teamPhase = 'done';
        break;

      case '팀편성_초기화':
        팀해산();
        for (const t of Object.values(state.teams)) { t.name = ''; t.colorId = null; }
        state.settings.teamPhase = 'none';
        if (state.settings.bigScreen === 'teams') state.settings.bigScreen = 'auto';
        break;

      case '팀이동':      r = 팀강제이동(d.playerId, d.teamId ?? null); break;
      case '팀설정':      r = 팀설정(d.teamId, { name: d.name, colorId: d.colorId }); break;
      case '이름변경':    r = 이름변경(d.playerId, d.name); break;

      case '내보내기': {
        const p = state.players[d.playerId];
        if (p) {
          console.log(`[진행자] ${p.name} 내보냄`);
          for (const s2 of io.sockets.sockets.values()) {
            if (s2.data.playerId === d.playerId) { s2.emit('내보내짐'); s2.data.playerId = null; }
          }
          참가자삭제(d.playerId);
        }
        break;
      }

      case '기기연결': {
        // '이 기기를 ○○으로 연결' — 토큰을 새로 발급해 진행자가 불러준다.
        const p = 토큰재발급(d.playerId);
        r = p ? { ok: true, token: p.token, name: p.name } : { ok: false, error: '참가자를 찾을 수 없어요.' };
        break;
      }

      // ── 게임 보드 ──
      case '게임고르기':  r = 게임고르기(d.gameId); break;
      case '게임시작':    r = await 게임시작(d.옵션 || {}); break;
      case '게임취소':    r = 게임취소(); break;
      case '게임끝내기':  r = 게임끝내기({ 점수반영: true }); break;
      case '게임중단':    r = 게임끝내기({ 점수반영: false }); break;

      case '게임조작': {
        // 게임 안쪽 진행(다음 라운드, 답 병합 등)은 그 게임 모듈이 처리한다.
        const c = state.current;
        if (!c || c.phase !== 'playing') { r = { ok: false, error: '진행 중인 게임이 없어요.' }; break; }
        const g = 게임찾기(c.gameId);
        if (!g?.onAdmin) { r = { ok: false, error: '조작할 수 없는 게임이에요.' }; break; }
        g.onAdmin(c.gameState, { action: d.action, payload: d.payload });
        break;
      }

      // ── 점수 ──
      case '지금동기화': {
        const st = await 지금동기화();
        r = { ok: true, sheet: st };
        break;
      }
      case '큰화면': {
        if (!['auto', 'scoreboard', 'teams'].includes(d.view)) { r = { ok: false, error: '없는 화면이에요.' }; break; }
        state.settings.bigScreen = d.view;
        break;
      }
      case '점수기준': {
        if (!['best', 'latest', 'total'].includes(d.mode)) { r = { ok: false, error: '없는 기준이에요.' }; break; }
        state.settings.scoreMode = d.mode;
        break;
      }
      case '수동점수': {
        if (!state.players[d.playerId]) { r = { ok: false, error: '참가자를 찾을 수 없어요.' }; break; }
        {
          const 줄 = 수동점수(d.playerId, Number(d.points) || 0, d.reason);
          const p2 = state.players[줄.playerId];
          const t2 = 줄.teamId ? state.teams[줄.teamId] : null;
          점수줄추가(줄, p2?.name || '', t2?.name || '');
        }
        break;
      }
      case '점수되돌리기': {
        const 줄 = 마지막되돌리기();
        if (줄) {
          const p3 = state.players[줄.playerId];
          const t3 = 줄.teamId ? state.teams[줄.teamId] : null;
          점수줄추가(줄, p3?.name || '', t3?.name || '');
        }
        r = 줄 ? { ok: true } : { ok: false, error: '되돌릴 기록이 없어요.' };
        break;
      }

      // ── 스포일러 (기본 잠금, SPEC 4장) ──
      case '스포일러보기':
        socket.emit('adminSecret', 스포일러뷰());
        break;

      case '입장코드재발급':
        state.joinCode = 입장코드생성();
        저장();
        console.log(`[진행자] 입장코드 재발급 → ${state.joinCode}`);
        break;

      case '전체새로고침':
        io.to('players').emit('새로고침');
        break;

      default:
        r = { ok: false, error: `모르는 동작: ${action}` };
    }

    저장();
    응답(r);
    if (r.ok) 전체갱신();
  });

  // ── 끊김 ──────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const id = socket.data.playerId;
    if (!id) return;
    // 같은 사람이 다른 탭으로 아직 붙어 있으면 끊김으로 보지 않는다.
    const 남은연결 = [...io.sockets.sockets.values()].some(s => s.id !== socket.id && s.data.playerId === id);
    if (남은연결) return;
    const p = 접속상태변경(id, false);
    if (p) console.log(`[끊김] ${p.name}`);
    큰화면갱신();
    진행자갱신();
  });
});

// ── 구글시트 (없어도 모든 기능이 돌아간다, SPEC 8장) ────────
await 시트준비();
if (시트켜짐()) {
  const 설정 = await 시트설정();
  if (설정) {
    // 시트 「설정」 탭이 .env 보다 우선한다. 대표님이 현장에서 시트로 바꿀 수 있게.
    if (설정['진행자PIN']) ADMIN_PIN_시트 = 설정['진행자PIN'];
    if (설정['입장코드'] && /^\d{4}$/.test(설정['입장코드'])) {
      state.joinCode = 설정['입장코드'];
      저장();
    }
    if (['best', 'latest', 'total'].includes(설정['점수기준'])) {
      state.settings.scoreMode = 설정['점수기준'];
      저장();
    }
  }
}

// ── 시작 ────────────────────────────────────────────────────
// 포트가 이미 쓰이고 있을 때 개발자용 에러 스택 대신 할 일을 알려준다.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`  [!] ${PORT}번 포트를 이미 다른 프로그램이 쓰고 있어요.`);
    console.error('      이전에 켠 서버 창이 남아 있는지 확인하고 그 창에서 Ctrl+C를 누르세요.');
    console.error('      창을 못 찾겠다면 PowerShell에 아래를 붙여넣으세요:');
    console.error('');
    console.error(`        Get-NetTCPConnection -LocalPort ${PORT} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
    console.error('');
    process.exit(1);
  }
  console.error('[서버 오류]', err.message);
  process.exit(1);
});

await QR갱신();
server.listen(PORT, '0.0.0.0', () => {
  const 목록 = LAN주소찾기();
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║          도파민플레이션 서버 켜짐         ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`   입장코드 : ${state.joinCode}`);
  console.log('');
  console.log(`   휴대폰   : ${현재주소}`);
  console.log(`   큰 화면  : http://localhost:${PORT}/screen   (TV에서 F11)`);
  if (목록.length > 1) {
    console.log('');
    console.log('   이 주소가 안 되면 아래도 시도해보세요:');
    for (const c of 목록.slice(1)) console.log(`     - http://${c.주소}:${PORT}  (${c.이름})`);
  }
  if (복원됨) console.log(`\n   이전 기록을 불러왔습니다 (참가자 ${Object.keys(state.players).length}명).`);
  console.log('');
  console.log('   서버를 끄려면 Ctrl+C');
  console.log('');
});

// 와이파이가 바뀌거나 자리를 옮겨 노트북 IP가 달라지면 QR·주소를 자동으로 새로 그린다.
// 서버 자체는 0.0.0.0에 붙어 있어 재시작할 필요가 없다.
IP감시시작(PORT, async (새주소, 옛주소) => {
  await QR갱신();
  감시주소맞추기(PORT);
  전체갱신();
  console.log('');
  console.log(`  [i] 접속 주소가 바뀌었습니다: ${옛주소}  →  ${새주소}`);
  console.log('      TV의 QR과 주소는 저절로 바뀌었습니다. 참가자에게 다시 찍으라고 안내하세요.');
  console.log('      (이미 들어와 있는 사람은 그대로 있어도 됩니다.)');
  console.log('');
});

// 터널 주소를 환경변수로 넘겨받으면(8단계) QR을 그쪽으로 바꾼다.
if (process.env.TUNNEL_URL) {
  터널주소설정(process.env.TUNNEL_URL);
  await QR갱신();
  감시주소맞추기(PORT);
  큰화면갱신();
}
