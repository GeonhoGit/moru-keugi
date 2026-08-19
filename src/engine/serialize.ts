/**
 * 저장 데이터 직렬화와 검증 (계획서 8.1 / 8.4).
 *
 * 여기까지가 엔진의 책임이다. AsyncStorage 접근, 이중 백업, 마이그레이션 실행은
 * Phase 3의 `storage/` 어댑터가 이 함수들을 호출해서 처리한다.
 * 큰 수는 반드시 문자열로 저장하고, 읽을 때 형식을 검증한다.
 */
import { big, fromSaveString, isValidBigString, toSaveString, ZERO } from './bignum';
import { SAVE_VERSION } from '../data/balance';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { PRESTIGE_SKILL_BY_ID } from '../data/prestigeSkills';
import { ACHIEVEMENT_BY_ID } from '../data/achievements';
import { ORDER_BY_ID } from '../data/orders';
import { DEFAULT_SETTINGS } from './state';
import type { AchievementState, GameSettings, GameState, OrderSlotState } from '../types/index';

export interface SaveData {
  saveVersion: number;
  profile: { createdAt: string; lastActiveAt: string; locale: string };
  economy: { ember: string; lifetimeEmber: string; runLifetimeEmber: string; clickCount: string };
  upgrades: Record<string, number>;
  prestige: { count: number; masterSeals: number; permanentSkills: Record<string, number> };
  orders: {
    slots: { orderId: string; startedAt: number | null; claimed: boolean }[];
    completedOrderIds: string[];
    completedCount: number;
  };
  achievements: Record<string, AchievementState>;
  unlocks: string[];
  tutorialStep: number;
  settings: GameSettings;
  offline: { lastCalculatedAt: string; lastClaimId?: string; timeAnomalyCount: number };
  integrity: { savedAt: string; checksum?: string };
}

// ---------------------------------------------------------------------------
// 직렬화
// ---------------------------------------------------------------------------

export const toSaveData = (state: GameState, savedAtMs: number = Date.now()): SaveData => ({
  saveVersion: SAVE_VERSION,
  profile: {
    createdAt: new Date(state.createdAt).toISOString(),
    lastActiveAt: new Date(state.lastActiveAt).toISOString(),
    locale: state.settings.locale,
  },
  economy: {
    ember: toSaveString(state.ember),
    lifetimeEmber: toSaveString(state.lifetimeEmber),
    runLifetimeEmber: toSaveString(state.runLifetimeEmber),
    clickCount: String(state.clickCount),
  },
  upgrades: { ...state.upgrades },
  prestige: {
    count: state.prestige.count,
    masterSeals: state.prestige.masterSeals,
    permanentSkills: { ...state.prestige.permanentSkills },
  },
  orders: {
    slots: state.orders.slots.map((slot) => ({ ...slot })),
    completedOrderIds: [...state.orders.completedOrderIds],
    completedCount: state.orders.completedCount,
  },
  achievements: { ...state.achievements },
  unlocks: [...state.unlocks],
  tutorialStep: state.tutorialStep,
  settings: { ...state.settings },
  offline: {
    lastCalculatedAt: new Date(state.offline.lastCalculatedAt).toISOString(),
    ...(state.offline.lastClaimId ? { lastClaimId: state.offline.lastClaimId } : {}),
    timeAnomalyCount: state.offline.timeAnomalyCount,
  },
  integrity: { savedAt: new Date(savedAtMs).toISOString(), checksum: computeChecksum(state) },
});

/**
 * 저장 무결성 확인용 체크섬. 암호학적 용도가 아니라
 * "필드가 통째로 날아가거나 잘린 저장본"을 걸러내기 위한 값이다.
 */
