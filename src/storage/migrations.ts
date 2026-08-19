/**
 * 저장 마이그레이션 (계획서 8.5).
 *
 * 모든 저장 데이터에 `saveVersion`을 두고 `v1 → v2 → v3` 순서로 한 단계씩 실행한다.
 * 마이그레이션 전 원본은 별도로 보관하고, 실패해도 앱을 종료시키지 않는다.
 * 호출자는 실패를 받으면 백업 복구나 안전 초기화 선택지를 제공한다.
 */
import { SAVE_VERSION } from '../data/balance';

export interface MigrationStep {
  /** 이 단계가 처리할 입력 버전 */
  readonly from: number;
  /** 처리 후 버전 */
  readonly to: number;
  readonly describe: string;
  /** 실패하면 예외를 던진다. 호출자가 잡아 복구 경로로 넘긴다. */
  readonly migrate: (data: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * 실제 마이그레이션 목록.
 *
 * 현재 저장 스키마는 v1이 최초 버전이라 단계가 없다.
 * 스키마를 바꿀 때 `{ from: 1, to: 2, ... }`를 추가하고 `SAVE_VERSION`을 올린다.
 * 단계 실행 순서와 실패 처리는 이미 아래 `migrateSaveData`가 담당하므로,
 * 새 단계는 변환 함수와 단위 테스트만 추가하면 된다.
 */
export const MIGRATIONS: readonly MigrationStep[] = [];

export type MigrationOutcome = 'ok' | 'already-current' | 'no-path' | 'step-failed' | 'future-version';

export interface MigrationResult {
  readonly outcome: MigrationOutcome;
  readonly data: Record<string, unknown> | null;
  readonly fromVersion: number;
  readonly toVersion: number;
  /** 실행된 단계 설명. 분석 이벤트와 복구 안내에 쓴다. */
  readonly appliedSteps: readonly string[];
  readonly error: string | null;
}

const readVersion = (data: Record<string, unknown>): number => {
  const version = data.saveVersion;
  return typeof version === 'number' && Number.isInteger(version) ? version : -1;
};

/**
 * 저장 데이터를 현재 스키마 버전까지 한 단계씩 올린다.
 * 입력 객체는 건드리지 않고 새 객체를 돌려준다 (원본 보관 요건).
 */
export const migrateSaveData = (
  raw: Record<string, unknown>,
  steps: readonly MigrationStep[] = MIGRATIONS,
  targetVersion: number = SAVE_VERSION,
): MigrationResult => {
  const fromVersion = readVersion(raw);
  const appliedSteps: string[] = [];

  if (fromVersion < 0) {
    return {
      outcome: 'no-path',
      data: null,
      fromVersion,
      toVersion: targetVersion,
      appliedSteps,
      error: 'saveVersion을 읽을 수 없습니다.',
    };
  }

  if (fromVersion > targetVersion) {
    // 구버전 앱이 새 저장본을 억지로 낮추면 데이터가 깨진다. 손대지 않는다.
    return {
      outcome: 'future-version',
      data: null,
      fromVersion,
      toVersion: targetVersion,
      appliedSteps,
      error: `저장본이 이 앱보다 최신입니다 (${fromVersion} > ${targetVersion}).`,
    };
  }

  if (fromVersion === targetVersion) {
    return {
      outcome: 'already-current',
      data: { ...raw },
      fromVersion,
      toVersion: targetVersion,
      appliedSteps,
      error: null,
    };
  }

  let current: Record<string, unknown> = { ...raw };
  let version = fromVersion;

  while (version < targetVersion) {
    const step = steps.find((candidate) => candidate.from === version);
    if (!step) {
      return {
        outcome: 'no-path',
        data: null,
        fromVersion,
        toVersion: targetVersion,
        appliedSteps,
        error: `버전 ${version}에서 다음 단계로 갈 마이그레이션이 없습니다.`,
      };
    }

    try {
      current = { ...step.migrate({ ...current }), saveVersion: step.to };
    } catch (error) {
      return {
        outcome: 'step-failed',
        data: null,
        fromVersion,
        toVersion: targetVersion,
        appliedSteps,
        error: `${step.describe} 단계에서 실패했습니다: ${describeError(error)}`,
      };
    }

    appliedSteps.push(step.describe);
    version = step.to;
  }

  return {
    outcome: 'ok',
    data: current,
    fromVersion,
    toVersion: targetVersion,
    appliedSteps,
    error: null,
  };
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
