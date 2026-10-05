// 모든 게임이 함께 쓰는 화면 부품 (SPEC 4장 「공통 부품」)
// 한 번만 만들어 두고 게임별 화면에서 가져다 쓴다.

// ── 팀 팔레트 (SPEC 2장) ────────────────────────────────────
const 팔레트 = {
  pink: '#FF3D6E', orange: '#FF8A00', yellow: '#FFD400', green: '#22C55E',
  mint: '#14B8C4', blue: '#3B82F6', purple: '#8B5CF6', silver: '#A3A3A3'
};
export function 팀색(colorId) {
  return 팔레트[colorId] || 'var(--line-2)';
}

// 글자 색으로 쓸 때는 다르다. 색을 아직 안 정한 팀에 테두리용 어두운 색을 쓰면
// 글씨가 바탕에 묻혀 안 보인다. 그래서 글자에는 이쪽을 쓴다.
export function 팀글자색(colorId) {
  return 팔레트[colorId] || 'var(--text-dim)';
}

// ── 요소 만들기 ─────────────────────────────────────────────
// 글자는 항상 textContent로 넣는다 — 참가자가 적은 답이 HTML로 해석되지 않게.
export function 요소(태그, 속성 = {}, 자식 = []) {
  const el = document.createElement(태그);
  for (const [k, v] of Object.entries(속성)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(자식)) {
    if (c == null) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function 비우기(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ── 타이머 ──────────────────────────────────────────────────
// 서버는 끝나는 시각(endsAt)만 보내고, 남은 시간은 화면이 각자 센다 (SPEC 4장).
const 도는타이머 = new Map();     // el → intervalId

export function 타이머붙이기(el, endsAt, { 끝나면 } = {}) {
  타이머끄기(el);
  if (!endsAt) { el.textContent = ''; return; }

  const 그리기 = () => {
    const 남음 = Math.max(0, endsAt - Date.now());
    const 초 = Math.ceil(남음 / 1000);
    el.textContent = String(초);
    el.classList.toggle('급함', 초 <= 5 && 초 > 0);
    el.classList.toggle('끝', 초 === 0);
    if (남음 <= 0) { 타이머끄기(el); 끝나면?.(); }
  };
  그리기();
  도는타이머.set(el, setInterval(그리기, 200));
}

export function 타이머끄기(el) {
  const id = 도는타이머.get(el);
  if (id) { clearInterval(id); 도는타이머.delete(el); }
}

// 남은 시간을 띠로도 보여준다. CSS에서 --p (0~1) 를 쓴다.
export function 타이머띠(el, endsAt, 전체초) {
  타이머끄기(el);
  if (!endsAt) { el.style.setProperty('--p', '0'); return; }
  const 그리기 = () => {
    const 남음 = Math.max(0, endsAt - Date.now());
    el.style.setProperty('--p', String(Math.min(1, 남음 / (전체초 * 1000))));
    if (남음 <= 0) 타이머끄기(el);
  };
  그리기();
  도는타이머.set(el, setInterval(그리기, 100));
}

// ── 제출 카운터 ─────────────────────────────────────────────
// 현황: { A: { 낸사람: 2, 전체: 3 }, … }
export function 제출바(현황, 팀정보 = {}) {
  const wrap = 요소('div', { class: '제출바' });
  for (const [tid, c] of Object.entries(현황 || {})) {
    const t = 팀정보[tid] || {};
    const 다냄 = c.낸사람 >= c.전체;
    wrap.appendChild(요소('div', {
      class: '제출칸' + (다냄 ? ' 완료' : ''),
      style: { borderColor: 팀색(t.colorId) }
    }, [
      요소('span', { class: '제출팀', text: t.name || `${tid}팀`, style: { color: 팀색(t.colorId) } }),
      요소('span', { class: '제출수', text: `${c.낸사람}/${c.전체}` })
    ]));
  }
  return wrap;
}

// ── 순위 막대 ───────────────────────────────────────────────
// 목록: [{ name, points, colorId?, rank }]
export function 순위막대(목록, { 최대 = null, 단위 = '점' } = {}) {
  const wrap = 요소('div', { class: '순위막대' });
  const 최고 = 최대 ?? Math.max(1, ...목록.map(x => Math.abs(x.points)));
  for (const x of 목록) {
    const 비율 = Math.max(0, x.points) / 최고;
    wrap.appendChild(요소('div', { class: '순위줄' }, [
      요소('span', { class: '순위등수', text: String(x.rank ?? '') }),
      요소('span', { class: '순위이름', text: x.name }),
      요소('span', { class: '순위바' }, [
        요소('i', { style: { width: `${(비율 * 100).toFixed(1)}%`, background: 팀색(x.colorId) } })
      ]),
      요소('span', { class: '순위점수', text: `${x.points}${단위}` })
    ]));
  }
  return wrap;
}

// ── 플레이어 카드 그리드 ────────────────────────────────────
// 목록: [{ name, teamId, connected, 상태? }]  상태: 'ok' | 'out' | 'done'
export function 카드그리드(목록, { 팀정보 = {} } = {}) {
  const grid = 요소('div', { class: '카드그리드' });
  for (const p of 목록) {
    const t = 팀정보[p.teamId] || {};
    grid.appendChild(요소('div', {
      class: '인원카드' + (p.connected === false ? ' 끊김' : '') + (p.상태 ? ` ${p.상태}` : ''),
      style: p.teamId ? { borderColor: 팀색(t.colorId) } : {}
    }, [요소('span', { text: p.name })]));
  }
  return grid;
}

// ── 팀 정보를 id로 찾기 쉽게 ────────────────────────────────
export function 팀사전(teams = []) {
  return Object.fromEntries((teams || []).map(t => [t.id, t]));
}
