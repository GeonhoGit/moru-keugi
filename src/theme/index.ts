/**
 * 색상·타이포·간격 (계획서 4.6).
 *
 * 배경과 패널 색은 화로 티어와 무관하게 고정하고 강조색만 티어에 따라 바꾼다.
 * 리소스 제작 부담을 줄이려는 계획서의 결정을 코드에서도 그대로 지킨다.
 */
import type { TextStyle } from 'react-native';
import { FORGE_TIERS } from '../data/forgeTiers';

export const colors = {
  background: '#150f0c', // 진한 차콜 브라운
  panel: '#201811', // 짙은 갈색
  panelRaised: '#2a2018',
  border: '#4a3d31', // 회갈색
  text: '#f5ead9', // 따뜻한 오프화이트
  textMuted: '#a8927c', // 흐린 갈색
  textDisabled: '#6d5c4c',
  accent: '#ff7a3d', // 주요 강조 (잉걸불·불꽃)
  accentDeep: '#d1450f', // 보조 강조 (깊은 불씨)
  gold: '#e0b479', // 3차 강조 (금속·재화)
  success: '#7fb069',
  danger: '#c85a3d',
} as const;

/** 화로 티어별 강조색. 배경·패널은 그대로 두고 이 값만 바꾼다. */
export const getAccentForTier = (tier: number): string =>
  FORGE_TIERS.find((definition) => definition.tier === tier)?.accentColor ?? colors.accent;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

/**
 * 접근성 터치 영역 (계획서 14).
 * iOS 44pt, Android 48dp 중 더 큰 쪽에 맞춘다.
 */
export const MIN_TOUCH_SIZE = 48;

/**
 * 하단 탭 바 높이. 탭 위에 떠야 하는 요소(튜토리얼 안내 등)가
 * 탭을 가리지 않도록 같은 값을 공유한다.
 */
export const TAB_BAR_HEIGHT = 64;

export type TextVariant =
  | 'display'
  | 'title'
  | 'body'
  | 'label'
  | 'caption'
  | 'mono'
  | 'monoLarge';

/**
 * 폰트 패밀리 (계획서 4.6의 타이포그래피 절충안).
 *
 * 원칙: "도트 캐릭터·아이콘 + 모던한 UI 텍스트".
 * 모든 텍스트를 픽셀 폰트로 바꾸면 작은 화면에서 가독성이 떨어지므로,
 * 픽셀 폰트는 큰 제목과 연출용 숫자에만 쓴다.
 *
 * 값이 `undefined`면 플랫폼 기본 글꼴을 쓴다. 실제 폰트 파일은 에셋 제작 방식이
 * 정해진 뒤 Phase 4에서 `expo-font`로 등록하고, 여기 값만 바꾸면 전체에 반영된다.
 */
export const fontFamily = {
  /** 큰 제목·연출용 숫자 — 도트 감성 픽셀 디스플레이 폰트 1종 */
  display: undefined as string | undefined,
  /** 본문·설명·설정 — Noto Sans KR (가독성 우선, 픽셀 폰트로 바꾸지 않는다) */
  body: undefined as string | undefined,
  /** 수치·데이터 — JetBrains Mono 또는 도트 고정폭 */
  mono: undefined as string | undefined,
};

/**
 * `as const`를 쓰지 않는다. 그러면 `fontVariant`가 readonly 튜플이 되어
 * React Native의 `TextStyle`에 넣을 수 없다.
 */
export const typography: Record<TextVariant, TextStyle> = {
  /** 제목·큰 숫자 — 픽셀 디스플레이 폰트 자리 */
  display: { fontSize: 34, fontWeight: '700', letterSpacing: 0.5, fontFamily: fontFamily.display },
  title: { fontSize: 20, fontWeight: '700', fontFamily: fontFamily.display },
  body: { fontSize: 15, fontWeight: '400', fontFamily: fontFamily.body },
  label: { fontSize: 13, fontWeight: '600', fontFamily: fontFamily.body },
  caption: { fontSize: 12, fontWeight: '400', fontFamily: fontFamily.body },
  /**
   * 수치·데이터용 고정폭. 자릿수가 바뀔 때 글자가 흔들리지 않게 한다 (계획서 4.6).
   * 커스텀 폰트를 넣기 전까지는 `tabular-nums`로 자릿수 폭만 고정한다.
   */
  mono: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], fontFamily: fontFamily.mono },
  monoLarge: {
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontFamily: fontFamily.mono,
  },
};
