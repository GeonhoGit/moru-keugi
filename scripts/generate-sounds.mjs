/**
 * 효과음 직접 생성 (계획서 13.1 / 4.6).
 *
 * 도트 아트 방향에 맞춰 칩튠 계열 소리를 코드로 합성해 WAV로 굽는다.
 * 외주나 상용 팩 없이 만들 수 있고, 음색을 바꾸려면 이 파일의 숫자만 고치면 된다.
 * 라이선스 문제도 없다 (계획서 21 "그래픽·사운드 라이선스 확인").
 *
 *   node scripts/generate-sounds.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050; // 효과음에는 충분하고 파일이 작다
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

// ---------------------------------------------------------------------------
// 신디사이저 기본 요소
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

/** 사각파 — 8비트 게임 소리의 기본 음색 */
const square = (phase, duty = 0.5) => ((phase % 1) < duty ? 1 : -1);

/** 삼각파 — 사각파보다 부드럽다 */
const triangle = (phase) => {
  const p = phase % 1;
  return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
};

/** 결정적 잡음. 타격의 금속 파열음에 쓴다. 씨앗을 고정해 매번 같은 파일이 나온다. */
const makeNoise = (seed = 1) => {
  let state = seed >>> 0 || 1;
  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return (state / 0xffffffff) * 2 - 1;
  };
};

/** 지수 감쇠 엔벨로프. `attack` 동안 올라갔다가 서서히 사라진다. */
const envelope = (t, duration, attack = 0.005, curve = 5) => {
  if (t < 0 || t > duration) return 0;
  const attackGain = t < attack ? t / attack : 1;
  const decay = Math.exp((-curve * t) / duration);
  return attackGain * decay;
};

/**
 * 금속 막대를 때린 소리.
 * 배음이 정수배가 아닌 비조화 부분음이라 종·모루 같은 금속 느낌이 난다.
 */
const METAL_PARTIALS = [1, 2.76, 5.4, 8.93];

const metallic = (t, baseFreq, duration) => {
  let value = 0;
  METAL_PARTIALS.forEach((ratio, index) => {
    // 높은 부분음일수록 더 빨리 사라진다.
    const gain = envelope(t, duration, 0.001, 4 + index * 3) / (index + 1.5);
    value += Math.sin(TAU * baseFreq * ratio * t) * gain;
  });
  return value;
};

// ---------------------------------------------------------------------------
// WAV 쓰기 (16비트 모노 PCM)
// ---------------------------------------------------------------------------

const writeWav = (name, samples) => {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // fmt 청크 크기
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // 모노
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // 초당 바이트
  buffer.writeUInt16LE(2, 32); // 블록 정렬
  buffer.writeUInt16LE(16, 34); // 비트 깊이
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    // 클리핑을 막고 16비트 정수로 변환한다.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  const path = join(OUT_DIR, `${name}.wav`);
  writeFileSync(path, buffer);
  const ms = Math.round((samples.length / SAMPLE_RATE) * 1000);
  const kb = (buffer.length / 1024).toFixed(1);
  console.log(`  ${name}.wav — ${ms}ms, ${kb}KB`);
};

/** `duration`초 길이를 `fn(t)`로 채운다. 마지막 3ms는 페이드아웃해 딱 소리를 없앤다. */
const render = (duration, fn) => {
  const total = Math.floor(duration * SAMPLE_RATE);
  const fadeSamples = Math.floor(0.003 * SAMPLE_RATE);
  const samples = new Float32Array(total);

  for (let i = 0; i < total; i += 1) {
    const t = i / SAMPLE_RATE;
    let value = fn(t);
    const remaining = total - i;
    if (remaining < fadeSamples) value *= remaining / fadeSamples;
    samples[i] = value;
  }
  return samples;
};

/** 반음 단위 음정 → 주파수 (A4 = 440Hz) */
const note = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);

// ---------------------------------------------------------------------------
// 계획서 13.1의 효과음 7종
// ---------------------------------------------------------------------------

