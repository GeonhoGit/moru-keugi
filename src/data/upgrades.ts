import type { UpgradeDefinition } from '../types/index';
import { DEFAULT_COST_GROWTH, DEFAULT_MILESTONES } from './balance';

const MILESTONES = DEFAULT_MILESTONES.map((m) => ({ ...m }));

/**
 * V1.0 업그레이드 10종 (계획서 5.1 / 5.3, 완료 정의 18.1의 "최소 8종" 충족).
 *
 * 이름은 계획서에 나온 표기를 그대로 쓴다. 편의형 2종만 계획서가 효과만 적어두어
 * 대장간 세계관에 맞춰 새로 이름 붙였다.
 */
export const UPGRADES: readonly UpgradeDefinition[] = [
  // --- 초급: 게임 시작부터 -------------------------------------------------
  //
  // 무쇠 집게가 견습 대장장이보다 확실히 싸다. 계획서 6.2가 "첫 업그레이드 구매 10초"와
  // "첫 자동 생산 획득 30초"를 다른 시점으로 잡고 있고, 튜토리얼(12.3)도
  // "첫 업그레이드 구매 → 자동 생산 확인" 순서를 안내하기 때문이다.
  // 초당 3회 타격 기준으로 무쇠 집게는 약 10초, 견습 대장장이는 약 30초에 손에 들어온다.
  {
    id: 'iron_tongs',
    name: '무쇠 집게',
    description: '달군 쇠를 단단히 물어 한 번의 타격에서 더 많은 잉걸불을 얻는다.',
    type: 'click',
    tier: 'basic',
    baseCost: '30',
    costGrowth: DEFAULT_COST_GROWTH,
    baseOutput: '1',
    unlockCondition: { kind: 'always' },
    milestoneBonuses: MILESTONES,
  },
  {
    id: 'apprentice',
    name: '견습 대장장이',
    description: '풀무를 대신 밟아 줄 견습생. 자리를 비워도 잉걸불을 모은다.',
    type: 'auto',
    tier: 'basic',
    baseCost: '100',
    costGrowth: DEFAULT_COST_GROWTH,
    baseOutput: '0.5',
    unlockCondition: { kind: 'always' },
    milestoneBonuses: MILESTONES,
  },

  // --- 중급: 초급 업그레이드 각각 1개 이상 ----------------------------------
  //
  // 회수 기간을 200~300초대로 잡는다. 이전 값(풀무 125초, 석탄 화로 240초)은
  // 초반 경제를 너무 빠르게 만들어 계획서 4.3의 주문 비용표가 단기 목표로
  // 기능하지 못했다 (250,000 잉걸불 주문에 6분이면 도달했다).
  {
    id: 'bellows',
    name: '풀무',
    description: '바람을 밀어 넣어 화로를 살린다.',
    type: 'auto',
    tier: 'intermediate',
    baseCost: '1200',
    costGrowth: DEFAULT_COST_GROWTH,
    baseOutput: '5',
    unlockCondition: {
      kind: 'upgradesOwned',
      requirements: [
        { upgradeId: 'apprentice', count: 1 },
        { upgradeId: 'iron_tongs', count: 1 },
      ],
    },
    milestoneBonuses: MILESTONES,
  },
  {
    id: 'coal_forge',
    name: '석탄 화로',
    description: '장작 대신 석탄을 태워 불을 오래 유지한다.',
    type: 'auto',
    tier: 'intermediate',
    baseCost: '15000',
    costGrowth: DEFAULT_COST_GROWTH,
    baseOutput: '50',
    unlockCondition: {
      kind: 'upgradesOwned',
      requirements: [
        { upgradeId: 'apprentice', count: 1 },
        { upgradeId: 'iron_tongs', count: 1 },
      ],
    },
    milestoneBonuses: MILESTONES,
  },

  // --- 고급: 중급 업그레이드 각각 3개 이상 ----------------------------------
  {
    id: 'rune_hammer',
    name: '룬 각인 망치',
    description: '망치머리에 새긴 룬이 타격마다 불꽃을 터뜨린다.',
    type: 'click',
    tier: 'advanced',
    baseCost: '200000',
    costGrowth: DEFAULT_COST_GROWTH,
    baseOutput: '2000',
    unlockCondition: {
      kind: 'upgradesOwned',
      requirements: [
        { upgradeId: 'bellows', count: 3 },
        { upgradeId: 'coal_forge', count: 3 },
      ],
    },
    milestoneBonuses: MILESTONES,
  },
  {
    id: 'master_anvil',
    name: '명장의 모루',
    description: '명장이 벼려 낸 모루. 대장간 전체의 자동 생산을 끌어올린다.',
    type: 'multiplier',
    tier: 'advanced',
    baseCost: '1e6',
    costGrowth: 1.2,
    baseOutput: '0',
    modifier: { channel: 'auto', amountPerLevel: 0.08 },
    unlockCondition: {
      kind: 'upgradesOwned',
      requirements: [
        { upgradeId: 'bellows', count: 3 },
        { upgradeId: 'coal_forge', count: 3 },
      ],
    },
    milestoneBonuses: [],
    maxLevel: 25,
  },

  // --- 전설: 첫 환생 완료 ---------------------------------------------------
  {
    id: 'master_blueprint',
    name: '명인의 설계도',
    description: '명인이 남긴 도면. 주문 하나하나의 값어치가 달라진다.',
    type: 'multiplier',
    tier: 'legendary',
    baseCost: '5e6',
    costGrowth: 1.25,
    baseOutput: '0',
    modifier: { channel: 'orderReward', amountPerLevel: 0.2 },
    unlockCondition: { kind: 'prestigeCount', count: 1 },
    milestoneBonuses: [],
    maxLevel: 10,
  },
  {
    id: 'dragonflame_forge',
    name: '용염의 화로',
    description: '용의 숨결로 타오르는 화로. 대장간의 모든 생산에 불을 붙인다.',
    type: 'multiplier',
    tier: 'legendary',
    baseCost: '2e7',
    costGrowth: 1.22,
    baseOutput: '0',
    modifier: { channel: 'global', amountPerLevel: 0.1 },
    unlockCondition: { kind: 'prestigeCount', count: 1 },
    milestoneBonuses: [],
    maxLevel: 25,
  },

  // --- 편의형 ---------------------------------------------------------------
  {
    id: 'banked_embers',
    name: '잔불 화덕',
    description: '자리를 비워도 잔불이 사그라들지 않는다. 오프라인 효율 +5%.',
    type: 'utility',
    tier: 'utility',
    baseCost: '50000',
    costGrowth: 1.6,
    baseOutput: '0',
    modifier: { channel: 'offline', amountPerLevel: 0.05 },
    unlockCondition: { kind: 'lifetimeEmber', amount: '50000' },
    milestoneBonuses: [],
    maxLevel: 10,
  },
  {
    id: 'order_bench',
    name: '주문 작업대',
    description: '작업대를 넓혀 주문을 더 꼼꼼히 마감한다. 주문 보상 +10%.',
    type: 'utility',
    tier: 'utility',
    baseCost: '300000',
    costGrowth: 1.8,
    baseOutput: '0',
    modifier: { channel: 'orderReward', amountPerLevel: 0.1 },
    unlockCondition: { kind: 'ordersCompleted', count: 2 },
    milestoneBonuses: [],
    maxLevel: 5,
  },
];

export const UPGRADE_BY_ID: ReadonlyMap<string, UpgradeDefinition> = new Map(
  UPGRADES.map((upgrade) => [upgrade.id, upgrade]),
);

export const getUpgradeDefinition = (id: string): UpgradeDefinition => {
  const found = UPGRADE_BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 업그레이드 id: ${id}`);
  return found;
};
