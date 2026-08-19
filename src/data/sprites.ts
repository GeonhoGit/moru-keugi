/**
 * 도트 스프라이트 (계획서 4.6).
 *
 * 32×32 오브젝트 그리드. 팔레트는 4.6 색상표에서만 고른다.
 * `A`는 화로 티어 강조색이라 그릴 때 티어 색으로 덮어쓴다.
 *
 * 화로는 계획서 4.4 "화로 불꽃 크기와 색상"에 맞춰 티어마다 불꽃 크기와 장식이 달라진다.
 * 색만 바뀌는 게 아니라 형태가 자라야 성장이 눈에 보이기 때문이다.
 */
import { PIXEL_GRID, type PixelSpriteData } from '../theme/pixel';

/** 공용 금속 팔레트 — 8색 */
/**
 * 금속 팔레트.
 *
 * 명도가 촘촘해야 금속이 금속으로 보인다. 예전에는 본체에 쓸 값이
 * `d`(34) → `m`(63) → `l`(150) 셋뿐이라 가운데가 87단계나 비어 있었고,
 * 그래서 면이 평평하고 하이라이트가 뚝 끊겼다. 사이를 채워 8단계로 만들었다.
 *
 * 빛은 위에서 온다. 위를 향한 면일수록 밝은 값을 쓴다.
 */
const METAL_PALETTE = {
  e: '#171012', // 바닥에 닿는 가장 깊은 그늘
  d: '#2a2018', // 외곽선·그림자
  s: '#3a3028', // 금속의 그늘진 면
  m: '#4a3d31', // 금속 본체
  t: '#6b5b49', // 본체에 빛이 스치는 면
  u: '#8a7866', // 밝은 면
  l: '#a8927c', // 금속 하이라이트
  w: '#f5ead9', // 불꽃 중심
  g: '#e0b479', // 금빛 장식
  G: '#f0d3a0', // 금빛 장식의 밝은 면
  r: '#d1450f', // 깊은 불씨
  A: '#ff7a3d', // 화로 강조색 (티어에 따라 교체)
} as const;

const object = (id: string, rows: readonly string[]): PixelSpriteData => ({
  id,
  grid: PIXEL_GRID.object,
  palette: METAL_PALETTE,
  rows,
});

// ---------------------------------------------------------------------------
// 화로 4단계 (계획서 6.1 / 4.4)
// ---------------------------------------------------------------------------

/** 티어 0 · 초심자의 화로 — 작은 불씨, 장식 없는 돌 화덕 */
export const FORGE_TIER_0 = object('forge_tier_0', [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............AA................',
    '.............AwwA...............',
    '.............AwwA...............',
    '..............AA................',
    '................................',
    '................................',
    '....dddddddddddddddddddddd......',
    '...dllllllllllllllllllllllud....',
    '...dlluuuuuuuuuuuuuuuuuuuuud....',
    '...dlldddddddddddddddddddutd....',
    '...duudrrrrrrrrrrrrrrrrrdttd....',
    '...duudAAAAAAAAAAAAAAAAAdtmd....',
    '...duudAAAAAAAwwwAAAAAAAdtmd....',
    '...dttdAAAAAAwwwwwAAAAAAdmmd....',
    '...dttdAAAAAAwwwwwAAAAAAdmsd....',
    '...dttdddddddddddddddddddmsd....',
    '...dttmmmmmmmmmmmmmmmmmmmmsd....',
    '...dttmmmmmmmmmmmmmmmmmmmmsd....',
    '...dmmsssssssssssssssssssssd....',
    '...eddddddddddddddddddddddde....',
    '....dmmsssssssssssssssssssd.....',
    '....dmmsssssssssssssssssssd.....',
    '....eeeeeeeeeeeeeeeeeeeeeee.....',
    '................................',
    '................................',
    '................................',
    '................................',
]);

