// 서버 상태의 주인. 모든 상태 변경은 이 파일을 거친다.
// 화면(큰 화면·휴대폰·진행자)은 서버가 보낸 뷰를 그리기만 한다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const 프로젝트루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 상태파일 = path.join(프로젝트루트, 'data', 'state.json');

// SPEC 10장 데이터 모델
export const state = {
  joinCode: '0000',
  players: {},              // id -> { id, name, pinHash, pinSalt, token, teamId, connected, lastSeen, joinedAt }
  teams: {},                // 2단계
  board: { games: {} },     // gameId → { playsCount, lastResult }  (배열이면 JSON 저장 때 속성이 날아간다)
  current: null,            // 3단계
  scoreLog: [],             // 3단계
  settings: { scoreMode: 'best' }
};

// ── 입장코드 ────────────────────────────────────────────────
export function 입장코드생성() {
  // 0000 같은 헷갈리는 코드를 피하려고 1000~9999 범위로 뽑는다.
  return String(crypto.randomInt(1000, 10000));
}

export function 입장코드재발급() {
  state.joinCode = 입장코드생성();
  저장();
  return state.joinCode;
}

// ── PIN 해시 ────────────────────────────────────────────────
// 재접속용 4자리 PIN은 평문으로 두지 않는다(시트 `참가자` 탭에도 해시만 올린다).
function PIN해시(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 32).toString('hex');
}

export function PIN확인(player, pin) {
  if (!player?.pinHash) return false;
  const 계산 = PIN해시(pin, player.pinSalt);
  return crypto.timingSafeEqual(Buffer.from(계산, 'hex'), Buffer.from(player.pinHash, 'hex'));
}

// ── 참가자 ──────────────────────────────────────────────────
export function 이름중복(name) {
  const 정규 = name.trim().toLowerCase();
  return Object.values(state.players).some(p => p.name.trim().toLowerCase() === 정규);
}

export function 참가자추가({ name, pin }) {
  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  const player = {
    id,
    name: name.trim(),
    pinSalt: salt,
    pinHash: PIN해시(pin, salt),
    token: crypto.randomBytes(24).toString('base64url'),
    teamId: null,
    connected: true,
    joinedAt: Date.now(),
    lastSeen: Date.now()
  };
  state.players[id] = player;
  저장();
  return player;
}

export function 토큰으로찾기(token) {
  if (!token) return null;
  return Object.values(state.players).find(p => p.token === token) || null;
}

export function 이름으로찾기(name) {
  if (!name) return null;
  const 정규 = name.trim().toLowerCase();
  return Object.values(state.players).find(p => p.name.trim().toLowerCase() === 정규) || null;
}

export function 접속상태변경(playerId, connected) {
  const p = state.players[playerId];
  if (!p) return null;
  p.connected = connected;
  p.lastSeen = Date.now();
  저장();
  return p;
}

export function 참가자삭제(playerId) {
  if (!state.players[playerId]) return false;
  delete state.players[playerId];
  저장();
  return true;
}

// ── 뷰 (비밀 정보를 빼고 내보낸다) ──────────────────────────
// pinHash·token은 절대 화면으로 나가지 않는다.
export function 참가자공개목록() {
  return Object.values(state.players)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map(p => ({ id: p.id, name: p.name, teamId: p.teamId, connected: p.connected }));
}

export function 내정보(player) {
  return { id: player.id, name: player.name, teamId: player.teamId, token: player.token };
}

