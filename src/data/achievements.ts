import type { AchievementDefinition } from '../types/index';

/**
 * V1.0 업적 13종 (계획서 4.2, 완료 정의 18.1의 "업적 10종 이상" 충족).
 *
 * 보상은 잉걸불 또는 아주 작은 영구 계층 보너스로만 구성한다.
 * 업적 하나가 필수 공략이 되지 않도록 배율은 +1~2% 범위를 넘기지 않는다.
 */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'first_hit',
    name: '첫 망치질',
    description: '모루를 처음 두드린다.',
    condition: { kind: 'clickCount', count: 1 },
    // 보상 없는 기념 업적이다. 여기에 잉걸불을 주면 첫 업그레이드 구매가
    // 2초 만에 끝나 계획서 6.2의 "약 10초" 목표가 무너진다 (시뮬레이션으로 확인).
  },
  {
    id: 'hits_500',
    name: '굳은살',
    description: '모루를 500번 두드린다.',
    condition: { kind: 'clickCount', count: 500 },
    emberReward: '2000',
  },
  {
    id: 'hits_10000',
    name: '쇠를 읽는 손',
    description: '모루를 10,000번 두드린다.',
    condition: { kind: 'clickCount', count: 10000 },
    modifier: { channel: 'click', amount: 0.02 },
  },
  {
    id: 'first_upgrade',
    name: '첫 견습생',
    description: '견습 대장장이를 처음 고용한다.',
    condition: { kind: 'upgradesOwned', requirements: [{ upgradeId: 'apprentice', count: 1 }] },
    emberReward: '25',
  },
  {
    id: 'apprentice_25',
    name: '북적이는 공방',
    description: '견습 대장장이를 25명 고용한다.',
    condition: { kind: 'upgradesOwned', requirements: [{ upgradeId: 'apprentice', count: 25 }] },
    emberReward: '20000',
  },
  {
    id: 'apprentice_100',
    name: '대장간 길드',
    description: '견습 대장장이를 100명 고용한다.',
    condition: { kind: 'upgradesOwned', requirements: [{ upgradeId: 'apprentice', count: 100 }] },
    modifier: { channel: 'auto', amount: 0.02 },
  },
  {
    id: 'ember_1k',
    name: '불씨를 모으다',
    description: '평생 누적 잉걸불 1,000에 도달한다.',
    condition: { kind: 'lifetimeEmber', amount: '1000' },
    emberReward: '250',
  },
  {
    id: 'ember_1m',
    name: '꺼지지 않는 화로',
    description: '평생 누적 잉걸불 1,000,000에 도달한다.',
    condition: { kind: 'lifetimeEmber', amount: '1e6' },
    emberReward: '150000',
  },
  {
    id: 'ember_1b',
    name: '불의 강',
    description: '평생 누적 잉걸불 1,000,000,000에 도달한다.',
    condition: { kind: 'lifetimeEmber', amount: '1e9' },
    modifier: { channel: 'global', amount: 0.01 },
  },
  {
    id: 'first_order',
    name: '첫 납품',
    description: '주문을 하나 완료한다.',
    condition: { kind: 'ordersCompleted', count: 1 },
    emberReward: '300',
  },
  {
    id: 'orders_5',
    name: '단골이 생기다',
    description: '주문을 5개 완료한다.',
    condition: { kind: 'ordersCompleted', count: 5 },
    modifier: { channel: 'orderReward', amount: 0.02 },
  },
  {
    id: 'first_prestige',
    name: '명인의 길',
    description: '처음으로 환생한다.',
    condition: { kind: 'prestigeCount', count: 1 },
    modifier: { channel: 'global', amount: 0.01 },
  },
  {
    id: 'prestige_3',
    name: '세 번 벼려진 이름',
    description: '세 번 환생한다.',
    condition: { kind: 'prestigeCount', count: 3 },
    modifier: { channel: 'global', amount: 0.02 },
  },
];

export const ACHIEVEMENT_BY_ID: ReadonlyMap<string, AchievementDefinition> = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);
