import { UnitType } from '../../core/Const';
import { EventBus } from '../../core/EventBus';
import { Unit } from '../../data/models/Unit';
import { getUnitStat } from '../../data/config/UnitConfig';
import { killReward } from '../../data/rules/CombatRule';
import { GridBoard } from './GridBoard';
import { RecruitSystem, RecruitResult } from './RecruitSystem';
import { AIPlayer } from './AIPlayer';

/**
 * 战斗引擎（Web 版核心模拟器）
 * 模型：双方各守各的棋盘（Random Dice 式 PvP 竞速）
 *  - 牛群沿列从顶部生成，向下冲向牛犊，漏牛扣血
 *  - 棋盘上的动物伙伴自动攻击射程内牛群，击杀掉落干草
 *  - 谁牛犊先归零谁输；打满波次比剩余血量
 * 全部数值以"格"为单位（1 格 = CELL_PX 像素，渲染层换算）
 */

/** 备选槽容量（4 格一行） */
export const BENCH_SIZE = 4;

export const BATTLE_CFG = {
  ADOU_MAX_HP: 150,
  LEAK_DAMAGE: 6,
  WAVE_INTERVAL: 8,       // 两波间隔（秒）
  WAVE_SPAWN_GAP: 0.45,   // 波内出怪间隔（秒）
  MAX_WAVE: 30,
  BASE_ENEMY_HP: 20,
  HP_PER_WAVE: 5,
  BASE_SPEED: 0.30,       // 格/秒
  SPEED_PER_WAVE: 0.016,
  MAX_SPEED: 0.52,
  ENEMY_START_Y: -0.5,
  LEAK_Y: 3.5,            // 漏怪线（格，对应棋盘底）
  SHIELD_HP: 30,          // 广告救牛犊回复量
  INIT_MANTOU: 12,
} as const;

export interface Enemy {
  id: number;
  lane: number;   // 0-3 列
  y: number;      // 格单位（出生点为 -0.5）
  type: UnitType; // 牛群类型：牛/牦/羚/犀（血量/速度各异）
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
}

/** 波次计划：单只牛 = 列道 + 类型（确定性生成，预告与实机 100% 一致） */
export interface WaveEnemy {
  lane: number;
  type: UnitType;
}

/** 牛群类型数值倍率（相对基础值） */
const ENEMY_HP_MUL: Record<UnitType, number> = {
  [UnitType.SWORD]: 1.0,    // 牛：标准
  [UnitType.SPEAR]: 1.15,   // 牦：皮厚
  [UnitType.BOW]: 0.8,      // 羚：脆
  [UnitType.CAVALRY]: 1.3,  // 犀：最肉
};
const ENEMY_SPEED_MUL: Record<UnitType, number> = {
  [UnitType.SWORD]: 1.0,    // 牛：标准
  [UnitType.SPEAR]: 0.92,   // 牦：慢
  [UnitType.BOW]: 1.15,     // 羚：快
  [UnitType.CAVALRY]: 1.08, // 犀：偏快
};

/** 生成第 wave 波的牛群计划（数量随波次增长，类型/列道随机） */
export function genWavePlan(wave: number): WaveEnemy[] {
  if (wave < 1 || wave > BATTLE_CFG.MAX_WAVE) return [];
  const count = Math.min(2 + Math.floor(wave * 0.8), 10);
  const types = [UnitType.SWORD, UnitType.SPEAR, UnitType.BOW, UnitType.CAVALRY];
  return Array.from({ length: count }, () => ({
    lane: Math.floor(Math.random() * 4),
    type: types[Math.floor(Math.random() * types.length)],
  }));
}

export class Side {
  board = new GridBoard();
  recruit = new RecruitSystem();
  /** 备选槽（4 格）：召唤与开局赠送的伙伴先入槽，玩家点选后部署到棋盘 */
  bench: (Unit | null)[] = [];
  mantou: number = BATTLE_CFG.INIT_MANTOU;
  adouHp: number = BATTLE_CFG.ADOU_MAX_HP;
  enemies: Enemy[] = [];
  retreatUsed = false;
  shieldUsed = false;

  /** 波次状态 */
  wave = 0;
  waveTimer = 3;       // 开局 3s 缓冲
  spawnQueue = 0;      // 待生成敌人数量
  spawnGapTimer = 0;
  /** 当前波计划（spawnEnemy 按序取出）与下一波预告（渲染顶部槽） */
  wavePlan: WaveEnemy[] = [];
  nextWavePlan: WaveEnemy[] = [];

  private _nextEnemyId = 1;

  constructor(public isPlayer: boolean) {
    // 开局随机赠送 2~3 名士兵进备选槽（Design Pillar: 开局即选择）
    const gift = 2 + Math.floor(Math.random() * 2);
    this.bench = Array.from({ length: BENCH_SIZE }, (_, i) =>
      i < gift ? new Unit(this._randomUnitType(), 1) : null,
    );
    // 开局立即可见第 1 波预告
    this.nextWavePlan = genWavePlan(1);
  }

