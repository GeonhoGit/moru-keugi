/**
 * 환생 모달 (계획서 12.1 / 12.4 / 6.4).
 *
 * 대장간 화면에서 별도 모달로 진입시켜 실수로 인한 초기화를 막는다.
 * 초기화 항목, 유지 항목, 예상 인장, 강화 후 예상 생산량을 미리 보여 준다.
 */
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { formatNumber } from '../engine/bignum';
import { getPrestigePreview, getPrestigeSkillViews } from '../engine/prestige';
import { useGameStore, useGameValue } from '../state/GameContext';
import { colors, spacing } from '../theme/index';
import { AppText, Button, Divider, Panel, StatRow } from '../components/index';

export const PrestigeModal: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const store = useGameStore();
  const [confirming, setConfirming] = useState(false);

  const view = useGameValue(
    (snapshot) => {
      const format = snapshot.state.settings.numberFormat;
      const preview = getPrestigePreview(snapshot.state);
      return {
        sealsGained: preview.sealsGained,
        canPrestige: preview.canPrestige,
        resets: preview.resets,
        keeps: preview.keeps,
        projected: formatNumber(preview.projectedAutoRate, format),
        seals: snapshot.state.prestige.masterSeals,
        prestigeCount: snapshot.state.prestige.count,
        skills: getPrestigeSkillViews(snapshot.state).map((entry) => ({
          id: entry.skill.id,
          name: entry.skill.name,
          description: entry.skill.description,
          level: entry.level,
          maxLevel: entry.skill.maxLevel,
          cost: entry.cost,
          affordable: entry.affordable,
          atMaxLevel: entry.atMaxLevel,
        })),
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  const isFirstPrestige = view.prestigeCount === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="display">환생</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            대장간을 처음부터 다시 세우고, 그동안의 솜씨를 명인의 인장으로 남깁니다.
          </AppText>

          <Panel>
            <StatRow label="이번에 얻는 명인의 인장" value={`${view.sealsGained}개`} />
            <StatRow label="보유 인장" value={`${view.seals}개`} />
            <StatRow label="환생 횟수" value={`${view.prestigeCount}회`} />
            <Divider />
            <StatRow label="같은 구성을 되찾았을 때 초당 생산" value={view.projected} muted />
            <AppText variant="caption" color={colors.textMuted}>
              얻은 인장을 모두 자동 풀무에 투자했다고 가정한 값입니다.
            </AppText>
          </Panel>

          <Panel>
            <AppText variant="title">초기화되는 것</AppText>
            <Divider />
            {view.resets.map((item) => (
              <AppText key={item} variant="caption" color={colors.textMuted}>
                {`· ${item}`}
              </AppText>
            ))}
          </Panel>

          <Panel>
            <AppText variant="title">그대로 남는 것</AppText>
            <Divider />
            {view.keeps.map((item) => (
              <AppText key={item} variant="caption" color={colors.textMuted}>
                {`· ${item}`}
              </AppText>
            ))}
          </Panel>

          {isFirstPrestige ? (
            <Panel raised>
              <AppText variant="label" color={colors.gold}>
                첫 환생 안내
              </AppText>
              <View style={{ height: spacing.xs }} />
              <AppText variant="caption" color={colors.textMuted}>
                환생은 손해가 아닙니다. 잉걸불과 업그레이드는 사라지지만, 명인의 인장으로 산
                영구 강화는 다음 생애부터 계속 남아 진행이 훨씬 빨라집니다.
              </AppText>
            </Panel>
          ) : null}

          <Panel>
            <AppText variant="title">명인의 인장 영구 강화</AppText>
            <Divider />
            {view.skills.map((skill) => (
              <View key={skill.id} style={styles.skillRow}>
                <View style={styles.skillText}>
                  <AppText variant="label">
                    {`${skill.name} ${skill.level}/${skill.maxLevel}`}
                  </AppText>
                  <AppText variant="caption" color={colors.textMuted}>
                    {skill.description}
                  </AppText>
                </View>
                <Button
                  label={skill.atMaxLevel ? '최대' : `인장 ${skill.cost}`}
                  compact
                  disabled={skill.atMaxLevel || !skill.affordable}
                  onPress={() => store.buyPrestigeSkill(skill.id)}
                  hint={skill.atMaxLevel ? undefined : `${skill.name} 단계를 올립니다`}
                />
              </View>
            ))}
          </Panel>

          {confirming ? (
            <Panel raised>
              <AppText variant="title">환생을 실행할까요?</AppText>
              <View style={{ height: spacing.sm }} />
              <AppText variant="caption" color={colors.textMuted}>
                {`지금 환생하면 명인의 인장 ${view.sealsGained}개를 얻고 현재 진행이 초기화됩니다.`}
              </AppText>
              <View style={{ height: spacing.md }} />
              <Button
                label="환생하기"
                tone="danger"
                onPress={() => {
                  store.prestige();
                  setConfirming(false);
                  onClose();
                }}
              />
              <View style={{ height: spacing.sm }} />
              <Button label="돌아가기" tone="secondary" onPress={() => setConfirming(false)} />
            </Panel>
          ) : (
            <Button
              label={view.canPrestige ? '환생 준비' : '아직 환생할 수 없습니다'}
              disabled={!view.canPrestige}
              onPress={() => setConfirming(true)}
              hint={
                view.canPrestige
                  ? '확인 화면을 한 번 더 거칩니다'
                  : '이번 생애 누적 잉걸불이 더 필요합니다'
              }
            />
          )}

          <Button label="닫기" tone="secondary" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  skillText: {
    flex: 1,
    gap: 2,
  },
});