export const computeChecksum = (state: GameState): string => {
  const payload = [
    toSaveString(state.ember),
    toSaveString(state.lifetimeEmber),
    toSaveString(state.runLifetimeEmber),
    String(state.clickCount),
    Object.entries(state.upgrades)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, count]) => `${id}:${count}`)
      .join(','),
    String(state.prestige.count),
    String(state.prestige.masterSeals),
  ].join('|');

  let hash = 5381;
  for (let index = 0; index < payload.length; index += 1) {
    hash = ((hash << 5) + hash + payload.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(16);
};

// ---------------------------------------------------------------------------
// 검증 (계획서 8.4)
// ---------------------------------------------------------------------------

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIsoDate = (value: unknown): boolean =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * 저장 데이터가 읽을 수 있는 형태인지 검사한다.
 * 실패하면 `storage/` 어댑터가 직전 백업을 복원하고 `save_recovered` 이벤트를 남긴다.
 */
export const validateSaveData = (raw: unknown): ValidationResult => {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(message);

  if (!isPlainObject(raw)) return { valid: false, errors: ['저장 데이터가 객체가 아닙니다.'] };

  // 저장 버전
  if (!isNonNegativeInteger(raw.saveVersion)) fail('saveVersion이 없거나 정수가 아닙니다.');
  else if (raw.saveVersion > SAVE_VERSION) fail(`알 수 없는 저장 버전입니다: ${raw.saveVersion}`);

  // 재화 — 큰 수 문자열 형식과 음수 여부
  if (!isPlainObject(raw.economy)) fail('economy 필드가 없습니다.');
  else {
    for (const key of ['ember', 'lifetimeEmber', 'runLifetimeEmber'] as const) {
      const value = raw.economy[key];
      if (!isValidBigString(value)) fail(`economy.${key}의 큰 수 문자열 형식이 올바르지 않습니다.`);
      else if (big(value).sign() < 0) fail(`economy.${key}는 음수일 수 없습니다.`);
    }
    const clickCount = Number(raw.economy.clickCount);
    if (!Number.isFinite(clickCount) || clickCount < 0) fail('economy.clickCount가 올바르지 않습니다.');
  }

  // 업그레이드 — 알 수 없는 id, 음수 수량, 최대 레벨 초과
  if (!isPlainObject(raw.upgrades)) fail('upgrades 필드가 없습니다.');
  else {
    for (const [id, count] of Object.entries(raw.upgrades)) {
      const definition = UPGRADE_BY_ID.get(id);
      if (!definition) {
        fail(`알 수 없는 업그레이드 id: ${id}`);
        continue;
      }
      if (!isNonNegativeInteger(count)) fail(`upgrades.${id} 수량이 0 이상 정수가 아닙니다.`);
      else if (definition.maxLevel !== undefined && count > definition.maxLevel) {
        fail(`upgrades.${id} 수량이 최대 레벨(${definition.maxLevel})을 넘습니다.`);
      }
    }
  }

  // 환생
  if (!isPlainObject(raw.prestige)) fail('prestige 필드가 없습니다.');
  else {
    if (!isNonNegativeInteger(raw.prestige.count)) fail('prestige.count가 올바르지 않습니다.');
    if (!isNonNegativeInteger(raw.prestige.masterSeals)) fail('prestige.masterSeals가 올바르지 않습니다.');
    if (!isPlainObject(raw.prestige.permanentSkills)) fail('prestige.permanentSkills가 없습니다.');
    else {
      for (const [id, level] of Object.entries(raw.prestige.permanentSkills)) {
        const skill = PRESTIGE_SKILL_BY_ID.get(id);
        if (!skill) fail(`알 수 없는 환생 강화 id: ${id}`);
        else if (!isNonNegativeInteger(level) || level > skill.maxLevel) {
          fail(`prestige.permanentSkills.${id} 단계가 범위를 벗어났습니다.`);
        }
      }
    }
  }

  // 주문
  if (!isPlainObject(raw.orders)) fail('orders 필드가 없습니다.');
  else {
    if (!Array.isArray(raw.orders.slots)) fail('orders.slots가 배열이 아닙니다.');
    else {
      for (const slot of raw.orders.slots) {
        if (!isPlainObject(slot) || typeof slot.orderId !== 'string') {
          fail('orders.slots 항목 형식이 올바르지 않습니다.');
          continue;
        }
        if (!ORDER_BY_ID.has(slot.orderId)) fail(`알 수 없는 주문 id: ${slot.orderId}`);
        if (slot.startedAt !== null && !isNonNegativeInteger(slot.startedAt)) {
          fail(`orders.slots.${slot.orderId}.startedAt이 올바르지 않습니다.`);
        }
      }
    }
    if (!isNonNegativeInteger(raw.orders.completedCount)) fail('orders.completedCount가 올바르지 않습니다.');
  }

  // 업적
  if (!isPlainObject(raw.achievements)) fail('achievements 필드가 없습니다.');
  else {
    for (const id of Object.keys(raw.achievements)) {
      if (!ACHIEVEMENT_BY_ID.has(id)) fail(`알 수 없는 업적 id: ${id}`);
    }
  }

  // 날짜
  if (!isPlainObject(raw.profile)) fail('profile 필드가 없습니다.');
  else if (!isIsoDate(raw.profile.createdAt) || !isIsoDate(raw.profile.lastActiveAt)) {
    fail('profile의 날짜 형식이 올바르지 않습니다.');
  }
  if (!isPlainObject(raw.offline)) fail('offline 필드가 없습니다.');
  else if (!isIsoDate(raw.offline.lastCalculatedAt)) {
    fail('offline.lastCalculatedAt의 날짜 형식이 올바르지 않습니다.');
  }

  return { valid: errors.length === 0, errors };
};

// ---------------------------------------------------------------------------
// 역직렬화
// ---------------------------------------------------------------------------

export interface LoadResult {
  readonly state: GameState | null;
  readonly validation: ValidationResult;
}

/**
 * 검증을 통과한 저장 데이터를 상태로 되돌린다.
 * 검증에 실패하면 `state`가 null이며, 호출자는 백업 복원 경로로 넘어가야 한다.
 */
export const fromSaveData = (raw: unknown): LoadResult => {
  const validation = validateSaveData(raw);
  if (!validation.valid) return { state: null, validation };

  const data = raw as unknown as SaveData;

  const settings: GameSettings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
  const slots: OrderSlotState[] = (data.orders.slots ?? []).map((slot) => ({
    orderId: slot.orderId,
    startedAt: slot.startedAt ?? null,
    claimed: Boolean(slot.claimed),
  }));

  return {
    state: {
      ember: fromSaveString(data.economy.ember) ?? ZERO,
      lifetimeEmber: fromSaveString(data.economy.lifetimeEmber) ?? ZERO,
      runLifetimeEmber: fromSaveString(data.economy.runLifetimeEmber) ?? ZERO,
      clickCount: Number(data.economy.clickCount) || 0,
      upgrades: { ...data.upgrades },
      prestige: {
        count: data.prestige.count,
        masterSeals: data.prestige.masterSeals,
        permanentSkills: { ...data.prestige.permanentSkills },
      },
      orders: {
        slots,
        completedOrderIds: [...(data.orders.completedOrderIds ?? [])],
        completedCount: data.orders.completedCount ?? 0,
      },
      achievements: { ...data.achievements },
      unlocks: [...(data.unlocks ?? [])],
      tutorialStep: Number.isInteger(data.tutorialStep) ? data.tutorialStep : 0,
      settings,
      offline: {
        lastCalculatedAt: Date.parse(data.offline.lastCalculatedAt),
        lastClaimId: data.offline.lastClaimId ?? null,
        timeAnomalyCount: data.offline.timeAnomalyCount ?? 0,
      },
      createdAt: Date.parse(data.profile.createdAt),
      lastActiveAt: Date.parse(data.profile.lastActiveAt),
    },
    validation,
  };
};
