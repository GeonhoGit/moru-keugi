/**
 * 배경 음악 직접 생성 (계획서 13.2 / 4.4).
 *
 * 화로 티어 4단계에 맞춰 악기를 하나씩 얹는다.
 * "티어가 오를수록 웅장해진다"를 곡을 새로 쓰는 게 아니라 **같은 곡에 레이어를 더하는**
 * 방식으로 구현했다. 그래야 티어가 바뀔 때 크로스페이드가 자연스럽고,
 * 플레이어가 "같은 대장간이 자란다"고 느낀다.
 *
 *   node scripts/generate-music.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  envelope,
  limitPeak,
  makeNoiseTable,
  makeSeamless,
  note,
  render,
  square,
  triangle,
  writeWav,
} from './lib/synth.mjs';

/** 음악은 고음이 적어 낮은 표본율로도 충분하다. 파일 크기를 27% 줄인다. */
const SAMPLE_RATE = 16000;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'music');

const BPM = 96;
const BEAT = 60 / BPM; // 0.625초
const BAR = BEAT * 4;
const BARS = 8;
const LOOP_SECONDS = BARS * BAR; // 20초

/**
 * 화음 진행 — Am · F · C · G (i - VI - III - VII).
 * 단조로 시작해 밝은 화음을 거치는 진행이라 "낡은 대장간이 자란다"는 정서에 맞는다.
 * 각 화음이 2마디씩 간다.
 */
const PROGRESSION = [
  { root: -24, tones: [0, 3, 7] }, // Am
  { root: -28, tones: [0, 4, 7] }, // F
  { root: -21, tones: [0, 4, 7] }, // C
  { root: -26, tones: [0, 4, 7] }, // G
];

const chordAt = (t) => {
  const bar = Math.floor((t % LOOP_SECONDS) / BAR);
  return PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];
};

/** 마디 안에서의 경과 시간 */
const inBar = (t) => (t % LOOP_SECONDS) % BAR;

const noise = makeNoiseTable('forge-bgm', SAMPLE_RATE);

// ---------------------------------------------------------------------------
// 악기 레이어
// ---------------------------------------------------------------------------

/** 베이스 — 마디마다 근음을 두 번. 모든 티어의 바탕이 된다. */
const bass = (t) => {
  const chord = chordAt(t);
  const local = inBar(t);
  const half = local < BEAT * 2 ? local : local - BEAT * 2;
  return triangle(t * note(chord.root)) * envelope(half, BEAT * 2, 0.02, 2.5) * 0.5;
};

/** 패드 — 길게 깔리는 화음. 공간감을 만든다. */
const pad = (t) => {
  const chord = chordAt(t);
  const local = inBar(t);
  let value = 0;
  for (const tone of chord.tones) {
    value += triangle(t * note(chord.root + tone + 12));
  }
  return (value / chord.tones.length) * envelope(local, BAR, 0.25, 0.8) * 0.35;
};

/** 아르페지오 — 8분음표로 화음을 훑는다. 대장간이 돌아가는 느낌. */
const arpeggio = (t) => {
  const chord = chordAt(t);
  const step = Math.floor((t % LOOP_SECONDS) / (BEAT / 2));
  const local = (t % LOOP_SECONDS) % (BEAT / 2);
  const tone = chord.tones[step % chord.tones.length];
  const freq = note(chord.root + tone + 24);
  return square(t * freq, 0.25) * envelope(local, BEAT / 2, 0.005, 4) * 0.22;
};

/**
 * 망치질 리듬 — 2박과 4박에 잡음 타격.
 * 드럼 대신 대장간 망치 소리로 박자를 잡아 세계관과 맞춘다.
 */
const hammer = (t) => {
  const local = inBar(t);
  const beat2 = local - BEAT;
  const beat4 = local - BEAT * 3;
  const hit = (x) => (x >= 0 ? noise(t) * envelope(x, 0.12, 0.001, 9) : 0);
  return (hit(beat2) + hit(beat4)) * 0.16;
};

/** 멜로디 — 마디마다 움직이는 선율. A단조 5음계에서 고른다. */
const MELODY = [
  [0, 7, 3, 5],
  [7, 5, 3, 0],
  [3, 7, 10, 7],
  [5, 3, 2, 0],
  [0, 3, 7, 12],
  [10, 7, 5, 3],
  [7, 10, 12, 10],
  [5, 3, 0, -2],
];

const lead = (t, octave = 24) => {
  const barIndex = Math.floor((t % LOOP_SECONDS) / BAR);
  const step = Math.floor(inBar(t) / BEAT);
  const local = inBar(t) % BEAT;
  const chord = chordAt(t);
  const semitone = MELODY[barIndex % MELODY.length][step];
  const freq = note(chord.root + semitone + octave);
  return square(t * freq, 0.5) * envelope(local, BEAT * 1.2, 0.01, 3) * 0.2;
};

// ---------------------------------------------------------------------------
// 티어별 편성 (계획서 6.1의 화로 4단계)
// ---------------------------------------------------------------------------

const TIERS = [
  {
    name: 'forge_tier_0',
    label: '초심자의 화로 — 베이스와 옅은 패드만',
    voices: (t) => bass(t) * 0.8 + pad(t) * 0.4,
  },
  {
    name: 'forge_tier_1',
    label: '타오르는 화로 — 아르페지오가 들어온다',
    voices: (t) => bass(t) * 0.9 + pad(t) * 0.5 + arpeggio(t) * 0.8,
  },
  {
    name: 'forge_tier_2',
    label: '작열하는 용광로 — 망치 리듬과 멜로디',
    voices: (t) => bass(t) + pad(t) * 0.6 + arpeggio(t) + hammer(t) + lead(t),
  },
  {
    name: 'forge_tier_3',
    label: '용염의 성화 — 옥타브를 겹쳐 웅장하게',
    voices: (t) =>
      bass(t) +
      pad(t) * 0.8 +
      arpeggio(t) +
      hammer(t) * 1.2 +
      lead(t) +
      lead(t, 36) * 0.5 +
      // 낮은 옥타브 베이스를 하나 더 깔아 두께를 만든다.
      triangle(t * note(chordAt(t).root - 12)) * 0.25,
  },
];

// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
console.log(`배경 음악을 생성합니다 → ${OUT_DIR}`);
console.log(`  ${BPM}BPM · ${BARS}마디 · ${LOOP_SECONDS.toFixed(1)}초 루프 · ${SAMPLE_RATE}Hz`);

const BLEND_SECONDS = 0.06;

for (const tier of TIERS) {
  // 이음매를 섞을 여분을 더 렌더링한다. 끝 페이드는 넣지 않는다(루프이므로).
  const raw = render(LOOP_SECONDS + BLEND_SECONDS, SAMPLE_RATE, tier.voices, 0);
  const seamless = makeSeamless(raw, SAMPLE_RATE, LOOP_SECONDS, BLEND_SECONDS);
  const limited = limitPeak(seamless, 0.9);
  const bytes = writeWav(join(OUT_DIR, `${tier.name}.wav`), limited.samples, SAMPLE_RATE);

  const seconds = (limited.samples.length / SAMPLE_RATE).toFixed(1);
  const gainNote = limited.gain < 1 ? ` · 피크 ${limited.peak.toFixed(2)} → 0.90 축소` : '';
  console.log(
    `  ${tier.name}.wav — ${seconds}초, ${(bytes / 1024).toFixed(0)}KB · ${tier.label}${gainNote}`,
  );
}
console.log(`완료: ${TIERS.length}개`);
