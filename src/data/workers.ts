/**
 * 공방에서 일하는 모습 (계획서 4.4 "배경 NPC와 제작 중인 무기").
 *
 * 공방은 위에서 비스듬히 내려다보는 시점이다.
 * 옆에서 보면 앞뒤가 가짜라서 일꾼이 설비와 같은 높이에 설 수 없었다.
 * 위에서 보면 화면의 위아래가 곧 앞뒤이므로 설비 사방 어디에나 설 수 있고,
 * 모루 윗면이 보이니 실제로 그 위를 두드릴 수 있다.
 *
 * 그래서 **모든 바닥 물체는 22행에 접지한다**. 접지점이 어긋나면 같은 자리에 선
 * 사람과 설비가 서로 다른 바닥에 있는 것처럼 보인다.
 * 발밑 그림자는 장식이 아니라 바닥 어디에 서 있는지 알려 주는 유일한 단서다.
 *
 * 설비는 계획서 4.6이 정한 대로 자세마다 2~3프레임만 쓴다.
 * 망치질만 6프레임이다 — 세 장으로는 내려친 뒤 위로 순간이동해 동작으로 읽히지
 * 않았다 (계획서 4.6의 2026-08-19 개정).
 * 대장간 탭은 여전히 옆모습이다. 그쪽은 모루를 눌러 두드리는 화면이라
 * 위에서 보면 타격감이 죽는다.
 */
import { mirrorSprite, PIXEL_GRID, type PixelSpriteData } from '../theme/pixel';

/** 대장장이 팔레트 */
const SMITH_PALETTE = {
  d: '#241a13', // 외곽선
  s: '#3d3128', // 접힌 자리의 그늘
  b: '#6d5c4c', // 가죽 앞치마
  n: '#8f7a64', // 앞치마에 빛이 닿는 면
  h: '#5a3f2b', // 머리카락
  w: '#f5ead9', // 머릿수건
  y: '#c08a5e', // 피부 그늘
  k: '#e0a878', // 피부
  m: '#4a4038', // 망치 머리의 어두운 면
  l: '#9c8f82', // 망치 머리에 빛이 닿는 면
  g: '#8a5c33', // 나무 자루
  D: '#1d140e', // 발밑 그림자
  A: '#ff7a3d', // 화로 강조색 (티어에 따라 교체)
} as const;

/**
 * 설비 팔레트.
 *
 * 금속과 가죽 모두 명도 사이가 비어 있어 면이 평평했다.
 * 금속은 `d`(18) → `m`(92) → `l`(163)로 70단계씩 건너뛰었고 가죽은 두 단계뿐이었다.
 * 사이를 채워 금속 7단계, 가죽 3단계로 만들었다. 빛은 왼쪽 위에서 온다.
 */
const MACHINE_PALETTE = {
  e: '#0d0906', // 아래를 향한 면의 가장 깊은 그늘
  d: '#191009', // 외곽선 — 바닥보다 확실히 어두워야 형체가 선다
  s: '#3d3228', // 금속의 그늘진 면
  v: '#4a3e33', // 가죽의 그늘진 면
  m: '#6b5947', // 금속·돌
  b: '#6d5c4c', // 나무·가죽
  t: '#8a7663', // 금속에 빛이 스치는 면
  n: '#8f7a64', // 가죽에 빛이 닿는 면
  u: '#a08c78', // 금속의 밝은 면
  l: '#b3a08c', // 위에서 빛이 닿는 면
  r: '#d1450f', // 깊은 불씨
  g: '#e0b479', // 나무 손잡이
  w: '#f5ead9', // 불꽃 심지
  D: '#1d140e', // 바닥 그림자
  A: '#ff7a3d', // 화로 강조색 (티어에 따라 교체)
} as const;

const smith = (id: string, rows: readonly string[]): PixelSpriteData => ({
  id,
  grid: PIXEL_GRID.iconLarge,
  palette: SMITH_PALETTE,
  rows,
});

