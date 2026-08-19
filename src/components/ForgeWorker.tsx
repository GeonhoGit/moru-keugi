/**
 * 공방을 돌아다니는 대장장이 (계획서 4.4 "배경 NPC").
 *
 * 공방은 위에서 비스듬히 내려다보는 시점이라 바닥이 평면이다.
 * 그래서 자리는 (x, y) 두 값을 갖고, y는 곧 앞뒤 깊이이자 그리는 순서다.
 * 앞(아래)에 선 사람이 뒤(위)에 선 사람과 설비를 가린다.
 *
 * 설 수 있는 자리는 부모가 미리 정해 두고 모두가 같은 목록을 나눠 쓴다.
 * 각자 아무 데로나 가면 서로의 위치를 알 길이 없어 두 사람이 한 자리에 겹친다.
 * 자리를 하나씩 잡고 놓는 방식이면 한 자리에 한 명만 선다.
 *
 * 성능(계획서 13.4): 위치는 `Animated`가 네이티브에서 처리하므로 이동만으로는
 * 다시 그려지지 않는다. 프레임 교체와 방향 전환만 이 컴포넌트 안에서 일어나고,
 * 부모 화면은 전혀 다시 그려지지 않는다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import {
  APPRENTICE_HEAT_FRAMES,
  APPRENTICE_HEAT_FRAMES_LEFT,
  APPRENTICE_PUMP_FRAMES,
  APPRENTICE_PUMP_FRAMES_LEFT,
  APPRENTICE_WALK_FRAMES,
  APPRENTICE_WALK_FRAMES_LEFT,
  APPRENTICE_WORK_FRAMES,
  APPRENTICE_WORK_FRAMES_LEFT,
  GROUND_ROW,
} from '../data/workers';
import { PixelCanvas } from './PixelCanvas';
import { phaseFrame } from './spritePhase';
import type { PixelScale, PixelSpriteData } from '../theme/pixel';

const WALK_FRAME_MS = 220;

/** 설비와 박자를 맞출 때 얼마나 자주 다시 계산할지. 짧을수록 어긋남이 줄어든다. */
const PHASE_CHECK_MS = 140;

/**
 * 도착해서 몸을 돌리는 데 걸리는 시간.
 *
 * 걸어온 방향과 일할 방향이 다를 때만 쓴다.
 * 곧바로 뒤집으면 한 프레임 만에 방향이 바뀌어 돌아선 것으로 보이지 않는다.
 * 잠깐 선 채로 있다가 돌아서야 "설비를 마주 본다"는 동작으로 읽힌다.
 */
const TURN_MS = 260;

/** 1dp를 지나는 데 걸리는 시간. 값이 클수록 느긋하게 걷는다. */
const MS_PER_DP = 22;

/** zIndex가 음수가 되지 않게 올려 둔다. */
const LAYER_BASE = 100;

/** 한 번에 걸어다니는 인원. 여럿이 동시에 움직이면 서로를 통과해 지나간다. */
const MAX_MOVING = 1;

/**
 * 설비 앞자리를 얼마나 자주 고르는가.
 * 자리를 완전히 무작위로 고르면 설비를 쓰는 모습이 좀처럼 보이지 않는다.
 */
const STATION_PREFERENCE = 0.75;

/** 발이 차지하는 바닥 넓이(칸). 두 자리가 이보다 가까우면 같은 자리로 본다. */
const FOOTPRINT_COLUMNS = 12;
const FOOTPRINT_ROWS = 5;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

/** 그 자리에서 하는 일 */
export type ForgeTask = 'anvil' | 'forge' | 'bellows';

/** 설 수 있는 자리 하나 */
export interface ForgeSpot {
  /** 스프라이트 왼쪽 끝 x (dp) */
  readonly x: number;
  /** 발이 닿는 바닥선 y (dp). 클수록 앞쪽이고, 그리는 순서도 이 값으로 정한다. */
  readonly y: number;
  readonly task: ForgeTask;
  /** 설비를 바라보는 방향. 설비 오른쪽에 서면 왼쪽(-1)을 본다. */
  readonly facing: 1 | -1;
}

