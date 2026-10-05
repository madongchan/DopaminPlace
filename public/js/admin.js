// 진행자 화면 — PIN 로그인, 단계별 진행(입장 → 팀 → 게임), 세부 관리.
// 모든 조작은 서버로 보내고, 화면은 서버가 돌려준 뷰를 그린다.
import { 요소, 비우기, 순위막대, 팀사전, 팀색 } from '/js/components.js';

const socket = io();
const $ = (id) => document.getElementById(id);

let 뷰 = null;
let 로그인됨 = false;

// ── 로그인 ──────────────────────────────────────────────────
function 로그인시도(pin) {
  socket.emit('admin:login', { pin }, (r) => {
    if (!r?.ok) {
      $('err-login').textContent = r?.error || '들어가지 못했어요.';
      sessionStorage.removeItem('dopa.adminPin');
      return;
    }
    // 새로고침해도 다시 PIN을 치지 않도록 이 탭에만 기억한다.
    sessionStorage.setItem('dopa.adminPin', pin);
    로그인됨 = true;
    $('login').hidden = true;
    $('admin').hidden = false;
    그리기(r.view);
  });
}

$('btn-login').onclick = () => {
  $('err-login').textContent = '';
  로그인시도($('in-pin').value.trim());
};
$('in-pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-login').click(); });

socket.on('connect', () => {
  const 기억 = sessionStorage.getItem('dopa.adminPin');
  if (기억) 로그인시도(기억);       // 끊겼다 붙어도 자동으로 다시 들어간다
});

socket.on('adminView', (v) => { if (로그인됨) 그리기(v); });

// ── 서버로 조작 보내기 ──────────────────────────────────────
function 보내기(action, payload, 성공메시지, 그뒤) {
  socket.emit('admin', { action, payload }, (r) => {
    if (!r?.ok) return 알림(r?.error || '처리하지 못했어요.', true);
    if (r.token) return 알림(`${r.name}의 기기 연결을 초기화했습니다. 그 휴대폰에서 '이미 입장했는데…'를 눌러 이름+비밀번호로 들어오게 하세요.`);
    if (성공메시지) 알림(성공메시지);
    그뒤?.();
  });
}

let 알림타이머 = null;
function 알림(글, 나쁨 = false) {
  const el = $('toast');
  el.textContent = 글;
  el.classList.toggle('bad', 나쁨);
  el.hidden = false;
  clearTimeout(알림타이머);
  알림타이머 = setTimeout(() => { el.hidden = true; }, 5000);
}

// ── 버튼 ────────────────────────────────────────────────────
$('btn-random').onclick = () => {
  if (뷰?.teams?.some(t => t.members.length) && !confirm('이미 나뉜 팀을 흩어서 다시 배정합니다. 계속할까요?')) return;
  보내기('팀나누기_랜덤', {}, '팀을 랜덤으로 나눴습니다. 대표들 휴대폰에 이름·색 화면이 떴어요.', () => 단계로(2));
};
$('btn-pick').onclick = () => {
  if (!confirm('지금 팀을 모두 흩고, 참가자가 직접 고르게 합니다. 계속할까요?')) return;
  보내기('팀나누기_직접', {}, '참가자 휴대폰에 팀 고르기 화면이 떴습니다.', () => 단계로(2));
};
$('btn-close-pick').onclick = () => 보내기('팀고르기_마감', {}, '고르기를 마감했습니다. 이제 대표가 이름·색을 정합니다.');
$('btn-done').onclick = () => 보내기('팀편성_완료', {}, '팀 편성을 마쳤습니다.');
$('btn-reset').onclick = () => {
  if (!confirm('팀·이름·색을 모두 지웁니다. 되돌릴 수 없어요. 계속할까요?')) return;
  보내기('팀편성_초기화', {}, '팀 편성을 초기화했습니다.');
};
$('btn-recode').onclick = () => {
  if (!confirm('입장코드를 새로 만듭니다. 아직 안 들어온 사람은 새 코드를 써야 해요. 계속할까요?')) return;
  보내기('입장코드재발급', {}, '입장코드를 새로 발급했습니다.');
};
$('btn-refresh').onclick = () => {
  if (!confirm('참가자 휴대폰을 모두 새로고침합니다. 계속할까요?')) return;
  보내기('전체새로고침', {}, '새로고침 명령을 보냈습니다.');
};

// ── 그리기 ──────────────────────────────────────────────────
const 단계글 = { none: '아직 안 나눔', picking: '참가자가 고르는 중', naming: '대표가 이름·색 정하는 중', done: '편성 완료' };

