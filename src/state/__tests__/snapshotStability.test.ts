/**
 * 화면 선택자의 안정성 회귀 테스트.
 *
 * `useSyncExternalStore`는 `getSnapshot`이 **같은 스냅샷에서 같은 값**을 돌려주기를
 * 요구한다. 부를 때마다 다른 값이 나오면 React가 무한 렌더 루프로 판단한다.
 *
 * 실제로 주문 화면 선택자가 `Date.now()`를 직접 불러, 제작을 시작하는 순간
 * 진행률이 매번 달라지면서 앱이 죽었다. 그래서 시각은 저장소가 소유하고
 * 화면은 `snapshot.nowMs`만 본다.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryAdapter } from '../../storage/adapter';
import { createGameStore } from '../gameStore';
import { getOrderSlotViews } from '../../engine/orders';
import { getForgeProgress } from '../../engine/forge';

/** 주문을 시작할 수 있을 만큼 두드린 저장소 */
const setupWithStartedOrder = async () => {
  let clock = 1_700_000_000_000;
  const store = createGameStore({
    adapter: createMemoryAdapter(),
    now: () => clock,
  });
  await store.initialize();

  // 농부의 낫(500 잉걸불)을 시작할 만큼 모은다.
  for (let i = 0; i < 600; i += 1) store.click();
  store.startOrder('farmers_scythe');

  return { store, advance: (ms: number) => (clock += ms) };
};

describe('스냅샷 시각 (무한 렌더 루프 방지)', () => {
  it('스냅샷은 같은 객체를 돌려준다', async () => {
    const { store } = await setupWithStartedOrder();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('nowMs는 스냅샷이 바뀌지 않는 한 그대로다', async () => {
    const { store, advance } = await setupWithStartedOrder();
    const first = store.getSnapshot().nowMs;

    // 시간이 흘러도 저장소가 갱신하기 전까지는 화면이 보는 시각이 바뀌지 않는다.
    advance(5_000);
    expect(store.getSnapshot().nowMs).toBe(first);
  });

  it('제작이 진행 중이어도 주문 화면 값이 두 번 호출에서 동일하다', async () => {
    const { store, advance } = await setupWithStartedOrder();

    const build = () => {
      const snapshot = store.getSnapshot();
      return JSON.stringify(
        getOrderSlotViews(snapshot.state, snapshot.nowMs).map((view) => ({
          id: view.definition.id,
          status: view.status,
          progress: view.progress,
          remaining: view.remainingSeconds,
        })),
      );
    };

    // 두 호출 사이에 실제 시간이 흘러도 결과가 같아야 한다.
    const first = build();
    advance(3_000);
    const second = build();

    expect(second).toBe(first);
  });

  it('실제로 제작 중인 상태에서 검증하고 있다', async () => {
    const { store } = await setupWithStartedOrder();
    const snapshot = store.getSnapshot();
    const views = getOrderSlotViews(snapshot.state, snapshot.nowMs);

    expect(views.some((view) => view.status === 'crafting')).toBe(true);
  });
});

describe('다른 화면 선택자도 같은 규칙을 지킨다', () => {
  it('대장간 진행도가 두 번 호출에서 동일하다', async () => {
    const { store, advance } = await setupWithStartedOrder();

    const build = () => {
      const snapshot = store.getSnapshot();
      const progress = getForgeProgress(snapshot.state.lifetimeEmber);
      return `${progress.current.tier}:${progress.ratio}`;
    };

    const first = build();
    advance(3_000);
    expect(build()).toBe(first);
  });
});


describe('화면 코드는 시각을 직접 읽지 않는다', () => {
  /**
   * 위 테스트는 저장소가 안정적인 시각을 준다는 것만 보장한다.
   * 화면이 다시 `Date.now()`를 부르면 같은 버그가 돌아오므로,
   * 그 사용 자체를 막는다.
   */
  const collectFiles = (dir: string): string[] => {
    const entries = readdirSync(dir);
    return entries.flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        return entry === '__tests__' ? [] : collectFiles(full);
      }
      return full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : [];
    });
  };

  /**
   * 유일한 예외.
   *
   * 스프라이트 박자 계산은 저장소와 무관하고, 오히려 시각으로 계산해야
   * 풀무와 그것을 밟는 대장장이가 서로 어긋나지 않는다.
   * 대신 이 파일이 저장소를 건드리지 못하게 아래에서 따로 확인한다.
   */
  const CLOCK_EXEMPT = join('src', 'components', 'spritePhase.ts');

  it('screens 와 components 에 Date.now() 가 없다', () => {
    const roots = [join(process.cwd(), 'src', 'screens'), join(process.cwd(), 'src', 'components')];
    const offenders: string[] = [];

    for (const root of roots) {
      for (const file of collectFiles(root)) {
        if (file.endsWith(CLOCK_EXEMPT)) continue;
        const source = readFileSync(file, 'utf8');
        // 주석에 적힌 설명은 통과시킨다.
        const lines = source.split('\n').filter((line) => {
          const trimmed = line.trim();
          return !trimmed.startsWith('//') && !trimmed.startsWith('*');
        });
        if (lines.some((line) => line.includes('Date.now()'))) {
          offenders.push(file.replace(process.cwd(), ''));
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('예외로 둔 박자 계산기는 저장소를 건드리지 않는다', () => {
    const source = readFileSync(join(process.cwd(), CLOCK_EXEMPT), 'utf8');

    // 저장소를 가져오는 순간 선택자가 될 수 있고, 그러면 막으려던 버그가 돌아온다.
    expect(source).not.toContain("from '../state");
    expect(source).not.toContain('useGameValue');
  });
});
