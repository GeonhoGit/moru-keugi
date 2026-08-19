/**
 * 공방 (계획서 4.4 "배경 NPC와 제작 중인 무기", 4.6).
 *
 * 위에서 비스듬히 내려다보는 시점이다.
 * 옆에서 보면 앞뒤가 가짜라 일꾼이 설비와 같은 높이에 설 수 없었고, 그래서
 * 설비를 몸으로 덮거나 허공에 집게를 넣는 그림이 나왔다. 위에서 보면
 * 화면의 위아래가 곧 앞뒤이므로 설비 사방 어디에나 설 수 있고, 모루 윗면이
 * 보이니 실제로 그 위를 두드릴 수 있다.
 *
 * 배치의 규칙은 하나다. **모든 바닥 물체는 (x, y) 한 쌍으로 놓이고,
 * y가 큰 것이 위에 그려진다.** 사람과 설비를 같은 층에 두고 zIndex로 정렬해야
 * 앞에 선 사람이 뒤의 설비를 가리고, 뒤에 선 사람은 설비에 가려진다.
 *
 * 방의 벽·바닥은 도트 스프라이트가 아니라 색 면으로 만든다.
 * 배경까지 픽셀 단위로 그리면 View가 수천 개가 되어 기기가 밀린다 (계획서 13.4).
 *
 * 대장간 탭은 여전히 옆모습이다. 그쪽은 모루를 눌러 두드리는 화면이라
 * 위에서 보면 타격감이 죽는다.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { formatNumber } from '../engine/bignum';
import { getAutoRate, getEffectiveContribution, getOwnedCount } from '../engine/production';
import { getForgeTier } from '../engine/forge';
import { UPGRADES } from '../data/upgrades';
import {
  APPRENTICE_GRID,
  APPRENTICE_GRIP_COLUMN,
  APPRENTICE_HAMMER_COLUMN,
  APPRENTICE_TONG_COLUMN,
  GROUND_ROW,
  mirrorColumn,
  WORKER_ANIMATIONS,
  WORKSHOP_ANVIL,
  WORKSHOP_FORGE,
} from '../data/workers';
import { UPGRADE_ICONS } from '../data/icons';
import { useGameValue } from '../state/GameContext';
import { colors, radius, spacing } from '../theme/index';
import { AnimatedSprite } from '../components/AnimatedSprite';
import { CoalForgeSprite } from '../components/CoalForgeSprite';
import { PixelCanvas } from '../components/PixelCanvas';
import { ForgeWorker, type ForgeSpot, type ForgeTask } from '../components/ForgeWorker';
import { AppText, Button, EmptyState, Panel, Screen, StatRow } from '../components/index';

/** 방 좌우에 남기는 여백. Screen의 안쪽 여백을 음수 마진으로 되돌린 뒤의 값이다. */
const ROOM_MARGIN = spacing.sm;

/** 뒷벽이 차지하는 높이. 나머지가 전부 바닥이다. */
const WALL_HEIGHT = 92;

/** 대장장이 몇 명당 한 명이 방에 나타나는가 */
const WALKERS_PER_APPRENTICE = 5;

/**
 * 방 안을 돌아다니는 인원 상한.
 * 후반에는 고용 인원이 수천 명이 되므로, 비례만 따르면 방이 발 디딜 틈 없이 차고
 * 프레임 타이머도 그만큼 늘어난다 (계획서 13.4).
 * 실제로는 설비 수가 한 번 더 상한을 건다 — 설비 한 대에 한 명뿐이다.
 */
const MAX_WALKERS = 8;

/** 5명당 한 명. 한 명이라도 고용했으면 최소 한 명은 보이게 한다. */
const walkerCount = (owned: number): number => {
  if (owned <= 0) return 0;
  return Math.min(MAX_WALKERS, Math.max(1, Math.floor(owned / WALKERS_PER_APPRENTICE)));
};

/** 일꾼은 24칸 격자를 3배로 그린다. 설비(2배)보다 커서 사람이 주인공으로 읽힌다. */
const WORKER_SCALE = 3;
const MACHINE_SCALE = 2;
const WORKER_WIDTH = APPRENTICE_GRID * WORKER_SCALE;
const MACHINE_WIDTH = APPRENTICE_GRID * MACHINE_SCALE;

/** 바닥 눈금을 그을 위치 (가로·세로 공통) */
const FLOOR_LINES = [0.2, 0.4, 0.6, 0.8];

/** 선반 위 아이콘 크기 */
const SHELF_SCALE = 2;

/**
 * 바닥에 놓인 설비.
 *
 * `x`,`y`는 바닥 크기에 대한 비율이고 설비의 **접지점 한가운데**를 가리킨다.
 * `task`가 있으면 그 설비를 쓰는 자리가 좌우에 생긴다.
 */
