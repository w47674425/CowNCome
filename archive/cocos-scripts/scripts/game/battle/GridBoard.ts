import { _decorator, Component, Node, Label, Color, tween, Vec3 } from 'cc';
import { EventBus } from '../../core/EventBus';
import { UnitType } from '../../core/Const';
import { Unit } from '../../data/models/Unit';
import { SynthesizeRule } from '../../data/rules/SynthesizeRule';
import { MAX_LEVEL, UNIT_CHAR } from '../../data/config/UnitConfig';
const { ccclass, property } = _decorator;

/**
 * 棋盘组件：格子管理 / 拖拽放置 / 合成配对 / 铲子扩格
 * 对局表现核心：文字即视觉 —— 每个兵种是汉字 Label + 攻击动效
 */
@ccclass('GridBoard')
export class GridBoard extends Component {
  @property(Node)
  gridContainer: Node | null = null;

  /** 初始格子数：6（Design Pillar: 空间即资源） */
  @property
  startGridCount = 6;

  /** 单格预制体（渲染汉字 + 血量） */
  @property
  cellPrefab: Node | null = null;

  /** 当前棋盘布局 */
  private _cells: (Unit | null)[][] = [];
  private _gridW = 4;
  private _gridH = 3;

  private _synth = new SynthesizeRule(MAX_LEVEL);

  onLoad(): void {
    this._cells = Array.from({ length: this._gridH }, () =>
      Array(this._gridW).fill(null),
    );
    this.buildBoard(this.startGridCount);
  }

  /** 铺设起始格子（6 格 = 4x2 区域，开局可摆 6 个） */
  private buildBoard(count: number): void {
    for (let i = 0; i < count; i++) {
      const x = i % this._gridW;
      const y = Math.floor(i / this._gridW);
      if (y < this._gridH) this.spawnCell(x, y);
    }
  }

  private spawnCell(x: number, y: number): void {
    if (!this.gridContainer || !this.cellPrefab) return;
    const cell = Node.instantiate(this.cellPrefab);
    cell.setParent(this.gridContainer);
    cell.setPosition(new Vec3(x * 90 - 135, 135 - y * 90, 0));
    // 绑定格子坐标用于拖拽命中检测
    cell.name = `cell_${x}_${y}`;
  }

  /** 铲子扩格：检查该位置是否为空，扩一格 */
  expandGrid(): boolean {
    for (let y = 0; y < this._gridH; y++) {
      for (let x = 0; x < this._gridW; x++) {
        if (!this._cells[y][x]) {
          this.spawnCell(x, y);
          return true;
        }
      }
    }
    return false;
  }

  /** 放置兵种到格子（拖拽释放时调用）；返回是否触发合成 */
  placeUnit(unit: Unit, gridX: number, gridY: number): Unit | null {
    const target = this._cells[gridY][gridX];

    // 合成检测：同类同级 → 升级，合并占位
    if (target && target.canSynthesizeWith(unit)) {
      const merged = target.synthesize();
      this._cells[gridY][gridX] = merged;
      this.renderCell(gridX, gridY, merged);
      EventBus.emit('unit_synthesized', merged);
      return merged;
    }

    // 目标被占（不同类型）：拒绝，返回 null 表示放置失败
    if (target) return null;

    this._cells[gridY][gridX] = unit;
    unit.gridX = gridX;
    unit.gridY = gridY;
    this.renderCell(gridX, gridY, unit);
    return unit;
  }

  /** 渲染格子：汉字 Label + 等级标记 + 放置动画 */
  private renderCell(x: number, y: number, unit: Unit): void {
    const node = this.gridContainer?.getChildByName(`cell_${x}_${y}`);
    if (!node) return;

    const label = node.getComponentInChildren(Label);
    if (label) {
      label.string = UNIT_CHAR[unit.type];
      // 等级越高字越亮（视觉反馈合成成长）
      const bright = 0.55 + unit.level * 0.09;
      label.color = new Color(bright * 255, bright * 255, 255);
    }

    // 放置/合成弹跳反馈
    tween(node)
      .to(0.08, { scale: new Vec3(1.25, 1.25, 1) })
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .start();
  }
}
