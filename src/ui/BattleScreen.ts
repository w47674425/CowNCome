import { BattleEngine } from '../game/battle/BattleEngine';
import {
  Renderer, VIEW_W, VIEW_H, BOARD_LEFT, BOARD_TOP, CELL, BOARD_COLS, BOARD_ROWS,
  BENCH_SIZE, BENCH_LEFT, BENCH_TOP, BENCH_CELL,
} from '../game/render/Renderer';
import { EventBus } from '../core/EventBus';
import { AdManager } from '../manager/AdManager';
import { StorageManager, PlayerSave } from '../manager/StorageManager';
import { Unit } from '../data/models/Unit';
import { UNIT_CHAR } from '../data/config/UnitConfig';
import { RecruitResult } from '../game/battle/RecruitSystem';

/**
 * 战斗界面：Canvas 主渲染 + DOM HUD + 输入处理 + 主循环
 * 交互流：点征兵 → 出现待放置字牌 → 点空格放置 / 点同类同级格合成
 */

export class BattleScreen {
  engine: BattleEngine;
  renderer: Renderer;

  private root: HTMLElement | null = null;
  private raf = 0;
  private lastTime = 0;
  private pendingUnit: Unit | null = null;
  /** 当前选中的备选槽下标（兵来自备选槽时非 null，部署成功后清槽） */
  private pendingBenchIdx: number | null = null;
  private hoverCell: { x: number; y: number } | null = null;

  /** 取消订阅函数集合（destroy 时统一清理） */
  private cancels: (() => void)[] = [];

  private elMantou!: HTMLElement;
  private elRecruitBtn!: HTMLElement;
  private elRetreatBtn!: HTMLElement;
  private elShieldBtn!: HTMLElement;
  private elHint!: HTMLElement;

  constructor(
    private canvas: HTMLCanvasElement,
    private onResult: (engine: BattleEngine, winner: 'player' | 'enemy' | 'draw') => void,
  ) {
    this.engine = new BattleEngine();
    this.renderer = new Renderer(canvas, this.engine);
  }

  mount(): HTMLElement {
    const root = document.createElement('div');
    root.style.cssText = `position:absolute; inset:0; pointer-events:none;`;
    root.innerHTML = this.hudHtml();
    this.root = root;
    this.bindHud(root);
    this.bindInput();
    this.bindEvents();
    this.refreshHud();
    // 开局引导：备选槽赠送士兵
    const gifted = this.engine.playerSide.bench.filter((u) => u !== null).length;
    this.setHint(
      gifted > 0
        ? `开局赠送 ${gifted} 名士兵！点击备选槽选中，再点棋盘部署`
        : '点击「征兵」抽取字牌，抽到士兵会进入备选槽',
    );
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    return root;
  }

  private hudHtml(): string {
    return `
      <!-- 底部操作栏（横排）：馒头 / 征兵 / 退兵 / 救阿斗 -->
      <div id="hud-actions" style="position:absolute; bottom:26px; left:50%; transform:translateX(-50%);
          display:flex; flex-direction:row; align-items:center; gap:10px; pointer-events:auto;">
        <div style="width:84px; text-align:center; font-size:17px; font-weight:bold; color:#ffd166;
            background:rgba(0,0,0,0.55); padding:9px 0; border-radius:10px; line-height:1.25;">
          🍞<br><span id="hud-mantou">12</span>
        </div>
        <button id="btn-recruit" style="width:200px; padding:12px 0; font-size:18px; font-weight:bold; border:none;
            border-radius:10px; cursor:pointer; color:#2a1503;
            background:linear-gradient(180deg,#ffd166,#e8a33d);">
          征 兵 <span id="btn-recruit-cost" style="font-size:12px;">(12🍞)</span>
        </button>
        <button id="btn-retreat" style="width:150px; padding:12px 0; font-size:15px; font-weight:bold; border:none;
            border-radius:10px; cursor:pointer; color:#fff;
            background:linear-gradient(180deg,#e05252,#a03232);">
          🚩 退兵 <span id="btn-retreat-count" style="font-size:12px;">(1次)</span>
        </button>
        <button id="btn-shield" style="width:150px; padding:12px 0; font-size:14px; font-weight:bold; border:none;
            border-radius:10px; cursor:pointer; color:#fff;
            background:linear-gradient(180deg,#7fb0e0,#4a7bb0);">
          📺 救阿斗 <span style="font-size:12px;">(+30)</span>
        </button>
      </div>

      <!-- 操作提示（按钮栏上方） -->
      <div id="hud-hint" style="position:absolute; bottom:118px; left:50%; transform:translateX(-50%);
          font-size:13px; color:#c9b58a; white-space:nowrap;
          background:rgba(0,0,0,0.35); padding:5px 14px; border-radius:8px;">
        点击「征兵」抽取字牌
      </div>
    `;
  }

