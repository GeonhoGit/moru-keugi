/**
 * 게임 저장소 통합 테스트.
 *
 * 화면 없이도 "앱을 켜고, 놀고, 백그라운드로 보내고, 다시 켜는" 흐름을 그대로 돌린다.
 * 실기기 테스트(계획서 17.2) 전에 저장 연결이 끊기지 않았는지 확인하는 안전망이다.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter, STORAGE_KEYS } from '../../storage/adapter';
import { createGameStore } from '../gameStore';
import { getUpgradeDefinition } from '../../data/upgrades';
import { TUTORIAL_STEP_COUNT } from '../../data/tutorial';

const ironTongs = getUpgradeDefinition('iron_tongs');

/** 시간을 직접 굴려야 오프라인 계산을 검증할 수 있다. */
const createClock = (start = 1_700_000_000_000) => {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
};

const setup = () => {
  const adapter = createMemoryAdapter();
  const clock = createClock();
  const store = createGameStore({ adapter, now: clock.now });
  return { adapter, clock, store };
};

describe('앱 시작', () => {
  it('저장본이 없으면 새 게임으로 시작한다', async () => {
    const { store } = setup();
    await store.initialize();

    const snapshot = store.getSnapshot();
    expect(snapshot.phase).toBe('ready');
    expect(snapshot.state.ember.toString()).toBe('0');
    expect(snapshot.state.tutorialStep).toBe(0);
    expect(snapshot.recoveredFromBackup).toBe(false);
  });

  it('저장본이 둘 다 손상되면 손상 상태로 보고한다', async () => {
    const adapter = createMemoryAdapter({
      [STORAGE_KEYS.primary]: 'not json',
      [STORAGE_KEYS.backup]: 'also not json',
    });
    const store = createGameStore({ adapter, now: () => 0 });
    await store.initialize();

    expect(store.getSnapshot().phase).toBe('corrupted');
  });
});

describe('플레이와 저장', () => {
  it('타격하면 잉걸불이 늘고 구독자에게 알린다', async () => {
    const { store } = setup();
    await store.initialize();

    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    store.click();
    store.click();

    expect(store.getSnapshot().state.ember.toString()).toBe('2');
    expect(store.getSnapshot().state.clickCount).toBe(2);
    expect(notifications).toBe(2);
    unsubscribe();
  });

  it('구독을 해지하면 더 이상 알림을 받지 않는다', async () => {
    const { store } = setup();
    await store.initialize();

    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });
    unsubscribe();
    store.click();

    expect(notifications).toBe(0);
  });

  it('업그레이드를 사면 즉시 저장되고 다시 켜도 남아 있다', async () => {
    const { adapter, clock, store } = setup();
    await store.initialize();

    // 무쇠 집게를 살 만큼 두드린다.
    const cost = Number(ironTongs.baseCost);
    for (let i = 0; i < cost; i += 1) store.click();
    store.buyUpgrade('iron_tongs', 1);

    expect(store.getSnapshot().state.upgrades.iron_tongs).toBe(1);
    await store.handleBackground();

    // 앱을 껐다 켠 상황
    clock.advance(1000);
    const reopened = createGameStore({ adapter, now: clock.now });
    await reopened.initialize();

    expect(reopened.getSnapshot().state.upgrades.iron_tongs).toBe(1);
    expect(reopened.getSnapshot().state.clickCount).toBe(cost);
  });

  it('살 수 없는 업그레이드를 누르면 상태가 그대로다', async () => {
    const { store } = setup();
    await store.initialize();

    const before = store.getSnapshot().state;
    store.buyUpgrade('iron_tongs', 1);

    expect(store.getSnapshot().state).toBe(before);
  });
});

describe('튜토리얼 (계획서 12.3)', () => {
  it('조건을 만족하면 단계가 자동으로 넘어간다', async () => {
    const { store } = setup();
    await store.initialize();

    expect(store.getSnapshot().state.tutorialStep).toBe(0);
    for (let i = 0; i < 5; i += 1) store.click();

    // 1단계(모루 5회 타격)를 넘어선다.
    expect(store.getSnapshot().state.tutorialStep).toBe(1);
  });

  it('건너뛰면 완료 처리된다', async () => {
    const { store } = setup();
    await store.initialize();

    store.dismissTutorial();
    expect(store.getSnapshot().state.tutorialStep).toBe(TUTORIAL_STEP_COUNT);
  });
});

describe('백그라운드 복귀와 오프라인 보상 (계획서 7)', () => {
  const buildProducingStore = async () => {
    const { adapter, clock, store } = setup();
    await store.initialize();

    // 견습 대장장이를 살 만큼 두드려 자동 생산을 만든다.
    const apprenticeCost = 100;
    for (let i = 0; i < apprenticeCost; i += 1) store.click();
    store.buyUpgrade('apprentice', 1);

    return { adapter, clock, store };
  };

  it('오래 자리를 비우면 복귀 화면에 보상이 대기한다', async () => {
    const { clock, store } = await buildProducingStore();

    await store.handleBackground();
    clock.advance(2 * 60 * 60 * 1000); // 2시간
    await store.handleForeground();

    const report = store.getSnapshot().pendingOffline;
    expect(report).not.toBeNull();
    expect(report!.creditedSeconds).toBe(7200);
    expect(report!.finalReward.sign()).toBe(1);
  });

  it('보상을 받으면 잉걸불이 늘고 대기 상태가 사라진다', async () => {
    const { clock, store } = await buildProducingStore();

    await store.handleBackground();
    clock.advance(2 * 60 * 60 * 1000);
    await store.handleForeground();

    const before = store.getSnapshot().state.ember;
    store.claimPendingOffline();

    expect(store.getSnapshot().pendingOffline).toBeNull();
    expect(store.getSnapshot().state.ember.gt(before)).toBe(true);
  });

  it('같은 보상을 두 번 받을 수 없다', async () => {
    const { clock, store } = await buildProducingStore();

    await store.handleBackground();
    clock.advance(2 * 60 * 60 * 1000);
    await store.handleForeground();

    store.claimPendingOffline();
    const after = store.getSnapshot().state.ember.toString();
    store.claimPendingOffline(); // 대기 중인 보상이 없으므로 아무 일도 없어야 한다

    expect(store.getSnapshot().state.ember.toString()).toBe(after);
  });

  it('잠깐 다녀오면 화면을 띄우지 않고 생산만 반영한다', async () => {
    const { clock, store } = await buildProducingStore();

    await store.handleBackground();
    const before = store.getSnapshot().state.ember;
    clock.advance(30 * 1000); // 30초
    await store.handleForeground();

    expect(store.getSnapshot().pendingOffline).toBeNull();
    expect(store.getSnapshot().state.ember.gte(before)).toBe(true);
  });
});

describe('데이터 초기화 (계획서 8.6)', () => {
  it('초기화하면 저장본까지 지우고 새 게임을 저장한다', async () => {
    const { adapter, store } = setup();
    await store.initialize();
    for (let i = 0; i < 30; i += 1) store.click();
    await store.handleBackground();

    await store.resetGame();

    expect(store.getSnapshot().state.clickCount).toBe(0);
    expect(store.getSnapshot().state.ember.toString()).toBe('0');

    const reopened = createGameStore({ adapter, now: () => 0 });
    await reopened.initialize();
    expect(reopened.getSnapshot().state.clickCount).toBe(0);
  });
});