const sounds = {
  /** 모루 타격 — 금속 타격음. 가장 자주 들리므로 짧고 날카롭지 않게. */
  anvil_hit: () =>
    render(0.18, (t) => {
      const strike = makeNoiseFor('anvil')(t) * envelope(t, 0.03, 0.0005, 12) * 0.35;
      const body = metallic(t, note(7), 0.18) * 0.5;
      return strike + body;
    }),

  /** 일반 버튼 — 반복 피로가 적은 절제된 클릭음 */
  button: () =>
    render(0.06, (t) => square(t * note(-5), 0.5) * envelope(t, 0.06, 0.002, 10) * 0.18),

  /** 업그레이드 구매 — 짧은 금속 울림과 재화 소비음 */
  upgrade_purchase: () =>
    render(0.3, (t) => {
      const ding = metallic(t, note(12), 0.3) * 0.45;
      // 뒤따르는 낮은 음이 "재화를 썼다"는 느낌을 준다.
      const spend = t > 0.08 ? triangle((t - 0.08) * note(0)) * envelope(t - 0.08, 0.22, 0.005, 6) * 0.25 : 0;
      return ding + spend;
    }),

  /** 주문 완료 — 무기 완성·납품을 느끼게 하는 짧은 팡파르 */
  order_complete: () =>
    render(0.6, (t) => {
      const steps = [note(4), note(9), note(16)];
      const stepDuration = 0.15;
      const index = Math.min(steps.length - 1, Math.floor(t / stepDuration));
      const local = t - index * stepDuration;
      const tone = square(t * steps[index], 0.5) * envelope(local, stepDuration * 1.6, 0.004, 4);
      const shine = metallic(t, note(21), 0.6) * 0.15;
      return tone * 0.3 + shine;
    }),

  /** 업적 달성 — 더 밝은 팡파르 */
  achievement: () =>
    render(0.85, (t) => {
      const steps = [note(4), note(9), note(13), note(16)];
      const stepDuration = 0.13;
      const index = Math.min(steps.length - 1, Math.floor(t / stepDuration));
      const local = t - index * stepDuration;
      const lead = square(t * steps[index], 0.25) * envelope(local, stepDuration * 2, 0.004, 3);
      // 마지막 음 위에 5도를 얹어 화음을 만든다.
      const harmony = t > stepDuration * 3
        ? square(t * note(23), 0.5) * envelope(t - stepDuration * 3, 0.4, 0.01, 3) * 0.5
        : 0;
      return (lead + harmony) * 0.28;
    }),

  /** 환생 — 불꽃이 크게 타오르는 사운드와 공간감 있는 전환음 */
  prestige: () =>
    render(1.3, (t) => {
      // 낮은 곳에서 높은 곳으로 쓸어 올리는 저음
      const sweepFreq = note(-24) * Math.pow(2, t * 1.6);
      const sweep = triangle(t * sweepFreq) * envelope(t, 0.9, 0.05, 2) * 0.3;
      // 불꽃이 번지는 잡음
      const fire = makeNoiseFor('prestige')(t) * envelope(t, 1.3, 0.15, 2.5) * 0.12;
      // 후반부에 터지는 밝은 화음
      const chord = t > 0.55
        ? (square(t * note(16), 0.5) + square(t * note(23), 0.5) + square(t * note(28), 0.5)) *
          envelope(t - 0.55, 0.75, 0.02, 3) * 0.12
        : 0;
      return sweep + fire + chord;
    }),

  /** 오프라인 보상 — 잉걸불이 차곡차곡 쌓이는 소리 */
  offline_reward: () =>
    render(0.75, (t) => {
      const stepDuration = 0.1;
      const index = Math.floor(t / stepDuration);
      if (index > 5) return 0;
      const local = t - index * stepDuration;
      // 하나씩 쌓일수록 음이 올라간다.
      const freq = note(9 + index * 2);
      return metallic(local, freq, stepDuration * 1.4) * 0.3;
    }),
};

/**
 * 잡음 생성기를 소리마다 따로 두되, 시간축으로 결정적이게 만든다.
 * 같은 t에 항상 같은 값을 돌려줘야 파일이 매번 동일하게 나온다.
 */
const noiseCache = new Map();
function makeNoiseFor(key) {
  if (!noiseCache.has(key)) {
    const seed = [...key].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
    const gen = makeNoise(seed);
    const table = new Float32Array(SAMPLE_RATE * 2);
    for (let i = 0; i < table.length; i += 1) table[i] = gen();
    noiseCache.set(key, table);
  }
  const table = noiseCache.get(key);
  return (t) => table[Math.floor(t * SAMPLE_RATE) % table.length];
}

// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
console.log(`효과음을 생성합니다 → ${OUT_DIR}`);
for (const [name, build] of Object.entries(sounds)) {
  writeWav(name, build());
}
console.log(`완료: ${Object.keys(sounds).length}개`);
