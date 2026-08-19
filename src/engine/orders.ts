/**
 * 주문 제작 (계획서 4.3).
 *
 * V1.0 규칙
 * - 슬롯 3개, 고정 주문 목록을 순환한다.
 * - "제작 시작"을 눌렀을 때만 진행이 시작된다.
 * - 비용은 시작 시 즉시 차감한다 (`ORDER_COST_MODE = 'instant'`).
 * - 제작 시간이 지나야 보상을 수령할 수 있고, 같은 주문의 보상은 한 번만 지급된다.
 */
import { big, clampNonNegative, ZERO, type Big } from './bignum';
import { ORDER_SLOT_COUNT } from '../data/balance';
import { ORDERS, getOrderDefinition } from '../data/orders';
import { isConditionMet } from './unlock';
import { getModifiers } from './production';
import type {
  GameState,
  OrderDefinition,
  OrderSlotState,
  OrderStatus,
} from '../types/index';

// ---------------------------------------------------------------------------
// 슬롯 구성
// ---------------------------------------------------------------------------

const findSlot = (state: GameState, orderId: string): OrderSlotState | undefined =>
  state.orders.slots.find((slot) => slot.orderId === orderId);

/** 이번 순환에서 아직 완료하지 않았고 해금 조건도 만족하는 주문 */
const getEligibleOrders = (state: GameState): OrderDefinition[] =>
  ORDERS.filter(
    (order) =>
      !state.orders.completedOrderIds.includes(order.id) &&
      isConditionMet(state, order.unlockCondition),
  );

/**
 * 빈 슬롯을 채운다. 진행 중이거나 수령 대기 중인 슬롯은 건드리지 않는다.
 * 해금된 주문을 모두 완료했으면 순환 목록을 비워 처음부터 다시 돌린다.
 */
export const refreshOrderSlots = (state: GameState): GameState => {
  let working = state;

  // 순환: 해금된 주문을 다 돌았고 진행 중인 것도 없으면 완료 목록을 비운다.
  const hasActiveSlot = working.orders.slots.some((slot) => slot.startedAt !== null);
  if (!hasActiveSlot && getEligibleOrders(working).length === 0) {
    working = {
      ...working,
      orders: { ...working.orders, completedOrderIds: [], slots: [] },
    };
  }

  const keptSlots = working.orders.slots.filter((slot) => slot.startedAt !== null && !slot.claimed);
  const occupiedIds = new Set(keptSlots.map((slot) => slot.orderId));
  const nextSlots: OrderSlotState[] = [...keptSlots];

  for (const order of getEligibleOrders(working)) {
    if (nextSlots.length >= ORDER_SLOT_COUNT) break;
    if (occupiedIds.has(order.id)) continue;
    nextSlots.push({ orderId: order.id, startedAt: null, claimed: false });
    occupiedIds.add(order.id);
  }

  return { ...working, orders: { ...working.orders, slots: nextSlots } };
};

// ---------------------------------------------------------------------------
// 상태 조회
// ---------------------------------------------------------------------------

export const getOrderStatus = (state: GameState, orderId: string, nowMs: number): OrderStatus => {
  const definition = getOrderDefinition(orderId);
  if (state.orders.completedOrderIds.includes(orderId)) return 'completed';
  if (!isConditionMet(state, definition.unlockCondition)) return 'locked';

  const slot = findSlot(state, orderId);
  if (!slot || slot.startedAt === null) return 'available';

  const elapsed = (nowMs - slot.startedAt) / 1000;
  return elapsed >= definition.craftSeconds ? 'ready' : 'crafting';
};

/** 제작 진행률 0~1. 시작하지 않았으면 0. */
export const getOrderProgress = (state: GameState, orderId: string, nowMs: number): number => {
  const slot = findSlot(state, orderId);
  if (!slot || slot.startedAt === null) return 0;
  const definition = getOrderDefinition(orderId);
  if (definition.craftSeconds <= 0) return 1;
  const elapsed = (nowMs - slot.startedAt) / 1000;
  return Math.min(1, Math.max(0, elapsed / definition.craftSeconds));
};

export const getRemainingCraftSeconds = (
  state: GameState,
  orderId: string,
  nowMs: number,
): number => {
  const slot = findSlot(state, orderId);
  if (!slot || slot.startedAt === null) return getOrderDefinition(orderId).craftSeconds;
  const definition = getOrderDefinition(orderId);
  const elapsed = (nowMs - slot.startedAt) / 1000;
  return Math.max(0, definition.craftSeconds - elapsed);
};

// ---------------------------------------------------------------------------
// 제작 시작
// ---------------------------------------------------------------------------

export interface StartOrderResult {
  readonly state: GameState;
  readonly started: boolean;
  readonly reason: 'ok' | 'locked' | 'already-started' | 'completed' | 'not-enough-ember';
}

export const startOrder = (state: GameState, orderId: string, nowMs: number): StartOrderResult => {
  const definition = getOrderDefinition(orderId);
  const status = getOrderStatus(state, orderId, nowMs);

  if (status === 'completed') return { state, started: false, reason: 'completed' };
  if (status === 'locked') return { state, started: false, reason: 'locked' };
  if (status !== 'available') return { state, started: false, reason: 'already-started' };

  const cost = big(definition.cost);
  if (state.ember.lt(cost)) return { state, started: false, reason: 'not-enough-ember' };

  const slots = state.orders.slots.some((slot) => slot.orderId === orderId)
    ? state.orders.slots.map((slot) =>
        slot.orderId === orderId ? { ...slot, startedAt: nowMs, claimed: false } : slot,
      )
    : [...state.orders.slots, { orderId, startedAt: nowMs, claimed: false }];

  return {
    state: {
      ...state,
      ember: clampNonNegative(state.ember.sub(cost)),
      orders: { ...state.orders, slots },
    },
    started: true,
    reason: 'ok',
  };
};

