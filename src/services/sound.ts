/**
 * 효과음과 배경 음악 재생 (계획서 13.1 / 13.2 / 13.4).
 *
 * 음원은 `scripts/generate-sounds.mjs`와 `scripts/generate-music.mjs`가 직접 합성한 WAV다.
 * 외부 라이선스가 없고, 음색을 바꾸려면 그 스크립트의 숫자만 고치면 된다.
 *
 * 성능 원칙(13.4): 타격은 초당 수 회 들어온다. 재생기를 매번 새로 만들면
 * 소리가 겹겹이 쌓여 기기가 밀리므로, 소리마다 재생기를 하나만 두고
 * 되감아 다시 재생한다. 최소 간격도 둔다.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { SoundId, SoundService } from './index';

/**
 * 음원. `require`를 쓰는 것은 Metro가 에셋을 번들에 포함시키기 위해서다.
 * 경로가 정적이어야 하므로 변수로 만들 수 없다.
 */
const SOURCES: Record<SoundId, number> = {
  anvil_hit: require('../../assets/sounds/anvil_hit.wav'),
  upgrade_purchase: require('../../assets/sounds/upgrade_purchase.wav'),
  order_complete: require('../../assets/sounds/order_complete.wav'),
  achievement: require('../../assets/sounds/achievement.wav'),
  prestige: require('../../assets/sounds/prestige.wav'),
  offline_reward: require('../../assets/sounds/offline_reward.wav'),
  button: require('../../assets/sounds/button.wav'),
};

/** 화로 티어별 배경 음악 (계획서 13.2). 같은 곡에 악기를 얹은 4단계다. */
const MUSIC: readonly number[] = [
  require('../../assets/music/forge_tier_0.wav'),
  require('../../assets/music/forge_tier_1.wav'),
  require('../../assets/music/forge_tier_2.wav'),
  require('../../assets/music/forge_tier_3.wav'),
];

/** 소리마다 다시 울릴 수 있는 최소 간격(ms). 연타로 소리가 뭉개지는 것을 막는다. */
const MIN_INTERVAL_MS: Record<SoundId, number> = {
  anvil_hit: 45,
  upgrade_purchase: 80,
  order_complete: 200,
  achievement: 200,
  prestige: 500,
  offline_reward: 200,
  button: 60,
};

/** 티어가 바뀔 때 음악을 넘기는 시간. 즉시 끊지 않는다 (계획서 13.2). */
const CROSSFADE_MS = 1500;
const CROSSFADE_STEP_MS = 50;

export const createSoundService = (): SoundService => {
  const sfxPlayers = new Map<SoundId, AudioPlayer>();
  const lastPlayedAt = new Map<SoundId, number>();
  const musicPlayers = new Map<number, AudioPlayer>();

  let sfxVolume = 0.8;
  let bgmVolume = 0.5;
  let paused = false;
  let currentTier: number | null = null;
  let fadeTimer: ReturnType<typeof setInterval> | null = null;

  // 다른 앱의 음악을 끊지 않게 하고, 무음 스위치에서는 소리를 내지 않는다.
  void setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  }).catch(() => undefined);

  const safely = (action: () => void) => {
    try {
      action();
    } catch {
      // 소리는 보조 피드백이다. 실패해도 게임 흐름을 막지 않는다 (계획서 14).
    }
  };

  const getSfxPlayer = (id: SoundId): AudioPlayer | null => {
    const existing = sfxPlayers.get(id);
    if (existing) return existing;
    try {
      const player = createAudioPlayer(SOURCES[id]);
      player.volume = sfxVolume;
      sfxPlayers.set(id, player);
      return player;
    } catch {
      return null;
    }
  };

  /** 티어 음악 재생기. 필요할 때만 만든다 (4개를 미리 열어 두면 메모리가 아깝다). */
  const getMusicPlayer = (tier: number): AudioPlayer | null => {
    const existing = musicPlayers.get(tier);
    if (existing) return existing;
    const source = MUSIC[tier];
    if (source === undefined) return null;
    try {
      const player = createAudioPlayer(source);
      player.loop = true;
      player.volume = 0;
      musicPlayers.set(tier, player);
      return player;
    } catch {
      return null;
    }
  };

  const stopFade = () => {
    if (fadeTimer !== null) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  };

  /** 현재 티어 음악만 소리가 나게 하고 나머지는 멈춘다. */
  const settleTo = (tier: number | null) => {
    for (const [key, player] of musicPlayers) {
      safely(() => {
        if (key === tier && !paused && bgmVolume > 0) {
          player.volume = bgmVolume;
        } else {
          player.volume = 0;
          player.pause();
        }
      });
    }
  };

  const crossfadeTo = (tier: number) => {
    stopFade();

    const next = getMusicPlayer(tier);
    if (!next) return;

    const previousTier = currentTier;
    currentTier = tier;

    if (paused || bgmVolume <= 0) {
      // 꺼져 있으면 소리 없이 대상만 바꿔 둔다. 켜질 때 settleTo가 맞춘다.
      settleTo(tier);
      return;
    }

    safely(() => {
      next.volume = 0;
      next.play();
    });

    // 첫 재생이면 페이드 인만 하면 된다.
    const previous = previousTier === null ? null : (musicPlayers.get(previousTier) ?? null);
    const steps = Math.max(1, Math.floor(CROSSFADE_MS / CROSSFADE_STEP_MS));
    let step = 0;

    fadeTimer = setInterval(() => {
      step += 1;
      const ratio = Math.min(1, step / steps);

      safely(() => {
        next.volume = bgmVolume * ratio;
      });
      if (previous && previous !== next) {
        safely(() => {
          previous.volume = bgmVolume * (1 - ratio);
        });
      }

      if (ratio >= 1) {
        stopFade();
        settleTo(tier);
      }
    }, CROSSFADE_STEP_MS);
  };

  return {
    play(id) {
      if (paused || sfxVolume <= 0) return;

      const now = Date.now();
      const last = lastPlayedAt.get(id) ?? 0;
      if (now - last < MIN_INTERVAL_MS[id]) return;
      lastPlayedAt.set(id, now);

      const player = getSfxPlayer(id);
      if (!player) return;

      safely(() => {
        // 재생 중이면 처음으로 되감아 다시 울린다.
        void player.seekTo(0).catch(() => undefined);
        player.play();
      });
    },

    setSfxVolume(volume) {
      sfxVolume = Math.max(0, Math.min(1, volume));
      for (const player of sfxPlayers.values()) {
        safely(() => {
          player.volume = sfxVolume;
        });
      }
    },

    setBgmVolume(volume) {
      bgmVolume = Math.max(0, Math.min(1, volume));
      stopFade();

      if (bgmVolume > 0 && !paused && currentTier !== null) {
        const player = getMusicPlayer(currentTier);
        if (player) safely(() => player.play());
      }
      settleTo(currentTier);
    },

    setForgeTier(tier) {
      const clamped = Math.max(0, Math.min(MUSIC.length - 1, Math.floor(tier)));
      if (clamped === currentTier) return;
      crossfadeTo(clamped);
    },

    pauseAll() {
      paused = true;
      stopFade();
      settleTo(null);
    },

    resumeAll() {
      paused = false;
      if (currentTier === null || bgmVolume <= 0) return;
      const player = getMusicPlayer(currentTier);
      if (player) safely(() => player.play());
      settleTo(currentTier);
    },
  };
};
