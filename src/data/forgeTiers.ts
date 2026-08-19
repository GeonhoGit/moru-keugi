import type { ForgeTierDefinition } from '../types/index';

/**
 * 화로 티어 (계획서 6.1).
 * 환생 후에도 유지되는 평생 누적 잉걸불로 판정한다.
 *
 * 임계값은 계획서의 초기 기준(300 / 8,000 / 200,000)이 아니라 시뮬레이션 곡선에 맞춘 값이다.
 * 계획서 6.1도 "수치는 초기 기준이며 실제 플레이 테스트 후 조정한다"고 적어 두었고,
 * 초기 기준을 그대로 쓰면 첫 티어 변화가 40초 만에 일어나 6.2의 "약 5분" 목표와 어긋났다.
 * 지금 값은 티어 1을 약 4분, 티어 2를 약 1시간, 티어 3을 첫 환생 무렵(약 1일)에 놓는다.
 * 배경·패널 색은 유지하고 강조색만 바뀌므로 리소스 제작 부담이 적다 (4.6).
 */
export const FORGE_TIERS: readonly ForgeTierDefinition[] = [
  {
    tier: 0,
    name: '초심자의 화로',
    threshold: '0',
    accentColor: '#ff7a3d', // 주황
    sceneId: 'scene_old_hut',
  },
  {
    tier: 1,
    name: '타오르는 화로',
    threshold: '50000',
    accentColor: '#d1450f', // 진한 주황빛 빨강
    sceneId: 'scene_old_hut_lit',
  },
  {
    tier: 2,
    name: '작열하는 용광로',
    threshold: '1e7',
    accentColor: '#e0b479', // 따뜻한 금빛
    sceneId: 'scene_stone_forge',
  },
  {
    tier: 3,
    name: '용염의 성화',
    threshold: '5e9',
    accentColor: '#cfe6ff', // 하늘빛 백광
    sceneId: 'scene_royal_forge',
  },
];
