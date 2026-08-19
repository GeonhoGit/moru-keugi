/**
 * 환생과 명인의 인장 (계획서 6.4).
 *
 *   획득 인장 = floor((이번 생애 누적 잉걸불 ÷ 환생 기준값)^0.5)
 *
 * "환생마다 전체 생산 +10%" 같은 고정 배율 대신, 인장을 모아
 * 원하는 방향(타격형·방치형·주문형)으로 자유롭게 투자하게 한다.
 */
import { big, ONE, ZERO, type Big } from './bignum';
import { PRESTIGE_DIVISOR, PRESTIGE_UNLOCK_RUN_EMBER } from '../data/balance';
import { PRESTIGE_SKILLS, getPrestigeSkill } from '../data/prestigeSkills';
import { getBaseAutoRate, getModifiers } from './production';
import type { GameState, PrestigePreview } from '../types/index';

/** 환생 메뉴 자체가 보이기 시작하는 시점 (계획서 6.2 "환생 메뉴 해금: 첫날 후반") */
export const isPrestigeUnlocked = (state: GameState): boolean =>
  state.prestige.count > 0 || state.runLifetimeEmber.gte(big(PRESTIGE_UNLOCK_RUN_EMBER));

/**
 * 지금 환생하면 얻는 인장 개수.
 *
 * `pow(0.5)`는 부동소수 오차 때문에 정확한 제곱수에서 1.9999...를 돌려줄 수 있다.
 * 그러면 누적 1억(정확히 인장 2개)에서 1개만 주는 경계 버그가 생기므로,
 * 로그로 근사값을 구한 뒤 제곱 비교로 ±1만 정수 보정한다.
 */
