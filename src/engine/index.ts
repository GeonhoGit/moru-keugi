/**
 * 게임 엔진 공개 API.
 *
 * 화면(`screens/`)과 상태 저장소(`state/`)는 이 파일만 import 한다.
 * 개별 엔진 모듈을 직접 참조하지 않게 해 계산 로직 교체가 화면에 번지지 않도록 한다.
 */
export * from './bignum';
export * from './production';
export * from './unlock';
export * from './upgrades';
export * from './orders';
export * from './achievements';
export * from './prestige';
export * from './offline';
export * from './forge';
export * from './state';
export * from './serialize';

export * from '../types/index';

export { UPGRADES, UPGRADE_BY_ID, getUpgradeDefinition } from '../data/upgrades';
export { ORDERS, ORDER_BY_ID, getOrderDefinition } from '../data/orders';
export { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '../data/achievements';
export { PRESTIGE_SKILLS, PRESTIGE_SKILL_BY_ID, getPrestigeSkill } from '../data/prestigeSkills';
export { FORGE_TIERS } from '../data/forgeTiers';
export * as BALANCE from '../data/balance';
