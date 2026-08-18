import { BattleEngine, Enemy, BATTLE_CFG } from '../battle/BattleEngine';
import { Unit } from '../../data/models/Unit';
import { UNIT_CHAR } from '../../data/config/UnitConfig';
import { UnitType } from '../../core/Const';
import { EventBus } from '../../core/EventBus';
import { BOARD_COLS, BOARD_ROWS, GridBoard } from '../battle/GridBoard';

export { BOARD_COLS, BOARD_ROWS };

/**
 * Canvas 2D 渲染器
 * 设计 Pillar: 文字即视觉 —— 兵种 = 汉字字牌，颜色/亮度区分等级
 * 逻辑分辨率 720x1280（竖版 9:16，手机竖屏优先），自适应缩放
 */

export const VIEW_W = 720;
export const VIEW_H = 1280;

// 顶部槽：下一波出兵预告（4 格对齐棋盘列道，显示类型+数量）
export const PREVIEW_LEFT = 100;
export const PREVIEW_TOP = 95;
export const PREVIEW_H = 100;

// 备选槽（4 格一行，位于棋盘下方，血条之下、操作栏之上）
export const BENCH_SIZE = 4;
export const BENCH_LEFT = 100;
export const BENCH_TOP = 810;
export const BENCH_CELL = 130;

// 棋盘 4 列 x 3 行，水平居中：(720 - 4*130) / 2 = 100
// 上移为顶部预告面板让位：敌人出生点 = BOARD_TOP - CELL = 200，恰好落在预告面板正下方
export const BOARD_LEFT = 100;
export const BOARD_TOP = 330;
export const CELL = 130;

/** 备选槽格中心像素坐标 */
export function benchCenter(idx: number): { x: number; y: number } {
  return { x: BENCH_LEFT + (idx + 0.5) * BENCH_CELL, y: BENCH_TOP + BENCH_CELL / 2 };
}

/** 格子中心像素坐标 */
export function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: BOARD_LEFT + (col + 0.5) * CELL, y: BOARD_TOP + (row + 0.5) * CELL };
}

/** 敌人 y（格单位）→ 像素 */
export function enemyYToPx(y: number): number {
  return BOARD_TOP - CELL / 2 + y * CELL;
}

/** 兵种主题色 */
const TYPE_COLOR: Record<UnitType, string> = {
  [UnitType.SWORD]: '#e05252', // 刀·红
  [UnitType.SPEAR]: '#52b7e0', // 枪·蓝
  [UnitType.BOW]: '#7fd052',   // 弓·绿
  [UnitType.CAVALRY]: '#e0a852', // 骑·金
};

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number; // 剩余寿命（秒）
}

interface AttackFx {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private floats: FloatText[] = [];
  private fx: AttackFx[] = [];

  /** 待放置兵（拖拽 ghost） */
  pendingUnit: Unit | null = null;
  pendingUnitXY: { x: number; y: number } | null = null;

  /** 备选槽选中高亮（BattleScreen 控制，null = 未选中） */
  selectedBenchIdx: number | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private engine: BattleEngine,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;

