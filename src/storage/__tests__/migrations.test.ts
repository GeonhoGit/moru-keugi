/** 계획서 17.1 - 마이그레이션(버전 변환과 실패 복구) 자동 테스트 */
import { describe, expect, it } from 'vitest';
import { migrateSaveData, MIGRATIONS, type MigrationStep } from '../migrations';
import { SAVE_VERSION } from '../../data/balance';
import { createMemoryAdapter, STORAGE_KEYS } from '../adapter';
import { loadGame, saveGame } from '../saveManager';
import { createInitialState } from '../../engine/state';
import { toSaveData } from '../../engine/serialize';

/**
 * 실제 저장 스키마는 아직 v1 하나뿐이라, 단계 실행 순서와 실패 처리를 검증하려면
 * 시험용 단계를 주입한다. 새 마이그레이션을 추가할 때 이 기계장치는 그대로 쓴다.
 */
const stepOneToTwo: MigrationStep = {
  from: 1,
  to: 2,
  describe: 'v1 → v2: 잉걸불 단위 정리',
  migrate: (data) => ({ ...data, addedInV2: true }),
};

const stepTwoToThree: MigrationStep = {
  from: 2,
  to: 3,
  describe: 'v2 → v3: 주문 슬롯 구조 변경',
  migrate: (data) => ({ ...data, addedInV3: true }),
};

const failingStep: MigrationStep = {
  from: 2,
  to: 3,
  describe: 'v2 → v3: 일부러 실패하는 단계',
  migrate: () => {
    throw new Error('변환할 수 없는 필드가 있습니다');
  },
};

const TEST_STEPS = [stepOneToTwo, stepTwoToThree];

describe('마이그레이션 실행 (계획서 8.5)', () => {
  it('한 단계씩 순서대로 실행한다', () => {
    const result = migrateSaveData({ saveVersion: 1 }, TEST_STEPS, 3);

    expect(result.outcome).toBe('ok');
    expect(result.fromVersion).toBe(1);
    expect(result.data).toMatchObject({ saveVersion: 3, addedInV2: true, addedInV3: true });
    expect(result.appliedSteps).toEqual([stepOneToTwo.describe, stepTwoToThree.describe]);
  });

  it('중간 버전에서 시작하면 남은 단계만 실행한다', () => {
    const result = migrateSaveData({ saveVersion: 2 }, TEST_STEPS, 3);

    expect(result.appliedSteps).toEqual([stepTwoToThree.describe]);
    expect(result.data).not.toHaveProperty('addedInV2');
    expect(result.data).toHaveProperty('addedInV3');
  });

  it('원본 객체를 바꾸지 않는다 (마이그레이션 전 원본 보관)', () => {
    const original = { saveVersion: 1, economy: { ember: '10' } };
    migrateSaveData(original, TEST_STEPS, 3);

    expect(original).toEqual({ saveVersion: 1, economy: { ember: '10' } });
  });

  it('이미 최신 버전이면 아무 단계도 실행하지 않는다', () => {
    const result = migrateSaveData({ saveVersion: 3 }, TEST_STEPS, 3);

    expect(result.outcome).toBe('already-current');
    expect(result.appliedSteps).toEqual([]);
    expect(result.data).toEqual({ saveVersion: 3 });
  });
});

describe('마이그레이션 실패 처리 (계획서 8.5 - 앱을 종료시키지 않는다)', () => {
  it('단계가 실패하면 데이터를 만들지 않고 이유를 알려 준다', () => {
    const result = migrateSaveData({ saveVersion: 1 }, [stepOneToTwo, failingStep], 3);

    expect(result.outcome).toBe('step-failed');
    expect(result.data).toBeNull();
    expect(result.error).toContain('변환할 수 없는 필드');
    // 실패 전까지 통과한 단계는 그대로 보고한다.
    expect(result.appliedSteps).toEqual([stepOneToTwo.describe]);
  });

  it('갈 수 있는 경로가 없으면 손대지 않는다', () => {
    const result = migrateSaveData({ saveVersion: 1 }, [stepTwoToThree], 3);

    expect(result.outcome).toBe('no-path');
    expect(result.data).toBeNull();
  });

  it('saveVersion을 읽을 수 없으면 거절한다', () => {
    for (const raw of [{}, { saveVersion: '1' }, { saveVersion: 1.5 }]) {
      expect(migrateSaveData(raw, TEST_STEPS, 3).outcome).toBe('no-path');
    }
  });

  it('앱보다 최신인 저장본은 낮추지 않는다', () => {
    const result = migrateSaveData({ saveVersion: 9 }, TEST_STEPS, 3);

    expect(result.outcome).toBe('future-version');
    expect(result.data).toBeNull();
  });
});

describe('현재 스키마', () => {
  it('v1이 최초 버전이라 등록된 단계가 없다', () => {
    expect(SAVE_VERSION).toBe(1);
    expect(MIGRATIONS).toEqual([]);
  });

  it('현재 저장본은 마이그레이션 없이 그대로 읽힌다', () => {
    const save = toSaveData(createInitialState(0), 0) as unknown as Record<string, unknown>;
    expect(migrateSaveData(save).outcome).toBe('already-current');
  });
});

describe('불러오기와 함께 동작할 때', () => {
  it('마이그레이션이 실패하면 백업으로 복구한다', async () => {
    const adapter = createMemoryAdapter();
    const state = createInitialState(1_700_000_000_000);
    await saveGame(adapter, state, 1000);
    await saveGame(adapter, state, 2000);

    // primary만 옛 버전으로 바꿔 두고, 그 버전을 처리할 단계는 실패하게 만든다.
    const old = JSON.parse(adapter.dump()[STORAGE_KEYS.primary]!);
    old.saveVersion = 0;
    await adapter.setItem(STORAGE_KEYS.primary, JSON.stringify(old));

    const loaded = await loadGame(adapter, [
      { from: 0, to: 1, describe: '실패 단계', migrate: () => { throw new Error('깨짐'); } },
    ]);

    expect(loaded.source).toBe('backup');
    expect(loaded.recovered).toBe(true);
    expect(loaded.events.map((event) => event.name)).toContain('save_migration_failed');
  });

  it('마이그레이션이 성공하면 원래 버전을 보고한다', async () => {
    const adapter = createMemoryAdapter();
    await saveGame(adapter, createInitialState(1_700_000_000_000), 1000);

    const old = JSON.parse(adapter.dump()[STORAGE_KEYS.primary]!);
    old.saveVersion = 0;
    await adapter.setItem(STORAGE_KEYS.primary, JSON.stringify(old));

    const loaded = await loadGame(adapter, [
      { from: 0, to: 1, describe: 'v0 → v1', migrate: (data) => data },
    ]);

    expect(loaded.source).toBe('primary');
    expect(loaded.migratedFrom).toBe(0);
    expect(loaded.state).not.toBeNull();
  });
});
