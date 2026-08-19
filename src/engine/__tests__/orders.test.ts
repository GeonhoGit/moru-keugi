/** 계획서 17.1 - 주문(비용 차감·완료·중복 수령 방지) 자동 테스트 */
import { describe, expect, it } from 'vitest';
import { big } from '../bignum';
import { createInitialState, withEmber } from '../state';
import {
  claimOrder,
  getOrderProgress,
  getOrderSlotViews,
  getOrderStatus,
  getRemainingCraftSeconds,
  previewOrderRewards,
  refreshOrderSlots,
  startOrder,
} from '../orders';
import { ORDER_SLOT_COUNT } from '../../data/balance';
import type { GameState } from '../../types/index';

const SECOND = 1000;

/** 농부의 낫(500 잉걸불 / 45초)을 시작할 수 있는 상태 */
const ready = (): GameState => withEmber(createInitialState(0), '1000');

describe('슬롯 구성 (계획서 4.3)', () => {
  it('시작 시점에는 해금된 주문만 슬롯에 오른다', () => {
    const state = createInitialState(0);
    expect(state.orders.slots.map((slot) => slot.orderId)).toEqual(['farmers_scythe']);
  });

  it('슬롯은 3개를 넘지 않는다', () => {
    const base = createInitialState(0);
    // 모든 주문을 해금한 상태를 만든다.
    const unlocked: GameState = {
      ...base,
      lifetimeEmber: big('1e12'),
      upgrades: { apprentice: 100, bellows: 20, coal_forge: 20 },
      prestige: { count: 1, masterSeals: 0, permanentSkills: {} },
      orders: { slots: [], completedOrderIds: [], completedCount: 0 },
    };
    expect(refreshOrderSlots(unlocked).orders.slots.length).toBe(ORDER_SLOT_COUNT);
  });
});

describe('제작 시작 (계획서 4.3 - 비용 즉시 차감)', () => {
  it('시작하면 필요 잉걸불이 즉시 차감된다', () => {
    const result = startOrder(ready(), 'farmers_scythe', 0);

    expect(result.started).toBe(true);
    expect(result.state.ember.toString()).toBe('500');
    expect(getOrderStatus(result.state, 'farmers_scythe', 0)).toBe('crafting');
  });

  it('잉걸불이 모자라면 시작되지 않고 상태도 그대로다', () => {
    const state = withEmber(createInitialState(0), '499');
    const result = startOrder(state, 'farmers_scythe', 0);

    expect(result.started).toBe(false);
    expect(result.reason).toBe('not-enough-ember');
    expect(result.state).toBe(state);
  });

  it('이미 시작한 주문을 다시 시작해도 비용이 두 번 나가지 않는다', () => {
    const started = startOrder(ready(), 'farmers_scythe', 0).state;
    const again = startOrder(started, 'farmers_scythe', SECOND);

    expect(again.started).toBe(false);
    expect(again.reason).toBe('already-started');
    expect(again.state.ember.toString()).toBe('500');
  });

  it('해금되지 않은 주문은 시작할 수 없다', () => {
    const state = withEmber(createInitialState(0), '1e9');
    expect(startOrder(state, 'flame_rune_greatsword', 0).reason).toBe('locked');
  });
});

describe('제작 진행 (계획서 12.1)', () => {
  it('경과 시간에 비례해 진행률이 오른다', () => {
    const state = startOrder(ready(), 'farmers_scythe', 0).state;

    expect(getOrderProgress(state, 'farmers_scythe', 0)).toBe(0);
    expect(getOrderProgress(state, 'farmers_scythe', 22.5 * SECOND)).toBeCloseTo(0.5, 10);
    expect(getOrderProgress(state, 'farmers_scythe', 45 * SECOND)).toBe(1);
    expect(getOrderProgress(state, 'farmers_scythe', 90 * SECOND)).toBe(1);
  });

  it('남은 시간은 0 아래로 내려가지 않는다', () => {
    const state = startOrder(ready(), 'farmers_scythe', 0).state;
    expect(getRemainingCraftSeconds(state, 'farmers_scythe', 10 * SECOND)).toBeCloseTo(35, 10);
    expect(getRemainingCraftSeconds(state, 'farmers_scythe', 999 * SECOND)).toBe(0);
  });

  it('제작 시간이 지나야 수령 가능 상태가 된다', () => {
    const state = startOrder(ready(), 'farmers_scythe', 0).state;
    expect(getOrderStatus(state, 'farmers_scythe', 44 * SECOND)).toBe('crafting');
    expect(getOrderStatus(state, 'farmers_scythe', 45 * SECOND)).toBe('ready');
  });
});

