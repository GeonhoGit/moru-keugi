/**
 * 프레임을 번갈아 보여 주는 도트 스프라이트 (계획서 4.6).
 *
 * 프레임 상태를 이 잎 컴포넌트 안에만 두어, 애니메이션이 돌아도
 * 바깥 화면이 다시 그려지지 않는다 (계획서 13.4).
 */
import React, { useEffect, useState } from 'react';
import { PixelCanvas } from './PixelCanvas';
import { phaseFrame } from './spritePhase';
import type { PixelScale, PixelSpriteData } from '../theme/pixel';

export const AnimatedSprite: React.FC<{
  frames: readonly PixelSpriteData[];
  /** 프레임 간격(ms) */
  frameMs: number;
  scale: PixelScale;
  accent: string;
  /** 모션 줄이기 설정이 켜지면 멈춘다 (계획서 14) */
  paused?: boolean;
  /** 같은 스프라이트를 여러 개 세울 때 시작 프레임을 어긋나게 한다 */
  phaseOffset?: number;
  accessibilityLabel?: string;
}> = ({ frames, frameMs, scale, accent, paused = false, phaseOffset = 0, accessibilityLabel }) => {
  // 값 자체는 시각에서 계산한다. 이 상태는 "다시 그릴 때가 됐다"는 신호일 뿐이다.
  // 그래야 같은 간격을 쓰는 다른 스프라이트(예: 풀무와 그것을 밟는 대장장이)와 박자가 맞는다.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setTick((current) => current + 1), frameMs);
    return () => clearInterval(timer);
  }, [paused, frames, frameMs]);

  const index = (phaseFrame(frameMs, frames.length) + phaseOffset) % frames.length;

  return (
    <PixelCanvas
      sprite={frames[index]!}
      scale={scale}
      paletteOverride={{ A: accent }}
      accessibilityLabel={accessibilityLabel}
    />
  );
};
