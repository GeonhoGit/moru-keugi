/**
 * 게임 상태 생성과 시간 진행.
 *
 * 여기서 만드는 상태는 순수 데이터다. 화면·저장소·사운드는 이 상태를 읽기만 하고,
 * 상태 변경은 반드시 엔진 함수를 통해 이루어진다 (계획서 3.4).
 */
import { big, ZERO, type Big } from './bignum';
import { getAutoRate, getClickPower, getModifiers } from './production';
import { evaluateAchievements } from './achievements';
import { refreshOrderSlots } from './orders';
import { getForgeProgress } from './forge';
import type { GameSettings, GameState } from '../types/index';

export const DEFAULT_SETTINGS: GameSettings = {
  numberFormat: 'short',
  sfxVolume: 0.8,
  bgmVolume: 0.5,
  hapticsEnabled: true,
  reduceMotion: false,
  locale: 'ko-KR',
};

export const createInitialState = (nowMs: number = Date.now()): GameState =>
  refreshOrderSlots({
    ember: ZERO,
    lifetimeEmber: ZERO,
    runLifetimeEmber: ZERO,
    clickCount: 0,
    upgrades: {},
    prestige: { count: 0, masterSeals: 0, permanentSkills: {} },
    orders: { slots: [], completedOrderIds: [], completedCount: 0 },
    achievements: {},
    unlocks: [],
    tutorialStep: 0,
    settings: DEFAULT_SETTINGS,
    offline: { lastCalculatedAt: nowMs, lastClaimId: null, timeAnomalyCount: 0 },
    createdAt: nowMs,
    lastActiveAt: nowMs,
  });

/** 잉걸불 획득을 한 곳에서 처리해 세 누적값이 어긋나지 않게 한다. */
export const earnEmber = (state: GameState, amount: Big): GameState => {
  if (amount.sign() <= 0) return state;
  return {
    ...state,
    ember: state.ember.add(amount),
    lifetimeEmber: state.lifetimeEmber.add(amount),
    runLifetimeEmber: state.runLifetimeEmber.add(amount),
  };
};

export interface ClickResult {
  readonly state: GameState;
  readonly gained: Big;
}

/** 모루를 한 번 타격한다. */
export const performClick = (state: GameState, nowMs: number = Date.now()): ClickResult => {
  const gained = getClickPower(state);
  const earned = earnEmber({ ...state, clickCount: state.clickCount + 1 }, gained);
  return {
    state: { ...earned, lastActiveAt: nowMs },
    gained,
  };
};

/**
 * 경과 시간만큼 자동 생산을 진행한다.
 * 화면 프레임과 무관하게 초 단위 델타만 받으므로, 렌더링 빈도를 바꿔도 결과가 같다.
 */
export const tick = (state: GameState, deltaSeconds: number, nowMs = Date.now()): GameState => {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return state;
  const produced = getAutoRate(state).mul(deltaSeconds);
  const earned = earnEmber(state, produced);
  const evaluated = evaluateAchievements(earned, nowMs);
  return { ...evaluated.state, lastActiveAt: nowMs };
};

/** 대장간 화면(12.1)에 필요한 값을 한 번에 계산한다. */
export const getForgeView = (state: GameState) => {
  const modifiers = getModifiers(state);
  return {
    ember: state.ember,
    autoRate: getAutoRate(state, modifiers),
    clickPower: getClickPower(state, modifiers),
    forge: getForgeProgress(state.lifetimeEmber),
    modifiers,
  };
};

/** 테스트와 시뮬레이션에서 상태를 만들 때 쓰는 도우미. */
export const withEmber = (state: GameState, amount: string | number): GameState => ({
  ...state,
  ember: big(amount),
});
