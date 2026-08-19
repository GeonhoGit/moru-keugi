import type { Big } from '../engine/bignum';

// ---------------------------------------------------------------------------
// 배율 계층 (계획서 6.3)
// ---------------------------------------------------------------------------

/**
 * 보너스가 쌓이는 계층. 같은 계층의 퍼센트 보너스는 먼저 더하고,
 * 서로 다른 계층은 곱한다.
 */
export type ModifierChannel =
  | 'global' // 전체 생산 배율
  | 'auto' // 자동 생산 배율
  | 'click' // 타격 배율
  | 'orderReward' // 주문 보상 배율
  | 'offline' // 오프라인 효율 배율
  | 'prestige'; // 환생 배율 (V1.0에서는 인장 강화가 개별 계층으로 들어가므로 1로 유지)

export const MODIFIER_CHANNELS: readonly ModifierChannel[] = [
  'global',
  'auto',
  'click',
  'orderReward',
  'offline',
  'prestige',
];

/** 하나의 보너스 기여. `amount`는 비율(0.05 = +5%)이다. */
export interface ModifierContribution {
  readonly channel: ModifierChannel;
  readonly amount: number;
  readonly sourceId: string;
}

/** 계층별 최종 배율. 각 값은 `1 + 해당 계층 보너스 합계`이다. */
export type ModifierSet = Readonly<Record<ModifierChannel, Big>>;

// ---------------------------------------------------------------------------
// 해금 조건
// ---------------------------------------------------------------------------

export type UnlockCondition =
  | { readonly kind: 'always' }
  | { readonly kind: 'upgradesOwned'; readonly requirements: readonly UpgradeRequirement[] }
  | { readonly kind: 'prestigeCount'; readonly count: number }
  | { readonly kind: 'lifetimeEmber'; readonly amount: string }
  | { readonly kind: 'autoRate'; readonly amount: string }
  | { readonly kind: 'clickCount'; readonly count: number }
  | { readonly kind: 'ordersCompleted'; readonly count: number }
  | { readonly kind: 'all'; readonly conditions: readonly UnlockCondition[] };

export interface UpgradeRequirement {
  readonly upgradeId: string;
  readonly count: number;
}

// ---------------------------------------------------------------------------
// 업그레이드 (계획서 5.2)
// ---------------------------------------------------------------------------

export type UpgradeType = 'auto' | 'click' | 'multiplier' | 'utility';
export type UpgradeTier = 'basic' | 'intermediate' | 'advanced' | 'legendary' | 'utility';

export interface MilestoneBonus {
  /** 이 보유 개수에 도달하면 */
  readonly atCount: number;
  /** 해당 업그레이드의 생산량에 곱해지는 배율 */
  readonly multiplier: number;
}

export interface UpgradeDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: UpgradeType;
  readonly tier: UpgradeTier;
  /** 큰 수 라이브러리 문자열 */
  readonly baseCost: string;
  readonly costGrowth: number;
  /**
   * `auto`  : 개당 초당 잉걸불 생산량
   * `click` : 개당 타격 추가 획득량
   * `multiplier` / `utility` : 사용하지 않음(0). `modifier` 필드를 사용한다.
   */
  readonly baseOutput: string;
  /** `multiplier` / `utility` 유형이 개당 제공하는 계층 보너스 */
  readonly modifier?: { readonly channel: ModifierChannel; readonly amountPerLevel: number };
  readonly unlockCondition: UnlockCondition;
  readonly milestoneBonuses: readonly MilestoneBonus[];
  readonly maxLevel?: number;
}

export type PurchaseMode = 1 | 10 | 'max';

export interface PurchasePlan {
  readonly upgradeId: string;
  /** 실제로 살 수 있는 개수. 0이면 구매 불가. */
  readonly count: number;
  /** `count`개를 살 때의 총비용 */
  readonly cost: Big;
  readonly affordable: boolean;
  /** 최대 레벨 때문에 요청 수량보다 줄어들었는지 */
  readonly cappedByMaxLevel: boolean;
}

// ---------------------------------------------------------------------------
// 주문 제작 (계획서 4.3)
// ---------------------------------------------------------------------------

export type OrderRewardKind = 'ember' | 'sealProgress' | 'cosmetic' | 'achievementProgress';

export interface OrderReward {
  readonly kind: OrderRewardKind;
  /** `ember`는 잉걸불 문자열, `sealProgress`는 인장 개수, 나머지는 해금 id */
  readonly value: string;
  readonly label: string;
}

export interface OrderDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** 제작 시작 시 즉시 차감되는 잉걸불 */
  readonly cost: string;
  /** 제작에 걸리는 시간(초) */
  readonly craftSeconds: number;
  readonly unlockCondition: UnlockCondition;
  readonly rewards: readonly OrderReward[];
}

