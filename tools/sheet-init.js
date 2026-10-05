// 구글시트 처음 준비하기 (SPEC 8장)
//
//   npm run sheet:init
//
// 하는 일:
//   ① 없는 탭을 만든다 (설정·참가자·팀·점수로그·게임결과·순위·초성·텔레파시·라이어)
//   ② 각 탭에 머리글을 쓴다
//   ③ 설정 탭에 기본값을 넣는다 (비어 있을 때만)
//   ④ content/*.csv 의 문제를 올린다 (비어 있을 때만 — 시트에서 고친 건 안 덮는다)
//   ⑤ 순위 탭에 수식을 넣는다 (노트북이 꺼져도 시트만 열면 점수를 본다)
//
// 여러 번 돌려도 안전하다.
import 'dotenv/config';
import { 시트준비, 시트초기화, 시트켜짐, 탭들 } from '../server/sheets.js';
import { CSV전부 } from '../server/content.js';

console.log('\n구글시트를 준비합니다…\n');

await 시트준비();

if (!시트켜짐()) {
  console.log('');
  console.log('  시트에 연결하지 못해 멈춥니다. 아래를 확인해주세요.');
  console.log('');
  console.log('  1) 프로젝트 폴더에 .env 파일이 있고, 그 안에 SHEET_ID가 적혀 있나요?');
  console.log('       SHEET_ID=1AbC...           ← 시트 주소 가운데 긴 글자');
  console.log('  2) secrets/service-account.json 파일이 있나요?');
  console.log('  3) 구글시트를 서비스 계정 이메일에 "편집자"로 공유했나요?');
  console.log('       (키 파일 안의 client_email 값)');
  console.log('');
  process.exit(1);
}

const 문제 = CSV전부();
console.log(`  올릴 문제 — 텔레파시 ${문제.telepathy.length} · 초성 ${문제.chosung.length} · 라이어 ${문제.liar.length}\n`);

try {
  const r = await 시트초기화({ 문제 });
  console.log('  탭 정리 완료');
  if (r.만든탭.length) console.log(`    새로 만든 탭: ${r.만든탭.join(', ')}`);
  else console.log('    (탭이 이미 다 있었습니다)');
  console.log(`    전체 탭: ${Object.keys(탭들).join(', ')}`);
  console.log('');
  console.log('  끝났습니다. 이제 서버를 켜면 점수가 시트에 쌓입니다.');
  console.log('  문제를 고치고 싶으면 시트의 초성·텔레파시·라이어 탭을 고치세요.');
  console.log('  게임을 시작할 때마다 다시 읽으므로 다음 판부터 바로 반영됩니다.');
  console.log('');
  process.exit(0);
} catch (err) {
  console.error('\n  실패:', err.message, '\n');
  process.exit(1);
}