  private bindHud(root: HTMLElement): void {
    this.elMantou = root.querySelector('#hud-mantou')!;
    this.elRecruitBtn = root.querySelector('#btn-recruit')!;
    this.elRetreatBtn = root.querySelector('#btn-retreat')!;
    this.elShieldBtn = root.querySelector('#btn-shield')!;
    this.elHint = root.querySelector('#hud-hint')!;

    this.elRecruitBtn.addEventListener('click', () => this.onRecruit());
    this.elRetreatBtn.addEventListener('click', () => this.onRetreat());
    this.elShieldBtn.addEventListener('click', () => this.onShield());
  }

  private bindInput(): void {
    const onMove = (e: PointerEvent) => {
      const cell = this.pickCell(e);
      this.hoverCell = cell;
      if (this.pendingUnit && cell) {
        this.renderer.pendingUnit = this.pendingUnit;
        this.renderer.pendingUnitXY = cell;
      } else if (!cell) {
        this.renderer.pendingUnit = null;
        this.renderer.pendingUnitXY = null;
      }
    };
    const onClick = (e: PointerEvent) => {
      // 1. 点在备选槽区域 → 选中/取消士兵
      const benchIdx = this.pickBenchSlot(e);
      if (benchIdx !== null) {
        this.onBenchClick(benchIdx);
        return;
      }

      // 2. 点在棋盘 → 部署/合成
      const cell = this.pickCell(e);
      if (!cell) return;
      if (this.pendingUnit) {
        const placed = this.engine.placeUnit(this.pendingUnit, cell.x, cell.y);
        if (placed) {
          const isSynth = placed.level > this.pendingUnit.level;
          // 兵来自备选槽 → 部署成功后清槽
          if (this.pendingBenchIdx !== null) {
            this.engine.playerSide.removeFromBench(this.pendingBenchIdx);
            this.pendingBenchIdx = null;
            this.renderer.selectedBenchIdx = null;
          }
          this.pendingUnit = null;
          this.renderer.pendingUnit = null;
          this.renderer.pendingUnitXY = null;
          this.setHint(isSynth
            ? `合成成功！${UNIT_CHAR[placed.type]} Lv.${placed.level}`
            : `已部署 ${UNIT_CHAR[placed.type]}`);
          this.refreshHud();
        } else {
          this.setHint('该格不可放置：已被不同类型占用或未解锁');
        }
      }
    };

    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('click', onClick);
    this.cancels.push(() => {
      this.canvas.removeEventListener('pointermove', onMove);
      this.canvas.removeEventListener('click', onClick);
    });
  }

  private bindEvents(): void {
    this.cancels.push(
      EventBus.on('battle_settled', (winner: 'player' | 'enemy' | 'draw') => {
        this.onEnd(winner);
      }),
    );
  }

