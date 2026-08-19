/** 계획서 4.6 - 도트 아트의 그리드·정수 배율 규칙 자동 테스트 */
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_SCALES,
  getPixelScale,
  getPixelSize,
  getBackgroundLayout,
  isIntegerScale,
  mirrorSprite,
  PIXEL_GRID,
  validateSprite,
} from '../pixel';
import { SPRITES } from '../../data/sprites';
import { ICONS } from '../../data/icons';
import { WORKER_FRAMES } from '../../data/workers';

describe('그리드 기준 (계획서 4.6)', () => {
  it('계획서가 정한 원본 그리드를 쓴다', () => {
    expect(PIXEL_GRID.icon).toBe(16);
    expect(PIXEL_GRID.iconLarge).toBe(24);
    expect(PIXEL_GRID.object).toBe(32);
    expect(PIXEL_GRID.character).toBe(48);
    expect(PIXEL_GRID.backgroundWidth).toBe(320);
    expect(PIXEL_GRID.backgroundHeight).toBe(180);
  });
});

describe('정수 배율 규칙', () => {
  it('허용 배율은 1x·2x·3x·4x뿐이다', () => {
    expect([...ALLOWED_SCALES]).toEqual([1, 2, 3, 4]);
  });

  it('1.5x 같은 소수 배율은 배율로 인정하지 않는다', () => {
    expect(isIntegerScale(1.5)).toBe(false);
    expect(isIntegerScale(2.25)).toBe(false);
    expect(isIntegerScale(0.5)).toBe(false);
    expect(isIntegerScale(5)).toBe(false);
  });

  it('공간에 맞는 가장 큰 정수 배율을 고른다', () => {
    expect(getPixelScale(32, 32)).toBe(1);
    expect(getPixelScale(63, 32)).toBe(1); // 1.96배는 1x로 내린다
    expect(getPixelScale(64, 32)).toBe(2);
    expect(getPixelScale(100, 32)).toBe(3);
    expect(getPixelScale(1000, 32)).toBe(4); // 상한
  });

  it('공간이 원본보다 작아도 1x 아래로 내려가지 않는다', () => {
    expect(getPixelScale(10, 32)).toBe(1);
    expect(getPixelScale(0, 32)).toBe(1);
  });

  it('돌려주는 배율은 항상 허용 목록 안에 있다', () => {
    for (const available of [0, 17, 33, 64, 95, 128, 500, 4096]) {
      expect(ALLOWED_SCALES).toContain(getPixelScale(available, 32));
    }
  });

  it('표시 크기는 항상 정수 픽셀이다', () => {
    for (const scale of ALLOWED_SCALES) {
      const size = getPixelSize(PIXEL_GRID.object, scale);
      expect(Number.isInteger(size)).toBe(true);
      expect(size % PIXEL_GRID.object).toBe(0);
    }
  });
});

describe('스프라이트 정합성', () => {
  it('모든 스프라이트가 선언한 그리드와 실제 크기가 맞는다', () => {
    for (const sprite of [...SPRITES, ...ICONS, ...WORKER_FRAMES]) {
      expect(validateSprite(sprite)).toEqual([]);
    }
  });

  it('팔레트에 없는 문자를 잡아낸다', () => {
    const errors = validateSprite({
      id: 'broken',
      grid: 2,
      palette: { a: '#fff' },
      rows: ['aa', 'az'],
    });
    expect(errors.join()).toContain("'z'");
  });

  it('그리드와 행 수가 다르면 잡아낸다', () => {
    const errors = validateSprite({
      id: 'short',
      grid: 3,
      palette: { a: '#fff' },
      rows: ['aaa', 'aaa'],
    });
    expect(errors.join()).toContain('행 수');
  });

  it('색상 수가 권장 상한(16색)을 넘으면 알린다', () => {
    const palette: Record<string, string> = {};
    for (let i = 0; i < 17; i += 1) palette[String.fromCharCode(97 + i)] = '#ffffff';
    const errors = validateSprite({ id: 'toomany', grid: 1, palette, rows: ['a'] });
    expect(errors.join()).toContain('16개');
  });
});

