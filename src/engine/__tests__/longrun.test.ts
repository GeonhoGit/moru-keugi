/**
 * 계획서 17.3 - 장시간 테스트.
 *
 * 업그레이드 100개 이상, 반복 환생 50회 이상에서
 * 가격·생산량이 무한대나 NaN이 되지 않는지, 저장 크기와 계산 성능이 유지되는지 확인한다.
 */
import { describe, expect, it } from 'vitest';
import { big, formatKorean, formatShort, isFiniteBig } from '../bignum';
import { createInitialState, tick, withEmber } from '../state';
import { getAutoRate, getClickPower, getModifiers } from '../production';
import { getBulkCost, getMaxAffordable, getNextCost, purchaseUpgrade } from '../upgrades';
import { getSealsForRun, performPrestige, purchasePrestigeSkill } from '../prestige';
import { toSaveData, fromSaveData } from '../serialize';
import { getUpgradeDefinition, UPGRADES } from '../../data/upgrades';
import { PRESTIGE_DIVISOR } from '../../data/balance';
import type { GameState } from '../../types/index';

const apprentice = getUpgradeDefinition('apprentice');

describe('업그레이드 100개 이상', () => {
  it('비용이 무한대나 NaN이 되지 않는다', () => {
    for (const owned of [100, 250, 500, 1000, 2000]) {
      const cost = getNextCost(apprentice, owned);
      expect(isFiniteBig(cost)).toBe(true);
      expect(cost.toString()).not.toContain('NaN');
      expect(isFiniteBig(getBulkCost(apprentice, owned, 100))).toBe(true);
    }
  });

  it('생산량이 유한하고 표기가 깨지지 않는다', () => {
    const state: GameState = {
      ...createInitialState(0),
      upgrades: { apprentice: 1500, iron_tongs: 900, bellows: 700, coal_forge: 500 },
    };
    const autoRate = getAutoRate(state);
    const clickPower = getClickPower(state);

    expect(isFiniteBig(autoRate)).toBe(true);
    expect(isFiniteBig(clickPower)).toBe(true);
    expect(formatShort(autoRate)).not.toContain('NaN');
    expect(formatKorean(autoRate)).not.toContain('NaN');
    expect(formatShort(clickPower)).toMatch(/^[\d.]+[A-Za-z]*$/);
  });

  it('아주 큰 예산에서도 최대 구매가 즉시 끝나고 결과가 정합적이다', () => {
    const started = Date.now();
    for (const budget of ['1e50', '1e150', '1e300']) {
      const count = getMaxAffordable(apprentice, 0, big(budget));
      expect(Number.isFinite(count)).toBe(true);
      expect(getBulkCost(apprentice, 0, count).lte(big(budget))).toBe(true);
      expect(getBulkCost(apprentice, 0, count + 1).gt(big(budget))).toBe(true);
    }
    // 반복문이 아니라 수식으로 풀어야 한다 (계획서 5.4)
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('반복 환생 50회', () => {
  it('상태가 계속 정합적이고 저장 크기가 폭발하지 않는다', () => {
    let state = createInitialState(0);
    let now = 0;
    // 밸런스 수치와 무관하게 매 환생마다 인장 21개가 나오는 누적을 만든다.
    const runEmber = big(PRESTIGE_DIVISOR).mul(21 * 21);

    for (let round = 0; round < 50; round += 1) {
      now += 60_000;
      state = {
        ...state,
        ember: runEmber,
        lifetimeEmber: state.lifetimeEmber.add(runEmber),
        runLifetimeEmber: runEmber,
      };
      state = purchaseUpgrade(state, 'apprentice', 'max').state;

      const result = performPrestige(state, now);
      expect(result.performed).toBe(true);
      state = result.state;

      // 인장을 실제로 소비해 강화 단계를 올린다.
      state = purchasePrestigeSkill(state, 'auto_bellows').state;
      state = purchasePrestigeSkill(state, 'skilled_hands').state;
    }

    expect(state.prestige.count).toBe(50);
    expect(isFiniteBig(state.lifetimeEmber)).toBe(true);
    expect(state.prestige.permanentSkills.auto_bellows).toBe(20); // 최대 단계에서 멈춘다
    expect(state.prestige.masterSeals).toBeGreaterThan(0);

    // 환생을 반복해도 저장본이 커지지 않아야 한다 (누적 배열이 없어야 한다).
    const saveSize = JSON.stringify(toSaveData(state, now)).length;
    expect(saveSize).toBeLessThan(4000);

    const restored = fromSaveData(JSON.parse(JSON.stringify(toSaveData(state, now))));
    expect(restored.validation.valid).toBe(true);
    expect(restored.state?.prestige.count).toBe(50);
  });

  it('환생을 반복해도 인장 계산이 단조적이다', () => {
    let previous = 0;
    for (const exponent of [7, 8, 9, 10, 12, 15, 20, 30]) {
      const seals = getSealsForRun(big(`1e${exponent}`));
      expect(seals).toBeGreaterThanOrEqual(previous);
      expect(Number.isFinite(seals)).toBe(true);
      previous = seals;
    }
  });
});

describe('장시간 진행 시뮬레이션', () => {
  it('24시간 분량을 1초 단위로 돌려도 값이 깨지지 않는다', () => {
    let state: GameState = {
      ...createInitialState(0),
      upgrades: { apprentice: 50, bellows: 30, coal_forge: 20, master_anvil: 10 },
    };

    for (let second = 1; second <= 86_400; second += 1) {
      state = tick(state, 1, second * 1000);
    }

    expect(isFiniteBig(state.ember)).toBe(true);
    expect(state.ember.sign()).toBe(1);
    expect(state.ember.toString()).not.toContain('NaN');
    expect(state.lifetimeEmber.toString()).toBe(state.ember.toString());
  });

  it('모든 업그레이드를 최대까지 사도 배율이 유한하다', () => {
    let state = withEmber(createInitialState(0), '1e300');
    state = {
      ...state,
      lifetimeEmber: big('1e300'),
      prestige: { count: 5, masterSeals: 0, permanentSkills: {} },
      orders: { slots: [], completedOrderIds: [], completedCount: 10 },
    };

    for (const definition of UPGRADES) {
      state = purchaseUpgrade(state, definition.id, 'max').state;
    }

    const modifiers = getModifiers(state);
    for (const value of Object.values(modifiers)) {
      expect(isFiniteBig(value)).toBe(true);
      expect(value.gte(1)).toBe(true);
    }
    expect(isFiniteBig(getAutoRate(state))).toBe(true);
    expect(isFiniteBig(getClickPower(state))).toBe(true);
  });
});
