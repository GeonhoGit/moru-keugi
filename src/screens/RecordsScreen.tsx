/**
 * 기록 화면 (계획서 12.1).
 * 평생 통계와 해금 기록을 보여 준다.
 *
 * 업적은 항목이 13개로 많아 통계와 자리를 다투므로 별도 탭으로 뺐다
 * (`AchievementsScreen`). V1.1의 도감과 유물 보관함은 이 화면에 들어온다 (12.2).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatNumber } from '../engine/bignum';
import { getForgeTier } from '../engine/forge';
import { useGameValue } from '../state/GameContext';
import { colors, spacing } from '../theme/index';
import { AppText, Divider, Panel, Screen, StatRow } from '../components/index';

export const RecordsScreen: React.FC = () => {
  return (
    <Screen>
      <StatsPanel />
    </Screen>
  );
};

// ---------------------------------------------------------------------------
// 업적
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 평생 통계
// ---------------------------------------------------------------------------

const StatsPanel: React.FC = () => {
  const stats = useGameValue(
    (snapshot) => {
      const format = snapshot.state.settings.numberFormat;
      return {
        lifetime: formatNumber(snapshot.state.lifetimeEmber, format),
        run: formatNumber(snapshot.state.runLifetimeEmber, format),
        clicks: snapshot.state.clickCount.toLocaleString('ko-KR'),
        orders: snapshot.state.orders.completedCount,
        prestige: snapshot.state.prestige.count,
        seals: snapshot.state.prestige.masterSeals,
        tier: getForgeTier(snapshot.state.lifetimeEmber).name,
        cosmetics: snapshot.state.unlocks.length,
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  return (
    <Panel>
      <AppText variant="title">평생 기록</AppText>
      <Divider />
      <StatRow label="평생 누적 잉걸불" value={stats.lifetime} />
      <StatRow label="이번 생애 누적" value={stats.run} />
      <StatRow label="누적 타격 수" value={stats.clicks} />
      <StatRow label="완료한 주문" value={`${stats.orders}개`} />
      <StatRow label="환생 횟수" value={`${stats.prestige}회`} />
      <StatRow label="보유 명인의 인장" value={`${stats.seals}개`} />
      <StatRow label="화로 단계" value={stats.tier} />
      <StatRow label="해금한 장식" value={`${stats.cosmetics}개`} />
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
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
});
