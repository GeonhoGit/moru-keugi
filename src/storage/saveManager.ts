/**
 * 저장·백업·복구 (계획서 8.2 / 8.3 / 8.4 / 8.6).
 *
 * 클릭커 게임에서 저장 손실은 가장 치명적인 문제이므로 저장을 독립 기능으로 다룬다.
 *
 * 저장 순서 (8.3)
 *   ① 기존 primarySave 검증
 *   ② 정상이면 backupSave로 복사
 *   ③ 새 데이터를 임시 키에 기록
 *   ④ 다시 읽어 파싱·필드 검증
 *   ⑤ 정상일 때만 primarySave로 교체
 *
 * 어느 단계에서 앱이 강제 종료되어도 primarySave는 항상 마지막으로 검증에 성공한
 * 저장본을 가리킨다. 임시 키에 남은 찌꺼기는 다음 실행에서 무시하고 지운다.
 */
import { fromSaveData, toSaveData, validateSaveData } from '../engine/serialize';
import type { GameState } from '../types/index';
import { STORAGE_KEYS, type StorageAdapter } from './adapter';
import { migrateSaveData, type MigrationStep } from './migrations';

/** 계획서 15.1의 저장 관련 분석 이벤트 */
export type SaveAnalyticsEvent =
  | { readonly name: 'save_recovered'; readonly source: 'backup'; readonly reason: string }
  | { readonly name: 'save_migration_failed'; readonly reason: string }
  | { readonly name: 'save_corrupted'; readonly reason: string };

// ---------------------------------------------------------------------------
// 저장
// ---------------------------------------------------------------------------

export type SaveOutcome = 'ok' | 'verify-failed' | 'write-failed';

export interface SaveResult {
  readonly outcome: SaveOutcome;
  /** 이번 저장에서 직전 저장본을 백업으로 옮겼는지 */
  readonly backedUp: boolean;
  readonly error: string | null;
}

export const saveGame = async (
  adapter: StorageAdapter,
  state: GameState,
  nowMs: number = Date.now(),
): Promise<SaveResult> => {
  let backedUp = false;

  try {
    // ① 기존 primarySave 검증 → ② 정상이면 backupSave로 복사
    const existing = await adapter.getItem(STORAGE_KEYS.primary);
    if (existing !== null && isReadable(existing)) {
      await adapter.setItem(STORAGE_KEYS.backup, existing);
      backedUp = true;
    }

    // ③ 새 데이터를 임시 키에 기록
    const serialized = JSON.stringify(toSaveData(state, nowMs));
    await adapter.setItem(STORAGE_KEYS.staging, serialized);

    // ④ 다시 읽어 파싱·필드 검증
    const written = await adapter.getItem(STORAGE_KEYS.staging);
    if (written === null || !isReadable(written)) {
      return {
        outcome: 'verify-failed',
        backedUp,
        error: '기록한 저장본을 다시 읽어 검증하는 데 실패했습니다.',
      };
    }

    // ⑤ 정상일 때만 primarySave로 교체
    await adapter.setItem(STORAGE_KEYS.primary, written);
    await adapter.removeItem(STORAGE_KEYS.staging);

    return { outcome: 'ok', backedUp, error: null };
  } catch (error) {
    return { outcome: 'write-failed', backedUp, error: describeError(error) };
  }
};

// ---------------------------------------------------------------------------
// 불러오기와 복구
// ---------------------------------------------------------------------------

export type LoadSource = 'primary' | 'backup' | 'none';

export interface LoadResult {
  readonly state: GameState | null;
  readonly source: LoadSource;
  /** 백업에서 복구했는지. true면 화면에서 복구 시점을 안내해야 한다 (8.6). */
  readonly recovered: boolean;
  /** 마이그레이션을 거쳤다면 원래 버전 */
  readonly migratedFrom: number | null;
  readonly events: readonly SaveAnalyticsEvent[];
  readonly errors: readonly string[];
}

/**
 * primarySave → backupSave 순서로 시도한다.
 * 둘 다 읽을 수 없으면 상태를 만들지 않고, 호출자가 안전 초기화를 안내한다.
 */
