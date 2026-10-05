// 6단계 점검 — 마피아
//
//   node tools/smoke-6단계.mjs
//
// 서버를 켤 필요가 없다. 게임 모듈을 직접 불러서 규칙만 확인한다.
// (한 판이 25~30분이라 소켓으로 돌릴 수 없다. 시간을 앞으로 당겨서 본다)
//
// ★ 이 테스트에서 가장 중요한 것은 맨 앞의 「역할이 새지 않는가」다.
//   역할이 한 글자라도 화면 데이터에 섞이면 게임이 끝장난다.
//   그래서 뷰를 통째로 문자열로 만들어 역할 이름과 남의 id 를 찾아본다.
//
// data/state.json 은 건드리지 않는다(저장을 부르지 않는다).
// data/secret.json 에는 테스트 전용 판(테스트-…)만 쓰고 끝에 지운다.
import { state } from '../server/state.js';
import { 비밀읽기, 비밀쓰기, 비밀지우기 } from '../server/secret.js';
import mafia from '../server/games/mafia/index.js';

let 통과 = 0, 실패 = 0;
function 확인(라벨, 조건, 덧 = '') {
  if (조건) { 통과++; console.log(`  OK  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
  else { 실패++; console.log(`  !!  ${라벨}${덧 ? ' — ' + 덧 : ''}`); }
}

const 역할이름들 = ['마피아', '경찰', '의사', '군인', '시민'];
const 원래참가자 = state.players;
const 만든판 = [];
let 판번호 = 0;

function 판만들기(수 = 12) {
  state.players = {};
  const 팀들 = ['A', 'B', 'C'];
  for (let i = 0; i < 수; i++) {
    const id = `p${i + 1}`;
    state.players[id] = {
      id, name: `사람${i + 1}`, teamId: 팀들[i % 3], connected: true, joinedAt: 1000 + i
    };
  }
  판번호 += 1;
  const playId = `테스트-${Date.now()}-${판번호}`;
  만든판.push(playId);
  const s = mafia.create({ playId, players: state.players });
  const 비밀 = 비밀읽기(playId) || { 역할: {}, 마피아들: [] };
  return { s, playId, 역할: 비밀.역할, 마피아들: 비밀.마피아들 };
}

const 산사람 = (s) => s.명단.filter(pid => s.생존[pid]);
// 점수메모는 state 가 아니라 secret.json 에 있다(누가 경찰·의사인지 드러나기 때문).
const 점수메모 = (playId, pid) => (비밀읽기(playId)?.점수메모 || {})[pid] || {};
const 역할찾기 = (s, 역할, r) => s.명단.find(pid => 역할[pid] === r);

// 어떤 역할 이름이 글 안에 들어 있는지 찾아준다(없으면 빈 배열)
function 새어나온역할(글, 빼고 = []) {
  return 역할이름들.filter(r => !빼고.includes(r) && 글.includes(r));
}

// ══════════════════════════════════════════════════════════
console.log('\n[역할이 새지 않는가]  ← 이 게임에서 제일 중요');
{
  const { s, playId, 역할, 마피아들 } = 판만들기(12);
  const v = mafia.views(s);

  // ① gameState 에 역할이 없어야 한다 (state.json 으로 새면 끝장)
  const 샌것 = 새어나온역할(JSON.stringify(s));
  확인('역할이 gameState 에 없다 (state.json 으로 안 샌다)',
    샌것.length === 0, 샌것.length ? '샌 것: ' + 샌것.join(',') : '깨끗함');

  // ② 역할은 secret.json 에만
  확인('역할은 data/secret.json 에 저장된다', Object.keys(역할).length === 12);

  // ③ 큰 화면
  const 화면샌것 = 새어나온역할(JSON.stringify(v.screen));
  확인('큰 화면 데이터에 역할이 없다', 화면샌것.length === 0,
    화면샌것.length ? '샌 것: ' + 화면샌것.join(',') : '깨끗함');
  확인('큰 화면의 역할공개가 닫혀 있다', v.screen.역할공개 === null);

  // ④ 진행자도 참가자다 — 진행자 뷰에도 역할이 없다
  const 진행샌것 = 새어나온역할(JSON.stringify(v.admin));
  확인('진행자 데이터에도 역할이 없다', 진행샌것.length === 0,
    진행샌것.length ? '샌 것: ' + 진행샌것.join(',') : '깨끗함');

  // ⑤ 참가자 뷰 — 내 역할만
  const 시민 = 역할찾기(s, 역할, '시민');
  const 시민뷰 = mafia.views(s).player(시민);
  확인('내 역할은 내 화면에 온다', 시민뷰.내역할 === '시민', 시민뷰.내역할);

  const 시민글 = JSON.stringify(시민뷰);
  const 시민샌것 = 새어나온역할(시민글, ['시민']);
  확인('시민 화면에 다른 역할 이름이 없다', 시민샌것.length === 0,
    시민샌것.length ? '샌 것: ' + 시민샌것.join(',') : '깨끗함');
  // 참가자 id 자체는 원래 공개다(명단·고를 수 있는 사람에 다 들어간다).
  // 그러니 'id 가 보이냐'가 아니라 '마피아만 받는 칸이 있느냐'를 본다.
  확인('시민 화면에는 동료(마피아) 칸 자체가 없다', 시민뷰.내동료 === undefined);
  확인('시민 화면에 경찰·의사·군인 전용 칸이 없다',
    시민뷰.내조사 === undefined && 시민뷰.직전보호 === undefined
    && 시민뷰.방패남음 === undefined && 시민뷰.군인알림 === undefined);

  // 마피아 뷰에는 동료가 있어야 한다(규칙상 당연) — 대신 경찰·의사·군인은 몰라야 한다
  const 마피아뷰글 = JSON.stringify(mafia.views(s).player(마피아들[0]));
  const 마피아샌것 = 새어나온역할(마피아뷰글, ['마피아']);
  확인('마피아도 경찰·의사·군인이 누군지 모른다', 마피아샌것.length === 0,
    마피아샌것.length ? '샌 것: ' + 마피아샌것.join(',') : '깨끗함');

  // ⑥ 스포일러로만 전체 역할
  확인('진행자가 스포일러를 열면 전체 역할이 보인다',
    v.adminSecret.역할표.length === 12
    && v.adminSecret.역할표.every(x => 역할이름들.includes(x.역할)));

  비밀지우기(playId);
}

// ══════════════════════════════════════════════════════════
console.log('\n[역할 배정]');
{
  // 10~12명은 SPEC 5-5 표 그대로. 8~9명은 사람이 덜 와도 게임이 막히지 않게 같은 짜임으로 줄였다.
  // (대표님 결정 2026-10-05: 최소 8명, 최대 12명)
  for (const [인원, 마수] of [[12, 3], [11, 3], [10, 2], [9, 2], [8, 2]]) {
    const { playId, 역할 } = 판만들기(인원);
    const 센다 = (r) => Object.values(역할).filter(x => x === r).length;
    확인(`${인원}명 → 마피아 ${마수} · 경찰1 · 의사1 · 군인1`,
      센다('마피아') === 마수 && 센다('경찰') === 1 && 센다('의사') === 1 && 센다('군인') === 1,
      `마피아${센다('마피아')} 경찰${센다('경찰')} 의사${센다('의사')} 군인${센다('군인')} 시민${센다('시민')}`);
    확인(`${인원}명 전원에게 역할이 있다`, Object.keys(역할).length === 인원);
    // 시작하자마자 한쪽이 이겨 있으면 게임이 안 된다
    확인(`${인원}명으로 시작해도 바로 끝나지 않는다`,
      센다('마피아') < 인원 - 센다('마피아'),
      `마피아 ${센다('마피아')} vs 나머지 ${인원 - 센다('마피아')}`);
    비밀지우기(playId);
  }

  // 보드에 적히는 인원 범위
  확인('받을 수 있는 인원은 8~12명', mafia.minPlayers === 8 && mafia.maxPlayers === 12,
    `${mafia.minPlayers}~${mafia.maxPlayers}명`);

  let 서로다른팀 = 0;
  for (let i = 0; i < 20; i++) {
    const { playId, 마피아들 } = 판만들기(12);
    const 팀들 = new Set(마피아들.map(pid => state.players[pid].teamId));
    if (팀들.size === 마피아들.length) 서로다른팀 += 1;
    비밀지우기(playId);
  }
  확인('마피아는 서로 다른 팀에서 나온다', 서로다른팀 === 20, `20판 중 ${서로다른팀}판`);
}

// ══════════════════════════════════════════════════════════
console.log('\n[밤]');
{
  const { s, playId, 역할, 마피아들 } = 판만들기(12);
  const 경찰 = 역할찾기(s, 역할, '경찰');
  const 의사 = 역할찾기(s, 역할, '의사');
  const 시민들 = s.명단.filter(pid => 역할[pid] === '시민');

  확인('밤 60초로 시작한다',
    s.phase === '밤' && Math.round((s.endsAt - Date.now()) / 1000) === 60,
    `${Math.round((s.endsAt - Date.now()) / 1000)}초`);

  mafia.onInput(s, 마피아들[0], { act: '지목', target: 시민들[0] });
  const 동료뷰 = mafia.views(s).player(마피아들[1]);
  확인('마피아는 동료를 안다', 동료뷰.내동료.length === 마피아들.length - 1,
    동료뷰.내동료.map(x => x.name).join(', '));
  확인('동료가 찍은 대상이 실시간으로 보인다',
    동료뷰.내동료.some(x => x.지목 === state.players[시민들[0]].name),
    동료뷰.내동료.map(x => `${x.name}→${x.지목 || '-'}`).join(' '));
  확인('시민에게는 동료 정보 자체가 없다',
    mafia.views(s).player(시민들[1]).내동료 === undefined);

  mafia.onInput(s, 시민들[1], { act: '지목', target: 시민들[1] });
  확인('자기 자신은 못 고른다', !s.밤지목[시민들[1]]);

  mafia.onInput(s, 경찰, { act: '지목', target: 마피아들[0] });
  mafia.onInput(s, 의사, { act: '지목', target: 시민들[0] });
  for (const m of 마피아들) mafia.onInput(s, m, { act: '지목', target: 시민들[0] });

  mafia.onTick(s, s.endsAt + 1);
  확인('밤이 끝나면 아침이 된다', s.phase === '아침', s.phase);
  확인('의사가 막으면 아무도 안 죽는다',
    s.아침소식.죽은사람 === null && s.아침소식.아무일없음 === true,
    JSON.stringify(s.아침소식));
  확인('의사가 막은 횟수가 쌓인다', 점수메모(playId, 의사).의사막음 === 1);
  확인('경찰이 마피아를 찾은 것이 기록된다', 점수메모(playId, 경찰).경찰적중 === 1);

  const 경찰뷰 = mafia.views(s).player(경찰);
  확인('경찰은 자기 조사 결과만 본다',
    경찰뷰.내조사.length === 1 && 경찰뷰.내조사[0].마피아냐 === true,
    JSON.stringify(경찰뷰.내조사[0]));
  확인('조사 결과는 남의 화면에 없다',
    mafia.views(s).player(시민들[0]).내조사 === undefined);

  // 의사 연속 보호 금지
  s.phase = '밤';
  mafia.onInput(s, 의사, { act: '지목', target: 시민들[0] });
  확인('의사는 직전에 지킨 사람을 또 못 고른다', !s.밤지목[의사]);
  mafia.onInput(s, 의사, { act: '지목', target: 시민들[1] });
  확인('다른 사람은 고를 수 있다', s.밤지목[의사] === 시민들[1]);

  비밀지우기(playId);
}

// ══════════════════════════════════════════════════════════
console.log('\n[군인]');
{
  const { s, playId, 역할, 마피아들 } = 판만들기(12);
  const 군인 = 역할찾기(s, 역할, '군인');

  for (const m of 마피아들) mafia.onInput(s, m, { act: '지목', target: 군인 });
  mafia.onTick(s, s.endsAt + 1);
  확인('군인은 첫 공격을 버틴다', s.생존[군인] === true);
  확인('버틴 것도 「아무 일 없었습니다」로만 나온다',
    s.아침소식.죽은사람 === null && s.아침소식.아무일없음 === true);
  확인('군인 본인에게만 알림이 간다',
    mafia.views(s).player(군인).군인알림 === 1
    && mafia.views(s).screen.군인알림 === undefined);

  s.phase = '밤';
  s.endsAt = Date.now() + 1000;
  s.밤지목 = {};
  for (const m of 마피아들) mafia.onInput(s, m, { act: '지목', target: 군인 });
  mafia.onTick(s, s.endsAt + 1);
  확인('두 번째 공격에는 당한다', s.생존[군인] === false);

  비밀지우기(playId);
}

// ══════════════════════════════════════════════════════════
console.log('\n[낮 — 지목 투표와 처형]');
{
  const { s, playId, 마피아들 } = 판만들기(12);

  s.phase = '토론';
  mafia.onAdmin(s, { action: '다음단계' });
  확인('토론이 끝나면 지목 투표', s.phase === '지목투표', s.phase);

  for (const pid of s.명단.slice(0, 5)) {
    if (pid !== 마피아들[0]) mafia.onInput(s, pid, { act: '지목투표', target: 마피아들[0] });
  }
  const 투표중 = mafia.views(s);
  확인('투표 중에는 득표가 안 보인다', 투표중.screen.득표 === null);
  확인('몇 명이 냈는지만 보인다', 투표중.screen.투표현황.낸사람 > 0,
    JSON.stringify(투표중.screen.투표현황));
  // 누가 누구를 찍었는지(지목표)는 어떤 뷰에도 실리지 않는다
  확인('누가 누구를 찍었는지는 어떤 뷰에도 없다',
    !('지목표' in 투표중.screen) && !('지목표' in 투표중.admin)
    && 투표중.player(s.명단[0]).지목표 === undefined);

  for (const pid of 산사람(s)) {
    if (s.지목표[pid]) continue;
    // 지목당한 본인은 자기를 못 찍으니 기권한다. 그래야 '전원'이 채워진다.
    if (pid === 마피아들[0]) mafia.onInput(s, pid, { act: '지목투표', target: '기권' });
    else mafia.onInput(s, pid, { act: '지목투표', target: 마피아들[0] });
  }
  확인('전원이 투표하면 바로 최후 변론으로',
    s.phase === '최후변론' && s.최다득표 === 마피아들[0], s.phase);

  mafia.onAdmin(s, { action: '다음단계' });
  확인('최후 변론 뒤 찬반 투표', s.phase === '찬반투표', s.phase);

  mafia.onInput(s, 마피아들[0], { act: '찬반', 값: '반대' });
  확인('변론 당사자는 찬반에 못 낸다', !s.찬반[마피아들[0]]);

  const 투표자 = 산사람(s).filter(pid => pid !== 마피아들[0]);
  for (const pid of 투표자) mafia.onInput(s, pid, { act: '찬반', 값: '찬성' });
  확인('과반 찬성이면 처형된다', s.생존[마피아들[0]] === false);
  확인('처형된 마피아에 찬성한 사람에게 +1 기록',
    투표자.every(pid => 점수메모(playId, pid).찬성적중 === 1));
  확인('처형 결과가 화면에 나온다',
    mafia.views(s).screen.처형소식?.처형 === true,
    JSON.stringify(mafia.views(s).screen.처형소식));

  비밀지우기(playId);
}

// ══════════════════════════════════════════════════════════
console.log('\n[과반이 안 되면]');
{
  const { s, playId } = 판만들기(12);
  const 대상 = s.명단[0];
  s.phase = '찬반투표';
  s.endsAt = Date.now() + 1000;
  s.최다득표 = 대상;
  const 투표자 = 산사람(s).filter(pid => pid !== 대상);
  투표자.slice(0, 3).forEach(pid => mafia.onInput(s, pid, { act: '찬반', 값: '찬성' }));
  투표자.slice(3).forEach(pid => mafia.onInput(s, pid, { act: '찬반', 값: '반대' }));
  확인('과반이 안 되면 처형하지 않는다', s.생존[대상] === true);
  확인('처형 없이 다음 밤으로', s.phase === '밤' && s.day === 2, `${s.phase} ${s.day}일차`);
  비밀지우기(playId);
}

// ══════════════════════════════════════════════════════════
console.log('\n[동률 — 재투표 1회]');
{
  const { s, playId } = 판만들기(12);
  const [a, b, ...나머지] = s.명단;

  s.phase = '지목투표';
  s.endsAt = Date.now() + 1000;
  mafia.onInput(s, 나머지[0], { act: '지목투표', target: a });
  mafia.onInput(s, 나머지[1], { act: '지목투표', target: b });
  mafia.onTick(s, s.endsAt + 1);
  확인('동률이면 다시 투표한다', s.phase === '지목투표' && s.재투표 === true);
  확인('재투표 때 표가 비워진다', Object.keys(s.지목표).length === 0);

  s.endsAt = Date.now() + 1000;
  mafia.onInput(s, 나머지[0], { act: '지목투표', target: a });
  mafia.onInput(s, 나머지[1], { act: '지목투표', target: b });
  mafia.onTick(s, s.endsAt + 1);
  확인('또 동률이면 처형 없이 밤으로', s.phase === '밤' && s.day === 2, `${s.phase} ${s.day}일차`);

  비밀지우기(playId);
}

// ══════════════════════════════════════════════════════════
console.log('\n[승패]');
{
  const 가 = 판만들기(12);
  for (const m of 가.마피아들) 가.s.생존[m] = false;
  가.s.phase = '지목투표';
  가.s.endsAt = Date.now() + 1000;
  가.s.지목표 = {};
  mafia.onTick(가.s, 가.s.endsAt + 1);
  확인('마피아가 0명이면 시민 승', 가.s.결과 === '시민승', 가.s.결과);
  확인('끝나야 비로소 역할이 공개된다',
    mafia.views(가.s).screen.역할공개?.length === 12);
  비밀지우기(가.playId);

  const 나 = 판만들기(12);
  const 시민쪽 = 나.s.명단.filter(pid => !나.마피아들.includes(pid));
  for (const pid of 시민쪽.slice(0, 시민쪽.length - 나.마피아들.length)) 나.s.생존[pid] = false;
  나.s.phase = '지목투표';
  나.s.endsAt = Date.now() + 1000;
  나.s.지목표 = {};
  mafia.onTick(나.s, 나.s.endsAt + 1);
  확인('마피아 수가 나머지와 같아지면 마피아 승', 나.s.결과 === '마피아승', 나.s.결과);
  비밀지우기(나.playId);

  const 다 = 판만들기(12);
  다.s.day = 6;
  다.s.phase = '지목투표';
  다.s.endsAt = Date.now() + 1000;
  다.s.지목표 = {};
  mafia.onTick(다.s, 다.s.endsAt + 1);
  확인('6일차가 끝나면 마피아 승', 다.s.결과 === '마피아승', `${다.s.day}일차 → ${다.s.결과}`);
  비밀지우기(다.playId);
}

// ══════════════════════════════════════════════════════════
console.log('\n[유령]');
{
  const { s, playId, 역할, 마피아들 } = 판만들기(12);
  const 시민 = 역할찾기(s, 역할, '시민');
  s.생존[시민] = false;

  const 유령뷰 = mafia.views(s).player(시민);
  확인('유령인 것이 본인 화면에 표시된다', 유령뷰.유령인가 === true);
  const 유령샌것 = 새어나온역할(JSON.stringify(유령뷰), ['시민']);
  확인('유령에게도 남의 역할은 안 보인다',
    유령뷰.역할공개 === null && 유령샌것.length === 0,
    유령샌것.length ? '샌 것: ' + 유령샌것.join(',') : '깨끗함');

  s.phase = '밤';
  mafia.onInput(s, 시민, { act: '지목', target: 마피아들[0] });
  확인('유령의 예측이 기록된다', s.유령예측[시민]?.[0] === 마피아들[0]);
  확인('유령 예측은 밤지목에 섞이지 않는다', !s.밤지목[시민]);

  s.결과 = '시민승';
  const 유령점 = mafia.result(s).점수.filter(x => x.playerId === 시민 && x.reason.includes('유령'));
  확인('맞힌 마피아 수만큼 점수', 유령점[0]?.points === 1, JSON.stringify(유령점[0]));

  비밀지우기(playId);
}

// ══════════════════════════════════════════════════════════
console.log('\n[점수]');
{
  // 메모를 직접 꽂으면 모듈이 들고 있는 것과 어긋난다.
  // 실제로 두 밤을 돌려서 경찰 적중 2회·의사 방어 2회를 쌓는다.
  const { s, playId, 역할, 마피아들 } = 판만들기(12);
  const 경찰 = 역할찾기(s, 역할, '경찰');
  const 의사 = 역할찾기(s, 역할, '의사');
  const 시민들 = s.명단.filter(pid => 역할[pid] === '시민');

  for (const [밤번호, 지킬사람] of [[1, 시민들[0]], [2, 시민들[1]]]) {
    s.phase = '밤';
    s.endsAt = Date.now() + 1000;
    s.밤지목 = {};
    mafia.onInput(s, 경찰, { act: '지목', target: 마피아들[밤번호 - 1] });
    mafia.onInput(s, 의사, { act: '지목', target: 지킬사람 });
    for (const m of 마피아들) mafia.onInput(s, m, { act: '지목', target: 지킬사람 });
    mafia.onTick(s, s.endsAt + 1);
  }
  확인('두 밤 모두 의사가 막아 아무도 안 죽었다',
    산사람(s).length === 12, `${산사람(s).length}명 생존`);
  확인('경찰 적중 2회가 쌓였다', 점수메모(playId, 경찰).경찰적중 === 2,
    `${점수메모(playId, 경찰).경찰적중}회`);
  확인('의사 방어 2회가 쌓였다', 점수메모(playId, 의사).의사막음 === 2,
    `${점수메모(playId, 의사).의사막음}회`);

  s.결과 = '시민승';
  s.생존[마피아들[0]] = false;
  const r = mafia.result(s);
  const 합 = (pid) => r.점수.filter(x => x.playerId === pid).reduce((a, b) => a + b.points, 0);

  확인('이긴 쪽 +4', r.점수.some(x => x.playerId === 경찰 && x.points === 4));
  확인('진 쪽에는 승리 점수가 없다',
    !r.점수.some(x => x.playerId === 마피아들[0] && x.reason.includes('승리')));
  확인('경찰이 마피아를 찾으면 회당 +1',
    r.점수.some(x => x.playerId === 경찰 && x.points === 2 && x.reason.includes('경찰')));
  확인('의사가 막으면 회당 +2',
    r.점수.some(x => x.playerId === 의사 && x.points === 4 && x.reason.includes('의사')));
  확인('끝까지 생존 +1',
    r.점수.some(x => x.playerId === 경찰 && x.points === 1 && x.reason.includes('생존')));
  확인('죽은 사람에게는 생존 점수가 없다',
    !r.점수.some(x => x.playerId === 마피아들[0] && x.reason.includes('생존')));
  확인('경찰 합계 = 승리4 + 생존1 + 경찰적중2 = 7', 합(경찰) === 7, `${합(경찰)}점`);
  확인('의사 합계 = 승리4 + 생존1 + 방어4 = 9', 합(의사) === 9, `${합(의사)}점`);
  확인('요약에 마피아 명단이 들어간다 (끝난 뒤라 시트에 적어도 된다)',
    r.요약.마피아.length === 마피아들.length, r.요약.마피아.join(', '));

  비밀지우기(playId);
}

// ══════════════════════════════════════════════════════════
console.log('\n[진행자 조작]');
{
  const { s, playId } = 판만들기(12);
  const 남은 = s.endsAt - Date.now();
  mafia.onAdmin(s, { action: '일시정지' });
  확인('일시정지하면 타이머가 멈춘다', s.일시정지 === true && s.endsAt === null);
  확인('남은 시간이 보관된다', Math.abs(s.남은시간 - 남은) < 300, `${s.남은시간}ms`);

  mafia.onInput(s, s.명단[0], { act: '지목', target: s.명단[1] });
  확인('멈춰 있는 동안에는 입력을 안 받는다', !s.밤지목[s.명단[0]]);

  mafia.onAdmin(s, { action: '재개' });
  확인('재개하면 타이머가 다시 돈다', s.일시정지 === false && s.endsAt > Date.now());

  mafia.onAdmin(s, { action: '다음단계' });
  확인('강제로 다음 단계로 넘길 수 있다', s.phase === '아침', s.phase);

  비밀지우기(playId);
}

// ══════════════════════════════════════════════════════════
for (const id of 만든판) 비밀지우기(id);
// 중간에 죽은 실행이 남겼을 수 있는 테스트용 비밀까지 전부 치운다
try {
  const fs = await import('node:fs');
  const 비밀파일 = new URL('../data/secret.json', import.meta.url);
  if (fs.existsSync(비밀파일)) {
    const 전부 = JSON.parse(fs.readFileSync(비밀파일, 'utf8')) || {};
    for (const 키 of Object.keys(전부)) if (키.startsWith('테스트-')) 비밀지우기(키);
  }
} catch { /* 못 지워도 테스트 결과에는 영향 없다 */ }
state.players = 원래참가자;
console.log(`\n  통과 ${통과} / 실패 ${실패}\n`);
process.exit(실패 ? 1 : 0);
