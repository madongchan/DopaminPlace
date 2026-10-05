// 끝까지 숨겨야 하는 값만 따로 담는 곳 (SPEC 5-5)
//
// 마피아의 역할 배정 같은 것은 data/state.json 에 넣으면 안 된다.
//   · state.json 은 화면 뷰를 만드는 원본이라 실수로 섞여 나갈 위험이 있다.
//   · 시트 동기화도 state 를 보고 돈다. 역할은 게임 중에 시트로 나가면 안 된다.
// 그래서 data/secret.json 에만 둔다. 이 파일은 어디로도 전송되지 않는다.
//
// .gitignore 에 data/*.json 이 들어 있어 깃에도 올라가지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 폴더 = path.join(루트, 'data');
const 파일 = path.join(폴더, 'secret.json');

function 전부읽기() {
  try {
    if (!fs.existsSync(파일)) return {};
    return JSON.parse(fs.readFileSync(파일, 'utf8')) || {};
  } catch (err) {
    console.error('[비밀] 읽기 실패 — 빈 것으로 시작합니다.', err.message);
    return {};
  }
}

function 전부쓰기(값) {
  try {
    if (!fs.existsSync(폴더)) fs.mkdirSync(폴더, { recursive: true });
    fs.writeFileSync(파일, JSON.stringify(값, null, 2), 'utf8');
  } catch (err) {
    console.error('[비밀] 저장 실패', err.message);
  }
}

// 한 판(playId)에 딸린 비밀을 읽고 쓴다.
export function 비밀읽기(키) {
  return 전부읽기()[키] ?? null;
}

export function 비밀쓰기(키, 값) {
  const 전부 = 전부읽기();
  전부[키] = 값;
  전부쓰기(전부);
}

export function 비밀지우기(키) {
  const 전부 = 전부읽기();
  if (!(키 in 전부)) return;
  delete 전부[키];
  전부쓰기(전부);
}

// 오래된 판의 비밀은 남겨둘 이유가 없다. 최근 몇 판만 남기고 지운다.
export function 비밀정리(남길수 = 5) {
  const 전부 = 전부읽기();
  const 키들 = Object.keys(전부);
  if (키들.length <= 남길수) return;
  for (const 키 of 키들.slice(0, 키들.length - 남길수)) delete 전부[키];
  전부쓰기(전부);
}