/**
 * 공방 전체의 상황. 형제 컴포넌트들이 같은 것을 나눠 본다.
 *
 * `current`는 이미 찬 자리 번호, `moving`은 지금 걷고 있는 사람 수,
 * `pumping`은 지금 풀무를 밟고 있는 사람 수다.
 * 석탄 화로가 이 값을 보고 불을 키운다 — 두 컴포넌트가 서로를 몰라도
 * 같은 객체를 나눠 보면 연결된 것처럼 움직인다.
 */
export type ForgeSpotClaims = { current: Set<number>; moving: number; pumping: number };

/**
 * 자세별 프레임과 간격.
 *
 * 방향마다 프레임 목록이 따로 있다. 그리는 단계에서 좌우를 뒤집지 않는 이유가 있다.
 * `transform: [{ scaleX: -1 }]`을 `Animated` 값과 같은 배열에 넣으면 RN이 그 정적
 * 값을 애니메이션 노드를 만들 때 한 번 읽어 네이티브에 굳혀 버려, 그 뒤로는
 * 방향을 바꿔도 화면이 따라오지 않는다 (`AnimatedTransform.__getNativeConfig`).
 */
const TASKS: Record<
  ForgeTask,
  { frames: readonly PixelSpriteData[]; framesLeft: readonly PixelSpriteData[]; frameMs: number }
> = {
  // 망치질 한 번이 여섯 프레임이다. 한 바퀴가 약 0.66초로, 실제로 망치를 쓰는 빠르기다.
  anvil: { frames: APPRENTICE_WORK_FRAMES, framesLeft: APPRENTICE_WORK_FRAMES_LEFT, frameMs: 110 },
  // 쇠가 달아오르는 속도. 서두르면 불이 깜빡이는 것처럼 보인다.
  forge: { frames: APPRENTICE_HEAT_FRAMES, framesLeft: APPRENTICE_HEAT_FRAMES_LEFT, frameMs: 460 },
  // 풀무 스프라이트와 같은 간격이어야 한 동작으로 보인다.
  bellows: {
    frames: APPRENTICE_PUMP_FRAMES,
    framesLeft: APPRENTICE_PUMP_FRAMES_LEFT,
    frameMs: 560,
  },
};

/** 설비와 박자를 맞춰야 하는 자세 */
const PHASE_LOCKED: Record<ForgeTask, boolean> = {
  anvil: false,
  forge: false,
  bellows: true,
};

