// 게임 모듈 목록 (SPEC 3장)
// 새 게임을 추가할 때는 아래 import 한 줄과 목록 한 칸만 더하면 된다.
// 다른 게임 코드는 건드리지 않는다.
import telepathy from './telepathy/index.js';
import chosung from './chosung/index.js';
import nunchi from './nunchi/index.js';
import reaction from './reaction/index.js';
import bottlecap from './bottlecap/index.js';
import mafia from './mafia/index.js';

export const 게임목록 = [
  telepathy,
  chosung,
  nunchi,
  reaction,
  bottlecap,
  mafia
  // 7단계: 라이어, 이미지 맞히기
  // 10단계: 넌센스, 문장 맞추기, 천사혹은악마, 끝나는 말은?, 줄줄이 말해요
];

const 색인 = new Map(게임목록.map(g => [g.id, g]));

export function 게임찾기(id) {
  return 색인.get(id) || null;
}

// 보드 블록에 쓸 정보만 추린다(진행 로직은 화면으로 내보내지 않는다).
export function 보드정보(g) {
  return {
    id: g.id,
    name: g.name,
    type: g.type,            // 'team' | 'solo' | 'offline'
    minutes: g.minutes,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    color: g.color,
    rules: g.rules
  };
}
