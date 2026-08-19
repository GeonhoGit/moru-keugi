/**
 * 업그레이드 비용과 구매 (계획서 5.4 / 5.7).
 *
 *   다음 1개 비용 = floor(기본가 × 성장률^보유개수)
 *   N개 총비용    = 기본가 × 성장률^보유개수 × (성장률^N - 1) ÷ (성장률 - 1)
 *
 * 최대 구매는 반복문이 아니라 로그로 N을 구한 뒤 경계만 보정한다.
 * 반올림 규칙은 "총비용을 마지막에 한 번 내림"으로 통일한다.
 * (그래서 1개 구매 비용과 N=1 총비용이 항상 같은 값이 된다.)
 */
import { big, clampNonNegative, isFiniteBig, ZERO, type Big } from './bignum';
import { getUpgradeDefinition, UPGRADES } from '../data/upgrades';
import { isConditionMet } from './unlock';
import {
  getEffectiveContribution,
  getModifiers,
  getNextMilestone,
  getOwnedCount,
} from './production';
import type {
  GameState,
  PurchaseMode,
  PurchasePlan,
  UpgradeDefinition,
} from '../types/index';

/** 보유개수가 `owned`일 때 다음 1개의 비용 */
export const getNextCost = (definition: UpgradeDefinition, owned: number): Big =>
  big(definition.baseCost).mul(big(definition.costGrowth).pow(owned)).floor();

/** 보유개수가 `owned`일 때 추가로 `count`개를 살 때의 총비용 */
export const getBulkCost = (
  definition: UpgradeDefinition,
  owned: number,
  count: number,
): Big => {
  if (count <= 0) return ZERO;
  const growth = definition.costGrowth;
  const start = big(definition.baseCost).mul(big(growth).pow(owned));
  const series = big(growth).pow(count).sub(1).div(growth - 1);
  return start.mul(series).floor();
};

/** 최대 레벨을 고려해 앞으로 더 살 수 있는 개수 */
const getRemainingLevels = (definition: UpgradeDefinition, owned: number): number =>
  definition.maxLevel === undefined ? Number.POSITIVE_INFINITY : definition.maxLevel - owned;

/**
 * 예산으로 살 수 있는 최대 개수.
 * 계획서 5.4의 총비용 식을 N에 대해 풀면
 *   N = log_g( 1 + 예산 × (g-1) ÷ (기본가 × g^보유개수) )
 * 이고, 부동소수 오차 때문에 경계에서 ±1만 보정한다.
 */
export const getMaxAffordable = (
  definition: UpgradeDefinition,
  owned: number,
  budget: Big,
): number => {
  const remaining = getRemainingLevels(definition, owned);
  if (remaining <= 0) return 0;
  if (budget.sign() <= 0) return 0;

  const growth = definition.costGrowth;
  const start = big(definition.baseCost).mul(big(growth).pow(owned));
  if (start.sign() <= 0) return Number.isFinite(remaining) ? remaining : 0;

  const ratio = budget.mul(growth - 1).div(start).add(1);
  if (!isFiniteBig(ratio)) return Number.isFinite(remaining) ? remaining : 0;

  const solved = Math.floor(ratio.log10() / Math.log10(growth));
  let count = Math.max(0, Math.min(solved, Number.isFinite(remaining) ? remaining : solved));

  // 경계 보정: 로그 계산의 오차만 걷어낸다.
  while (count > 0 && getBulkCost(definition, owned, count).gt(budget)) count -= 1;
  while (count < remaining && getBulkCost(definition, owned, count + 1).lte(budget)) count += 1;

  return count;
};

/** 요청한 구매 수량에 대해 실제 구매 가능한 개수와 총비용을 계산한다. */
export const getPurchasePlan = (
  state: GameState,
  upgradeId: string,
  mode: PurchaseMode,
): PurchasePlan => {
  const definition = getUpgradeDefinition(upgradeId);
  const owned = getOwnedCount(state, upgradeId);
  const remaining = getRemainingLevels(definition, owned);

  if (mode === 'max') {
    const count = getMaxAffordable(definition, owned, state.ember);
    return {
      upgradeId,
      count,
      cost: getBulkCost(definition, owned, count),
      affordable: count > 0,
      cappedByMaxLevel: Number.isFinite(remaining) && count === remaining && count > 0,
    };
  }

  const requested = mode;
  const count = Number.isFinite(remaining) ? Math.min(requested, Math.max(0, remaining)) : requested;
  const cost = getBulkCost(definition, owned, count);
  return {
    upgradeId,
    count,
    cost,
    // 1개·10개 버튼은 요청한 수량을 전부 살 수 있을 때만 활성화한다.
    affordable: count > 0 && state.ember.gte(cost),
    cappedByMaxLevel: count < requested,
  };
};