describe('보상 수령 (계획서 6.3 - 최종 주문 보상 = 기본 × 주문 보상 배율)', () => {
  it('제작이 끝나기 전에는 수령할 수 없다', () => {
    const state = startOrder(ready(), 'farmers_scythe', 0).state;
    const result = claimOrder(state, 'farmers_scythe', 10 * SECOND);

    expect(result.claimed).toBe(false);
    expect(result.reason).toBe('not-ready');
    expect(result.state).toBe(state);
  });

  it('수령하면 잉걸불과 완료 수가 올라간다', () => {
    const started = startOrder(ready(), 'farmers_scythe', 0).state;
    const result = claimOrder(started, 'farmers_scythe', 45 * SECOND);

    expect(result.claimed).toBe(true);
    expect(result.emberGained.toString()).toBe('200');
    expect(result.state.ember.toString()).toBe('700'); // 500 + 200
    expect(result.state.orders.completedCount).toBe(1);
  });

  it('같은 주문의 보상을 두 번 받을 수 없다', () => {
    const started = startOrder(ready(), 'farmers_scythe', 0).state;
    const first = claimOrder(started, 'farmers_scythe', 45 * SECOND);
    const second = claimOrder(first.state, 'farmers_scythe', 45 * SECOND);

    expect(second.claimed).toBe(false);
    expect(second.emberGained.toString()).toBe('0');
    expect(second.state.ember.toString()).toBe(first.state.ember.toString());
    expect(second.state.orders.completedCount).toBe(1);
  });

  it('주문 보상 배율이 잉걸불 보상에 적용된다', () => {
    const base = withEmber(createInitialState(0), '1000');
    const boosted: GameState = {
      ...base,
      prestige: { count: 1, masterSeals: 0, permanentSkills: { royal_contract: 5 } }, // +20%
    };
    expect(previewOrderRewards(boosted, 'farmers_scythe').ember.toString()).toBe('240');

    const started = startOrder(boosted, 'farmers_scythe', 0).state;
    expect(claimOrder(started, 'farmers_scythe', 45 * SECOND).emberGained.toString()).toBe('240');
  });

  it('외형 보상은 중복 해금되지 않는다', () => {
    const base: GameState = {
      ...withEmber(createInitialState(0), '1e6'),
      upgrades: { apprentice: 1, iron_tongs: 1, bellows: 1, coal_forge: 1 },
      unlocks: ['decor_miners_lamp'],
    };
    const state = refreshOrderSlots(base);
    const started = startOrder(state, 'mining_pick', 0).state;
    const result = claimOrder(started, 'mining_pick', 180 * SECOND);

    expect(result.cosmeticsUnlocked).toEqual([]);
    expect(result.state.unlocks).toEqual(['decor_miners_lamp']);
  });
});

describe('주문 목록 순환 (계획서 4.3)', () => {
  it('해금된 주문을 모두 완료하면 목록이 다시 채워진다', () => {
    const started = startOrder(ready(), 'farmers_scythe', 0).state;
    const claimed = claimOrder(started, 'farmers_scythe', 45 * SECOND).state;

    // 다음 주문이 아직 해금되지 않았으므로 같은 주문이 다시 올라온다.
    expect(claimed.orders.slots.map((slot) => slot.orderId)).toEqual(['farmers_scythe']);
    expect(getOrderStatus(claimed, 'farmers_scythe', 45 * SECOND)).toBe('available');
    // 평생 완료 수는 순환과 무관하게 유지된다.
    expect(claimed.orders.completedCount).toBe(1);
  });
});

describe('주문 화면 표시 정보', () => {
  it('시작 가능 여부를 잉걸불 보유량으로 판단한다', () => {
    const poor = getOrderSlotViews(withEmber(createInitialState(0), '100'), 0);
    expect(poor[0]?.canStart).toBe(false);
    expect(poor[0]?.cost.toString()).toBe('500');

    const rich = getOrderSlotViews(ready(), 0);
    expect(rich[0]?.canStart).toBe(true);
  });
});
