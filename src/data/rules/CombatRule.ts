import { UnitType } from '../../core/Const';
import { getUnitStat } from '../config/UnitConfig';

/**
 * 战斗结算引擎（纯函数，可单测）
 * 覆盖：攻击力 / 攻速 / 射程 / 穿透 / 减伤 / 击杀掉落
 */

export interface DamageContext {
  attacker: { type: UnitType; level: number };
  /** 目标距离（格数，用于判定射程内） */
  distance: number;
  /** 目标是否为后排单位（枪兵穿透 50% 判定） */
  targetIsBackline: boolean;
  /** 目标防御减伤系数（0-1） */
  targetDefenseRate: number;
}

export interface DamageResult {
  damage: number;
  killed: boolean;
  /** 是否触发穿透 */
  pierced: boolean;
  /** 穿透造成的二次伤害（命中后排时） */
  pierceDamage: number;
}

/** 击杀干草掉落：基础 6 + 击杀者伙伴等级×3（合成升级的正向激励） [PLACEHOLDER: playtest 后校准] */
export function killReward(level: number): number {
  return 6 + level * 3;
}

export class CombatRule {
  /**
   * 计算单次攻击伤害
   * 公式: 攻击力 × (1 - 防御率)，枪兵对后排额外 50%
   */
  static calcDamage(ctx: DamageContext): DamageResult {
    const stat = getUnitStat(ctx.attacker.type, ctx.attacker.level);

    // 射程判定
    if (stat.range > 0 && ctx.distance > stat.range) {
      return { damage: 0, killed: false, pierced: false, pierceDamage: 0 };
    }

    const baseDamage = stat.baseAttack * (1 - ctx.targetDefenseRate);
    let damage = Math.max(1, Math.round(baseDamage));

    // 枪兵穿透：对直线后排目标造成 50% 伤害
    let pierced = false;
    let pierceDamage = 0;
    if (ctx.attacker.type === UnitType.SPEAR && ctx.targetIsBackline) {
      pierced = true;
      pierceDamage = Math.max(1, Math.round(baseDamage * 0.5));
      damage += pierceDamage;
    }

    return { damage, killed: false, pierced, pierceDamage };
  }
}
