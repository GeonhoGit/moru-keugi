/**
 * 업적 화면 (계획서 4.2 / 12.1).
 *
 * 업적은 13개를 한 덩어리로 늘어놓으면 무엇을 봐야 할지 알 수 없어
 * **수령 대기 → 진행 중 → 달성 완료** 세 묶음으로 나눈다.
 * 지금 할 일이 맨 위에 온다.
 *
 * 세 묶음 모두 접지 않고 전부 펼쳐 둔다. 기록 화면 안에 얹혀 있을 때는
 * 통계와 자리를 다투느라 달성 완료를 접어야 했지만, 화면을 따로 쓰면
 * 그럴 이유가 없다. 달성 조건도 항목마다 함께 보여 준다.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { big, formatNumber } from '../engine/bignum';
import {
  getAchievementState,
  getClaimableAchievements,
  getUnlockedCount,
  getTotalCount,
} from '../engine/achievements';
import { getConditionProgress } from '../engine/unlock';
import { ACHIEVEMENTS } from '../data/achievements';
import { useGameStore, useGameValue } from '../state/GameContext';
import { colors, spacing } from '../theme/index';
import { AppText, Button, Divider, Panel, ProgressBar, Screen } from '../components/index';

export const AchievementsScreen: React.FC = () => (
  <Screen>
    <AchievementSection />
  </Screen>
);

interface AchievementRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly reward: string | null;
  readonly progressLabel: string;
  readonly ratio: number;
}

const AchievementSection: React.FC = () => {
  const store = useGameStore();

  const view = useGameValue(
    (snapshot) => {
      const state = snapshot.state;
      const format = state.settings.numberFormat;

      const claimable: AchievementRow[] = [];
      const inProgress: AchievementRow[] = [];
      const done: AchievementRow[] = [];

      for (const definition of ACHIEVEMENTS) {
        const achievement = getAchievementState(state, definition.id);
        const progress = getConditionProgress(state, definition.condition);

        const row: AchievementRow = {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          reward: definition.emberReward
            ? formatNumber(big(definition.emberReward), format)
            : null,
          // 목표까지 얼마나 왔는지 숫자로 보여 준다.
          progressLabel: `${formatNumber(progress.current, format)} / ${formatNumber(
            progress.target,
            format,
          )}`,
          ratio: progress.ratio,
        };

        if (achievement.unlocked && !achievement.claimed) claimable.push(row);
        else if (achievement.claimed) done.push(row);
        else inProgress.push(row);
      }

      // 목표에 가까운 것을 위로 올려, 다음에 할 일이 먼저 보이게 한다.
      inProgress.sort((a, b) => b.ratio - a.ratio);

      return {
        claimable,
        inProgress,
        done,
        unlocked: getUnlockedCount(state),
        total: getTotalCount(),
        claimableIds: getClaimableAchievements(state),
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  return (
    <Panel>
      <View style={styles.header}>
        <AppText variant="title">{`업적 ${view.unlocked} / ${view.total}`}</AppText>
        {view.claimable.length > 0 ? (
          <AppText variant="label" color={colors.gold}>
            {`수령 ${view.claimable.length}`}
          </AppText>
        ) : null}
      </View>

      {view.claimable.length > 0 ? (
        <>
          <Divider />
          {view.claimable.map((row) => (
            <View key={row.id} style={styles.claimRow}>
              <View style={styles.claimText}>
                <AppText variant="label" color={colors.gold}>
                  {row.name}
                </AppText>
                <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                  {row.description}
                </AppText>
              </View>
              <Button
                label={row.reward ? `받기 ${row.reward}` : '받기'}
                compact
                onPress={() => store.claimAchievement(row.id)}
                hint={`${row.name} 보상을 받습니다`}
              />
            </View>
          ))}
        </>
      ) : null}

      {view.inProgress.length > 0 ? (
        <>
          <Divider />
          <AppText variant="caption" color={colors.textMuted}>
            진행 중
          </AppText>
          {view.inProgress.map((row) => (
            <View key={row.id} style={styles.progressRow}>
              <View style={styles.progressHeader}>
                <AppText variant="label" numberOfLines={1}>
                  {row.name}
                </AppText>
                <AppText variant="mono" color={colors.textMuted}>
                  {row.progressLabel}
                </AppText>
              </View>
              {/*
                무엇을 해야 하는지. 이름만으로는 "굳은살"이 몇 번 두드리는 것인지 알 수 없고,
                숫자 진행도만 봐서는 그 수가 무엇을 세는 것인지 알 수 없다.
              */}
              <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
                {row.description}
              </AppText>
              <ProgressBar ratio={row.ratio} label={`${row.name} 진행도`} />
            </View>
          ))}
        </>
      ) : null}

      {view.done.length > 0 ? (
        <>
          <Divider />
          <AppText variant="caption" color={colors.textMuted}>
            {`달성 완료 ${view.done.length}개`}
          </AppText>
          {view.done.map((row) => (
            <View key={row.id} style={styles.doneRow}>
              <AppText variant="label" color={colors.textMuted} numberOfLines={1}>
                {`✔ ${row.name}`}
              </AppText>
              <AppText variant="caption" color={colors.textDisabled} numberOfLines={2}>
                {row.description}
              </AppText>
            </View>
          ))}
        </>
      ) : null}
    </Panel>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 48,
  },
  claimText: {
    flex: 1,
    gap: 2,
  },
  progressRow: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  doneRow: {
    paddingVertical: spacing.xs,
    gap: 2,
  },
});