describe('배경 배율 (실기기 검증 결과)', () => {
  // Pixel 8 = 420dpi = 2.625배. 안드로이드 밀도는 정수가 아닌 경우가 흔하다.
  const PIXEL_8 = 2.625;

  it('dp가 아니라 기기 픽셀로 배율을 고른다', () => {
    // 모루 상자 379.4dp = 996px. 320으로 나누면 3배가 들어간다.
    // dp로 계산했다면 floor(379/320) = 1이 나와 원본이 축소되며 보간이 낀다.
    expect(getBackgroundLayout(379.4, PIXEL_8).scale).toBe(3);
  });

  it('그린 크기가 화면에서 정확히 정수 배 픽셀이 된다', () => {
    const layout = getBackgroundLayout(379.4, PIXEL_8);
    const widthPx = layout.widthDp * PIXEL_8;
    const heightPx = layout.heightDp * PIXEL_8;

    expect(Math.round(widthPx)).toBe(320 * layout.scale);
    expect(Math.round(heightPx)).toBe(180 * layout.scale);
    // 1:1로 맞아야 보간이 없다.
    expect(widthPx).toBeCloseTo(960, 6);
  });

  it('밀도가 정수인 기기에서도 정수 배가 나온다', () => {
    for (const density of [1, 2, 3]) {
      const layout = getBackgroundLayout(400, density);
      expect(isIntegerScale(layout.scale)).toBe(true);
      expect(Math.round(layout.widthDp * density)).toBe(320 * layout.scale);
    }
  });

  it('좁은 화면에서도 1배 아래로 내려가지 않는다', () => {
    // 줄이면 도트가 뭉개진다. 넘치더라도 1배는 유지하고 넘치는 부분은 잘라 낸다.
    expect(getBackgroundLayout(100, 1).scale).toBe(1);
    expect(getBackgroundLayout(0, 2).scale).toBe(1);
  });

  it('가로세로 비율을 유지한다', () => {
    const layout = getBackgroundLayout(379.4, PIXEL_8);
    expect(layout.widthDp / layout.heightDp).toBeCloseTo(320 / 180, 6);
  });

  it('밀도 값이 잘못 들어와도 죽지 않는다', () => {
    expect(getBackgroundLayout(400, 0).scale).toBe(1);
    expect(getBackgroundLayout(400, -1).scale).toBe(1);
  });
});

describe('좌우 뒤집기', () => {
  const sample = {
    id: 'arrow',
    grid: 4,
    palette: { a: '#fff', b: '#000' },
    rows: ['ab..', '.ab.', '..ab', 'a..b'],
  } as const;

  it('각 행의 칸 순서를 뒤집는다', () => {
    expect(mirrorSprite(sample).rows).toEqual(['..ba', '.ba.', 'ba..', 'b..a']);
  });

  it('두 번 뒤집으면 원본으로 돌아온다', () => {
    expect(mirrorSprite(mirrorSprite(sample)).rows).toEqual([...sample.rows]);
  });

  it('원본을 바꾸지 않고, 그리드와 팔레트는 그대로 둔다', () => {
    const mirrored = mirrorSprite(sample);
    expect(sample.rows).toEqual(['ab..', '.ab.', '..ab', 'a..b']);
    expect(mirrored.grid).toBe(sample.grid);
    expect(mirrored.palette).toEqual(sample.palette);
    expect(validateSprite(mirrored)).toEqual([]);
  });

  it('같은 스프라이트는 같은 결과를 다시 쓴다', () => {
    expect(mirrorSprite(sample)).toBe(mirrorSprite(sample));
  });

  it('일꾼 프레임을 뒤집어도 그리드가 깨지지 않는다', () => {
    for (const frame of WORKER_FRAMES) {
      expect(validateSprite(mirrorSprite(frame))).toEqual([]);
    }
  });
});
