/**
 * 오프라인 보상 (계획서 7).
 *
 *   오프라인 시간 = min(현재 시각 - 마지막 정상 저장 시각, 최대 오프라인 시간)
 *   오프라인 보상 = 저장 시점의 초당 자동 생산량 × 오프라인 시간 × 오프라인 효율
 *
 * 백그라운드 타이머를 돌리지 않고 시각 차이로만 계산한다.
 * 중복 지급은 `claimId`로 막는다.
 */
import { ZERO, type Big } from './bignum';
import {
  OFFLINE_ANOMALY_LIMIT,
  OFFLINE_ANOMALY_PENALTY,
  OFFLINE_BASE_EFFICIENCY,
  OFFLINE_MAX_SECONDS,
} from '../data/balance';
import { getAutoRate, getModifiers } from './production';
import type { GameState, OfflineAnomaly, OfflineReport } from '../types/index';

/** 현재 상태의 오프라인 효율. 기본 70%에 오프라인 효율 배율(6.3)을 곱한다. */
export const getOfflineEfficiency = (state: GameState): number => {
  const modifiers = getModifiers(state);
  return OFFLINE_BASE_EFFICIENCY * modifiers.offline.toNumber();
};

const buildClaimId = (lastCalculatedAt: number): string => `offline-${lastCalculatedAt}`;

/**
 * 복귀 시점의 오프라인 보상을 계산한다. 상태는 바꾸지 않는다.
 * 복귀 화면(계획서 7)에서 경과 시간·기본 보상·적용 배율을 구분해 보여줄 수 있도록
 * 보정 전 경과 시간과 보정 후 시간을 모두 돌려준다.
 */
export const calculateOfflineReward = (state: GameState, nowMs: number): OfflineReport => {
  const lastAt = state.offline.lastCalculatedAt;
  const rawElapsedSeconds = (nowMs - lastAt) / 1000;
  const claimId = buildClaimId(lastAt);
  const autoRate = getAutoRate(state);

  // 기기 시간이 뒤로 간 경우: 보상 0, 이상 상태로 기록한다.
  if (rawElapsedSeconds < 0) {
    return {
      creditedSeconds: 0,
      rawElapsedSeconds,
      baseReward: ZERO,
      efficiency: 0,
      finalReward: ZERO,
      anomaly: 'time-reversed',
      claimId,
    };
  }

  let anomaly: OfflineAnomaly = 'none';
  let creditedSeconds = rawElapsedSeconds;

  if (creditedSeconds > OFFLINE_MAX_SECONDS) {
    creditedSeconds = OFFLINE_MAX_SECONDS;
    anomaly = 'capped';
  }

  let efficiency = getOfflineEfficiency(state);

  // 짧은 시간 안에 시간 변경이 반복되면 보상을 제한한다.
  if (state.offline.timeAnomalyCount >= OFFLINE_ANOMALY_LIMIT) {
    efficiency *= OFFLINE_ANOMALY_PENALTY;
    anomaly = 'repeated-time-change';
  }

  const baseReward = autoRate.mul(creditedSeconds);
  const finalReward = baseReward.mul(efficiency).floor();

  return {
    creditedSeconds,
    rawElapsedSeconds,
    baseReward,
    efficiency,
    finalReward,
    anomaly,
    claimId,
  };
};

export interface OfflineClaimResult {
  readonly state: GameState;
  readonly granted: Big;
  /** 같은 claimId로 이미 지급했으면 true. 중복 지급을 막은 경우다. */
  readonly alreadyClaimed: boolean;
}

/**
 * 오프라인 보상을 실제로 지급한다.
 * 같은 `claimId`가 이미 처리되어 있으면 아무것도 주지 않는다 (계획서 7 중복 지급 방지).
 */
export const claimOfflineReward = (
  state: GameState,
  report: OfflineReport,
  nowMs: number,
): OfflineClaimResult => {
  if (state.offline.lastClaimId === report.claimId) {
    return { state, granted: ZERO, alreadyClaimed: true };
  }

  const timeAnomalyCount =
    report.anomaly === 'time-reversed'
      ? state.offline.timeAnomalyCount + 1
      : state.offline.timeAnomalyCount;

  const granted = report.finalReward;

  return {
    state: {
      ...state,
      ember: state.ember.add(granted),
      lifetimeEmber: state.lifetimeEmber.add(granted),
      runLifetimeEmber: state.runLifetimeEmber.add(granted),
      offline: {
        lastCalculatedAt: nowMs,
        lastClaimId: report.claimId,
        timeAnomalyCount,
      },
      lastActiveAt: nowMs,
    },
    granted,
    alreadyClaimed: false,
  };
};

/**
 * 앱이 백그라운드로 갈 때나 자동 저장 시점에 호출한다.
 * 오프라인 계산의 기준 시각을 앞으로 당겨 두는 역할만 한다.
 */
export const markOfflineCheckpoint = (state: GameState, nowMs: number): GameState => ({
  ...state,
  offline: { ...state.offline, lastCalculatedAt: nowMs },
  lastActiveAt: nowMs,
});

/** 복귀 화면 문구용. 보상이 0이면 화면을 띄우지 않아도 되는지 판단한다. */
export const shouldShowOfflineScreen = (report: OfflineReport): boolean =>
  report.finalReward.sign() > 0 && report.creditedSeconds >= 60;

/** 최대 오프라인 시간을 초 단위로 노출한다(유물 "녹슨 열쇠" 같은 V1.1 확장 지점). */
export const getMaxOfflineSeconds = (): number => OFFLINE_MAX_SECONDS;

export const describeAnomaly = (anomaly: OfflineAnomaly): string => {
  switch (anomaly) {
    case 'none':
      return '';
    case 'time-reversed':
      return '기기 시간이 이전으로 돌아가 오프라인 보상을 지급하지 않았습니다.';
    case 'capped':
      return `오프라인 보상은 최대 ${Math.floor(OFFLINE_MAX_SECONDS / 3600)}시간까지 쌓입니다.`;
    case 'repeated-time-change':
      return '기기 시간 변경이 반복 감지되어 보상이 제한되었습니다.';
  }
};

/** 계산에 쓰인 값을 그대로 노출해 분석 이벤트(15.1)에 실을 수 있게 한다. */
export const toAnalyticsPayload = (report: OfflineReport): Record<string, string | number> => ({
  credited_seconds: Math.floor(report.creditedSeconds),
  raw_elapsed_seconds: Math.floor(report.rawElapsedSeconds),
  efficiency: Number(report.efficiency.toFixed(4)),
  anomaly: report.anomaly,
  reward: report.finalReward.toString(),
});