export type OrderStatus = 'locked' | 'available' | 'crafting' | 'ready' | 'completed';

export interface OrderSlotState {
  readonly orderId: string;
  /** 제작을 시작한 시각(epoch ms). 시작하지 않았으면 null */
  readonly startedAt: number | null;
  readonly claimed: boolean;
}

export interface OrderSaveState {
  /** V1.0은 고정 주문 목록을 순환하므로 활성 슬롯 3개만 보관한다. */
  readonly slots: readonly OrderSlotState[];
  /** 이번 순환에서 완료한 주문. 목록을 다 돌면 비워져 다시 순환한다. */
  readonly completedOrderIds: readonly string[];
  /** 환생·순환과 무관한 평생 주문 완료 수. 업적 판정에 사용한다. */
  readonly completedCount: number;
}

// ---------------------------------------------------------------------------
// 업적 (계획서 4.2)
// ---------------------------------------------------------------------------

export interface AchievementDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly condition: UnlockCondition;
  /** 보상 수령 시 지급되는 잉걸불 */
  readonly emberReward?: string;
  /** 보상 수령 시 영구 적용되는 계층 보너스 */
  readonly modifier?: { readonly channel: ModifierChannel; readonly amount: number };
}

export interface AchievementState {
  readonly unlocked: boolean;
  readonly claimed: boolean;
  readonly unlockedAt: string | null;
}

// ---------------------------------------------------------------------------
// 환생 (계획서 6.4)
// ---------------------------------------------------------------------------

export interface PrestigeSkillDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly channel: ModifierChannel;
  readonly amountPerLevel: number;
  readonly maxLevel: number;
  /** `level`단계를 살 때 드는 인장 개수 */
  readonly costForLevel: (level: number) => number;
}

export interface PrestigePreview {
  /** 지금 환생하면 얻는 인장 */
  readonly sealsGained: number;
  readonly canPrestige: boolean;
  /** 초기화되는 항목 요약 */
  readonly resets: readonly string[];
  /** 유지되는 항목 요약 */
  readonly keeps: readonly string[];
  /** 환생 후 인장을 그대로 둔 상태의 예상 초당 생산량 */
  readonly projectedAutoRate: Big;
}

// ---------------------------------------------------------------------------
// 화로 티어 (계획서 6.1)
// ---------------------------------------------------------------------------

export interface ForgeTierDefinition {
  readonly tier: number;
  readonly name: string;
  /** 평생 누적 잉걸불 기준 */
  readonly threshold: string;
  readonly accentColor: string;
  readonly sceneId: string;
}

// ---------------------------------------------------------------------------
// 오프라인 (계획서 7)
// ---------------------------------------------------------------------------

export type OfflineAnomaly = 'none' | 'time-reversed' | 'capped' | 'repeated-time-change';

export interface OfflineReport {
  /** 실제로 보상에 사용된 초 */
  readonly creditedSeconds: number;
  /** 보정 전 경과 초 */
  readonly rawElapsedSeconds: number;
  readonly baseReward: Big;
  readonly efficiency: number;
  readonly finalReward: Big;
  readonly anomaly: OfflineAnomaly;
  readonly claimId: string;
}

// ---------------------------------------------------------------------------
// 게임 상태
// ---------------------------------------------------------------------------

export interface GameSettings {
  readonly numberFormat: 'short' | 'korean';
  readonly sfxVolume: number;
  readonly bgmVolume: number;
  readonly hapticsEnabled: boolean;
  readonly reduceMotion: boolean;
  readonly locale: string;
}

export interface GameState {
  readonly ember: Big;
  /** 환생해도 유지되는 평생 누적 잉걸불 (화로 티어 기준) */
  readonly lifetimeEmber: Big;
  /** 이번 생애 누적 잉걸불 (인장 계산 기준) */
  readonly runLifetimeEmber: Big;
  readonly clickCount: number;
  readonly upgrades: Readonly<Record<string, number>>;
  readonly prestige: {
    readonly count: number;
    readonly masterSeals: number;
    readonly permanentSkills: Readonly<Record<string, number>>;
  };
  readonly orders: OrderSaveState;
  readonly achievements: Readonly<Record<string, AchievementState>>;
  readonly unlocks: readonly string[];
  /** 튜토리얼 진행 단계 (계획서 12.3). 0 = 시작 전, TUTORIAL_STEPS.length = 완료 */
  readonly tutorialStep: number;
  readonly settings: GameSettings;
  readonly offline: {
    readonly lastCalculatedAt: number;
    readonly lastClaimId: string | null;
    /** 시간 역행이 감지된 횟수. 반복 조작 감지에 사용한다. */
    readonly timeAnomalyCount: number;
  };
  readonly createdAt: number;
  readonly lastActiveAt: number;
}