/** 티어 1 · 타오르는 화로 — 불꽃이 커지고 중심이 밝아진다 */
export const FORGE_TIER_1 = object('forge_tier_1', [
    '................................',
    '................................',
    '................................',
    '..............AA................',
    '.............AAAA...............',
    '............AAwwAA..............',
    '...........AAwwwwAA.............',
    '...........AAwwwwAA.............',
    '............AAwwAA..............',
    '.............AAAA...............',
    '..............AA................',
    '....dddddddddddddddddddddd......',
    '...dllllllllllmmllllllllllud....',
    '...dlluuuuuuuummuuuuuuuuuuud....',
    '...dlldddddddddddddddddddutd....',
    '...duudrrrrrrrrrrrrrrrrrdttd....',
    '...duudAAAAAAAAAAAAAAAAAdtmd....',
    '...duudAAAAAAAwwwAAAAAAAdtmd....',
    '...dttdAAAAAAwwwwwAAAAAAdmmd....',
    '...dttdAAAAAAwwwwwAAAAAAdmsd....',
    '...dttdddddddddddddddddddmsd....',
    '...dttmmmmmmmmssmmmmmmmmmmsd....',
    '...dttmmmmmmmmssmmmmmmmmmmsd....',
    '...dmmsssssssssssssssssssssd....',
    '...eddddddddddddddddddddddde....',
    '....dmmsssssssssssssssssssd.....',
    '....dmmsssssssssssssssssssd.....',
    '....eeeeeeeeeeeeeeeeeeeeeee.....',
    '................................',
    '................................',
    '................................',
    '................................',
]);

/** 티어 2 · 작열하는 용광로 — 불꽃이 화면 위로 뻗고 금빛 테가 붙는다 */
export const FORGE_TIER_2 = object('forge_tier_2', [
    '..............rr................',
    '.............rrrr...............',
    '............AAAAAA..............',
    '...........AAAwwAAA.............',
    '..........AAAwwwwAAA............',
    '.........AAAwwwwwwAAA...........',
    '.........AAAwwwwwwAAA...........',
    '..........AAAwwwwAAA............',
    '...........AAAwwAAA.............',
    '............AwwwwA..............',
    '.............wwww...............',
    '....dddddddddddddddddddddd......',
    '...dgggggggggggggggggggggggd....',
    '...dlluuuuuuussssuuuuuuuuuud....',
    '...dlldddddddddddddddddddutd....',
    '...duudrrrrrrrrrrrrrrrrrdttd....',
    '...duudAAAAwwwwwwwAAAAAAdtmd....',
    '...duudAAAwwwwwwwwwAAAAAdtmd....',
    '...dttdAAAAwwwwwwwAAAAAAdmmd....',
    '...dttdAAAAAAwwwwwAAAAAAdmsd....',
    '...dttdddddddddddddddddddmsd....',
    '...dttmmmmmmmssssmmmmmmmmmsd....',
    '...dttmmmmmmmssssmmmmmmmmmsd....',
    '...dgggggggggggggggggggggggd....',
    '...eddddddddddddddddddddddde....',
    '....dmmsssssssssssssssssssd.....',
    '....dmmsssssssssssssssssssd.....',
    '....eeeeeeeeeeeeeeeeeeeeeee.....',
    '................................',
    '................................',
    '................................',
    '................................',
]);

/** 티어 3 · 용염의 성화 — 불꽃이 화로를 집어삼키고 왕실 장식이 선다 */
export const FORGE_TIER_3 = object('forge_tier_3', [
    '.............rrrr...............',
    '...........AAAAAAAA.............',
    '..........AAAwwwwAAA............',
    '.........AAAwwwwwwAAA...........',
    '........AAAwwwwwwwwAAA..........',
    '.......AAAwwwwwwwwwwAAA.........',
    '.......AAAwwwwwwwwwwAAA.........',
    '........AAAwwwwwwwwAAA..........',
    '.........AAAwwwwwwAAA...........',
    '..........AAwwwwwwAA............',
    '...........AwwwwwwA.............',
    '..g.dddddddddddddddddddddd.g....',
    '..gdgggggggggggggggggggggggdg...',
    '..gdlluuuuussssssssuuuuuuuudg...',
    '..gdlldddddddddddddddddddutdg...',
    '..gduudAAAwwwwwwwwwwwAAAdttdg...',
    '..gduudAAwwwwwwwwwwwwwAAdtmdg...',
    '..gduudwwwwwwwwwwwwwwwwwdtmdg...',
    '..gdttdAAwwwwwwwwwwwwwAAdmmdg...',
    '..gdttdAAAwwwwwwwwwwwAAAdmsdg...',
    '..gdttdddddddddddddddddddmsdg...',
    '..gdttmmmmmssssssssmmmmmmmsdg...',
    '..gdttmmmmmssssssssmmmmmmmsdg...',
    '..gegggggggggggggggggggggggeg...',
    '..g.ddddddddddddddddddddddd.g...',
    '....dmmsssssssssssssssssssd.....',
    '....dmmsssssssssssssssssssd.....',
    '....eeeeeeeeeeeeeeeeeeeeeee.....',
    '................................',
    '................................',
    '................................',
    '................................',
]);

