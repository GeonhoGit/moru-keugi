/** 계획서 4.4 / 4.6 - 일하는 모습 애니메이션 규칙 */
import { describe, expect, it } from 'vitest';
import {
  APPRENTICE_GRID,
  APPRENTICE_HAMMER_COLUMN,
  APPRENTICE_HEAT_FRAMES,
  APPRENTICE_HEAT_FRAMES_LEFT,
  APPRENTICE_PUMP_FRAMES,
  APPRENTICE_PUMP_FRAMES_LEFT,
  APPRENTICE_WALK_FRAMES,
  APPRENTICE_WALK_FRAMES_LEFT,
  APPRENTICE_WORK_FRAMES,
  APPRENTICE_WORK_FRAMES_LEFT,
  mirrorColumn,
  WORKER_ANIMATIONS,
  WORKER_FRAMES,
} from '../workers';
import { UPGRADE_BY_ID } from '../upgrades';
import { PIXEL_GRID, validateSprite } from '../../theme/pixel';

describe('일꾼 애니메이션 (계획서 4.6)', () => {
  it('설비는 계획서가 정한 2~3프레임 범위를 지킨다', () => {
    // 제작 비용을 아끼려는 규칙이다. 설비는 반복 운동이라 두세 장이면 읽힌다.
    for (const animation of WORKER_ANIMATIONS) {
      if (animation.upgradeId === 'apprentice') continue;
      expect(animation.frames.length, animation.label).toBeGreaterThanOrEqual(2);
      expect(animation.frames.length, animation.label).toBeLessThanOrEqual(3);
    }
  });

  it('망치질은 6프레임이다', () => {
    // 세 장이면 내려친 뒤 곧바로 위로 순간이동해 동작으로 읽히지 않는다.
    // 들어 올리는 데 네 칸, 내려치는 데 두 칸을 써서 빠르기 차이를 만든다.
    const apprentice = WORKER_ANIMATIONS.find((a) => a.upgradeId === 'apprentice')!;
    expect(apprentice.frames.length).toBe(6);
    expect(APPRENTICE_WORK_FRAMES.length).toBe(6);
  });

  it('망치질 한 바퀴가 사람이 망치를 쓰는 빠르기 안에 있다', () => {
    // 너무 빠르면 떨리는 것으로, 너무 느리면 허공을 젓는 것으로 보인다.
    const apprentice = WORKER_ANIMATIONS.find((a) => a.upgradeId === 'apprentice')!;
    const cycleMs = apprentice.frames.length * apprentice.frameMs;
    expect(cycleMs).toBeGreaterThanOrEqual(500);
    expect(cycleMs).toBeLessThanOrEqual(1000);
  });

  it('모든 프레임이 계획서가 허용한 그리드와 팔레트 규칙을 지킨다', () => {
    // 일꾼은 24칸을 쓴다. 16칸에서는 망치 머리에 쓸 칸이 2×2뿐이라
    // 무엇을 들었는지 읽히지 않았다 (계획서 4.6의 그리드 목록 안에 있는 값이다).
    for (const sprite of WORKER_FRAMES) {
      expect([PIXEL_GRID.icon, PIXEL_GRID.iconLarge]).toContain(sprite.grid);
      expect(validateSprite(sprite)).toEqual([]);
    }
  });

  it('사람과 기계의 프레임 간격이 달라 한 몸처럼 움직이지 않는다', () => {
    const apprentice = WORKER_ANIMATIONS.find((animation) => animation.upgradeId === 'apprentice')!;
    const machines = WORKER_ANIMATIONS.filter((animation) => animation.upgradeId !== 'apprentice');

    for (const machine of machines) {
      expect(machine.frameMs).not.toBe(apprentice.frameMs);
    }
  });

  it('풀무와 석탄 화로는 같은 간격을 써서 한 동작으로 이어진다', () => {
    // 풀무가 그 화로에 바람을 넣는다. 간격이 다르면 두 설비가 서로 무관해 보인다.
    const bellows = WORKER_ANIMATIONS.find((animation) => animation.upgradeId === 'bellows')!;
    const coalForge = WORKER_ANIMATIONS.find((animation) => animation.upgradeId === 'coal_forge')!;

    expect(coalForge.frameMs).toBe(bellows.frameMs);
  });
});

