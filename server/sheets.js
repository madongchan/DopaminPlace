// 구글시트 연동 (SPEC 8장)
//
// 규칙 셋:
//   ① 시트는 기록·복원·문제 관리용이다. 버튼 입력마다 시트를 부르지 않는다.
//   ② 쓰기는 큐에 쌓아 5초마다 한 번에 보낸다. 실패하면 큐를 지우지 않고 다시 시도한다.
//   ③ 시트가 없어도 모든 기능이 돌아가야 한다. 로컬 JSON만으로 충분하다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 키파일 = path.join(루트, 'secrets', 'service-account.json');
const 큐파일 = path.join(루트, 'data', 'queue.json');

// ── 탭 구조 (SPEC 8장) ──────────────────────────────────────
export const 탭들 = {
  설정:     ['키', '값'],
  참가자:   ['토큰', '이름', 'PIN해시', '팀', '첫 입장', '마지막 접속'],
  팀:       ['팀id', '이름', '색'],
  점수로그: ['시각', 'playId', '게임', '이름', '팀', '점수', '사유'],
  게임결과: ['시각', 'playId', '게임', '요약', '역할 공개'],
  순위:     ['이름', '팀', '점수'],
  초성:     ['초성', '정답', '힌트'],
  텔레파시: ['제시어'],
  라이어:   ['카테고리', '제시어']
};

let sheets = null;          // 구글 API 손잡이
let SHEET_ID = null;
let 켜짐 = false;
let 마지막오류 = null;
let 큐 = [];                // [{ 탭, 행 }]
let 보내는중 = false;

// 구글 할당량은 '프로젝트당 분당 300회, 사용자당 분당 60회'다.
// 우리는 그 근처도 안 가지만, 실수로 몰아치지 않게 스스로 세고 늦춘다.
// (2026년 후반부터 할당량을 넘긴 만큼 과금이 예고돼 있다 — 안 넘는 게 안전하다)
const 분당한도 = 30;        // 사용자당 60회의 절반만 쓴다
let 요청수 = 0;             // 서버를 켠 뒤 구글에 보낸 총 요청 수
let 이번분 = { 분: -1, 수: 0 };

function 요청가능() {
  const 지금분 = Math.floor(Date.now() / 60000);
  if (이번분.분 !== 지금분) 이번분 = { 분: 지금분, 수: 0 };
  return 이번분.수 < 분당한도;
}
function 요청셈() { 이번분.수 += 1; 요청수 += 1; }

export function 시트켜짐() { return 켜짐; }

export function 시트상태() {
  return {
    켜짐, 대기: 큐.length, 오류: 마지막오류,
    요청수,                       // 서버를 켠 뒤 구글에 보낸 총 요청 수
    분당한도, 이번분: 이번분.수
  };
}

// ── 준비 ────────────────────────────────────────────────────
export async function 시트준비() {
  SHEET_ID = (process.env.SHEET_ID || '').trim();
  큐불러오기();

  if (!SHEET_ID) {
    안내('SHEET_ID가 비어 있어 구글시트를 쓰지 않습니다.');
    return false;
  }
  if (!fs.existsSync(키파일)) {
    안내('secrets/service-account.json 이 없어 구글시트를 쓰지 않습니다.');
    return false;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: 키파일,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    // 한 번 읽어봐서 권한이 있는지 확인한다
    const r = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'properties.title' });
    켜짐 = true;
    마지막오류 = null;
    console.log(`   구글시트 연결됨 — "${r.data.properties.title}"`);
    if (큐.length) console.log(`   보내지 못한 기록 ${큐.length}줄을 이어서 보냅니다.`);
    보내기시작();
    return true;
  } catch (err) {
    켜짐 = false;
    마지막오류 = 읽기쉬운오류(err);
    안내(`구글시트에 연결하지 못했습니다 — ${마지막오류}`);
    return false;
  }
}

function 안내(글) {
  console.log('');
  console.log(`   [시트] ${글}`);
  console.log('          점수와 참가자는 data/state.json 에 그대로 저장됩니다.');
}