// ── 로컬 백업 (구글시트가 없어도 모든 기능이 돌아가야 한다) ──
let 저장예약 = null;
export function 저장() {
  // 상태가 바뀔 때마다 부르지만, 실제 쓰기는 200ms 모아서 한 번만 한다.
  if (저장예약) return;
  저장예약 = setTimeout(() => {
    저장예약 = null;
    try {
      fs.mkdirSync(path.dirname(상태파일), { recursive: true });
      fs.writeFileSync(상태파일, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      console.error('[상태저장 실패]', err.message);
    }
  }, 200);
}

export function 복원() {
  try {
    if (!fs.existsSync(상태파일)) return false;
    const 저장본 = JSON.parse(fs.readFileSync(상태파일, 'utf8'));
    Object.assign(state, 저장본);
    // 서버가 새로 떴으니 모두 끊긴 상태에서 시작한다.
    for (const p of Object.values(state.players)) p.connected = false;
    return true;
  } catch (err) {
    console.error('[상태복원 실패]', err.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════
// 2단계 — 재접속 · 팀 편성
// ══════════════════════════════════════════════════════════

export const 팔레트 = [
  { id: 'pink',   name: '핑크',   hex: '#FF3D6E' },
  { id: 'orange', name: '오렌지', hex: '#FF8A00' },
  { id: 'yellow', name: '옐로',   hex: '#FFD400' },
  { id: 'green',  name: '그린',   hex: '#22C55E' },
  { id: 'mint',   name: '민트',   hex: '#14B8C4' },
  { id: 'blue',   name: '블루',   hex: '#3B82F6' },
  { id: 'purple', name: '퍼플',   hex: '#8B5CF6' },
  { id: 'silver', name: '실버',   hex: '#A3A3A3' }
];

const 팀ID들 = ['A', 'B', 'C'];

export function 팀초기화() {
  for (const id of 팀ID들) {
    if (!state.teams[id]) {
      state.teams[id] = { id, name: '', colorId: null, leaderId: null };
    }
  }
  저장();
}

export function 팀인원(teamId) {
  return Object.values(state.players).filter(p => p.teamId === teamId).length;
}

export function 팀원들(teamId) {
  return Object.values(state.players).filter(p => p.teamId === teamId).sort((a, b) => a.joinedAt - b.joinedAt);
}

// ── 팀 나누기 ───────────────────────────────────────────────
function 섞기(배열) {
  const a = [...배열];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 랜덤 자동: 인원을 균등하게 (12=4/4/4, 11=4/4/3, 10=4/3/3)
export function 랜덤팀배정() {
  팀초기화();
  const 사람들 = 섞기(Object.values(state.players));
  사람들.forEach((p, i) => { p.teamId = 팀ID들[i % 3]; });
  대표다시뽑기();
  저장();
  return 팀요약();
}

// 직접 선택: 참가자가 고른다. 인원 차이가 1명을 넘으면 막는다(SPEC 2장).
export function 팀직접선택(playerId, teamId) {
  const p = state.players[playerId];
  if (!p) return { ok: false, error: '참가자를 찾을 수 없어요.' };
  if (!팀ID들.includes(teamId)) return { ok: false, error: '없는 팀이에요.' };
  if (p.teamId === teamId) return { ok: true };

  const 인원 = Object.fromEntries(팀ID들.map(t => [t, 팀인원(t)]));
  if (p.teamId) 인원[p.teamId] -= 1;          // 옮기는 경우 원래 팀에서 뺀 뒤 따진다
  const 가장적은팀 = Math.min(...팀ID들.map(t => 인원[t]));
  if (인원[teamId] + 1 - 가장적은팀 > 1) {
    return { ok: false, error: '이 팀은 이미 꽉 찼어요. 인원이 적은 팀을 골라주세요.' };
  }

  p.teamId = teamId;
  대표다시뽑기();
  저장();
  return { ok: true };
}

// 진행자가 옮기는 것은 인원 제한을 받지 않는다(SPEC 6장 "언제든 팀원 이동").
export function 팀강제이동(playerId, teamId) {
  const p = state.players[playerId];
  if (!p) return { ok: false, error: '참가자를 찾을 수 없어요.' };
  if (teamId !== null && !팀ID들.includes(teamId)) return { ok: false, error: '없는 팀이에요.' };
  p.teamId = teamId;
  대표다시뽑기();
  저장();
  return { ok: true };
}

export function 팀해산() {
  for (const p of Object.values(state.players)) p.teamId = null;
  for (const id of 팀ID들) {
    if (state.teams[id]) { state.teams[id].leaderId = null; }
  }
  저장();
}

// ── 팀 대표 (이름·색을 정할 한 명) ──────────────────────────
function 대표다시뽑기() {
  팀초기화();
  for (const id of 팀ID들) {
    const 팀 = state.teams[id];
    const 원들 = 팀원들(id);
    if (원들.length === 0) { 팀.leaderId = null; continue; }
    // 이미 정해진 대표가 아직 그 팀에 있으면 그대로 둔다.
    if (팀.leaderId && 원들.some(p => p.id === 팀.leaderId)) continue;
    팀.leaderId = 원들[crypto.randomInt(원들.length)].id;
  }
}

// ── 팀 이름 · 색 ────────────────────────────────────────────
export function 팀설정(teamId, { name, colorId }) {
  const 팀 = state.teams[teamId];
  if (!팀) return { ok: false, error: '없는 팀이에요.' };

  if (name !== undefined) {
    const n = String(name).trim();
    if (n.length > 8) return { ok: false, error: '팀 이름은 8자까지예요.' };
    const 겹침 = Object.values(state.teams)
      .some(t => t.id !== teamId && t.name && t.name.trim() === n && n);
    if (겹침) return { ok: false, error: '다른 팀이 쓰는 이름이에요.' };
    팀.name = n;
  }

  if (colorId !== undefined) {
    if (colorId !== null && !팔레트.some(c => c.id === colorId)) {
      return { ok: false, error: '없는 색이에요.' };
    }
    const 겹침 = Object.values(state.teams).some(t => t.id !== teamId && t.colorId === colorId && colorId);
    if (겹침) return { ok: false, error: '다른 팀이 고른 색이에요.' };
    팀.colorId = colorId;
  }

  저장();
  return { ok: true };
}

// 원클릭 편성용: 이름·색이 빈 팀에 안 겹치는 기본값을 채운다(이미 정한 것은 그대로 둔다).
// 기본 이름은 색 이름이다 — 휴대폰에 「핑크 팀」처럼 뜬다. 대표나 진행자가 나중에 바꿀 수 있다.
export function 팀기본값채우기() {
  팀초기화();
  const 기본순서 = ['pink', 'green', 'blue', 'yellow', 'purple', 'orange', 'mint', 'silver'];
  for (const id of 팀ID들) {
    const 팀 = state.teams[id];
    const 남 = Object.values(state.teams).filter(t => t.id !== id);
    if (!팀.colorId) 팀.colorId = 기본순서.find(c => !남.some(t => t.colorId === c)) || null;
    if (!팀.name) {
      const 색이름 = 팔레트.find(c => c.id === 팀.colorId)?.name;
      팀.name = (색이름 && !남.some(t => t.name === 색이름)) ? 색이름 : `${id}조`;
    }
  }
  저장();
}

export function 색hex(colorId) {
  return 팔레트.find(c => c.id === colorId)?.hex || null;
}

// ── 뷰 ──────────────────────────────────────────────────────
export function 팀요약() {
  팀초기화();
  const 쓰인색 = Object.values(state.teams).map(t => t.colorId).filter(Boolean);
  return {
    teams: 팀ID들.map(id => {
      const t = state.teams[id];
      return {
        id,
        name: t.name || '',
        colorId: t.colorId,
        color: 색hex(t.colorId),
        leaderId: t.leaderId,
        members: 팀원들(id).map(p => ({ id: p.id, name: p.name, connected: p.connected }))
      };
    }),
    palette: 팔레트.map(c => ({ ...c, taken: 쓰인색.includes(c.id) })),
    나뉨: Object.values(state.players).some(p => p.teamId)
  };
}

// ── 이름 + PIN 복귀 (다른 브라우저·시크릿·카톡 인앱) ─────────
export function 이름PIN으로찾기(name, pin) {
  const p = 이름으로찾기(name);
  if (!p) return { ok: false, error: '그 이름으로 입장한 사람이 없어요.' };
  if (!PIN확인(p, pin)) return { ok: false, error: '비밀번호가 달라요.' };
  return { ok: true, player: p };
}

// 진행자가 이름을 고칠 때
export function 이름변경(playerId, 새이름) {
  const p = state.players[playerId];
  if (!p) return { ok: false, error: '참가자를 찾을 수 없어요.' };
  const n = String(새이름).trim();
  if (n.length < 1 || n.length > 6) return { ok: false, error: '이름은 1~6자예요.' };
  const 겹침 = Object.values(state.players)
    .some(o => o.id !== playerId && o.name.trim().toLowerCase() === n.toLowerCase());
  if (겹침) return { ok: false, error: '이미 쓰는 이름이에요.' };
  p.name = n;
  저장();
  return { ok: true };
}

// 진행자가 '이 기기를 ○○으로 연결'할 때 토큰을 새로 발급한다.
export function 토큰재발급(playerId) {
  const p = state.players[playerId];
  if (!p) return null;
  p.token = crypto.randomBytes(24).toString('base64url');
  저장();
  return p;
}
