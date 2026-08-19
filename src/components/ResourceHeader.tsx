/**
 * 모든 화면 위에 붙는 재화 표시줄.
 *
 * 잉걸불과 초당 생산량만 구독하므로, 게임 루프가 돌아도 이 컴포넌트만 다시 그려진다
 * (계획서 13.4).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatNumber } from '../engine/bignum';
import { getAutoRate } from '../engine/production';
import { getForgeTier } from '../engine/forge';
import { useGameValue } from '../state/GameContext';
import { colors, MIN_TOUCH_SIZE, spacing, typography } from '../theme/index';
import { AppText } from './index';
import { Text } from 'react-native';

export const ResourceHeader: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const format = useGameValue((snapshot) => snapshot.state.settings.numberFormat);
  const ember = useGameValue((snapshot) => formatNumber(snapshot.state.ember, format));
  const autoRate = useGameValue((snapshot) => formatNumber(getAutoRate(snapshot.state), format));
  const accent = useGameValue(
    (snapshot) => getForgeTier(snapshot.state.lifetimeEmber).accentColor,
  );

  return (
    <View style={styles.container}>
      <View style={styles.values}>
        <Text
          accessibilityLabel={`잉걸불 ${ember}`}
          maxFontSizeMultiplier={1.4}
          numberOfLines={1}
          style={[typography.monoLarge, { color: accent }]}
        >
          {ember}
        </Text>
        <AppText variant="caption" color={colors.textMuted}>
          {`초당 ${autoRate}`}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="설정 열기"
        onPress={onOpenSettings}
        style={({ pressed }) => [styles.settingsButton, pressed && { opacity: 0.6 }]}
      >
        <AppText variant="title" color={colors.textMuted}>
          ⚙
        </AppText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  values: {
    flex: 1,
    gap: 2,
  },
  settingsButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
