/** 계획서 17.1 - 환생(초기화·유지 항목과 인장 계산) 자동 테스트 */
import { describe, expect, it } from 'vitest';
import { big } from '../bignum';
import { createInitialState } from '../state';
import {
  getEmberRequiredForSeals,
  getPrestigePreview,
  getSealsForRun,
  getSkillUpgradeCost,
  isPrestigeUnlocked,
  performPrestige,
  purchasePrestigeSkill,
} from '../prestige';
import { getModifiers } from '../production';
import { PRESTIGE_DIVISOR, PRESTIGE_UNLOCK_RUN_EMBER } from '../../data/balance';
import type { GameState } from '../../types/index';

const base = createInitialState(0);

/** 밸런스 수치를 바꿔도 공식 자체를 검증하도록 기준값에서 유도한다. */
const divisor = big(PRESTIGE_DIVISOR);
const forSeals = (seals: number) => divisor.mul(seals * seals);

const runWith = (runEmber: string | ReturnType<typeof big>): GameState => {
  const amount = big(runEmber);
  return { ...base, ember: amount, lifetimeEmber: amount, runLifetimeEmber: amount };
};

describe('인장 획득 공식 (계획서 6.4)', () => {
  it('기준값 미만이면 0개다', () => {
    expect(getSealsForRun(big('0'))).toBe(0);
    expect(getSealsForRun(divisor.mul(0.96))).toBe(0);
    expect(getSealsForRun(divisor.sub(1))).toBe(0);
  });

  it('정확한 제곱 경계에서 반올림 오차 없이 계산한다', () => {
    expect(getSealsForRun(forSeals(1))).toBe(1);
    expect(getSealsForRun(forSeals(2))).toBe(2);
    expect(getSealsForRun(forSeals(3))).toBe(3);
    expect(getSealsForRun(forSeals(4))).toBe(4);
  });

  it('경계 바로 아래에서는 한 개 적다', () => {
    expect(getSealsForRun(forSeals(2).sub(1))).toBe(1);
    expect(getSealsForRun(forSeals(3).sub(1))).toBe(2);
  });

  it('필요 누적 잉걸불 역산이 공식과 맞물린다', () => {
    for (const seals of [1, 2, 3, 10, 50]) {
      const required = getEmberRequiredForSeals(seals);
      expect(getSealsForRun(required)).toBe(seals);
      // 1%만 모자라도 한 개 적게 나온다.
      // (경계에서 1 잉걸불 차이는 상대 오차 허용치 안이라 의도적으로 같은 값으로 본다)
      expect(getSealsForRun(required.mul(0.99))).toBe(seals - 1);
    }
  });

  it('아주 큰 누적에서도 유한한 값을 돌려준다', () => {
    expect(Number.isFinite(getSealsForRun(big('1e60')))).toBe(true);
  });
});

describe('환생 미리보기 (계획서 6.4 / 12.4)', () => {
  it('예상 인장이 0개면 환생할 수 없다', () => {
    const preview = getPrestigePreview(runWith(divisor.mul(0.5)));
    expect(preview.sealsGained).toBe(0);
    expect(preview.canPrestige).toBe(false);
  });

  it('초기화 항목과 유지 항목을 함께 알려준다', () => {
    const preview = getPrestigePreview(runWith(forSeals(2)));
    expect(preview.sealsGained).toBe(2);
    expect(preview.canPrestige).toBe(true);
    expect(preview.resets).toContain('잉걸불로 구매한 일반 업그레이드');
    expect(preview.keeps).toContain('명인의 인장과 영구 능력');
  });

  it('환생 메뉴는 이번 생애 누적이 기준을 넘겨야 열린다', () => {
    expect(isPrestigeUnlocked(runWith(big(PRESTIGE_UNLOCK_RUN_EMBER).sub(1)))).toBe(false);
    expect(isPrestigeUnlocked(runWith(big(PRESTIGE_UNLOCK_RUN_EMBER)))).toBe(true);
    // 한 번 환생한 뒤에는 항상 열려 있다.
    expect(isPrestigeUnlocked({ ...base, prestige: { ...base.prestige, count: 1 } })).toBe(true);
  });

  it('환생 메뉴 해금 시점이 첫 환생 가능 시점보다 빠르다 (계획서 6.2)', () => {
    expect(big(PRESTIGE_UNLOCK_RUN_EMBER).lt(divisor)).toBe(true);
  });
});

