// 큰 화면 — 서버가 보낸 뷰를 그리기만 한다.

// 인트로(js/intro.js)는 screen.html에서 따로 싣는다.
// 모듈 스크립트는 서로 독립이라 인트로가 죽어도 이 파일은 계속 돈다.

import { 요소, 비우기, 순위막대, 팀사전, 팀색 } from '/js/components.js';

const socket = io();
const $ = (id) => document.getElementById(id);

// 상단 바 로고
for (const [id, 글] of [['brand1', '도파민'], ['brand2', '플레이션']]) {
  const el = $(id);
  el.textContent = '';
  for (const c of 글) {
    const sp = document.createElement('span');
    sp.className = 'ch';
    sp.textContent = c;
    el.appendChild(sp);
  }
}

// ── 서버 연결 ───────────────────────────────────────────────
socket.on('connect', () => {
  $('stat').textContent = '연결됨';
  socket.emit('screen:hello');
});

socket.on('disconnect', () => {
  $('stat').textContent = '서버 끊김 — 노트북을 확인하세요';
});

let 이전주소 = null;

socket.on('screen', (view) => {
  $('code').textContent = view.joinCode;
  $('url').textContent = view.url;
  if (view.qr) $('qr').src = view.qr;

  // 주소가 바뀌면(와이파이 변경·자리 이동) 크게 알린다.
  if (이전주소 && 이전주소 !== view.url) 알림(`접속 주소가 바뀌었습니다 · QR을 다시 찍어주세요`);
  이전주소 = view.url;

  화면고르기(view);

  const alt = view.대체주소 || [];
  $('alt').hidden = alt.length === 0;
  $('alt').innerHTML = alt.length
    ? '이 주소가 안 되면 → ' + alt.map(a => `${a.url}`).join(' / ')
    : '';

  // 팀이 나뉘면 대기실 대신 팀 카드를 보여준다.
  const 팀보임 = view.teamPhase === 'naming' || view.teamPhase === 'done'
    || (view.teams || []).some(t => t.members.length > 0);

  $('grid').hidden = 팀보임;
  $('teamview').hidden = !팀보임;

  if (팀보임) {
    $('lobby-title').innerHTML = view.teamPhase === 'done'
      ? '우리 팀'
      : '팀 편성 <span class="count">진행 중</span>';
    팀그리기(view.teams || []);
    $('empty').hidden = true;
  } else {
    $('lobby-title').innerHTML = `대기실 <span class="count" id="count">${(view.players||[]).length}</span>명`;
    대기실그리기(view.players || []);
    if (view.teamPhase === 'picking') {
      $('empty').hidden = false;
      $('empty').className = 'picking-note';
      $('empty').textContent = '각자 휴대폰에서 팀을 고르는 중입니다';
    } else {
      $('empty').className = 'empty';
      $('empty').textContent = '휴대폰으로 QR을 찍고 입장코드를 넣어주세요';
    }
  }
});

// ── 팀 카드 ─────────────────────────────────────────────────
function 팀그리기(teams) {
  const box = $('teamview');
  box.innerHTML = '';
  for (const t of teams) {
    const card = document.createElement('div');
    card.className = 'tv-card';
    if (t.color) card.style.borderColor = t.color;
    card.innerHTML = `
      <div class="hd">
        <div class="tn"></div>
        <div class="tc">${t.members.length}명</div>
      </div>
      <div class="mem"></div>`;

    const 제목 = card.querySelector('.tn');
    제목.textContent = t.name || `${t.id}팀`;
    if (t.color) 제목.style.color = t.color;

    const mem = card.querySelector('.mem');
    if (t.members.length === 0) {
      mem.innerHTML = '<div class="none">아직 없음</div>';
    } else {
      for (const m of t.members) {
        const el = document.createElement('div');
        el.className = 'm' + (m.connected ? '' : ' off');
        el.textContent = m.name;
        mem.appendChild(el);
      }
    }
    box.appendChild(card);
  }
}

let 알림타이머 = null;
function 알림(글) {
  const el = $('alert');
  el.textContent = 글;
  el.hidden = false;
  clearTimeout(알림타이머);
  알림타이머 = setTimeout(() => { el.hidden = true; }, 12000);
}

// ── 대기실 ──────────────────────────────────────────────────
function 대기실그리기(players) {
  $('count').textContent = players.length;
  $('empty').hidden = players.length > 0;

  const grid = $('grid');
  // 이미 있는 카드는 그대로 두고(애니메이션이 다시 돌지 않게) 바뀐 것만 손본다.
  const 기존 = new Map([...grid.children].map(el => [el.dataset.id, el]));

  for (const p of players) {
    let el = 기존.get(p.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'pcard';
      el.dataset.id = p.id;
      el.innerHTML = '<span class="dot"></span><span class="nm"></span>';
      grid.appendChild(el);
    }
    el.querySelector('.nm').textContent = p.name;
    el.classList.toggle('off', !p.connected);
    기존.delete(p.id);
  }
  // 목록에서 빠진 사람(진행자가 내보낸 경우) 제거
  for (const el of 기존.values()) el.remove();
}


// ══════════════════════════════════════════════════════════
// 어떤 화면을 보여줄지 (SPEC 3장)
//   대기실 → 보드 → 규칙 카드 → 게임 → 보드
//   진행자가 '점수판 크게'를 누르면 언제든 점수판
// ══════════════════════════════════════════════════════════
const 구역들 = ['view-lobby', 'view-board', 'view-rules', 'view-play', 'view-score'];

