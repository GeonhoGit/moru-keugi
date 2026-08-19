/**
 * 앱 진입점.
 *
 * 계획서 12.2의 내비게이션 구조를 그대로 따른다.
 * - V1.0 하단 탭 5개: 대장간 · 상점 · 주문 · 업적 · 기록
 *   (업적은 원안대로라면 기록 화면 안이지만, 달성 조건을 항목마다 보여 주기로 하면서
 *    자리가 모자라 독립 탭으로 뺐다. 계획서 12.2의 2026-08-19 개정)
 * - 설정은 상단 톱니바퀴로 진입
 * - 환생은 별도 모달 (실수로 인한 초기화 방지)
 * - 탭에 미완성 기능을 미리 노출하지 않는다
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  useNavigationContainerRef,
  type ParamListBase,
  type Theme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { createGameStore } from './src/state/gameStore';
import { GameStoreProvider, useGameStore, useGameValue } from './src/state/GameContext';
import { asyncStorageAdapter } from './src/storage/asyncStorageAdapter';
import { createConsoleAnalytics } from './src/services/index';
import { createHapticsService } from './src/services/haptics';
import { createSoundService } from './src/services/sound';
import { ResourceHeader } from './src/components/ResourceHeader';
import { AppText, Button, LoadingScreen, Panel } from './src/components/index';
import { ForgeScreen } from './src/screens/ForgeScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { AchievementsScreen } from './src/screens/AchievementsScreen';
import { RecordsScreen } from './src/screens/RecordsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { WorkshopScreen } from './src/screens/WorkshopScreen';
import { PrestigeModal } from './src/screens/PrestigeModal';
import { OfflineModal } from './src/screens/OfflineModal';
import { TutorialOverlay } from './src/screens/TutorialOverlay';
import { colors, spacing, TAB_BAR_HEIGHT } from './src/theme/index';
import { PixelCanvas } from './src/components/PixelCanvas';
import { Toast } from './src/components/Toast';
import { EXIT_HINT, EXIT_WINDOW_MS, shouldExitOnBack } from './src/navigation/backExit';
import { getCurrentTutorialStep } from './src/data/tutorial';
import { TAB_ICONS } from './src/data/icons';
import type { PixelSpriteData } from './src/theme/pixel';

const Tab = createBottomTabNavigator();

/** 뒤로가기가 되돌아갈 첫 화면. 탭 이름과 정확히 같아야 한다. */
const HOME_TAB = '대장간';

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.panel,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
    notification: colors.accentDeep,
  },
};

export default function App() {
  const store = useMemo(
    () =>
      createGameStore({
        adapter: asyncStorageAdapter,
        analytics: createConsoleAnalytics(__DEV__),
        haptics: createHapticsService(),
        sound: createSoundService(),
      }),
    [],
  );

  return (
    <SafeAreaProvider>
      <GameStoreProvider store={store}>
        <StatusBar style="light" />
        <RootView />
      </GameStoreProvider>
    </SafeAreaProvider>
  );
}

const RootView: React.FC = () => {
  const phase = useGameValue((snapshot) => snapshot.phase);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <LoadingScreen message="대장간을 여는 중…" />
      </SafeAreaView>
    );
  }

  if (phase === 'corrupted') {
    return <CorruptedSaveScreen />;
  }

  return <GameShell />;
};

/**
 * 저장본을 둘 다 읽지 못한 경우 (계획서 8.5 - 앱을 종료시키지 않고 선택지를 준다).
 */
const CorruptedSaveScreen: React.FC = () => {
  const store = useGameStore();
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.centered}>
        <Panel>
          <AppText variant="title">저장 데이터를 읽지 못했습니다</AppText>
          <View style={{ height: spacing.sm }} />
          <AppText variant="caption" color={colors.textMuted}>
            기본 저장본과 백업이 모두 손상되었습니다. 새로 시작하면 이전 진행은 복구할 수 없습니다.
          </AppText>
          <View style={{ height: spacing.lg }} />
          <Button label="새로 시작하기" tone="danger" onPress={() => void store.startFresh()} />
        </Panel>
      </View>
    </SafeAreaView>
  );
};

