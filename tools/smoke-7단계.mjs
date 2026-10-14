// 7단계 점검 — 라이어 게임, 그리고 개인전 전용 게임의 팀 점수 제외 · 연습 문제 분리
//
//   node tools/smoke-7단계.mjs
//
// 서버를 켤 필요가 없다. 게임 모듈을 직접 불러서 규칙만 확인한다.
// data/state.json 은 건드리지 않는다. 메모리의 참가자·점수만 가짜로 바꿔 쓰고 되돌린다.
// data/secret.json 에는 테스트용 판 하나를 썼다가 지운다.
//
// 가장 중요한 것: 「누가 라이어인지」가 어디로도 새지 않는가.
import { state } from '../server/state.js';
import { 비밀읽기, 비밀지우기 } from '../server/secret.js';
import { 점수판, 팀점수제외설정 } from '../server/scoring.js';
import { 연습문제, CSV전부 } from '../server/content.js';
import { 게임목록 } from '../server/games/index.js';
import liar from '../server/games/liar/index.js';

let 통과 = 0, 실패 = 0;
function 확인(라벨, 조건, 덧 = '') {
  if (조건) { 통과++; console.log(`  OK  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
  else { 실패++; console.log(`  !!  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
}

const 원래 = { players: state.players, scoreLog: state.scoreLog, teams: state.teams };
function 참가자세팅(목록) {
  state.players = {};
  목록.forEach(([id, name, teamId], i) => {
    state.players[id] = { id, name, teamId, connected: true, joinedAt: 1000 + i };
  });
}
const 사람들 = [['a', '가람', 'A'], ['b', '나래', 'A'], ['c', '다온', 'B'], ['d', '라온', 'B'], ['e', '마루', 'C']];
const 문제 = [{ 카테고리: '과일', 제시어: '복숭아' }];
const 판만들기 = (playId) => liar.create({ playId, players: state.players, content: { liar: 문제 } });
const 쓴판 = [];

// ══════════════════════════════════════════════════════════
console.log('\n[라이어 게임 — 비밀이 새지 않는가]');
{
  참가자세팅(사람들);
  const s = 판만들기('테스트-라이어-1'); 쓴판.push(s.playId);
  const 라이어id = 비밀읽기(s.playId).라이어들[0];
  const 라이어이름 = state.players[라이어id].name;
  const 시민id = 사람들.map(x => x[0]).find(id => id !== 라이어id);
  const v = liar.views(s);

  확인('라이어는 secret.json 에 적혀 있다', !!state.players[라이어id], 라이어이름);
  // state.json 에 그대로 저장되는 게임 상태 — 라이어 id 는 '전원 명단'과 '설명 순서'에만 있어야 한다
  확인('게임 상태(state)에는 누가 라이어인지 없다',
    Object.entries(s).every(([칸, 값]) => 칸 === '명단' || 칸 === '순서' || !JSON.stringify(값 ?? '').includes(`"${라이어id}"`)));
  확인('게임 상태에 라이어를 가리키는 칸이 비어 있다', s.들킨라이어 === null && s.판기록.length === 0);

  확인('큰 화면에 제시어가 없다', !JSON.stringify(v.screen).includes('복숭아'));
  확인('진행자 뷰에도 제시어가 없다 (진행자도 참가자)', !JSON.stringify(v.admin).includes('복숭아'));
  확인('큰 화면·진행자 뷰에 라이어 표시가 없다',
    !('내가라이어' in v.screen) && !('내가라이어' in v.admin) && v.screen.들킨라이어 === null);

  확인('라이어의 휴대폰에는 제시어가 오지 않는다', v.player(라이어id).제시어 === null && !JSON.stringify(v.player(라이어id)).includes('복숭아'));
  확인('라이어 본인은 자기가 라이어인 것을 안다', v.player(라이어id).내가라이어 === true);
  확인('시민의 휴대폰에는 제시어가 온다', v.player(시민id).제시어 === '복숭아');
  확인('시민의 휴대폰에는 누가 라이어인지 없다',
    v.player(시민id).내가라이어 === false && !JSON.stringify(v.player(시민id)).includes('"라이어"'));
  확인('스포일러(adminSecret)에만 라이어와 제시어가 있다',
    v.adminSecret.라이어 === 라이어이름 && v.adminSecret.제시어 === '복숭아');
  확인('카테고리는 모두에게 보인다', v.screen.카테고리 === '과일');
}

// ══════════════════════════════════════════════════════════
console.log('\n[라이어 게임 — 진행: 설명 → 토론 → 투표]');
{
  참가자세팅(사람들);
  const s = 판만들기('테스트-라이어-2'); 쓴판.push(s.playId);
  const 라이어id = 비밀읽기(s.playId).라이어들[0];
  const 시민들 = 사람들.map(x => x[0]).filter(id => id !== 라이어id);

  확인('설명으로 시작한다', s.phase === '설명' && s.순서.length === 5, `순서 ${s.순서.length}명`);
  const 첫발언 = s.순서[0];
  확인('내 차례는 발언자 본인에게만 보인다',
    liar.views(s).player(첫발언).내차례 === true && liar.views(s).player(s.순서[1]).내차례 === false);

  liar.onTick(s, s.endsAt + 1);                          // 20초가 지나면 저절로 다음 사람
  확인('시간이 지나면 다음 사람으로 넘어간다', s.발언번호 === 1 && s.phase === '설명');
  for (let i = 0; i < 4; i++) liar.onAdmin(s, { action: '다음' });
  확인('한 바퀴 돌면 토론이 된다', s.phase === '토론', s.phase);
  liar.onAdmin(s, { action: '다음' });
  확인('토론 뒤에 투표가 된다', s.phase === '투표', s.phase);

  liar.onInput(s, 시민들[0], { act: '투표', target: 시민들[0] });
  확인('자기 자신은 찍을 수 없다', !s.표[시민들[0]]);
  확인('투표 중에는 누가 누구를 찍었는지 화면에 없다',
    liar.views(s).screen.판결과 === null && liar.views(s).screen.투표현황.전체 === 5);

  // 시민 셋은 라이어를, 한 명은 엉뚱한 사람을 찍는다. 라이어는 시민을 찍는다.
  liar.onInput(s, 시민들[0], { act: '투표', target: 라이어id });
  liar.onInput(s, 시민들[1], { act: '투표', target: 라이어id });
  liar.onInput(s, 시민들[2], { act: '투표', target: 라이어id });
  liar.onInput(s, 시민들[3], { act: '투표', target: 시민들[0] });
  확인('다 내기 전에는 투표가 열려 있다', s.phase === '투표');
  liar.onInput(s, 라이어id, { act: '투표', target: 시민들[1] });
  확인('모두 내면 바로 마감하고, 라이어가 지목되면 맞히기로 간다', s.phase === '맞히기', s.phase);
  확인('지목된 뒤에는 라이어가 공개된다', liar.views(s).screen.들킨라이어 === state.players[라이어id].name);
  확인('맞히기 차례는 라이어에게만 온다',
    liar.views(s).player(라이어id).맞히기차례 === true && liar.views(s).player(시민들[0]).맞히기차례 === false);
  확인('맞히는 중에도 라이어 휴대폰에 제시어는 없다', liar.views(s).player(라이어id).제시어 === null);

  liar.onInput(s, 시민들[0], { act: '맞히기', answer: '복숭아' });
  확인('시민은 대신 답할 수 없다', s.phase === '맞히기');
  liar.onInput(s, 라이어id, { act: '맞히기', answer: '자두' });
  확인('라이어가 틀리면 시민 승', s.phase === '판끝' && s.판기록[0].승 === '시민');

  const 점 = s.판기록[0].점수;
  확인('라이어를 찍은 시민은 +2', 점[시민들[0]] === 2 && 점[시민들[1]] === 2 && 점[시민들[2]] === 2);
  확인('못 찍은 시민은 +1', 점[시민들[3]] === 1);
  확인('진 라이어는 점수가 없다', !점[라이어id]);

  const 결과뷰 = liar.views(s).screen.판결과;
  확인('판이 끝나면 라이어와 제시어가 공개된다',
    결과뷰.라이어 === state.players[라이어id].name && 결과뷰.제시어 === '복숭아');

  liar.onAdmin(s, { action: '답인정' });
  확인('진행자가 라이어 답을 인정하면 라이어 승으로 바뀐다',
    s.판기록[0].승 === '라이어' && s.판기록[0].점수[라이어id] === 3 && Object.keys(s.판기록[0].점수).length === 1);

  liar.onAdmin(s, { action: '다음' });
  확인('마지막 판 뒤에는 끝난다', s.phase === '끝', s.phase);
  const r = liar.result(s);
  확인('끝나면 라이어에게 +3이 기록된다',
    r.점수.length === 1 && r.점수[0].playerId === 라이어id && r.점수[0].points === 3);
  확인('보드에 적을 1위가 나온다', r.요약.순위[0].이름 === state.players[라이어id].name);
}

// ══════════════════════════════════════════════════════════
console.log('\n[라이어 게임 — 라이어가 이기는 경우]');
{
  참가자세팅(사람들);
  const s = 판만들기('테스트-라이어-3'); 쓴판.push(s.playId);
  const 라이어id = 비밀읽기(s.playId).라이어들[0];
  const 시민들 = 사람들.map(x => x[0]).filter(id => id !== 라이어id);
  for (let i = 0; i < 6; i++) liar.onAdmin(s, { action: '다음' });     // 설명 5명 + 토론
  // 표가 갈려 동률 — 라이어를 못 잡는다
  liar.onInput(s, 시민들[0], { act: '투표', target: 라이어id });
  liar.onInput(s, 시민들[1], { act: '투표', target: 시민들[0] });
  liar.onTick(s, s.endsAt + 1);                          // 나머지는 안 내고 시간이 끝남
  확인('동률이면 라이어를 못 잡은 것 — 라이어 승', s.phase === '판끝' && s.판기록[0].승 === '라이어' && !s.판기록[0].잡혔나);
  확인('라이어 승이면 라이어만 +3', s.판기록[0].점수[라이어id] === 3 && Object.keys(s.판기록[0].점수).length === 1);

  const s2 = 판만들기('테스트-라이어-4'); 쓴판.push(s2.playId);
  const 라2 = 비밀읽기(s2.playId).라이어들[0];
  const 시2 = 사람들.map(x => x[0]).filter(id => id !== 라2);
  for (let i = 0; i < 6; i++) liar.onAdmin(s2, { action: '다음' });
  for (const id of 시2) liar.onInput(s2, id, { act: '투표', target: 라2 });
  liar.onInput(s2, 라2, { act: '투표', target: 시2[0] });
  liar.onInput(s2, 라2, { act: '맞히기', answer: ' 복 숭 아 ' });
  확인('라이어가 제시어를 맞히면 역전승 (띄어 써도 정답)', s2.판기록[0].승 === '라이어' && s2.판기록[0].잡혔나 === true);
}

// ══════════════════════════════════════════════════════════
console.log('\n[개인전 전용 게임은 팀 점수에 안 들어간다]');
{
  참가자세팅([['a', '가람', 'A'], ['b', '나래', 'B']]);
  state.teams = { A: { id: 'A', name: '핑크', colorId: 'pink' }, B: { id: 'B', name: '그린', colorId: 'green' } };
  팀점수제외설정(게임목록.filter(g => g.개인전만).map(g => g.id));
  state.scoreLog = [
    { at: 1, playId: 'p1', gameId: 'telepathy', playerId: 'a', teamId: 'A', points: 5, reason: '팀 1등' },
    { at: 2, playId: 'p2', gameId: 'mafia', playerId: 'b', teamId: 'B', points: 9, reason: '마피아 승리' },
    { at: 3, playId: 'p3', gameId: 'liar', playerId: 'b', teamId: 'B', points: 5, reason: '라이어 게임' }
  ];
  const 판 = 점수판('total');
  const 개인 = Object.fromEntries(판.개인.map(p => [p.id, p.points]));
  const 팀 = Object.fromEntries(판.팀.map(t => [t.id, t.points]));
  확인('마피아·라이어가 개인전 전용으로 표시돼 있다',
    게임목록.filter(g => g.개인전만).map(g => g.id).sort().join(',') === 'liar,mafia');
  확인('개인 점수에는 마피아·라이어 점수가 들어간다', 개인.b === 14, `나래 ${개인.b}점`);
  확인('팀 점수에는 마피아·라이어 점수가 안 들어간다', 팀.B === 0, `그린 ${팀.B}점`);
  확인('팀전 점수는 그대로 팀 점수가 된다', 팀.A === 5, `핑크 ${팀.A}점`);
}

// ══════════════════════════════════════════════════════════
console.log('\n[연습 문제는 진짜 문제와 겹치지 않는다]');
{
  const 진짜 = CSV전부();
  const 겹침 = [
    ...연습문제.telepathy.filter(x => 진짜.telepathy.includes(x)),
    ...연습문제.chosung.filter(x => 진짜.chosung.some(r => r['정답'] === x.정답)).map(x => x.정답),
    ...연습문제.liar.filter(x => 진짜.liar.some(r => r['제시어'] === x.제시어)).map(x => x.제시어)
  ];
  확인('연습 문제가 종류마다 하나 이상 있다',
    연습문제.telepathy.length > 0 && 연습문제.chosung.length > 0 && 연습문제.liar.length > 0);
  확인('연습 문제 중 진짜 문제와 같은 것이 없다', 겹침.length === 0, 겹침.join(', ') || '겹침 없음');
}

// ══════════════════════════════════════════════════════════
console.log('\n[끈끈이 동전잡기 — 진행자가 등수만 입력]');
{
  const { default: coin } = await import('../server/games/coin/index.js');
  참가자세팅([['a', '가람', 'A'], ['b', '나래', 'A'], ['c', '다온', 'B'], ['e', '마루', 'C']]);
  const s = coin.create();
  coin.onAdmin(s, { action: '등수', payload: { teamId: 'B' } });
  coin.onAdmin(s, { action: '등수', payload: { teamId: 'B' } });      // 같은 팀을 두 번
  확인('같은 팀은 한 번만 들어간다', s.순위.join('') === 'B');
  coin.onAdmin(s, { action: '등수', payload: { teamId: 'C' } });
  coin.onAdmin(s, { action: '되돌리기' });
  확인('되돌리면 마지막 입력이 빠진다', s.순위.join('') === 'B' && coin.views(s).admin.남은팀.join('') === 'AC');
  coin.onAdmin(s, { action: '등수', payload: { teamId: 'A' } });
  coin.onAdmin(s, { action: '등수', payload: { teamId: 'C' } });
  const 점 = Object.fromEntries(coin.result(s).점수.map(x => [x.playerId, x.points]));
  확인('1등 팀원만 +5 · 2·3등은 0', 점.c === 5 && !점.a && !점.b && !점.e,
    `다온 ${점.c} · 가람 ${점.a} · 나래 ${점.b} · 마루 ${점.e}`);
}

// ── 뒷정리 ──────────────────────────────────────────────────
for (const id of 쓴판) 비밀지우기(id);
state.players = 원래.players;
state.scoreLog = 원래.scoreLog;
state.teams = 원래.teams;

console.log('\n' + '-'.repeat(54));
console.log(`  통과 ${통과} / 실패 ${실패}`);
console.log('-'.repeat(54) + '\n');
process.exit(실패 > 0 ? 1 : 0);
