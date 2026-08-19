/** 계획서 17.1 - 저장(저장·읽기·검증) 자동 테스트 */
import { describe, expect, it } from 'vitest';
import { big } from '../bignum';
import { computeChecksum, fromSaveData, toSaveData, validateSaveData } from '../serialize';
import { createInitialState } from '../state';
import { SAVE_VERSION } from '../../data/balance';
import type { GameState } from '../../types/index';

const rich: GameState = {
  ...createInitialState(1_700_000_000_000),
  ember: big('1.2345e42'),
  lifetimeEmber: big('9.87e120'),
  runLifetimeEmber: big('4.2e40'),
  clickCount: 54321,
  upgrades: { apprentice: 137, iron_tongs: 42, master_anvil: 25 },
  prestige: { count: 7, masterSeals: 33, permanentSkills: { skilled_hands: 12, night_shift: 4 } },
  unlocks: ['decor_miners_lamp'],
  achievements: {
    first_hit: { unlocked: true, claimed: true, unlockedAt: '2024-01-01T00:00:00.000Z' },
  },
  orders: { slots: [], completedOrderIds: ['farmers_scythe'], completedCount: 12 },
};

/** JSON 문자열을 거쳐야 실제 저장 경로와 같은 조건이 된다. */
const roundTrip = (state: GameState): GameState => {
  const parsed = JSON.parse(JSON.stringify(toSaveData(state)));
  const result = fromSaveData(parsed);
  expect(result.validation.errors).toEqual([]);
  if (!result.state) throw new Error('저장 데이터를 읽지 못했습니다.');
  return result.state;
};

describe('저장 왕복 (계획서 8.1)', () => {
  it('큰 수는 문자열로 저장되고 값이 그대로 복원된다', () => {
    const save = toSaveData(rich);
    expect(typeof save.economy.ember).toBe('string');
    expect(save.saveVersion).toBe(SAVE_VERSION);

    const restored = roundTrip(rich);
    expect(restored.ember.toString()).toBe(rich.ember.toString());
    expect(restored.lifetimeEmber.toString()).toBe(rich.lifetimeEmber.toString());
    expect(restored.runLifetimeEmber.toString()).toBe(rich.runLifetimeEmber.toString());
  });

  it('업그레이드·환생·업적·해금이 모두 보존된다', () => {
    const restored = roundTrip(rich);
    expect(restored.upgrades).toEqual(rich.upgrades);
    expect(restored.prestige).toEqual(rich.prestige);
    expect(restored.achievements).toEqual(rich.achievements);
    expect(restored.unlocks).toEqual(rich.unlocks);
    expect(restored.orders.completedCount).toBe(12);
    expect(restored.clickCount).toBe(54321);
  });

  it('시각은 밀리초까지 복원된다', () => {
    const restored = roundTrip(rich);
    expect(restored.createdAt).toBe(rich.createdAt);
    expect(restored.lastActiveAt).toBe(rich.lastActiveAt);
    expect(restored.offline.lastCalculatedAt).toBe(rich.offline.lastCalculatedAt);
  });

  it('체크섬은 같은 상태에서 같고 값이 바뀌면 달라진다', () => {
    expect(computeChecksum(rich)).toBe(computeChecksum(roundTrip(rich)));

    // 주의: 1.2345e42 에 1을 더해도 유효자릿수 안에서 값이 변하지 않으므로
    // 체크섬도 같다. 큰 수 구간에서는 배율 수준의 변화만 감지된다.
    expect(computeChecksum(rich)).toBe(computeChecksum({ ...rich, ember: rich.ember.add(1) }));

    expect(computeChecksum(rich)).not.toBe(computeChecksum({ ...rich, ember: rich.ember.mul(2) }));
    expect(computeChecksum(rich)).not.toBe(computeChecksum({ ...rich, clickCount: 54322 }));
    expect(computeChecksum(rich)).not.toBe(
      computeChecksum({ ...rich, upgrades: { ...rich.upgrades, apprentice: 138 } }),
    );
  });
});

describe('저장 검증 (계획서 8.4)', () => {
  const validSave = () => JSON.parse(JSON.stringify(toSaveData(rich)));

  it('정상 저장본은 통과한다', () => {
    expect(validateSaveData(validSave()).valid).toBe(true);
  });

  it('객체가 아니면 거절한다', () => {
    for (const value of [null, undefined, 'save', 42, []]) {
      expect(validateSaveData(value).valid).toBe(false);
    }
  });

  it('필수 필드가 없으면 거절한다', () => {
    const save = validSave();
    delete save.economy;
    expect(validateSaveData(save).valid).toBe(false);
  });

  it('큰 수 문자열 형식이 깨지면 거절한다', () => {
    const save = validSave();
    save.economy.ember = '1.2.3e4';
    const result = validateSaveData(save);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('큰 수 문자열 형식');
  });

  it('숫자를 문자열이 아닌 채로 저장하면 거절한다', () => {
    const save = validSave();
    save.economy.lifetimeEmber = 12345;
    expect(validateSaveData(save).valid).toBe(false);
  });

  it('음수일 수 없는 값이 음수면 거절한다', () => {
    const save = validSave();
    save.economy.ember = '-5';
    expect(validateSaveData(save).valid).toBe(false);
  });

  it('알 수 없는 업그레이드 id를 거절한다', () => {
    const save = validSave();
    save.upgrades.mystery_machine = 3;
    expect(validateSaveData(save).valid).toBe(false);
  });

  it('최대 레벨을 넘는 수량을 거절한다', () => {
    const save = validSave();
    save.upgrades.master_anvil = 26; // 최대 25
    expect(validateSaveData(save).valid).toBe(false);
  });

  it('환생 강화 단계가 범위를 벗어나면 거절한다', () => {
    const save = validSave();
    save.prestige.permanentSkills.night_shift = 11; // 최대 10
    expect(validateSaveData(save).valid).toBe(false);
  });

  it('미래 저장 버전은 거절한다 (구버전 앱이 새 저장본을 덮어쓰지 않게)', () => {
    const save = validSave();
    save.saveVersion = SAVE_VERSION + 1;
    expect(validateSaveData(save).valid).toBe(false);
  });

  it('날짜 형식이 깨지면 거절한다', () => {
    const save = validSave();
    save.profile.lastActiveAt = '어제';
    expect(validateSaveData(save).valid).toBe(false);
  });

  it('검증에 실패하면 상태를 만들지 않는다', () => {
    const save = validSave();
    save.economy.ember = 'not-a-number';
    const result = fromSaveData(save);
    expect(result.state).toBeNull();
    expect(result.validation.valid).toBe(false);
  });
});