function 읽기쉬운오류(err) {
  const m = err?.message || String(err);
  if (/permission|403/i.test(m)) return '시트를 서비스 계정 이메일에 편집자로 공유했는지 확인하세요';
  if (/not found|404/i.test(m)) return 'SHEET_ID가 맞는지 확인하세요';
  if (/invalid_grant|JWT/i.test(m)) return '키 파일이 올바른지, 노트북 시계가 맞는지 확인하세요';
  return m.split('\n')[0].slice(0, 160);
}

// ── 큐 (쓰기는 모아서 5초마다) ──────────────────────────────
function 큐불러오기() {
  try {
    if (fs.existsSync(큐파일)) 큐 = JSON.parse(fs.readFileSync(큐파일, 'utf8')) || [];
  } catch { 큐 = []; }
}

let 큐저장예약 = null;
function 큐저장() {
  if (큐저장예약) return;
  큐저장예약 = setTimeout(() => {
    큐저장예약 = null;
    try {
      fs.mkdirSync(path.dirname(큐파일), { recursive: true });
      fs.writeFileSync(큐파일, JSON.stringify(큐), 'utf8');
    } catch (err) { console.error('[시트 큐 저장 실패]', err.message); }
  }, 300);
}

// 시트를 쓰기로 했는데(SHEET_ID 있음) 잠깐 꺼져 있으면 큐에 쌓아 두고, 켜지면 그때 보낸다.
// 시트를 아예 안 쓰면(SHEET_ID 없음) 쌓지 않는다 — 보낼 곳이 없는 기록이 끝없이 늘어난다.
function 줄넣기(탭, 행) {
  if (!SHEET_ID) return;
  큐.push({ 탭, 행 });
  큐저장();
}

let 보내기타이머 = null;
function 보내기시작() {
  if (보내기타이머) return;
  보내기타이머 = setInterval(보내기, 5000);
  보내기타이머.unref?.();
}

async function 보내기() {
  if (!켜짐 || 보내는중 || 큐.length === 0) return;
  if (!요청가능()) return;        // 분당 한도에 가까우면 다음 차례로 미룬다
  보내는중 = true;

  const 보낼것 = 큐.slice();          // 지금까지 쌓인 것만 보낸다
  const 묶음 = new Map();             // 탭별로 묶어서 한 번에 붙인다
  for (const x of 보낼것) {
    if (!묶음.has(x.탭)) 묶음.set(x.탭, []);
    묶음.get(x.탭).push(x.행);
  }

  try {
    for (const [탭, 행들] of 묶음) {
      요청셈();
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${탭}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: 행들 }
      });
    }
    큐 = 큐.slice(보낼것.length);      // 보낸 만큼만 덜어낸다(그 사이 들어온 줄은 남긴다)
    큐저장();
    마지막오류 = null;
  } catch (err) {
    // 실패하면 큐를 그대로 두고 다음 5초에 다시 시도한다.
    마지막오류 = 읽기쉬운오류(err);
    console.error(`[시트 전송 실패 — ${큐.length}줄 대기 중]`, 마지막오류);
  } finally {
    보내는중 = false;
  }
}

// 진행자 '지금 동기화'
export async function 지금동기화() {
  await 보내기();
  return 시트상태();
}

// ── 기록 ────────────────────────────────────────────────────
function 시각(ms = Date.now()) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function 점수줄추가(줄, 이름, 팀이름) {
  줄넣기('점수로그', [시각(줄.at), 줄.playId, 줄.gameId, 이름, 팀이름 || '', 줄.points, 줄.reason]);
}

export function 게임결과추가({ playId, gameId, 요약, 역할공개 = '' }) {
  줄넣기('게임결과', [시각(), playId, gameId, JSON.stringify(요약 ?? {}), 역할공개]);
}

export function 참가자추가기록(p) {
  줄넣기('참가자', [p.token, p.name, p.pinHash, p.teamId || '', 시각(p.joinedAt), 시각(p.lastSeen)]);
}

export function 팀줄추가(t, 색hex) {
  줄넣기('팀', [t.id, t.name || '', 색hex || t.colorId || '']);
}

