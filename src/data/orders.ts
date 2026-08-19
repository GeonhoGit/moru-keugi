import type { OrderDefinition } from '../types/index';

/**
 * V1.0 기본 주문 6종 (계획서 4.3, 완료 정의 18.1의 "기본 주문 6종 이상" 충족).
 *
 * V1.0은 서버 시간 없이 동작해야 하므로 고정 목록을 순서대로 순환한다.
 *
 * 계획서 4.3의 "경비대의 철검 → 타격력 임시 강화" 보상은 세션 임시 버프 시스템이
 * 필요해 Phase 2로 미루고, 여기서는 동일 가치의 잉걸불 보상으로 대체했다.
 */
export const ORDERS: readonly OrderDefinition[] = [
  {
    id: 'farmers_scythe',
    name: '농부의 낫',
    description: '마을 농부가 맡긴 첫 주문. 무디어진 날을 다시 세운다.',
    cost: '500',
    craftSeconds: 45,
    unlockCondition: { kind: 'always' },
    rewards: [
      { kind: 'ember', value: '200', label: '잉걸불 200' },
      { kind: 'achievementProgress', value: 'orders_completed', label: '도감 기록' },
    ],
  },
  {
    id: 'guard_sword',
    name: '경비대의 철검',
    description: '성문 경비대가 쓸 실전용 철검 한 자루.',
    cost: '5000',
    craftSeconds: 90,
    unlockCondition: { kind: 'autoRate', amount: '10' },
    rewards: [
      { kind: 'ember', value: '1500', label: '잉걸불 1,500' },
      { kind: 'achievementProgress', value: 'orders_completed', label: '도감 기록' },
    ],
  },
  {
    id: 'mining_pick',
    name: '광산용 곡괭이',
    description: '광부들이 한 달을 버틸 단단한 곡괭이 열 자루.',
    cost: '25000',
    craftSeconds: 180,
    unlockCondition: {
      kind: 'upgradesOwned',
      requirements: [
        { upgradeId: 'bellows', count: 1 },
        { upgradeId: 'coal_forge', count: 1 },
      ],
    },
    rewards: [
      { kind: 'ember', value: '9000', label: '잉걸불 9,000' },
      { kind: 'cosmetic', value: 'decor_miners_lamp', label: '대장간 장식: 광부의 등' },
    ],
  },
  {
    id: 'patrol_shield',
    name: '순찰대의 방패',
    description: '국경 순찰대가 급하게 요청한 방패 한 벌.',
    cost: '120000',
    craftSeconds: 300,
    unlockCondition: { kind: 'autoRate', amount: '500' },
    rewards: [{ kind: 'ember', value: '45000', label: '잉걸불 45,000' }],
  },
  {
    id: 'flame_rune_greatsword',
    name: '불꽃 룬 대검',
    description: '왕실 기사단장의 이름이 새겨질 대검. 명인만이 받을 수 있는 주문이다.',
    cost: '250000',
    craftSeconds: 600,
    unlockCondition: { kind: 'prestigeCount', count: 1 },
    rewards: [
      { kind: 'sealProgress', value: '1', label: '명인의 인장 1' },
      { kind: 'ember', value: '100000', label: '잉걸불 100,000' },
    ],
  },
  {
    id: 'dragonscale_hammer',
    name: '용비늘 망치',
    description: '용의 비늘을 두드려 만든 망치. 대장간의 상징이 된다.',
    cost: '2e6',
    craftSeconds: 900,
    unlockCondition: {
      kind: 'all',
      conditions: [
        { kind: 'prestigeCount', count: 1 },
        { kind: 'lifetimeEmber', amount: '1e8' },
      ],
    },
    rewards: [
      { kind: 'ember', value: '1e6', label: '잉걸불 1,000,000' },
      { kind: 'cosmetic', value: 'decor_dragonscale', label: '대장간 장식: 용비늘 걸개' },
    ],
  },
];

export const ORDER_BY_ID: ReadonlyMap<string, OrderDefinition> = new Map(
  ORDERS.map((order) => [order.id, order]),
);

export const getOrderDefinition = (id: string): OrderDefinition => {
  const found = ORDER_BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 주문 id: ${id}`);
  return found;
};