export const ForgeWorker: React.FC<{
  /** 설 수 있는 자리 목록. 모든 일꾼이 같은 배열을 본다. */
  spots: readonly ForgeSpot[];
  /** 이미 찬 자리의 번호 */
  claims: ForgeSpotClaims;
  /** 몇 번째 일꾼인가. 처음 자리를 서로 다른 곳에서 찾기 시작하는 데 쓴다. */
  index: number;
  scale: PixelScale;
  accent: string;
  paused?: boolean;
  /** 여럿이 동시에 출발하지 않도록 시작을 늦춘다 */
  startDelayMs?: number;
}> = ({ spots, claims, index, scale, accent, paused = false, startDelayMs = 0 }) => {
  const footprintWidth = FOOTPRINT_COLUMNS * scale;
  const footprintDepth = FOOTPRINT_ROWS * scale;

  const first = spots[index % Math.max(1, spots.length)];
  const x = useRef(new Animated.Value(first?.x ?? 0)).current;
  /**
   * 발이 닿는 바닥선.
   *
   * `Animated.multiply` 같은 파생 노드로 부호나 배율을 바꾸지 않는다.
   * 그 노드는 렌더할 때마다 새로 만들어지는데, 이 컴포넌트는 프레임이 바뀔 때마다
   * 다시 그려지므로 매번 새 노드가 붙어 네이티브에서 돌던 애니메이션이 끊긴다.
   */
  const y = useRef(new Animated.Value(first?.y ?? 0)).current;

  /** 지금 잡고 있는 자리 번호. 아직 못 잡았으면 -1. */
  const slot = useRef(-1);
  const position = useRef({ x: first?.x ?? 0, y: first?.y ?? 0 });

  const [working, setWorking] = useState(true);
  const [task, setTask] = useState<ForgeTask>('anvil');
  const [facingLeft, setFacingLeft] = useState(false);
  /** 지금 보고 있는 방향. 효과 안에서 읽어야 하므로 상태와 나란히 들고 있는다. */
  const facing = useRef(false);
  const [frame, setFrame] = useState(0);
  /** 앞(아래)에 선 사람이 뒤에 선 사람 위에 그려지도록 순서를 정한다. */
  const [layer, setLayer] = useState(0);

  // 정지 후 다시 걷는 순환. 타이머를 모아 두었다가 정리한다.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /**
   * `paused`는 **걸어다니는 것만** 멈춘다.
   *
   * 자리를 잡고 설비를 마주 보는 것까지 멈추면, 흔들림 줄이기를 켠 사람에게는
   * 일꾼이 방 맨 뒤(첫 렌더의 바닥 높이는 아직 0이다)에 오른쪽만 보고 선 채로 남는다.
   * 멈춰 있어도 제자리에서 제 일을 하는 그림이어야 한다.
   */
  useEffect(() => {
    if (spots.length === 0) return undefined;

    let cancelled = false;
    /** 이 사람이 지금 '걷는 중' 자리를 차지하고 있는가 */
    let holding = false;
    /** 이 사람이 지금 풀무를 밟고 있는가 */
    let pumping = false;

    const setPumping = (next: boolean) => {
      if (next === pumping) return;
      claims.pumping += next ? 1 : -1;
      pumping = next;
    };
    const face = (left: boolean) => {
      facing.current = left;
      setFacingLeft(left);
    };
    const wait = (ms: number, fn: () => void) => {
      const id = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.current.push(id);
    };

    /** 도착해서 그 자리의 일을 시작한다 */
    const settle = (spot: ForgeSpot) => {
      setPumping(spot.task === 'bellows');
      setTask(spot.task);
      face(spot.facing === -1);
      setWorking(true);
      setLayer(Math.round(spot.y));
    };

    /** 비어 있는 자리를 찾아 잡는다. 다 찼으면 시작점을 그대로 쓴다. */
    const claimFrom = (start: number): number => {
      for (let i = 0; i < spots.length; i += 1) {
        const candidate = (start + i) % spots.length;
        if (!claims.current.has(candidate)) {
          claims.current.add(candidate);
          return candidate;
        }
      }
      return start % spots.length;
    };

    // 첫 자리. 사람마다 다른 곳에서 찾기 시작해야 한쪽에 몰리지 않는다.
    slot.current = claimFrom((index * 7) % spots.length);
    const home = spots[slot.current]!;
    x.setValue(home.x);
    y.setValue(home.y);
    position.current = { x: home.x, y: home.y };
    settle(home);

    /** 곧게 걸었을 때 다른 사람이 선 자리를 밟고 지나가는가 */
    const passesThrough = (from: { x: number; y: number }, target: ForgeSpot): boolean => {
      for (let i = 0; i < spots.length; i += 1) {
        if (i === slot.current || !claims.current.has(i)) continue;
        const other = spots[i]!;
        // 직선을 몇 지점으로 나눠 훑는다. 끝점만 보면 도중에 스쳐 지나가는 것을 놓친다.
        for (let t = 0; t <= 1.0001; t += 0.2) {
          const px = from.x + (target.x - from.x) * t;
          const py = from.y + (target.y - from.y) * t;
          if (Math.abs(px - other.x) < footprintWidth && Math.abs(py - other.y) < footprintDepth) {
            return true;
          }
        }
      }
      return false;
    };

    const step = () => {
      if (cancelled) return;

      const from = position.current;

      // 한 번에 한 명만 걷는다. 차례가 아니면 조금 더 일하다 다시 살펴본다.
      if (claims.moving >= MAX_MOVING) {
        wait(randomBetween(600, 1600), step);
        return;
      }

      // 빈 자리 중에서 고른다. 누가 선 자리도, 그 사람을 밟고 가야 하는 자리도 뺀다.
      const free: number[] = [];
      spots.forEach((spot, i) => {
        if (i === slot.current || claims.current.has(i)) return;
        if (passesThrough(from, spot)) return;
        free.push(i);
      });
      // 비어 있는 설비 앞자리가 있으면 대개 그리로 간다.
      const stations = free.filter((i) => spots[i]!.task !== 'anvil');
      const pool = stations.length > 0 && Math.random() < STATION_PREFERENCE ? stations : free;
      if (pool.length === 0) {
        // 길이 막혔으면 잠시 더 일하다 다시 살펴본다.
        wait(randomBetween(1200, 2400), step);
        return;
      }

      const nextSlot = pool[Math.floor(Math.random() * pool.length)]!;
      const target = spots[nextSlot]!;

      // 자리를 먼저 잡고 놓는다. 순서가 반대면 그 틈에 다른 사람이 끼어든다.
      claims.current.add(nextSlot);
      claims.current.delete(slot.current);
      slot.current = nextSlot;

      const dx = target.x - from.x;
      const dy = target.y - from.y;
      const duration = Math.max(400, Math.sqrt(dx * dx + dy * dy) * MS_PER_DP);

      // 1dp도 안 되는 차이로 몸을 뒤집으면 제자리에서 깜빡이는 것처럼 보인다.
      if (dx < -1) face(true);
      else if (dx > 1) face(false);

      setWorking(false);
      setPumping(false);
      claims.moving += 1;
      holding = true;
      // 지나가는 동안에는 둘 중 앞쪽 기준으로 그린다. 걸어오면서 뒷사람에게 가려지면 어색하다.
      setLayer(Math.round(Math.max(from.y, target.y)));
      position.current = { x: target.x, y: target.y };

      Animated.parallel([
        Animated.timing(x, {
          toValue: target.x,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: target.y,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        claims.moving -= 1;
        holding = false;
        if (cancelled || !finished) return;

        const begin = () => {
          if (cancelled) return;
          settle(target);
          wait(randomBetween(1800, 4200), step);
        };
        // 걸어온 방향과 일할 방향이 다르면 잠깐 선 채로 있다가 돌아선다.
        if (facing.current !== (target.facing === -1)) wait(TURN_MS, begin);
        else begin();
      });
    };

    // 흔들림 줄이기를 켰으면 처음 잡은 자리에 그대로 선다.
    if (!paused) wait(startDelayMs, step);

    return () => {
      cancelled = true;
      for (const id of timers.current) clearTimeout(id);
      timers.current = [];
      x.stopAnimation();
      y.stopAnimation();
      if (holding) {
        claims.moving -= 1;
        holding = false;
      }
      setPumping(false);
      if (slot.current >= 0) claims.current.delete(slot.current);
      slot.current = -1;
    };
  }, [claims, footprintDepth, footprintWidth, index, paused, spots, startDelayMs, x, y]);

  const action = TASKS[task];
  const locked = working && PHASE_LOCKED[task];

  // 걷는 중과 일하는 중의 프레임 속도가 다르다.
  // 박자를 맞춰야 하는 자세는 더 자주 깨워 시각으로 다시 계산하게 한다.
  useEffect(() => {
    if (paused) return undefined;
    const interval = working ? (locked ? PHASE_CHECK_MS : action.frameMs) : WALK_FRAME_MS;
    const timer = setInterval(() => setFrame((current) => current + 1), interval);
    return () => clearInterval(timer);
  }, [action.frameMs, locked, paused, working]);

  // 보는 방향에 맞는 프레임 목록을 고른다. 두 목록은 프레임 수가 같으므로
  // 방향이 바뀌어도 동작 순서는 이어진다.
  const walkFrames = facingLeft ? APPRENTICE_WALK_FRAMES_LEFT : APPRENTICE_WALK_FRAMES;
  const workFrames = facingLeft ? action.framesLeft : action.frames;
  const frames = working ? workFrames : walkFrames;
  const frameIndex = locked ? phaseFrame(action.frameMs, frames.length) : frame % frames.length;
  const sprite = frames[frameIndex]!;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.worker,
        {
          // 스프라이트의 접지 행이 바닥선에 오도록 위로 끌어올려 그린다.
          top: -(GROUND_ROW + 1) * scale,
          // y가 클수록(앞쪽일수록) 큰 값이 되어 뒤에 있는 것 위에 그려진다.
          zIndex: LAYER_BASE + layer,
          // `transform`에는 `Animated` 값만 둔다. 정적 항목을 섞으면 그 값이
          // 네이티브에 굳어 다시는 바뀌지 않는다 (`TASKS` 주석 참고).
          transform: [{ translateX: x }, { translateY: y }],
        },
      ]}
    >
      <PixelCanvas sprite={sprite} scale={scale} paletteOverride={{ A: accent }} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  worker: {
    position: 'absolute',
    left: 0,
  },
});
