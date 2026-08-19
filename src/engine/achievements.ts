/**
 * 업적 (계획서 4.2 / 17.1 "경계값 중복 지급 방지").
 *
 * 해금과 보상 수령을 분리한다. 해금은 매 tick 자동으로 판정되고,
 * 보상은 플레이어가 수령할 때 한 번만 지급된다.
 */
import { big, ZERO, type Big } from './bignum';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '../data/achievements';
import { isConditionMet } from './unlock';
import type { AchievementState, GameState } from '../types/index';

const EMPTY_STATE: AchievementState = { unlocked: false, claimed: false, unlockedAt: null };

export const getAchievementState = (state: GameState, id: string): AchievementState =>
  state.achievements[id] ?? EMPTY_STATE;

/**
 * 조건을 만족한 업적을 해금 처리한 새 상태를 돌려준다.
 * 이미 해금된 업적은 다시 건드리지 않아 `unlockedAt`이 덮어써지지 않는다.
 */
export const evaluateAchievements = (
  state: GameState,
  nowMs: number,
): { state: GameState; newlyUnlocked: string[] } => {
  const newlyUnlocked: string[] = [];
  let achievements = state.achievements;

  for (const definition of ACHIEVEMENTS) {
    const current = getAchievementState(state, definition.id);
    if (current.unlocked) continue;
    if (!isConditionMet(state, definition.condition)) continue;

    achievements = {
      ...achievements,
      [definition.id]: {
        unlocked: true,
        claimed: false,
        unlockedAt: new Date(nowMs).toISOString(),
      },
    };
    newlyUnlocked.push(definition.id);
  }

  if (newlyUnlocked.length === 0) return { state, newlyUnlocked };
  return { state: { ...state, achievements }, newlyUnlocked };
};

export interface AchievementClaimResult {
  readonly state: GameState;
  readonly claimed: boolean;
  readonly emberGained: Big;
  readonly reason: 'ok' | 'not-unlocked' | 'already-claimed' | 'unknown';
}

/** 업적 보상을 수령한다. 같은 업적은 두 번 지급되지 않는다. */
export const claimAchievement = (state: GameState, id: string): AchievementClaimResult => {
  const definition = ACHIEVEMENT_BY_ID.get(id);
  if (!definition) {
    return { state, claimed: false, emberGained: ZERO, reason: 'unknown' };
  }

  const current = getAchievementState(state, id);
  if (!current.unlocked) {
    return { state, claimed: false, emberGained: ZERO, reason: 'not-unlocked' };
  }
  if (current.claimed) {
    return { state, claimed: false, emberGained: ZERO, reason: 'already-claimed' };
  }

  const emberGained = definition.emberReward ? big(definition.emberReward) : ZERO;

  return {
    state: {
      ...state,
      ember: state.ember.add(emberGained),
      lifetimeEmber: state.lifetimeEmber.add(emberGained),
      runLifetimeEmber: state.runLifetimeEmber.add(emberGained),
      achievements: { ...state.achievements, [id]: { ...current, claimed: true } },
    },
    claimed: true,
    emberGained,
    reason: 'ok',
  };
};

/** 수령 대기 중인 업적 id 목록. 업적 화면의 배지 표시에 사용한다. */
export const getClaimableAchievements = (state: GameState): string[] =>
  ACHIEVEMENTS.filter((definition) => {
    const current = getAchievementState(state, definition.id);
    return current.unlocked && !current.claimed;
  }).map((definition) => definition.id);

export const getUnlockedCount = (state: GameState): number =>
  ACHIEVEMENTS.filter((definition) => getAchievementState(state, definition.id).unlocked).length;

export const getTotalCount = (): number => ACHIEVEMENTS.length;