function 그리기(v) {
  뷰 = v;
  $('code').textContent = v.joinCode;
  $('url').textContent = v.url;
  $('count').textContent = v.players.length;
  $('phase').textContent = 단계글[v.teamPhase] || '';

  단계그리기(v);
  시트상태그리기(v);
  참가자그리기(v);
  팀그리기(v);
  보드그리기(v);
  점수판그리기(v);
  게임그리기(v);
}

// ── 진행 단계 (① 입장 받기 → ② 팀 나누기 → ③ 게임 진행) ────
// 지금 단계는 서버 상태에서 유도한다. 진행자가 단계 버튼으로 옮긴 것만 이 탭에 기억한다.
function 유도단계(v) {
  if (v.current || v.teamPhase === 'done') return 3;
  if (v.teamPhase !== 'none') return 2;
  return 1;
}
function 지금단계(v) {
  if (v.current) return 3;                              // 게임 중에는 늘 게임 화면
  const 고른 = Number(sessionStorage.getItem('dopa.adminStep')) || 0;
  if (고른 === 3 && v.teamPhase !== 'done') return 유도단계(v);   // 팀이 없으면 게임 단계로 못 간다
  return 고른 || 유도단계(v);
}
function 단계로(n) {
  sessionStorage.setItem('dopa.adminStep', String(n));
  if (뷰) 그리기(뷰);
}
for (const b of document.querySelectorAll('[data-step]')) {
  b.onclick = () => 단계로(Number(b.dataset.step));
}
$('btn-next1').onclick = () => 단계로(2);

function 원클릭편성() {
  보내기('팀나누기_원클릭', {}, '팀을 나눴습니다. TV에 팀 소개가 떴어요.', () => 단계로(2));
}

function 단계그리기(v) {
  const 지금 = 지금단계(v), 유도 = 유도단계(v);
  for (const b of document.querySelectorAll('[data-step]')) {
    const n = Number(b.dataset.step);
    b.classList.toggle('on', n === 지금);
    b.classList.toggle('지남', n < 유도);
    b.disabled = !!v.current || (n === 3 && v.teamPhase !== 'done');
  }
  $('s1').hidden = 지금 !== 1;
  $('s2').hidden = 지금 !== 2;
  $('s3').hidden = 지금 !== 3;
  $('pane-score').hidden = 지금 !== 3;

  // ① 입장 받기
  $('s1-code').textContent = v.joinCode;
  $('s1-count').textContent = v.players.length;
  const 이름들 = 비우기($('s1-players'));
  for (const p of v.players) {
    이름들.appendChild(요소('span', { class: 'a-이름칩' + (p.connected ? '' : ' 끊김'), text: p.name }));
  }
  $('btn-next1').disabled = v.players.length === 0;

  // ② 팀 나누기
  const 주 = $('btn-s2-main'), 부 = $('btn-s2-sub');
  주.disabled = v.players.length === 0;
  부.hidden = true;
  if (v.teamPhase === 'picking') {
    $('s2-guide').textContent = '참가자들이 휴대폰에서 팀을 고르는 중입니다. 다 고르면 마감을 누르세요.';
    주.textContent = '고르기 마감';
    주.onclick = () => 보내기('팀고르기_마감', {}, '고르기를 마감했습니다. 이제 대표가 이름·색을 정합니다.');
  } else if (v.teamPhase === 'naming') {
    $('s2-guide').textContent = "팀 대표('대표' 표시)가 휴대폰에서 팀 이름과 색을 정하는 중입니다. 다 정했으면 완료를 누르세요.";
    주.textContent = '편성 완료';
    주.onclick = () => 보내기('팀편성_완료', {}, '팀 편성을 마쳤습니다.');
  } else if (v.teamPhase === 'done') {
    $('s2-guide').textContent = (v.bigScreen === 'teams' ? '팀이 정해졌습니다. TV에 팀 소개가 떠 있어요. ' : '팀이 정해졌습니다. ')
      + '각자 자기 팀을 확인하게 한 뒤 다음으로 넘어가세요. 팀 이름·색은 대표 휴대폰이나 아래 「고급」에서 바꿀 수 있어요.';
    주.textContent = '다음: 게임 고르기 →';
    주.onclick = () => {
      if (v.bigScreen === 'teams') 보내기('큰화면', { view: 'auto' });
      단계로(3);
    };
    부.hidden = false;
    부.onclick = () => {
      if (confirm('지금 팀을 흩고 다시 랜덤으로 나눕니다. 계속할까요?')) 원클릭편성();
    };
  } else {
    $('s2-guide').textContent = '버튼 하나로 세 팀으로 고르게 나눕니다. 팀 이름과 색은 자동으로 정해지고, 나중에 바꿀 수 있어요.';
    주.textContent = '팀 자동으로 나누기';
    주.onclick = 원클릭편성;
  }

  const 요약 = 비우기($('s2-teams'));
  요약.hidden = !v.teams.some(t => t.members.length);
  for (const t of v.teams) {
    요약.appendChild(요소('div', { class: 'tcard', style: { borderColor: t.color || 'var(--line)' } }, [
      요소('div', { class: 'hd' }, [
        요소('span', { class: 'tn', text: t.name || `${t.id}팀`, style: { color: t.color || '' } }),
        요소('span', { class: 'tc', text: `${t.members.length}명` })
      ]),
      요소('div', { class: 'a-이름들' }, t.members.map(m =>
        요소('span', { class: 'a-이름칩' + (m.connected ? '' : ' 끊김'), text: m.name + (t.leaderId === m.id ? ' (대표)' : '') })))
    ]));
  }
}

