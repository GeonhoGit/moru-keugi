/**
 * 상점 화면 (계획서 12.1 / 5.7).
 *
 * 계획서 5.7이 요구한 항목을 모두 표시한다:
 * 현재 보유 수, 현재 생산 기여량, 구매 후 증가량·증가율, 구매 가격,
 * 구매 가능까지 예상 시간, 다음 마일스톤까지 남은 수량.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatNumber } from '../engine/bignum';
import { getPurchasePlan, getVisibleUpgrades } from '../engine/upgrades';
import { useGameStore, useGameValue } from '../state/GameContext';
import { colors, spacing } from '../theme/index';
import { AppText, Button, EmptyState, Panel, Screen } from '../components/index';
import { PixelCanvas } from '../components/PixelCanvas';
import { UPGRADE_ICONS } from '../data/icons';
import { getForgeTier } from '../engine/forge';
import type { PurchaseMode } from '../types/index';

const MODES: readonly { readonly mode: PurchaseMode; readonly label: string }[] = [
  { mode: 1, label: '1개' },
  { mode: 10, label: '10개' },
  { mode: 'max', label: '최대' },
];

export const ShopScreen: React.FC = () => {
  const [mode, setMode] = useState<PurchaseMode>(1);

  const visibleIds = useGameValue(
    (snapshot) => getVisibleUpgrades(snapshot.state).map((entry) => entry.definition.id).join(','),
  );

  const ids = visibleIds ? visibleIds.split(',') : [];

  return (
    <Screen>
      <View style={styles.modeRow}>
        {MODES.map((option) => (
          <Button
            key={String(option.mode)}
            label={option.label}
            compact
            tone={mode === option.mode ? 'primary' : 'secondary'}
            onPress={() => setMode(option.mode)}
            hint={`구매 수량을 ${option.label}로 바꿉니다`}
          />
        ))}
      </View>

      {ids.length === 0 ? (
        <EmptyState title="아직 살 수 있는 것이 없습니다" body="모루를 두드려 잉걸불을 모으세요." />
      ) : (
        ids.map((id) => <UpgradeCard key={id} upgradeId={id} mode={mode} />)
      )}
    </Screen>
  );
};

const UpgradeCard: React.FC<{ upgradeId: string; mode: PurchaseMode }> = ({ upgradeId, mode }) => {
  const store = useGameStore();

  const view = useGameValue(
    (snapshot) => {
      const format = snapshot.state.settings.numberFormat;
      const entries = getVisibleUpgrades(snapshot.state);
      const entry = entries.find((candidate) => candidate.definition.id === upgradeId);
      if (!entry) return null;

      const plan = getPurchasePlan(snapshot.state, upgradeId, mode);

      const isProduction =
        entry.definition.type === 'auto' || entry.definition.type === 'click';
      const unit = entry.definition.type === 'click' ? '타격당' : '초당';

      return {
        name: entry.definition.name,
        description: entry.definition.description,
        accent: getForgeTier(snapshot.state.lifetimeEmber).accentColor,
        owned: entry.owned,
        atMaxLevel: entry.atMaxLevel,
        maxLevel: entry.definition.maxLevel ?? null,
        current: isProduction ? formatNumber(entry.currentContribution, format) : null,
        after: isProduction ? formatNumber(entry.contributionAfterPurchase, format) : null,
        increase: entry.increaseRatio === null ? null : `+${entry.increaseRatio.toFixed(1)}%`,
        unit,
        cost: formatNumber(plan.cost, format),
        count: plan.count,
        affordable: plan.affordable,
        milestone: entry.nextMilestone,
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  if (!view) return null;

  const icon = UPGRADE_ICONS[upgradeId] ?? null;

  const buttonLabel = view.atMaxLevel
    ? '최대 단계'
    : view.count === 0
      ? '구매 불가'
      : `${view.count}개 구매 · ${view.cost}`;

  return (
    <Panel>
      <View style={styles.cardHeader}>
        <View style={styles.titleGroup}>
          {icon ? (
            <PixelCanvas sprite={icon} scale={2} paletteOverride={{ A: view.accent }} />
          ) : null}
          <AppText variant="title">{view.name}</AppText>
        </View>
        <AppText variant="mono" color={colors.gold}>
          {view.maxLevel === null ? `Lv.${view.owned}` : `${view.owned}/${view.maxLevel}`}
        </AppText>
      </View>

      {view.current !== null && view.after !== null ? (
        <AppText variant="caption" color={colors.textMuted}>
          {`${view.unit} ${view.current} → ${view.after}${view.increase ? ` (${view.increase})` : ''}`}
        </AppText>
      ) : null}

      {view.milestone ? (
        <AppText variant="caption" color={colors.textMuted}>
          {`${view.milestone.atCount}단계 ×${view.milestone.multiplier}까지 ${view.milestone.remaining}개`}
        </AppText>
      ) : null}

      <View style={{ height: spacing.xs }} />

      <Button
        label={buttonLabel}
        disabled={!view.affordable}
        onPress={() => store.buyUpgrade(upgradeId, mode)}
        hint={view.affordable ? `잉걸불 ${view.cost}을 사용합니다` : undefined}
      />
    </Panel>
  );
};

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardHeader: {
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
