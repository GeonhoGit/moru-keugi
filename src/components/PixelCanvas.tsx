/**
 * 도트 스프라이트 렌더러 (계획서 4.6).
 *
 * 정수 배율로만 그리고, 픽셀 하나를 정수 크기의 View 하나로 찍는다.
 * 이미지 보간이 개입하지 않으므로 자리표시 단계에서도 도트 경계가 뭉개지지 않는다.
 *
 * 실제 PNG 에셋이 들어오면 이 컴포넌트를 `<Image>` 기반으로 바꾸되,
 * 바깥에서 쓰는 `sprite` · `scale` 인터페이스는 그대로 두면 화면 코드는 손대지 않아도 된다.
 * (그때 nearest-neighbor 처리 방식을 실기기로 검증한다 — 계획서 4.6)
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { getPixelSize, type PixelScale, type PixelSpriteData } from '../theme/pixel';

export const PixelCanvas: React.FC<{
  sprite: PixelSpriteData;
  scale: PixelScale;
  /** 특정 팔레트 문자의 색을 덮어쓴다. 화로 티어 강조색 교체에 쓴다. */
  paletteOverride?: Readonly<Record<string, string>>;
  accessibilityLabel?: string;
}> = ({ sprite, scale, paletteOverride, accessibilityLabel }) => {
  const size = getPixelSize(sprite.grid, scale);

  const rows = useMemo(() => {
    const palette = { ...sprite.palette, ...paletteOverride };

    // 같은 색이 이어지는 구간을 하나의 View로 합친다.
    // 32×32를 픽셀마다 View로 그리면 1,024개가 되어 타격마다 부담이 된다 (계획서 13.4).
    return sprite.rows.map((row) => {
      const runs: { color: string | null; length: number }[] = [];
      for (const char of row) {
        const color = char === '.' ? null : (palette[char] ?? null);
        const last = runs[runs.length - 1];
        if (last && last.color === color) last.length += 1;
        else runs.push({ color, length: 1 });
      }
      return runs;
    });
  }, [sprite, paletteOverride]);

  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.canvas, { width: size, height: size }]}
    >
      {rows.map((runs, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { height: scale }]}>
          {runs.map((run, runIndex) => (
            <View
              key={runIndex}
              style={{
                width: run.length * scale,
                height: scale,
                backgroundColor: run.color ?? 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
});