    // 事件：攻击特效与掉落飘字
    EventBus.on('unit_attack', (p: { unit: Unit; enemy: Enemy; damage: number }) => {
      const from = cellCenter(p.unit.gridX, p.unit.gridY);
      const to = {
        x: BOARD_LEFT + (p.enemy.lane + 0.5) * CELL,
        y: enemyYToPx(p.enemy.y),
      };
      this.fx.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, t: 0.18 });
      this.floats.push({
        x: to.x,
        y: to.y - 14,
        text: `-${p.damage}`,
        color: '#ffd166',
        t: 0.7,
      });
    });
    EventBus.on('enemy_killed', (e: Enemy) => {
      this.floats.push({
        x: BOARD_LEFT + (e.lane + 0.5) * CELL,
        y: enemyYToPx(e.y) - 30,
        text: '+馒头',
        color: '#ffb703',
        t: 0.8,
      });
    });
  }

  /** 每帧渲染入口 */
  render(dt: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    this.drawBackground(ctx);
    this.drawWavePreview(ctx);
    this.drawBench(ctx);
    this.drawBoard(ctx);
    this.drawEnemies(ctx);
    this.drawAdouBars(ctx);
    this.drawFx(dt);

    // 防御：pendingUnit 存在但 pendingUnitXY 未初始化（征兵后未移动鼠标）时不画 ghost
    if (this.pendingUnit && this.pendingUnitXY) this.drawPendingGhost(ctx);
  }

  /** roundRect 兼容实现（Chrome < 99 / Safari 无原生 API 时兜底） */
  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
      return;
    }
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /** 添加一条自定义飘字（招募结果等） */
  addFloat(x: number, y: number, text: string, color = '#fff'): void {
    this.floats.push({ x, y, text, color, t: 1.2 });
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    // 战场底色
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#3a2b16');
    g.addColorStop(0.45, '#2c2010');
    g.addColorStop(1, '#1c1408');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 敌人行进路径（4 条列道，从敌人出生点到棋盘底）
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let c = 0; c < BOARD_COLS; c++) {
      const x = BOARD_LEFT + (c + 0.5) * CELL;
      ctx.beginPath();
      ctx.moveTo(x, BOARD_TOP - CELL);
      ctx.lineTo(x, BOARD_TOP + BOARD_ROWS * CELL);
      ctx.stroke();
    }

    // 波次信息
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    const p = this.engine.playerSide;
    ctx.fillText(
      `第 ${Math.max(1, Math.min(p.wave, BATTLE_CFG.MAX_WAVE))} / ${BATTLE_CFG.MAX_WAVE} 波`,
      VIEW_W / 2,
      48,
    );
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('敌兵将至，守住阿斗！', VIEW_W / 2, 76);
  }

  /** 敌兵类型显示：汉字 + 颜色（顶部预告与实机敌人共用） */
  private static readonly ENEMY_CHAR: Record<UnitType, string> = {
    [UnitType.SWORD]: '刀',
    [UnitType.SPEAR]: '枪',
    [UnitType.BOW]: '弓',
    [UnitType.CAVALRY]: '骑',
  };
  private static readonly ENEMY_COLOR: Record<UnitType, string> = {
    [UnitType.SWORD]: '#c33a3a',  // 刀·暗红
    [UnitType.SPEAR]: '#3f8fc4',  // 枪·蓝
    [UnitType.BOW]: '#5fb83e',    // 弓·绿
    [UnitType.CAVALRY]: '#c99a3f', // 骑·金
  };

  /** 顶部槽：下一波出兵预告（4 列对齐棋盘列道，类型 + 数量 + 方向） */
  private drawWavePreview(ctx: CanvasRenderingContext2D): void {
    const e = this.engine.enemySide;
    const plan = e.nextWavePlan;

    // 面板
    ctx.fillStyle = 'rgba(20,14,8,0.72)';
    ctx.strokeStyle = 'rgba(230,180,90,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.rr(ctx, PREVIEW_LEFT, PREVIEW_TOP, BOARD_COLS * CELL, PREVIEW_H, 12);
    ctx.fill();
    ctx.stroke();

    // 标题：下一波（含波号）
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const nextWave = e.wave >= BATTLE_CFG.MAX_WAVE ? '—' : String(e.wave + 1);
    ctx.fillText(`下一波 · 敌方（第 ${nextWave} 波）`, PREVIEW_LEFT + 16, PREVIEW_TOP + 18);

    // 分割线
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(PREVIEW_LEFT + 10, PREVIEW_TOP + 34);
    ctx.lineTo(PREVIEW_LEFT + BOARD_COLS * CELL - 10, PREVIEW_TOP + 34);
    ctx.stroke();

    // 按列道分组统计
    const groups: { type: UnitType; count: number }[][] = Array.from({ length: BOARD_COLS }, () => []);
    for (const w of plan) {
      const g = groups[w.lane].find((x) => x.type === w.type);
      if (g) g.count++;
      else groups[w.lane].push({ type: w.type, count: 1 });
    }

    for (let c = 0; c < BOARD_COLS; c++) {
      const cx = BOARD_LEFT + (c + 0.5) * CELL;

      // 列道标签
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`道${c + 1}`, cx, PREVIEW_TOP + 50);

      const g = groups[c];
      if (g.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillText('—', cx, PREVIEW_TOP + 78);
        continue;
      }

      // 最多显示 2 种类型图标，横向排列；超 2 种补总数
      const shown = g.slice(0, 2);
      const startX = cx - ((shown.length - 1) * 36) / 2;
      shown.forEach((item, i) => {
        const ix = startX + i * 36;
        const col = Renderer.ENEMY_COLOR[item.type];
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(ix, PREVIEW_TOP + 76, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(Renderer.ENEMY_CHAR[item.type], ix, PREVIEW_TOP + 76);
        // 数量
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
        ctx.fillText(`×${item.count}`, ix + 16, PREVIEW_TOP + 72);
      });
      if (g.length > 2) {
        const total = g.reduce((s, x) => s + x.count, 0);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '11px "Microsoft YaHei", sans-serif';
        ctx.fillText(`+${total}`, cx + 26, PREVIEW_TOP + 80);
      }
    }
  }

  /** 备选槽：4 格一行，点选士兵 → 点棋盘部署 */
  private drawBench(ctx: CanvasRenderingContext2D): void {
    const bench = this.engine.playerSide.bench;

    for (let i = 0; i < BENCH_SIZE; i++) {
      const { x, y } = benchCenter(i);
      const unit = bench[i] ?? null;
      const selected = this.selectedBenchIdx === i;

      // 格子底（选中 = 金色高亮框）
      ctx.fillStyle = unit ? 'rgba(40,30,15,0.92)' : 'rgba(60,44,22,0.55)';
      ctx.strokeStyle = selected
        ? '#ffd166'
        : unit
          ? 'rgba(230,180,90,0.35)'
          : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = selected ? 4 : 2;
      ctx.beginPath();
      this.rr(ctx, x - BENCH_CELL / 2 + 4, y - BENCH_CELL / 2 + 4, BENCH_CELL - 8, BENCH_CELL - 8, 10);
      ctx.fill();
      ctx.stroke();

      if (selected) {
        // 选中外发光
        ctx.strokeStyle = 'rgba(255,209,102,0.45)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        this.rr(ctx, x - BENCH_CELL / 2 + 2, y - BENCH_CELL / 2 + 2, BENCH_CELL - 4, BENCH_CELL - 4, 12);
        ctx.stroke();
      }

      if (unit) {
        this.drawUnit(ctx, unit, x, y);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = '16px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('备用', x, y);
      }
    }
  }

  private drawBoard(ctx: CanvasRenderingContext2D): void {
    const board: GridBoard = this.engine.playerSide.board;

    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const { x, y } = cellCenter(col, row);
        const unlocked = board.isUnlocked(col, row);
        const unit = board.getUnit(col, row);

        // 格子底
        const isPending = this.pendingUnit && this.pendingUnitXY?.x === col && this.pendingUnitXY?.y === row;
        ctx.fillStyle = !unlocked
          ? 'rgba(255,255,255,0.05)'
          : unit
            ? 'rgba(40,30,15,0.9)'
            : isPending
              ? 'rgba(127,208,82,0.25)'
              : 'rgba(60,44,22,0.85)';
        ctx.strokeStyle = unlocked ? 'rgba(230,180,90,0.35)' : 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        this.rr(ctx, x - CELL / 2 + 4, y - CELL / 2 + 4, CELL - 8, CELL - 8, 10);
        ctx.fill();
        ctx.stroke();

        if (!unlocked) {
          // 未解锁：锁图标
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.font = '26px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🔒', x, y);
          continue;
        }

        if (!unit) {
          if (isPending) {
            ctx.fillStyle = 'rgba(127,208,82,0.6)';
            ctx.font = '14px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('点击放置', x, y);
          }
          continue;
        }

        this.drawUnit(ctx, unit, x, y);
      }
    }
  }

  private drawUnit(ctx: CanvasRenderingContext2D, unit: Unit, x: number, y: number): void {
    const color = TYPE_COLOR[unit.type];
    const bright = 0.55 + unit.level * 0.09;

    // 字牌底色（等级越高越亮）
    ctx.fillStyle = `rgba(${Math.round(255 * bright)},${Math.round(255 * bright)},255,0.10)`;
    ctx.beginPath();
    this.rr(ctx, x - CELL / 2 + 8, y - CELL / 2 + 8, CELL - 16, CELL - 16, 8);
    ctx.fill();

    // 汉字（文字即视觉）
    ctx.fillStyle = color;
    ctx.font = `bold ${52 + unit.level * 4}px "STKaiti", "KaiTi", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + unit.level * 3;
    ctx.fillText(UNIT_CHAR[unit.type], x, y - 4);
    ctx.shadowBlur = 0;

    // 等级星
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('★'.repeat(unit.level), x, y + 38);

    // 类型角标
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    const typeName: Record<UnitType, string> = {
      [UnitType.SWORD]: '近战',
      [UnitType.SPEAR]: '穿透',
      [UnitType.BOW]: '远程',
      [UnitType.CAVALRY]: '高攻',
    };
    ctx.fillText(typeName[unit.type], x, y + CELL / 2 - 16);
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.engine.playerSide.enemies) {
      const x = BOARD_LEFT + (e.lane + 0.5) * CELL;
      const y = enemyYToPx(e.y);
      if (y < -30 || y > VIEW_H + 30) continue;

      // 敌兵：类型色圆 + 汉字（刀/枪/弓/骑，与顶部预告一致）
      const col = Renderer.ENEMY_COLOR[e.type] ?? '#7a1f1f';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Renderer.ENEMY_CHAR[e.type] ?? '兵', x, y + 1);

      // 血条
      const w = 34;
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - w / 2, y - 30, w, 5);
      ctx.fillStyle = ratio > 0.5 ? '#7fd052' : ratio > 0.25 ? '#ffd166' : '#e05252';
      ctx.fillRect(x - w / 2, y - 30, w * ratio, 5);
    }
  }

  private drawAdouBars(ctx: CanvasRenderingContext2D): void {
    const p = this.engine.playerSide;
    const e = this.engine.enemySide;

    // 对手（顶部居中，预告面板上方）
    this.drawHpBar(ctx, '敌方阿斗', e.adouHp, BATTLE_CFG.ADOU_MAX_HP, 160, 60, 400, '#a04040');
    // 我方（棋盘正下方居中，备选槽上方）
    this.drawHpBar(ctx, '我方阿斗', p.adouHp, BATTLE_CFG.ADOU_MAX_HP, 160, 748, 400, '#2e7d32');
  }

  private drawHpBar(
    ctx: CanvasRenderingContext2D,
    label: string,
    hp: number,
    max: number,
    x: number,
    y: number,
    w: number,
    color: string,
  ): void {
    const ratio = Math.max(0, hp / max);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    this.rr(ctx, x, y, w, 22, 6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    this.rr(ctx, x, y, w * ratio, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${label} ${Math.max(0, hp)}/${max}`, x + 10, y + 12);
  }

  private drawPendingGhost(ctx: CanvasRenderingContext2D): void {
    if (!this.pendingUnit || !this.pendingUnitXY) return;
    const { x, y } = cellCenter(this.pendingUnitXY.x, this.pendingUnitXY.y);
    ctx.globalAlpha = 0.55;
    this.drawUnit(ctx, this.pendingUnit, x, y);
    ctx.globalAlpha = 1;
  }

  private drawFx(dt: number): void {
    const ctx = this.ctx;

    // 攻击线
    this.fx = this.fx.filter((f) => {
      f.t -= dt;
      if (f.t <= 0) return false;
      const alpha = f.t / 0.18;
      ctx.strokeStyle = `rgba(255,209,102,${alpha * 0.9})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
      return true;
    });

    // 飘字
    this.floats = this.floats.filter((f) => {
      f.t -= dt;
      if (f.t <= 0) return false;
      ctx.globalAlpha = Math.min(1, f.t / 0.4);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.text, f.x, f.y - (1.2 - f.t) * 24);
      ctx.globalAlpha = 1;
      return true;
    });
  }
}
