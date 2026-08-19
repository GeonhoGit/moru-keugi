/**
 * 튜토리얼 흐름 (계획서 12.3).
 *
 * "강제 설명 팝업을 연속으로 띄우기보다 실제 UI를 강조하며 한 단계씩 진행한다."
 * 각 단계는 어떤 화면의 무엇을 강조할지와 언제 다음으로 넘어갈지만 정의한다.
 */
import type { GameState } from '../types/index';
import { getAutoRate } from '../engine/production';

/** 강조할 UI 요소. 화면이 이 값을 보고 하이라이트를 그린다. */
export type TutorialTarget = 'anvil' | 'shop-tab' | 'forge-stats' | 'orders-tab' | 'records-tab';

export interface TutorialStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly target: TutorialTarget;
  /** 이 조건을 만족하면 자동으로 다음 단계로 넘어간다. */
  readonly isComplete: (state: GameState) => boolean;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'hit_anvil',
    title: '모루를 두드리세요',
    body: '망치질 다섯 번이면 첫 잉걸불이 모입니다.',
    target: 'anvil',
    isComplete: (state) => state.clickCount >= 5,
  },
  {
    id: 'first_upgrade',
    title: '첫 업그레이드를 사세요',
    body: '상점에서 무쇠 집게를 사면 한 번의 타격이 더 값어치 있어집니다.',
    target: 'shop-tab',
    isComplete: (state) => Object.values(state.upgrades).some((count) => count > 0),
  },
  {
    id: 'auto_production',
    title: '자동 생산을 확인하세요',
    body: '견습 대장장이를 고용하면 손을 놓아도 잉걸불이 쌓입니다.',
    target: 'forge-stats',
    isComplete: (state) => getAutoRate(state).sign() > 0,
  },
  {
    id: 'start_order',
    title: '첫 주문을 시작하세요',
    body: '주문 화면에서 농부의 낫 제작을 시작해 보세요.',
    target: 'orders-tab',
    isComplete: (state) => state.orders.slots.some((slot) => slot.startedAt !== null),
  },
  {
    id: 'claim_order',
    title: '주문 보상을 받으세요',
    body: '제작이 끝나면 보상을 수령할 수 있습니다.',
    target: 'orders-tab',
    isComplete: (state) => state.orders.completedCount >= 1,
  },
  {
    id: 'records',
    title: '기록을 확인하세요',
    body: '업적은 업적 화면에, 평생 통계는 기록 화면에 모입니다. 진행은 자동으로 저장됩니다.',
    target: 'records-tab',
    isComplete: (state) => state.tutorialStep >= TUTORIAL_STEPS.length,
  },
];

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;

export const getCurrentTutorialStep = (state: GameState): TutorialStep | null =>
  state.tutorialStep < TUTORIAL_STEPS.length ? TUTORIAL_STEPS[state.tutorialStep]! : null;

export const isTutorialComplete = (state: GameState): boolean =>
  state.tutorialStep >= TUTORIAL_STEPS.length;

/**
 * 현재 단계의 조건을 만족했으면 다음 단계로 넘긴 상태를 돌려준다.
 * 마지막 단계는 플레이어가 직접 닫아야 완료되므로 자동으로 넘기지 않는다.
 */
export const advanceTutorial = (state: GameState): GameState => {
  const step = getCurrentTutorialStep(state);
  if (!step) return state;
  if (state.tutorialStep === TUTORIAL_STEPS.length - 1) return state;
  if (!step.isComplete(state)) return state;
  return { ...state, tutorialStep: state.tutorialStep + 1 };
};

/** 마지막 안내를 닫거나 튜토리얼을 건너뛴다. */
export const completeTutorial = (state: GameState): GameState => ({
  ...state,
  tutorialStep: TUTORIAL_STEPS.length,
});
