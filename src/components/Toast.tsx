/**
 * 잠깐 떴다 사라지는 안내 (계획서 14 접근성).
 *
 * `ToastAndroid` 대신 앱 안에서 직접 그린다. 기기 기본 토스트는 이 게임의
 * 어두운 도트 화면과 따로 놀고, iOS에는 아예 없다.
 *
 * 애니메이션은 `opacity`만 쓴다. `transform` 배열에 `Animated` 값과 그때그때
 * 바뀌는 정적 값을 함께 넣으면 정적 값이 네이티브에 굳어 버린다
 * (`theme/pixel.ts`의 `getBackgroundLayout` 주석 참고).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { AppText } from './index';
import { colors, radius, spacing, TAB_BAR_HEIGHT } from '../theme/index';

const FADE_IN_MS = 120;
const FADE_OUT_MS = 260;

export const Toast: React.FC<{
  /** 보여 줄 문구. `null`이면 사라진다. */
  message: string | null;
  /** 이 값이 바뀔 때마다 같은 문구라도 다시 뜬다. */
  nonce?: number;
  /** 문구가 저절로 사라지기까지의 시간 */
  durationMs?: number;
  /** 스스로 사라진 뒤 부모에게 알린다 */
  onHidden?: () => void;
}> = ({ message, nonce = 0, durationMs = 2000, onHidden }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const hidden = useRef(onHidden);
  hidden.current = onHidden;

  useEffect(() => {
    if (message === null) return undefined;

    let cancelled = false;
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) hidden.current?.();
      });
    }, durationMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      opacity.stopAnimation();
    };
  }, [durationMs, message, nonce, opacity]);

  if (message === null) return null;

  return (
    // 눌러서 통과시킨다. 안내가 떠 있는 동안에도 화면은 그대로 조작할 수 있어야 한다.
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
      <AppText variant="caption" color={colors.text} align="center">
        {message}
      </AppText>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    // 하단 탭을 가리지 않도록 그 위에 띄운다.
    bottom: TAB_BAR_HEIGHT + spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.panelRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
