/**
 * 햅틱 호출 규칙 (계획서 13.3 / 13.4).
 *
 * 실제 진동은 실기기에서만 확인할 수 있으므로, 여기서는 "언제 부르고 언제 안 부르는지"만
 * 검증한다. 설정을 껐을 때 아예 부르지 않는 것이 접근성 요건(14절 햅틱 대체)의 전제다.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../../storage/adapter';
import { createGameStore } from '../gameStore';
import type { HapticsService, HapticStrength } from '../../services/index';

const createSpyHaptics = () => {
  const calls: HapticStrength[] = [];
  const service: HapticsService = {
    trigger: (strength) => {
      calls.push(strength);
    },
  };
  return { service, calls };
};

const setup = async () => {
  const spy = createSpyHaptics();
  const store = createGameStore({
    adapter: createMemoryAdapter(),
    haptics: spy.service,
    now: () => 1_700_000_000_000,
  });
  await store.initialize();
  return { store, spy };
};

describe('햅틱 호출 (계획서 13.3)', () => {
  it('타격은 약한 햅틱을 부른다', async () => {
    const { store, spy } = await setup();
    store.click();
    expect(spy.calls).toEqual(['light']);
  });

  it('업그레이드 구매는 성공 햅틱을 부른다', async () => {
    const { store, spy } = await setup();
    for (let i = 0; i < 30; i += 1) store.click();
    spy.calls.length = 0;

    store.buyUpgrade('iron_tongs', 1);
    expect(spy.calls).toEqual(['success']);
  });

  it('구매에 실패하면 햅틱이 울리지 않는다', async () => {
    const { store, spy } = await setup();
    store.buyUpgrade('iron_tongs', 1); // 잉걸불 부족
    expect(spy.calls).toEqual([]);
  });

  it('설정에서 햅틱을 끄면 아무것도 부르지 않는다', async () => {
    const { store, spy } = await setup();
    store.updateSettings({ hapticsEnabled: false });
    spy.calls.length = 0;

    store.click();
    for (let i = 0; i < 30; i += 1) store.click();
    store.buyUpgrade('iron_tongs', 1);

    expect(spy.calls).toEqual([]);
  });

  it('햅틱을 다시 켜면 즉시 반영된다', async () => {
    const { store, spy } = await setup();
    store.updateSettings({ hapticsEnabled: false });
    store.click();
    expect(spy.calls).toEqual([]);

    store.updateSettings({ hapticsEnabled: true });
    store.click();
    expect(spy.calls).toEqual(['light']);
  });
});
