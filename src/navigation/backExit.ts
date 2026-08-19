/**
 * 뒤로가기로 앱을 나가는 규칙 (계획서 14 한 손 조작).
 *
 * 안드로이드에서 뒤로가기 한 번에 앱이 꺼지면, 방치형 게임에서는 진행을 보려고
 * 잠깐 다른 화면에 들어갔다 나오는 도중에 앱이 통째로 닫힌다.
 * 그래서 뒤로가기는 먼저 "한 단계 뒤로"만 하고, 더 뒤로 갈 곳이 없는 첫 화면에서만
 * 두 번 연속 눌렀을 때 나간다.
 *
 * 이 파일에는 시간 판정만 둔다. 화면을 아는 부분은 `App.tsx`에 있다.
 */

/**
 * 두 번째 누름을 같은 의사로 인정하는 시간.
 *
 * 짧으면 안내를 읽고 다시 누르기 전에 만료되어 영영 못 나가고,
 * 길면 한참 뒤에 무심코 누른 것이 종료로 이어진다.
 * 안드로이드 앱들이 흔히 쓰는 2초를 따른다.
 */
export const EXIT_WINDOW_MS = 2000;

/** 사용자에게 보여 줄 안내 문구 */
export const EXIT_HINT = '한 번 더 누르면 종료됩니다';

/**
 * 지금 누른 것이 앱을 나가야 하는 두 번째 누름인가.
 *
 * `lastPressAt`이 없으면 첫 누름이다. 창을 벗어났으면 다시 첫 누름으로 본다.
 */
export const shouldExitOnBack = (lastPressAt: number | null, now: number): boolean => {
  if (lastPressAt === null) return false;
  const elapsed = now - lastPressAt;
  // 시계가 뒤로 간 경우(사용자가 기기 시각을 바꿈)를 종료로 취급하지 않는다.
  if (elapsed < 0) return false;
  return elapsed <= EXIT_WINDOW_MS;
};
