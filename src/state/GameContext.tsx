/**
 * 저장소를 React에 연결한다.
 *
 * 화면은 `useGameValue`로 필요한 값만 구독한다. 선택한 값이 실제로 바뀔 때만
 * 다시 그려지므로, 초당 10회 도는 게임 루프가 화면 전체를 다시 그리지 않는다
 * (계획서 13.4).
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { GameStore, StoreSnapshot } from './gameStore';

const GameStoreContext = createContext<GameStore | null>(null);

export const GameStoreProvider: React.FC<{
  store: GameStore;
  children: React.ReactNode;
}> = ({ store, children }) => {
  useEffect(() => {
    let cancelled = false;

    void store.initialize().then(() => {
      if (!cancelled) store.start();
    });

    // 생명주기 처리 (계획서 7): 백그라운드 진입 시 즉시 저장, 활성화 시 시간 차이 계산
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') {
        void store.handleForeground();
        store.start();
      } else {
        store.stop();
        void store.handleBackground();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
      store.stop();
      // 화면이 사라질 때도 마지막 상태를 남긴다.
      void store.handleBackground();
    };
  }, [store]);

  return <GameStoreContext.Provider value={store}>{children}</GameStoreContext.Provider>;
};

export const useGameStore = (): GameStore => {
  const store = useContext(GameStoreContext);
  if (!store) throw new Error('GameStoreProvider 안에서만 사용할 수 있습니다.');
  return store;
};

/**
 * 저장소에서 값을 하나 골라 구독한다.
 *
 * 선택한 값이 `isEqual` 기준으로 같으면 이전 값을 그대로 돌려주므로 렌더가 일어나지 않는다.
 * 큰 수는 미리 문자열로 만들어서 고르면 비교가 정확하고 싸다.
 */
export function useGameValue<T>(
  selector: (snapshot: StoreSnapshot) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const store = useGameStore();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const cache = useRef<{ hasValue: boolean; value: T }>({ hasValue: false, value: undefined as T });

  const getSnapshot = useMemo(() => {
    return () => {
      const next = selectorRef.current(store.getSnapshot());
      if (!cache.current.hasValue) {
        cache.current = { hasValue: true, value: next };
        return next;
      }
      if (isEqual(cache.current.value, next)) return cache.current.value;
      cache.current = { hasValue: true, value: next };
      return next;
    };
    // `isEqual`은 렌더마다 새로 만들어질 수 있으므로 의존성에서 뺀다.
    // 비교 함수 자체가 바뀌는 경우는 없다고 보고, 값 비교 결과만 신뢰한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** 배열 얕은 비교. 목록형 선택자에 쓴다. */
export const shallowArrayEqual = <T,>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
