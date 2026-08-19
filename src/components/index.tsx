/**
 * 공통 UI (계획서 14 접근성 요건을 컴포넌트 기본값으로 넣는다).
 *
 * - 터치 영역은 iOS 44pt·Android 48dp 중 큰 쪽인 48로 통일한다.
 * - 색만으로 상태를 전달하지 않고 문구·형태를 함께 쓴다.
 * - 모든 조작 요소에 스크린 리더용 레이블을 붙인다.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, MIN_TOUCH_SIZE, radius, spacing, typography } from '../theme/index';

// ---------------------------------------------------------------------------
// 텍스트
// ---------------------------------------------------------------------------

type TextVariant = 'display' | 'title' | 'body' | 'label' | 'caption' | 'mono' | 'monoLarge';

export const AppText: React.FC<{
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ children, variant = 'body', color = colors.text, align = 'left', numberOfLines }) => (
  <Text
    // 시스템 글자 크기를 따르되 레이아웃이 무너지지 않을 만큼만 허용한다 (계획서 14).
    maxFontSizeMultiplier={1.6}
    numberOfLines={numberOfLines}
    style={[typography[variant], { color, textAlign: align }]}
  >
    {children}
  </Text>
);

// ---------------------------------------------------------------------------
// 패널
// ---------------------------------------------------------------------------

export const Panel: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}> = ({ children, style, raised }) => (
  <View style={[styles.panel, raised && styles.panelRaised, style]}>{children}</View>
);

export const Divider: React.FC = () => <View style={styles.divider} />;

// ---------------------------------------------------------------------------
// 버튼
// ---------------------------------------------------------------------------

export type ButtonTone = 'primary' | 'secondary' | 'danger';

export const Button: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: ButtonTone;
  /** 스크린 리더에 읽어 줄 보조 설명 */
  hint?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ label, onPress, disabled = false, tone = 'primary', hint, compact = false, style }) => {
  const background =
    tone === 'primary' ? colors.accentDeep : tone === 'danger' ? colors.danger : colors.panelRaised;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: disabled ? colors.panelRaised : background },
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.4}
        numberOfLines={1}
        style={[
          typography.label,
          { color: disabled ? colors.textDisabled : colors.text, textAlign: 'center' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

// ---------------------------------------------------------------------------
// 진행 바
// ---------------------------------------------------------------------------

export const ProgressBar: React.FC<{
  ratio: number;
  color?: string;
  label?: string;
}> = ({ ratio, color = colors.accent, label }) => {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
};

// ---------------------------------------------------------------------------
// 목록 한 줄
// ---------------------------------------------------------------------------

export const StatRow: React.FC<{ label: string; value: string; muted?: boolean }> = ({
  label,
  value,
  muted,
}) => (
  <View style={styles.statRow}>
    <AppText variant="caption" color={colors.textMuted}>
      {label}
    </AppText>
    <AppText variant="mono" color={muted ? colors.textMuted : colors.text}>
      {value}
    </AppText>
  </View>
);

// ---------------------------------------------------------------------------
// 화면 뼈대
// ---------------------------------------------------------------------------

export const Screen: React.FC<{ children: React.ReactNode; scroll?: boolean }> = ({
  children,
  scroll = true,
}) =>
  scroll ? (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      // 상점처럼 목록이 긴 화면에서 한 손 조작을 방해하지 않게 한다.
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screen, styles.screenContent]}>{children}</View>
  );

export const LoadingScreen: React.FC<{ message: string }> = ({ message }) => (
  <View style={styles.centered}>
    <ActivityIndicator color={colors.accent} size="large" />
    <View style={{ height: spacing.lg }} />
    <AppText color={colors.textMuted}>{message}</AppText>
  </View>
);

export const EmptyState: React.FC<{ title: string; body?: string }> = ({ title, body }) => (
  <Panel style={styles.emptyState}>
    <AppText variant="label" color={colors.textMuted} align="center">
      {title}
    </AppText>
    {body ? (
      <>
        <View style={{ height: spacing.xs }} />
        <AppText variant="caption" color={colors.textMuted} align="center">
          {body}
        </AppText>
      </>
    ) : null}
  </Panel>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    // 내용이 적은 화면에서도 남는 공간을 자식이 쓸 수 있게 한다.
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  panel: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  panelRaised: {
    backgroundColor: colors.panelRaised,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  button: {
    minHeight: MIN_TOUCH_SIZE,
    minWidth: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: {
    paddingHorizontal: spacing.sm,
    flex: 1,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.panelRaised,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  emptyState: {
    paddingVertical: spacing.xl,
  },
});
