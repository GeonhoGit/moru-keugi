/**
 * 밸런스 시뮬레이션 (계획서 6.2 진행 페이싱 목표 검증).
 *
 * 스프레드시트 대신 실제 엔진을 그대로 돌려 마일스톤 도달 시각을 측정한다.
 * 밸런스 수치를 바꾼 뒤 `npm run simulate`로 목표 범위 안에 있는지 확인한다.
 *
 * 플레이어 모델
 * - 하루 4회, 회당 15분 직접 플레이(초당 4회 타격). 나머지 시간은 방치.
 * - 매초 회수 기간(payback)이 가장 짧은 업그레이드를 산다.
 * - 주문은 비용의 2배 이상을 들고 있을 때 시작하고, 끝나면 바로 수령한다.
 * - 업적 보상은 해금되는 대로 수령한다.
 */
import { big, formatDuration, formatShort, type Big } from '../src/engine/bignum';
import { createInitialState, tick, performClick } from '../src/engine/state';
import { getAutoRate, getClickPower, getOwnedCount } from '../src/engine/production';
import { getNextCost, purchaseUpgrade } from '../src/engine/upgrades';
import { claimOrder, getOrderStatus, previewOrderRewards, startOrder } from '../src/engine/orders';
import { claimAchievement, getClaimableAchievements } from '../src/engine/achievements';
import { getForgeTier } from '../src/engine/forge';
import { getPrestigePreview, isPrestigeUnlocked } from '../src/engine/prestige';
import { isConditionMet } from '../src/engine/unlock';
import { UPGRADES } from '../src/data/upgrades';
import { getOrderDefinition } from '../src/data/orders';
import type { GameState } from '../src/types/index';

const CLICKS_PER_SECOND = 3; // 15분 내내 유지 가능한 현실적인 연타 속도
const SESSION_MINUTES = 15;
const MAX_DAYS = 3;

/**
 * 설치 직후를 t=0으로 두고, 하루 안에서 이 시각(초)부터 15분씩 직접 플레이한다.
 * 첫 세션이 반드시 0초에 시작해야 마일스톤 시각이 "설치 후 경과 시간"과 같아진다.
 */
const SESSION_STARTS = [0, 5 * 3600, 11 * 3600, 15 * 3600];

/** 진행 곡선을 확인할 표본 시각 */
const SAMPLE_POINTS = [
  60, 300, 900, 3600, 6 * 3600, 12 * 3600, 24 * 3600, 36 * 3600, 48 * 3600, 72 * 3600,
];

const isActive = (secondsElapsed: number): boolean => {
  const timeOfDay = secondsElapsed % 86_400;
  return SESSION_STARTS.some(
    (start) => timeOfDay >= start && timeOfDay < start + SESSION_MINUTES * 60,
  );
};

interface Milestone {
  readonly label: string;
  readonly target: string;
  readonly reached: (state: GameState, seconds: number) => boolean;
}

const MILESTONES: Milestone[] = [
  {
    label: '첫 업그레이드 구매',
    target: '약 10초',
    reached: (state) => Object.values(state.upgrades).some((count) => count > 0),
  },
  {
    label: '첫 자동 생산 획득',
    target: '약 30초',
    reached: (state) => getAutoRate(state).sign() > 0,
  },
  {
    label: '첫 주문 완료',
    target: '약 2~4분',
    reached: (state) => state.orders.completedCount >= 1,
  },
  {
    label: '첫 화로 티어 변화',
    target: '약 5분',
    reached: (state) => getForgeTier(state.lifetimeEmber).tier >= 1,
  },
  {
    label: '초·중급 업그레이드 모두 보유',
    target: '첫 세션 15~20분 내',
    reached: (state) =>
      ['apprentice', 'iron_tongs', 'bellows', 'coal_forge'].every(
        (id) => getOwnedCount(state, id) > 0,
      ),
  },
  {
    label: '환생 메뉴 해금',
    target: '첫날 후반',
    reached: (state) => isPrestigeUnlocked(state),
  },
  {
    label: '첫 환생 가능',
    target: '1~2일차',
    reached: (state) => getPrestigePreview(state).canPrestige,
  },
];

