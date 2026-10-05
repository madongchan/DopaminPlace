// 참가자 휴대폰 — 입장, 복귀, 팀 편성.
// 화면은 서버가 보낸 뷰(view)를 그리기만 한다.
import { 요소, 비우기 } from '/js/components.js';

const socket = io();
const $ = (id) => document.getElementById(id);

const 저장키 = 'dopa.token';
let 입력 = { code: '', name: '', pin: '' };
let 뷰 = null;

// ── 단계 전환 ───────────────────────────────────────────────
const 단계들 = ['step-code', 'step-recover', 'step-name', 'step-pin', 'step-done', 'step-pick', 'step-team', 'step-rules', 'step-game'];
function 단계보이기(id) {
  for (const s of 단계들) $(s).hidden = (s !== id);
  const 첫입력 = $(id).querySelector('input');
  if (첫입력) setTimeout(() => 첫입력.focus(), 60);
}
function 오류(id, 글) { $(id).textContent = 글 || ''; }

// ── 연결 상태 ───────────────────────────────────────────────
socket.on('connect', () => {
  $('net').textContent = '연결됨';
  $('net').classList.remove('off');
  const token = localStorage.getItem(저장키);
  if (token) {
    socket.emit('resume', { token }, (r) => {
      if (r?.ok) 뷰적용(r.view);
      else if (r?.재입력) localStorage.removeItem(저장키);   // 서버 데이터가 지워진 경우
    });
  }
});

socket.on('disconnect', () => {
  $('net').textContent = '연결이 끊겼어요 — 자동으로 다시 붙습니다';
  $('net').classList.add('off');
});

socket.on('view', (v) => 뷰적용(v));
socket.on('새로고침', () => location.reload());
socket.on('내보내짐', () => {
  localStorage.removeItem(저장키);
  alert('진행자가 내보냈습니다. 다시 입장해주세요.');
  location.reload();
});

// ══════════════════════════════════════════════════════════
// 서버 뷰를 화면에 반영 — 재접속하면 이 함수 하나로 원래 화면으로 돌아온다.
// ══════════════════════════════════════════════════════════
function 뷰적용(v) {
  뷰 = v;
  localStorage.setItem(저장키, v.me.token);
  $('my-name').textContent = v.me.name;

  // 내 팀 표시
  const mt = $('my-team');
  if (v.내팀) {
    mt.hidden = false;
    mt.textContent = v.내팀.name ? `${v.내팀.name} 팀` : `${v.내팀.id}팀`;
    mt.style.borderColor = v.내팀.color || 'var(--line)';
    mt.style.color = v.내팀.color || 'var(--text)';
  } else {
    mt.hidden = true;
  }

  $('practice').hidden = !v.current?.연습;

  // 게임이 먼저다 — 규칙 카드 → 진행
  if (v.current) 팀편집중 = false;
  if (v.current?.phase === 'rules') { 규칙카드(v.current); return 단계보이기('step-rules'); }
  if (v.current?.phase === 'playing') { 게임화면(v.current); return 단계보이기('step-game'); }

  // 지금 보여줄 화면 고르기
  if (v.teamPhase === 'picking') {
    팀고르기그리기();
    return 단계보이기('step-pick');
  }
  if (v.대표인가 && (팀편집중 || (v.teamPhase === 'naming' && !(v.내팀?.name && v.내팀?.colorId)))) {
    팔레트그리기();
    if ($('step-team').hidden) 단계보이기('step-team');
    return;
  }

  // 지금 무엇을 기다리는 중인지 한 줄로 알려준다.
  $('wait-msg').textContent =
    v.teamPhase === 'naming' ? '팀 대표가 이름과 색을 정하는 중이에요. 잠시만 기다려주세요'
    : v.teamPhase === 'done' ? '진행자가 다음 게임을 고르는 중이에요. TV를 봐주세요'
    : '다 모이면 팀을 나눕니다. 화면을 켜둔 채 기다려주세요';
  // 팀 대표는 편성이 끝난 뒤에도 이름·색을 바꿀 수 있다.
  $('btn-team-edit').hidden = !(v.대표인가 && v.teamPhase === 'done');
  단계보이기('step-done');
}

let 팀편집중 = false;
$('btn-team-edit').onclick = () => { 팀편집중 = true; 뷰적용(뷰); };

// ── 팀 고르기 ───────────────────────────────────────────────
function 팀고르기그리기() {
  const box = $('teampick');
  box.innerHTML = '';
  const 최소 = Math.min(...뷰.팀현황.map(t => t.인원));
  for (const t of 뷰.팀현황) {
    const 내팀인가 = 뷰.내팀?.id === t.id;
    const 꽉참 = !내팀인가 && (t.인원 + 1 - 최소 > 1);
    const b = document.createElement('button');
    b.className = 'tbtn' + (내팀인가 ? ' mine' : '') + (꽉참 ? ' full' : '');
    b.innerHTML = `<span>${t.name || t.id + '팀'}</span><span class="cnt">${t.인원}명${내팀인가 ? ' · 내 팀' : ''}</span>`;
    b.disabled = 꽉참;
    b.onclick = () => socket.emit('team:pick', { teamId: t.id }, (r) => {
      오류('err-pick', r?.ok ? '' : (r?.error || '팀을 고르지 못했어요.'));
    });
    box.appendChild(b);
  }
}

