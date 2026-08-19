/**
 * 조건 진행률 (업적 화면의 목록).
 *
 * "10,000번 두드린다"만 보여 주고 지금 몇 번인지 감추면 목표가 얼마나 가까운지
 * 알 수 없다. 그 계산이 맞는지 확인한다.
 */
import { describe, expect, it } from 'vitest';
import { big } from '../bignum';
import { createInitialState } from '../state';
import { getConditionProgress } from '../unlock';
import { ACHIEVEMENTS } from '../../data/achievements';
import type { GameState } from '../../types/index';

const base = createInitialState(0);

describe('진행률 계산', () => {
  it('타격 수 조건의 현재값과 목표를 그대로 돌려준다', () => {
    const state: GameState = { ...base, clickCount: 250 };
    const result = getConditionProgress(state, { kind: 'clickCount', count: 500 });

    expect(result.current.toString()).toBe('250');
    expect(result.target.toString()).toBe('500');
    expect(result.ratio).toBeCloseTo(0.5, 10);
  });

  it('평생 누적 잉걸불도 같은 방식으로 계산한다', () => {
    const state: GameState = { ...base, lifetimeEmber: big('250') };
    const result = getConditionProgress(state, { kind: 'lifetimeEmber', amount: '1000' });
    expect(result.ratio).toBeCloseTo(0.25, 10);
  });

  it('이미 넘어섰으면 1을 넘지 않는다', () => {
    const state: GameState = { ...base, clickCount: 9999 };
    expect(getConditionProgress(state, { kind: 'clickCount', count: 5 }).ratio).toBe(1);
  });

  it('시작 전이면 0이다', () => {
    expect(getConditionProgress(base, { kind: 'clickCount', count: 500 }).ratio).toBe(0);
  });

  it('여러 조건이면 가장 뒤처진 것을 돌려준다', () => {
    // 실제로 남은 일은 더 느린 쪽이다.
    const state: GameState = { ...base, upgrades: { bellows: 3, coal_forge: 1 } };
    const result = getConditionProgress(state, {
      kind: 'upgradesOwned',
      requirements: [
        { upgradeId: 'bellows', count: 3 }, // 100%
        { upgradeId: 'coal_forge', count: 4 }, // 25%
      ],
    });

    expect(result.ratio).toBeCloseTo(0.25, 10);
    expect(result.current.toString()).toBe('1');
    expect(result.target.toString()).toBe('4');
  });

  it('중첩된 all 조건도 가장 뒤처진 것을 찾는다', () => {
    const state: GameState = { ...base, lifetimeEmber: big('1e7'), prestige: { ...base.prestige, count: 0 } };
    const result = getConditionProgress(state, {
      kind: 'all',
      conditions: [
        { kind: 'prestigeCount', count: 1 }, // 0%
        { kind: 'lifetimeEmber', amount: '1e8' }, // 10%
      ],
    });
    expect(result.ratio).toBe(0);
  });

  it('항상 참인 조건은 1이다', () => {
    expect(getConditionProgress(base, { kind: 'always' }).ratio).toBe(1);
  });
});

describe('모든 업적이 진행률을 낼 수 있다', () => {
  it('13종 전부 유한한 비율을 돌려준다', () => {
    for (const achievement of ACHIEVEMENTS) {
      const result = getConditionProgress(base, achievement.condition);
      expect(Number.isFinite(result.ratio)).toBe(true);
      expect(result.ratio).toBeGreaterThanOrEqual(0);
      expect(result.ratio).toBeLessThanOrEqual(1);
    }
  });

  it('진행이 있으면 비율이 오른다', () => {
    const before = getConditionProgress(base, { kind: 'clickCount', count: 10000 }).ratio;
    const after = getConditionProgress(
      { ...base, clickCount: 3000 },
      { kind: 'clickCount', count: 10000 },
    ).ratio;

    expect(after).toBeGreaterThan(before);
    expect(after).toBeCloseTo(0.3, 10);
  });
});
