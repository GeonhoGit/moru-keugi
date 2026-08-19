/**
 * 저장 시점 관리 (계획서 8.2).
 *
 * 저장을 언제 부를지는 화면이 아니라 여기서 정한다.
 * 화면은 일어난 일을 알려 주기만 하고, 이 컨트롤러가 저장할지 말지를 판단한다.
 */
import { AUTOSAVE_INTERVAL_SECONDS } from '../data/balance';

/** 계획서 8.2가 나열한 저장 시점 */
export type SaveTrigger =
  | 'interval' // 15~30초 주기 자동 저장
  | 'upgrade-purchased' // 업그레이드 구매 직후
  | 'order-changed' // 주문 시작·완료·보상 수령 직후
  | 'achievement-claimed' // 업적 보상 수령 직후
  | 'prestige' // 환생 확인 직전과 완료 직후
  | 'background' // 앱 백그라운드 진입 시
  | 'settings-changed' // 설정 변경 시
  | 'offline-claimed'; // 오프라인 보상 수령 직후

/** 주기와 무관하게 즉시 저장해야 하는 시점 */
const IMMEDIATE_TRIGGERS: readonly SaveTrigger[] = [
  'upgrade-purchased',
  'order-changed',
  'achievement-claimed',
  'prestige',
  'background',
  'settings-changed',
  'offline-claimed',
];

export interface AutosaveController {
  /** 이 시점에 저장해야 하는지 판단한다. */
  shouldSave(trigger: SaveTrigger, nowMs: number): boolean;
  /** 저장에 성공했을 때 호출해 기준 시각을 갱신한다. */
  markSaved(nowMs: number): void;
  /** 마지막으로 저장한 시각 */
  getLastSavedAt(): number;
}

export const createAutosaveController = (
  startedAtMs: number,
  intervalSeconds: number = AUTOSAVE_INTERVAL_SECONDS,
): AutosaveController => {
  let lastSavedAt = startedAtMs;

  return {
    shouldSave(trigger, nowMs) {
      if (IMMEDIATE_TRIGGERS.includes(trigger)) return true;
      return nowMs - lastSavedAt >= intervalSeconds * 1000;
    },
    markSaved(nowMs) {
      lastSavedAt = nowMs;
    },
    getLastSavedAt() {
      return lastSavedAt;
    },
  };
};
