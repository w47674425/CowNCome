import { UnitType } from '../../core/Const';
import { Unit } from '../../data/models/Unit';
import { getRecruitCost, RECRUIT_WEIGHTS, HERO_PITY_COUNT } from '../../data/config/RecruitCost';

/**
 * 征兵系统：随机掉落 兵种(76%) / 英雄字牌(20%) / 铲子(4%)
 * 成本递增 + 英雄字牌保底（连续 N 次未出字牌，下次必出）
 * 每个英雄字牌对应三国武将（凑齐"赵+云"式组合可召唤武将，Phase2）
 */

/** 武将字牌池（MVP：收集点亮图鉴；武将召唤 Phase2） */
export const HERO_CHARS: string[] = ['赵', '云', '刘', '备', '关', '羽', '张', '飞', '诸', '葛', '亮', '马', '超', '黄', '忠', '魏', '延'];

export type RecruitResult =
  | { kind: 'unit'; unit: Unit }
  | { kind: 'heroChar'; heroChar: string }
  | { kind: 'shovel' };

export class RecruitSystem {
  private _count = 0;
  private _pityCountdown = HERO_PITY_COUNT;

  /** 已征兵次数（成本递增索引） */
  get count(): number {
    return this._count;
  }

  get currentCost(): number {
    return getRecruitCost(this._count);
  }

  /** 生成一次掉落（不扣馒头，由调用方校验费用） */
  roll(): RecruitResult {
    this._count++;
    this._pityCountdown--;

    // 保底：连续 N 次未出字牌 → 本次必出
    if (this._pityCountdown <= 0) {
      this._pityCountdown = HERO_PITY_COUNT;
      return { kind: 'heroChar', heroChar: this._pickHeroChar() };
    }

    const roll = Math.random() * 100;
    if (roll < RECRUIT_WEIGHTS.unit) {
      return { kind: 'unit', unit: new Unit(this._pickUnitType(), 1) };
    }
    if (roll < RECRUIT_WEIGHTS.unit + RECRUIT_WEIGHTS.heroChar) {
      return { kind: 'heroChar', heroChar: this._pickHeroChar() };
    }
    return { kind: 'shovel' };
  }

  private _pickUnitType(): UnitType {
    const types = [UnitType.SWORD, UnitType.SPEAR, UnitType.BOW, UnitType.CAVALRY];
    return types[Math.floor(Math.random() * types.length)];
  }

  private _pickHeroChar(): string {
    return HERO_CHARS[Math.floor(Math.random() * HERO_CHARS.length)];
  }
}