export const getSealsForRun = (runLifetimeEmber: Big): number => {
  if (runLifetimeEmber.sign() <= 0) return 0;

  const divisor = big(PRESTIGE_DIVISOR);
  if (runLifetimeEmber.lt(divisor)) return 0;

  const approximate = runLifetimeEmber.div(divisor).pow(0.5).floor().toNumber();
  if (!Number.isFinite(approximate)) return Number.MAX_SAFE_INTEGER;

  let seals = Math.max(0, Math.floor(approximate));

  // `seals + 1`이 부동소수상 같은 값이 되는 크기에서는 ±1 보정 자체가 의미가 없고
  // 루프가 끝나지 않는다. 정수를 정확히 셀 수 있는 범위에서만 보정한다.
  if (seals >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;

  // 보정은 나눗셈 없이 `인장² × 기준값 ≤ 누적`으로 비교한다.
  // 나눗셈을 거치면 정확한 경계(예: 기준값의 정확히 4배)에서 몫이 3.999...가 되어
  // 인장 하나를 손해 보는 일이 생긴다.
  //
  // 곱셈만 써도 큰 수 라이브러리의 가수(mantissa)가 부동소수라 곱하는 순서에 따라
  // 마지막 자리가 흔들린다(1.6 × 6 ≠ 6 × 1.6). 플레이어가 정확히 경계에 도달했을 때
  // 인장을 손해 보지 않도록 상대 오차 1e-12 안쪽은 같은 값으로 본다.
  const withinBudget = (candidate: number): boolean => {
    const required = big(candidate).mul(candidate).mul(divisor);
    if (required.lte(runLifetimeEmber)) return true;
    if (required.sign() <= 0) return false;
    return required.sub(runLifetimeEmber).div(required).lte(1e-12);
  };

  while (seals > 0 && !withinBudget(seals)) seals -= 1;
  while (seals < Number.MAX_SAFE_INTEGER && withinBudget(seals + 1)) seals += 1;

  return seals;
};

/** 인장 n개를 더 얻기 위해 필요한 이번 생애 누적 잉걸불 */
export const getEmberRequiredForSeals = (seals: number): Big =>
  big(PRESTIGE_DIVISOR).mul(seals * seals);

const RESET_ITEMS = [
  '현재 잉걸불',
  '잉걸불로 구매한 일반 업그레이드',
  '진행 중인 일반 주문',
  '현재 세션용 임시 버프',
] as const;

const KEEP_ITEMS = [
  '평생 누적 잉걸불',
  '업적과 도감 기록',
  '명인의 인장과 영구 능력',
  '해금한 외형 요소',
  '설정과 접근성 옵션',
] as const;

/**
 * 환생 후 예상 자동 생산량.
 *
 * 환생 직후에는 업그레이드가 초기화되어 실제 생산량이 0이 되므로,
 * "지금과 같은 업그레이드 구성을 되찾았을 때" 를 기준으로 보여준다.
 * 얻은 인장을 모두 `자동 풀무`에 투자한 경우를 가정한 값이다.
 */
export const getProjectedAutoRate = (state: GameState, sealsGained: number): Big => {
  const bellows = getPrestigeSkill('auto_bellows');
  const currentLevel = state.prestige.permanentSkills[bellows.id] ?? 0;

  let budget = state.prestige.masterSeals + sealsGained;
  let level = currentLevel;
  while (level < bellows.maxLevel && budget >= bellows.costForLevel(level + 1)) {
    budget -= bellows.costForLevel(level + 1);
    level += 1;
  }

  const projectedState: GameState = {
    ...state,
    prestige: {
      ...state.prestige,
      permanentSkills: { ...state.prestige.permanentSkills, [bellows.id]: level },
    },
  };

  const modifiers = getModifiers(projectedState);
  return getBaseAutoRate(state).mul(modifiers.auto).mul(modifiers.global).mul(modifiers.prestige);
};

export const getPrestigePreview = (state: GameState): PrestigePreview => {
  const sealsGained = getSealsForRun(state.runLifetimeEmber);
  return {
    sealsGained,
    // 예상 인장이 0개일 때는 환생할 수 없다 (계획서 6.4).
    canPrestige: sealsGained >= 1,
    resets: [...RESET_ITEMS],
    keeps: [...KEEP_ITEMS],
    projectedAutoRate: getProjectedAutoRate(state, sealsGained),
  };
};

export interface PrestigeResult {
  readonly state: GameState;
  readonly performed: boolean;
  readonly sealsGained: number;
  readonly reason: 'ok' | 'not-enough-progress';
}

/**
 * 환생을 실행한다.
 * 초기화 대상은 현재 잉걸불·일반 업그레이드·진행 중 주문이고,
 * 평생 누적 잉걸불·업적·인장·외형·설정은 유지한다.
 */
export const performPrestige = (state: GameState, nowMs: number): PrestigeResult => {
  const sealsGained = getSealsForRun(state.runLifetimeEmber);
  if (sealsGained < 1) {
    return { state, performed: false, sealsGained: 0, reason: 'not-enough-progress' };
  }

  return {
    state: {
      ...state,
      ember: ZERO,
      runLifetimeEmber: ZERO,
      // lifetimeEmber / clickCount / achievements / unlocks / settings 는 유지한다.
      upgrades: {},
      prestige: {
        count: state.prestige.count + 1,
        masterSeals: state.prestige.masterSeals + sealsGained,
        permanentSkills: { ...state.prestige.permanentSkills },
      },
      orders: {
        slots: [],
        completedOrderIds: [],
        completedCount: state.orders.completedCount,
      },
      offline: { ...state.offline, lastCalculatedAt: nowMs },
      lastActiveAt: nowMs,
    },
    performed: true,
    sealsGained,
    reason: 'ok',
  };
};

// ---------------------------------------------------------------------------
// 영구 강화 구매
// ---------------------------------------------------------------------------

export const getSkillLevel = (state: GameState, skillId: string): number =>
  state.prestige.permanentSkills[skillId] ?? 0;

/** 다음 단계를 살 때 필요한 인장. 최대 단계면 null. */
export const getSkillUpgradeCost = (state: GameState, skillId: string): number | null => {
  const skill = getPrestigeSkill(skillId);
  const level = getSkillLevel(state, skillId);
  if (level >= skill.maxLevel) return null;
  return skill.costForLevel(level + 1);
};

export interface SkillPurchaseResult {
  readonly state: GameState;
  readonly purchased: boolean;
  readonly spent: number;
  readonly reason: 'ok' | 'max-level' | 'not-enough-seals';
}

export const purchasePrestigeSkill = (state: GameState, skillId: string): SkillPurchaseResult => {
  const cost = getSkillUpgradeCost(state, skillId);
  if (cost === null) return { state, purchased: false, spent: 0, reason: 'max-level' };
  if (state.prestige.masterSeals < cost) {
    return { state, purchased: false, spent: 0, reason: 'not-enough-seals' };
  }

  const level = getSkillLevel(state, skillId);
  return {
    state: {
      ...state,
      prestige: {
        ...state.prestige,
        masterSeals: state.prestige.masterSeals - cost,
        permanentSkills: { ...state.prestige.permanentSkills, [skillId]: level + 1 },
      },
    },
    purchased: true,
    spent: cost,
    reason: 'ok',
  };
};

/** 환생 화면에 그릴 강화 목록 */
export const getPrestigeSkillViews = (state: GameState) =>
  PRESTIGE_SKILLS.map((skill) => {
    const level = getSkillLevel(state, skill.id);
    const cost = getSkillUpgradeCost(state, skill.id);
    return {
      skill,
      level,
      cost,
      atMaxLevel: cost === null,
      affordable: cost !== null && state.prestige.masterSeals >= cost,
      currentBonus: ONE.add(skill.amountPerLevel * level),
    };
  });
