/**
 * 게임 상태 저장소.
 *
 * React에 의존하지 않는 순수 저장소라 테스트에서 그대로 돌릴 수 있다.
 * 화면은 필요한 값만 구독하므로, 타격할 때마다 전체 화면이 다시 그려지지 않는다
 * (계획서 13.4).
 *
 * 저장 시점 판단은 `storage/autosave.ts`가, 저장 절차는 `storage/saveManager.ts`가
 * 맡는다. 이 파일은 둘을 게임 흐름에 연결하는 역할만 한다.
 */
import {
  claimAchievement as claimAchievementAction,
  claimOfflineReward,
  calculateOfflineReward,
  claimOrder as claimOrderAction,
  createInitialState,
  getForgeTier,
  markOfflineCheckpoint,
  performClick,
  performPrestige,
  purchasePrestigeSkill,
  purchaseUpgrade,
  refreshOrderSlots,
  startOrder as startOrderAction,
  tick,
} from '../engine/index';
import { advanceTutorial, completeTutorial } from '../data/tutorial';
import {
  createAutosaveController,
  loadGame,
  resetSavedGame,
  saveGame,
  type SaveTrigger,
  type StorageAdapter,
} from '../storage/index';
import type {
  AnalyticsService,
  HapticsService,
  HapticStrength,
  SoundId,
  SoundService,
} from '../services/index';
import { noopAnalytics, noopHaptics, noopSound } from '../services/index';
import type {
  GameSettings,
  GameState,
  OfflineReport,
  PurchaseMode,
} from '../types/index';

export type StorePhase = 'loading' | 'ready' | 'corrupted';

export interface StoreSnapshot {
  readonly state: GameState;
  readonly phase: StorePhase;
  /** 백업에서 복구했는지. 화면이 복구 안내를 띄우는 데 쓴다 (계획서 8.6). */
  readonly recoveredFromBackup: boolean;
  /** 수령을 기다리는 오프라인 보상. 없으면 null. */
  readonly pendingOffline: OfflineReport | null;
  /** 마지막 저장이 실패했는지. 화면이 경고를 띄울 수 있다. */
  readonly lastSaveFailed: boolean;
  /**
   * 화면이 "지금"으로 삼아야 할 시각.
   *
   * 화면 선택자가 `Date.now()`를 직접 부르면 안 된다. `useSyncExternalStore`는
   * `getSnapshot`이 같은 스냅샷에서 같은 값을 돌려주기를 요구하는데,
   * `Date.now()`는 부를 때마다 달라져 무한 렌더 루프에 빠진다.
   * (주문 제작을 시작하면 진행률이 계속 변해 실제로 앱이 죽었다.)
   */
  readonly nowMs: number;
}

export interface GameStoreOptions {
  readonly adapter: StorageAdapter;
  readonly analytics?: AnalyticsService;
  readonly haptics?: HapticsService;
  readonly sound?: SoundService;
  readonly now?: () => number;
  /** 게임 루프 간격. 기본 100ms = 초당 10회. */
  readonly tickIntervalMs?: number;
}

export interface GameStore {
  getSnapshot(): StoreSnapshot;
  subscribe(listener: () => void): () => void;

  /** 저장본을 읽어 상태를 세운다. 앱 시작 시 한 번 호출한다. */
  initialize(): Promise<void>;
  /** 게임 루프를 시작한다. */
  start(): void;
  stop(): void;

  click(): void;
  buyUpgrade(upgradeId: string, mode: PurchaseMode): void;
  startOrder(orderId: string): void;
  claimOrder(orderId: string): void;
  claimAchievement(achievementId: string): void;
  buyPrestigeSkill(skillId: string): void;
  prestige(): void;
  updateSettings(patch: Partial<GameSettings>): void;
  dismissTutorial(): void;

  claimPendingOffline(): void;
  dismissPendingOffline(): void;

  /** 백그라운드 전환 시 호출. 즉시 저장하고 오프라인 기준 시각을 찍는다. */
  handleBackground(): Promise<void>;
  /** 포그라운드 복귀 시 호출. 오프라인 보상을 계산해 대기시킨다. */
  handleForeground(): Promise<void>;

  /** 손상된 저장본에서 새로 시작한다 (계획서 8.6). */
  startFresh(): Promise<void>;
  /** 설정 화면의 데이터 초기화. */
  resetGame(): Promise<void>;
}