// ── 문제 읽기 (게임 시작 때마다) ────────────────────────────
export async function 시트문제() {
  if (!켜짐) return null;
  try {
    요청셈();
    const r = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SHEET_ID,
      ranges: ['텔레파시!A2:A', '초성!A2:C', '라이어!A2:B']     // 세 탭을 한 번에 — 요청 1회
    });
    const [텔, 초, 라] = r.data.valueRanges.map(v => v.values || []);
    return {
      telepathy: 텔.map(row => (row[0] || '').trim()).filter(Boolean),
      chosung: 초.filter(row => row[0] && row[1])
        .map(row => ({ 초성: row[0].trim(), 정답: row[1].trim(), 힌트: (row[2] || '').trim() })),
      liar: 라.filter(row => row[1])
        .map(row => ({ 카테고리: (row[0] || '').trim(), 제시어: row[1].trim() }))
    };
  } catch (err) {
    마지막오류 = 읽기쉬운오류(err);
    console.error('[시트 문제 읽기 실패 — content/*.csv 를 씁니다]', 마지막오류);
    return null;
  }
}

// ── 설정 읽기 (서버 시작 때) ────────────────────────────────
export async function 시트설정() {
  if (!켜짐) return null;
  try {
    요청셈();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: '설정!A2:B' });
    const 행 = r.data.values || [];
    return Object.fromEntries(행.filter(x => x[0]).map(x => [String(x[0]).trim(), String(x[1] ?? '').trim()]));
  } catch (err) {
    마지막오류 = 읽기쉬운오류(err);
    console.error('[시트 설정 읽기 실패]', 마지막오류);
    return null;
  }
}

// ── 탭·머리글 만들기 (npm run sheet:init) ───────────────────
export async function 시트초기화({ 문제 } = {}) {
  if (!켜짐) throw new Error('시트가 연결되지 않았습니다.');

  const 현재 = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const 있는탭 = new Set(현재.data.sheets.map(s => s.properties.title));

  // ① 없는 탭 만들기
  const 만들요청 = Object.keys(탭들)
    .filter(t => !있는탭.has(t))
    .map(t => ({ addSheet: { properties: { title: t } } }));
  if (만들요청.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID, requestBody: { requests: 만들요청 }
    });
  }

  // ② 머리글 쓰기
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: Object.entries(탭들).map(([탭, 열]) => ({ range: `${탭}!A1`, values: [열] }))
    }
  });

  // ③ 설정 기본값 (이미 값이 있으면 건드리지 않는다)
  const 설정현재 = (await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: '설정!A2:B'
  })).data.values || [];
  if (설정현재.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: '설정!A2',
      valueInputOption: 'RAW',
      requestBody: { values: [['진행자PIN', '0000'], ['입장코드', ''], ['점수기준', 'best']] }
    });
  }

  // ④ 문제 올리기 (비어 있을 때만 — 대표님이 고친 문제를 덮지 않는다)
  if (문제) {
    await 비었으면채우기('텔레파시', 문제.telepathy.map(x => [x]));
    await 비었으면채우기('초성', 문제.chosung.map(x => [x.초성, x.정답, x.힌트]));
    await 비었으면채우기('라이어', 문제.liar.map(x => [x.카테고리, x.제시어]));
  }

  // ⑤ 순위 탭 수식 — 노트북이 꺼져도 시트만 열면 점수를 볼 수 있다
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: '순위!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        ['이름', '팀', '점수'],
        [
          '=IFERROR(SORT(UNIQUE(FILTER(점수로그!D2:D, 점수로그!D2:D<>"")), 1, TRUE), "")',
          '=IFERROR(ARRAYFORMULA(IF(A2:A="", "", IFERROR(VLOOKUP(A2:A, {점수로그!D2:D, 점수로그!E2:E}, 2, FALSE), ""))), "")',
          '=IFERROR(ARRAYFORMULA(IF(A2:A="", "", SUMIF(점수로그!D:D, A2:A, 점수로그!F:F))), "")'
        ]
      ]
    }
  });

  return { 만든탭: 만들요청.map(x => x.addSheet.properties.title) };
}

async function 비었으면채우기(탭, 값들) {
  if (!값들?.length) return;
  const 현재 = (await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${탭}!A2:A`
  })).data.values || [];
  if (현재.length > 0) return;      // 이미 있으면 덮어쓰지 않는다
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: `${탭}!A2`,
    valueInputOption: 'RAW', requestBody: { values: 값들 }
  });
}