// ── 게임 보드 ───────────────────────────────────────────────
const 종류글 = { team: '팀전', solo: '개인전', offline: '오프라인' };

function 보드그리기(v) {
  const box = 비우기($('a-board'));
  const 진행중 = !!v.current;
  box.hidden = 진행중;                // 게임 중에는 보드를 접는다

  for (const b of v.board || []) {
    const 못함 = 진행중 || b.인원부족;
    box.appendChild(요소('button', {
      class: 'a-블록' + (b.인원부족 ? ' 부족' : ''),
      style: { borderColor: b.color },
      disabled: 못함,
      title: b.인원부족 ? `${b.minPlayers}명 이상 필요` : (진행중 ? '진행 중인 게임을 먼저 끝내세요' : ''),
      onclick: () => 보내기('게임고르기', { gameId: b.id }, `${b.name} 규칙 카드를 띄웠습니다.`)
    }, [
      요소('span', { class: 'a-블록이름', text: b.name, style: { color: b.color } }),
      요소('span', { class: 'a-블록메타', text: `${종류글[b.type] || b.type} · ${b.minutes}분 · ${b.playsCount}회` }),
      b.lastResult ? 요소('span', { class: 'a-블록결과', text: b.lastResult }) : null
    ]));
  }
  if (!(v.board || []).length) {
    box.appendChild(요소('div', { class: 'empty', text: '아직 만든 게임이 없습니다.' }));
  }
}

// ── 점수판 ──────────────────────────────────────────────────
function 점수판그리기(v) {
  const sb = v.scoreboard;
  const 팀 = 팀사전(v.teams);

  for (const b of document.querySelectorAll('[data-mode]')) {
    b.classList.toggle('on', b.dataset.mode === sb.mode);
  }
  for (const b of document.querySelectorAll('[data-big]')) {
    b.classList.toggle('on', b.dataset.big === (v.bigScreen || 'auto'));
  }

  const box = 비우기($('a-score'));
  box.appendChild(요소('div', { class: 'a-점수칸' }, [
    요소('h3', { text: '팀' }), 순위막대(sb.팀)
  ]));
  box.appendChild(요소('div', { class: 'a-점수칸' }, [
    요소('h3', { text: '개인' }),
    순위막대(sb.개인.map(p => ({ ...p, colorId: 팀[p.teamId]?.colorId })))
  ]));
}

// ── 진행 중인 게임 ──────────────────────────────────────────
let 게임모듈 = null, 게임모듈id = null;

