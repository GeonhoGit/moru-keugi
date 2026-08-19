/** 계획서 17.1 - 업적(경계값 중복 지급 방지) 자동 테스트 */
import { describe, expect, it } from 'vitest';
import { big } from '../bignum';
import {
  claimAchievement,
  evaluateAchievements,
  getClaimableAchievements,
  getTotalCount,
  getUnlockedCount,
} from '../achievements';
import { createInitialState, performClick, tick } from '../state';
import type { GameState } from '../../types/index';

const base = createInitialState(0);

describe('해금 판정 (계획서 4.2)', () => {
  it('V1.0 업적은 10종 이상이다 (완료 정의 18.1)', () => {
    expect(getTotalCount()).toBeGreaterThanOrEqual(10);
  });

  it('조건을 만족하면 해금되고 해금 시각이 기록된다', () => {
    const state: GameState = { ...base, clickCount: 1 };
    const { state: after, newlyUnlocked } = evaluateAchievements(state, 1_700_000_000_000);

    expect(newlyUnlocked).toContain('first_hit');
    expect(after.achievements.first_hit?.unlocked).toBe(true);
    expect(after.achievements.first_hit?.claimed).toBe(false);
    expect(after.achievements.first_hit?.unlockedAt).toBe('2023-11-14T22:13:20.000Z');
  });

  it('경계값 바로 아래에서는 해금되지 않는다', () => {
    const below: GameState = { ...base, clickCount: 499 };
    expect(evaluateAchievements(below, 0).newlyUnlocked).not.toContain('hits_500');

    const at: GameState = { ...base, clickCount: 500 };
    expect(evaluateAchievements(at, 0).newlyUnlocked).toContain('hits_500');
  });

  it('평생 누적 잉걸불 경계도 정확히 판정한다', () => {
    const below: GameState = { ...base, lifetimeEmber: big('999') };
    expect(evaluateAchievements(below, 0).newlyUnlocked).not.toContain('ember_1k');

    const at: GameState = { ...base, lifetimeEmber: big('1000') };
    expect(evaluateAchievements(at, 0).newlyUnlocked).toContain('ember_1k');
  });

  it('이미 해금된 업적은 다시 해금되지 않고 해금 시각도 덮어쓰지 않는다', () => {
    const first = evaluateAchievements({ ...base, clickCount: 1 }, 1000).state;
    const second = evaluateAchievements(first, 9999);

    expect(second.newlyUnlocked).toEqual([]);
    expect(second.state).toBe(first);
    expect(second.state.achievements.first_hit?.unlockedAt).toBe(new Date(1000).toISOString());
  });

  it('바뀐 게 없으면 새 상태 객체를 만들지 않는다', () => {
    const result = evaluateAchievements(base, 0);
    expect(result.state).toBe(base);
  });
});

describe('보상 수령 (중복 지급 방지)', () => {
  // `first_upgrade`는 잉걸불 25를 주는 업적이다.
  const withUpgrade: GameState = { ...base, upgrades: { apprentice: 1 } };
  const unlocked = evaluateAchievements(withUpgrade, 0).state;

  it('해금 전에는 수령할 수 없다', () => {
    const result = claimAchievement(base, 'first_upgrade');
    expect(result.claimed).toBe(false);
    expect(result.reason).toBe('not-unlocked');
    expect(result.state).toBe(base);
  });

  it('수령하면 잉걸불이 지급된다', () => {
    const result = claimAchievement(unlocked, 'first_upgrade');
    expect(result.claimed).toBe(true);
    expect(result.emberGained.toString()).toBe('25');
    expect(result.state.ember.toString()).toBe('25');
    expect(result.state.lifetimeEmber.toString()).toBe('25');
  });

  it('보상이 없는 기념 업적도 수령 처리는 된다', () => {
    const hitOnce = evaluateAchievements({ ...base, clickCount: 1 }, 0).state;
    const result = claimAchievement(hitOnce, 'first_hit');
    expect(result.claimed).toBe(true);
    expect(result.emberGained.toString()).toBe('0');
  });

  it('같은 업적을 두 번 수령할 수 없다', () => {
    const first = claimAchievement(unlocked, 'first_upgrade');
    const second = claimAchievement(first.state, 'first_upgrade');

    expect(second.claimed).toBe(false);
    expect(second.reason).toBe('already-claimed');
    expect(second.state.ember.toString()).toBe('25');
  });

  it('알 수 없는 업적 id는 조용히 거절한다', () => {
    expect(claimAchievement(unlocked, 'no_such_achievement').reason).toBe('unknown');
  });

  it('수령 대기 목록에서 수령한 업적은 빠진다', () => {
    expect(getClaimableAchievements(unlocked)).toContain('first_upgrade');
    const claimed = claimAchievement(unlocked, 'first_upgrade').state;
    expect(getClaimableAchievements(claimed)).not.toContain('first_upgrade');
  });
});

describe('실제 플레이 흐름에서의 해금', () => {
  it('타격과 시간 진행 중에 자동으로 해금된다', () => {
    let state: GameState = { ...base, upgrades: { apprentice: 2 } };
    state = performClick(state, 0).state;
    state = tick(state, 1, 1000);

    expect(state.achievements.first_hit?.unlocked).toBe(true);
    expect(state.achievements.first_upgrade?.unlocked).toBe(true);
    expect(getUnlockedCount(state)).toBeGreaterThanOrEqual(2);
  });
});
