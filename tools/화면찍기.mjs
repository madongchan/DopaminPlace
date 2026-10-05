// 개발용 — 화면을 실제로 열어 다 그려진 뒤 사진을 찍는다.
// 행사 당일에는 쓰지 않는다. 만든 화면이 맞는지 눈으로 보려고 둔 도구다.
//
//   node tools/화면찍기.mjs /screen board.png 2500
//   node tools/화면찍기.mjs "/screen?nointro" board.png
//   node tools/화면찍기.mjs / phone.png 2000 390 844      (휴대폰 크기)
//
// 그냥 chrome --screenshot 으로 찍으면 소켓으로 데이터가 오기 전에 찍혀서
// 빈 화면만 남는다. 그래서 여기서는 '그려질 때까지' 기다린다.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const [, , 경로 = '/screen', 파일 = 'shot.png', 대기 = '2500', 폭 = '1920', 높이 = '1080', PIN = ''] = process.argv;

const 크롬 = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`
].find(p => fs.existsSync(p));

if (!크롬) { console.error('Chrome을 찾지 못했습니다.'); process.exit(1); }

// Git Bash는 "/admin" 같은 인자를 윈도우 경로(C:/Program Files/Git/admin)로 바꿔버린다.
// 그래서 슬래시 없이 "admin" 으로 줘도 되게 하고, 바뀐 경로도 되돌린다.
function 경로정리(x) {
  let v = String(x || '');
  // …/Git/screen?nointro → screen?nointro
  const m = v.match(/[\\/]((?:screen|admin)[^\\/]*)$/i);
  if (/^[A-Za-z]:/.test(v) && m) v = m[1];
  if (!v.startsWith('/')) v = '/' + v;
  return v === '/' ? '/' : v;
}
const 주소경로 = 경로정리(경로);

const 저장폴더 = process.env.DOPA_SHOT_DIR || path.join(process.env.TEMP || '.', 'dopashot');
fs.mkdirSync(저장폴더, { recursive: true });
const 저장경로 = path.join(저장폴더, 파일);

const browser = await puppeteer.launch({
  executablePath: 크롬,
  headless: true,
  args: ['--disable-gpu', '--hide-scrollbars', `--window-size=${폭},${높이}`]
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: Number(폭), height: Number(높이), deviceScaleFactor: 1 });

  const 오류 = [];
  page.on('pageerror', e => 오류.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') 오류.push(m.text()); });

  // 진행자 화면은 PIN이 필요하다. 미리 넣어두면 자동으로 들어간다.
  // 참가자 화면은 토큰이 있어야 입장한 상태로 열린다.
  if (process.env.DOPA_TOKEN) {
    await page.evaluateOnNewDocument((t) => {
      try { localStorage.setItem('dopa.token', t); } catch {}
    }, process.env.DOPA_TOKEN);
  }
  if (PIN) {
    await page.evaluateOnNewDocument((pin) => {
      try { sessionStorage.setItem('dopa.adminPin', pin); } catch {}
    }, PIN);
  }

  // socket.io 연결이 계속 열려 있어서 networkidle은 끝나지 않는다. load 로 충분하다.
  await page.goto(`http://localhost:3000${주소경로}`, { waitUntil: 'load', timeout: 20000 });
  await new Promise(r => setTimeout(r, Number(대기)));   // 소켓 데이터와 애니메이션을 기다린다

  await page.screenshot({ path: 저장경로 });
  console.log(`저장: ${저장경로}  (${주소경로})`);
  if (오류.length) {
    console.log('\n[브라우저 오류]');
    for (const e of 오류.slice(0, 8)) console.log('  ' + e);
  } else {
    console.log('브라우저 오류 없음');
  }
} finally {
  await browser.close();
}