describe('환생 실행 (계획서 6.4)', () => {
  const before: GameState = {
    ...runWith(forSeals(2)),
    clickCount: 1234,
    upgrades: { apprentice: 40, bellows: 12 },
    achievements: { first_hit: { unlocked: true, claimed: true, unlockedAt: null } },
    unlocks: ['decor_miners_lamp'],
    orders: { slots: [], completedOrderIds: ['farmers_scythe'], completedCount: 4 },
  };

  it('진행 인장이 부족하면 아무것도 하지 않는다', () => {
    const result = performPrestige(runWith(divisor.mul(0.5)), 0);
    expect(result.performed).toBe(false);
    expect(result.reason).toBe('not-enough-progress');
  });

  it('현재 잉걸불·일반 업그레이드·진행 중 주문을 초기화한다', () => {
    const { state } = performPrestige(before, 5000);
    expect(state.ember.toString()).toBe('0');
    expect(state.runLifetimeEmber.toString()).toBe('0');
    expect(state.upgrades).toEqual({});
    expect(state.orders.slots).toEqual([]);
    expect(state.orders.completedOrderIds).toEqual([]);
  });

  it('평생 누적·업적·외형·인장·타격 수는 유지한다', () => {
    const { state, sealsGained } = performPrestige(before, 5000);
    expect(sealsGained).toBe(2);
    expect(state.lifetimeEmber.toString()).toBe(before.lifetimeEmber.toString());
    expect(state.clickCount).toBe(1234);
    expect(state.achievements.first_hit?.claimed).toBe(true);
    expect(state.unlocks).toEqual(['decor_miners_lamp']);
    expect(state.prestige.count).toBe(1);
    expect(state.prestige.masterSeals).toBe(2);
    expect(state.orders.completedCount).toBe(4);
  });

  it('영구 강화 단계는 환생해도 남는다', () => {
    const withSkills: GameState = {
      ...before,
      prestige: { count: 2, masterSeals: 3, permanentSkills: { skilled_hands: 4 } },
    };
    const { state } = performPrestige(withSkills, 5000);
    expect(state.prestige.permanentSkills.skilled_hands).toBe(4);
    expect(state.prestige.masterSeals).toBe(5); // 3 + 2
  });
});

describe('명인의 인장 영구 강화 (계획서 6.4)', () => {
  const rich: GameState = {
    ...base,
    prestige: { count: 1, masterSeals: 10, permanentSkills: {} },
  };

  it('단계가 오를수록 비용이 오른다', () => {
    expect(getSkillUpgradeCost(rich, 'skilled_hands')).toBe(1);
    const after = purchasePrestigeSkill(rich, 'skilled_hands').state;
    expect(getSkillUpgradeCost(after, 'skilled_hands')).toBe(2);
  });

  it('인장을 소비하고 배율에 즉시 반영된다', () => {
    const result = purchasePrestigeSkill(rich, 'auto_bellows');
    expect(result.purchased).toBe(true);
    expect(result.spent).toBe(1);
    expect(result.state.prestige.masterSeals).toBe(9);
    expect(getModifiers(result.state).auto.toNumber()).toBeCloseTo(1.05, 10);
  });

  it('인장이 모자라면 구매되지 않는다', () => {
    const poor: GameState = { ...base, prestige: { count: 1, masterSeals: 0, permanentSkills: {} } };
    const result = purchasePrestigeSkill(poor, 'skilled_hands');
    expect(result.purchased).toBe(false);
    expect(result.reason).toBe('not-enough-seals');
    expect(result.state).toBe(poor);
  });

  it('최대 단계를 넘길 수 없다', () => {
    const maxed: GameState = {
      ...base,
      prestige: { count: 1, masterSeals: 9999, permanentSkills: { night_shift: 10 } },
    };
    expect(getSkillUpgradeCost(maxed, 'night_shift')).toBeNull();
    expect(purchasePrestigeSkill(maxed, 'night_shift').reason).toBe('max-level');
  });

  it('여러 방향에 동시에 투자할 수 있다 (배타적 선택이 아님)', () => {
    let state = rich;
    state = purchasePrestigeSkill(state, 'skilled_hands').state;
    state = purchasePrestigeSkill(state, 'auto_bellows').state;
    state = purchasePrestigeSkill(state, 'royal_contract').state;

    expect(state.prestige.permanentSkills.skilled_hands).toBe(1);
    expect(state.prestige.permanentSkills.auto_bellows).toBe(1);
    expect(state.prestige.permanentSkills.royal_contract).toBe(1);
    expect(state.prestige.masterSeals).toBe(10 - 1 - 1 - 2);
  });
});