// ── 팀 이름·색 정하기 ───────────────────────────────────────
let 고른색 = null;
function 팔레트그리기() {
  // 이미 이 화면을 보고 있으면 적던 이름·고른 색을 지우지 않는다(남이 바꿀 때마다 뷰가 다시 온다).
  if ($('step-team').hidden) {
    고른색 = 뷰.내팀?.colorId || null;
    $('in-team').value = 뷰.내팀?.name || '';
  }
  const box = $('palette');
  box.innerHTML = '';
  for (const c of 뷰.palette) {
    const 남이씀 = c.taken && c.id !== 뷰.내팀?.colorId;
    const b = document.createElement('button');
    b.className = 'sw' + (남이씀 ? ' taken' : '') + (고른색 === c.id ? ' on' : '');
    b.style.setProperty('--c', c.hex);
    b.dataset.nm = c.name;
    b.disabled = 남이씀;
    b.onclick = () => {
      고른색 = c.id;
      [...box.children].forEach(el => el.classList.remove('on'));
      b.classList.add('on');
    };
    box.appendChild(b);
  }
}

$('btn-team').onclick = () => {
  const name = $('in-team').value.trim();
  if (!name) return 오류('err-team', '팀 이름을 적어주세요.');
  if (!고른색) return 오류('err-team', '색을 하나 골라주세요.');
  오류('err-team', '');
  socket.emit('team:set', { name, colorId: 고른색 }, (r) => {
    if (!r?.ok) return 오류('err-team', r?.error || '저장하지 못했어요.');
    팀편집중 = false;
    뷰적용(뷰);
  });
};

// ── 1. 입장코드 ─────────────────────────────────────────────
$('btn-code').onclick = () => {
  const v = $('in-code').value.trim();
  if (!/^\d{4}$/.test(v)) return 오류('err-code', '숫자 4자리를 넣어주세요.');
  오류('err-code', '');
  입력.code = v;
  단계보이기('step-name');
};
$('btn-to-recover').onclick = () => 단계보이기('step-recover');
$('btn-back-recover').onclick = () => 단계보이기('step-code');

// ── 1-b. 이름+PIN 복귀 ──────────────────────────────────────
$('btn-recover').onclick = () => {
  const name = $('in-rname').value.trim();
  const pin = $('in-rpin').value.trim();
  if (!name) return 오류('err-recover', '이름을 적어주세요.');
  if (!/^\d{4}$/.test(pin)) return 오류('err-recover', '비밀번호 4자리를 넣어주세요.');
  오류('err-recover', '');
  $('btn-recover').disabled = true;
  socket.emit('resume', { name, pin }, (r) => {
    $('btn-recover').disabled = false;
    if (!r?.ok) return 오류('err-recover', r?.error || '돌아오지 못했어요.');
    뷰적용(r.view);
  });
};

// ── 2. 이름 ─────────────────────────────────────────────────
$('btn-name').onclick = () => {
  const v = $('in-name').value.trim();
  if (v.length < 1) return 오류('err-name', '이름을 적어주세요.');
  if (v.length > 6) return 오류('err-name', '6자까지만 됩니다.');
  오류('err-name', '');
  입력.name = v;
  단계보이기('step-pin');
};
$('btn-back-name').onclick = () => 단계보이기('step-code');

// ── 3. PIN → 입장 ───────────────────────────────────────────
$('btn-pin').onclick = () => {
  const v = $('in-pin').value.trim();
  if (!/^\d{4}$/.test(v)) return 오류('err-pin', '숫자 4자리를 넣어주세요.');
  오류('err-pin', '');
  입력.pin = v;

  $('btn-pin').disabled = true;
  socket.emit('join', 입력, (r) => {
    $('btn-pin').disabled = false;
    if (!r?.ok) {
      오류('err-pin', r?.error || '입장하지 못했어요. 다시 해보세요.');
      if (/입장코드/.test(r?.error || '')) { 오류('err-code', r.error); 단계보이기('step-code'); }
      else if (/이름/.test(r?.error || '')) { 오류('err-name', r.error); 단계보이기('step-name'); }
      return;
    }
    뷰적용(r.view);
  });
};
$('btn-back-pin').onclick = () => 단계보이기('step-name');

// 엔터로 다음 단계
for (const [inputId, btnId] of [
  ['in-code', 'btn-code'], ['in-name', 'btn-name'], ['in-pin', 'btn-pin'],
  ['in-rname', 'btn-recover'], ['in-rpin', 'btn-recover'], ['in-team', 'btn-team']
]) {
  $(inputId).addEventListener('keydown', (e) => { if (e.key === 'Enter') $(btnId).click(); });
}


// ── 규칙 카드 ───────────────────────────────────────────────
function 규칙카드(c) {
  const box = 비우기($('p-rule-box'));
  box.style.borderColor = c.color;
  box.appendChild(요소('div', { class: 'p-규칙이름', text: c.name, style: { color: c.color } }));
  const ul = 요소('ul', { class: 'p-규칙들' });
  for (const r of c.rules || []) ul.appendChild(요소('li', { text: r }));
  box.appendChild(ul);
  box.appendChild(요소('div', { class: 'wait', text: '진행자가 규칙을 설명하는 중이에요. 곧 시작합니다' }));
}

// ── 게임 화면 (게임별 모듈) ─────────────────────────────────
let 게임모듈 = null, 게임모듈id = null;

async function 게임화면(c) {
  const el = $('step-game');
  if (게임모듈id !== c.gameId) {
    게임모듈 = null; 게임모듈id = c.gameId;
    try { 게임모듈 = await import(`/games/${c.gameId}/player.js`); }
    catch (err) { console.error('[게임 화면 없음]', err); }
  }
  if (!게임모듈?.그리기) {
    비우기(el).appendChild(요소('div', { class: 'wait', text: 'TV 화면을 봐주세요' }));
    return;
  }
  게임모듈.그리기(el, c, (payload) => {
    socket.emit('input', { gameId: c.gameId, playId: c.playId, payload });
  });
}
