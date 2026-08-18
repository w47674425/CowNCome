import { Unit } from '../../data/models/Unit';
import { SynthesizeRule } from '../../data/rules/SynthesizeRule';
import { MAX_LEVEL } from '../../data/config/UnitConfig';
import { EventBus } from '../../core/EventBus';

/**
 * 棋盘数据层（Web 版，零引擎依赖）
 * 4 列 × 3 行 = 12 格，初始解锁 6 格（Design Pillar: 空间即资源）
 * 后续格子可付费解锁（消耗递增，见 GRID_UNLOCK_COSTS）或铲子免费扩格 = expandGrid()
 */
export const BOARD_COLS = 4;
export const BOARD_ROWS = 3;
export const START_GRID_COUNT = 6;

/** 付费解锁成本（干草）：第 7~12 格，成本递增（与召唤成本同理，制造资源节奏决策） */
export const GRID_UNLOCK_COSTS = [40, 70, 110, 160, 220, 300];

/** 第 unlockedCount+1 格的解锁成本（干草）；已全部解锁返回 0 */
export function nextUnlockCost(unlockedCount: number): number {
  const idx = unlockedCount - START_GRID_COUNT;
  if (idx < 0 || idx >= GRID_UNLOCK_COSTS.length) return 0;
  return GRID_UNLOCK_COSTS[idx];
}

export class GridBoard {
  /** cells[row][col]，null = 空格（可放置） */
  cells: (Unit | null)[][];
  /** 已解锁格数（铲子扩格 +1，上限 12） */
  unlockedCount: number;

  private _synth = new SynthesizeRule(MAX_LEVEL);

  constructor() {
    this.cells = Array.from({ length: BOARD_ROWS }, () =>
      Array<Unit | null>(BOARD_COLS).fill(null),
    );
    this.unlockedCount = 0;
    // 初始解锁：行优先铺 START_GRID_COUNT 格（cells 内容为 null = 空格可放置）
    this.unlockedCount = START_GRID_COUNT;
  }

  /** 行优先序号 → 坐标 */
  indexToXY(i: number): { x: number; y: number } {
    return { x: i % BOARD_COLS, y: Math.floor(i / BOARD_COLS) };
  }

  /** 该格是否已解锁（可放置/已占用） */
  isUnlocked(x: number, y: number): boolean {
    const idx = y * BOARD_COLS + x;
    return idx < this.unlockedCount;
  }

  /** 当前下一格的解锁成本（干草）；0 = 已全部解锁 */
  get nextCost(): number {
    return nextUnlockCost(this.unlockedCount);
  }

  getUnit(x: number, y: number): Unit | null {
    return this.cells[y][x];
  }

  /** 第一个未解锁的空格坐标（铲子扩格目标），无则 null */
  nextExpandCell(): { x: number; y: number } | null {
    if (this.unlockedCount >= BOARD_COLS * BOARD_ROWS) return null;
    return this.indexToXY(this.unlockedCount);
  }

  /** 第一个可放置的空格坐标 */
  firstEmptyCell(): { x: number; y: number } | null {
    for (let i = 0; i < this.unlockedCount; i++) {
      const { x, y } = this.indexToXY(i);
      if (!this.cells[y][x]) return { x, y };
    }
    return null;
  }

  /** 所有已放置的兵 */
  allUnits(): Unit[] {
    const list: Unit[] = [];
    for (let y = 0; y < BOARD_ROWS; y++) {
      for (let x = 0; x < BOARD_COLS; x++) {
        if (this.cells[y][x]) list.push(this.cells[y][x]!);
      }
    }
    return list;
  }

  /**
   * 放置兵到指定格；若目标格有同类同级兵则触发合成（占用 1 格）
   * @returns 放置/合成后的 Unit；失败（被不同类型占用）返回 null
   */
  placeUnit(unit: Unit, x: number, y: number): Unit | null {
    if (!this.isUnlocked(x, y)) return null;
    const target = this.cells[y][x];

    if (target && target.canSynthesizeWith(unit)) {
      const merged = target.synthesize();
      this.cells[y][x] = merged;
      merged.gridX = x;
      merged.gridY = y;
      EventBus.emit('unit_synthesized', merged);
      return merged;
    }

    if (target) return null;

    this.cells[y][x] = unit;
    unit.gridX = x;
    unit.gridY = y;
    return unit;
  }

  /** 扩格：解锁下一个空格（铲子免费 / 付费解锁共用）；已满返回 false */
  expandGrid(): boolean {
    const cell = this.nextExpandCell();
    if (!cell) return false;
    this.unlockedCount++;
    EventBus.emit('grid_expanded', cell);
    return true;
  }

  /** 自动寻找能触发合成的一对格子（AI / 便捷操作用） */
  findSynthesisPair(): { a: { x: number; y: number }; b: { x: number; y: number } } | null {
    for (let y = 0; y < BOARD_ROWS; y++) {
      for (let x = 0; x < BOARD_COLS; x++) {
        const u = this.cells[y][x];
        if (!u) continue;
        // 向右/向下找同类同级
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= BOARD_COLS || ny >= BOARD_ROWS) continue;
            const v = this.cells[ny][nx];
            if (v && u.canSynthesizeWith(v)) {
              return { a: { x, y }, b: { x: nx, y: ny } };
            }
          }
        }
      }
    }
    return null;
  }

  /** 合并一对格子（AI 用）；返回产物 */
  synthesizePair(a: { x: number; y: number }, b: { x: number; y: number }): Unit | null {
    const ua = this.cells[a.y][a.x];
    const ub = this.cells[b.y][b.x];
    if (!ua || !ub || !ua.canSynthesizeWith(ub)) return null;
    const merged = ua.synthesize();
    this.cells[a.y][a.x] = merged;
    this.cells[b.y][b.x] = null;
    merged.gridX = a.x;
    merged.gridY = a.y;
    EventBus.emit('unit_synthesized', merged);
    return merged;
  }
}
