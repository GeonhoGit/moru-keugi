/**
 * 여러 스프라이트를 같은 박자로 돌리는 기준 시각.
 *
 * 대장장이가 풀무를 누르는 순간에 풀무가 벌어져 있으면 두 그림이 따로 논다.
 * 컴포넌트끼리 신호를 주고받는 대신, 모두 같은 기준 시각으로부터 몇 번째 프레임인지를
 * 계산하면 서로를 몰라도 박자가 맞는다. 각자 자기 타이머로 다시 그리므로
 * 부모가 매 프레임 다시 그려지는 일도 없다 (계획서 13.4).
 */

/** 앱이 시작한 시각. 모든 계산의 기준점이다. */
const EPOCH = Date.now();

/**
 * 지금 몇 번째 프레임인가.
 *
 * 같은 `frameMs`와 프레임 수를 쓰는 스프라이트끼리는 언제 그리든 같은 값이 나온다.
 * 타이머가 조금씩 밀려도 시각으로 다시 계산하므로 시간이 지나도 어긋나지 않는다.
 */
export const phaseFrame = (frameMs: number, frameCount: number): number => {
  if (frameMs <= 0 || frameCount <= 0) return 0;
  return Math.floor((Date.now() - EPOCH) / frameMs) % frameCount;
};
