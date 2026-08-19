/**
 * 업그레이드 아이콘 (계획서 4.6).
 *
 * 16×16 그리드, 배경 없는 단일 사물 형태로 통일한다.
 * 팔레트는 4.6 색상표에서만 고르고 8색으로 제한한다.
 * `A`는 화로 티어 강조색이라 그릴 때 티어 색으로 덮어쓴다.
 */
import { PIXEL_GRID, type PixelSpriteData } from '../theme/pixel';

/** 아이콘 공용 팔레트 — 8색 */
const ICON_PALETTE = {
  d: '#2a2018', // 외곽선·그림자
  m: '#4a3d31', // 금속 본체
  l: '#a8927c', // 금속 하이라이트
  w: '#f5ead9', // 밝은 하이라이트
  b: '#6d5c4c', // 나무·가죽
  g: '#e0b479', // 금빛 장식
  r: '#d1450f', // 깊은 불씨
  A: '#ff7a3d', // 화로 강조색 (티어에 따라 교체)
} as const;

const icon = (id: string, rows: readonly string[]): PixelSpriteData => ({
  id,
  grid: PIXEL_GRID.icon,
  palette: ICON_PALETTE,
  rows,
});

/** 무쇠 집게 — 달군 쇠를 무는 집게 */
export const ICON_IRON_TONGS = icon('icon_iron_tongs', [
  '................',
  '.....dd....dd...',
  '....dmmd..dmmd..',
  '....dmmd..dmmd..',
  '.....dmmd.dmmd..',
  '......dmmddmmd..',
  '.......dmmmmd...',
  '........dmmd....',
  '........dmmd....',
  '........dmmd....',
  '........dmmd....',
  '........dmmd....',
  '.......dmmmmd...',
  '.......dllllld..',
  '........dddd....',
  '................',
]);

/** 견습 대장장이 — 앞치마를 두른 견습생 */
export const ICON_APPRENTICE = icon('icon_apprentice', [
  '................',
  '......dddd......',
  '.....dwwwwd.....',
  '.....dwllwd.....',
  '.....dwwwwd.....',
  '......dddd......',
  '.....dbbbbd.....',
  '....dbbbbbbd....',
  '...dbdbbbbdbd...',
  '...ddbbbbbbdd...',
  '.....dbbbbd.....',
  '.....dbdbd......',
  '.....db.dbd.....',
  '.....dd..dd.....',
  '................',
  '................',
]);

/** 풀무 — 바람을 밀어 넣는 가죽 주머니 */
export const ICON_BELLOWS = icon('icon_bellows', [
  '................',
  '................',
  '....dddd........',
  '...dbbbbdd......',
  '..dbbbbbbbdd....',
  '.dbbbbbbbbbbd...',
  '.dbllllllllbd...',
  '.dbllllllllbdd..',
  '.dbllllllllbmmd.',
  '.dbbbbbbbbbbmmd.',
  '..dbbbbbbbbdd...',
  '...dbbbbbbd.....',
  '....dddddd......',
  '................',
  '................',
  '................',
]);

/** 석탄 화로 — 석탄을 태우는 화덕 */
export const ICON_COAL_FORGE = icon('icon_coal_forge', [
  '................',
  '.......A........',
  '......AAA.......',
  '.....AAwAA......',
  '.....AAwAA......',
  '......AAA.......',
  '................',
  '...dddddddd.....',
  '..dmmmmmmmmd....',
  '..dmddddddmd....',
  '..dmdAAAAdmd....',
  '..dmdAAAAdmd....',
  '..dmddddddmd....',
  '..dmmmmmmmmd....',
  '...dddddddd.....',
  '................',
]);

/** 룬 각인 망치 — 망치머리에 룬을 새긴 망치 */
export const ICON_RUNE_HAMMER = icon('icon_rune_hammer', [
  '................',
  '....dddddddd....',
  '...dmmmmmmmmd...',
  '...dmwArAwmmd...',
  '...dmmmmmmmmd...',
  '...dmmmmmmmmd...',
  '....dddmmddd....',
  '.......dmmd.....',
  '.......dbbd.....',
  '.......dbbd.....',
  '.......dbbd.....',
  '.......dbbd.....',
  '.......dbbd.....',
  '.......dddd.....',
  '................',
  '................',
]);

/** 명장의 모루 — 금빛 테를 두른 모루 */
export const ICON_MASTER_ANVIL = icon('icon_master_anvil', [
  '................',
  '................',
  '..dgggggggggd...',
  '.dmmmmmmmmmmmd..',
  '.dmmmmmmmmmmmd..',
  '..ddmmmmmmmdd...',
  '....dmmmmmd.....',
  '.....dmmmd......',
  '.....dmmmd......',
  '.....dmmmd......',
  '....dmmmmmd.....',
  '...dmmmmmmmd....',
  '..dgggggggggd...',
  '..ddddddddddd...',
  '................',
  '................',
]);

