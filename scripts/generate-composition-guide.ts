/**
 * 배경 구도 템플릿 (계획서 4.6 무드보드 항목).
 *
 * Aseprite에서 맨 위 레이어로 깔아 두고 그 아래에 그리면, 모루에 가리는 자리에
 * 공들이는 일을 막을 수 있다. 다 그린 뒤에는 이 레이어만 끄고 내보낸다.
 *
 *   npx tsx scripts/generate-composition-guide.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png';
import { PIXEL_GRID } from '../src/theme/pixel';

const W = PIXEL_GRID.backgroundWidth;
const H = PIXEL_GRID.backgroundHeight;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'art');

const rgba = new Uint8Array(W * H * 4);
const set = (x: number, y: number, c: [number, number, number], a = 255) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = a;
};
const line = (x0: number, y0: number, x1: number, y1: number, c: [number,number,number], a = 255) => {
  if (y0 === y1) for (let x = x0; x <= x1; x += 1) set(x, y0, c, a);
  else for (let y = y0; y <= y1; y += 1) set(x0, y, c, a);
};
const dashed = (x0: number, x1: number, y: number, c: [number,number,number], a = 255) => {
  for (let x = x0; x <= x1; x += 1) if (x % 4 < 2) set(x, y, c, a);
};
const box = (x0: number, y0: number, x1: number, y1: number, c: [number,number,number], a = 255) => {
  line(x0, y0, x1, y0, c, a); line(x0, y1, x1, y1, c, a);
  line(x0, y0, x0, y1, c, a); line(x1, y0, x1, y1, c, a);
};

const CYAN: [number,number,number] = [0, 200, 255];
const RED: [number,number,number] = [255, 80, 80];
const YELLOW: [number,number,number] = [255, 210, 80];

// 수평선 — 벽과 바닥이 갈리는 높이. 이보다 위는 뒤, 아래는 앞이다.
line(0, 96, W - 1, 96, CYAN);
dashed(0, W - 1, 97, CYAN, 140);

// 안전 여백 — 기기에 따라 좌우가 잘릴 수 있다. 중요한 것은 이 안에.
box(12, 8, W - 13, H - 9, YELLOW, 170);

// 모루가 덮는 자리. 여기에 디테일을 넣어도 보이지 않는다.
box(W / 2 - 34, 78, W / 2 + 34, 150, RED);
for (let y = 78; y <= 150; y += 3) dashed(W / 2 - 34, W / 2 + 34, y, RED, 60);

// 화로 불빛의 중심. 티어마다 이 자리에서 색과 크기만 달라진다.
for (let d = 0; d < 8; d += 1) {
  set(W / 2 + d, 72, YELLOW); set(W / 2 - d, 72, YELLOW);
  set(W / 2, 72 + d, YELLOW); set(W / 2, 72 - d, YELLOW);
}

// 가운데 세로 기준선
dashed(0, 0, 0, CYAN, 0); // no-op 방지
for (let y = 0; y < H; y += 1) if (y % 4 < 2) set(W / 2, y, CYAN, 90);

mkdirSync(OUT, { recursive: true });
const file = join(OUT, 'composition-guide.png');
writeFileSync(file, encodePng(W, H, rgba));
console.log(`구도 템플릿을 만들었습니다: ${file} (${W}×${H})`);
console.log('  하늘색 = 수평선(벽/바닥 경계), 노랑 = 안전 여백과 불빛 중심, 빨강 = 모루에 가리는 자리');
