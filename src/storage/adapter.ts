/**
 * 저장소 어댑터 (계획서 3.4 - 화면이 AsyncStorage를 직접 호출하지 않게 한다).
 *
 * 엔진과 저장 로직은 이 인터페이스만 알고, 실제 구현체는 플랫폼이 정한다.
 * - V1.0 앱: AsyncStorage 구현체 (Expo 프로젝트를 만드는 Phase 2에서 추가)
 * - 테스트·시뮬레이션: `createMemoryAdapter`
 * - 장기 확장: SQLite나 클라우드 저장소로 교체 (계획서 3.1)
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** 저장 키. 접두사를 붙여 다른 앱 데이터와 섞이지 않게 한다. */
export const STORAGE_KEYS = {
  /** 최신 정상 저장본 */
  primary: 'moru:save:primary',
  /** 직전 정상 저장본 */
  backup: 'moru:save:backup',
  /** 검증 전 임시 기록 위치 */
  staging: 'moru:save:staging',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * 메모리 기반 어댑터. 테스트와 시뮬레이션용이다.
 * `failOn`으로 특정 키의 쓰기를 실패시켜 강제 종료·저장 실패 상황을 재현할 수 있다.
 */
export const createMemoryAdapter = (
  initial: Record<string, string> = {},
): StorageAdapter & {
  dump(): Record<string, string>;
  failWritesOn(keys: readonly string[]): void;
} => {
  const store = new Map<string, string>(Object.entries(initial));
  let failingKeys: readonly string[] = [];

  return {
    async getItem(key) {
      return store.get(key) ?? null;
    },
    async setItem(key, value) {
      if (failingKeys.includes(key)) {
        throw new Error(`저장 실패를 흉내 냅니다: ${key}`);
      }
      store.set(key, value);
    },
    async removeItem(key) {
      store.delete(key);
    },
    dump() {
      return Object.fromEntries(store);
    },
    failWritesOn(keys) {
      failingKeys = keys;
    },
  };
};