/**
 * 하루 중 직접 플레이하는 시간 비율.
 * 타격 업그레이드는 이 비율만큼만 값어치가 있으므로 자동 생산과 같은 잣대로 비교하려면
 * 가중치를 곱해야 한다. 이걸 빼면 시뮬레이터가 방치 플레이를 전혀 고려하지 않고
 * 타격 업그레이드만 사들여 실제 플레이어와 다르게 움직인다.
 */
const ACTIVE_FRACTION = (SESSION_STARTS.length * SESSION_MINUTES * 60) / 86_400;

/**
 * 튜토리얼(계획서 12.3)이 안내하는 첫 구매 순서.
 * 실제 플레이어는 회수 기간을 계산하지 않고 튜토리얼을 따라가므로 그대로 모델링한다.
 */
const TUTORIAL_PURCHASES = ['iron_tongs', 'apprentice'];

/** 회수 기간(초)이 가장 짧은 업그레이드를 고른다. 살 수 있는 게 없으면 null. */
const pickBestPurchase = (state: GameState, clickRate: number): string | null => {
  // 튜토리얼 단계에서는 안내받은 순서대로 산다.
  for (const id of TUTORIAL_PURCHASES) {
    if (getOwnedCount(state, id) > 0) continue;
    const definition = UPGRADES.find((candidate) => candidate.id === id);
    if (!definition) continue;
    return state.ember.gte(getNextCost(definition, 0)) ? id : null;
  }

  const currentValue = getAutoRate(state).add(getClickValue(state, clickRate));

  let bestId: string | null = null;
  let bestPayback = Number.POSITIVE_INFINITY;

  for (const definition of UPGRADES) {
    if (!isConditionMet(state, definition.unlockCondition)) continue;
    const owned = getOwnedCount(state, definition.id);
    if (definition.maxLevel !== undefined && owned >= definition.maxLevel) continue;

    const cost = getNextCost(definition, owned);
    if (state.ember.lt(cost)) continue;

    const candidate: GameState = {
      ...state,
      upgrades: { ...state.upgrades, [definition.id]: owned + 1 },
    };
    const gain = getAutoRate(candidate).add(getClickValue(candidate, clickRate)).sub(currentValue);
    if (gain.sign() <= 0) continue;

    const payback = cost.div(gain).toNumber();
    if (Number.isFinite(payback) && payback < bestPayback) {
      bestPayback = payback;
      bestId = definition.id;
    }
  }

  return bestId;
};

/**
 * 타격을 초당 생산량으로 환산한 값.
 * 하루 전체로 보면 타격은 직접 플레이하는 시간에만 발생하므로 그 비율을 곱한다.
 */
const getClickValue = (state: GameState, clickRate: number): Big =>
  clickRate <= 0 ? big(0) : getClickPower(state).mul(clickRate).mul(ACTIVE_FRACTION);

interface Sample {
  readonly seconds: number;
  readonly runLifetimeEmber: Big;
  readonly autoRate: Big;
  readonly seals: number;
}

