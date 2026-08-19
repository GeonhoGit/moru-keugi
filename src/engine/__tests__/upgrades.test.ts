/** 계획서 17.1 - 비용 계산(1개·10개·최대 구매) 자동 테스트 */
import { describe, expect, it } from 'vitest';
import { big } from '../bignum';
import { createInitialState, withEmber } from '../state';
import {
  getBulkCost,
  getMaxAffordable,
  getNextCost,
  getPurchasePlan,
  getShopEntry,
  getVisibleUpgrades,
  purchaseUpgrade,
} from '../upgrades';
import { getMilestoneMultiplier, getUpgradeContribution } from '../production';
import { getUpgradeDefinition } from '../../data/upgrades';

const apprentice = getUpgradeDefinition('apprentice');
const anvil = getUpgradeDefinition('master_anvil');

/**
 * 밸런스 수치를 바꿔도 공식 자체를 검증하도록 정의에서 기대값을 유도한다.
 * 여기에 숫자를 직접 박아 두면 밸런스 패치마다 테스트가 깨진다.
 */
const expectedNextCost = (owned: number): number =>
  Math.floor(Number(apprentice.baseCost) * apprentice.costGrowth ** owned);

const expectedBulkCost = (owned: number, count: number): number => {
  const g = apprentice.costGrowth;
  return Math.floor(
    Number(apprentice.baseCost) * g ** owned * ((g ** count - 1) / (g - 1)),
  );
};

describe('비용 공식 (계획서 5.4)', () => {
  it('보유 0개일 때 다음 1개 비용은 기본가와 같다', () => {
    expect(getNextCost(apprentice, 0).toString()).toBe(apprentice.baseCost);
  });

  it('다음 1개 비용은 기본가 × 성장률^보유개수를 내림한 값이다', () => {
    for (const owned of [1, 5, 12, 40]) {
      const actual = getNextCost(apprentice, owned).toNumber();
      expect(Number.isInteger(actual)).toBe(true);
      // 일반 number로 계산한 기준값과 최대 1까지만 벌어진다.
      // 정확한 경계에서는 큰 수 라이브러리 쪽이 오히려 더 정확하다.
      // (100 × 1.15 는 float에서 114.99999999999999 라 내림하면 114가 된다)
      expect(Math.abs(actual - expectedNextCost(owned))).toBeLessThanOrEqual(1);
    }
  });

  it('N=1 총비용과 다음 1개 비용이 같다 (반올림 규칙 통일)', () => {
    for (const owned of [0, 1, 7, 33, 120]) {
      expect(getBulkCost(apprentice, owned, 1).toString()).toBe(
        getNextCost(apprentice, owned).toString(),
      );
    }
  });

  it('10개 총비용은 등비수열 합과 일치한다', () => {
    for (const [owned, count] of [[0, 10], [7, 25]] as const) {
      const actual = getBulkCost(apprentice, owned, count).toNumber();
      const expected = expectedBulkCost(owned, count);
      expect(Math.abs(actual - expected) / expected).toBeLessThan(1e-9);
    }
  });

  it('0개 이하를 요청하면 비용은 0이다', () => {
    expect(getBulkCost(apprentice, 0, 0).toString()).toBe('0');
    expect(getBulkCost(apprentice, 0, -3).toString()).toBe('0');
  });

  it('나눠 사도 총비용이 한 번에 사는 것과 어긋나지 않는다', () => {
    const whole = getBulkCost(apprentice, 0, 20);
    const split = getBulkCost(apprentice, 0, 8).add(getBulkCost(apprentice, 8, 12));
    // 내림 시점 차이로 최대 1 잉걸불까지만 벌어져야 한다.
    expect(whole.sub(split).abs().lte(big(1))).toBe(true);
  });
});

describe('최대 구매 (계획서 5.4 - 반복문 대신 수식)', () => {
  const costOfTen = getBulkCost(apprentice, 0, 10);

  it('10개 총비용을 정확히 가지고 있으면 10개를 산다', () => {
    expect(getMaxAffordable(apprentice, 0, costOfTen)).toBe(10);
  });

  it('1 잉걸불 모자라면 9개만 산다', () => {
    expect(getMaxAffordable(apprentice, 0, costOfTen.sub(1))).toBe(9);
  });

  it('기본가보다 적으면 0개다', () => {
    expect(getMaxAffordable(apprentice, 0, big(apprentice.baseCost).sub(1))).toBe(0);
    expect(getMaxAffordable(apprentice, 0, big('0'))).toBe(0);
  });

  it('구한 개수의 총비용은 예산 이하이고, 한 개 더 사면 예산을 넘는다', () => {
    for (const budget of ['15', '1000', '1e6', '1e12', '1e40', '1e120']) {
      const count = getMaxAffordable(apprentice, 3, big(budget));
      expect(getBulkCost(apprentice, 3, count).lte(big(budget))).toBe(true);
      expect(getBulkCost(apprentice, 3, count + 1).gt(big(budget))).toBe(true);
    }
  });

  it('최대 레벨이 있는 업그레이드는 남은 레벨을 넘지 않는다', () => {
    expect(anvil.maxLevel).toBe(25);
    expect(getMaxAffordable(anvil, 20, big('1e30'))).toBe(5);
    expect(getMaxAffordable(anvil, 25, big('1e30'))).toBe(0);
  });
});

