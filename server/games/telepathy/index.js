// 텔레파시 (팀전, 10분) — SPEC 5-1
//
// 5라운드. 제시어를 보고 20초 안에 각자 한 단어를 쓴다.
// 팀 안에서 같은 답을 쓴 최대 인원 ÷ 팀 인원 = 그 라운드 팀 점수(0~1).
// 5라운드 합으로 팀 순위를 낸다.
//
// 비밀 규칙: 입력 중에는 남의 답이 화면으로 나가면 안 된다.
// 그래서 뷰에는 '몇 명 냈는지'만 담고, 답은 공개 단계에서만 담는다.
import { 팀원들 } from '../../state.js';
import { 팀순위점수 } from '../../scoring.js';

const 라운드수 = 5;
const 입력초 = 20;
const 팀ID들 = ['A', 'B', 'C'];

// 답 비교용 정규화: 공백 제거 + 소문자 (SPEC 5-1)
function 정규화(답) {
  return String(답 || '').replace(/\s+/g, '').toLowerCase();
}

export default {
  id: 'telepathy',
  name: '텔레파시',
  type: 'team',
  minPlayers: 2,
  maxPlayers: 12,
  minutes: 10,
  color: '#14B8C4',
  rules: [
    '제시어를 보고 20초 안에 한 단어를 씁니다.',
    '우리 팀에서 같은 답을 쓴 사람이 많을수록 점수가 높습니다.',
    '전부 같은 답이면 만점, 다 다르면 최소점입니다.',
    '5라운드를 합쳐 팀 순위를 정합니다.'
  ],

  // ── 시작 ──────────────────────────────────────────────────
  create(ctx) {
    const 문제 = 섞기(ctx.content?.telepathy || []).slice(0, 라운드수);
    const 쓸문제 = 문제.length ? 문제 : ['라면에 추가하는 재료 하나'];
    return {
      round: 1,
      총라운드: 쓸문제.length,
      prompts: 쓸문제,
      phase: 'input',                 // input → reveal → (다음 라운드) → done
      endsAt: Date.now() + 입력초 * 1000,
      answers: {},                    // 이번 라운드 답  { playerId: '원문' }
      병합: {},                       // 진행자가 묶은 답  { 정규화답: 대표정규화답 }
      라운드기록: [],
      팀총점: {},
      개인기여: {}
    };
  },

  // ── 휴대폰 입력 ───────────────────────────────────────────
  onInput(s, playerId, input) {
    if (s.phase !== 'input') return;
    if (Date.now() > s.endsAt) return;             // 시간이 지나면 받지 않는다
    const 답 = String(input?.answer ?? '').trim().slice(0, 20);
    if (!답) { delete s.answers[playerId]; return; }
    s.answers[playerId] = 답;
  },

  // ── 진행자 조작 ───────────────────────────────────────────
  onAdmin(s, { action, payload } = {}) {
    const d = payload || {};

    if (action === '공개') {                        // 시간 전에 바로 공개
      if (s.phase === 'input') 라운드마감(s);
      return;
    }
    if (action === '시간추가') {
      if (s.phase === 'input') s.endsAt += (Number(d.초) || 30) * 1000;
      return;
    }
    if (action === '답병합') {
      // 비슷한 답을 같은 것으로 묶는다 ('수박' = '수박이')
      const from = 정규화(d.from), to = 정규화(d.to);
      if (!from || !to || from === to) return;
      s.병합[from] = to;
      다시계산(s);
      return;
    }
    if (action === '병합취소') {
      delete s.병합[정규화(d.from)];
      다시계산(s);
      return;
    }
    if (action === '다음') {
      if (s.phase !== 'reveal') return;
      if (s.round >= s.총라운드) { s.phase = 'done'; return; }
      s.round += 1;
      s.phase = 'input';
      s.answers = {};
      s.병합 = {};
      s.endsAt = Date.now() + 입력초 * 1000;
      return;
    }
  },

  // ── 타이머 만료 ───────────────────────────────────────────
  onTick(s, now) {
    if (s.phase === 'input' && now >= s.endsAt) 라운드마감(s);
  },

  // ── 뷰 (정보 등급별, SPEC 4장) ────────────────────────────
  views(s) {
    const 공개 = {
      round: s.round,
      총라운드: s.총라운드,
      prompt: s.prompts[s.round - 1],
      phase: s.phase,
      endsAt: s.phase === 'input' ? s.endsAt : null,
      팀총점: s.팀총점,
      // 입력 중에는 '몇 명 냈는지'만. 답 내용은 절대 보내지 않는다.
      제출현황: 제출현황(s),
      // 공개 단계에서만 답 묶음을 보낸다.
      공개결과: s.phase === 'input' ? null : 마지막라운드(s)
    };

    return {
      screen: 공개,
      player: (pid) => ({
        ...공개,
        내답: s.answers[pid] ?? '',
        입력가능: s.phase === 'input' && Date.now() < s.endsAt
      }),
      admin: {
        ...공개,
        미제출: 미제출자(s),
        병합: { ...s.병합 }
      },
      adminSecret: {
        // 공개 전에 답을 보면 진행자가 게임에 참여할 수 없다.
        // 그래서 '스포일러 보기'를 눌렀을 때만 나간다.
        답: s.phase === 'input' ? { ...s.answers } : null
      }
    };
  },

  // ── 끝났을 때 점수 (SPEC 5-1 + 5장 공통 배점) ─────────────
  result(s) {
    const 팀결과 = Object.keys(s.팀총점).map(id => ({
      id, points: Math.round((s.팀총점[id] || 0) * 100) / 100
    }));

    // 팀 순위 → 팀원 전원 +5 / +3 / +1
    const 점수 = 팀순위점수(팀결과);

    // 개인 활약: 라운드마다 팀 다수 답에 든 사람 +0.2 → 반올림(최대 +1)
    for (const [pid, 기여] of Object.entries(s.개인기여)) {
      const 점 = Math.min(1, Math.round(기여));
      if (점 > 0) 점수.push({ playerId: pid, points: 점, reason: '텔레파시 활약' });
    }

    return { 점수, 요약: { 팀결과, 라운드: s.라운드기록.length } };
  }
};

