/**
 * 공방으로 들어가는 버튼 (계획서 12.1).
 *
 * 대장간 화면은 모루 타격에 집중해야 하므로 일하는 모습을 여기에 다 펼치지 않는다.
 * 대신 누가 일하고 있는지만 한 줄로 알려 주고, 자세한 장면은 공방 화면에서 본다.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WORKER_ANIMATIONS } from '../data/workers';
import { getForgeTier } from '../engine/forge';
import { getOwnedCount } from '../engine/production';
import { useGameValue } from '../state/GameContext';
import { colors, radius, spacing, MIN_TOUCH_SIZE } from '../theme/index';
import { AnimatedSprite } from './AnimatedSprite';
import { AppText } from './index';

export const WorkshopButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const view = useGameValue(
    (snapshot) => {
      const state = snapshot.state;
      return {
        accent: getForgeTier(state.lifetimeEmber).accentColor,
        reduceMotion: state.settings.reduceMotion,
        counts: WORKER_ANIMATIONS.map((animation) =>
          getOwnedCount(state, animation.upgradeId),
        ).join(','),
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  const counts = view.counts.split(',').map(Number);
  const working = WORKER_ANIMATIONS.map((animation, index) => ({
    animation,
    count: counts[index] ?? 0,
  })).filter((entry) => entry.count > 0);

  if (working.length === 0) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="공방 둘러보기"
      accessibilityHint="일하고 있는 모습을 자세히 봅니다"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.crew}>
        {working.map((entry) => (
          <AnimatedSprite
            key={entry.animation.upgradeId}
            frames={entry.animation.frames}
            frameMs={entry.animation.frameMs}
            scale={2}
            accent={view.accent}
            paused={view.reduceMotion}
          />
        ))}
      </View>
      <AppText variant="caption" color={colors.textMuted}>
        공방 둘러보기
      </AppText>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  pressed: {
    opacity: 0.75,
  },
  crew: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
});
