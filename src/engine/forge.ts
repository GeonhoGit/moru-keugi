/**
 * 화로 티어 (계획서 6.1).
 * 환생 후에도 유지되는 평생 누적 잉걸불로 판정한다.
 */
import { big, type Big } from './bignum';
import { FORGE_TIERS } from '../data/forgeTiers';
import type { ForgeTierDefinition } from '../types/index';

export const getForgeTier = (lifetimeEmber: Big): ForgeTierDefinition => {
  let current = FORGE_TIERS[0]!;
  for (const tier of FORGE_TIERS) {
    if (lifetimeEmber.gte(big(tier.threshold))) current = tier;
  }
  return current;
};

export interface ForgeProgress {
  readonly current: ForgeTierDefinition;
  readonly next: ForgeTierDefinition | null;
  /** 다음 티어까지의 진행률 0~1. 최고 티어면 1. */
  readonly ratio: number;
  readonly remaining: Big;
}

export const getForgeProgress = (lifetimeEmber: Big): ForgeProgress => {
  const current = getForgeTier(lifetimeEmber);
  const next = FORGE_TIERS.find((tier) => tier.tier === current.tier + 1) ?? null;

  if (!next) {
    return { current, next: null, ratio: 1, remaining: big(0) };
  }

  const from = big(current.threshold);
  const to = big(next.threshold);
  const span = to.sub(from);
  const gained = lifetimeEmber.sub(from);
  const ratio = span.sign() > 0 ? Math.min(1, Math.max(0, gained.div(span).toNumber())) : 1;

  return { current, next, ratio, remaining: to.sub(lifetimeEmber) };
};
