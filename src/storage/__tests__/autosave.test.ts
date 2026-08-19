/** 계획서 8.2 - 저장 시점 자동 테스트 */
import { describe, expect, it } from 'vitest';
import { createAutosaveController } from '../autosave';
import { AUTOSAVE_INTERVAL_SECONDS } from '../../data/balance';

describe('자동 저장 주기', () => {
  it('주기가 지나기 전에는 주기 저장을 하지 않는다', () => {
    const controller = createAutosaveController(0);
    expect(controller.shouldSave('interval', (AUTOSAVE_INTERVAL_SECONDS - 1) * 1000)).toBe(false);
  });

  it('주기가 지나면 저장한다', () => {
    const controller = createAutosaveController(0);
    expect(controller.shouldSave('interval', AUTOSAVE_INTERVAL_SECONDS * 1000)).toBe(true);
  });

  it('저장 후에는 기준 시각이 갱신되어 주기가 다시 시작된다', () => {
    const controller = createAutosaveController(0);
    const firstDue = AUTOSAVE_INTERVAL_SECONDS * 1000;

    controller.markSaved(firstDue);
    expect(controller.getLastSavedAt()).toBe(firstDue);
    expect(controller.shouldSave('interval', firstDue + 1000)).toBe(false);
    expect(controller.shouldSave('interval', firstDue * 2)).toBe(true);
  });

  it('계획서 8.2가 정한 주기 범위(15~30초) 안에 있다', () => {
    expect(AUTOSAVE_INTERVAL_SECONDS).toBeGreaterThanOrEqual(15);
    expect(AUTOSAVE_INTERVAL_SECONDS).toBeLessThanOrEqual(30);
  });
});

describe('즉시 저장 시점 (계획서 8.2)', () => {
  it('주기와 무관하게 바로 저장한다', () => {
    const controller = createAutosaveController(0);
    const immediately = 1;

    for (const trigger of [
      'upgrade-purchased',
      'order-changed',
      'achievement-claimed',
      'prestige',
      'background',
      'settings-changed',
      'offline-claimed',
    ] as const) {
      expect(controller.shouldSave(trigger, immediately)).toBe(true);
    }
  });
});
