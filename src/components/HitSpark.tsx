/**
 * 타격 이펙트 (계획서 4.6 / 13.4).
 *
 * 프레임 상태를 이 작은 잎 컴포넌트 안에만 두어, 타격할 때 대장간 화면 전체가
 * 다시 그려지지 않게 한다. 부모는 ref로 `play()`만 부른다.
 *
 * 동시에 여러 개가 겹쳐 쌓이지 않도록 하나의 타이머만 유지한다
 * (계획서 13.4 "숫자 애니메이션·사운드는 동시에 과도하게 생성되지 않도록 제한").
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SPARK_FRAMES } from '../data/sprites';
import { PixelCanvas } from './PixelCanvas';
import type { PixelScale } from '../theme/pixel';

export interface HitSparkHandle {
  play(): void;
}

const FRAME_MS = 55;

export const HitSpark = forwardRef<
  HitSparkHandle,
  { accent: string; scale?: PixelScale; enabled?: boolean }
>(({ accent, scale = 3, enabled = true }, ref) => {
  const [frame, setFrame] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  useImperativeHandle(ref, () => ({
    play() {
      if (!enabled) return;
      stop();
      setFrame(0);
      let current = 0;
      timer.current = setInterval(() => {
        current += 1;
        if (current >= SPARK_FRAMES.length) {
          stop();
          setFrame(null);
          return;
        }
        setFrame(current);
      }, FRAME_MS);
    },
  }));

  useEffect(() => stop, []);

  if (frame === null) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <PixelCanvas sprite={SPARK_FRAMES[frame]!} scale={scale} paletteOverride={{ A: accent }} />
    </View>
  );
});

HitSpark.displayName = 'HitSpark';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
