"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/game/battle/BattleEngine.ts
var BattleEngine_exports = {};
__export(BattleEngine_exports, {
  BATTLE_CFG: () => BATTLE_CFG,
  BENCH_SIZE: () => BENCH_SIZE,
  BattleEngine: () => BattleEngine,
  Side: () => Side,
  genWavePlan: () => genWavePlan
});
module.exports = __toCommonJS(BattleEngine_exports);

// src/core/EventBus.ts
var EventBus = class {
  static _handlers = /* @__PURE__ */ new Map();
  static on(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, /* @__PURE__ */ new Set());
    }
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }
  static off(event, handler) {
    this._handlers.get(event)?.delete(handler);
  }
  static emit(event, ...args) {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    [...handlers].forEach((h) => {
      try {
        h(...args);
      } catch (e) {
        console.error(`[EventBus] handler error on ${event}:`, e);
      }
    });
  }
  /** 清空全部（场景切换/退出登录时调用） */
  static clear() {
    this._handlers.clear();
  }
};

// src/data/models/Unit.ts
var Unit = class _Unit {
  type;
  level;
  /** 所在格子坐标；-1 = 未上阵（召唤面板/背包中） */
  gridX;
  gridY;
  /** 攻击冷却（战斗引擎维护，单位：秒） */
  atkCooldown = 0;
  constructor(type, level = 1) {
    this.type = type;
    this.level = level;
    this.gridX = -1;
    this.gridY = -1;
  }
  get isOnBoard() {
    return this.gridX >= 0;
  }
  /** 合成检测：同类同级才能合成 */
  canSynthesizeWith(other) {
    return this.type === other.type && this.level === other.level;
  }
  /** 合成产物（等级 +1） */
  synthesize() {
    return new _Unit(this.type, this.level + 1);
  }
};

// src/data/config/UnitConfig.ts
var STAT = {
  // 犬：近战肉盾，攻速中等。Rationale: 前排抗伤定位，攻击低但稳定
  ["sword" /* SWORD */]: {
    baseAttack: 10,
    baseAtkSpeed: 1.2,
    range: 0,
    atkGrowth: 1.35
  },
  // 狼：近战穿透，打直线后排 50% 伤害（CombatRule 实现）
  ["spear" /* SPEAR */]: {
    baseAttack: 14,
    baseAtkSpeed: 1.5,
    range: 1,
    atkGrowth: 1.4
  },
  // 鹰：远程高攻低速，射程覆盖 2/3 棋盘
  ["bow" /* BOW */]: {
    baseAttack: 18,
    baseAtkSpeed: 2,
    range: 6,
    atkGrowth: 1.45
  },
  // 马：机动高攻，快速填补防线缺口（参考 39kf 攻略：前期优先马）
  ["cavalry" /* CAVALRY */]: {
    baseAttack: 12,
    baseAtkSpeed: 0.9,
    range: 0,
    atkGrowth: 1.3
  }
};
var UNIT_CHAR = {
  ["sword" /* SWORD */]: "\u72AC",
  // 近战肉盾 · 守家犬
  ["spear" /* SPEAR */]: "\u72FC",
  // 穿透撕咬 · 狼
  ["bow" /* BOW */]: "\u9E70",
  // 远程高攻 · 鹰
  ["cavalry" /* CAVALRY */]: "\u9A6C"
  // 冲锋高攻 · 马
};
var MAX_LEVEL = 5;
function getUnitStat(type, level) {
  const base = STAT[type];
  const growth = Math.pow(base.atkGrowth, level - 1);
  return {
    baseAttack: Math.floor(base.baseAttack * growth),
    baseAtkSpeed: base.baseAtkSpeed,
    range: base.range,
    atkGrowth: base.atkGrowth
  };
}

// src/data/rules/CombatRule.ts
function killReward(level) {
  return 6 + level * 3;
}