/** 명인의 설계도 — 접힌 도면 */
export const ICON_MASTER_BLUEPRINT = icon('icon_master_blueprint', [
  '................',
  '...dddddddddd...',
  '..dwwwwwwwwwwd..',
  '..dwddddddddwd..',
  '..dwdwwwwwwdwd..',
  '..dwdwddddwdwd..',
  '..dwdwdggdwdwd..',
  '..dwdwdggdwdwd..',
  '..dwdwddddwdwd..',
  '..dwdwwwwwwdwd..',
  '..dwddddddddwd..',
  '..dwwwwwwwwwwd..',
  '...dddddddddd...',
  '................',
  '................',
  '................',
]);

/** 용염의 화로 — 용의 숨결로 타오르는 불꽃 */
export const ICON_DRAGONFLAME = icon('icon_dragonflame', [
  '................',
  '.......d........',
  '......dAd.......',
  '.....dAAAd......',
  '....dAAAAAd.....',
  '....dAAwAAd.....',
  '...dAAwwwAAd....',
  '...dAAwwwAAd....',
  '...dAAwwwAAd....',
  '....dAAwAAd.....',
  '....dAAAAAd.....',
  '.....dAAAd......',
  '.....drrrd......',
  '......ddd.......',
  '................',
  '................',
]);

/** 잔불 화덕 — 재 아래 남은 잔불 */
export const ICON_BANKED_EMBERS = icon('icon_banked_embers', [
  '................',
  '................',
  '................',
  '.....dddd.......',
  '....dllllld.....',
  '...dllllllld....',
  '..dlldddddlld...',
  '..dldArrrAdld...',
  '..dldrAAArdld...',
  '..dldArrrAdld...',
  '..dlldddddlld...',
  '...dllllllld....',
  '....ddddddd.....',
  '................',
  '................',
  '................',
]);

/** 주문 작업대 — 주문을 마감하는 작업대 */
export const ICON_ORDER_BENCH = icon('icon_order_bench', [
  '................',
  '................',
  '..dddddddddddd..',
  '.dbbbbbbbbbbbbd.',
  '.dbllllllllllbd.',
  '.dbbbbbbbbbbbbd.',
  '..dddddddddddd..',
  '..db........bd..',
  '..db........bd..',
  '..db........bd..',
  '..db........bd..',
  '..db........bd..',
  '..dd........dd..',
  '................',
  '................',
  '................',
]);


/** 상점 — 동전 주머니 */
export const ICON_SHOP = icon('icon_shop', [
  '................',
  '................',
  '......dddd......',
  '.....d....d.....',
  '....dbbbbbbd....',
  '...dbbbbbbbbd...',
  '..dbbgggggbbd...',
  '..dbbgwwwwgbbd..',
  '..dbbgwggwgbbd..',
  '..dbbgwggwgbbd..',
  '..dbbgwwwwgbbd..',
  '..dbbgggggbbd...',
  '...dbbbbbbbbd...',
  '....dddddddd....',
  '................',
  '................',
]);

/** 기록 — 펼친 장부 */
export const ICON_RECORDS = icon('icon_records', [
  '................',
  '..dddddddddddd..',
  '..dwwwwddwwwwd..',
  '..dwllwddwllwd..',
  '..dwwwwddwwwwd..',
  '..dwllwddwllwd..',
  '..dwwwwddwwwwd..',
  '..dwllwddwllwd..',
  '..dwwwwddwwwwd..',
  '..dwllwddwllwd..',
  '..dwwwwddwwwwd..',
  '..dddddddddddd..',
  '...dgggggggd....',
  '....ddddddd.....',
  '................',
  '................',
]);


// ---------------------------------------------------------------------------
// 주문 아이콘 (계획서 4.3의 주문 6종)
// ---------------------------------------------------------------------------

/**
 * 농부의 낫 — 굽은 날과 나무 자루.
 *
 * 자루를 어두운 갈색 한 색으로만 그렸더니 패널 배경에 묻혀 형태가 읽히지 않았다.
 * 외곽선·밝은 면·그림자 3색으로 나눠 16px에서도 구분되게 했다.
 */
export const ICON_SCYTHE = icon('icon_scythe', [
  '................',
  '..dddddddddd....',
  '.dllllllllld....',
  '.dlddddddddd....',
  '.dld......dlbd..',
  '.dd.......dlbd..',
  '..........dlbd..',
  '..........dlbd..',
  '..........dlbd..',
  '..........dlbd..',
  '..........dlbd..',
  '.........ddlbdd.',
  '.........dllbbd.',
  '..........dddd..',
  '................',
  '................',
]);

/** 경비대의 철검 — 곧은 양날 검 */
export const ICON_SWORD = icon('icon_sword', [
  '.......dd.......',
  '......dlld......',
  '......dlld......',
  '......dlld......',
  '......dlld......',
  '......dlld......',
  '......dlld......',
  '......dlld......',
  '...ddddmmdddd...',
  '...dggggggggd...',
  '......dbbd......',
  '......dbbd......',
  '......dbbd......',
  '.....dbbbbd.....',
  '......dddd......',
  '................',
]);