  /** 屏幕坐标 → 棋盘格子 */
  private pickCell(e: PointerEvent): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const scale = rect.width / VIEW_W;
    const lx = (e.clientX - rect.left) / scale;
    const ly = (e.clientY - rect.top) / scale;
    const col = Math.floor((lx - BOARD_LEFT) / CELL);
    const row = Math.floor((ly - BOARD_TOP) / CELL);
    if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) return null;
    return { x: col, y: row };
  }

  /** 屏幕坐标 → 备选槽下标；不在备选槽区域返回 null */
  private pickBenchSlot(e: PointerEvent): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const scale = rect.width / VIEW_W;
    const lx = (e.clientX - rect.left) / scale;
    const ly = (e.clientY - rect.top) / scale;
    if (ly < BENCH_TOP || ly >= BENCH_TOP + BENCH_CELL) return null;
    const idx = Math.floor((lx - BENCH_LEFT) / BENCH_CELL);
    if (idx < 0 || idx >= BENCH_SIZE) return null;
    return idx;
  }

  /** 点击备选槽：有兵 → 选中/取消；空槽 → 取消当前选中 */
  private onBenchClick(idx: number): void {
    const unit = this.engine.playerSide.bench[idx];
    if (!unit) {
      if (this.pendingBenchIdx !== null) this.cancelPending('已取消选中');
      return;
    }
    if (this.pendingBenchIdx === idx) {
      this.cancelPending('已取消选中');
      return;
    }
    this.pendingBenchIdx = idx;
    this.pendingUnit = unit;
    this.renderer.pendingUnit = unit;
    this.renderer.pendingUnitXY = null;
    this.renderer.selectedBenchIdx = idx;
    this.setHint(`已选中「${UNIT_CHAR[unit.type]}」Lv.${unit.level}，点击棋盘空格部署`);
    this.refreshHud();
  }

  /** 清空待放置状态（取消选中/部署成功统一走这里） */
  private cancelPending(hint?: string): void {
    this.pendingBenchIdx = null;
    this.pendingUnit = null;
    this.renderer.pendingUnit = null;
    this.renderer.pendingUnitXY = null;
    this.renderer.selectedBenchIdx = null;
    if (hint) this.setHint(hint);
  }

  // ---------- 玩家操作 ----------

  private onRecruit(): void {
    if (this.pendingUnit) {
      this.setHint('已有选中士兵，请先点击格子部署或取消选中');
      return;
    }
    if (this.engine.playerSide.benchFull()) {
      this.setHint('备选槽已满！先部署兵力腾出空位');
      return;
    }
    const res = this.engine.tryRecruit();
    if (!res) {
      this.setHint('馒头不足！先击杀敌兵获取馒头');
      return;
    }
    this.handleRecruitResult(res);
  }

  private handleRecruitResult(res: RecruitResult): void {
    if (res.kind === 'unit') {
      // 士兵入备选槽（征兵前已校验槽未满，addToBench 不会失败）
      this.engine.playerSide.addToBench(res.unit);
      this.setHint(`抽到「${UNIT_CHAR[res.unit.type]}」！已放入备选槽，点击选中后部署到棋盘`);
    } else if (res.kind === 'heroChar') {
      this.collectHeroChar(res.heroChar);
      this.setHint(`获得武将字牌「${res.heroChar}」！集齐可召唤武将（Phase2）`);
    } else {
      const ok = this.engine.playerSide.board.expandGrid();
      this.setHint(ok ? '铲子！棋盘扩一格' : '铲子！但棋盘已满');
    }
    this.refreshHud();
  }

  private collectHeroChar(char: string): void {
    const save: PlayerSave = StorageManager.loadSave();
    save.collection[char] = (save.collection[char] ?? 0) + 1;
    StorageManager.save(save);
  }

  private onRetreat(): void {
    const ok = this.engine.retreat();
    if (ok) this.setHint('🚩 退兵！场上敌兵已清空');
    else this.setHint('退兵每局仅 1 次，已使用');
    this.refreshHud();
  }

  private onShield(): void {
    if (this.engine.playerSide.shieldUsed) {
      this.setHint('救阿斗每局仅 1 次');
      return;
    }
    this.setHint('📺 观看广告中…');
    AdManager.showRewarded('rescue_shield').then((done) => {
      if (done) {
        this.engine.useShield();
        this.setHint('广告观看完成！阿斗恢复 30 血');
      } else {
        this.setHint('广告未完成，未发放奖励');
      }
      this.refreshHud();
    });
  }

  // ---------- 渲染循环 ----------

  private loop = (now: number): void => {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.engine.update(dt);
    this.renderer.render(dt);
    this.refreshHud();

    if (!this.engine.winner) {
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  // ---------- HUD 刷新 ----------

  private refreshHud(): void {
    const p = this.engine.playerSide;
    this.elMantou.textContent = String(p.mantou);
    this.elRecruitBtn.querySelector('#btn-recruit-cost')!.textContent = `(${p.recruit.currentCost}🍞)`;
    this.elRetreatBtn.querySelector('#btn-retreat-count')!.textContent = p.retreatUsed ? '(已用)' : '(1次)';
    this.elShieldBtn.style.opacity = p.shieldUsed ? '0.5' : '1';
  }

  private setHint(text: string): void {
    this.elHint.textContent = text;
  }

  private onEnd(winner: 'player' | 'enemy' | 'draw'): void {
    cancelAnimationFrame(this.raf);
    this.onResult(this.engine, winner);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.cancels.forEach((c) => c());
    this.cancels = [];
    EventBus.clear();
  }
}
