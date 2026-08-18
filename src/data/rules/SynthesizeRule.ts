import { UnitType } from '../../core/Const';

/**
 * 合成规则引擎（纯函数，可单测）
 * 核心：两个同类同级兵种 → 更高一级同类兵种
 * 边界：满级不可合成；不同类/不同级不可合成；单字武将碎片不可合成
 */

export interface SynthesizeResult {
  ok: boolean;
  /** 产物（成功时） */
  result?: { type: UnitType; level: number };
  reason?: 'same_type_same_level' | 'max_level' | 'type_mismatch' | 'level_mismatch' | 'not_unit';
}

export class SynthesizeRule {
  constructor(private maxLevel: number) {}

  /**
   * 尝试合成两个格子上的单位
   * @param a 第一个单位（null 表示空格/武将碎片/其他）
   * @param b 第二个单位
   */
  trySynthesize(
    a: { type: UnitType; level: number } | null,
    b: { type: UnitType; level: number } | null,
  ): SynthesizeResult {
    if (!a || !b) return { ok: false, reason: 'not_unit' };

    if (a.type !== b.type) return { ok: false, reason: 'type_mismatch' };
    if (a.level !== b.level) return { ok: false, reason: 'level_mismatch' };
    if (a.level >= this.maxLevel) return { ok: false, reason: 'max_level' };

    return {
      ok: true,
      result: { type: a.type, level: a.level + 1 },
      reason: 'same_type_same_level',
    };
  }
}
