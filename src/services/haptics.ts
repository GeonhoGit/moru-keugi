/**
 * 햅틱 (계획서 13.3).
 *
 * 일반 타격은 약한 햅틱, 완벽 타격·치명은 중간, 업그레이드·주문 완료는 짧은 성공,
 * 환생은 강한 햅틱 한 번. 설정에서 완전히 끌 수 있어야 한다.
 *
 * 계획서 14의 "햅틱 대체" 요건에 따라, 햅틱이 없거나 꺼져 있어도 시각·청각 피드백만으로
 * 게임이 성립해야 한다. 그래서 이 서비스는 실패해도 조용히 넘어간다.
 */
import * as Haptics from 'expo-haptics';
import type { HapticsService, HapticStrength } from './index';

/**
 * 타격은 초당 수 회 들어오므로 진동을 그대로 다 흘리면
 * 기기가 밀리고 배터리도 닳는다. 최소 간격을 둔다 (계획서 13.4).
 */
const MIN_INTERVAL_MS = 60;

/** 설정에서 햅틱을 껐는지는 저장소가 판단해서 호출 여부를 정한다. */
export const createHapticsService = (): HapticsService => {
  let lastAt = 0;

  return {
    trigger(strength: HapticStrength) {
      const now = Date.now();
      if (now - lastAt < MIN_INTERVAL_MS) return;
      lastAt = now;

      // 네이티브 모듈이 없는 환경(Expo Go 일부·에뮬레이터)에서도 앱이 죽지 않게 한다.
      try {
        switch (strength) {
          case 'light':
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'success':
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
        }
      } catch {
        // 햅틱은 보조 피드백이므로 실패해도 게임 흐름을 막지 않는다.
      }
    },
  };
};