// ══════════════════════════════════════════════════════════
// 안쪽 일
// ══════════════════════════════════════════════════════════

function 섞기(배열) {
  const a = [...배열];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function 제출현황(s) {
  const 결과 = {};
  for (const t of 팀ID들) {
    const 원들 = 팀원들(t);
    if (원들.length === 0) continue;
    결과[t] = { 낸사람: 원들.filter(p => s.answers[p.id]).length, 전체: 원들.length };
  }
  return 결과;
}

function 미제출자(s) {
  const 결과 = [];
  for (const t of 팀ID들) {
    for (const p of 팀원들(t)) {
      if (!s.answers[p.id]) 결과.push({ id: p.id, name: p.name, teamId: p.teamId });
    }
  }
  return 결과;
}

function 마지막라운드(s) {
  const 기록 = s.라운드기록[s.라운드기록.length - 1];
  if (!기록) return null;
  return { prompt: 기록.prompt, 결과: 기록.결과 || {} };
}

// 라운드를 닫고 점수를 낸다.
function 라운드마감(s) {
  s.phase = 'reveal';
  s.라운드기록.push({ prompt: s.prompts[s.round - 1], answers: { ...s.answers } });
  다시계산(s);
}

// 병합이 바뀔 때마다 점수를 처음부터 다시 센다(되돌릴 수 있게).
function 다시계산(s) {
  s.팀총점 = {};
  s.개인기여 = {};

  s.라운드기록.forEach((기록, i) => {
    const 마지막 = i === s.라운드기록.length - 1;
    const 병합 = 마지막 ? s.병합 : (기록.병합 || {});
    기록.결과 = 라운드점수(기록.answers, 병합);
    if (마지막) 기록.병합 = { ...s.병합 };

    for (const [팀, r] of Object.entries(기록.결과)) {
      s.팀총점[팀] = Math.round(((s.팀총점[팀] || 0) + r.점수) * 100) / 100;
      for (const pid of r.기여자) {
        s.개인기여[pid] = Math.round(((s.개인기여[pid] || 0) + 0.2) * 100) / 100;
      }
    }
  });

  // 팀이 있는데 아직 점수가 없으면 0으로 채운다(순위에서 빠지지 않게)
  for (const t of 팀ID들) {
    if (팀원들(t).length > 0 && s.팀총점[t] === undefined) s.팀총점[t] = 0;
  }
}

// 한 라운드의 팀별 점수 = (같은 답을 쓴 최대 인원) ÷ (팀 인원)
function 라운드점수(answers, 병합) {
  const 결과 = {};
  for (const t of 팀ID들) {
    const 원들 = 팀원들(t);
    if (원들.length === 0) continue;

    const 묶음 = new Map();     // 정규화답 → [playerId]
    for (const p of 원들) {
      const 원문 = answers[p.id];
      if (!원문) continue;
      let key = 정규화(원문);
      if (병합[key]) key = 병합[key];      // 진행자가 묶은 답은 대표 답으로
      if (!묶음.has(key)) 묶음.set(key, []);
      묶음.get(key).push(p.id);
    }

    let 최대 = [], 최대답 = '';
    for (const [key, 사람들] of 묶음) {
      if (사람들.length > 최대.length) { 최대 = 사람들; 최대답 = key; }
    }

    결과[t] = {
      점수: Math.round((최대.length / 원들.length) * 100) / 100,
      다수답: 최대답,
      기여자: 최대.length >= 2 ? 최대 : [],   // 혼자 쓴 답은 '일치'가 아니다
      묶음: [...묶음.entries()]
        .map(([key, 사람들]) => ({
          답: 대표원문(answers, 사람들),
          정규화: key,
          사람: [...사람들],
          수: 사람들.length
        }))
        .sort((a, b) => b.수 - a.수)
    };
  }
  return 결과;
}

// 묶인 답의 대표 표기는 가장 먼저 낸 사람의 원문을 쓴다.
function 대표원문(answers, 사람들) {
  for (const id of 사람들) if (answers[id]) return answers[id];
  return '';
}
