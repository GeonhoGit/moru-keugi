/**
 * 플랫폼 서비스 (계획서 3.4).
 *
 * "광고·결제·분석은 인터페이스를 먼저 만들고 V1.0에서는 비활성 구현체를 사용한다."
 * 사운드와 햅틱도 같은 방식으로 인터페이스만 두고, 실제 네이티브 모듈 연결은
 * Development Build와 실기기에서 검증하는 Phase 4에서 붙인다.
 */

// ---------------------------------------------------------------------------
// 분석 (계획서 15.1)
// ---------------------------------------------------------------------------

export type AnalyticsEventName =
  | 'tutorial_started'
  | 'tutorial_step_completed'
  | 'tutorial_completed'
  | 'first_hit'
  | 'first_upgrade'
  | 'first_auto_production'
  | 'order_started'
  | 'order_completed'
  | 'offline_reward_shown'
  | 'offline_reward_claimed'
  | 'prestige_unlocked'
  | 'prestige_completed'
  | 'achievement_unlocked'
  | 'save_recovered'
  | 'save_migration_failed'
  | 'save_corrupted';

export interface AnalyticsService {
  track(name: AnalyticsEventName, payload?: Record<string, string | number | boolean>): void;
}

/**
 * V1.0 기본 구현. 공급자를 정하기 전까지 개발 빌드에서만 콘솔로 흘린다.
 * 계획서 15.3에 따라 임의 생성 ID 외의 개인정보는 넣지 않는다.
 */
export const createConsoleAnalytics = (enabled: boolean): AnalyticsService => ({
  track(name, payload) {
    if (!enabled) return;
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${name}`, payload ?? {});
  },
});

export const noopAnalytics: AnalyticsService = { track: () => undefined };

// ---------------------------------------------------------------------------
// 햅틱 (계획서 13.3)
// ---------------------------------------------------------------------------

export type HapticStrength = 'light' | 'medium' | 'heavy' | 'success';

export interface HapticsService {
  trigger(strength: HapticStrength): void;
}

/** Phase 4에서 expo-haptics를 붙일 자리. 설정에서 끌 수 있어야 한다. */
export const noopHaptics: HapticsService = { trigger: () => undefined };

// ---------------------------------------------------------------------------
// 사운드 (계획서 13.1 / 13.2)
// ---------------------------------------------------------------------------

export type SoundId =
  | 'anvil_hit'
  | 'upgrade_purchase'
  | 'order_complete'
  | 'achievement'
  | 'prestige'
  | 'offline_reward'
  | 'button';

export interface SoundService {
  play(id: SoundId): void;
  setSfxVolume(volume: number): void;
  setBgmVolume(volume: number): void;
  /** 화로 티어에 맞춰 BGM을 크로스페이드로 바꾼다 */
  setForgeTier(tier: number): void;
  pauseAll(): void;
  resumeAll(): void;
}

export const noopSound: SoundService = {
  play: () => undefined,
  setSfxVolume: () => undefined,
  setBgmVolume: () => undefined,
  setForgeTier: () => undefined,
  pauseAll: () => undefined,
  resumeAll: () => undefined,
};

// ---------------------------------------------------------------------------
// 광고·결제 (계획서 10.4 / 10.5)
// ---------------------------------------------------------------------------

/**
 * V1.0은 광고를 전혀 쓰지 않는다. 인터페이스만 두어 V1.1에서 선택형 보상 광고를
 * 붙일 때 화면 코드를 고치지 않도록 한다.
 */
export interface AdsService {
  isRewardedAvailable(): boolean;
  showRewarded(): Promise<{ completed: boolean }>;
}

export const disabledAds: AdsService = {
  isRewardedAvailable: () => false,
  showRewarded: async () => ({ completed: false }),
};

/** V1.0은 결제가 없다. 구매 검증은 V1.2 서버와 함께 들어온다. */
export interface PurchaseService {
  isAvailable(): boolean;
}

export const disabledPurchases: PurchaseService = { isAvailable: () => false };