  private _randomUnitType(): UnitType {
    const types = [UnitType.SWORD, UnitType.SPEAR, UnitType.BOW, UnitType.CAVALRY];
    return types[Math.floor(Math.random() * types.length)];
  }

  /** 备选槽是否已满 */
  benchFull(): boolean {
    return this.bench.every((u) => u !== null);
  }

  /** 兵入备选槽；槽满返回 false */
  addToBench(unit: Unit): boolean {
    const idx = this.bench.indexOf(null);
    if (idx < 0) return false;
    this.bench[idx] = unit;
    return true;
  }

  /** 从备选槽取走士兵（部署后清槽） */
  removeFromBench(idx: number): Unit | null {
    if (idx < 0 || idx >= this.bench.length) return null;
    const u = this.bench[idx];
    this.bench[idx] = null;
    return u;
  }

  /** 按当前波计划生成一只牛；计划耗尽时兜底随机生成 */
  spawnEnemy(): Enemy {
    const plan = this.wavePlan.shift() ?? {
      lane: Math.floor(Math.random() * 4),
      type: this._randomUnitType(),
    };
    const hpMul = ENEMY_HP_MUL[plan.type];
    const spMul = ENEMY_SPEED_MUL[plan.type];
    const baseHp = BATTLE_CFG.BASE_ENEMY_HP + this.wave * BATTLE_CFG.HP_PER_WAVE;
    const e: Enemy = {
      id: this._nextEnemyId++,
      lane: plan.lane,
      y: BATTLE_CFG.ENEMY_START_Y,
      type: plan.type,
      hp: Math.round(baseHp * hpMul),
      maxHp: 0,
      speed: Math.min(
        (BATTLE_CFG.BASE_SPEED + this.wave * BATTLE_CFG.SPEED_PER_WAVE) * spMul,
        BATTLE_CFG.MAX_SPEED,
      ),
      reward: 0,
    };
    e.maxHp = e.hp;
    e.reward = Math.floor(e.hp / 5);
    this.enemies.push(e);
    return e;
  }
}

export type BattleWinner = 'player' | 'enemy' | 'draw' | null;

export class BattleEngine {
  playerSide = new Side(true);
  enemySide = new Side(false);
  ai = new AIPlayer(this.enemySide);

  time = 0;
  winner: BattleWinner = null;

  /** 玩家操作：召唤（校验干草并扣费）；干草不足返回 null */
  tryRecruit(): RecruitResult | null {
    const s = this.playerSide;
    if (s.mantou < s.recruit.currentCost) return null;
    s.mantou -= s.recruit.currentCost;
    const res = s.recruit.roll();
    EventBus.emit('recruit_result', res);
    EventBus.emit('mantou_changed', s.mantou);
    return res;
  }

  /** 玩家操作：放置/合成；失败（被占/未解锁）返回 null */
  placeUnit(unit: Unit, x: number, y: number): Unit | null {
    return this.playerSide.board.placeUnit(unit, x, y);
  }

  /** 玩家操作：付费解锁下一格（消耗递增）；干草不足或已全解锁返回 false */
  tryUnlockCell(): boolean {
    const s = this.playerSide;
    const cost = s.board.nextCost;
    if (cost <= 0 || s.mantou < cost) return false;
    s.mantou -= cost;
    const ok = s.board.expandGrid();
    if (ok) EventBus.emit('mantou_changed', s.mantou);
    return ok;
  }

  /** 玩家操作：驱牛（1 次/局，清空我方场上牛群） */
  retreat(): boolean {
    const s = this.playerSide;
    if (s.retreatUsed) return false;
    s.retreatUsed = true;
    s.enemies = [];
    EventBus.emit('retreat_used');
    return true;
  }

  /** 玩家操作：广告救牛犊（回血，1 次/局） */
  useShield(): boolean {
    const s = this.playerSide;
    if (s.shieldUsed || s.adouHp <= 0) return false;
    s.shieldUsed = true;
    s.adouHp = Math.min(BATTLE_CFG.ADOU_MAX_HP, s.adouHp + BATTLE_CFG.SHIELD_HP);
    EventBus.emit('adou_hp_changed', s.adouHp);
    return true;
  }

  /** 主循环：驱动双方模拟 */
  update(dt: number): void {
    if (this.winner) return;
    this.time += dt;

    this.updateSide(this.playerSide, dt);
    this.updateSide(this.enemySide, dt);
    // AI 决策（在模拟后，让 AI 反应稍慢一帧，符合人类观感）
    this.ai.think(dt);

    this.checkEnd();
  }