export const loadGame = async (
  adapter: StorageAdapter,
  steps?: readonly MigrationStep[],
): Promise<LoadResult> => {
  const events: SaveAnalyticsEvent[] = [];
  const errors: string[] = [];

  // 강제 종료로 남은 임시 저장본은 검증을 통과한 적이 없으므로 쓰지 않고 지운다.
  await adapter.removeItem(STORAGE_KEYS.staging).catch(() => undefined);

  const primary = await readSlot(adapter, STORAGE_KEYS.primary, steps);
  if (primary.state) {
    return {
      state: primary.state,
      source: 'primary',
      recovered: false,
      migratedFrom: primary.migratedFrom,
      events,
      errors,
    };
  }
  if (primary.error) errors.push(`primary: ${primary.error}`);
  if (primary.migrationFailed) {
    events.push({ name: 'save_migration_failed', reason: primary.error ?? '알 수 없음' });
  }

  const backup = await readSlot(adapter, STORAGE_KEYS.backup, steps);
  if (backup.state) {
    events.push({
      name: 'save_recovered',
      source: 'backup',
      reason: primary.error ?? '기본 저장본을 읽을 수 없습니다.',
    });
    return {
      state: backup.state,
      source: 'backup',
      recovered: true,
      migratedFrom: backup.migratedFrom,
      events,
      errors,
    };
  }
  if (backup.error) errors.push(`backup: ${backup.error}`);

  // 애초에 저장본이 없는 첫 실행은 손상이 아니다.
  if (primary.empty && backup.empty) {
    return { state: null, source: 'none', recovered: false, migratedFrom: null, events, errors };
  }

  events.push({ name: 'save_corrupted', reason: errors.join(' / ') || '알 수 없음' });
  return { state: null, source: 'none', recovered: false, migratedFrom: null, events, errors };
};

interface SlotResult {
  readonly state: GameState | null;
  readonly migratedFrom: number | null;
  readonly empty: boolean;
  readonly migrationFailed: boolean;
  readonly error: string | null;
}

const readSlot = async (
  adapter: StorageAdapter,
  key: string,
  steps?: readonly MigrationStep[],
): Promise<SlotResult> => {
  let text: string | null;
  try {
    text = await adapter.getItem(key);
  } catch (error) {
    return { state: null, migratedFrom: null, empty: false, migrationFailed: false, error: describeError(error) };
  }

  if (text === null) {
    return { state: null, migratedFrom: null, empty: true, migrationFailed: false, error: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      state: null,
      migratedFrom: null,
      empty: false,
      migrationFailed: false,
      error: `JSON 파싱 실패: ${describeError(error)}`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { state: null, migratedFrom: null, empty: false, migrationFailed: false, error: '저장 데이터가 객체가 아닙니다.' };
  }

  const migration = migrateSaveData(parsed as Record<string, unknown>, steps);
  if (!migration.data) {
    return {
      state: null,
      migratedFrom: null,
      empty: false,
      migrationFailed: migration.outcome === 'step-failed' || migration.outcome === 'no-path',
      error: migration.error,
    };
  }

  const loaded = fromSaveData(migration.data);
  if (!loaded.state) {
    return {
      state: null,
      migratedFrom: null,
      empty: false,
      migrationFailed: false,
      error: loaded.validation.errors.join(', '),
    };
  }

  return {
    state: loaded.state,
    migratedFrom: migration.outcome === 'ok' ? migration.fromVersion : null,
    empty: false,
    migrationFailed: false,
    error: null,
  };
};

// ---------------------------------------------------------------------------
// 초기화 (계획서 8.6)
// ---------------------------------------------------------------------------

/**
 * 게임 데이터를 완전히 지운다.
 * 화면은 두 번 확인 + 확인 문구 입력을 거친 뒤에만 이 함수를 부른다.
 */
export const resetSavedGame = async (adapter: StorageAdapter): Promise<void> => {
  await adapter.removeItem(STORAGE_KEYS.primary);
  await adapter.removeItem(STORAGE_KEYS.backup);
  await adapter.removeItem(STORAGE_KEYS.staging);
};

const isReadable = (text: string): boolean => {
  try {
    return validateSaveData(JSON.parse(text)).valid;
  } catch {
    return false;
  }
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
