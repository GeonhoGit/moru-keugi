/** 계획서 14 - 뒤로가기로 앱을 나가는 규칙 */
import { describe, expect, it } from 'vitest';
import { EXIT_HINT, EXIT_WINDOW_MS, shouldExitOnBack } from '../backExit';

describe('뒤로가기 두 번 눌러 나가기', () => {
  it('첫 누름으로는 나가지 않는다', () => {
    expect(shouldExitOnBack(null, 1_000)).toBe(false);
  });

  it('창 안에서 다시 누르면 나간다', () => {
    expect(shouldExitOnBack(1_000, 1_000)).toBe(true);
    expect(shouldExitOnBack(1_000, 1_000 + EXIT_WINDOW_MS - 1)).toBe(true);
    expect(shouldExitOnBack(1_000, 1_000 + EXIT_WINDOW_MS)).toBe(true);
  });

  it('창을 벗어나면 다시 첫 누름으로 본다', () => {
    // 한참 뒤에 무심코 누른 것이 종료로 이어지면 안 된다.
    expect(shouldExitOnBack(1_000, 1_000 + EXIT_WINDOW_MS + 1)).toBe(false);
    expect(shouldExitOnBack(1_000, 60_000)).toBe(false);
  });

  it('기기 시각이 뒤로 가도 종료로 취급하지 않는다', () => {
    expect(shouldExitOnBack(5_000, 1_000)).toBe(false);
  });

  it('창은 2초다', () => {
    // 짧으면 안내를 읽고 다시 누르기 전에 만료되고, 길면 무심코 누른 것이 종료가 된다.
    expect(EXIT_WINDOW_MS).toBe(2000);
  });

  it('안내 문구가 한 번 더 눌러야 한다는 것을 알려 준다', () => {
    expect(EXIT_HINT).toContain('한 번 더');
  });
});
