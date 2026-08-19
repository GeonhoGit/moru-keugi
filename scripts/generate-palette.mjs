/**
 * Aseprite/Piskel용 팔레트 파일을 만든다 (계획서 4.6).
 *
 * 색을 문서에 손으로 옮겨 적으면 언젠가 어긋난다. 코드의 팔레트를 그대로 읽어
 * `.gpl`(GIMP 팔레트, Aseprite가 그대로 연다)로 내보내면 그럴 일이 없다.
 *
 *   node scripts/generate-palette.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'art', 'moru-keugi.gpl');

/** 계획서 4.6의 UI 팔레트. `src/theme/index.ts`의 colors와 같은 값이다. */
const UI = [
  ['150f0c', '배경 진한 차콜 브라운'],
  ['201811', '패널 짙은 갈색'],
  ['2a2018', '패널 밝은 면'],
  ['4a3d31', '구분선 회갈색'],
  ['6d5c4c', '비활성 텍스트'],
  ['a8927c', '보조 텍스트 흐린 갈색'],
  ['f5ead9', '본문 따뜻한 오프화이트'],
];

/** 화로 티어 강조색. 티어마다 배경의 강조만 이 색으로 바꾼다. */
const ACCENT = [
  ['ff7a3d', '티어0 주황 초심자의 화로'],
  ['d1450f', '티어1 진한 주황 타오르는 화로'],
  ['e0b479', '티어2 금빛 작열하는 용광로'],
  ['cfe6ff', '티어3 하늘빛 백광 용염의 성화'],
];

/** 도트 스프라이트가 실제로 쓰는 재질색. src/data/workers.ts에서 가져왔다. */
const MATERIAL = [
  ['191009', '외곽선 — 바닥보다 확실히 어두워야 형체가 선다'],
  ['6b5947', '금속·돌'],
  ['b3a08c', '금속 위에서 빛이 닿는 면'],
  ['9c8f82', '망치 머리 하이라이트'],
  ['6d5c4c', '나무·가죽'],
  ['8f7a64', '가죽 하이라이트'],
  ['e0b479', '나무 손잡이'],
  ['1d140e', '발밑 그림자'],
];

const groups = [
  ['UI', UI],
  ['화로 티어 강조색', ACCENT],
  ['재질', MATERIAL],
];

const lines = ['GIMP Palette', 'Name: 모루 키우기', 'Columns: 8', '#'];
for (const [title, entries] of groups) {
  lines.push(`# ${title}`);
  for (const [hex, note] of entries) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t#${hex} ${note}`);
  }
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join('\n') + '\n', 'utf8');
const total = groups.reduce((sum, [, e]) => sum + e.length, 0);
console.log(`팔레트 ${total}색을 썼습니다: ${out}`);
