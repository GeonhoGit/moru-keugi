/**
 * 효과음 호출 규칙 (계획서 13.1 / 13.2).
 *
 * 실제 소리는 실기기에서만 확인할 수 있으므로, "언제 어떤 소리를 부르고
 * 언제 부르지 않는지"만 검증한다. 설정에서 껐을 때 아예 부르지 않는 것이
 * 접근성 요건(14절 "햅틱·사운드 없이도 시각 피드백으로 성립")의 전제다.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryAdapter } from '../../storage/adapter';
import { createGameStore } from '../gameStore';
import type { SoundId, SoundService } from '../../services/index';

/** 계획서 13.1의 효과음 7종 */
const SFX_IDS: SoundId[] = [
  'anvil_hit',
  'upgrade_purchase',
  'order_complete',
  'achievement',
  'prestige',
  'offline_reward',
  'button',
];

const SOUND_DIR = join(process.cwd(), 'assets', 'sounds');
const MUSIC_DIR = join(process.cwd(), 'assets', 'music');
const MUSIC_TRACKS = ['forge_tier_0', 'forge_tier_1', 'forge_tier_2', 'forge_tier_3'];

const createSpySound = () => {
  const played: SoundId[] = [];
  const tiers: number[] = [];
  let sfxVolume: number | null = null;
  let bgmVolume: number | null = null;
  let paused = false;

  const service: SoundService = {
    play: (id) => {
      played.push(id);
    },
    setSfxVolume: (volume) => {
      sfxVolume = volume;
    },
    setBgmVolume: (volume) => {
      bgmVolume = volume;
    },
    setForgeTier: (tier) => {
      tiers.push(tier);
    },
    pauseAll: () => {
      paused = true;
    },
    resumeAll: () => {
      paused = false;
    },
  };

  return {
    service,
    played,
    tiers,
    getSfxVolume: () => sfxVolume,
    getBgmVolume: () => bgmVolume,
    isPaused: () => paused,
  };
};

const setup = async () => {
  const spy = createSpySound();
  const store = createGameStore({
    adapter: createMemoryAdapter(),
    sound: spy.service,
    now: () => 1_700_000_000_000,
  });
  await store.initialize();
  spy.played.length = 0;
  return { store, spy };
};

describe('효과음 호출 (계획서 13.1)', () => {
  it('타격은 모루 타격음을 낸다', async () => {
    const { store, spy } = await setup();
    store.click();
    expect(spy.played).toEqual(['anvil_hit']);
  });

  it('업그레이드 구매는 구매음을 낸다', async () => {
    const { store, spy } = await setup();
    for (let i = 0; i < 30; i += 1) store.click();
    spy.played.length = 0;

    store.buyUpgrade('iron_tongs', 1);
    expect(spy.played).toEqual(['upgrade_purchase']);
  });

  it('구매에 실패하면 소리가 나지 않는다', async () => {
    const { store, spy } = await setup();
    store.buyUpgrade('iron_tongs', 1); // 잉걸불 부족
    expect(spy.played).toEqual([]);
  });

  it('설정에서 효과음을 끄면 아무 소리도 나지 않는다', async () => {
    const { store, spy } = await setup();
    store.updateSettings({ sfxVolume: 0 });
    spy.played.length = 0;

    store.click();
    for (let i = 0; i < 30; i += 1) store.click();
    store.buyUpgrade('iron_tongs', 1);

    expect(spy.played).toEqual([]);
  });

  it('음량을 바꾸면 재생기에 즉시 전달된다', async () => {
    const { store, spy } = await setup();
    store.updateSettings({ sfxVolume: 0.3 });
    expect(spy.getSfxVolume()).toBe(0.3);
  });
});

describe('앱 생명주기 (계획서 13.2)', () => {
  it('백그라운드로 가면 소리를 멈추고 복귀하면 다시 켠다', async () => {
    const { store, spy } = await setup();

    await store.handleBackground();
    expect(spy.isPaused()).toBe(true);

    await store.handleForeground();
    expect(spy.isPaused()).toBe(false);
  });
});