const run = (): void => {
  let state = createInitialState(0);
  const results = new Map<string, number>();
  const samples: Sample[] = [];
  /** 한 번이라도 완료한 주문. 손해 보는 주문을 반복하지 않기 위해 기억한다. */
  const everCompleted = new Set<string>();

  for (let second = 1; second <= MAX_DAYS * 86_400; second += 1) {
    const nowMs = second * 1000;
    const active = isActive(second);
    const clickRate = active ? CLICKS_PER_SECOND : 0;

    state = tick(state, 1, nowMs);
    if (active) {
      for (let i = 0; i < CLICKS_PER_SECOND; i += 1) state = performClick(state, nowMs).state;
    }

    for (const id of getClaimableAchievements(state)) {
      state = claimAchievement(state, id).state;
    }

    // 주문 수령 → 시작
    for (const slot of [...state.orders.slots]) {
      if (getOrderStatus(state, slot.orderId, nowMs) === 'ready') {
        const result = claimOrder(state, slot.orderId, nowMs);
        if (result.claimed) everCompleted.add(slot.orderId);
        state = result.state;
      }
    }
    for (const slot of [...state.orders.slots]) {
      if (getOrderStatus(state, slot.orderId, nowMs) !== 'available') continue;
      // 처음 보는 주문은 도감·장식 때문에 무조건 하고,
      // 이미 완료한 주문은 잉걸불이 남는 경우에만 반복한다.
      if (everCompleted.has(slot.orderId)) {
        const definition = state.orders.slots.find((s) => s.orderId === slot.orderId);
        if (!definition) continue;
        const reward = previewOrderRewards(state, slot.orderId).ember;
        if (reward.lt(getOrderDefinition(slot.orderId).cost)) continue;
      }
      const result = startOrder(state, slot.orderId, nowMs);
      if (result.started) state = result.state;
    }

    // 구매 판단은 초반 2분만 매초 하고, 그 뒤에는 10초마다 한다(시뮬레이션 속도).
    if (second <= 120 || second % 10 === 0) {
      for (let guard = 0; guard < 200; guard += 1) {
        const id = pickBestPurchase(state, CLICKS_PER_SECOND);
        if (!id) break;
        const result = purchaseUpgrade(state, id, 1);
        if (!result.purchased) break;
        state = result.state;
      }
    }

    for (const milestone of MILESTONES) {
      if (!results.has(milestone.label) && milestone.reached(state, second)) {
        results.set(milestone.label, second);
      }
    }

    if (SAMPLE_POINTS.includes(second)) {
      samples.push({
        seconds: second,
        runLifetimeEmber: state.runLifetimeEmber,
        autoRate: getAutoRate(state),
        seals: getPrestigePreview(state).sealsGained,
      });
    }
  }

  print(state, results, samples);
};

const print = (state: GameState, results: Map<string, number>, samples: Sample[]): void => {
  const rows = MILESTONES.map((milestone) => {
    const seconds = results.get(milestone.label);
    return {
      마일스톤: milestone.label,
      '계획서 목표': milestone.target,
      '시뮬레이션 결과': seconds === undefined ? '미도달' : formatDuration(seconds),
    };
  });

  console.log('\n=== 진행 페이싱 (계획서 6.2) ===');
  console.table(rows);

  console.log('\n=== 최종 상태 ===');
  console.table([
    { 항목: '잉걸불', 값: formatShort(state.ember) },
    { 항목: '평생 누적 잉걸불', 값: formatShort(state.lifetimeEmber) },
    { 항목: '이번 생애 누적', 값: formatShort(state.runLifetimeEmber) },
    { 항목: '초당 자동 생산', 값: formatShort(getAutoRate(state)) },
    { 항목: '타격 수', 값: state.clickCount.toLocaleString() },
    { 항목: '화로 티어', 값: `${getForgeTier(state.lifetimeEmber).tier} (${getForgeTier(state.lifetimeEmber).name})` },
    { 항목: '주문 완료', 값: String(state.orders.completedCount) },
    { 항목: '예상 인장', 값: String(getPrestigePreview(state).sealsGained) },
  ]);

  console.log('\n=== 진행 곡선 (환생 기준값 결정용) ===');
  console.table(
    samples.map((sample) => ({
      경과: formatDuration(sample.seconds),
      '이번 생애 누적': formatShort(sample.runLifetimeEmber),
      '초당 자동 생산': formatShort(sample.autoRate),
      '예상 인장': sample.seals,
    })),
  );

  console.log('\n=== 업그레이드 보유 ===');
  console.table(
    UPGRADES.filter((definition) => getOwnedCount(state, definition.id) > 0).map((definition) => ({
      업그레이드: definition.name,
      보유: getOwnedCount(state, definition.id),
    })),
  );
};

run();