interface Station {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly task: ForgeTask;
  /** 그 자리에서 도구가 설비에 닿는 칸. 이만큼 왼쪽으로 당겨 세운다. */
  readonly column: number;
  /** 어느 쪽에 서는가. -1이면 설비 오른쪽에서 왼쪽을 보고 일한다. */
  readonly side: 1 | -1;
  /** 안 샀으면 방에 없는 설비 */
  readonly requires?: 'bellows' | 'coal_forge';
}

/**
 * 설비 배치.
 *
 * 설비 한 대에 자리는 하나뿐이다. 둘이 붙으면 한 물건을 같이 쓰는 그림이 되어
 * 누가 무엇을 하는지 읽히지 않는다. 그래서 방에 나오는 인원도 설비 수를 넘지 않는다.
 *
 * 풀무는 석탄 화로 바로 왼쪽에 두어 주둥이가 그 화로를 향하게 한다.
 * 둘이 붙어 있으므로 석탄 화로를 쓰는 사람은 반대쪽(오른쪽)에 세운다.
 * 같은 쪽에 두면 두 사람이 한자리에 겹친다.
 */
const STATIONS: readonly Station[] = [
  { id: 'forge', x: 0.24, y: 0.22, task: 'forge', column: APPRENTICE_TONG_COLUMN, side: 1 },
  {
    id: 'bellows',
    x: 0.65,
    y: 0.16,
    task: 'bellows',
    // 풀무 손잡이는 왼쪽으로 튀어나와 있어 그만큼 더 왼쪽에 서야 손이 닿는다.
    column: APPRENTICE_GRIP_COLUMN + 6,
    side: 1,
    requires: 'bellows',
  },
  {
    id: 'coal_forge',
    x: 0.82,
    y: 0.16,
    task: 'forge',
    column: APPRENTICE_TONG_COLUMN,
    side: -1,
    requires: 'coal_forge',
  },
  // 모루는 서는 쪽을 섞는다. 전부 왼쪽에 세우면 모두가 오른쪽만 보고 있어
  // 몸을 돌려 일하는 모습이 좀처럼 나오지 않는다.
  { id: 'anvil_a', x: 0.24, y: 0.58, task: 'anvil', column: APPRENTICE_HAMMER_COLUMN, side: 1 },
  { id: 'anvil_b', x: 0.55, y: 0.74, task: 'anvil', column: APPRENTICE_HAMMER_COLUMN, side: -1 },
  { id: 'anvil_c', x: 0.8, y: 0.56, task: 'anvil', column: APPRENTICE_HAMMER_COLUMN, side: -1 },
];

const findAnimation = (upgradeId: string) =>
  WORKER_ANIMATIONS.find((animation) => animation.upgradeId === upgradeId);

/**
 * 벽 선반에 걸어 둘 업그레이드.
 *
 * 견습 대장장이는 방을 돌아다니는 사람이 대신하고, 풀무와 석탄 화로는 바닥에 놓인
 * 설비로 이미 보이므로 뺀다. 두 곳에 나오면 두 개를 산 것처럼 읽힌다.
 */
const FLOOR_UPGRADE_IDS = ['apprentice', 'bellows', 'coal_forge'];
const SHELF_UPGRADE_IDS = UPGRADES.map((upgrade) => upgrade.id).filter(
  (id) => !FLOOR_UPGRADE_IDS.includes(id),
);