// ---------------------------------------------------------------------------
// 보상 수령
// ---------------------------------------------------------------------------

export interface OrderClaimResult {
  readonly state: GameState;
  readonly claimed: boolean;
  readonly emberGained: Big;
  readonly sealsGained: number;
  readonly cosmeticsUnlocked: readonly string[];
  readonly reason: 'ok' | 'not-ready' | 'already-claimed';
}

/**
 * 최종 주문 보상 = 기본 주문 보상 × 주문 보상 배율 (계획서 6.3).
 * 인장 보상도 같은 배율을 적용하되 정수로 내림한다.
 */
export const previewOrderRewards = (
  state: GameState,
  orderId: string,
): { ember: Big; seals: number; cosmetics: string[] } => {
  const definition = getOrderDefinition(orderId);
  const multiplier = getModifiers(state).orderReward;

  let ember = ZERO;
  let seals = 0;
  const cosmetics: string[] = [];

  for (const reward of definition.rewards) {
    switch (reward.kind) {
      case 'ember':
        ember = ember.add(big(reward.value).mul(multiplier));
        break;
      case 'sealProgress':
        seals += Math.floor(Number(reward.value) * multiplier.toNumber());
        break;
      case 'cosmetic':
        cosmetics.push(reward.value);
        break;
      case 'achievementProgress':
        break;
    }
  }

  return { ember: ember.floor(), seals, cosmetics };
};

export const claimOrder = (state: GameState, orderId: string, nowMs: number): OrderClaimResult => {
  const status = getOrderStatus(state, orderId, nowMs);

  if (status === 'completed') {
    return {
      state,
      claimed: false,
      emberGained: ZERO,
      sealsGained: 0,
      cosmeticsUnlocked: [],
      reason: 'already-claimed',
    };
  }
  if (status !== 'ready') {
    return {
      state,
      claimed: false,
      emberGained: ZERO,
      sealsGained: 0,
      cosmeticsUnlocked: [],
      reason: 'not-ready',
    };
  }

  const rewards = previewOrderRewards(state, orderId);
  const newUnlocks = rewards.cosmetics.filter((id) => !state.unlocks.includes(id));

  const claimedState: GameState = {
    ...state,
    ember: state.ember.add(rewards.ember),
    lifetimeEmber: state.lifetimeEmber.add(rewards.ember),
    runLifetimeEmber: state.runLifetimeEmber.add(rewards.ember),
    prestige: {
      ...state.prestige,
      masterSeals: state.prestige.masterSeals + rewards.seals,
    },
    unlocks: [...state.unlocks, ...newUnlocks],
    orders: {
      slots: state.orders.slots.filter((slot) => slot.orderId !== orderId),
      completedOrderIds: [...state.orders.completedOrderIds, orderId],
      completedCount: state.orders.completedCount + 1,
    },
  };

  return {
    state: refreshOrderSlots(claimedState),
    claimed: true,
    emberGained: rewards.ember,
    sealsGained: rewards.seals,
    cosmeticsUnlocked: newUnlocks,
    reason: 'ok',
  };
};

/** 주문 화면(12.1)에 그릴 슬롯 정보 */
export interface OrderSlotView {
  readonly definition: OrderDefinition;
  readonly status: OrderStatus;
  readonly progress: number;
  readonly remainingSeconds: number;
  readonly cost: Big;
  readonly canStart: boolean;
  /** 이미 해 본 주문인지. 목록 순환으로 다시 올라온 경우 true. */
  readonly isRepeat: boolean;
  /**
   * 잉걸불 수지. 음수면 소비가 보상보다 크다.
   *
   * 주문 비용은 계획서 6.5가 정한 경제 소진 장치라 낮은 등급 주문은 의도적으로 적자다.
   * 다만 순환으로 다시 올라온 적자 주문을 처음 보는 것처럼 보여 주면 신규 플레이어를
   * 속이는 셈이 되므로, 화면이 "도감 보상은 이미 받음"을 표시할 수 있게 값을 넘긴다.
   */
  readonly netEmber: Big;
}

export const getOrderSlotViews = (state: GameState, nowMs: number): OrderSlotView[] =>
  state.orders.slots.map((slot) => {
    const definition = getOrderDefinition(slot.orderId);
    const status = getOrderStatus(state, slot.orderId, nowMs);
    const cost = big(definition.cost);
    return {
      definition,
      status,
      progress: getOrderProgress(state, slot.orderId, nowMs),
      remainingSeconds: getRemainingCraftSeconds(state, slot.orderId, nowMs),
      cost,
      canStart: status === 'available' && state.ember.gte(cost),
      isRepeat: hasCompletedBefore(state, slot.orderId),
      netEmber: previewOrderRewards(state, slot.orderId).ember.sub(cost),
    };
  });

/**
 * 이 주문의 1회성 보상(도감·장식)을 이미 받았는지.
 * 해금한 외형은 환생해도 유지되므로(6.4) 순환으로 다시 올라와도 두 번 주지 않는다.
 */
export const hasCompletedBefore = (state: GameState, orderId: string): boolean => {
  const definition = getOrderDefinition(orderId);
  const cosmetics = definition.rewards.filter((reward) => reward.kind === 'cosmetic');
  if (cosmetics.length > 0) {
    return cosmetics.every((reward) => state.unlocks.includes(reward.value));
  }
  return state.orders.completedOrderIds.includes(orderId);
};