export interface PurchaseResult {
  readonly state: GameState;
  readonly purchased: number;
  readonly spent: Big;
  readonly reason: 'ok' | 'locked' | 'max-level' | 'not-enough-ember';
}

/** 업그레이드를 구매한 새 상태를 돌려준다. 실패해도 상태는 그대로 유지한다. */
export const purchaseUpgrade = (
  state: GameState,
  upgradeId: string,
  mode: PurchaseMode,
): PurchaseResult => {
  const definition = getUpgradeDefinition(upgradeId);

  if (!isConditionMet(state, definition.unlockCondition)) {
    return { state, purchased: 0, spent: ZERO, reason: 'locked' };
  }

  const owned = getOwnedCount(state, upgradeId);
  if (getRemainingLevels(definition, owned) <= 0) {
    return { state, purchased: 0, spent: ZERO, reason: 'max-level' };
  }

  const plan = getPurchasePlan(state, upgradeId, mode);
  if (plan.count <= 0 || !plan.affordable) {
    return { state, purchased: 0, spent: ZERO, reason: 'not-enough-ember' };
  }

  return {
    state: {
      ...state,
      ember: clampNonNegative(state.ember.sub(plan.cost)),
      upgrades: { ...state.upgrades, [upgradeId]: owned + plan.count },
    },
    purchased: plan.count,
    spent: plan.cost,
    reason: 'ok',
  };
};

// ---------------------------------------------------------------------------
// 상점 표시 정보 (계획서 5.7)
// ---------------------------------------------------------------------------

export interface ShopEntry {
  readonly definition: UpgradeDefinition;
  readonly owned: number;
  readonly unlocked: boolean;
  /** 현재 이 업그레이드가 만드는 초당(또는 타격당) 생산량 */
  readonly currentContribution: Big;
  /** 1개 더 샀을 때의 생산량 */
  readonly contributionAfterPurchase: Big;
  /** 증가율(%) — 현재 기여가 0이면 null */
  readonly increaseRatio: number | null;
  readonly nextCost: Big;
  readonly nextMilestone: { atCount: number; multiplier: number; remaining: number } | null;
  readonly atMaxLevel: boolean;
}

/** 상점 한 줄에 필요한 정보를 한 번에 계산한다. */
export const getShopEntry = (state: GameState, upgradeId: string): ShopEntry => {
  const definition = getUpgradeDefinition(upgradeId);
  const owned = getOwnedCount(state, upgradeId);
  const modifiers = getModifiers(state);

  const currentContribution = getEffectiveContribution(state, upgradeId, modifiers);
  const afterState: GameState = {
    ...state,
    upgrades: { ...state.upgrades, [upgradeId]: owned + 1 },
  };
  // 배율형·편의형은 자기 자신의 배율도 바뀌므로 구매 후 상태의 배율로 다시 계산한다.
  const contributionAfterPurchase = getEffectiveContribution(afterState, upgradeId);

  const increaseRatio = currentContribution.sign() > 0
    ? contributionAfterPurchase.div(currentContribution).sub(1).toNumber() * 100
    : null;

  return {
    definition,
    owned,
    unlocked: isConditionMet(state, definition.unlockCondition),
    currentContribution,
    contributionAfterPurchase,
    increaseRatio,
    nextCost: getNextCost(definition, owned),
    nextMilestone: getNextMilestone(definition, owned),
    atMaxLevel: getRemainingLevels(definition, owned) <= 0,
  };
};

/** 상점에 노출할 업그레이드 목록. 잠긴 항목은 제외한다(12.2 "미완성 기능 미노출"). */
export const getVisibleUpgrades = (state: GameState): ShopEntry[] =>
  UPGRADES.filter((definition) => isConditionMet(state, definition.unlockCondition)).map(
    (definition) => getShopEntry(state, definition.id),
  );
