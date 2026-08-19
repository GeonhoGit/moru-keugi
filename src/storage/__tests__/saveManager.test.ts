/** 계획서 17.1 - 저장(저장·읽기·백업·검증·복구) 자동 테스트 */
import { describe, expect, it } from 'vitest';
import { big } from '../../engine/bignum';
import { createInitialState } from '../../engine/state';
import { toSaveData } from '../../engine/serialize';
import { createMemoryAdapter, STORAGE_KEYS } from '../adapter';
import { loadGame, resetSavedGame, saveGame } from '../saveManager';
import type { GameState } from '../../types/index';

const makeState = (ember: string): GameState => ({
  ...createInitialState(1_700_000_000_000),
  ember: big(ember),
  lifetimeEmber: big(ember),
  runLifetimeEmber: big(ember),
  clickCount: 42,
  upgrades: { apprentice: 7 },
});

describe('저장 (계획서 8.3 - 이중 백업)', () => {
  it('첫 저장은 백업 없이 primary만 만든다', async () => {
    const adapter = createMemoryAdapter();
    const result = await saveGame(adapter, makeState('100'), 1000);

    expect(result.outcome).toBe('ok');
    expect(result.backedUp).toBe(false);
    expect(adapter.dump()[STORAGE_KEYS.primary]).toBeDefined();
    expect(adapter.dump()[STORAGE_KEYS.backup]).toBeUndefined();
  });

  it('두 번째 저장부터 직전 저장본이 백업으로 옮겨진다', async () => {
    const adapter = createMemoryAdapter();
    await saveGame(adapter, makeState('100'), 1000);
    const first = adapter.dump()[STORAGE_KEYS.primary];

    const result = await saveGame(adapter, makeState('999'), 2000);

    expect(result.backedUp).toBe(true);
    expect(adapter.dump()[STORAGE_KEYS.backup]).toBe(first);
    expect(adapter.dump()[STORAGE_KEYS.primary]).not.toBe(first);
  });

  it('저장이 끝나면 임시 키를 남기지 않는다', async () => {
    const adapter = createMemoryAdapter();
    await saveGame(adapter, makeState('100'), 1000);
    expect(adapter.dump()[STORAGE_KEYS.staging]).toBeUndefined();
  });

  it('쓰기가 실패해도 기존 primary는 그대로 남는다', async () => {
    const adapter = createMemoryAdapter();
    await saveGame(adapter, makeState('100'), 1000);
    const before = adapter.dump()[STORAGE_KEYS.primary];

    adapter.failWritesOn([STORAGE_KEYS.staging]);
    const result = await saveGame(adapter, makeState('999'), 2000);

    expect(result.outcome).toBe('write-failed');
    expect(adapter.dump()[STORAGE_KEYS.primary]).toBe(before);
  });

  it('저장한 값을 그대로 되읽는다', async () => {
    const adapter = createMemoryAdapter();
    const state = makeState('123456789');
    await saveGame(adapter, state, 1000);

    const loaded = await loadGame(adapter);
    expect(loaded.source).toBe('primary');
    expect(loaded.recovered).toBe(false);
    // 저장한 상태의 값과 정확히 같아야 한다.
    expect(loaded.state?.ember.toString()).toBe(state.ember.toString());
    expect(loaded.state?.upgrades.apprentice).toBe(7);
    expect(loaded.state?.clickCount).toBe(42);
  });

  /**
   * 큰 수 라이브러리는 값을 가수(mantissa) × 10^지수로 정규화하므로
   * `123456789`가 `123456788.99999999`로 바뀔 수 있다. 상대 오차는 1e-8 수준이고
   * 화면 표기는 반올림을 거치므로 플레이어에게는 보이지 않는다.
   *
   * 진짜 위험은 저장할 때마다 값이 조금씩 밀리는 것이므로, 그 성질을 못 박아 둔다.
   */
  it('저장·불러오기를 반복해도 값이 밀리지 않는다', async () => {
    const adapter = createMemoryAdapter();
    let state = makeState('123456789');
    const firstSaved = state.ember.toString();

    for (let round = 0; round < 20; round += 1) {
      await saveGame(adapter, state, 1000 + round);
      const loaded = await loadGame(adapter);
      expect(loaded.state).not.toBeNull();
      state = loaded.state!;
      expect(state.ember.toString()).toBe(firstSaved);
    }

    // 원래 의도한 값과의 차이는 상대 오차 1e-8 이내로 유지된다.
    const drift = state.ember.sub(big('123456789')).abs().div(big('123456789')).toNumber();
    expect(drift).toBeLessThan(1e-8);
  });
});