describe('왼쪽을 보는 동작', () => {
  const PAIRS = [
    ['걷기', APPRENTICE_WALK_FRAMES, APPRENTICE_WALK_FRAMES_LEFT],
    ['망치질', APPRENTICE_WORK_FRAMES, APPRENTICE_WORK_FRAMES_LEFT],
    ['달구기', APPRENTICE_HEAT_FRAMES, APPRENTICE_HEAT_FRAMES_LEFT],
    ['풀무', APPRENTICE_PUMP_FRAMES, APPRENTICE_PUMP_FRAMES_LEFT],
  ] as const;

  it('모든 동작에 왼쪽 프레임이 있고 프레임 수가 같다', () => {
    // 수가 다르면 방향이 바뀔 때 동작 순서가 끊긴다.
    for (const [name, right, left] of PAIRS) {
      expect(left.length, name).toBe(right.length);
      expect(left.length, name).toBeGreaterThan(0);
    }
  });

  it('왼쪽 프레임은 오른쪽 프레임을 좌우로 뒤집은 그림이다', () => {
    for (const [name, right, left] of PAIRS) {
      right.forEach((frame, index) => {
        const mirrored = frame.rows.map((row) => [...row].reverse().join(''));
        expect(left[index]!.rows, `${name} ${index}`).toEqual(mirrored);
      });
    }
  });

  it('왼쪽 프레임도 그리드와 팔레트 규칙을 지킨다', () => {
    for (const [, , left] of PAIRS) {
      for (const frame of left) {
        expect(frame.grid).toBe(PIXEL_GRID.iconLarge);
        expect(validateSprite(frame)).toEqual([]);
      }
    }
  });

  it('왼쪽 프레임의 id가 서로도, 오른쪽과도 겹치지 않는다', () => {
    // 같은 스프라이트를 두 목록에 함께 넣는 경우가 있어(석탄 화로) 전체 중복은 보지 않는다.
    const leftIds = PAIRS.flatMap(([, , left]) => left.map((frame) => frame.id));
    const rightIds = PAIRS.flatMap(([, right]) => right.map((frame) => frame.id));

    expect(new Set(leftIds).size).toBe(leftIds.length);
    for (const id of leftIds) {
      expect(id).toMatch(/_left$/);
      expect(rightIds).not.toContain(id);
    }
  });

  it('검증 목록이 왼쪽 프레임까지 훑는다', () => {
    const covered = WORKER_FRAMES.map((frame) => frame.id);
    for (const [, , left] of PAIRS) {
      for (const frame of left) expect(covered).toContain(frame.id);
    }
  });

  it('도구 칸을 뒤집으면 반대편 끝에서 같은 거리에 온다', () => {
    // 맨 오른쪽 칸(23)은 뒤집으면 0번이 된다. `grid - c`가 아니라 `grid - 1 - c`다.
    expect(mirrorColumn(APPRENTICE_GRID - 1)).toBe(0);
    expect(mirrorColumn(0)).toBe(APPRENTICE_GRID - 1);
    expect(mirrorColumn(mirrorColumn(APPRENTICE_HAMMER_COLUMN))).toBe(APPRENTICE_HAMMER_COLUMN);
  });

  it('뒤집은 칸에 실제로 도구가 있다', () => {
    // 오른쪽 망치질 프레임에서 망치가 있는 칸이, 왼쪽 프레임에서는 뒤집힌 칸에 있어야 한다.
    const right = APPRENTICE_WORK_FRAMES[0]!;
    const left = APPRENTICE_WORK_FRAMES_LEFT[0]!;
    const column = APPRENTICE_HAMMER_COLUMN;

    right.rows.forEach((row, index) => {
      expect(left.rows[index]![mirrorColumn(column)], `${index}행`).toBe(row[column]);
    });
  });
});

describe('일꾼과 업그레이드의 연결', () => {
  it('존재하는 업그레이드만 가리킨다', () => {
    for (const animation of WORKER_ANIMATIONS) {
      expect(UPGRADE_BY_ID.has(animation.upgradeId)).toBe(true);
    }
  });

  it('자동 생산형만 일꾼으로 세운다', () => {
    // 타격형은 플레이어가 두드리는 모루가 이미 화면에 있다.
    for (const animation of WORKER_ANIMATIONS) {
      expect(UPGRADE_BY_ID.get(animation.upgradeId)!.type).toBe('auto');
    }
  });

  it('모든 자동 생산 업그레이드에 일하는 모습이 있다', () => {
    const autoIds = [...UPGRADE_BY_ID.values()]
      .filter((definition) => definition.type === 'auto')
      .map((definition) => definition.id);
    const animated = WORKER_ANIMATIONS.map((animation) => animation.upgradeId);

    for (const id of autoIds) {
      expect(animated).toContain(id);
    }
  });

  it('같은 업그레이드를 중복해서 세우지 않는다', () => {
    const ids = WORKER_ANIMATIONS.map((animation) => animation.upgradeId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