export const createGameStore = (options: GameStoreOptions): GameStore => {
  const now = options.now ?? (() => Date.now());
  const analytics = options.analytics ?? noopAnalytics;
  const hapticsService = options.haptics ?? noopHaptics;
  const soundService = options.sound ?? noopSound;
  const tickIntervalMs = options.tickIntervalMs ?? 100;

  let snapshot: StoreSnapshot = {
    state: createInitialState(now()),
    phase: 'loading',
    recoveredFromBackup: false,
    pendingOffline: null,
    lastSaveFailed: false,
    nowMs: now(),
  };

  const listeners = new Set<() => void>();
  const autosave = createAutosaveController(now());
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastTickAt = now();
  /** 저장이 겹치지 않도록 직렬화한다. */
  let savePromise: Promise<unknown> = Promise.resolve();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  /** 설정에서 햅틱을 끄면 아무것도 울리지 않는다 (계획서 13.3). */
  const haptic = (strength: HapticStrength) => {
    if (!snapshot.state.settings.hapticsEnabled) return;
    hapticsService.trigger(strength);
  };

  /** 효과음 음량이 0이면 재생하지 않는다 (계획서 13.2). */
  const sound = (id: SoundId) => {
    if (snapshot.state.settings.sfxVolume <= 0) return;
    soundService.play(id);
  };

  /**
   * 화로 티어가 바뀌면 배경 음악을 그 단계로 넘긴다 (계획서 13.2).
   * 실제 크로스페이드는 사운드 서비스가 맡고, 여기서는 "언제 바뀌었는지"만 알려준다.
   */
  let lastForgeTier: number | null = null;
  const syncForgeTier = () => {
    const tier = getForgeTier(snapshot.state.lifetimeEmber).tier;
    if (tier === lastForgeTier) return;
    lastForgeTier = tier;
    soundService.setForgeTier(tier);
  };

  const setSnapshot = (patch: Partial<StoreSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    emit();
  };

  /** 상태를 바꾸고, 튜토리얼 진행을 확인하고, 필요하면 저장한다. */
  const commit = (next: GameState, trigger: SaveTrigger) => {
    const withTutorial = advanceTutorial(next);
    const at = now();
    snapshot = { ...snapshot, state: withTutorial, nowMs: at };
    syncForgeTier();
    emit();

    if (autosave.shouldSave(trigger, at)) {
      queueSave(at);
    }
  };

  const queueSave = (at: number) => {
    savePromise = savePromise
      .then(async () => {
        const result = await saveGame(options.adapter, snapshot.state, at);
        if (result.outcome === 'ok') {
          autosave.markSaved(at);
          if (snapshot.lastSaveFailed) setSnapshot({ lastSaveFailed: false });
        } else if (!snapshot.lastSaveFailed) {
          setSnapshot({ lastSaveFailed: true });
        }
      })
      .catch(() => {
        setSnapshot({ lastSaveFailed: true });
      });
  };

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async initialize() {
      const loaded = await loadGame(options.adapter);
      for (const event of loaded.events) analytics.track(event.name, { reason: event.reason });

      if (loaded.state) {
        const report = calculateOfflineReward(loaded.state, now());
        const showOffline = report.finalReward.sign() > 0 && report.creditedSeconds >= 60;
        if (showOffline) analytics.track('offline_reward_shown');

        snapshot = {
          state: refreshOrderSlots(loaded.state),
          phase: 'ready',
          recoveredFromBackup: loaded.recovered,
          pendingOffline: showOffline ? report : null,
          lastSaveFailed: false,
          nowMs: now(),
        };
        lastTickAt = now();
        soundService.setSfxVolume(snapshot.state.settings.sfxVolume);
        soundService.setBgmVolume(snapshot.state.settings.bgmVolume);
        syncForgeTier();
        emit();
        return;
      }

      // 저장본이 없으면 새 게임, 손상됐으면 화면이 선택지를 보여 준다.
      const corrupted = loaded.errors.length > 0;
      if (!corrupted) analytics.track('tutorial_started');

      snapshot = {
        state: createInitialState(now()),
        phase: corrupted ? 'corrupted' : 'ready',
        recoveredFromBackup: false,
        pendingOffline: null,
        lastSaveFailed: false,
        nowMs: now(),
      };
      lastTickAt = now();
      if (!corrupted) {
        soundService.setBgmVolume(snapshot.state.settings.bgmVolume);
        syncForgeTier();
      }
      emit();
    },

    start() {
      if (timer !== null) return;
      lastTickAt = now();
      timer = setInterval(() => {
        if (snapshot.phase !== 'ready') return;
        const at = now();
        const deltaSeconds = (at - lastTickAt) / 1000;
        lastTickAt = at;
        if (deltaSeconds <= 0) return;

        const next = advanceTutorial(tick(snapshot.state, deltaSeconds, at));
        snapshot = { ...snapshot, state: next, nowMs: at };
        syncForgeTier();
        emit();

        if (autosave.shouldSave('interval', at)) queueSave(at);
      }, tickIntervalMs);
    },

    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },

    click() {
      if (snapshot.phase !== 'ready') return;
      const at = now();
      const wasFirstClick = snapshot.state.clickCount === 0;
      const result = performClick(snapshot.state, at);
      haptic('light');
      sound('anvil_hit');
      if (wasFirstClick) analytics.track('first_hit');
      // 타격은 초당 수십 번 들어오므로 주기 저장에 맡긴다.
      commit(result.state, 'interval');
    },

    buyUpgrade(upgradeId, mode) {
      if (snapshot.phase !== 'ready') return;
      const wasFirstUpgrade = Object.values(snapshot.state.upgrades).every((count) => !count);
      const result = purchaseUpgrade(snapshot.state, upgradeId, mode);
      if (!result.purchased) return;
      haptic('success');
      sound('upgrade_purchase');
      if (wasFirstUpgrade) analytics.track('first_upgrade', { upgrade_id: upgradeId });
      commit(result.state, 'upgrade-purchased');
    },

    startOrder(orderId) {
      if (snapshot.phase !== 'ready') return;
      const result = startOrderAction(snapshot.state, orderId, now());
      if (!result.started) return;
      sound('button');
      analytics.track('order_started', { order_id: orderId });
      commit(result.state, 'order-changed');
    },

    claimOrder(orderId) {
      if (snapshot.phase !== 'ready') return;
      const result = claimOrderAction(snapshot.state, orderId, now());
      if (!result.claimed) return;
      haptic('success');
      sound('order_complete');
      analytics.track('order_completed', { order_id: orderId });
      commit(result.state, 'order-changed');
    },

    claimAchievement(achievementId) {
      if (snapshot.phase !== 'ready') return;
      const result = claimAchievementAction(snapshot.state, achievementId);
      if (!result.claimed) return;
      haptic('success');
      sound('achievement');
      analytics.track('achievement_unlocked', { achievement_id: achievementId });
      commit(result.state, 'achievement-claimed');
    },

    buyPrestigeSkill(skillId) {
      if (snapshot.phase !== 'ready') return;
      const result = purchasePrestigeSkill(snapshot.state, skillId);
      if (!result.purchased) return;
      commit(result.state, 'prestige');
    },

    prestige() {
      if (snapshot.phase !== 'ready') return;
      const at = now();
      // 환생 실행 직전에 저장해 둔다 (계획서 12.4).
      queueSave(at);

      const result = performPrestige(snapshot.state, at);
      if (!result.performed) return;
      haptic('heavy');
      sound('prestige');
      analytics.track('prestige_completed', { seals_gained: result.sealsGained });
      commit(refreshOrderSlots(result.state), 'prestige');
    },

    updateSettings(patch) {
      commit(
        { ...snapshot.state, settings: { ...snapshot.state.settings, ...patch } },
        'settings-changed',
      );
      if (patch.sfxVolume !== undefined) soundService.setSfxVolume(patch.sfxVolume);
      if (patch.bgmVolume !== undefined) soundService.setBgmVolume(patch.bgmVolume);
    },

    dismissTutorial() {
      analytics.track('tutorial_completed');
      commit(completeTutorial(snapshot.state), 'settings-changed');
    },

    claimPendingOffline() {
      const report = snapshot.pendingOffline;
      if (!report) return;
      const result = claimOfflineReward(snapshot.state, report, now());
      sound('offline_reward');
      analytics.track('offline_reward_claimed', { reward: result.granted.toString() });
      snapshot = { ...snapshot, pendingOffline: null };
      commit(result.state, 'offline-claimed');
    },

    dismissPendingOffline() {
      if (!snapshot.pendingOffline) return;
      // 받지 않고 닫아도 보상은 사라지지 않는다. 기준 시각을 그대로 두면
      // 다음 복귀에 다시 계산된다.
      setSnapshot({ pendingOffline: null });
    },

    async handleBackground() {
      soundService.pauseAll();
      const at = now();
      snapshot = { ...snapshot, state: markOfflineCheckpoint(snapshot.state, at) };
      emit();
      queueSave(at);
      await savePromise;
    },

    async handleForeground() {
      soundService.resumeAll();
      if (snapshot.phase !== 'ready') return;
      const at = now();
      lastTickAt = at;
      const report = calculateOfflineReward(snapshot.state, at);
      if (report.finalReward.sign() > 0 && report.creditedSeconds >= 60) {
        analytics.track('offline_reward_shown');
        setSnapshot({ pendingOffline: report });
        return;
      }
      // 짧게 다녀온 경우엔 화면을 띄우지 않고 경과 시간만 생산에 반영한다.
      const produced = tick(snapshot.state, report.creditedSeconds, at);
      setSnapshot({ state: markOfflineCheckpoint(produced, at) });
    },

    async startFresh() {
      await resetSavedGame(options.adapter);
      snapshot = {
        state: createInitialState(now()),
        phase: 'ready',
        recoveredFromBackup: false,
        pendingOffline: null,
        lastSaveFailed: false,
        nowMs: now(),
      };
      lastTickAt = now();
      emit();
      queueSave(now());
      await savePromise;
    },

    async resetGame() {
      await this.startFresh();
    },
  };
};
