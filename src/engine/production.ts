/**
 * 생산·타격 계산과 배율 스택 (계획서 5.5 / 5.6 / 6.3).
 *
 * 이 파일의 모든 함수는 입력을 받아 결과만 돌려주는 순수 함수다.
 * React 컴포넌트 안에서 생산량을 계산하지 않기 위한 단일 진입점이다.
 */
import { big, ONE, ZERO, type Big } from './bignum';
import { BASE_CLICK_POWER } from '../data/balance';
import { UPGRADES, getUpgradeDefinition } from '../data/upgrades';
import { ACHIEVEMENT_BY_ID } from '../data/achievements';
import { PRESTIGE_SKILL_BY_ID } from '../data/prestigeSkills';
import {
  MODIFIER_CHANNELS,
  type GameState,
  type ModifierChannel,
  type ModifierContribution,
  type ModifierSet,
  type UpgradeDefinition,
} from '../types/index';

// ---------------------------------------------------------------------------
// 마일스톤 (계획서 5.6)
// ---------------------------------------------------------------------------

/** 보유 개수에 따라 달성한 마일스톤 배율을 모두 곱한다. */
export const getMilestoneMultiplier = (definition: UpgradeDefinition, owned: number): Big => {
  let multiplier = ONE;
  for (const milestone of definition.milestoneBonuses) {
    if (owned >= milestone.atCount) multiplier = multiplier.mul(milestone.multiplier);
  }
  return multiplier;
};

/** 다음 마일스톤까지 남은 수량. 남은 마일스톤이 없으면 null. (상점 UI 5.7) */
export const getNextMilestone = (
  definition: UpgradeDefinition,
  owned: number,
): { atCount: number; multiplier: number; remaining: number } | null => {
  for (const milestone of definition.milestoneBonuses) {
    if (owned < milestone.atCount) {
      return { ...milestone, remaining: milestone.atCount - owned };
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// 업그레이드 개별 기여량 (계획서 5.5)
// ---------------------------------------------------------------------------

/**
 * 업그레이드 생산량 = 기본 생산량 × 보유개수 × 마일스톤 배율.
 * `auto`는 초당 잉걸불, `click`은 타격당 추가 잉걸불을 뜻한다.
 * 배율형·편의형은 생산량이 아니라 계층 보너스를 주므로 0이다.
 */
export const getUpgradeContribution = (definition: UpgradeDefinition, owned: number): Big => {
  if (owned <= 0) return ZERO;
  if (definition.type !== 'auto' && definition.type !== 'click') return ZERO;
  return big(definition.baseOutput).mul(owned).mul(getMilestoneMultiplier(definition, owned));
};

export const getOwnedCount = (state: GameState, upgradeId: string): number =>
  state.upgrades[upgradeId] ?? 0;

// ---------------------------------------------------------------------------
// 배율 계층 (계획서 6.3)
// ---------------------------------------------------------------------------

/**
 * 상태에서 모든 퍼센트 보너스 기여를 모은다.
 * 출처는 배율형·편의형 업그레이드, 명인의 인장 영구 강화, 보상을 수령한 업적이다.
 */
export const collectContributions = (state: GameState): ModifierContribution[] => {
  const contributions: ModifierContribution[] = [];

  for (const definition of UPGRADES) {
    if (!definition.modifier) continue;
    const owned = getOwnedCount(state, definition.id);
    if (owned <= 0) continue;
    contributions.push({
      channel: definition.modifier.channel,
      amount: definition.modifier.amountPerLevel * owned,
      sourceId: `upgrade:${definition.id}`,
    });
  }

  for (const [skillId, level] of Object.entries(state.prestige.permanentSkills)) {
    const skill = PRESTIGE_SKILL_BY_ID.get(skillId);
    if (!skill || level <= 0) continue;
    contributions.push({
      channel: skill.channel,
      amount: skill.amountPerLevel * level,
      sourceId: `prestige:${skillId}`,
    });
  }

  for (const [achievementId, achievementState] of Object.entries(state.achievements)) {
    if (!achievementState.claimed) continue;
    const definition = ACHIEVEMENT_BY_ID.get(achievementId);
    if (!definition?.modifier) continue;
    contributions.push({
      channel: definition.modifier.channel,
      amount: definition.modifier.amount,
      sourceId: `achievement:${achievementId}`,
    });
  }

  return contributions;
};

/**
 * 계층별 배율 = 1 + 같은 계층 보너스 합계.
 * 같은 계층은 더하고 서로 다른 계층은 곱한다는 규칙(6.3)이 여기서만 구현된다.
 */
export const getModifiers = (state: GameState): ModifierSet => {
  const sums: Record<ModifierChannel, number> = {
    global: 0,
    auto: 0,
    click: 0,
    orderReward: 0,
    offline: 0,
    prestige: 0,
  };

  for (const contribution of collectContributions(state)) {
    sums[contribution.channel] += contribution.amount;
  }

  const result = {} as Record<ModifierChannel, Big>;
  for (const channel of MODIFIER_CHANNELS) {
    result[channel] = ONE.add(sums[channel]);
  }
  return result as ModifierSet;
};

// ---------------------------------------------------------------------------
// 최종 생산량 (계획서 5.5)
// ---------------------------------------------------------------------------

/** 배율 적용 전 초당 자동 생산량 */
export const getBaseAutoRate = (state: GameState): Big => {
  let total = ZERO;
  for (const definition of UPGRADES) {
    if (definition.type !== 'auto') continue;
    total = total.add(getUpgradeContribution(definition, getOwnedCount(state, definition.id)));
  }
  return total;
};

/** 최종 자동 생산량 = 기본 자동 생산량 × 자동 생산 배율 × 전체 생산 배율 × 환생 배율 */
export const getAutoRate = (state: GameState, modifiers = getModifiers(state)): Big =>
  getBaseAutoRate(state).mul(modifiers.auto).mul(modifiers.global).mul(modifiers.prestige);

/** 배율 적용 전 타격량 = 기본 타격량 + 업그레이드 추가 타격량 */
export const getBaseClickPower = (state: GameState): Big => {
  let total = big(BASE_CLICK_POWER);
  for (const definition of UPGRADES) {
    if (definition.type !== 'click') continue;
    total = total.add(getUpgradeContribution(definition, getOwnedCount(state, definition.id)));
  }
  return total;
};

/** 최종 타격량 = 기본 타격량 × 타격 배율 × 전체 생산 배율 × 환생 배율 */
export const getClickPower = (state: GameState, modifiers = getModifiers(state)): Big =>
  getBaseClickPower(state).mul(modifiers.click).mul(modifiers.global).mul(modifiers.prestige);

/**
 * 특정 업그레이드가 현재 초당 생산량에 실제로 기여하는 양 (상점 UI 5.7).
 * 배율까지 반영한 값이라 "현재: +125 잉걸불/초" 표기에 그대로 쓸 수 있다.
 */
export const getEffectiveContribution = (
  state: GameState,
  upgradeId: string,
  modifiers = getModifiers(state),
): Big => {
  const definition = getUpgradeDefinition(upgradeId);
  const raw = getUpgradeContribution(definition, getOwnedCount(state, upgradeId));
  if (definition.type === 'auto') {
    return raw.mul(modifiers.auto).mul(modifiers.global).mul(modifiers.prestige);
  }
  if (definition.type === 'click') {
    return raw.mul(modifiers.click).mul(modifiers.global).mul(modifiers.prestige);
  }
  return ZERO;
};
