/** 계획서 17.1 - 오프라인(시간 차이·상한·효율·중복 지급 방지) 자동 테스트 */
import { describe, expect, it } from 'vitest';
import {
  calculateOfflineReward,
  claimOfflineReward,
  getOfflineEfficiency,
  markOfflineCheckpoint,
  shouldShowOfflineScreen,
} from '../offline';
import { createInitialState } from '../state';
import { OFFLINE_ANOMALY_LIMIT, OFFLINE_MAX_SECONDS } from '../../data/balance';
import type { GameState } from '../../types/index';

const HOUR = 3_600_000;

/** 초당 자동 생산 10인 상태 (견습 대장장이 20명 = 0.5 × 20 × 2(마일스톤)) */
const makeState = (overrides: Partial<GameState> = {}): GameState => {
  const base = createInitialState(0);
  return { ...base, upgrades: { apprentice: 10 }, ...overrides };
};

describe('오프라인 보상 계산 (계획서 7)', () => {
  it('마지막 저장 시각과 복귀 시각의 차이로 계산한다', () => {
    const state = makeState(); // 0.5 × 10 × 2 = 10/초
    const report = calculateOfflineReward(state, HOUR);

    expect(report.creditedSeconds).toBe(3600);
    expect(report.anomaly).toBe('none');
    expect(report.efficiency).toBeCloseTo(0.7, 10);
    // 10 × 3600 × 0.7 = 25,200
    expect(report.baseReward.toString()).toBe('36000');
    expect(report.finalReward.toString()).toBe('25200');
  });

  it('최대 오프라인 시간을 넘으면 8시간으로 제한한다', () => {
    const report = calculateOfflineReward(makeState(), 24 * HOUR);

    expect(report.rawElapsedSeconds).toBe(24 * 3600);
    expect(report.creditedSeconds).toBe(OFFLINE_MAX_SECONDS);
    expect(report.anomaly).toBe('capped');
    // 10 × 28800 × 0.7 = 201,600
    expect(report.finalReward.toString()).toBe('201600');
  });

  it('오프라인 효율 배율이 보상에 반영된다', () => {
    const state = makeState({
      upgrades: { apprentice: 10, banked_embers: 2 }, // 오프라인 +10%
    });
    expect(getOfflineEfficiency(state)).toBeCloseTo(0.77, 10);
    // 10 × 3600 × 0.77 = 27,720
    expect(calculateOfflineReward(state, HOUR).finalReward.toString()).toBe('27720');
  });

  it('자동 생산이 없으면 보상도 없다', () => {
    const state = createInitialState(0);
    expect(calculateOfflineReward(state, HOUR).finalReward.toString()).toBe('0');
  });
});

describe('기기 시간 변경 정책 (계획서 7)', () => {
  it('현재 시각이 마지막 저장보다 이전이면 보상은 0이다', () => {
    const state = makeState({
      offline: { lastCalculatedAt: HOUR, lastClaimId: null, timeAnomalyCount: 0 },
    });
    const report = calculateOfflineReward(state, 0);

    expect(report.anomaly).toBe('time-reversed');
    expect(report.finalReward.toString()).toBe('0');
    expect(report.creditedSeconds).toBe(0);
  });

  it('시간 역행을 수령 시점에 기록한다', () => {
    const state = makeState({
      offline: { lastCalculatedAt: HOUR, lastClaimId: null, timeAnomalyCount: 0 },
    });
    const report = calculateOfflineReward(state, 0);
    const claimed = claimOfflineReward(state, report, 0);

    expect(claimed.state.offline.timeAnomalyCount).toBe(1);
    expect(claimed.granted.toString()).toBe('0');
  });

  it('시간 변경이 반복되면 보상을 제한한다', () => {
    const state = makeState({
      offline: { lastCalculatedAt: 0, lastClaimId: null, timeAnomalyCount: OFFLINE_ANOMALY_LIMIT },
    });
    const report = calculateOfflineReward(state, HOUR);

    expect(report.anomaly).toBe('repeated-time-change');
    // 0.7 × 0.1 = 0.07 → 10 × 3600 × 0.07 = 2,520
    expect(report.finalReward.toString()).toBe('2520');
  });
});

describe('중복 지급 방지 (계획서 7 / 17.4 출시 차단 조건)', () => {
  it('보상을 지급하면 세 누적값이 함께 올라간다', () => {
    const state = makeState();
    const report = calculateOfflineReward(state, HOUR);
    const result = claimOfflineReward(state, report, HOUR);

    expect(result.alreadyClaimed).toBe(false);
    expect(result.state.ember.toString()).toBe('25200');
    expect(result.state.lifetimeEmber.toString()).toBe('25200');
    expect(result.state.runLifetimeEmber.toString()).toBe('25200');
  });

  it('같은 보고서로 두 번 수령하면 두 번째는 지급되지 않는다', () => {
    const state = makeState();
    const report = calculateOfflineReward(state, HOUR);

    const first = claimOfflineReward(state, report, HOUR);
    const second = claimOfflineReward(first.state, report, HOUR);

    expect(second.alreadyClaimed).toBe(true);
    expect(second.granted.toString()).toBe('0');
    expect(second.state.ember.toString()).toBe(first.state.ember.toString());
  });

  it('수령 후에는 기준 시각이 앞으로 당겨져 재계산해도 0이다', () => {
    const state = makeState();
    const first = claimOfflineReward(state, calculateOfflineReward(state, HOUR), HOUR);
    const again = calculateOfflineReward(first.state, HOUR);

    expect(again.creditedSeconds).toBe(0);
    expect(again.finalReward.toString()).toBe('0');
  });

  it('체크포인트를 찍으면 그 시점부터 다시 쌓인다', () => {
    const state = markOfflineCheckpoint(makeState(), HOUR);
    const report = calculateOfflineReward(state, 2 * HOUR);
    expect(report.creditedSeconds).toBe(3600);
  });
});

describe('복귀 화면 노출 조건', () => {
  it('1분 미만이거나 보상이 0이면 화면을 띄우지 않는다', () => {
    expect(shouldShowOfflineScreen(calculateOfflineReward(makeState(), 30_000))).toBe(false);
    expect(shouldShowOfflineScreen(calculateOfflineReward(createInitialState(0), HOUR))).toBe(false);
  });

  it('의미 있는 보상이 있으면 띄운다', () => {
    expect(shouldShowOfflineScreen(calculateOfflineReward(makeState(), HOUR))).toBe(true);
  });
});
