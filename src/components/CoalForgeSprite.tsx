/**
 * 석탄 화로 (계획서 4.4).
 *
 * 옆에 선 대장장이가 풀무를 밟는 동안 불이 거세진다.
 * 두 컴포넌트가 서로를 참조하지 않고 공방이 함께 쓰는 상황 객체만 읽는다.
 * 프레임 간격은 풀무와 같고 `spritePhase`가 기준 시각을 맞춰 주므로,
 * 손잡이를 누르는 순간과 불이 솟는 순간이 어긋나지 않는다.
 */
import React, { useEffect, useState } from 'react';
import { COAL_FORGE_STOKED_FRAMES } from '../data/workers';
import { PixelCanvas } from './PixelCanvas';
import { phaseFrame } from './spritePhase';
import type { ForgeSpotClaims } from './ForgeWorker';
import type { PixelScale, PixelSpriteData } from '../theme/pixel';

export const CoalForgeSprite: React.FC<{
  /** 평소 불꽃 (풀무를 밟지 않을 때) */
  frames: readonly PixelSpriteData[];
  frameMs: number;
  scale: PixelScale;
  accent: string;
  claims: ForgeSpotClaims;
  paused?: boolean;
  accessibilityLabel?: string;
}> = ({ frames, frameMs, scale, accent, claims, paused = false, accessibilityLabel }) => {
  // 값 자체는 시각과 공유 상태에서 계산한다. 이 상태는 "다시 그릴 때가 됐다"는 신호일 뿐이다.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setTick((current) => current + 1), frameMs);
    return () => clearInterval(timer);
  }, [frameMs, paused]);

  const stoked = claims.pumping > 0;
  const active = stoked ? COAL_FORGE_STOKED_FRAMES : frames;
  const index = phaseFrame(frameMs, active.length);

  return (
    <PixelCanvas
      sprite={active[index]!}
      scale={scale}
      paletteOverride={{ A: accent }}
      accessibilityLabel={accessibilityLabel}
    />
  );
};
