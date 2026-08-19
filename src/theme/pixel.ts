/**
 * 도트(픽셀 아트) 규칙 (계획서 4.6).
 *
 * 계획서가 정한 두 가지를 코드에서 강제한다:
 * 1. 원본 그리드 기준을 고정한다 (아이콘 16/24, 오브젝트 32, 캐릭터 48, 배경 320×180).
 * 2. 확대·축소는 정수 배율(1x/2x/3x/4x)로만 한다. 1.5x 같은 소수 배율은 쓰지 않는다.
 *
 * nearest-neighbor 스케일링의 실제 처리 방식은 계획서 4.6이 적어 둔 대로
 * Phase 4에서 실기기로 검증한다. 여기서는 "정수 배율만 쓴다"는 조건을 지켜
 * 보간이 일어날 여지를 최소화하는 데까지 책임진다.
 */

/** 원본 그리드 기준 (px) */
export const PIXEL_GRID = {
  /** 업그레이드·업적·유물 아이콘 */
  icon: 16,
  /** 조금 더 큰 아이콘 */
  iconLarge: 24,
  /** 오브젝트 스프라이트 (모루, 화로 등) */
  object: 32,
  /** 캐릭터·NPC */
  character: 48,
  /** 배경 기준 해상도 */
  backgroundWidth: 320,
  backgroundHeight: 180,
} as const;

/** 계획서가 허용하는 배율. 소수 배율은 목록에 없다. */
export const ALLOWED_SCALES = [1, 2, 3, 4] as const;
export type PixelScale = (typeof ALLOWED_SCALES)[number];

export const MAX_SCALE = 4;

/**
 * 주어진 공간에 들어가는 가장 큰 정수 배율을 고른다.
 *
 * 공간이 원본보다 작아도 1보다 작은 배율은 돌려주지 않는다.
 * 도트는 축소하면 픽셀이 뭉개지므로, 줄여야 한다면 더 작은 그리드의
 * 스프라이트를 따로 그리는 편이 맞다.
 */
export const getPixelScale = (availablePx: number, sourcePx: number): PixelScale => {
  if (!Number.isFinite(availablePx) || sourcePx <= 0) return 1;
  const raw = Math.floor(availablePx / sourcePx);
  const clamped = Math.min(MAX_SCALE, Math.max(1, raw));
  return clamped as PixelScale;
};

/** 원본 크기와 배율로 실제 표시 크기를 구한다. 항상 정수 픽셀이 나온다. */
export const getPixelSize = (sourcePx: number, scale: PixelScale): number => sourcePx * scale;

/** 정수 배율인지 검사한다. 테스트와 개발 중 확인에 쓴다. */
export const isIntegerScale = (scale: number): scale is PixelScale =>
  Number.isInteger(scale) && scale >= 1 && scale <= MAX_SCALE;

/**
 * 도트 스프라이트 한 장.
 *
 * 실제 PNG 에셋이 준비되기 전까지는 문자 행렬로 도트를 직접 찍는다.
 * `rows`의 각 문자는 `palette`의 색상 키이고, `.`은 투명이다.
 * 나중에 Aseprite로 만든 PNG로 바꿀 때는 이 구조를 `source`로 교체하면 된다.
 */
export interface PixelSpriteData {
  readonly id: string;
  /** 원본 그리드 크기. `rows`의 길이·폭과 일치해야 한다. */
  readonly grid: number;
  /** 문자 → 색상. 계획서 4.6의 "캐릭터당 8~16색" 제한을 지킨다. */
  readonly palette: Readonly<Record<string, string>>;
  readonly rows: readonly string[];
}