describe('구매 (계획서 5.7)', () => {
  const costOfTen = getBulkCost(apprentice, 0, 10);

  it('잉걸불을 차감하고 보유 개수를 늘린다', () => {
    const budget = costOfTen.add(500);
    const state = withEmber(createInitialState(0), budget.toString());
    const result = purchaseUpgrade(state, 'apprentice', 10);

    expect(result.reason).toBe('ok');
    expect(result.purchased).toBe(10);
    expect(result.spent.toString()).toBe(costOfTen.toString());
    expect(result.state.upgrades.apprentice).toBe(10);
    expect(result.state.ember.toString()).toBe('500');
  });

  it('구매는 평생 누적 잉걸불을 늘리지 않는다', () => {
    const state = withEmber(createInitialState(0), costOfTen.toString());
    const result = purchaseUpgrade(state, 'apprentice', 1);
    expect(result.state.lifetimeEmber.toString()).toBe('0');
  });

  it('잉걸불이 모자라면 상태를 바꾸지 않는다', () => {
    const state = withEmber(createInitialState(0), big(apprentice.baseCost).sub(1).toString());
    const result = purchaseUpgrade(state, 'apprentice', 1);

    expect(result.reason).toBe('not-enough-ember');
    expect(result.purchased).toBe(0);
    expect(result.state).toBe(state);
  });

  it('10개 버튼은 10개를 다 살 수 없으면 구매되지 않는다', () => {
    const state = withEmber(createInitialState(0), costOfTen.sub(1).toString());
    expect(getPurchasePlan(state, 'apprentice', 10).affordable).toBe(false);
    expect(purchaseUpgrade(state, 'apprentice', 10).purchased).toBe(0);
  });

  it('해금되지 않은 업그레이드는 잉걸불이 넘쳐도 살 수 없다', () => {
    const state = withEmber(createInitialState(0), '1e30');
    const result = purchaseUpgrade(state, 'dragonflame_forge', 1);
    expect(result.reason).toBe('locked');
  });

  it('최대 레벨에 도달하면 더 살 수 없다', () => {
    const base = withEmber(createInitialState(0), '1e40');
    const state = {
      ...base,
      // 주문 작업대는 주문 2개 완료가 해금 조건이라 먼저 만족시킨다.
      orders: { ...base.orders, completedCount: 2 },
      upgrades: { ...base.upgrades, order_bench: 5 },
    };
    expect(purchaseUpgrade(state, 'order_bench', 1).reason).toBe('max-level');
  });
});

describe('마일스톤 (계획서 5.6)', () => {
  it('보유 개수에 도달한 배율만 곱한다', () => {
    expect(getMilestoneMultiplier(apprentice, 9).toString()).toBe('1');
    expect(getMilestoneMultiplier(apprentice, 10).toString()).toBe('2');
    expect(getMilestoneMultiplier(apprentice, 25).toString()).toBe('4');
    expect(getMilestoneMultiplier(apprentice, 50).toString()).toBe('12');
    expect(getMilestoneMultiplier(apprentice, 100).toString()).toBe('48');
  });

  it('생산량 = 기본 생산량 × 보유개수 × 마일스톤 배율', () => {
    // 0.5 × 10 × 2 = 10
    expect(getUpgradeContribution(apprentice, 10).toString()).toBe('10');
  });

  it('배율형 업그레이드는 생산량을 직접 만들지 않는다', () => {
    expect(getUpgradeContribution(anvil, 5).toString()).toBe('0');
  });
});

describe('상점 표시 정보 (계획서 5.7)', () => {
  it('구매 후 증가량과 증가율을 계산한다', () => {
    const base = createInitialState(0);
    const state = { ...base, upgrades: { apprentice: 4 } };
    const entry = getShopEntry(state, 'apprentice');

    expect(entry.owned).toBe(4);
    expect(entry.currentContribution.toString()).toBe('2'); // 0.5 × 4
    expect(entry.contributionAfterPurchase.toString()).toBe('2.5'); // 0.5 × 5
    expect(entry.increaseRatio).toBeCloseTo(25, 6);
    expect(entry.nextMilestone).toEqual({ atCount: 10, multiplier: 2, remaining: 6 });
  });

  it('잠긴 업그레이드는 상점 목록에 나오지 않는다', () => {
    const visible = getVisibleUpgrades(createInitialState(0)).map((entry) => entry.definition.id);
    expect(visible).toEqual(['iron_tongs', 'apprentice']);
  });
});
