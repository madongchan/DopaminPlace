// 첫 화면 — 2025 워크숍 PPT 1장의 구성에, 무거운 제목 연출을 얹었다.
//   · 「도파민」과 「플레이션」이 깊은 곳에서 솟아올라 부딪힌다(두둥)
//   · 그 뒤로 일곱 글자를 가로지르는 느린 물결이 계속 친다
//   · 금색 유성이 주기적으로 지나가고, 우주 배경이 천천히 떠다닌다
// 「게임 시작하기」를 누르면 입장 QR·대기실로 넘어간다.
import { animate, createTimeline, stagger } from '/vendor/anime.js';

const $ = (id) => document.getElementById(id);
const intro = $('intro');
const NS = 'http://www.w3.org/2000/svg';   // 켜기()보다 먼저 선언해야 한다
let 넘어감 = false;
let 타임라인 = null;

// /screen?still   — 등장 애니메이션 없이 최종 모습만 (화면 확인용)
// /screen?nointro — 첫 화면을 건너뛰고 바로 QR·대기실
const 정지모드 = new URLSearchParams(location.search).has('still');
if (new URLSearchParams(location.search).has('nointro')) intro?.classList.add('gone');

if (intro) {
  try {
    켜기();
  } catch (err) {
    // 인트로는 '있으면 좋은 것'이다. 무슨 일이 있어도 QR·대기실은 떠야 한다.
    console.error('[인트로 실패 — QR·대기실은 정상]', err);
    intro.classList.add('gone');
  }
}

function 켜기() {
  const 글자 = 글자만들기();

  $('btn-start').addEventListener('click', 게임시작);
  addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); 게임시작(); }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); 처음부터(글자); }
  });

  if (정지모드 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  돌리기(글자);
  유성반복();
  배경떠다니기();
}

// ── 제목 연출 ───────────────────────────────────────────────
function 돌리기({ 앞, 뒤, 전부 }) {
  const tl = createTimeline({ defaults: { ease: 'outExpo' } });
  타임라인 = tl;

  // 앞쪽 장식은 조용히 먼저
  tl.add('.deco-top', { opacity: [0, 1], translateY: [-26, 0], duration: 900 }, 0);
  tl.add('.eyebrow', { opacity: [0, 1], translateY: [20, 0], duration: 900 }, 200);
  tl.add('.comet', { opacity: [0, .95], duration: 900 }, 300);

  // ① 「도파민」이 깊은 곳에서 무겁게 솟아오른다
  tl.add(앞, {
    opacity: [0, 1], translateY: [150, 0], scale: [1.55, 1],
    filter: ['blur(28px)', 'blur(0px)'],
    duration: 1500, delay: stagger(100)
  }, 500);

  // ② 「플레이션」이 뒤따라 솟아오른다
  tl.add(뒤, {
    opacity: [0, 1], translateY: [150, 0], scale: [1.55, 1],
    filter: ['blur(28px)', 'blur(0px)'],
    duration: 1500, delay: stagger(100)
  }, 1200);

  // ③ 두둥 — 두 단어가 서로를 향해 짧고 무겁게 밀린다
  const 충돌 = 2900;
  tl.add('.w1', { translateX: [0, 30, 0], duration: 900, ease: 'outElastic(1.1, .42)' }, 충돌);
  tl.add('.w2', { translateX: [0, -30, 0], duration: 900, ease: 'outElastic(1.1, .42)' }, 충돌);
  // 부딪히는 순간 글자가 한 번 크게 눌렸다 튄다
  tl.add(전부, { scale: [1, 1.09, .97, 1], duration: 760, ease: 'outQuad' }, 충돌);
  // 화면 전체가 무겁게 내려앉는다 (좌우로 흔들면 가벼워 보인다)
  tl.add('#stage', { translateY: [0, 34, -11, 4, 0], duration: 1150, ease: 'outQuad' }, 충돌);
  // 충격파 두 겹 — 흰 링이 먼저, 금색 링이 더 크게 뒤따른다
  tl.add('#shock', { opacity: [0, 1, 0], scale: [1, 62], duration: 1700, ease: 'outExpo' }, 충돌);
  tl.add('#shock2', { opacity: [0, .6, 0], scale: [1, 34], duration: 1100, ease: 'outExpo' }, 충돌 + 80);
  // 배경이 순간 밝아졌다 가라앉는다
  tl.add('.space', { opacity: [.5, .95, .5], duration: 900, ease: 'outQuad' }, 충돌);

  // ④ 어원과 줄무늬, 버튼이 뒤따라 자리를 잡는다
  tl.add('.stripe', { scaleX: [0, 1], duration: 1100 }, 충돌 + 200);
  tl.add('#origin', {
    opacity: [0, 1], translateY: [26, 0],
    letterSpacing: ['.26em', '.01em'],
    duration: 1400
  }, 충돌 + 350);
  tl.add('.btn-wrap', { opacity: [0, 1], translateY: [30, 0], duration: 1000 }, 충돌 + 700);

  // ⑤ 물결 — 일곱 글자를 가로지르는 느리고 얕은 파동. 끝까지 이어진다.
  tl.call(() => {
    if (넘어감) return;
    animate(전부, {
      translateY: [
        { to: -34, duration: 1450, ease: 'inOutSine' },
        { to: 0, duration: 1450, ease: 'inOutSine' },
        { to: 18, duration: 1450, ease: 'inOutSine' },
        { to: 0, duration: 1450, ease: 'inOutSine' }
      ],
      loop: true,
      delay: stagger(185)
    });
  }, 충돌 + 900);
}

