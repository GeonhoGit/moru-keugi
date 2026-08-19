import type { PrestigeSkillDefinition } from '../types/index';

/**
 * 명인의 인장 영구 강화 (계획서 6.4).
 *
 * 하나만 고르는 배타적 선택이 아니라, 직접 타격형·방치형·주문형 중 원하는 방향으로
 * 자유롭게 투자할 수 있게 구성한다.
 * 계획서의 "유물 감정"은 유물이 들어오는 V1.1 이후 항목이라 여기에 넣지 않았다.
 */
export const PRESTIGE_SKILLS: readonly PrestigeSkillDefinition[] = [
  {
    id: 'skilled_hands',
    name: '숙련된 손길',
    description: '망치를 쥐는 법이 몸에 밴다. 타격 생산량 +5%/단계.',
    channel: 'click',
    amountPerLevel: 0.05,
    maxLevel: 20,
    costForLevel: (level) => level,
  },
  {
    id: 'auto_bellows',
    name: '자동 풀무',
    description: '풀무가 스스로 숨을 쉰다. 자동 생산량 +5%/단계.',
    channel: 'auto',
    amountPerLevel: 0.05,
    maxLevel: 20,
    costForLevel: (level) => level,
  },
  {
    id: 'night_shift',
    name: '밤샘 작업',
    description: '불을 재워 두고 떠나는 법을 익힌다. 오프라인 효율 +3%/단계.',
    channel: 'offline',
    amountPerLevel: 0.03,
    maxLevel: 10,
    costForLevel: (level) => level * 2,
  },
  {
    id: 'royal_contract',
    name: '왕실 계약',
    description: '이름값이 오르면 주문값도 오른다. 주문 보상 +4%/단계.',
    channel: 'orderReward',
    amountPerLevel: 0.04,
    maxLevel: 10,
    costForLevel: (level) => level * 2,
  },
];

export const PRESTIGE_SKILL_BY_ID: ReadonlyMap<string, PrestigeSkillDefinition> = new Map(
  PRESTIGE_SKILLS.map((skill) => [skill.id, skill]),
);

export const getPrestigeSkill = (id: string): PrestigeSkillDefinition => {
  const found = PRESTIGE_SKILL_BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 환생 강화 id: ${id}`);
  return found;
};