const machine = (id: string, rows: readonly string[]): PixelSpriteData => ({
  id,
  grid: PIXEL_GRID.iconLarge,
  palette: MACHINE_PALETTE,
  rows,
});

/** 공방 스프라이트의 격자 크기 */
export const APPRENTICE_GRID = PIXEL_GRID.iconLarge;

/**
 * 바닥에 닿는 행.
 *
 * 배치 코드는 이 값만 믿고 `top = 바닥y - (GROUND_ROW + 1) * 배율`로 모든 것을 놓는다.
 * 사람과 설비의 배율이 달라도 접지선은 정확히 맞는다.
 */
export const GROUND_ROW = 22;

// ---------------------------------------------------------------------------
// 견습 대장장이
// ---------------------------------------------------------------------------

/**
 * 망치질 6프레임 (계획서 4.4).
 *
 * 예전에는 위·중간·아래 세 장이었는데, 아래까지 내려친 다음 곧바로 위로
 * 순간이동해서 내려치는 동작이 아니라 깜빡임으로 보였다.
 *
 * 사람이 망치를 쓸 때는 **들어 올리는 데 오래 걸리고 내려치는 것은 순식간이다.**
 * 프레임 간격은 하나뿐이므로 시간 배분을 프레임 개수로 만든다.
 * 내려치기에 두 칸, 되돌아 올리기에 네 칸을 준다.
 *
 *   최고점 → 내려침 → 타격 → 반동 → 들어 올림 → 거의 최고점 → (최고점)
 *   └── 2칸 ──┘        └────────── 4칸 ──────────┘
 *
 * 팔도 함께 움직인다. 팔을 몸통에 붙박아 두고 망치만 옮기면 도구가 혼자
 * 떠다니는 것처럼 보인다. 어깨는 제자리에 두고 손 위치를 프레임마다 옮겨,
 * 최고점에서는 팔꿈치를 굽히고 타격에서는 아래로 뻗는다.
 */
