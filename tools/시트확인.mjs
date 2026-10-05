// 구글시트 준비가 다 됐는지 확인 (아무것도 바꾸지 않습니다)
//
//   node tools/시트확인.mjs
//
// 무엇이 빠졌는지 한 줄씩 알려줍니다. 시트에 쓰지 않고 읽기만 합니다.
// 키 파일에서 비밀 값(private_key)은 절대 화면에 내보내지 않습니다.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 키파일 = path.join(루트, 'secrets', 'service-account.json');
const env파일 = path.join(루트, '.env');

const 좋음 = (s) => `  [O] ${s}`;
const 나쁨 = (s) => `  [X] ${s}`;
let 막힘 = null;

console.log('\n구글시트 준비 상태를 확인합니다.\n');

// ── 1. .env ─────────────────────────────────────────────────
console.log('1. .env 파일');
if (!fs.existsSync(env파일)) {
  console.log(나쁨('.env 파일이 없습니다.'));
  console.log('      .env.example 을 복사해 .env 로 이름을 바꾸세요.');
  막힘 ??= 'env';
} else {
  console.log(좋음('.env 파일 있음'));
}

const SHEET_ID = (process.env.SHEET_ID || '').trim();
if (!SHEET_ID) {
  console.log(나쁨('SHEET_ID 가 비어 있습니다.'));
  console.log('      .env 를 메모장으로 열고 SHEET_ID= 뒤에 시트 주소의 긴 글자를 붙여넣으세요.');
  console.log('      https://docs.google.com/spreadsheets/d/[이 부분]/edit');
  막힘 ??= 'sheetid';
} else if (SHEET_ID.includes('/') || SHEET_ID.includes('docs.google')) {
  console.log(나쁨('SHEET_ID 에 주소 전체가 들어갔습니다.'));
  console.log('      /d/ 와 /edit 사이의 글자만 남기세요.');
  const m = SHEET_ID.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (m) console.log(`      아마 이것일 겁니다 →  ${m[1]}`);
  막힘 ??= 'sheetid';
} else {
  console.log(좋음(`SHEET_ID 있음 (${SHEET_ID.slice(0, 8)}… ${SHEET_ID.length}글자)`));
}

// ── 2. 키 파일 ──────────────────────────────────────────────
console.log('\n2. 키 파일 (secrets/service-account.json)');
let client_email = null;
if (!fs.existsSync(키파일)) {
  console.log(나쁨('secrets/service-account.json 이 없습니다.'));
  console.log('      구글에서 받은 JSON 파일 이름을 service-account.json 으로 바꿔');
  console.log('      secrets 폴더에 넣으세요.');
  const 폴더 = path.join(루트, 'secrets');
  const 다른파일 = fs.existsSync(폴더) ? fs.readdirSync(폴더).filter(f => f.endsWith('.json')) : [];
  if (다른파일.length) {
    console.log(`      지금 secrets 폴더에 있는 json: ${다른파일.join(', ')}`);
    console.log('      → 이 이름을 service-account.json 으로 바꾸면 됩니다.');
  }
  막힘 ??= 'key';
} else {
  try {
    const 키 = JSON.parse(fs.readFileSync(키파일, 'utf8'));
    if (키.type !== 'service_account') {
      console.log(나쁨('서비스 계정 키 파일이 아닙니다.'));
      console.log('      구글 클라우드 > 서비스 계정 > 키 > JSON 으로 받은 파일이어야 합니다.');
      막힘 ??= 'key';
    } else {
      client_email = 키.client_email;
      console.log(좋음('키 파일 있음'));
      console.log(`      서비스 계정 주소: ${client_email}`);
    }
  } catch {
    console.log(나쁨('키 파일을 읽지 못했습니다(형식이 깨졌을 수 있습니다).'));
    막힘 ??= 'key';
  }
}

// ── 3. 실제로 붙어보기 ──────────────────────────────────────
console.log('\n3. 시트에 연결');
if (막힘) {
  console.log('      위 항목을 먼저 채워주세요.');
} else {
  const { 시트준비, 시트켜짐, 시트상태 } = await import('../server/sheets.js');
  await 시트준비();
  if (시트켜짐()) {
    const s = 시트상태();
    console.log(좋음('연결 성공'));
    console.log(`      구글에 보낸 요청: ${s.요청수}회 (한도는 분당 300회)`);
    if (s.대기) console.log(`      아직 못 보낸 기록: ${s.대기}줄 — 서버를 켜면 올라갑니다.`);
    console.log('');
    console.log('  다 됐습니다. 이제 아래를 실행하세요.');
    console.log('');
    console.log('      node tools\\sheet-init.js');
    console.log('');
    process.exit(0);
  }
  console.log(나쁨(`연결 실패 — ${시트상태().오류 || '알 수 없는 이유'}`));
  if (client_email) {
    console.log('');
    console.log('  가장 흔한 원인은 "공유를 안 한 것"입니다.');
    console.log('  구글시트를 열고 오른쪽 위 [공유] 를 눌러 아래 주소를 넣고');
    console.log('  권한을 "편집자"로 바꾼 뒤 다시 확인해보세요.');
    console.log('');
    console.log(`      ${client_email}`);
    console.log('');
  }
}

console.log('');
console.log('  ※ 여기서 막혀도 괜찮습니다. 시트 없이도 모든 기능이 돌아갑니다.');
console.log('');
process.exit(1);