function 구역보이기(id) {
  for (const s of 구역들) $(s).hidden = (s !== id);
  // 입장 안내 문구는 대기실에서만
  $('foot').hidden = (id !== 'view-lobby');
  // 미니 점수판은 보드·게임에서만
  $('mini-score').hidden = !(id === 'view-board' || id === 'view-play');
}

let 지금게임 = null;        // 지금 그리고 있는 게임 화면 모듈
let 지금게임id = null;

async function 화면고르기(view) {
  const c = view.current;
  $('practice').hidden = !(c?.연습 && view.bigScreen !== 'scoreboard');

  if (view.bigScreen === 'scoreboard') {
    점수판그리기(view);
    return 구역보이기('view-score');
  }

  if (c?.phase === 'rules') {
    규칙카드그리기(c);
    return 구역보이기('view-rules');
  }

  if (c?.phase === 'playing') {
    미니점수(view);
    await 게임그리기(view, c);
    return 구역보이기('view-play');
  }

  // 게임이 없을 때: 팀 편성이 끝났으면 보드, 아니면 대기실
  // (진행자가 'TV: 팀'을 켜 두면 편성이 끝나도 팀 소개를 보여준다)
  if (view.teamPhase === 'done' && view.bigScreen !== 'teams') {
    보드그리기(view);
    미니점수(view);
    return 구역보이기('view-board');
  }
  구역보이기('view-lobby');
}

// ── 게임 보드 ───────────────────────────────────────────────
const 종류글 = { team: '팀전', solo: '개인전', offline: '오프라인' };

function 보드그리기(view) {
  const box = 비우기($('board-blocks'));
  for (const b of view.board || []) {
    box.appendChild(요소('div', {
      class: 'b-블록' + (b.인원부족 ? ' 부족' : '') + (b.playsCount ? ' 완료' : ''),
      style: { borderColor: b.color, '--gc': b.color }
    }, [
      요소('div', { class: 'b-뱃지들' }, [
        요소('span', { class: 'b-뱃지', text: 종류글[b.type] || b.type }),
        요소('span', { class: 'b-뱃지', text: `${b.minutes}분` })
      ]),
      요소('div', { class: 'b-이름', text: b.name, style: { color: b.color } }),
      요소('div', {
        class: 'b-상태',
        text: b.인원부족 ? `${b.minPlayers}명 이상 필요`
             : b.playsCount ? `완료 ${b.playsCount}회`
             : '대기'
      }),
      b.lastResult ? 요소('div', { class: 'b-결과', text: b.lastResult }) : null
    ]));
  }
  if (!(view.board || []).length) {
    box.appendChild(요소('div', { class: 'b-없음', text: '아직 만든 게임이 없습니다' }));
  }
}

// ── 규칙 카드 ───────────────────────────────────────────────
function 규칙카드그리기(c) {
  const box = 비우기($('rule-box'));
  box.style.borderColor = c.color;
  box.appendChild(요소('div', { class: 'rc-종류', text: 종류글[c.type] || c.type }));
  box.appendChild(요소('div', { class: 'rc-이름', text: c.name, style: { color: c.color } }));
  const ul = 요소('ul', { class: 'rc-규칙' });
  for (const r of c.rules || []) ul.appendChild(요소('li', { text: r }));
  box.appendChild(ul);
  box.appendChild(요소('div', { class: 'rc-대기', text: '진행자가 시작을 누르면 시작합니다' }));
}

// ── 게임 화면 (게임별 모듈을 불러와 그린다) ─────────────────
async function 게임그리기(view, c) {
  const el = $('view-play');
  if (지금게임id !== c.gameId) {
    지금게임 = null;
    지금게임id = c.gameId;
    try {
      지금게임 = await import(`/games/${c.gameId}/screen.js`);
    } catch (err) {
      console.error('[게임 화면을 못 불러왔습니다]', err);
      비우기(el).appendChild(요소('div', { class: 'b-없음', text: `${c.name} 화면을 불러오지 못했습니다` }));
      return;
    }
  }
  지금게임?.그리기?.(el, c, view);
}

// ── 점수판 ──────────────────────────────────────────────────
const 기준글 = { best: '최고', latest: '최근', total: '누적' };

function 점수판그리기(view) {
  const sb = view.scoreboard;
  $('sb-mode').textContent = `${기준글[sb.mode] || sb.mode} 기준`;
  const box = 비우기($('sb-body'));

  const 팀 = 팀사전(view.teams);
  box.appendChild(요소('div', { class: 'sb-칸' }, [
    요소('h3', { text: '팀' }),
    순위막대(sb.팀.map(t => ({ ...t, colorId: t.colorId })))
  ]));
  box.appendChild(요소('div', { class: 'sb-칸' }, [
    요소('h3', { text: '개인' }),
    순위막대(sb.개인.map(p => ({ ...p, colorId: 팀[p.teamId]?.colorId })))
  ]));
}

// ── 미니 팀 순위 (보드·게임 아래에 늘 보인다) ───────────────
function 미니점수(view) {
  const box = 비우기($('mini-score'));
  for (const t of (view.scoreboard?.팀 || []).slice(0, 3)) {
    box.appendChild(요소('div', { class: 'mini-칸' }, [
      요소('span', { class: 'mini-등수', text: `${t.rank}` }),
      요소('span', { class: 'mini-이름', text: t.name, style: { color: 팀색(t.colorId) } }),
      요소('span', { class: 'mini-점수', text: `${t.points}` })
    ]));
  }
}
