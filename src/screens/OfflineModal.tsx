/**
 * 복귀 화면 (계획서 7).
 * 경과 시간·기본 보상·적용 배율을 구분해서 표시한다.
 *
 * React Native의 `<Modal>`을 쓰지 않고 앱 트리 안의 절대 배치 오버레이로 그린다.
 * Android에서 `<Modal transparent>`는 별도의 Dialog 창을 만드는데, edge-to-edge가
 * 강제된 환경에서 그 창의 레이아웃과 터치 영역이 어긋나 `받기` 버튼이 눌리지 않았다.
 * 이 화면은 전체 화면을 덮는 카드 하나뿐이라 Dialog 창이 필요하지 않다.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatDuration, formatNumber } from '../engine/bignum';
import { describeAnomaly } from '../engine/offline';
import { useGameStore, useGameValue } from '../state/GameContext';
import { colors, spacing } from '../theme/index';
import { AppText, Button, Divider, Panel, StatRow } from '../components/index';

export const OfflineModal: React.FC = () => {
  const store = useGameStore();

  const view = useGameValue(
    (snapshot) => {
      const report = snapshot.pendingOffline;
      if (!report) return null;
      const format = snapshot.state.settings.numberFormat;
      return {
        elapsed: formatDuration(report.creditedSeconds),
        base: formatNumber(report.baseReward, format),
        efficiency: `${Math.round(report.efficiency * 100)}%`,
        final: formatNumber(report.finalReward, format),
        anomaly: describeAnomaly(report.anomaly),
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  if (!view) return null;

  return (
    <View style={styles.backdrop}>
      <Panel style={styles.card}>
        <AppText variant="title">화로가 남긴 잉걸불</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          자리를 비운 동안 견습생들이 일을 계속했습니다.
        </AppText>

        <Divider />

        <StatRow label="자리를 비운 시간" value={view.elapsed} />
        <StatRow label="기본 생산량" value={view.base} muted />
        <StatRow label="오프라인 효율" value={view.efficiency} muted />
        <Divider />
        <StatRow label="받는 잉걸불" value={view.final} />

        {view.anomaly ? (
          <>
            <View style={{ height: spacing.sm }} />
            <AppText variant="caption" color={colors.gold}>
              {view.anomaly}
            </AppText>
          </>
        ) : null}

        <View style={{ height: spacing.lg }} />
        <Button
          label="받기"
          onPress={() => store.claimPendingOffline()}
          hint={`잉걸불 ${view.final}을 받고 대장간으로 돌아갑니다`}
        />
        <View style={{ height: spacing.sm }} />
        {/*
          어떤 이유로든 받기가 동작하지 않아도 플레이어가 화면에 갇히지 않게 한다.
          닫아도 보상은 사라지지 않고 다음 복귀 때 다시 계산된다 (계획서 7).
        */}
        <Button
          label="나중에 받기"
          tone="secondary"
          onPress={() => store.dismissPendingOffline()}
          hint="보상은 사라지지 않고 다음에 다시 안내합니다"
        />
      </Panel>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    // Android에서 탭 내비게이터 위로 확실히 올라오게 한다.
    elevation: 24,
    zIndex: 100,
  },
  card: {
    width: '100%',
    maxWidth: 420,
  },
});
