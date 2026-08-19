/**
 * 임시 배경 PNG 생성 (계획서 4.6).
 *
 * 실제 배경은 사람이 Aseprite로 그린다 (`docs/art/배경-도트-제작-가이드.md`).
 * 이 스크립트가 만드는 것은 **그 전에 렌더 경로를 검증하기 위한 임시 그림**이다.
 * 진짜 그림이 들어오면 같은 이름으로 덮어쓰면 되고, 이 스크립트는 지워도 된다.
 *
 * 임시 그림에는 nearest-neighbor 확대가 실제로 되는지 눈으로 판정할 수 있는
 * 무늬를 넣는다. 1픽셀 체커보드는 보간이 조금이라도 끼면 회색 면으로 뭉개지므로
 * 가장 확실한 시험지다.
 *
 *   npx tsx scripts/generate-placeholder-backgrounds.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng, hexToRgb, upscaleNearest } from './lib/png';
import { PIXEL_GRID } from '../src/theme/pixel';
import { colors } from '../src/theme/index';
import { FORGE_TIERS } from '../src/data/forgeTiers';

const WIDTH = PIXEL_GRID.backgroundWidth; // 320
const HEIGHT = PIXEL_GRID.backgroundHeight; // 180

/** 기기 밀도별로 미리 구워 둘 배율. RN이 @2x·@3x를 알아서 고른다. */
const DENSITIES = [1, 2, 3] as const;

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'backgrounds');

class Canvas {
  readonly rgba: Uint8Array;
  constructor(readonly width: number, readonly height: number) {
    this.rgba = new Uint8Array(width * height * 4);
  }
  set(x: number, y: number, hex: string, alpha = 255): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b] = hexToRgb(hex);
    const at = (y * this.width + x) * 4;
    this.rgba[at] = r;
    this.rgba[at + 1] = g;
    this.rgba[at + 2] = b;
    this.rgba[at + 3] = alpha;
  }
  fill(x0: number, y0: number, w: number, h: number, hex: string): void {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) this.set(x, y, hex);
  }
}

const draw = (tierIndex: number, accent: string): Canvas => {
  const c = new Canvas(WIDTH, HEIGHT);

  // 벽과 바닥. 공방과 같은 규칙으로 위가 뒤, 아래가 앞이다.
  c.fill(0, 0, WIDTH, HEIGHT, colors.background);
  c.fill(0, 0, WIDTH, 96, colors.panel);
  c.fill(0, 96, WIDTH, 2, colors.border); // 벽과 바닥이 만나는 선

  // 바닥 격자 — 사선이 아니라 직선이라 확대 품질을 보기 좋다.
  for (let x = 0; x < WIDTH; x += 32) c.fill(x, 98, 1, HEIGHT - 98, '#2a2018');
  for (let y = 108; y < HEIGHT; y += 18) c.fill(0, y, WIDTH, 1, '#2a2018');

  // ── nearest-neighbor 시험 무늬 ───────────────────────────────────────
  // 1픽셀 체커보드. 보간이 끼면 균일한 회색 면으로 뭉개진다.
  for (let y = 8; y < 40; y += 1) {
    for (let x = 8; x < 40; x += 1) {
      c.set(x, y, (x + y) % 2 === 0 ? colors.text : colors.background);
    }
  }
  // 1픽셀 세로줄 — 간격이 벌어질수록 살아남는다.
  for (let i = 0; i < 8; i += 1) c.fill(48 + i * 4, 8, 1, 32, colors.text);
  // 계단 사선 — 계단이 부드러워지면 보간이 낀 것이다.
  for (let i = 0; i < 32; i += 1) c.set(88 + i, 8 + i, accent);

  // 티어를 눈으로 구분할 표시. 막대 개수가 티어 번호다.
  for (let i = 0; i <= tierIndex; i += 1) c.fill(WIDTH - 16 - i * 10, 12, 6, 24, accent);

  // 화로 불빛. 티어가 오를수록 커진다.
  const glow = 10 + tierIndex * 6;
  for (let y = -glow; y <= glow; y += 1) {
    for (let x = -glow; x <= glow; x += 1) {
      if (x * x + y * y <= glow * glow) c.set(WIDTH / 2 + x, 72 + y, accent);
    }
  }

  // 가운데 아래는 비워 둔다 — 모루와 인물이 그 위에 올라간다.
  return c;
};

mkdirSync(OUT_DIR, { recursive: true });
console.log(`임시 배경을 만듭니다 → ${OUT_DIR}`);

for (const tier of FORGE_TIERS) {
  const canvas = draw(tier.tier, tier.accentColor);
  for (const density of DENSITIES) {
    const scaled =
      density === 1
        ? { width: WIDTH, height: HEIGHT, rgba: canvas.rgba }
        : upscaleNearest(WIDTH, HEIGHT, canvas.rgba, density);
    const suffix = density === 1 ? '' : `@${density}x`;
    const file = join(OUT_DIR, `forge_tier_${tier.tier}${suffix}.png`);
    const png = encodePng(scaled.width, scaled.height, scaled.rgba);
    writeFileSync(file, png);
    console.log(
      `  forge_tier_${tier.tier}${suffix}.png — ${scaled.width}×${scaled.height}, ` +
        `${(png.length / 1024).toFixed(1)}KB · ${tier.name}`,
    );
  }
}
console.log(`완료: ${FORGE_TIERS.length * DENSITIES.length}개 (전부 임시 그림입니다)`);