function 처음부터(글자) {
  if (넘어감) return;
  타임라인?.pause();
  for (const el of intro.querySelectorAll('#stage [style], #stage, #shock, .stripe, .btn-wrap, .deco-top')) {
    el.removeAttribute('style');
  }
  돌리기(글자);
}

// ── 글자마다 SVG 하나씩 만든다 ──────────────────────────────
// HTML 텍스트로는 테두리가 글자 속을 덮어 그라데이션이 안 보인다.
// SVG의 paint-order="stroke" 라야 PPT의 스티커 느낌이 그대로 나온다.

function 글자SVG(글) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-30 0 260 300');
  svg.setAttribute('class', 'chsvg');
  svg.setAttribute('aria-hidden', 'true');
  // 뒤에서부터: 파란 그림자 → 금색 테두리 → 네이비 테두리+채움
  for (const [cls, y] of [['shadow', 238], ['gold', 218], ['fill', 218]]) {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', `t ${cls}`);
    t.setAttribute('x', '100');
    t.setAttribute('y', String(y));
    t.textContent = 글;
    svg.appendChild(t);
  }
  return svg;
}

function 글자만들기() {
  const 채우기 = (el, 글) => {
    el.textContent = '';
    return [...글].map((c) => { const s = 글자SVG(c); el.appendChild(s); return s; });
  };
  const 앞 = 채우기($('w1'), '도파민');
  const 뒤 = 채우기($('w2'), '플레이션');
  // 화면 읽기 프로그램에는 글자 조각이 아니라 제목 한 덩어리로 들리게 한다
  $('bigtitle').setAttribute('role', 'heading');
  $('bigtitle').setAttribute('aria-label', '도파민플레이션');
  return { 앞, 뒤, 전부: [...앞, ...뒤] };
}

// ── 금색 유성: 7초마다 한 번 지나간다 ───────────────────────
function 유성반복() {
  const c = $('comet');
  const 한번 = () => {
    if (넘어감) return;
    animate(c, {
      opacity: [{ to: .95, duration: 600 }, { to: .95, duration: 900 }, { to: .25, duration: 800 }],
      translateX: [-150, 0, 150],
      duration: 2300, ease: 'inOutSine'
    });
  };
  setTimeout(한번, 4400);
  setInterval(한번, 7000);
}

// ── 우주 배경이 아주 천천히 떠다닌다 ────────────────────────
function 배경떠다니기() {
  animate('.space', {
    translateX: [{ to: -14, duration: 14000, ease: 'inOutSine' }, { to: 0, duration: 14000, ease: 'inOutSine' }],
    translateY: [{ to: 9, duration: 11000, ease: 'inOutSine' }, { to: 0, duration: 11000, ease: 'inOutSine' }],
    loop: true
  });
}

// ── 「게임 시작하기」 → 입장 QR·대기실 ─────────────────────
function 게임시작() {
  if (넘어감) return;
  넘어감 = true;
  타임라인?.pause();

  const 끝 = () => intro.classList.add('gone');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 끝();

  animate('.btn-wrap, .intro-keys, .deco-top', { opacity: [1, 0], duration: 300, ease: 'inQuad' });
  animate('#stage', { opacity: [1, 0], scale: [1, 1.12], duration: 700, ease: 'inQuad' });
  animate('.intro', { opacity: [1, 0], duration: 760, delay: 150, ease: 'inQuad', onComplete: 끝 });
}
