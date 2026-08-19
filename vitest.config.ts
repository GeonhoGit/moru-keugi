import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // 계산 루프가 끝나지 않는 회귀를 무한 대기가 아니라 실패로 잡는다.
    testTimeout: 10_000,
  },
});
