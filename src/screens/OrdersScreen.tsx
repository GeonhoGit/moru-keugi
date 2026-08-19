/**
 * 주문 화면 (계획서 12.1 / 4.3).
 * 제작 주문 선택, 진행, 보상 수령을 담당한다.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatDuration, formatNumber } from '../engine/bignum';
import { getOrderSlotViews } from '../engine/orders';
import { useGameStore, useGameValue } from '../state/GameContext';
import { colors, spacing } from '../theme/index';
import { AppText, Button, EmptyState, Panel, ProgressBar, Screen } from '../components/index';
import { PixelCanvas } from '../components/PixelCanvas';
import { ORDER_ICONS } from '../data/icons';
import { getForgeTier } from '../engine/forge';

export const OrdersScreen: React.FC = () => {
  const store = useGameStore();

  const views = useGameValue(
    (snapshot) => {
      const format = snapshot.state.settings.numberFormat;
      const accent = getForgeTier(snapshot.state.lifetimeEmber).accentColor;
      // 저장소가 주는 시각을 쓴다. 여기서 Date.now()를 부르면 선택자가
      // 부를 때마다 다른 값을 돌려줘 무한 렌더 루프에 빠진다.
      const now = snapshot.nowMs;
      return getOrderSlotViews(snapshot.state, now).map((slot) => ({
        id: slot.definition.id,
        accent,
        name: slot.definition.name,
        description: slot.definition.description,
        rewards: slot.definition.rewards.map((reward) => reward.label).join(' · '),
        cost: formatNumber(slot.cost, format),
        craftSeconds: slot.definition.craftSeconds,
        status: slot.status,
        progress: slot.progress,
        remaining: formatDuration(slot.remainingSeconds),
        canStart: slot.canStart,
        isRepeat: slot.isRepeat,
        netNegative: slot.netEmber.sign() < 0,
      }));
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  if (views.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="지금 받을 수 있는 주문이 없습니다"
          body="대장간을 키우면 새로운 주문이 들어옵니다."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {views.map((view) => (
        <Panel key={view.id}>
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              {ORDER_ICONS[view.id] ? (
                <PixelCanvas
                  sprite={ORDER_ICONS[view.id]!}
                  scale={2}
                  paletteOverride={{ A: view.accent }}
                />
              ) : null}
              <AppText variant="title">{view.name}</AppText>
            </View>
            {view.isRepeat ? (
              <AppText variant="caption" color={colors.textMuted}>
                반복 주문
              </AppText>
            ) : null}
          </View>

          <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
            {view.description}
          </AppText>

          <View style={{ height: spacing.xs }} />

          <AppText variant="caption" color={colors.textMuted}>
            {`${view.cost} 잉걸불 · ${formatDuration(view.craftSeconds)} · ${view.rewards}`}
          </AppText>

          {view.isRepeat && view.netNegative ? (
            <AppText variant="caption" color={colors.textMuted}>
              도감·장식 보상은 이미 받았습니다.
            </AppText>
          ) : null}

          <View style={{ height: spacing.sm }} />

          {view.status === 'crafting' ? (
            <>
              <ProgressBar ratio={view.progress} label={`${view.name} 제작 진행도`} />
              <View style={{ height: spacing.xs }} />
              <AppText variant="caption" color={colors.textMuted} align="center">
                {`${view.remaining} 남음`}
              </AppText>
            </>
          ) : view.status === 'ready' ? (
            <Button
              label="보상 수령"
              onPress={() => store.claimOrder(view.id)}
              hint={`${view.name} 제작이 끝났습니다`}
            />
          ) : (
            <Button
              label={view.canStart ? '제작 시작' : '잉걸불 부족'}
              disabled={!view.canStart}
              onPress={() => store.startOrder(view.id)}
              hint={view.canStart ? `잉걸불 ${view.cost}을 즉시 사용합니다` : undefined}
            />
          )}
        </Panel>
      ))}
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
});
