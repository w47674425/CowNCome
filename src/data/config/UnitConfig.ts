import { UnitType } from '../../core/Const';

/**
 * 兵种数值配置表
 * 与 tuning 表同源维护；所有数值标注 rationale
 * [PLACEHOLDER] = 未经过 playtest 验证，需按假设 + 验证路径替换
 */

export interface UnitStat {
  baseAttack: number;      // 基础攻击力
  baseAtkSpeed: number;    // 攻击间隔（秒）
  range: number;           // 射程（格数，0 = 近战）
  /** 升级加成：每升 1 级攻击力 × 该系数 */
  atkGrowth: number;
}

const STAT: Record<UnitType, UnitStat> = {
  // 犬：近战肉盾，攻速中等。Rationale: 前排抗伤定位，攻击低但稳定
  [UnitType.SWORD]: {
    baseAttack: 10, baseAtkSpeed: 1.2, range: 0, atkGrowth: 1.35,
  },
  // 狼：近战穿透，打直线后排 50% 伤害（CombatRule 实现）
  [UnitType.SPEAR]: {
    baseAttack: 14, baseAtkSpeed: 1.5, range: 1, atkGrowth: 1.4,
  },
  // 鹰：远程高攻低速，射程覆盖 2/3 棋盘
  [UnitType.BOW]: {
    baseAttack: 18, baseAtkSpeed: 2.0, range: 6, atkGrowth: 1.45,
  },
  // 马：机动高攻，快速填补防线缺口（参考 39kf 攻略：前期优先马）
  [UnitType.CAVALRY]: {
    baseAttack: 12, baseAtkSpeed: 0.9, range: 0, atkGrowth: 1.3,
  },
};

/** 各类型字牌渲染的汉字（牧场动物战队） */
export const UNIT_CHAR: Record<UnitType, string> = {
  [UnitType.SWORD]: '犬',   // 近战肉盾 · 守家犬
  [UnitType.SPEAR]: '狼',   // 穿透撕咬 · 狼
  [UnitType.BOW]: '鹰',     // 远程高攻 · 鹰
  [UnitType.CAVALRY]: '马', // 冲锋高攻 · 马
};

/** 最大合成等级 [PLACEHOLDER: 假设 5 级封顶，视单局时长调] */
export const MAX_LEVEL = 5;

/** 获得指定等级的兵种数值 */
export function getUnitStat(type: UnitType, level: number): UnitStat {
  const base = STAT[type];
  const growth = Math.pow(base.atkGrowth, level - 1);
  return {
    baseAttack: Math.floor(base.baseAttack * growth),
    baseAtkSpeed: base.baseAtkSpeed,
    range: base.range,
    atkGrowth: base.atkGrowth,
  };
}

export default STAT;