  private updateSide(side: Side, dt: number): void {
    // 1. 波次生成（双方节奏同步：本波出完才开始下一波计时）
    if (side.spawnQueue > 0) {
      side.spawnGapTimer -= dt;
      if (side.spawnGapTimer <= 0) {
        side.spawnEnemy();
        side.spawnQueue--;
        side.spawnGapTimer = BATTLE_CFG.WAVE_SPAWN_GAP;
      }
    } else if (side.wave < BATTLE_CFG.MAX_WAVE) {
      side.waveTimer -= dt;
      if (side.waveTimer <= 0) {
        side.wave++;
        // 确定性波次计划：当前波敌人 + 下一波预告（顶部槽显示）
        side.wavePlan = genWavePlan(side.wave);
        side.spawnQueue = side.wavePlan.length;
        side.nextWavePlan = side.wave < BATTLE_CFG.MAX_WAVE ? genWavePlan(side.wave + 1) : [];
        side.spawnGapTimer = 0;
        side.waveTimer = BATTLE_CFG.WAVE_INTERVAL; // 重置波次计时（防连跳）
      }
    }

    // 2. 敌人移动 + 漏怪
    const survivors: Enemy[] = [];
    for (const e of side.enemies) {
      e.y += e.speed * dt;
      if (e.y >= BATTLE_CFG.LEAK_Y) {
        side.adouHp -= BATTLE_CFG.LEAK_DAMAGE;
        if (side.isPlayer) EventBus.emit('adou_hp_changed', side.adouHp);
        continue; // 漏怪：不保留
      }
      survivors.push(e);
    }
    side.enemies = survivors;

    // 3. 兵自动攻击
    for (const unit of side.board.allUnits()) {
      this.updateUnitAttack(side, unit, dt);
    }
  }

  private updateUnitAttack(side: Side, unit: Unit, dt: number): void {
    unit.atkCooldown = (unit.atkCooldown ?? 0) - dt;
    if (unit.atkCooldown > 0) return;

    const stat = getUnitStat(unit.type, unit.level);
    const target = this.findTarget(side, unit, stat.range);
    if (!target) return;

    unit.atkCooldown = stat.baseAtkSpeed;
    let damage = stat.baseAttack;

    // 枪兵穿透：对同列更靠后的敌人额外 50%（对应 CombatRule 的设计）
    if (unit.type === UnitType.SPEAR) {
      for (const other of side.enemies) {
        if (other === target) continue;
        if (other.lane === target.lane && other.y > target.y) {
          other.hp -= Math.max(1, Math.round(damage * 0.5));
          if (other.hp <= 0) this.killEnemy(side, other, unit);
        }
      }
    }

    target.hp -= damage;
    EventBus.emit('unit_attack', { unit, enemy: target, damage });
    if (target.hp <= 0) this.killEnemy(side, target, unit);
  }

  /** 找射程内最近目标；弓全屏取曼哈顿最近，近战只打同列 */
  private findTarget(side: Side, unit: Unit, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = Infinity;
    const rowCenter = unit.gridY + 0.5;

    for (const e of side.enemies) {
      let dist: number;
      if (unit.type === UnitType.BOW) {
        dist = Math.abs(e.lane - unit.gridX) + Math.abs(e.y - rowCenter);
        if (dist > range) continue; // 弓 range=6 全屏
      } else {
        if (e.lane !== unit.gridX) continue;
        dist = Math.abs(e.y - rowCenter);
        const maxDist = range === 0 ? 0.6 : range + 0.6;
        if (dist > maxDist) continue;
      }
      if (dist < bestDist) {
        best = e;
        bestDist = dist;
      }
    }
    return best;
  }

  /** 击杀掉落：与击杀者的伙伴等级挂钩（激励合成升级），掉落 6 + 等级×3 干草 */
  private killEnemy(side: Side, e: Enemy, killer?: Unit): void {
    const idx = side.enemies.indexOf(e);
    if (idx < 0) return;
    side.enemies.splice(idx, 1);
    side.mantou += killReward(killer?.level ?? 0);
    if (side.isPlayer) {
      EventBus.emit('enemy_killed', e);
      EventBus.emit('mantou_changed', side.mantou);
    }
  }

  private checkEnd(): void {
    const p = this.playerSide;
    const e = this.enemySide;

    // 同帧双方归零：判平局（避免帧序决定胜负）
    if (p.adouHp <= 0 && e.adouHp <= 0) {
      this.winner = 'draw';
    } else if (p.adouHp <= 0) {
      this.winner = 'enemy';
    } else if (e.adouHp <= 0) {
      this.winner = 'player';
    } else if (
      p.wave >= BATTLE_CFG.MAX_WAVE &&
      e.wave >= BATTLE_CFG.MAX_WAVE &&
      p.spawnQueue <= 0 &&
      e.spawnQueue <= 0 &&
      p.enemies.length === 0 &&
      e.enemies.length === 0
    ) {
      this.winner = p.adouHp === e.adouHp ? 'draw' : p.adouHp > e.adouHp ? 'player' : 'enemy';
    }

    if (this.winner) {
      EventBus.emit('battle_settled', this.winner);
    }
  }
}
