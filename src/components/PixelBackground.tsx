/**
 * 도트 배경 (계획서 4.4 "대장간 시각적 성장", 4.6).
 *
 * 배경만 문자 행렬이 아니라 PNG다. 320×180은 57,600픽셀이라 `PixelCanvas`처럼
 * 픽셀마다 `View`를 만들면 기기가 버티지 못한다 (계획서 13.4).
 *
 * **확대는 정수 배율로만 한다** (계획서 4.6). 남는 자리는 늘려서 채우지 않고
 * 바탕색으로 둔다. 꽉 채우려고 소수 배율을 쓰면 도트 경계가 뭉개진다.
 *
 * 이미지는 `@2x`·`@3x`를 함께 구워 두었다. React Native가 기기 밀도에 맞는 것을
 * 고르므로, 배율이 1일 때는 원본 픽셀과 화면 픽셀이 1:1로 맞아 보간이 아예 없다.
 */
import React from 'react';
import { Image, PixelRatio, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { colors } from '../theme/index';
import { getBackgroundLayout } from '../theme/pixel';

/**
 * 화로 티어별 배경.
 *
 * **아직 그린 배경이 없다.** 네 자리 모두 `null`이라 지금은 아무것도 그리지 않고
 * 바탕색만 남는다. 대장간 화면에는 모루만 보인다.
 *
 * 그림이 나오면 해당 줄의 `null`을 지우고 `require`를 되살린다.
 * 한 장씩 켜도 되고, 켜지 않은 티어는 계속 바탕색만 남는다.
 *
 *   require('../../assets/backgrounds/forge_tier_0.png'),
 *
 * `require`는 Metro가 번들에 넣기 위해 정적 경로여야 하므로 변수로 만들 수 없다.
 * 그래서 파일이 없는 채로 `require`를 남겨 두면 번들이 깨진다. 파일과 이 목록은
 * 항상 같이 움직여야 한다.
 *
 * 사양과 그리는 방법은 `docs/art/배경-도트-제작-가이드.md`에 있다.
 */
const BACKGROUNDS: readonly (ImageSourcePropType | null)[] = [
  null, // 티어 0 초심자의 화로
  null, // 티어 1 타오르는 화로
  null, // 티어 2 작열하는 용광로
  null, // 티어 3 용염의 성화
];

export const PixelBackground: React.FC<{
  /** 화로 티어. 이 값에 맞는 그림을 고른다. */
  tier: number;
  /** 배경이 채울 영역의 너비(dp). 여기에 들어가는 가장 큰 정수 배율을 고른다. */
  availableWidth: number;
  /** 감싸는 상자의 모서리 반경. 둥근 상자 안에 깔 때 모서리가 삐져나오지 않게 한다. */
  borderRadius?: number;
}> = ({ tier, availableWidth, borderRadius = 0 }) => {
  const source = BACKGROUNDS[tier] ?? null;

  // 그림이 없으면 바탕색만 둔다. 배경 없이도 화면이 성립해야 한다.
  if (source === null || availableWidth <= 0) return null;

  // 배율을 정하는 규칙과 그 근거는 `getBackgroundLayout`에 적어 두었다.
  const { widthDp, heightDp } = getBackgroundLayout(availableWidth, PixelRatio.get());

  return (
    <View style={[styles.frame, { borderRadius }]} pointerEvents="none">
      <Image
        source={source}
        style={{ width: widthDp, height: heightDp }}
        // 늘리지 않는다. 지정한 크기가 이미 정수 배율이다.
        resizeMode="stretch"
        // 배경은 읽어 줄 내용이 없다. 화면 낭독기가 건너뛰게 한다 (계획서 14).
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
});
