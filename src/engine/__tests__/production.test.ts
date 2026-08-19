/** 계획서 17.1 - 생산량(업그레이드·마일스톤·배율 계층) 자동 테스트 */
import { describe, expect, it } from 'vitest';
import {
  getAutoRate,
  getBaseAutoRate,
  getBaseClickPower,
  getClickPower,
  getEffectiveContribution,
  getModifiers,
} from '../production';
import { createInitialState, performClick, tick } from '../state';
import type { GameState } from '../../types/index';

const base = createInitialState(0);

describe('기본 생산량 (계획서 5.5)', () => {
  it('아무것도 없으면 자동 생산은 0, 타격은 1이다', () => {
    expect(getBaseAutoRate(base).toString()).toBe('0');
    expect(getClickPower(base).toString()).toBe('1');
  });

  it('자동 생산형 업그레이드의 생산량을 모두 더한다', () => {
    const state: GameState = { ...base, upgrades: { apprentice: 4, bellows: 2 } };
    // 0.5×4 + 5×2 = 12
    expect(getBaseAutoRate(state).toString()).toBe('12');
  });

  it('타격력형 업그레이드는 기본 타격량에 더해진다', () => {
    const state: GameState = { ...base, upgrades: { iron_tongs: 3 } };
    // 1 + 1×3 = 4
    expect(getBaseClickPower(state).toString()).toBe('4');
  });
});

describe('보너스 스택 규칙 (계획서 6.3)', () => {
  it('같은 계층의 퍼센트 보너스는 먼저 더한다', () => {
    // 명장의 모루 auto +8%/개 × 2개 = +16%, 자동 풀무 +5%/단계 × 3단계 = +15%
    const state: GameState = {
      ...base,
      upgrades: { apprentice: 10, master_anvil: 2 },
      prestige: { count: 1, masterSeals: 0, permanentSkills: { auto_bellows: 3 } },
    };
    expect(getModifiers(state).auto.toNumber()).toBeCloseTo(1.31, 10);
  });

  it('서로 다른 계층은 곱한다', () => {
    const state: GameState = {
      ...base,
      upgrades: { apprentice: 10, master_anvil: 2, dragonflame_forge: 1 },
      prestige: { count: 1, masterSeals: 0, permanentSkills: { auto_bellows: 3 } },
    };
    const modifiers = getModifiers(state);
    expect(modifiers.auto.toNumber()).toBeCloseTo(1.31, 10);
    expect(modifiers.global.toNumber()).toBeCloseTo(1.1, 10);

    // 기본 자동 생산량 = 0.5 × 10 × 2(마일스톤) = 10
    expect(getBaseAutoRate(state).toString()).toBe('10');
    // 최종 = 10 × 1.31 × 1.1 × 1 = 14.41
    expect(getAutoRate(state).toNumber()).toBeCloseTo(14.41, 8);
  });

  it('타격 계층은 자동 생산 계층의 영향을 받지 않는다', () => {
    const state: GameState = {
      ...base,
      upgrades: { iron_tongs: 1, master_anvil: 5 },
      prestige: { count: 1, masterSeals: 0, permanentSkills: { skilled_hands: 4 } },
    };
    // 타격 배율 = 1 + 0.05×4 = 1.2, 기본 타격량 = 1 + 1 = 2
    expect(getClickPower(state).toNumber()).toBeCloseTo(2.4, 8);
  });

  it('보상을 수령한 업적만 배율에 반영된다', () => {
    const unlockedOnly: GameState = {
      ...base,
      achievements: { ember_1b: { unlocked: true, claimed: false, unlockedAt: null } },
    };
    expect(getModifiers(unlockedOnly).global.toNumber()).toBeCloseTo(1, 10);

    const claimed: GameState = {
      ...base,
      achievements: { ember_1b: { unlocked: true, claimed: true, unlockedAt: null } },
    };
    expect(getModifiers(claimed).global.toNumber()).toBeCloseTo(1.01, 10);
  });

  it('주문 보상과 오프라인 효율도 같은 규칙을 따른다', () => {
    const state: GameState = {
      ...base,
      upgrades: { banked_embers: 2, order_bench: 3 },
      prestige: {
        count: 1,
        masterSeals: 0,
        permanentSkills: { night_shift: 5, royal_contract: 2 },
      },
    };
    const modifiers = getModifiers(state);
    // 오프라인: 0.05×2 + 0.03×5 = +0.25
    expect(modifiers.offline.toNumber()).toBeCloseTo(1.25, 10);
    // 주문 보상: 0.1×3 + 0.04×2 = +0.38
    expect(modifiers.orderReward.toNumber()).toBeCloseTo(1.38, 10);
  });
});

describe('개별 업그레이드 기여량 (계획서 5.7)', () => {
  it('배율까지 반영한 값을 돌려준다', () => {
    const state: GameState = { ...base, upgrades: { apprentice: 10, master_anvil: 1 } };
    // 0.5 × 10 × 2 = 10, auto 배율 1.08
    expect(getEffectiveContribution(state, 'apprentice').toNumber()).toBeCloseTo(10.8, 8);
  });
});

describe('시간 진행', () => {
  it('경과 시간만큼 자동 생산이 쌓인다', () => {
    const state: GameState = { ...base, upgrades: { apprentice: 2 } }; // 1/초
    const after = tick(state, 60, 60_000);
    expect(after.ember.toString()).toBe('60');
    expect(after.lifetimeEmber.toString()).toBe('60');
    expect(after.runLifetimeEmber.toString()).toBe('60');
  });

  it('델타를 쪼개도 결과가 같다 (프레임 빈도와 무관)', () => {
    const state: GameState = { ...base, upgrades: { apprentice: 2 } };
    const once = tick(state, 60, 60_000);
    let stepped = state;
    for (let i = 0; i < 60; i += 1) stepped = tick(stepped, 1, (i + 1) * 1000);
    expect(stepped.ember.toNumber()).toBeCloseTo(once.ember.toNumber(), 8);
  });

  it('0 이하나 유효하지 않은 델타는 무시한다', () => {
    const state: GameState = { ...base, upgrades: { apprentice: 2 } };
    expect(tick(state, 0, 0)).toBe(state);
    expect(tick(state, -5, 0)).toBe(state);
    expect(tick(state, Number.NaN, 0)).toBe(state);
  });

  it('타격은 세 누적값과 타격 수를 함께 올린다', () => {
    const result = performClick(base, 0);
    expect(result.gained.toString()).toBe('1');
    expect(result.state.ember.toString()).toBe('1');
    expect(result.state.lifetimeEmber.toString()).toBe('1');
    expect(result.state.runLifetimeEmber.toString()).toBe('1');
    expect(result.state.clickCount).toBe(1);
  });
});
