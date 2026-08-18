import type { Side } from './BattleEngine';

/**
 * 对手 AI（PvE 模拟对手，随机 Dice 式对称竞速）
 * 简单策略：
 *  1. 有可合成对 → 立即合成（升级收益最高）
 *  2. 馒头够征兵且有位置 → 征兵并放置
 *  3. 抽到铲子 → 立即扩格
 *  4. 濒死且还有退兵 → 用退兵保命（给玩家制造真实压力）
 * 该策略刻意"够钱就花"，后期征兵成本暴涨时会自然崩盘——符合 IAA 对局节奏
 */
export class AIPlayer {
  private _thinkTimer = 0;
  private readonly _thinkInterval = 0.55;

  constructor(private side: Side) {}

  think(dt: number): void {
    if (this.side.adouHp <= 0) return;
    this._thinkTimer -= dt;
    if (this._thinkTimer > 0) return;
    this._thinkTimer = this._thinkInterval;

    const s = this.side;

    // 一回合内连续操作（最多 6 步）：合成 → 部署备选槽 → 征兵 → 放置 → 再合成…
    // 与真人"连续点击征兵 + 快速放置"的操作密度对齐，避免 AI 决策太慢
    for (let i = 0; i < 6; i++) {
      let acted = false;

      // 1. 有可合成对 → 合成（升级收益最高）
      const pair = s.board.findSynthesisPair();
      if (pair) {
        s.board.synthesizePair(pair.a, pair.b);
        acted = true;
      }

      // 2. 部署备选槽兵力（开局赠送/暂存的兵优先上阵；没空格先扩格）
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
            const u = s.bench[idx]!;
            s.bench[idx] = null;
            s.board.placeUnit(u, cell.x, cell.y);
            acted = true;
          }
        }
      }

      // 3. 征兵（有地方放才抽；铲子需要未解锁格才有意义；备选槽可暂存）
      if (!acted) {
        const cost = s.recruit.currentCost;
        const hasSpace = !!s.board.firstEmptyCell() || !!s.board.nextExpandCell() || !s.benchFull();
        if (s.mantou >= cost && hasSpace) {
          s.mantou -= cost;
          const res = s.recruit.roll();
          if (res.kind === 'unit') {
            const cell = s.board.firstEmptyCell();
            if (cell) s.board.placeUnit(res.unit, cell.x, cell.y);
            else s.addToBench(res.unit);
          } else if (res.kind === 'shovel') {
            s.board.expandGrid();
          }
          acted = true;
        }
      }

      if (!acted) break;
    }

    // 3. 濒死救场：退兵保命（留到关键时刻，制造"差一点"的悬念）
    if (!s.retreatUsed && s.adouHp < 20 && s.enemies.length >= 3) {
      s.retreatUsed = true;
      s.enemies = [];
    }
  }
}