/** 최고점 — 망치를 가장 높이 들었다 */
const APPRENTICE_HIT_TOP = smith('worker_apprentice_0', [
    '........................',
    '........................',
    '........................',
    '........ddddd.....dddddd',
    '.......dhhhhhd....dlllld',
    '......dhhhhhhhd...dlmmld',
    '......dhhhhhhhd...dddddd',
    '......dwwwwwwwd...g.....',
    '......dkkkkkkkd..g......',
    '......dkkkkdkkd..g......',
    '.......dkkkkkd..d.......',
    '........dyyyd..dkd......',
    '....dbbbbbbbbbdkd.......',
    '....dbnnnnnnnbdk........',
    '....dbnnnnnnnbdd........',
    '....dbnnnnnnnbd.........',
    '....dsbbbbbbbsd.........',
    '......dbbddbbd..........',
    '......dbbddbbd..........',
    '.....dssd..dssd.........',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

/** 내려침 — 지나간 자취를 남겨 방향을 읽힌다 */
const APPRENTICE_HIT_SWING = smith('worker_apprentice_1', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.....d.d.',
    '......dhhhhhhhd.....d.d.',
    '......dwwwwwwwd.....d.d.',
    '......dkkkkkkkd.....d.d.',
    '......dkkkkdkkd...dddddd',
    '.......dkkkkkd....dlllld',
    '........dyyyd.....dlmmld',
    '....dbbbbbbbbbd..ddddddd',
    '....dbnnnnnnnbdddkkd....',
    '....dbnnnnnnnbdkkdd.....',
    '....dbnnnnnnnbddd.......',
    '....dsbbbbbbbsd.........',
    '......dbbddbbd..........',
    '......dbbddbbd..........',
    '.....dssd..dssd.........',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

/** 타격 — 모루에 닿는 순간, 불티가 튄다 */
const APPRENTICE_HIT_IMPACT = smith('worker_apprentice_2', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.........',
    '......dhhhhhhhd.........',
    '......dwwwwwwwd.........',
    '......dkkkkkkkd.........',
    '......dkkkkdkkd.........',
    '.......dkkkkkd..........',
    '........dyyyd...........',
    '....dbbbbbbbbbd.........',
    '....dbnnnnnnnbddd.......',
    '....dbnnnnnnnbdkkddddddd',
    '....dbnnnnnnnbdddkdlllld',
    '....dsbbbbbbbsd..ddlmmld',
    '......dbbddbbd....dddddd',
    '......dbbddbbd...A..A..A',
    '.....dssd..dssd.A.....A.',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

/** 반동 — 살짝 튀어 오른다 */
const APPRENTICE_HIT_RECOIL = smith('worker_apprentice_3', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.........',
    '......dhhhhhhhd.........',
    '......dwwwwwwwd.........',
    '......dkkkkkkkd.........',
    '......dkkkkdkkd.........',
    '.......dkkkkkd..........',
    '........dyyyd...........',
    '....dbbbbbbbbbd...dddddd',
    '....dbnnnnnnnbdddddlllld',
    '....dbnnnnnnnbdkkkdlmmld',
    '....dbnnnnnnnbdddddddddd',
    '....dsbbbbbbbsd.........',
    '......dbbddbbd..........',
    '......dbbddbbd....A...A.',
    '.....dssd..dssd.........',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

/** 들어 올림 */
const APPRENTICE_HIT_LIFT = smith('worker_apprentice_4', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.........',
    '......dhhhhhhhd.........',
    '......dwwwwwwwd.........',
    '......dkkkkkkkd...dddddd',
    '......dkkkkdkkd...dlllld',
    '.......dkkkkkd....dlmmld',
    '........dyyyd.....dddddd',
    '....dbbbbbbbbbd.ddg.....',
    '....dbnnnnnnnbddkkd.....',
    '....dbnnnnnnnbdkdd......',
    '....dbnnnnnnnbdd........',
    '....dsbbbbbbbsd.........',
    '......dbbddbbd..........',
    '......dbbddbbd..........',
    '.....dssd..dssd.........',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

/** 거의 최고점 */
const APPRENTICE_HIT_RAISE = smith('worker_apprentice_5', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd....dddddd',
    '......dhhhhhhhd...dlllld',
    '......dhhhhhhhd...dlmmld',
    '......dwwwwwwwd...dddddd',
    '......dkkkkkkkd...g.....',
    '......dkkkkdkkd..g......',
    '.......dkkkkkd...g......',
    '........dyyyd...d.......',
    '....dbbbbbbbbbddkd......',
    '....dbnnnnnnnbdkd.......',
    '....dbnnnnnnnbdd........',
    '....dbnnnnnnnbd.........',
    '....dsbbbbbbbsd.........',
    '......dbbddbbd..........',
    '......dbbddbbd..........',
    '.....dssd..dssd.........',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

const APPRENTICE_WALK_A = smith('worker_apprentice_walk_0', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.........',
    '......dhhhhhhhd.dddddd..',
    '......dwwwwwwwd.dlllld..',
    '......dkkkkkkkd.dlmmld..',
    '......dkkkkdkkd.dddddd..',
    '.......dkkkkkd...dgd....',
    '........dyyyd....dgd....',
    '....dbbbbbbbbbd..dgd....',
    '....dbnnnnnnnbddddgd....',
    '....dbnnnnnnnbkkkkd.....',
    '....dbnnnnnnnbd..ddd....',
    '....dsbbbbbbbsd.........',
    '......dbbddbbd..........',
    '.....dbbd..dbbd.........',
    '....dssd....dssd........',
    '....dddd....dddd........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

const APPRENTICE_WALK_B = smith('worker_apprentice_walk_1', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.........',
    '......dhhhhhhhd.dddddd..',
    '......dwwwwwwwd.dlllld..',
    '......dkkkkkkkd.dlmmld..',
    '......dkkkkdkkd.dddddd..',
    '.......dkkkkkd...dgd....',
    '........dyyyd....dgd....',
    '....dbbbbbbbbbd..dgd....',
    '....dbnnnnnnnbddddgd....',
    '....dbnnnnnnnbkkkkd.....',
    '....dbnnnnnnnbd..ddd....',
    '....dsbbbbbbbsd.........',
    '......dbbddbbd..........',
    '......dbbddbbd..........',
    '......dssddssd..........',
    '......dddddddd..........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

const APPRENTICE_HEAT_A = smith('worker_apprentice_heat_0', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.........',
    '......dhhhhhhhd.........',
    '......dwwwwwwwd.........',
    '......dkkkkkkkd.........',
    '......dkkkkdkkd.........',
    '.......dkkkkkd..........',
    '........dyyyd...........',
    '....dbbbbbbbbbd.........',
    '....dbnnnnnnnbddd.......',
    '....dbnnnnnnnbkkkllld...',
    '....dbnnnnnnnbdddmmmAAAA',
    '....dsbbbbbbbsd..llld...',
    '......dbbddbbd..........',
    '......dbbddbbd..........',
    '.....dssd..dssd.........',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

const APPRENTICE_HEAT_B = smith('worker_apprentice_heat_1', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.........',
    '......dhhhhhhhd.........',
    '......dwwwwwwwd.........',
    '......dkkkkkkkd.........',
    '......dkkkkdkkd.........',
    '.......dkkkkkd..........',
    '........dyyyd...........',
    '....dbbbbbbbbbd.........',
    '....dbnnnnnnnbddd....A.A',
    '....dbnnnnnnnbkkkllld...',
    '....dbnnnnnnnbdddmmmAwwA',
    '....dsbbbbbbbsd..llld...',
    '......dbbddbbd..........',
    '......dbbddbbd..........',
    '.....dssd..dssd.........',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

const APPRENTICE_PUMP_UP = smith('worker_apprentice_pump_0', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.........',
    '......dhhhhhhhd.........',
    '......dwwwwwwwd.........',
    '......dkkkkkkkd.........',
    '......dkkkkdkkd.........',
    '.......dkkkkkd..........',
    '........dyyyd.ddd.......',
    '....dbbbbbbbbbkkkdg.....',
    '....dbnnnnnnnbddd.......',
    '....dbnnnnnnnbd.........',
    '....dbnnnnnnnbd.........',
    '....dsbbbbbbbsd.........',
    '......dbbddbbd..........',
    '......dbbddbbd..........',
    '.....dssd..dssd.........',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

const APPRENTICE_PUMP_DOWN = smith('worker_apprentice_pump_1', [
    '........................',
    '........................',
    '........................',
    '........ddddd...........',
    '.......dhhhhhd..........',
    '......dhhhhhhhd.........',
    '......dhhhhhhhd.........',
    '......dwwwwwwwd.........',
    '......dkkkkkkkd.........',
    '......dkkkkdkkd.........',
    '.......dkkkkkd..........',
    '........dyyyd...........',
    '....dbbbbbbbbbd.........',
    '....dbnnnnnnnbd.........',
    '....dbnnnnnnnbddd.......',
    '....dbnnnnnnnbkkkdg.....',
    '....dsbbbbbbbsddd.......',
    '......dbbddbbd..........',
    '......dbbddbbd..........',
    '.....dssd..dssd.........',
    '.....dddd..dddd.........',
    '.....DDDDDDDDDD.........',
    '......DDDDDDDD..........',
    '........................',
]);

export const APPRENTICE_WALK_FRAMES = [APPRENTICE_WALK_A, APPRENTICE_WALK_B] as const;
export const APPRENTICE_WORK_FRAMES = [
  APPRENTICE_HIT_TOP,
  APPRENTICE_HIT_SWING,
  APPRENTICE_HIT_IMPACT,
  APPRENTICE_HIT_RECOIL,
  APPRENTICE_HIT_LIFT,
  APPRENTICE_HIT_RAISE,
] as const;
export const APPRENTICE_HEAT_FRAMES = [APPRENTICE_HEAT_A, APPRENTICE_HEAT_B] as const;
export const APPRENTICE_PUMP_FRAMES = [APPRENTICE_PUMP_UP, APPRENTICE_PUMP_DOWN] as const;

// ---------------------------------------------------------------------------
// 왼쪽을 보는 견습 대장장이
// ---------------------------------------------------------------------------

/**
 * 왼쪽을 보는 같은 동작.
 *
 * 위의 프레임은 모두 오른쪽을 보고 그렸다. 왼쪽 자리에 세울 사람은 이 목록을 쓴다.
 *
 * 그림은 원본을 좌우로 뒤집어 만든다. 옆모습 도트에서 반대 방향은 뒤집은 것과
 * 같은 그림이고, 두 벌을 따로 그리면 팔 길이나 앞치마 선 같은 것이 조금씩 어긋나
 * 걷다가 방향이 바뀔 때 몸이 튄다. 원본을 고치면 이쪽도 같이 따라온다.
 *
 * 한쪽만 손보고 싶어지면 (예: 왼손잡이 망치질) 여기서 그 프레임만 직접 그린
 * 행렬로 바꾸면 된다. 바깥에서 쓰는 것은 이 목록뿐이다.
 *
 * 그리는 시점은 앱을 켤 때 한 번이다. 프레임마다 뒤집으면 `PixelCanvas`의
 * 행 계산까지 매번 처음부터 하게 된다 (계획서 13.4).
 */
const facingLeft = (frames: readonly PixelSpriteData[]): readonly PixelSpriteData[] =>
  frames.map((frame) => ({ ...mirrorSprite(frame), id: `${frame.id}_left` }));

export const APPRENTICE_WALK_FRAMES_LEFT = facingLeft(APPRENTICE_WALK_FRAMES);
export const APPRENTICE_WORK_FRAMES_LEFT = facingLeft(APPRENTICE_WORK_FRAMES);
export const APPRENTICE_HEAT_FRAMES_LEFT = facingLeft(APPRENTICE_HEAT_FRAMES);
export const APPRENTICE_PUMP_FRAMES_LEFT = facingLeft(APPRENTICE_PUMP_FRAMES);

/**
 * 도구가 설비에 닿는 칸.
 *
 * 설비 옆에 세울 때 이 값만큼 왼쪽으로 당긴다.
 * 몸통 오른쪽 끝(BODY_RIGHT)이 설비 왼쪽 모서리에 닿게 두면 몸이 설비를 덮지 않는다.
 */
export const APPRENTICE_HAMMER_COLUMN = 20;
export const APPRENTICE_TONG_COLUMN = 21;
export const APPRENTICE_GRIP_COLUMN = 18;
export const APPRENTICE_BODY_RIGHT_COLUMN = 15;

/**
 * 왼쪽을 볼 때 그 도구가 오는 칸.
 *
 * 좌우를 뒤집으면 `c`번 칸이 `grid-1-c`번으로 간다. 맨 오른쪽 칸(23)이 0번이 되므로
 * `grid - c`가 아니라 `grid - 1 - c`다. 한 칸 차이지만 3배로 그리므로 3dp가 밀려
 * 집게가 화로를 비껴 든 것처럼 보인다.
 */
export const mirrorColumn = (column: number): number => APPRENTICE_GRID - 1 - column;

// ---------------------------------------------------------------------------
// 설비
// ---------------------------------------------------------------------------

const BELLOWS_OPEN = machine('worker_bellows_0', [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........dddddd..........',
    '......ddnnnnnbdd........',
    '.eggddnnbbbbbbnbd.......',
    '....dnnbbbbbbbbbbd......',
    '....dnnbbbbbbbbbvddlld..',
    '....dnnbbbbbbbbbvdelle..',
    '....dnnbvvvvvvbbvd......',
    '....enbvvvvvvvvvve......',
    '.....ebbvvvvvvvve.......',
    '......eebbvvvvee........',
    '........dddddd..........',
    '......enbvvvvvnnbe......',
    '.......dbbvvvvnbd.......',
    '.......dvddddddbe.......',
    '.......dvdddddbe........',
    '.......dddddddd.........',
    '....DDDDDDDDDDDDDDDD....',
    '.....DDDDDDDDDDDDDD.....',
    '........................',
]);

const BELLOWS_PRESSED = machine('worker_bellows_1', [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........dddddd..........',
    '......ddnnnnnbdd........',
    '.....dnnbbbbbbnbd.......',
    '....dnnbbbbbbbbbbddlldAA',
    '....dnnbbbbbbbbbvdelleAA',
    '.eggennbbbbbbbbbve......',
    '.....ennvvvvvvbve.......',
    '......eebbvvvvee........',
    '........eeeeee..........',
    '........................',
    '......ennnnnnnnnbe......',
    '.......dnnnnnnnbd.......',
    '.......dbddddddbe.......',
    '.......dbdddddbe........',
    '.......dddddddd.........',
    '....DDDDDDDDDDDDDDDD....',
    '.....DDDDDDDDDDDDDD.....',
    '........................',
]);

const COAL_FORGE_LOW = machine('worker_coal_forge_0', [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........w............',
    '..........AwA...........',
    '......dddddddddd........',
    '.....dllllutullud.......',
    '....dldrrrrrrrrdld......',
    '....dudAAAAAAAAdud......',
    '....dtdAAwwwwAAdtd......',
    '....etdAAwwwwAAdte......',
    '.....ettmmmsmmmse.......',
    '......edddddddde........',
    '.......dmmssssd.........',
    '.......dmmssssd.........',
    '......dmmsssssse........',
    '......dsdddddsd.........',
    '......ddddddddd.........',
    '....DDDDDDDDDDDDDDDD....',
    '.....DDDDDDDDDDDDDD.....',
    '........................',
]);

const COAL_FORGE_HIGH = machine('worker_coal_forge_1', [
    '........................',
    '........................',
    '........................',
    '...........A............',
    '..........www...........',
    '.........wwwww..........',
    '.........AwwwA..........',
    '..........AAA...........',
    '......dddddddddd........',
    '.....dllllmmmllud.......',
    '....dldrrrrrrrrdld......',
    '....dudAAAAAAAAdud......',
    '....dtdAAwwwwAAdtd......',
    '....etdAAwwwwAAdte......',
    '.....ettmmsssmmse.......',
    '......edddddddde........',
    '.......dmmssssd.........',
    '.......dmmssssd.........',
    '......dmmsssssse........',
    '......dsdddddsd.........',
    '......ddddddddd.........',
    '....DDDDDDDDDDDDDDDD....',
    '.....DDDDDDDDDDDDDD.....',
    '........................',
]);

const COAL_FORGE_BLAZE = machine('worker_coal_forge_2', [
    '...........r............',
    '..........rrr...........',
    '.........AAwAA..........',
    '.........AAwAA..........',
    '........AAwwwAA.........',
    '........AAwwwAA.........',
    '........AwwwwwA.........',
    '.........wwwww..........',
    '......dddddddddd........',
    '.....dlllmsssmlud.......',
    '....dldrrrrrrrrdld......',
    '....dudAAAAAAAAdud......',
    '....dtdAAwwwwAAdtd......',
    '....etdAAwwwwAAdte......',
    '.....ettmsssssmse.......',
    '......edddddddde........',
    '.......dmmssssd.........',
    '.......dmmssssd.........',
    '......dmmsssssse........',
    '......dsdddddsd.........',
    '......ddddddddd.........',
    '....DDDDDDDDDDDDDDDD....',
    '.....DDDDDDDDDDDDDD.....',
    '........................',
]);

/**
 * 풀무로 바람을 넣는 동안의 석탄 화로.
 *
 * 평소 불꽃(LOW↔HIGH)보다 한 단계씩 높은 두 장을 번갈아 쓴다.
 * 풀무·이 화로·풀무질하는 사람이 모두 같은 간격을 쓰므로
 * `spritePhase`가 셋의 박자를 맞춰 준다 — 누르는 순간 불이 커진다.
 */
export const COAL_FORGE_STOKED_FRAMES = [COAL_FORGE_HIGH, COAL_FORGE_BLAZE] as const;

/** 화로 — 공방 전용 탑뷰 스프라이트. 대장간 탭은 옆모습을 따로 쓴다. */
export const WORKSHOP_FORGE = machine('workshop_forge', [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...dddddddddddddddddd...',
    '...dlllllllllllllllud...',
    '...duddddddddddddddud...',
    '...dtdrrrrrwwrrrrrdtd...',
    '...dtdAwwwwwwwwwwAdtd...',
    '...dmdAAAAwwwwAAAAdmd...',
    '...dmddddddddddddddmd...',
    '...dttmmmmmmmmmmmmmsd...',
    '...edddddddddddddddde...',
    '....mmssssssssssssss....',
    '....mmssssssssssssss....',
    '....mmssssssssssssss....',
    '....dddddddddddddddd....',
    '...DDDDDDDDDDDDDDDDDD...',
    '....DDDDDDDDDDDDDDDD....',
    '........................',
]);

/** 모루 — 윗면이 보여 실제로 그 위를 두드릴 수 있다. */
export const WORKSHOP_ANVIL = machine('workshop_anvil', [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.....dddddddddddddd.....',
    '...ddllllllllllllud.....',
    '.eelluuuuuuuuuuuutd.....',
    '...eeeeuutttttttmee.....',
    '.......eeuutttmee.......',
    '.........dttmsd.........',
    '.........dttmsd.........',
    '.........dttmsd.........',
    '.......ddmmssssdd.......',
    '......dddddddddddd......',
    '....DDDDDDDDDDDDDDDD....',
    '.....DDDDDDDDDDDDDD.....',
    '........................',
]);

// ---------------------------------------------------------------------------

export interface WorkerAnimation {
  /** 어떤 업그레이드가 이 일꾼을 만드는가 */
  readonly upgradeId: string;
  readonly label: string;
  readonly frames: readonly PixelSpriteData[];
  /** 프레임 간격(ms) */
  readonly frameMs: number;
}

/**
 * 자동 생산 업그레이드별 일하는 모습.
 *
 * 견습 대장장이는 다른 간격을 쓴다. 사람과 기계가 같은 박자로 움직이면 기계적으로 보인다.
 * 반대로 풀무와 석탄 화로는 일부러 같은 간격을 쓴다. 풀무가 그 화로에 바람을 넣으므로
 * 따로 놀면 두 설비가 서로 무관해 보인다.
 */
export const WORKER_ANIMATIONS: readonly WorkerAnimation[] = [
  {
    upgradeId: 'apprentice',
    label: '견습 대장장이',
    frames: [...APPRENTICE_WORK_FRAMES],
    frameMs: 110,
  },
  {
    upgradeId: 'bellows',
    label: '풀무',
    frames: [BELLOWS_OPEN, BELLOWS_PRESSED],
    frameMs: 560,
  },
  {
    upgradeId: 'coal_forge',
    label: '석탄 화로',
    frames: [COAL_FORGE_LOW, COAL_FORGE_HIGH],
    frameMs: 560,
  },
];

/** 그리드 검증 테스트가 훑는 목록 */
export const WORKER_FRAMES = [
  ...WORKER_ANIMATIONS.flatMap((animation) => [...animation.frames]),
  ...APPRENTICE_WALK_FRAMES,
  ...APPRENTICE_HEAT_FRAMES,
  ...APPRENTICE_PUMP_FRAMES,
  ...APPRENTICE_WALK_FRAMES_LEFT,
  ...APPRENTICE_WORK_FRAMES_LEFT,
  ...APPRENTICE_HEAT_FRAMES_LEFT,
  ...APPRENTICE_PUMP_FRAMES_LEFT,
  ...COAL_FORGE_STOKED_FRAMES,
  WORKSHOP_FORGE,
  WORKSHOP_ANVIL,
];
