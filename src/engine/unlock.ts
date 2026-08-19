/**
 * 해금 조건 판정 (계획서 5.3 / 4.3 / 4.2).
 * 해금 조건을 코드 여기저기에 흩어놓지 않기 위해 한 함수로 모은다.
 */
import { big, ONE, type Big } from './bignum';
import { getAutoRate, getOwnedCount } from './production';
import type { GameState, UnlockCondition } from '../types/index';

export const isConditionMet = (state: GameState, condition: UnlockCondition): boolean => {
  switch (condition.kind) {
    case 'always':
      return true;

    case 'upgradesOwned':
      return condition.requirements.every(
        (requirement) => getOwnedCount(state, requirement.upgradeId) >= requirement.count,
      );

    case 'prestigeCount':
      return state.prestige.count >= condition.count;

    case 'lifetimeEmber':
      return state.lifetimeEmber.gte(big(condition.amount));

    case 'autoRate':
      return getAutoRate(state).gte(big(condition.amount));

    case 'clickCount':
      return state.clickCount >= condition.count;

    case 'ordersCompleted':
      return state.orders.completedCount >= condition.count;

    case 'all':
      return condition.conditions.every((inner) => isConditionMet(state, inner));
  }
};

/** 조건을 사람이 읽는 문장으로 바꾼다. 잠긴 항목의 안내 문구에 사용한다. */
export const describeCondition = (condition: UnlockCondition): string => {
  switch (condition.kind) {
    case 'always':
      return '시작부터';
    case 'upgradesOwned':
      return condition.requirements
        .map((requirement) => `${requirement.upgradeId} ${requirement.count}개 이상`)
        .join(', ');
    case 'prestigeCount':
      return `환생 ${condition.count}회 이상`;
    case 'lifetimeEmber':
      return `평생 누적 잉걸불 ${condition.amount} 이상`;
    case 'autoRate':
      return `자동 생산 ${condition.amount}/초 이상`;
    case 'clickCount':
      return `타격 ${condition.count}회 이상`;
    case 'ordersCompleted':
      return `주문 ${condition.count}개 완료`;
    case 'all':
      return condition.conditions.map(describeCondition).join(' 그리고 ');
  }
};


// ---------------------------------------------------------------------------
// 진행률 (업적 화면의 목록에 쓴다)
// ---------------------------------------------------------------------------

export interface ConditionProgress {
  readonly current: Big;
  readonly target: Big;
  /** 0~1. 이미 만족했으면 1 */
  readonly ratio: number;
}

const ratioOf = (current: Big, target: Big): number => {
  if (target.sign() <= 0) return 1;
  const value = current.div(target).toNumber();
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
};

const progress = (current: Big, target: Big): ConditionProgress => ({
  current,
  target,
  ratio: ratioOf(current, target),
});

/**
 * 조건까지 얼마나 왔는지 계산한다.
 *
 * "10,000번 두드린다"만 보여 주고 지금 몇 번인지 감추면 목표가 얼마나 가까운지
 * 알 수 없다. 여러 조건이 겹칠 때는 **가장 뒤처진 조건**을 돌려준다.
 * 그것이 실제로 남은 일이기 때문이다.
 */
export const getConditionProgress = (
  state: GameState,
  condition: UnlockCondition,
): ConditionProgress => {
  switch (condition.kind) {
    case 'always':
      return progress(ONE, ONE);

    case 'clickCount':
      return progress(big(state.clickCount), big(condition.count));

    case 'lifetimeEmber':
      return progress(state.lifetimeEmber, big(condition.amount));

    case 'autoRate':
      return progress(getAutoRate(state), big(condition.amount));

    case 'ordersCompleted':
      return progress(big(state.orders.completedCount), big(condition.count));

    case 'prestigeCount':
      return progress(big(state.prestige.count), big(condition.count));

    case 'upgradesOwned': {
      const parts = condition.requirements.map((requirement) =>
        progress(big(getOwnedCount(state, requirement.upgradeId)), big(requirement.count)),
      );
      return slowest(parts);
    }

    case 'all':
      return slowest(condition.conditions.map((inner) => getConditionProgress(state, inner)));
  }
};

/** 여러 조건 중 가장 덜 진행된 것 */
const slowest = (parts: readonly ConditionProgress[]): ConditionProgress => {
  if (parts.length === 0) return progress(ONE, ONE);
  return parts.reduce((worst, part) => (part.ratio < worst.ratio ? part : worst));
};