/**
 * 탭 아이콘. 지정하지 않으면 React Navigation이 기본 자리표시자를 그려
 * 글꼴이 없는 기기에서 빈 사각형(두부 문자)으로 보인다.
 */
const tabIcon = (sprite: PixelSpriteData) => () => <PixelCanvas sprite={sprite} scale={1} />;

const GameShell: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [prestigeOpen, setPrestigeOpen] = useState(false);
  const recovered = useGameValue((snapshot) => snapshot.recoveredFromBackup);
  const saveFailed = useGameValue((snapshot) => snapshot.lastSaveFailed);

  /** 결정을 요구하는 오버레이. 이것들이 떠 있으면 뒤로가기를 삼킨다. */
  const offlineOpen = useGameValue((snapshot) => snapshot.pendingOffline !== null);
  const tutorialOpen = useGameValue((snapshot) => getCurrentTutorialStep(snapshot.state) !== null);

  const navigationRef = useNavigationContainerRef<ParamListBase>();
  /** 마지막으로 첫 화면에서 뒤로가기를 누른 시각 */
  const lastBackAt = useRef<number | null>(null);
  const [exitHint, setExitHint] = useState<{ nonce: number } | null>(null);

  /**
   * 곁화면을 닫은 뒤 대장간으로 보내야 하는가.
   *
   * 설정과 공방은 탭 전체를 대신 그리므로, 닫는 그 순간에는 내비게이터가
   * 아직 화면에 없다. 그래서 바로 이동시킬 수 없고 표시만 남겨 두었다가
   * 내비게이터가 다시 준비되면 그때 옮긴다.
   */
  const [pendingHome, setPendingHome] = useState(false);

  /** 대장간으로 옮긴다. 아직 준비되지 않았으면 표시만 남긴다. */
  const goHome = useCallback(() => {
    if (navigationRef.isReady()) {
      if (navigationRef.getCurrentRoute()?.name !== HOME_TAB) navigationRef.navigate(HOME_TAB);
      setPendingHome(false);
      return;
    }
    setPendingHome(true);
  }, [navigationRef]);

  // 설정·공방이 닫혀 내비게이터가 돌아왔으면 그때 옮긴다.
  useEffect(() => {
    if (!pendingHome || settingsOpen || workshopOpen) return;
    if (navigationRef.isReady()) {
      if (navigationRef.getCurrentRoute()?.name !== HOME_TAB) navigationRef.navigate(HOME_TAB);
      setPendingHome(false);
    }
  }, [navigationRef, pendingHome, settingsOpen, workshopOpen]);

  /** 곁화면을 닫고 대장간으로 돌아간다. 닫기 버튼과 뒤로가기가 같은 곳으로 간다. */
  const closePrestige = useCallback(() => {
    setPrestigeOpen(false);
    goHome();
  }, [goHome]);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setPendingHome(true);
  }, []);
  const closeWorkshop = useCallback(() => {
    setWorkshopOpen(false);
    setPendingHome(true);
  }, []);

  /**
   * 뒤로가기 한 번은 "한 단계 뒤로"만 한다.
   *
   * 위에서부터 차례로 본다. 먼저 걸리는 것 하나만 처리하고 `true`를 돌려주면
   * 안드로이드가 앱을 닫지 않는다. 아무것도 걸리지 않는 첫 화면에서만
   * 두 번 연속 눌렀을 때 나간다.
   */
  const handleBack = useCallback((): boolean => {
    // 오프라인 보상과 튜토리얼은 사용자가 직접 골라야 끝난다.
    // 뒤로가기로 아무거나 대신 고르지 않고, 앱이 닫히는 것만 막는다.
    if (offlineOpen || tutorialOpen) return true;

    // 곁화면은 모두 대장간으로 돌아간다.
    if (prestigeOpen) {
      closePrestige();
      return true;
    }
    if (settingsOpen) {
      closeSettings();
      return true;
    }
    if (workshopOpen) {
      closeWorkshop();
      return true;
    }

    // 다른 탭에 있으면 먼저 첫 화면으로 돌아온다.
    const currentTab = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
    if (currentTab !== undefined && currentTab !== HOME_TAB) {
      navigationRef.navigate(HOME_TAB);
      return true;
    }

    const now = Date.now();
    if (shouldExitOnBack(lastBackAt.current, now)) {
      lastBackAt.current = null;
      return false; // 안드로이드가 앱을 닫는다
    }

    lastBackAt.current = now;
    setExitHint({ nonce: now });
    return true;
  }, [
    closePrestige,
    closeSettings,
    closeWorkshop,
    navigationRef,
    offlineOpen,
    prestigeOpen,
    settingsOpen,
    tutorialOpen,
    workshopOpen,
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  if (settingsOpen) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <SettingsScreen onClose={closeSettings} />
      </SafeAreaView>
    );
  }

  if (workshopOpen) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <WorkshopScreen onClose={closeWorkshop} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ResourceHeader onOpenSettings={() => setSettingsOpen(true)} />

      {recovered ? <Banner text="저장본이 손상되어 직전 백업에서 복구했습니다." /> : null}
      {saveFailed ? <Banner text="저장에 실패했습니다. 기기 저장 공간을 확인해 주세요." /> : null}

      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        // 설정·공방을 닫아 내비게이터가 막 돌아온 순간을 잡는다.
        onReady={() => {
          if (pendingHome) goHome();
        }}
      >
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: {
              backgroundColor: colors.panel,
              borderTopColor: colors.border,
              // 한 손 조작을 위해 하단 탭을 충분히 크게 잡고 (계획서 14),
              // 제스처 바가 탭을 덮지 않도록 하단 안전 영역을 더한다.
              height: TAB_BAR_HEIGHT + insets.bottom,
              paddingBottom: insets.bottom + 8,
              paddingTop: 8,
            },
            tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          }}
        >
          <Tab.Screen
            name="대장간"
            options={{
              tabBarAccessibilityLabel: '대장간 화면',
              tabBarIcon: tabIcon(TAB_ICONS.forge),
            }}
          >
            {() => (
              <ForgeScreen
                onOpenPrestige={() => setPrestigeOpen(true)}
                onOpenWorkshop={() => setWorkshopOpen(true)}
              />
            )}
          </Tab.Screen>
          <Tab.Screen
            name="상점"
            component={ShopScreen}
            options={{
              tabBarAccessibilityLabel: '상점 화면',
              tabBarIcon: tabIcon(TAB_ICONS.shop),
            }}
          />
          <Tab.Screen
            name="주문"
            component={OrdersScreen}
            options={{
              tabBarAccessibilityLabel: '주문 화면',
              tabBarIcon: tabIcon(TAB_ICONS.orders),
            }}
          />
          <Tab.Screen
            name="업적"
            component={AchievementsScreen}
            options={{
              tabBarAccessibilityLabel: '업적 화면',
              tabBarIcon: tabIcon(TAB_ICONS.achievements),
            }}
          />
          <Tab.Screen
            name="기록"
            component={RecordsScreen}
            options={{
              tabBarAccessibilityLabel: '기록 화면',
              tabBarIcon: tabIcon(TAB_ICONS.records),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>

      <TutorialOverlay />
      <OfflineModal />
      <PrestigeModal visible={prestigeOpen} onClose={closePrestige} />
      <Toast
        message={exitHint ? EXIT_HINT : null}
        nonce={exitHint?.nonce ?? 0}
        durationMs={EXIT_WINDOW_MS}
        onHidden={() => setExitHint(null)}
      />
    </SafeAreaView>
  );
};

const Banner: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.banner}>
    <AppText variant="caption" color={colors.gold}>
      {text}
    </AppText>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  banner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.panelRaised,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