export const FORGE_TIER_SPRITES = [
  FORGE_TIER_0,
  FORGE_TIER_1,
  FORGE_TIER_2,
  FORGE_TIER_3,
] as const;

/** 화로 티어 번호로 스프라이트를 고른다. 범위를 벗어나면 가장 가까운 단계를 쓴다. */
export const getForgeSprite = (tier: number): PixelSpriteData =>
  FORGE_TIER_SPRITES[Math.min(FORGE_TIER_SPRITES.length - 1, Math.max(0, tier))]!;

// ---------------------------------------------------------------------------
// 모루 (계획서 4.4 "모루 외형과 타격 이펙트")
// ---------------------------------------------------------------------------

/**
 * 낡은 모루 — 티어 0~1.
 *
 * 왼쪽의 뿔과 상판 오른쪽의 하디홀이 이것을 모루로 읽게 한다.
 * 좌우 대칭으로 그리면 모래시계나 술잔으로 보인다.
 *
 * 음영은 면의 방향을 따른다. 빛은 왼쪽 위에서 온다.
 * 위를 향한 면이 가장 밝고(l), 옆면은 중간(t·m), 아래를 향한 면과
 * 바닥에 가까운 곳은 가장 어둡다(s·e). 각 가로줄의 왼쪽을 한 단계 밝게 해
 * 허리가 한 색으로 납작해지지 않게 했다.
 */
export const ANVIL_WORN = object('anvil_worn', [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......dddddddddddddddd..dddd...',
    '.......dlllllllllllllld..dlld...',
    '.....ddlluuuuuuuuuuuuuudduutd...',
    '..dddllttttttttttttttttllttmd...',
    '.deelluttttttttttttttttuuttmd...',
    '....eeeeettmmmmmmmmmmmmttmsee...',
    '.........eettmmmmmmmmmmmeee.....',
    '...........eettmmmmmmsee........',
    '.............dmmsssssd..........',
    '.............dmmsssssd..........',
    '.............dmmsssssd..........',
    '.............dmmsssssd..........',
    '.............dmmsssssd..........',
    '.............dmmsssssd..........',
    '.............dmmsssssd..........',
    '...........ddmmsssssssdd........',
    '..........duusssssssssutd.......',
    '.........duutssssssssstttd......',
    '........duummsssssssssmmttd.....',
    '........dutmmsssssssssmmmmd.....',
    '........eeeeeeeeeeeeeeeeeee.....',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
]);

/** 명장의 모루 — 티어 2~3. 금빛 테와 룬 각인이 더해진다. */
export const ANVIL_MASTERWORK = object('anvil_masterwork', [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......GGGGGGGGGGGGGGGG..GGGG...',
    '.......gllllllllllllllg..gllg...',
    '.....gglluuuuuuuuuuuuuugguutg...',
    '..gggllttttttttttttttttllttmg...',
    '.geelluttttttttttttAtAtuuttmg...',
    '....eeeeettmmmmmmmmmAmmttmsee...',
    '.........eettmmmmmmmmmmmeee.....',
    '...........eettmmmmmmsee........',
    '.............gmmsssssg..........',
    '.............gmmsssssg..........',
    '.............gmmsssssg..........',
    '.............gmmsAsssg..........',
    '.............gmmsssssg..........',
    '.............gmmsssssg..........',
    '.............gmmsssssg..........',
    '...........ggmmsssssssgg........',
    '..........guusssssssssutg.......',
    '.........guutssssssssstttg......',
    '........guummsssssssssmmttg.....',
    '........gutmmsssssssssmmmmg.....',
    '........eeeeeeeeeeeeeeeeeee.....',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
]);

/** 화로 티어에 따라 모루 외형이 달라진다 (계획서 4.4) */
export const getAnvilSprite = (tier: number): PixelSpriteData =>
  tier >= 2 ? ANVIL_MASTERWORK : ANVIL_WORN;