describe('복구 (계획서 8.4 - 검증 실패 시 직전 백업 복원)', () => {
  it('primary가 깨지면 백업에서 복구하고 분석 이벤트를 남긴다', async () => {
    const adapter = createMemoryAdapter();
    await saveGame(adapter, makeState('100'), 1000); // primary
    await saveGame(adapter, makeState('200'), 2000); // primary=200, backup=100

    await adapter.setItem(STORAGE_KEYS.primary, '{ 이건 JSON이 아닙니다');
    const loaded = await loadGame(adapter);

    expect(loaded.source).toBe('backup');
    expect(loaded.recovered).toBe(true);
    expect(loaded.state?.ember.toString()).toBe('100');
    expect(loaded.events.map((event) => event.name)).toContain('save_recovered');
  });

  it('필드 검증에 실패한 primary도 백업으로 넘어간다', async () => {
    const adapter = createMemoryAdapter();
    await saveGame(adapter, makeState('100'), 1000);
    await saveGame(adapter, makeState('200'), 2000);

    // JSON은 멀쩡하지만 큰 수 문자열 형식이 깨진 경우
    const broken = JSON.parse(adapter.dump()[STORAGE_KEYS.primary]!);
    broken.economy.ember = '1.2.3';
    await adapter.setItem(STORAGE_KEYS.primary, JSON.stringify(broken));

    const loaded = await loadGame(adapter);
    expect(loaded.source).toBe('backup');
    expect(loaded.state?.ember.toString()).toBe('100');
  });

  it('둘 다 깨지면 상태를 만들지 않고 손상으로 보고한다', async () => {
    const adapter = createMemoryAdapter();
    await saveGame(adapter, makeState('100'), 1000);
    await saveGame(adapter, makeState('200'), 2000);

    await adapter.setItem(STORAGE_KEYS.primary, 'x');
    await adapter.setItem(STORAGE_KEYS.backup, 'y');

    const loaded = await loadGame(adapter);
    expect(loaded.state).toBeNull();
    expect(loaded.source).toBe('none');
    expect(loaded.events.map((event) => event.name)).toContain('save_corrupted');
  });

  it('첫 실행은 손상이 아니라 빈 상태로 본다', async () => {
    const loaded = await loadGame(createMemoryAdapter());
    expect(loaded.state).toBeNull();
    expect(loaded.source).toBe('none');
    expect(loaded.events).toEqual([]);
  });
});

describe('강제 종료 대응 (계획서 17.2)', () => {
  it('임시 키만 남기고 죽어도 primary가 살아 있다', async () => {
    const adapter = createMemoryAdapter();
    await saveGame(adapter, makeState('100'), 1000);

    // 검증 전에 앱이 죽어 임시 키가 남은 상황
    await adapter.setItem(STORAGE_KEYS.staging, '{"saveVersion":1,"부서진":true}');

    const loaded = await loadGame(adapter);
    expect(loaded.state?.ember.toString()).toBe('100');
    // 다음 실행에서 찌꺼기를 지운다.
    expect(adapter.dump()[STORAGE_KEYS.staging]).toBeUndefined();
  });

  it('저장 직후 강제 종료를 반복해도 데이터가 밀리지 않는다', async () => {
    const adapter = createMemoryAdapter();
    for (const amount of ['10', '20', '30', '40']) {
      await saveGame(adapter, makeState(amount), 1000);
      const loaded = await loadGame(adapter);
      expect(loaded.state?.ember.toString()).toBe(amount);
    }
  });
});

describe('초기화 (계획서 8.6)', () => {
  it('세 키를 모두 지운다', async () => {
    const adapter = createMemoryAdapter();
    await saveGame(adapter, makeState('100'), 1000);
    await saveGame(adapter, makeState('200'), 2000);

    await resetSavedGame(adapter);

    expect(adapter.dump()).toEqual({});
    expect((await loadGame(adapter)).state).toBeNull();
  });
});

describe('미래 저장 버전 방어', () => {
  it('구버전 앱이 새 저장본을 읽거나 덮어쓰지 않는다', async () => {
    const adapter = createMemoryAdapter();
    const future = toSaveData(makeState('100'), 1000) as unknown as Record<string, unknown>;
    future.saveVersion = 999;
    await adapter.setItem(STORAGE_KEYS.primary, JSON.stringify(future));

    const loaded = await loadGame(adapter);
    expect(loaded.state).toBeNull();
    expect(loaded.errors.join()).toContain('최신');
  });
});