// src/data/rules/SynthesizeRule.ts
var SynthesizeRule = class {
  constructor(maxLevel) {
    this.maxLevel = maxLevel;
  }
  /**
   * 尝试合成两个格子上的单位
   * @param a 第一个单位（null 表示空格/字牌/其他）
   * @param b 第二个单位
   */
  trySynthesize(a, b) {
    if (!a || !b) return { ok: false, reason: "not_unit" };
    if (a.type !== b.type) return { ok: false, reason: "type_mismatch" };
    if (a.level !== b.level) return { ok: false, reason: "level_mismatch" };
    if (a.level >= this.maxLevel) return { ok: false, reason: "max_level" };
    return {
      ok: true,
      result: { type: a.type, level: a.level + 1 },
      reason: "same_type_same_level"
    };
  }
};

// src/game/battle/GridBoard.ts
var BOARD_COLS = 4;
var BOARD_ROWS = 3;
var START_GRID_COUNT = 6;
var GRID_UNLOCK_COSTS = [40, 70, 110, 160, 220, 300];
function nextUnlockCost(unlockedCount) {
  const idx = unlockedCount - START_GRID_COUNT;
  if (idx < 0 || idx >= GRID_UNLOCK_COSTS.length) return 0;
  return GRID_UNLOCK_COSTS[idx];
}
var GridBoard = class {
  /** cells[row][col]，null = 空格（可放置） */
  cells;
  /** 已解锁格数（铲子扩格 +1，上限 12） */
  unlockedCount;
  _synth = new SynthesizeRule(MAX_LEVEL);
  constructor() {
    this.cells = Array.from(
      { length: BOARD_ROWS },
      () => Array(BOARD_COLS).fill(null)
    );
    this.unlockedCount = 0;
    this.unlockedCount = START_GRID_COUNT;
  }
  /** 行优先序号 → 坐标 */
  indexToXY(i) {
    return { x: i % BOARD_COLS, y: Math.floor(i / BOARD_COLS) };
  }
  /** 该格是否已解锁（可放置/已占用） */
  isUnlocked(x, y) {
    const idx = y * BOARD_COLS + x;
    return idx < this.unlockedCount;
  }
  /** 当前下一格的解锁成本（干草）；0 = 已全部解锁 */
  get nextCost() {
    return nextUnlockCost(this.unlockedCount);
  }
  getUnit(x, y) {
    return this.cells[y][x];
  }
  /** 第一个未解锁的空格坐标（铲子扩格目标），无则 null */
  nextExpandCell() {
    if (this.unlockedCount >= BOARD_COLS * BOARD_ROWS) return null;
    return this.indexToXY(this.unlockedCount);
  }
  /** 第一个可放置的空格坐标 */
  firstEmptyCell() {
    for (let i = 0; i < this.unlockedCount; i++) {
      const { x, y } = this.indexToXY(i);
      if (!this.cells[y][x]) return { x, y };
    }
    return null;
  }
  /** 所有已放置的兵 */
  allUnits() {
    const list = [];
    for (let y = 0; y < BOARD_ROWS; y++) {
      for (let x = 0; x < BOARD_COLS; x++) {
        if (this.cells[y][x]) list.push(this.cells[y][x]);
      }
    }
    return list;
  }
  /**
   * 放置兵到指定格；若目标格有同类同级兵则触发合成（占用 1 格）
   * @returns 放置/合成后的 Unit；失败（被不同类型占用）返回 null
   */
  placeUnit(unit, x, y) {
    if (!this.isUnlocked(x, y)) return null;
    const target = this.cells[y][x];
    if (target && target.canSynthesizeWith(unit)) {
      const merged = target.synthesize();
      this.cells[y][x] = merged;
      merged.gridX = x;
      merged.gridY = y;
      EventBus.emit("unit_synthesized", merged);
      return merged;
    }
    if (target) return null;
    this.cells[y][x] = unit;
    unit.gridX = x;
    unit.gridY = y;
    return unit;
  }
  /** 扩格：解锁下一个空格（铲子免费 / 付费解锁共用）；已满返回 false */
  expandGrid() {
    const cell = this.nextExpandCell();
    if (!cell) return false;
    this.unlockedCount++;
    EventBus.emit("grid_expanded", cell);
    return true;
  }
  /** 自动寻找能触发合成的一对格子（AI / 便捷操作用） */
  findSynthesisPair() {
    for (let y = 0; y < BOARD_ROWS; y++) {
      for (let x = 0; x < BOARD_COLS; x++) {
        const u = this.cells[y][x];
        if (!u) continue;
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
  synthesizePair(a, b) {
    const ua = this.cells[a.y][a.x];
    const ub = this.cells[b.y][b.x];
    if (!ua || !ub || !ua.canSynthesizeWith(ub)) return null;
    const merged = ua.synthesize();
    this.cells[a.y][a.x] = merged;
    this.cells[b.y][b.x] = null;
    merged.gridX = a.x;
    merged.gridY = a.y;
    EventBus.emit("unit_synthesized", merged);
    return merged;
  }
};

// src/data/config/RecruitCost.ts
var RECRUIT_COST = [10, 15, 22, 32, 46, 66, 94, 134, 190, 270];
var RECRUIT_WEIGHTS = {
  unit: 76,
  heroChar: 20,
  shovel: 4
};
var HERO_PITY_COUNT = 12;
function getRecruitCost(count) {
  const idx = Math.min(count, RECRUIT_COST.length - 1);
  return RECRUIT_COST[idx];
}

// src/game/battle/RecruitSystem.ts
var HERO_CHARS = ["\u725B", "\u7F8A", "\u9A6C", "\u9E21", "\u9E2D", "\u9E45", "\u732A", "\u72AC", "\u732B", "\u5154", "\u9E7F", "\u7334"];
var RecruitSystem = class {
  _count = 0;
  _pityCountdown = HERO_PITY_COUNT;
  /** 已召唤次数（成本递增索引） */
  get count() {
    return this._count;
  }
  get currentCost() {
    return getRecruitCost(this._count);
  }
  /** 生成一次掉落（不扣干草，由调用方校验费用） */
  roll() {
    this._count++;
    this._pityCountdown--;
    if (this._pityCountdown <= 0) {
      this._pityCountdown = HERO_PITY_COUNT;
      return { kind: "heroChar", heroChar: this._pickHeroChar() };
    }
    const roll = Math.random() * 100;
    if (roll < RECRUIT_WEIGHTS.unit) {
      return { kind: "unit", unit: new Unit(this._pickUnitType(), 1) };
    }
    if (roll < RECRUIT_WEIGHTS.unit + RECRUIT_WEIGHTS.heroChar) {
      return { kind: "heroChar", heroChar: this._pickHeroChar() };
    }
    return { kind: "shovel" };
  }
  _pickUnitType() {
    const types = ["sword" /* SWORD */, "spear" /* SPEAR */, "bow" /* BOW */, "cavalry" /* CAVALRY */];
    return types[Math.floor(Math.random() * types.length)];
  }
  _pickHeroChar() {
    return HERO_CHARS[Math.floor(Math.random() * HERO_CHARS.length)];
  }
};

// src/game/battle/AIPlayer.ts
var AIPlayer = class {
  constructor(side) {
    this.side = side;
  }
  _thinkTimer = 0;
  _thinkInterval = 0.55;
  think(dt) {
    if (this.side.adouHp <= 0) return;
    this._thinkTimer -= dt;
    if (this._thinkTimer > 0) return;
    this._thinkTimer = this._thinkInterval;
    const s = this.side;
    for (let i = 0; i < 6; i++) {
      let acted = false;
      const pair = s.board.findSynthesisPair();
      if (pair) {
        s.board.synthesizePair(pair.a, pair.b);
        acted = true;
      }
      if (!acted) {
        let cell = s.board.firstEmptyCell();
        if (!cell) {
          const next = s.board.nextExpandCell();
          if (next) {
            s.board.expandGrid();
            cell = next;
          }
        }
        if (cell) {
          const idx = s.bench.findIndex((u) => u !== null);
          if (idx >= 0) {
            const u = s.bench[idx];
            s.bench[idx] = null;
            s.board.placeUnit(u, cell.x, cell.y);
            acted = true;
          }
        }
      }
      if (!acted) {
        const cost = s.board.nextCost;
        if (cost > 0 && cost <= 120 && s.mantou >= cost) {
          s.mantou -= cost;
          s.board.expandGrid();
          acted = true;
        }
      }
      if (!acted) {
        const cost = s.recruit.currentCost;
        const hasSpace = !!s.board.firstEmptyCell() || !!s.board.nextExpandCell() || !s.benchFull();
        if (s.mantou >= cost && hasSpace) {
          s.mantou -= cost;
          const res = s.recruit.roll();
          if (res.kind === "unit") {
            const cell = s.board.firstEmptyCell();
            if (cell) s.board.placeUnit(res.unit, cell.x, cell.y);
            else s.addToBench(res.unit);
          } else if (res.kind === "shovel") {
            s.board.expandGrid();
          }
          acted = true;
        }
      }
      if (!acted) break;
    }
    if (!s.retreatUsed && s.adouHp < 20 && s.enemies.length >= 3) {
      s.retreatUsed = true;
      s.enemies = [];
    }
  }
};

// src/game/battle/BattleEngine.ts
var BENCH_SIZE = 4;
var BATTLE_CFG = {
  ADOU_MAX_HP: 150,
  LEAK_DAMAGE: 6,
  WAVE_INTERVAL: 8,
  // 两波间隔（秒）
  WAVE_SPAWN_GAP: 0.45,
  // 波内出怪间隔（秒）
  MAX_WAVE: 30,
  BASE_ENEMY_HP: 20,
  HP_PER_WAVE: 5,
  BASE_SPEED: 0.3,
  // 格/秒
  SPEED_PER_WAVE: 0.016,
  MAX_SPEED: 0.52,
  ENEMY_START_Y: -0.5,
  LEAK_Y: 3.5,
  // 漏怪线（格，对应棋盘底）
  SHIELD_HP: 30,
  // 广告救牛犊回复量
  INIT_MANTOU: 12
};
var ENEMY_HP_MUL = {
  ["sword" /* SWORD */]: 1,
  // 牛：标准
  ["spear" /* SPEAR */]: 1.15,
  // 牦：皮厚
  ["bow" /* BOW */]: 0.8,
  // 羚：脆
  ["cavalry" /* CAVALRY */]: 1.3
  // 犀：最肉
};
var ENEMY_SPEED_MUL = {
  ["sword" /* SWORD */]: 1,
  // 牛：标准
  ["spear" /* SPEAR */]: 0.92,
  // 牦：慢
  ["bow" /* BOW */]: 1.15,
  // 羚：快
  ["cavalry" /* CAVALRY */]: 1.08
  // 犀：偏快
};
function genWavePlan(wave) {
  if (wave < 1 || wave > BATTLE_CFG.MAX_WAVE) return [];
  const count = Math.min(2 + Math.floor(wave * 0.8), 10);
  const types = ["sword" /* SWORD */, "spear" /* SPEAR */, "bow" /* BOW */, "cavalry" /* CAVALRY */];
  return Array.from({ length: count }, () => ({
    lane: Math.floor(Math.random() * 4),
    type: types[Math.floor(Math.random() * types.length)]
  }));
}
var Side = class {
  constructor(isPlayer) {
    this.isPlayer = isPlayer;
    const gift = 2 + Math.floor(Math.random() * 2);
    this.bench = Array.from(
      { length: BENCH_SIZE },
      (_, i) => i < gift ? new Unit(this._randomUnitType(), 1) : null
    );
    this.nextWavePlan = genWavePlan(1);
  }
  board = new GridBoard();
  recruit = new RecruitSystem();
  /** 备选槽（4 格）：召唤与开局赠送的伙伴先入槽，玩家点选后部署到棋盘 */
  bench = [];
  mantou = BATTLE_CFG.INIT_MANTOU;
  adouHp = BATTLE_CFG.ADOU_MAX_HP;
  enemies = [];
  retreatUsed = false;
  shieldUsed = false;
  /** 波次状态 */
  wave = 0;
  waveTimer = 3;
  // 开局 3s 缓冲
  spawnQueue = 0;
  // 待生成敌人数量
  spawnGapTimer = 0;
  /** 当前波计划（spawnEnemy 按序取出）与下一波预告（渲染顶部槽） */
  wavePlan = [];
  nextWavePlan = [];
  _nextEnemyId = 1;
  _randomUnitType() {
    const types = ["sword" /* SWORD */, "spear" /* SPEAR */, "bow" /* BOW */, "cavalry" /* CAVALRY */];
    return types[Math.floor(Math.random() * types.length)];
  }
  /** 备选槽是否已满 */
  benchFull() {
    return this.bench.every((u) => u !== null);
  }
  /** 兵入备选槽；槽满返回 false */
  addToBench(unit) {
    const idx = this.bench.indexOf(null);
    if (idx < 0) return false;
    this.bench[idx] = unit;
    return true;
  }
  /** 从备选槽取走士兵（部署后清槽） */
  removeFromBench(idx) {
    if (idx < 0 || idx >= this.bench.length) return null;
    const u = this.bench[idx];
    this.bench[idx] = null;
    return u;
  }
  /** 按当前波计划生成一只牛；计划耗尽时兜底随机生成 */
  spawnEnemy() {
    const plan = this.wavePlan.shift() ?? {
      lane: Math.floor(Math.random() * 4),
      type: this._randomUnitType()
    };
    const hpMul = ENEMY_HP_MUL[plan.type];
    const spMul = ENEMY_SPEED_MUL[plan.type];
    const baseHp = BATTLE_CFG.BASE_ENEMY_HP + this.wave * BATTLE_CFG.HP_PER_WAVE;
    const e = {
      id: this._nextEnemyId++,
      lane: plan.lane,
      y: BATTLE_CFG.ENEMY_START_Y,
      type: plan.type,
      hp: Math.round(baseHp * hpMul),
      maxHp: 0,
      speed: Math.min(
        (BATTLE_CFG.BASE_SPEED + this.wave * BATTLE_CFG.SPEED_PER_WAVE) * spMul,
        BATTLE_CFG.MAX_SPEED
      ),
      reward: 0
    };
    e.maxHp = e.hp;
    e.reward = Math.floor(e.hp / 5);
    this.enemies.push(e);
    return e;
  }
};
var BattleEngine = class {
  playerSide = new Side(true);
  enemySide = new Side(false);
  ai = new AIPlayer(this.enemySide);
  time = 0;
  winner = null;
  /** 玩家操作：召唤（校验干草并扣费）；干草不足返回 null */
  tryRecruit() {
    const s = this.playerSide;
    if (s.mantou < s.recruit.currentCost) return null;
    s.mantou -= s.recruit.currentCost;
    const res = s.recruit.roll();
    EventBus.emit("recruit_result", res);
    EventBus.emit("mantou_changed", s.mantou);
    return res;
  }
  /** 玩家操作：放置/合成；失败（被占/未解锁）返回 null */
  placeUnit(unit, x, y) {
    return this.playerSide.board.placeUnit(unit, x, y);
  }
  /** 玩家操作：付费解锁下一格（消耗递增）；干草不足或已全解锁返回 false */
  tryUnlockCell() {
    const s = this.playerSide;
    const cost = s.board.nextCost;
    if (cost <= 0 || s.mantou < cost) return false;
    s.mantou -= cost;
    const ok = s.board.expandGrid();
    if (ok) EventBus.emit("mantou_changed", s.mantou);
    return ok;
  }
  /** 玩家操作：驱牛（1 次/局，清空我方场上牛群） */
  retreat() {
    const s = this.playerSide;
    if (s.retreatUsed) return false;
    s.retreatUsed = true;
    s.enemies = [];
    EventBus.emit("retreat_used");
    return true;
  }
  /** 玩家操作：广告救牛犊（回血，1 次/局） */
  useShield() {
    const s = this.playerSide;
    if (s.shieldUsed || s.adouHp <= 0) return false;
    s.shieldUsed = true;
    s.adouHp = Math.min(BATTLE_CFG.ADOU_MAX_HP, s.adouHp + BATTLE_CFG.SHIELD_HP);
    EventBus.emit("adou_hp_changed", s.adouHp);
    return true;
  }
  /** 主循环：驱动双方模拟 */
  update(dt) {
    if (this.winner) return;
    this.time += dt;
    this.updateSide(this.playerSide, dt);
    this.updateSide(this.enemySide, dt);
    this.ai.think(dt);
    this.checkEnd();
  }
  updateSide(side, dt) {
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
        side.wavePlan = genWavePlan(side.wave);
        side.spawnQueue = side.wavePlan.length;
        side.nextWavePlan = side.wave < BATTLE_CFG.MAX_WAVE ? genWavePlan(side.wave + 1) : [];
        side.spawnGapTimer = 0;
        side.waveTimer = BATTLE_CFG.WAVE_INTERVAL;
      }
    }
    const survivors = [];
    for (const e of side.enemies) {
      e.y += e.speed * dt;
      if (e.y >= BATTLE_CFG.LEAK_Y) {
        side.adouHp -= BATTLE_CFG.LEAK_DAMAGE;
        if (side.isPlayer) EventBus.emit("adou_hp_changed", side.adouHp);
        continue;
      }
      survivors.push(e);
    }
    side.enemies = survivors;
    for (const unit of side.board.allUnits()) {
      this.updateUnitAttack(side, unit, dt);
    }
  }
  updateUnitAttack(side, unit, dt) {
    unit.atkCooldown = (unit.atkCooldown ?? 0) - dt;
    if (unit.atkCooldown > 0) return;
    const stat = getUnitStat(unit.type, unit.level);
    const target = this.findTarget(side, unit, stat.range);
    if (!target) return;
    unit.atkCooldown = stat.baseAtkSpeed;
    let damage = stat.baseAttack;
    if (unit.type === "spear" /* SPEAR */) {
      for (const other of side.enemies) {
        if (other === target) continue;
        if (other.lane === target.lane && other.y > target.y) {
          other.hp -= Math.max(1, Math.round(damage * 0.5));
          if (other.hp <= 0) this.killEnemy(side, other, unit);
        }
      }
    }
    target.hp -= damage;
    EventBus.emit("unit_attack", { unit, enemy: target, damage });
    if (target.hp <= 0) this.killEnemy(side, target, unit);
  }
  /** 找射程内最近目标；弓全屏取曼哈顿最近，近战只打同列 */
  findTarget(side, unit, range) {
    let best = null;
    let bestDist = Infinity;
    const rowCenter = unit.gridY + 0.5;
    for (const e of side.enemies) {
      let dist;
      if (unit.type === "bow" /* BOW */) {
        dist = Math.abs(e.lane - unit.gridX) + Math.abs(e.y - rowCenter);
        if (dist > range) continue;
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
  killEnemy(side, e, killer) {
    const idx = side.enemies.indexOf(e);
    if (idx < 0) return;
    side.enemies.splice(idx, 1);
    side.mantou += killReward(killer?.level ?? 0);
    if (side.isPlayer) {
      EventBus.emit("enemy_killed", e);
      EventBus.emit("mantou_changed", side.mantou);
    }
  }
  checkEnd() {
    const p = this.playerSide;
    const e = this.enemySide;
    if (p.adouHp <= 0 && e.adouHp <= 0) {
      this.winner = "draw";
    } else if (p.adouHp <= 0) {
      this.winner = "enemy";
    } else if (e.adouHp <= 0) {
      this.winner = "player";
    } else if (p.wave >= BATTLE_CFG.MAX_WAVE && e.wave >= BATTLE_CFG.MAX_WAVE && p.spawnQueue <= 0 && e.spawnQueue <= 0 && p.enemies.length === 0 && e.enemies.length === 0) {
      this.winner = p.adouHp === e.adouHp ? "draw" : p.adouHp > e.adouHp ? "player" : "enemy";
    }
    if (this.winner) {
      EventBus.emit("battle_settled", this.winner);
    }
  }
};
