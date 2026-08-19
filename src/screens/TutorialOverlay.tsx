/**
 * 튜토리얼 안내 (계획서 12.3).
 *
 * "강제 설명 팝업을 연속으로 띄우기보다 실제 UI를 강조하며 한 단계씩 진행한다."
 * 화면을 가리지 않는 하단 배너로 두어 플레이어가 계속 조작할 수 있게 한다.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCurrentTutorialStep, TUTORIAL_STEP_COUNT } from '../data/tutorial';
import { useGameStore, useGameValue } from '../state/GameContext';
import { colors, radius, spacing, TAB_BAR_HEIGHT } from '../theme/index';
import { AppText, Button } from '../components/index';

export const TutorialOverlay: React.FC = () => {
  const store = useGameStore();
  const insets = useSafeAreaInsets();

  const view = useGameValue(
    (snapshot) => {
      const step = getCurrentTutorialStep(snapshot.state);
      if (!step) return null;
      return {
        title: step.title,
        body: step.body,
        index: snapshot.state.tutorialStep,
        isLast: snapshot.state.tutorialStep === TUTORIAL_STEP_COUNT - 1,
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  if (!view) return null;

  return (
    <View
      // 하단 탭을 가리면 안내대로 상점·주문 탭을 누를 수 없다.
      style={[styles.container, { bottom: TAB_BAR_HEIGHT + insets.bottom }]}
      pointerEvents="box-none"
    >
      <View accessible accessibilityRole="alert" style={styles.banner}>
        <View style={styles.text}>
          <AppText variant="label" color={colors.gold} numberOfLines={1}>
            {`${view.index + 1}/${TUTORIAL_STEP_COUNT} · ${view.title}`}
          </AppText>
          <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
            {view.body}
          </AppText>
        </View>
        <Button
          label={view.isLast ? '시작하기' : '건너뛰기'}
          compact
          tone={view.isLast ? 'primary' : 'secondary'}
          onPress={() => store.dismissTutorial()}
          hint="튜토리얼 안내를 닫습니다"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panelRaised,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