async function 게임그리기(v) {
  const c = v.current;
  const body = 비우기($('game-body'));
  const btns = 비우기($('game-btns'));
  $('s3').classList.toggle('연습', !!c?.연습);
  if (!c) {
    $('game-title').textContent = '③ 게임 고르기';
    $('s3-guide').textContent = '할 게임을 누르세요. TV와 휴대폰에 규칙 카드가 뜹니다. (흐린 게임은 인원이 모자랍니다)';
    return;
  }

  $('game-title').textContent = `③ ${c.name} — ${c.phase === 'rules' ? '규칙 카드' : (c.연습 ? '연습 중' : '진행 중')}`;

  if (c.phase === 'rules') {
    $('s3-guide').textContent = '규칙을 읽어준 뒤 시작을 누르세요. 처음 하는 게임이면 연습으로 한 판 해보세요(점수가 남지 않습니다).';
    const ul = 요소('ul', { class: 'a-규칙' });
    for (const r of c.rules || []) ul.appendChild(요소('li', { text: r }));
    body.appendChild(ul);
    btns.appendChild(요소('button', { class: 'a-큰버튼', text: '시작', onclick: () => 보내기('게임시작', {}, '게임을 시작했습니다.') }));
    btns.appendChild(요소('button', {
      class: 'a-큰버튼 둘째', text: '연습으로 시작',
      onclick: () => 보내기('게임시작', { 옵션: { 연습: true } }, '연습 판을 시작했습니다. 점수는 남지 않아요.')
    }));
    btns.appendChild(요소('button', {
      class: 'ghost', text: '취소',
      onclick: () => { if (confirm('이 게임을 취소하고 보드로 돌아갑니다. 계속할까요?')) 보내기('게임취소', {}, '보드로 돌아갔습니다.'); }
    }));
    return;
  }

  $('s3-guide').textContent = c.연습
    ? '연습 판입니다. 점수와 플레이 횟수가 남지 않아요. 감을 잡았으면 연습을 끝내고, 같은 게임을 다시 골라 진짜로 시작하세요.'
    : '아래 버튼으로 게임을 진행하세요. 다 끝나면 「끝내고 점수 주기」를 눌러야 점수판에 반영됩니다.';

  // 게임별 진행 화면
  if (게임모듈id !== c.gameId) {
    게임모듈 = null; 게임모듈id = c.gameId;
    try { 게임모듈 = await import(`/games/${c.gameId}/admin.js`); }
    catch (err) { console.error('[게임 진행 화면 없음]', err); }
  }
  if (게임모듈?.그리기) {
    게임모듈.그리기(body, c, (action, payload) => 보내기('게임조작', { action, payload }), v);
  } else {
    body.appendChild(요소('div', { class: 'empty', text: '이 게임의 진행 화면이 아직 없습니다.' }));
  }

  if (c.연습) {
    // 서버가 연습 판은 어떤 경로로 끝내도 점수를 남기지 않는다.
    btns.appendChild(요소('button', {
      class: 'a-큰버튼 둘째', text: '연습 끝내기 → 보드로',
      onclick: () => 보내기('게임중단', {}, '연습을 끝냈습니다. 점수는 남지 않았어요.')
    }));
    return;
  }
  btns.appendChild(요소('button', {
    class: 'sm', text: '끝내고 점수 주기',
    onclick: () => { if (confirm('게임을 끝내고 점수를 반영합니다. 계속할까요?')) 보내기('게임끝내기', {}, '점수를 반영했습니다.'); }
  }));
  btns.appendChild(요소('button', {
    class: 'sm danger', text: '중단 (점수 없음)',
    onclick: () => { if (confirm('점수 없이 중단합니다. 되돌릴 수 없어요. 계속할까요?')) 보내기('게임중단', {}, '게임을 중단했습니다.'); }
  }));
}

function 참가자그리기(v) {
  const box = $('players');
  box.innerHTML = '';
  if (v.players.length === 0) {
    box.innerHTML = '<div class="empty">아직 아무도 안 들어왔어요.</div>';
    return;
  }
  for (const p of v.players) {
    const 팀 = v.teams.find(t => t.id === p.teamId);
    const row = document.createElement('div');
    row.className = 'prow' + (p.connected ? '' : ' off');
    row.innerHTML = `
      <span class="dot"></span>
      <span class="nm"></span>
      <span class="tm"></span>
      <span class="acts">
        <button class="xs ghost" data-a="rename">이름</button>
        <button class="xs ghost" data-a="link">기기연결</button>
        <button class="xs danger" data-a="kick">내보내기</button>
      </span>`;

    // 이름은 textContent로 넣는다 — 참가자가 적은 글이 HTML로 해석되지 않게.
    row.querySelector('.nm').textContent = p.name;
    const 칩 = row.querySelector('.tm');
    칩.textContent = 팀 ? (팀.name || `${팀.id}팀`) : '팀 없음';
    if (팀?.color) { 칩.style.borderColor = 팀.color; 칩.style.color = 팀.color; }

    row.querySelector('[data-a="rename"]').onclick = () => {
      const n = prompt(`${p.name} → 새 이름 (1~6자)`, p.name);
      if (n === null) return;
      보내기('이름변경', { playerId: p.id, name: n }, '이름을 바꿨습니다.');
    };
    row.querySelector('[data-a="link"]').onclick = () => {
      if (!confirm(`${p.name}의 기존 기기 연결을 끊고 새 기기로 연결합니다. 계속할까요?`)) return;
      보내기('기기연결', { playerId: p.id });
    };
    row.querySelector('[data-a="kick"]').onclick = () => {
      if (!confirm(`${p.name}을(를) 내보냅니다. 되돌릴 수 없어요. 계속할까요?`)) return;
      보내기('내보내기', { playerId: p.id }, `${p.name}을(를) 내보냈습니다.`);
    };
    box.appendChild(row);
  }
}

