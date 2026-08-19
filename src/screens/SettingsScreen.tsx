/**
 * 설정 화면 (계획서 12.1 / 14 / 8.6).
 * 사운드, 햅틱, 접근성, 데이터 초기화, 정책 링크를 담는다.
 */
import React, { useState } from 'react';
import { Modal, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useGameStore, useGameValue } from '../state/GameContext';
import { colors, radius, spacing, typography } from '../theme/index';
import { AppText, Button, Divider, Panel, Screen } from '../components/index';

/** 초기화를 확정하려면 이 문구를 그대로 입력해야 한다 (계획서 8.6). */
const RESET_PHRASE = '초기화';

export const SettingsScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const store = useGameStore();
  const settings = useGameValue(
    (snapshot) => snapshot.state.settings,
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  const [resetStage, setResetStage] = useState<'idle' | 'confirm' | 'phrase'>('idle');
  const [phrase, setPhrase] = useState('');

  return (
    <Screen>
      <Panel>
        <AppText variant="title">표시</AppText>
        <Divider />
        <ToggleRow
          label="한국식 단위 사용"
          description="1.25K 대신 1.25만 형태로 표시합니다."
          value={settings.numberFormat === 'korean'}
          onChange={(value) => store.updateSettings({ numberFormat: value ? 'korean' : 'short' })}
        />
      </Panel>

      <Panel>
        <AppText variant="title">소리와 진동</AppText>
        <Divider />
        <ToggleRow
          label="효과음"
          description="타격과 완료 알림 소리를 켭니다."
          value={settings.sfxVolume > 0}
          onChange={(value) => store.updateSettings({ sfxVolume: value ? 0.8 : 0 })}
        />
        <ToggleRow
          label="배경 음악"
          description="화로 단계에 따라 음악이 바뀝니다."
          value={settings.bgmVolume > 0}
          onChange={(value) => store.updateSettings({ bgmVolume: value ? 0.5 : 0 })}
        />
        <ToggleRow
          label="햅틱"
          description="타격과 완료 시 진동으로 알립니다."
          value={settings.hapticsEnabled}
          onChange={(value) => store.updateSettings({ hapticsEnabled: value })}
        />
      </Panel>

      <Panel>
        <AppText variant="title">접근성</AppText>
        <Divider />
        <ToggleRow
          label="모션 줄이기"
          description="화면 흔들림, 반짝임, 숫자 튀김을 줄입니다."
          value={settings.reduceMotion}
          onChange={(value) => store.updateSettings({ reduceMotion: value })}
        />
        <AppText variant="caption" color={colors.textMuted}>
          글자 크기는 기기 설정을 따릅니다.
        </AppText>
      </Panel>

      <Panel>
        <AppText variant="title">데이터</AppText>
        <Divider />
        <AppText variant="caption" color={colors.textMuted}>
          진행은 자동으로 저장되며, 저장본이 손상되면 직전 백업에서 복구합니다.
        </AppText>
        <View style={{ height: spacing.sm }} />
        <Button
          label="게임 데이터 초기화"
          tone="danger"
          onPress={() => setResetStage('confirm')}
          hint="모든 진행이 사라집니다"
        />
      </Panel>

      <Panel>
        <AppText variant="title">정보</AppText>
        <Divider />
        <AppText variant="caption" color={colors.textMuted}>
          모루 키우기 V1.0
        </AppText>
        <View style={{ height: spacing.xs }} />
        <AppText variant="caption" color={colors.textMuted}>
          이 게임은 개인정보를 수집하지 않고, 진행 데이터는 이 기기에만 저장됩니다.
        </AppText>
        <View style={{ height: spacing.xs }} />
        {/*
          개인정보처리방침·이용약관 초안은 docs/legal/ 에 있습니다.
          공개 URL이 정해지면 여기에 링크 버튼을 답니다 (계획서 16절).
        */}
        <AppText variant="caption" color={colors.textDisabled}>
          개인정보처리방침 · 이용약관 링크는 스토어 등록 시 연결됩니다.
        </AppText>
      </Panel>

      <Button label="닫기" tone="secondary" onPress={onClose} />

      <Modal
        visible={resetStage !== 'idle'}
        transparent
        animationType="fade"
        // edge-to-edge 환경에서 Dialog 창의 터치 영역이 어긋나지 않게 한다.
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setResetStage('idle')}
      >
        <View style={styles.modalBackdrop}>
          <Panel style={styles.modalCard}>
            {resetStage === 'confirm' ? (
              <>
                <AppText variant="title">정말 초기화할까요?</AppText>
                <View style={{ height: spacing.sm }} />
                <AppText variant="caption" color={colors.textMuted}>
                  잉걸불, 업그레이드, 업적, 명인의 인장까지 전부 사라집니다. 되돌릴 수 없습니다.
                </AppText>
                <View style={{ height: spacing.lg }} />
                <Button label="계속" tone="danger" onPress={() => setResetStage('phrase')} />
                <View style={{ height: spacing.sm }} />
                <Button label="취소" tone="secondary" onPress={() => setResetStage('idle')} />
              </>
            ) : (
              <>
                <AppText variant="title">확인 문구 입력</AppText>
                <View style={{ height: spacing.sm }} />
                <AppText variant="caption" color={colors.textMuted}>
                  {`"${RESET_PHRASE}"를 그대로 입력하면 데이터를 지웁니다.`}
                </AppText>
                <View style={{ height: spacing.md }} />
                <TextInput
                  accessibilityLabel="초기화 확인 문구"
                  value={phrase}
                  onChangeText={setPhrase}
                  placeholder={RESET_PHRASE}
                  placeholderTextColor={colors.textDisabled}
                  style={styles.input}
                />
                <View style={{ height: spacing.lg }} />
                <Button
                  label="초기화"
                  tone="danger"
                  disabled={phrase.trim() !== RESET_PHRASE}
                  onPress={() => {
                    void store.resetGame();
                    setPhrase('');
                    setResetStage('idle');
                    onClose();
                  }}
                />
                <View style={{ height: spacing.sm }} />
                <Button
                  label="취소"
                  tone="secondary"
                  onPress={() => {
                    setPhrase('');
                    setResetStage('idle');
                  }}
                />
              </>
            )}
          </Panel>
        </View>
      </Modal>
    </Screen>
  );
};

const ToggleRow: React.FC<{
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, description, value, onChange }) => (
  <View style={styles.toggleRow}>
    <View style={styles.toggleText}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="caption" color={colors.textMuted}>
        {description}
      </AppText>
    </View>
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.border, true: colors.accentDeep }}
      thumbColor={colors.text}
    />
  </View>
);

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
    minHeight: 48,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
});
