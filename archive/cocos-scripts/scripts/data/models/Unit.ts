import { UnitType } from '../../core/Const';

/** 兵种实例模型（data 层，零引擎依赖） */
export class Unit {
  type: UnitType;
  level: number;
  /** 所在格子坐标；-1 = 未上阵（征兵面板/背包中） */
  gridX: number;
  gridY: number;

  constructor(type: UnitType, level = 1) {
    this.type = type;
    this.level = level;
    this.gridX = -1;
    this.gridY = -1;
  }

  get isOnBoard(): boolean {
    return this.gridX >= 0;
  }

  /** 合成检测：同类同级才能合成 */
  canSynthesizeWith(other: Unit): boolean {
    return this.type === other.type && this.level === other.level;
  }

  /** 合成产物（等级 +1） */
  synthesize(): Unit {
    return new Unit(this.type, this.level + 1);
  }
}
