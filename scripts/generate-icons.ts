/**
 * 앱 아이콘·스플래시 PNG 생성 (계획서 4.6).
 *
 * 게임 안에서 쓰는 도트 스프라이트를 그대로 확대해 PNG로 굽는다.
 * 아이콘만 따로 그리면 게임 화면과 인상이 어긋나므로, 같은 그림·같은 팔레트를 쓴다.
 *
 * 정수 배율로만 확대하므로(계획서 4.6) 픽셀 경계가 뭉개지지 않는다.
 * 1024 ÷ 32 = 32배로 딱 떨어진다.
 *
 *   npx tsx scripts/generate-icons.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng, hexToRgb } from './lib/png';
import { APP_ICON } from '../src/data/sprites';
import { colors } from '../src/theme/index';
import type { PixelSpriteData } from '../src/theme/pixel';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// ---------------------------------------------------------------------------
// 스프라이트 → 픽셀
// ---------------------------------------------------------------------------

interface RenderOptions {
  /** 최종 이미지 한 변의 크기 */
  readonly size: number;
  /** 그림이 차지할 배율. 남는 자리는 여백이 된다. */
  readonly scale: number;
  /** 배경색. 없으면 투명 */
  readonly background?: string;
}

const renderSprite = (sprite: PixelSpriteData, options: RenderOptions): Buffer => {
  const { size, scale, background } = options;
  const rgba = new Uint8Array(size * size * 4);

  if (background) {
    const [r, g, b] = hexToRgb(background);
    for (let i = 0; i < size * size; i += 1) {
      rgba[i * 4] = r;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = b;
      rgba[i * 4 + 3] = 255;
    }
  }

  const drawn = sprite.grid * scale;
  const offset = Math.floor((size - drawn) / 2);

  for (let row = 0; row < sprite.grid; row += 1) {
    const line = sprite.rows[row]!;
    for (let col = 0; col < sprite.grid; col += 1) {
      const char = line[col]!;
      if (char === '.') continue;
      const hex = sprite.palette[char];
      if (!hex) continue;
      const [r, g, b] = hexToRgb(hex);

      // 픽셀 하나를 scale × scale 사각형으로 확대한다.
      for (let dy = 0; dy < scale; dy += 1) {
        const y = offset + row * scale + dy;
        if (y < 0 || y >= size) continue;
        for (let dx = 0; dx < scale; dx += 1) {
          const x = offset + col * scale + dx;
          if (x < 0 || x >= size) continue;
          const index = (y * size + x) * 4;
          rgba[index] = r;
          rgba[index + 1] = g;
          rgba[index + 2] = b;
          rgba[index + 3] = 255;
        }
      }
    }
  }

  return encodePng(size, size, rgba);
};

// ---------------------------------------------------------------------------

const targets = [
  {
    file: 'icon.png',
    label: '앱 아이콘 (iOS·기본)',
    // 1024 ÷ 32 = 32배. 배경을 채워야 iOS에서 투명 부분이 검게 나오지 않는다.
    options: { size: 1024, scale: 32, background: colors.background },
  },
  {
    file: 'adaptive-icon.png',
    label: 'Android 어댑티브 아이콘 전경',
    // Android가 원형·둥근사각형 등으로 잘라내므로 가운데 62%만 쓴다.
    options: { size: 1024, scale: 20 },
  },
  {
    file: 'splash-icon.png',
    label: '스플래시 화면',
    options: { size: 512, scale: 12 },
  },
] as const;

mkdirSync(OUT_DIR, { recursive: true });
console.log(`아이콘을 생성합니다 → ${OUT_DIR}`);

for (const target of targets) {
  const png = renderSprite(APP_ICON, target.options);
  writeFileSync(join(OUT_DIR, target.file), png);
  const drawn = APP_ICON.grid * target.options.scale;
  console.log(
    `  ${target.file} — ${target.options.size}×${target.options.size}, ` +
      `그림 ${drawn}px(${target.options.scale}배), ${(png.length / 1024).toFixed(1)}KB · ${target.label}`,
  );
}
console.log(`완료: ${targets.length}개`);