/** 광산용 곡괭이 — 뾰족한 양쪽 머리 */
export const ICON_PICKAXE = icon('icon_pickaxe', [
  '................',
  '..dd........dd..',
  '.dlld......dlld.',
  '.dlmmd....dmmld.',
  '..dlmmddddmmld..',
  '...dmmmmmmmmd...',
  '.....dmmmmd.....',
  '......dbbd......',
  '......dbbd......',
  '......dbbd......',
  '......dbbd......',
  '......dbbd......',
  '......dbbd......',
  '......dddd......',
  '................',
  '................',
]);

/** 순찰대의 방패 — 문장이 박힌 방패 */
export const ICON_SHIELD = icon('icon_shield', [
  '................',
  '..dddddddddddd..',
  '..dlmmmmmmmmld..',
  '..dlmggggggmld..',
  '..dlmgwwwwgmld..',
  '..dlmgwmmwgmld..',
  '..dlmgwwwwgmld..',
  '..dlmggggggmld..',
  '..dlmmmmmmmmld..',
  '...dlmmmmmmld...',
  '....dlmmmmld....',
  '.....dlmmld.....',
  '......dlld......',
  '.......dd.......',
  '................',
  '................',
]);

/** 불꽃 룬 대검 — 룬이 타오르는 대검 */
export const ICON_GREATSWORD = icon('icon_greatsword', [
  '.......AA.......',
  '......AwwA......',
  '......dAAd......',
  '......dlld......',
  '......dlAd......',
  '......dlld......',
  '......dlAd......',
  '......dlld......',
  '...ddddmmdddd...',
  '...dggggggggd...',
  '......dbbd......',
  '......dbbd......',
  '......dbbd......',
  '.....dgbbgd.....',
  '......dddd......',
  '................',
]);

/** 용비늘 망치 — 비늘이 박힌 큰 망치 */
export const ICON_DRAGONHAMMER = icon('icon_dragonhammer', [
  '................',
  '...dddddddddd...',
  '..dmmmmmmmmmmd..',
  '..dmgAgAgAgAmd..',
  '..dmAgAgAgAgmd..',
  '..dmgAgAgAgAmd..',
  '..dmmmmmmmmmmd..',
  '...dddmmmmddd...',
  '......dbbd......',
  '......dbbd......',
  '......dbbd......',
  '......dbbd......',
  '.....dgbbgd.....',
  '......dddd......',
  '................',
  '................',
]);

/** 주문 id → 아이콘 */
export const ORDER_ICONS: Readonly<Record<string, PixelSpriteData>> = {
  farmers_scythe: ICON_SCYTHE,
  guard_sword: ICON_SWORD,
  mining_pick: ICON_PICKAXE,
  patrol_shield: ICON_SHIELD,
  flame_rune_greatsword: ICON_GREATSWORD,
  dragonscale_hammer: ICON_DRAGONHAMMER,
};

/** 하단 탭 아이콘 (계획서 12.2) */
/** 업적 — 손잡이 달린 우승컵 */
export const ICON_TROPHY = icon('icon_trophy', [
  '................',
  '....dddddddd....',
  '.dddggggggggddd.',
  '.dgdgwwwwwwgdgd.',
  '.dgdgwwwwwwgdgd.',
  '.dd.dgwwwwgd.dd.',
  '.....dggggd.....',
  '......dddd......',
  '......dggd......',
  '......dggd......',
  '.....dggggd.....',
  '....dggggggd....',
  '....dddddddd....',
  '................',
  '................',
  '................',
]);

export const TAB_ICONS = {
  forge: ICON_COAL_FORGE,
  shop: ICON_SHOP,
  orders: ICON_MASTER_BLUEPRINT,
  achievements: ICON_TROPHY,
  records: ICON_RECORDS,
} as const;

/** 업그레이드 id → 아이콘 */
export const UPGRADE_ICONS: Readonly<Record<string, PixelSpriteData>> = {
  iron_tongs: ICON_IRON_TONGS,
  apprentice: ICON_APPRENTICE,
  bellows: ICON_BELLOWS,
  coal_forge: ICON_COAL_FORGE,
  rune_hammer: ICON_RUNE_HAMMER,
  master_anvil: ICON_MASTER_ANVIL,
  master_blueprint: ICON_MASTER_BLUEPRINT,
  dragonflame_forge: ICON_DRAGONFLAME,
  banked_embers: ICON_BANKED_EMBERS,
  order_bench: ICON_ORDER_BENCH,
};

export const ICONS = [
  ...Object.values(UPGRADE_ICONS),
  ...Object.values(ORDER_ICONS),
  ICON_SHOP,
  ICON_RECORDS,
  ICON_TROPHY,
];
