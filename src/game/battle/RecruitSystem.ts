import { UnitType } from '../../core/Const';
import { Unit } from '../../data/models/Unit';
import { getRecruitCost, RECRUIT_WEIGHTS, HERO_PITY_COUNT } from '../../data/config/RecruitCost';

/**
 * 召唤系统：随机掉落 动物伙伴(76%) / 动物字牌(20%) / 铲子(4%)
 * 成本递增 + 字牌保底（连续 N 次未出字牌，下次必出）
 * 每个字牌对应一个字（集齐"牛+羊"式组合可召唤神兽，Phase2）
 */

/** 动物字牌池（MVP：收集点亮图鉴；神兽召唤 Phase2） */
export const HERO_CHARS: string[] = ['牛', '羊', '马', '鸡', '鸭', '鹅', '猪', '犬', '猫', '兔', '鹿', '猴'];

export type RecruitResult =
  | { kind: 'unit'; unit: Unit }
  | { kind: 'heroChar'; heroChar: string }
  | { kind: 'shovel' };

export class RecruitSystem {
  private _count = 0;
  private _pityCountdown = HERO_PITY_COUNT;

  /** 已召唤次数（成本递增索引） */
  get count(): number {
    return this._count;
  }

  get currentCost(): number {
    return getRecruitCost(this._count);
  }

  /** 生成一次掉落（不扣干草，由调用方校验费用） */
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