/**
 * 배경을 그릴 크기를 정한다.
 *
 * **배율은 dp가 아니라 기기 픽셀로 고른다.** 안드로이드 밀도는 정수가 아닌 경우가
 * 흔하다 (Pixel 8은 420dpi = 2.625배). dp에서 320의 정수 배를 골라도 화면에서는
 * 그 값에 밀도가 곱해져 정수가 깨지고, React Native가 고른 `@3x` 원본(960px)이
 * 840px로 줄어들며 보간이 낀다. 실제로 기기에서 재 보니 원본에 두 가지뿐이던 색이
 * 화면에서는 열다섯 가지로 늘어나 있었다.
 *
 * 픽셀에서 정수 배를 고르면 960px 원본이 960px로 그려져 1:1로 맞는다.
 * 돌려주는 dp 값은 정수가 아닐 수 있는데, dp는 정수일 필요가 없다.
 */
export const getBackgroundLayout = (
  availableWidthDp: number,
  density: number,
): { scale: PixelScale; widthDp: number; heightDp: number } => {
  const safeDensity = density > 0 ? density : 1;
  const scale = getPixelScale(availableWidthDp * safeDensity, PIXEL_GRID.backgroundWidth);
  return {
    scale,
    widthDp: (PIXEL_GRID.backgroundWidth * scale) / safeDensity,
    heightDp: (PIXEL_GRID.backgroundHeight * scale) / safeDensity,
  };
};

/**
 * 좌우로 뒤집은 같은 스프라이트.
 *
 * 뒤집기를 `transform: [{ scaleX: -1 }]`로 하지 않는 이유가 있다.
 * 그 값이 `Animated` 값과 같은 `transform` 배열에 들어가면, RN은 배열 안의
 * 정적 항목을 애니메이션 노드를 만들 때 한 번 읽어 네이티브에 굳혀 버린다.
 * 그 뒤로는 `scaleX`를 아무리 바꿔도 화면이 따라오지 않는다
 * (`AnimatedTransform.__getNativeConfig`의 `type: 'static'` 항목).
 * 도트를 직접 뒤집으면 애니메이션 계층을 거치지 않아 그럴 일이 없다.
 *
 * 행 문자열을 뒤집는 것은 c번째 칸을 (grid-1-c)번째로 옮기는 것이므로
 * 스프라이트 한가운데를 축으로 뒤집은 것과 결과가 같다.
 *
 * 같은 스프라이트는 한 번만 뒤집어 두고 다시 쓴다. 걷는 동안 프레임마다
 * 다시 만들면 `PixelCanvas`의 행 계산도 매번 처음부터 하게 된다 (계획서 13.4).
 */
const mirrorCache = new WeakMap<PixelSpriteData, PixelSpriteData>();

export const mirrorSprite = (sprite: PixelSpriteData): PixelSpriteData => {
  const cached = mirrorCache.get(sprite);
  if (cached) return cached;

  const mirrored: PixelSpriteData = {
    ...sprite,
    id: `${sprite.id}-mirrored`,
    rows: sprite.rows.map((row) => [...row].reverse().join('')),
  };
  mirrorCache.set(sprite, mirrored);
  return mirrored;
};

/** 스프라이트가 선언한 그리드와 실제 행렬 크기가 맞는지 확인한다. */
export const validateSprite = (sprite: PixelSpriteData): string[] => {
  const errors: string[] = [];

  if (sprite.rows.length !== sprite.grid) {
    errors.push(`${sprite.id}: 행 수가 ${sprite.rows.length}, 그리드는 ${sprite.grid}입니다.`);
  }

  sprite.rows.forEach((row, index) => {
    if (row.length !== sprite.grid) {
      errors.push(`${sprite.id}: ${index}번 행의 길이가 ${row.length}, 그리드는 ${sprite.grid}입니다.`);
    }
    for (const char of row) {
      if (char !== '.' && sprite.palette[char] === undefined) {
        errors.push(`${sprite.id}: 팔레트에 없는 문자 '${char}'가 있습니다.`);
        return;
      }
    }
  });

  const colorCount = Object.keys(sprite.palette).length;
  if (colorCount > 16) {
    errors.push(`${sprite.id}: 색상이 ${colorCount}개로 권장 상한 16개를 넘습니다.`);
  }

  return errors;
};