export const WorkshopScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { width } = useWindowDimensions();
  /** 바닥의 실제 높이. 방이 남은 공간을 다 쓰므로 재 보기 전에는 알 수 없다. */
  const [floorHeight, setFloorHeight] = useState(0);

  const view = useGameValue(
    (snapshot) => {
      const state = snapshot.state;
      const format = state.settings.numberFormat;
      const tier = getForgeTier(state.lifetimeEmber);

      return {
        accent: tier.accentColor,
        tierName: tier.name,
        reduceMotion: state.settings.reduceMotion,
        apprentice: getOwnedCount(state, 'apprentice'),
        bellows: getOwnedCount(state, 'bellows'),
        coalForge: getOwnedCount(state, 'coal_forge'),
        shelf: SHELF_UPGRADE_IDS.filter((id) => getOwnedCount(state, id) > 0),
        apprenticeRate: formatNumber(getEffectiveContribution(state, 'apprentice'), format),
        bellowsRate: formatNumber(getEffectiveContribution(state, 'bellows'), format),
        forgeRate: formatNumber(getEffectiveContribution(state, 'coal_forge'), format),
        totalRate: formatNumber(getAutoRate(state), format),
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );

  const anyone = view.apprentice > 0 || view.bellows > 0 || view.coalForge > 0;

  // 방은 화면 가장자리 가까이까지 넓힌다.
  // Screen이 이미 spacing.lg만큼 안쪽으로 밀어 두므로, 그만큼 음수 여백으로 되돌린다.
  const roomWidth = Math.max(240, width - ROOM_MARGIN * 2);

  const owned = useMemo(
    () => ({ bellows: view.bellows > 0, coal_forge: view.coalForge > 0 }),
    [view.bellows, view.coalForge],
  );

  /** 방에 실제로 놓이는 설비 */
  const stations = useMemo(
    () =>
      STATIONS.filter((station) => !station.requires || owned[station.requires]).map((station) => ({
        ...station,
        px: roomWidth * station.x,
        py: floorHeight * station.y,
      })),
    [floorHeight, owned, roomWidth],
  );

  /**
   * 설 수 있는 자리 전체. 일꾼들이 이 목록을 나눠 쓰며 한 자리에 한 명만 선다.
   * 설비 왼쪽에 서면 오른쪽을 보고, 오른쪽에 서면 좌우를 뒤집어 왼쪽을 본다.
   */
  const spots = useMemo<readonly ForgeSpot[]>(() => {
    const clampX = (value: number) => Math.min(Math.max(value, 0), roomWidth - WORKER_WIDTH);

    return stations.map((station) => ({
      // 오른쪽에 서면 좌우가 뒤집혀 도구도 반대쪽에 오므로, 격자 반대편 칸을 기준으로 당긴다.
      x: clampX(
        station.px -
          (station.side === 1 ? station.column : mirrorColumn(station.column)) * WORKER_SCALE,
      ),
      y: station.py,
      task: station.task,
      facing: station.side,
    }));
  }, [roomWidth, stations]);

  /**
   * 찬 자리의 번호. 자리 목록이 바뀌면 번호도 새로 매겨지므로 함께 비운다.
   * `useRef`가 아니라 `useMemo`인 것은 그 때문이다.
   */
  const claims = useMemo(() => ({ current: new Set<number>(), moving: 0, pumping: 0 }), [spots]);

  // 설비 한 대에 한 명이므로, 아무리 많이 고용해도 설비 수를 넘어 나올 수 없다.
  const walkers = Math.min(walkerCount(view.apprentice), spots.length);
  const bellowsAnimation = findAnimation('bellows');
  const coalForgeAnimation = findAnimation('coal_forge');

  /** 설비 하나를 바닥에 놓는다. y가 큰 것이 위에 그려진다. */
  const machineStyle = (px: number, py: number) => ({
    position: 'absolute' as const,
    left: px - MACHINE_WIDTH / 2,
    top: py - (GROUND_ROW + 1) * MACHINE_SCALE,
    zIndex: 100 + Math.round(py),
  });

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <AppText variant="title">공방</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {view.tierName}
        </AppText>
      </View>

      {!anyone ? (
        <EmptyState
          title="아직 아무도 없습니다"
          body="상점에서 견습 대장장이를 고용하면 여기에서 일하는 모습을 볼 수 있습니다."
        />
      ) : (
        <View style={[styles.room, { width: roomWidth }]}>
          {/* 뒷벽 — 방의 안쪽 끝 */}
          <View style={styles.wall}>
            <View style={[styles.glow, { backgroundColor: view.accent }]} />

            {/* 선반 — 상점에서 산 물건을 걸어 둔다. 실물이 없는 것들이라 여기 있어야 보인다. */}
            {view.shelf.length > 0 ? (
              <View style={styles.shelf} pointerEvents="none">
                <View style={styles.shelfInner}>
                  <View style={styles.shelfRow}>
                    {view.shelf.map((id) => {
                      const sprite = UPGRADE_ICONS[id];
                      if (!sprite) return null;
                      return (
                        <PixelCanvas
                          key={id}
                          sprite={sprite}
                          scale={SHELF_SCALE}
                          paletteOverride={{ A: view.accent }}
                          accessibilityLabel={UPGRADES.find((upgrade) => upgrade.id === id)?.name}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.shelfBoard} />
                </View>
              </View>
            ) : null}
          </View>

          {/* 벽과 바닥이 만나는 선 */}
          <View style={styles.baseboard} />

          {/*
            바닥 — 설비와 사람이 같은 층에 놓인다.
            둘을 나누면 뒤에 선 사람이 앞의 설비 위에 그려져 깊이가 무너진다.
          */}
          <View
            style={styles.floor}
            pointerEvents="none"
            onLayout={(event) => setFloorHeight(event.nativeEvent.layout.height)}
          >
            {/* 바닥 눈금. 평면이라는 것을 알려 주는 최소한의 단서다. */}
            {FLOOR_LINES.map((fraction) => (
              <View key={`h${fraction}`} style={[styles.floorLine, { top: `${fraction * 100}%` }]} />
            ))}
            {FLOOR_LINES.map((fraction) => (
              <View
                key={`v${fraction}`}
                style={[styles.floorColumn, { left: `${fraction * 100}%` }]}
              />
            ))}

            {stations.map((station) => {
              const style = machineStyle(station.px, station.py);
              if (station.id === 'forge') {
                return (
                  <View key={station.id} style={style}>
                    <PixelCanvas
                      sprite={WORKSHOP_FORGE}
                      scale={MACHINE_SCALE}
                      paletteOverride={{ A: view.accent }}
                      accessibilityLabel="화로"
                    />
                  </View>
                );
              }
              if (station.id === 'bellows' && bellowsAnimation) {
                return (
                  <View key={station.id} style={style}>
                    <AnimatedSprite
                      frames={bellowsAnimation.frames}
                      frameMs={bellowsAnimation.frameMs}
                      scale={MACHINE_SCALE}
                      accent={view.accent}
                      paused={view.reduceMotion}
                      accessibilityLabel={`풀무 ${view.bellows}대`}
                    />
                  </View>
                );
              }
              if (station.id === 'coal_forge' && coalForgeAnimation) {
                return (
                  <View key={station.id} style={style}>
                    <CoalForgeSprite
                      frames={coalForgeAnimation.frames}
                      frameMs={coalForgeAnimation.frameMs}
                      scale={MACHINE_SCALE}
                      accent={view.accent}
                      claims={claims}
                      paused={view.reduceMotion}
                      accessibilityLabel={`석탄 화로 ${view.coalForge}기`}
                    />
                  </View>
                );
              }
              return (
                <View key={station.id} style={style}>
                  <PixelCanvas
                    sprite={WORKSHOP_ANVIL}
                    scale={MACHINE_SCALE}
                    paletteOverride={{ A: view.accent }}
                    accessibilityLabel="모루"
                  />
                </View>
              );
            })}

            {Array.from({ length: walkers }, (_, index) => (
              <ForgeWorker
                key={index}
                spots={spots}
                claims={claims}
                index={index}
                scale={WORKER_SCALE}
                accent={view.accent}
                paused={view.reduceMotion}
                startDelayMs={index * 700}
              />
            ))}
          </View>
        </View>
      )}

      {anyone ? (
        <Panel>
          <StatRow label="견습 대장장이" value={`${view.apprentice}명 · 초당 ${view.apprenticeRate}`} />
          {view.bellows > 0 ? (
            <StatRow label="풀무" value={`${view.bellows}대 · 초당 ${view.bellowsRate}`} />
          ) : null}
          {view.coalForge > 0 ? (
            <StatRow label="석탄 화로" value={`${view.coalForge}기 · 초당 ${view.forgeRate}`} />
          ) : null}
          <StatRow label="공방 전체" value={`초당 ${view.totalRate}`} />
        </Panel>
      ) : null}

      <Button label="닫기" tone="secondary" onPress={onClose} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  room: {
    // 남는 세로 공간을 모두 방이 가져간다. 아래의 합계와 닫기 버튼은 제 높이만 쓴다.
    flex: 1,
    minHeight: WALL_HEIGHT + 220,
    marginHorizontal: -(spacing.lg - ROOM_MARGIN),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#2a1e15',
  },
  wall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: WALL_HEIGHT,
    backgroundColor: '#1b130e',
  },
  /** 화로 불빛이 벽에 번지는 느낌. 강조색을 옅게 깔아 방에 온도를 준다. */
  glow: {
    position: 'absolute',
    left: '4%',
    bottom: 0,
    width: '34%',
    height: '70%',
    opacity: 0.07,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  /** 벽과 바닥이 만나는 선. 이 한 줄이 있고 없고로 깊이가 달라진다. */
  baseboard: {
    position: 'absolute',
    top: WALL_HEIGHT,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#0f0a07',
  },
  floor: {
    position: 'absolute',
    top: WALL_HEIGHT + 3,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floorLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#000000',
    opacity: 0.12,
  },
  floorColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#000000',
    opacity: 0.12,
  },
  /** 벽에 걸린 선반 */
  shelf: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.sm,
    alignItems: 'center',
  },
  /** 널빤지 폭이 올려 둔 물건에 맞도록 안쪽을 한 겹 더 둔다. */
  shelfInner: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  shelfRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  /** 선반 널빤지. 이 한 줄이 없으면 아이콘이 벽에 떠 있는 것처럼 보인다. */
  shelfBoard: {
    marginTop: 2,
    height: 3,
    alignSelf: 'stretch',
    backgroundColor: '#0f0a07',
  },
});