function 팀그리기(v) {
  const box = $('teams');
  box.innerHTML = '';
  for (const t of v.teams) {
    const card = document.createElement('div');
    card.className = 'tcard';
    card.style.borderColor = t.color || 'var(--line)';
    card.innerHTML = `
      <div class="hd">
        <span class="tn"></span>
        <span class="tc">${t.members.length}명</span>
      </div>
      <div class="mem"></div>
      <div class="rowbtns">
        <button class="xs ghost" data-a="tname">이름</button>
        <button class="xs ghost" data-a="tcolor">색</button>
      </div>`;

    const 제목 = card.querySelector('.tn');
    제목.textContent = t.name || `${t.id}팀`;
    if (t.color) 제목.style.color = t.color;

    const mem = card.querySelector('.mem');
    if (t.members.length === 0) {
      mem.innerHTML = '<div class="none">아직 없음</div>';
    } else {
      for (const m of t.members) {
        const el = document.createElement('div');
        el.className = 'm';
        el.innerHTML = `<span><span class="who"></span>${t.leaderId === m.id ? ' <span class="ld">대표</span>' : ''}</span><span class="mv"></span>`;
        el.querySelector('.who').textContent = m.name;
        // 다른 두 팀으로 옮기는 버튼
        for (const 목적지 of v.teams.filter(x => x.id !== t.id)) {
          const b = document.createElement('button');
          b.className = 'xs ghost';
          b.textContent = `→${목적지.id}`;
          b.onclick = () => 보내기('팀이동', { playerId: m.id, teamId: 목적지.id }, `${m.name} → ${목적지.name || 목적지.id}팀`);
          el.querySelector('.mv').appendChild(b);
        }
        mem.appendChild(el);
      }
    }

    card.querySelector('[data-a="tname"]').onclick = () => {
      const n = prompt(`${t.id}팀 이름 (최대 8자)`, t.name);
      if (n === null) return;
      보내기('팀설정', { teamId: t.id, name: n }, '팀 이름을 바꿨습니다.');
    };
    card.querySelector('[data-a="tcolor"]').onclick = () => {
      const 고를수있는 = v.palette.filter(c => !c.taken || c.id === t.colorId);
      const 목록 = 고를수있는.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      const 답 = prompt(`${t.id}팀 색을 고르세요 (번호 입력)\n\n${목록}`, '');
      if (답 === null) return;
      const c = 고를수있는[Number(답) - 1];
      if (!c) return 알림('없는 번호예요.', true);
      보내기('팀설정', { teamId: t.id, colorId: c.id }, `${t.id}팀 색을 ${c.name}(으)로 바꿨습니다.`);
    };

    box.appendChild(card);
  }
}


// ── 점수 기준 · TV 화면 · 되돌리기 ──────────────────────────
for (const b of document.querySelectorAll('[data-mode]')) {
  b.onclick = () => 보내기('점수기준', { mode: b.dataset.mode });
}
for (const b of document.querySelectorAll('[data-big]')) {
  b.onclick = () => 보내기('큰화면', { view: b.dataset.big });
}
$('btn-undo').onclick = () => {
  if (!confirm('마지막 점수 기록을 되돌립니다. 계속할까요?')) return;
  보내기('점수되돌리기', {}, '마지막 점수를 되돌렸습니다.');
};


// ── 구글시트 상태 (SPEC 6장 「시트 동기화 상태」) ───────────
function 시트상태그리기(v) {
  const el = $('a-sheet');
  const s = v.sheet;
  if (!s) { el.textContent = ''; return; }

  if (!s.켜짐) {
    el.textContent = '시트 안 씀 (로컬 저장만)';
    el.className = 'a-시트 꺼짐';
    return;
  }
  if (s.오류) {
    el.textContent = `시트 오류 · 대기 ${s.대기}줄 — ${s.오류}`;
    el.className = 'a-시트 나쁨';
    return;
  }
  // 구글 요청 수를 같이 보여준다. 한도(분당 300)에 한참 못 미친다는 걸 눈으로 확인하려고.
  const 요청 = s.요청수 != null ? ` · 구글 요청 ${s.요청수}회` : '';
  el.textContent = (s.대기 ? `시트 보내는 중 · 대기 ${s.대기}줄` : '시트 최신') + 요청;
  el.className = 'a-시트' + (s.대기 ? ' 대기' : ' 좋음');
  el.title = `이번 분 ${s.이번분}/${s.분당한도}회 (구글 한도는 분당 300회)`;
}

$('btn-sync').onclick = () => 보내기('지금동기화', {}, '시트로 지금 보냈습니다.');