// ---------------------------------------------------------------------------
// 타격 이펙트 (계획서 4.6 "4~6프레임 정도의 작은 도트 스프라이트 애니메이션")
// ---------------------------------------------------------------------------

const spark = (id: string, rows: readonly string[]): PixelSpriteData => ({
  id,
  grid: PIXEL_GRID.icon,
  palette: METAL_PALETTE,
  rows,
});

export const SPARK_FRAMES: readonly PixelSpriteData[] = [
  spark('spark_0', [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......AA.......',
    '.......AA.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  spark('spark_1', [
    '................',
    '................',
    '................',
    '................',
    '......A..A......',
    '.....AAwwAA.....',
    '.....AAwwAA.....',
    '......A..A......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  spark('spark_2', [
    '................',
    '................',
    '....A......A....',
    '.....A....A.....',
    '......AwwA......',
    '....AAwwwwAA....',
    '....AAwwwwAA....',
    '......AwwA......',
    '.....A....A.....',
    '....A......A....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  spark('spark_3', [
    '................',
    '..r..........r..',
    '................',
    '....r......r....',
    '................',
    '......A..A......',
    '................',
    '................',
    '......A..A......',
    '................',
    '....r......r....',
    '................',
    '..r..........r..',
    '................',
    '................',
    '................',
  ]),
];


// ---------------------------------------------------------------------------
// 앱 아이콘 (스토어·홈 화면)
// ---------------------------------------------------------------------------

/**
 * 32칸 폭 안에 가운데 정렬해 한 줄을 만든다.
 *
 * 아이콘은 좌우 대칭이라 손으로 점을 세는 것보다 이쪽이 안전하다.
 * 실제 그림은 아래 `APP_ICON`의 심지 문자열이고, 여백만 계산으로 채운다.
 */
const centered = (core: string): string => {
  const left = Math.floor((PIXEL_GRID.object - core.length) / 2);
  return '.'.repeat(left) + core + '.'.repeat(PIXEL_GRID.object - core.length - left);
};

/**
 * 앱 아이콘 — 불꽃 아래 놓인 모루.
 *
 * 홈 화면에서는 48dp 안팎으로 작아지므로 게임 안 스프라이트보다 형태를 굵게 잡았다.
 * 가는 선은 그 크기에서 사라진다.
 */
export const APP_ICON: PixelSpriteData = {
  id: 'app_icon',
  grid: PIXEL_GRID.object,
  palette: METAL_PALETTE,
  rows: [
    '',
    'AA',
    'AAAA',
    'AAwwAA',
    'AAwwwwAA',
    'AAAwwwwAAA',
    'AAAwwwwAAA',
    'AAwwwwAA',
    'AAwwAA',
    'AAAA',
    '',
    '',
    // 상단 슬래브와 받침은 밝은 면으로 둔다.
    // 어두운 배경 위에서 홈 화면 크기(48dp 안팎)로 줄어들면
    // 중간 명도만으로는 형태가 덩어리로 뭉개진다.
    'd'.repeat(24),
    'd' + 'l'.repeat(24) + 'd',
    'd' + 'l'.repeat(24) + 'd',
    'd' + 'l'.repeat(24) + 'd',
    'd' + 'm'.repeat(22) + 'd',
    'd' + 'm'.repeat(16) + 'd',
    'd' + 'm'.repeat(10) + 'd',
    'd' + 'm'.repeat(8) + 'd',
    'd' + 'm'.repeat(8) + 'd',
    'd' + 'm'.repeat(8) + 'd',
    'd' + 'm'.repeat(8) + 'd',
    'd' + 'm'.repeat(8) + 'd',
    'd' + 'm'.repeat(10) + 'd',
    'd' + 'l'.repeat(12) + 'd',
    'd' + 'l'.repeat(14) + 'd',
    'd' + 'l'.repeat(16) + 'd',
    'd' + 'l'.repeat(18) + 'd',
    'd'.repeat(20),
    '',
    '',
  ].map(centered),
};

/** 모든 스프라이트 — 그리드 정합성 테스트가 이 목록을 검사한다. */
export const SPRITES = [
  ...FORGE_TIER_SPRITES,
  ANVIL_WORN,
  ANVIL_MASTERWORK,
  ...SPARK_FRAMES,
  APP_ICON,
] as const;
