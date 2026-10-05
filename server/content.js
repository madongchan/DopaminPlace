// 게임 문제 불러오기
// 지금은 content/*.csv 에서 읽는다. 4단계에서 구글시트가 붙으면
// 시트를 먼저 보고, 시트가 없으면 이 CSV로 돌아온다(SPEC 8장).
//
// 게임을 시작할 때마다 다시 읽는다 — 파일을 고치면 다음 판에 바로 반영된다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 시트문제 } from './sheets.js';

const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 문제폴더 = path.join(루트, 'content');

// 아주 단순한 CSV 읽기. 따옴표로 감싼 칸과 그 안의 쉼표까지만 다룬다.
function CSV읽기(파일명) {
  const 경로 = path.join(문제폴더, 파일명);
  if (!fs.existsSync(경로)) {
    console.warn(`[문제] ${파일명} 이 없습니다.`);
    return [];
  }
  const 글 = fs.readFileSync(경로, 'utf8').replace(/^﻿/, '');   // BOM 제거
  const 줄들 = 글.split(/\r?\n/).filter(l => l.trim());
  if (줄들.length < 2) return [];

  const 머리 = 칸나누기(줄들[0]);
  return 줄들.slice(1).map(l => {
    const 칸 = 칸나누기(l);
    const 행 = {};
    머리.forEach((h, i) => { 행[h] = (칸[i] ?? '').trim(); });
    return 행;
  });
}

function 칸나누기(줄) {
  const 칸 = [];
  let 현재 = '', 따옴표안 = false;
  for (let i = 0; i < 줄.length; i++) {
    const c = 줄[i];
    if (c === '"') {
      if (따옴표안 && 줄[i + 1] === '"') { 현재 += '"'; i++; }   // "" → "
      else 따옴표안 = !따옴표안;
    } else if (c === ',' && !따옴표안) {
      칸.push(현재); 현재 = '';
    } else {
      현재 += c;
    }
  }
  칸.push(현재);
  return 칸.map(x => x.trim());
}

// 시트가 연결돼 있으면 시트를 먼저 본다. 시트가 비었거나 실패하면 CSV로 돌아간다.
// (SPEC 8장: 문제 탭은 게임 시작 때마다 다시 읽는다)
export async function 문제불러오기() {
  const 시트 = await 시트문제();
  if (시트) {
    const 파일 = CSV전부();
    return {
      telepathy: 시트.telepathy.length ? 시트.telepathy : 파일.telepathy,
      chosung:   시트.chosung.length   ? 시트.chosung   : 파일.chosung,
      liar:      시트.liar.length      ? 시트.liar      : 파일.liar
    };
  }
  return CSV전부();
}

export function CSV전부() {
  try {
    return {
      // 텔레파시는 제시어 한 줄짜리라 문자열 배열로 준다.
      telepathy: CSV읽기('telepathy.csv').map(r => r['제시어']).filter(Boolean),
      chosung:   CSV읽기('chosung.csv').filter(r => r['초성'] && r['정답']),
      liar:      CSV읽기('liar.csv').filter(r => r['제시어'])
    };
  } catch (err) {
    console.error('[문제 불러오기 실패]', err.message);
    return { telepathy: [], chosung: [], liar: [] };
  }
}