describe('배경 음악 (계획서 13.2)', () => {
  it('시작할 때 현재 화로 티어를 알려준다', async () => {
    const spy = createSpySound();
    const store = createGameStore({
      adapter: createMemoryAdapter(),
      sound: spy.service,
      now: () => 1_700_000_000_000,
    });
    await store.initialize();

    // 새 게임은 티어 0에서 시작한다.
    expect(spy.tiers).toEqual([0]);
    expect(spy.getBgmVolume()).toBe(0.5);
  });

  it('화로 티어가 오르면 그 단계로 넘긴다', async () => {
    const { store, spy } = await setup();
    spy.tiers.length = 0;

    // 티어 1 기준(평생 누적 5만)을 넘긴다.
    for (let i = 0; i < 60_000; i += 1) store.click();

    expect(spy.tiers).toEqual([1]);
  });

  it('같은 티어 안에서는 계속 다시 알리지 않는다', async () => {
    const { store, spy } = await setup();
    spy.tiers.length = 0;

    for (let i = 0; i < 100; i += 1) store.click();

    // 티어가 그대로면 음악을 건드리지 않는다.
    expect(spy.tiers).toEqual([]);
  });

  it('BGM 음량을 바꾸면 즉시 전달된다', async () => {
    const { store, spy } = await setup();
    store.updateSettings({ bgmVolume: 0 });
    expect(spy.getBgmVolume()).toBe(0);
  });
});

describe('음원 파일 (직접 생성)', () => {
  it('계획서 13.1의 효과음 7종이 모두 있다', () => {
    for (const id of SFX_IDS) {
      expect(existsSync(join(SOUND_DIR, `${id}.wav`))).toBe(true);
    }
  });

  it('올바른 WAV 헤더를 가진다', () => {
    for (const id of SFX_IDS) {
      const buffer = readFileSync(join(SOUND_DIR, `${id}.wav`));
      expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(buffer.subarray(8, 12).toString('ascii')).toBe('WAVE');
      // 16비트 모노 PCM
      expect(buffer.readUInt16LE(20)).toBe(1);
      expect(buffer.readUInt16LE(22)).toBe(1);
      expect(buffer.readUInt16LE(34)).toBe(16);
    }
  });

  it('앱 크기를 위협하지 않을 만큼 작다', () => {
    let total = 0;
    for (const id of SFX_IDS) total += statSync(join(SOUND_DIR, `${id}.wav`)).size;
    // 7개 합쳐 200KB 미만
    expect(total).toBeLessThan(200 * 1024);
  });
});

describe('배경 음악 파일 (직접 생성)', () => {

  it('화로 4단계 음악이 모두 있다', () => {
    for (const name of MUSIC_TRACKS) {
      expect(existsSync(join(MUSIC_DIR, `${name}.wav`))).toBe(true);
    }
  });

  it('클리핑 없이 여유를 두고 만들어졌다', () => {
    for (const name of MUSIC_TRACKS) {
      const buffer = readFileSync(join(MUSIC_DIR, `${name}.wav`));
      const count = (buffer.length - 44) / 2;
      let peak = 0;
      // 전부 검사하면 느리므로 일정 간격으로 훑는다.
      for (let i = 0; i < count; i += 7) {
        const value = Math.abs(buffer.readInt16LE(44 + i * 2) / 32767);
        if (value > peak) peak = value;
      }
      expect(peak).toBeLessThanOrEqual(0.901);
    }
  });

  it('네 트랙의 길이가 같아 크로스페이드가 어긋나지 않는다', () => {
    const sizes = MUSIC_TRACKS.map((name) => statSync(join(MUSIC_DIR, `${name}.wav`)).size);
    expect(new Set(sizes).size).toBe(1);
  });

  it('음악까지 합쳐도 에셋이 4MB를 넘지 않는다', () => {
    let total = 0;
    for (const id of SFX_IDS) total += statSync(join(SOUND_DIR, `${id}.wav`)).size;
    for (const name of MUSIC_TRACKS) total += statSync(join(MUSIC_DIR, `${name}.wav`)).size;
    expect(total).toBeLessThan(4 * 1024 * 1024);
  });
});
