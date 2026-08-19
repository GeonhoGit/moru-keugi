/**
 * 효과음·배경음악 생성기가 함께 쓰는 신디사이저 도구.
 *
 * 칩튠 계열 음색을 코드로 만들기 위한 최소한의 요소만 둔다.
 * 외부 라이브러리를 쓰지 않으므로 라이선스 문제가 없다 (계획서 21).
 */
import { writeFileSync } from 'node:fs';

export const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// 파형
// ---------------------------------------------------------------------------

/** 사각파 — 8비트 게임 소리의 기본 음색 */
export const square = (phase, duty = 0.5) => ((phase % 1) < duty ? 1 : -1);

/** 삼각파 — 사각파보다 부드러워 베이스와 패드에 쓴다 */
export const triangle = (phase) => {
  const p = phase % 1;
  return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
};

/** 결정적 잡음 생성기. 씨앗을 고정해 매번 같은 파일이 나오게 한다. */
export const makeNoise = (seed = 1) => {
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

/**
 * 시간축으로 결정적인 잡음. 같은 t에 항상 같은 값을 돌려준다.
 * 이름마다 다른 씨앗을 써서 소리끼리 잡음이 겹치지 않게 한다.
 */
export const makeNoiseTable = (key, sampleRate, seconds = 2) => {
  const seed = [...key].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  const gen = makeNoise(seed);
  const table = new Float32Array(Math.floor(sampleRate * seconds));
  for (let i = 0; i < table.length; i += 1) table[i] = gen();
  return (t) => table[Math.floor(t * sampleRate) % table.length];
};

/** 지수 감쇠 엔벨로프. `attack` 동안 올라갔다가 서서히 사라진다. */
export const envelope = (t, duration, attack = 0.005, curve = 5) => {
  if (t < 0 || t > duration) return 0;
  const attackGain = t < attack ? t / attack : 1;
  return attackGain * Math.exp((-curve * t) / duration);
};

/**
 * 금속을 때린 소리.
 * 배음이 정수배가 아닌 비조화 부분음이라 종·모루 같은 금속 느낌이 난다.
 * 정수배로 두면 악기 음처럼 들려 금속 질감이 사라진다.
 */
export const METAL_PARTIALS = [1, 2.76, 5.4, 8.93];

export const metallic = (t, baseFreq, duration) => {
  let value = 0;
  METAL_PARTIALS.forEach((ratio, index) => {
    // 높은 부분음일수록 더 빨리 사라진다.
    const gain = envelope(t, duration, 0.001, 4 + index * 3) / (index + 1.5);
    value += Math.sin(TAU * baseFreq * ratio * t) * gain;
  });
  return value;
};

/** 반음 단위 음정 → 주파수 (A4 = 440Hz) */
export const note = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);

// ---------------------------------------------------------------------------
// 렌더링과 파일 쓰기
// ---------------------------------------------------------------------------

/** `duration`초를 `fn(t)`로 채운다. 끝에 짧은 페이드를 넣어 딱 소리를 없앤다. */
export const render = (duration, sampleRate, fn, fadeOutSeconds = 0.003) => {
  const total = Math.floor(duration * sampleRate);
  const fadeSamples = Math.floor(fadeOutSeconds * sampleRate);
  const samples = new Float32Array(total);

  for (let i = 0; i < total; i += 1) {
    let value = fn(i / sampleRate);
    const remaining = total - i;
    if (fadeSamples > 0 && remaining < fadeSamples) value *= remaining / fadeSamples;
    samples[i] = value;
  }
  return samples;
};

/**
 * 반복 재생용으로 이음매를 없앤다.
 *
 * `samples`는 루프 길이보다 `blendSeconds`만큼 더 길게 렌더링해서 넘긴다.
 * 그 여분(루프 지점을 지나 자연스럽게 이어지는 소리)을 앞부분에 섞으면,
 * 루프가 되돌아갈 때 파형이 끊기지 않는다.
 *
 * 반대로 "끝부분에 시작을 섞는" 방식은 오히려 루프 직후에 불연속이 생긴다.
 * 되돌아간 지점의 앞 소리가 이미 시작 부분으로 바뀌어 있기 때문이다.
 */
export const makeSeamless = (samples, sampleRate, loopSeconds, blendSeconds = 0.06) => {
  const loopLength = Math.floor(loopSeconds * sampleRate);
  const blend = Math.min(Math.floor(blendSeconds * sampleRate), samples.length - loopLength);
  const out = samples.slice(0, loopLength);
  if (blend <= 0) return out;

  for (let i = 0; i < blend; i += 1) {
    const fade = i / blend; // 0 → 1
    // 루프 지점을 넘어 이어지던 소리에서 곡의 시작으로 서서히 넘어간다.
    out[i] = samples[loopLength + i] * (1 - fade) + samples[i] * fade;
  }
  return out;
};

/**
 * 최대 진폭이 `target`을 넘지 않도록 전체를 같은 비율로 줄인다.
 *
 * 트랙마다 따로 최대 음량에 맞추면 티어별 음량 차이가 사라진다.
 * 넘칠 때만 줄이므로 "티어가 오를수록 웅장해진다"는 관계는 유지된다.
 */
export const limitPeak = (samples, target = 0.9) => {
  let peak = 0;
  for (const value of samples) {
    const magnitude = Math.abs(value);
    if (magnitude > peak) peak = magnitude;
  }
  if (peak <= target || peak === 0) return { samples, gain: 1, peak };

  const gain = target / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] * gain;
  return { samples: out, gain, peak };
};

/** 16비트 모노 PCM WAV로 저장한다. */
export const writeWav = (path, samples, sampleRate) => {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // fmt 청크 크기
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // 모노
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // 초당 바이트
  buffer.writeUInt16LE(2, 32); // 블록 정렬
  buffer.writeUInt16LE(16, 34); // 비트 깊이
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(path, buffer);
  return buffer.length;
};
