/**
 * 대장간 화면 (계획서 12.1).
 * 모루 타격, 잉걸불, 초당 생산량, 화로 연출을 담당한다.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { formatNumber } from '../engine/bignum';
import { getClickPower } from '../engine/production';
import { getForgeProgress } from '../engine/forge';
import { isPrestigeUnlocked } from '../engine/prestige';
import { useGameStore, useGameValue } from '../state/GameContext';
import { colors, radius, spacing } from '../theme/index';
import { AppText, Button, Panel, ProgressBar, Screen } from '../components/index';
import { PixelCanvas } from '../components/PixelCanvas';
import { PixelBackground } from '../components/PixelBackground';
import { HitSpark, type HitSparkHandle } from '../components/HitSpark';
import { WorkshopButton } from '../components/WorkshopButton';
import { getAnvilSprite, getForgeSprite } from '../data/sprites';

export const ForgeScreen: React.FC<{
  onOpenPrestige: () => void;
  onOpenWorkshop: () => void;
}> = ({ onOpenPrestige, onOpenWorkshop }) => {
  const store = useGameStore();

  const format = useGameValue((snapshot) => snapshot.state.settings.numberFormat);
  const reduceMotion = useGameValue((snapshot) => snapshot.state.settings.reduceMotion);
  const clickPower = useGameValue((snapshot) => formatNumber(getClickPower(snapshot.state), format));
  const prestigeReady = useGameValue((snapshot) => isPrestigeUnlocked(snapshot.state));

  const forge = useGameValue((snapshot) => {
    const progress = getForgeProgress(snapshot.state.lifetimeEmber);
    return {
      tier: progress.current.tier,
      tierName: progress.current.name,
      accent: progress.current.accentColor,
      nextName: progress.next?.name ?? null,
      ratio: progress.ratio,
      remaining: formatNumber(progress.remaining, format),
    };
  }, (a, b) => a.tierName === b.tierName && Math.abs(a.ratio - b.ratio) < 0.005);

  const sparkRef = useRef<HitSparkHandle>(null);

  /** 배경이 채울 너비. 정수 배율을 고르려면 실제 크기를 알아야 한다. */
  const [anvilWidth, setAnvilWidth] = useState(0);

  // 타격 반응은 상태가 아니라 애니메이션 값으로 처리한다.
  // 이렇게 해야 타격마다 화면 전체가 다시 그려지지 않는다 (계획서 13.4).
  const scale = useRef(new Animated.Value(1)).current;

  const handleHit = useCallback(() => {
    store.click();
    if (reduceMotion) return;
    sparkRef.current?.play();
    scale.stopAnimation();
    scale.setValue(0.94);
    Animated.timing(scale, {
      toValue: 1,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [store, reduceMotion, scale]);

  return (
    <Screen>
      <Panel style={styles.forgePanel}>
        <PixelCanvas
          sprite={getForgeSprite(forge.tier)}
          scale={3}
          paletteOverride={{ A: forge.accent }}
          accessibilityLabel={`화로 단계: ${forge.tierName}`}
        />
        <ProgressBar
          ratio={forge.ratio}
          color={forge.accent}
          label={forge.nextName ? `${forge.nextName}까지 진행도` : '최고 화로 단계'}
        />
        <AppText variant="caption" color={colors.textMuted} align="center">
          {forge.nextName
            ? `${forge.tierName} · ${forge.nextName}까지 ${forge.remaining}`
            : `${forge.tierName} · 최고 단계`}
        </AppText>
      </Panel>

      <WorkshopButton onPress={onOpenWorkshop} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="모루 타격"
        accessibilityHint={`한 번 두드릴 때 잉걸불 ${clickPower}을 얻습니다`}
        onPress={handleHit}
        style={styles.anvilArea}
      >
        <Animated.View
          style={[
            styles.anvil,
            { borderColor: forge.accent, transform: [{ scale }] },
          ]}
          onLayout={(event) => setAnvilWidth(event.nativeEvent.layout.width)}
        >
          {/* 배경은 맨 뒤에 깔린다. 모루와 숫자가 그 위에 올라간다. */}
          <PixelBackground
            tier={forge.tier}
            availableWidth={anvilWidth}
            borderRadius={radius.lg}
          />

          {/* 도트 스프라이트는 정수 배율(4x)로만 확대한다 (계획서 4.6) */}
          <View>
            <PixelCanvas
              sprite={getAnvilSprite(forge.tier)}
              scale={4}
              paletteOverride={{ A: forge.accent }}
            />
            <HitSpark ref={sparkRef} accent={forge.accent} enabled={!reduceMotion} />
          </View>
          <AppText variant="mono" color={colors.textMuted} align="center">
            {`+${clickPower}`}
          </AppText>
        </Animated.View>
      </Pressable>

      {prestigeReady ? (
        <Button
          label="환생"
          tone="secondary"
          onPress={onOpenPrestige}
          hint="현재 진행을 초기화하고 명인의 인장을 얻습니다"
        />
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  forgePanel: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  anvilArea: {
    // 남는 공간을 전부 타격 영역으로 쓴다 (계획서 14 한 손 조작).
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anvil: {
    width: '100%',
    flex: 1,
    minHeight: 220,
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
});
