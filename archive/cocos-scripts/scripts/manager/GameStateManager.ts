import { EventBus } from '../core/EventBus';
import { BattleState } from '../core/Const';

/**
 * 对局状态机：IDLE → MATCHING → COUNTDOWN → BATTLE → SETTLEMENT → IDLE
 * 状态迁移统一由本管理器驱动，页面监听 BATTLE_STATE_CHANGE 刷新 UI
 */

export interface BattleResult {
  win: boolean;
  /** 我方阿斗剩余血量 */
  adouHpLeft: number;
  /** 本局击杀数 */
  kills: number;
  /** 结算掉落（装备/金币） */
  rewards: { coins: number; equipDrops: string[] };
}

export class GameStateManager {
  private static _state: BattleState = BattleState.IDLE;
  private static _result: BattleResult | null = null;

  static get state(): BattleState {
    return this._state;
  }

  static get lastResult(): BattleResult | null {
    return this._result;
  }

  static transition(next: BattleState): void {
    if (this._state === next) return;
    this._state = next;
    EventBus.emit('battle_state_change', next);
  }

  /** PvE 直开（AI 对手） */
  static startPvE(): void {
    this.transition(BattleState.BATTLE);
  }

  /** PvP 匹配（阶段二启用） */
  static startMatch(): void {
    this.transition(BattleState.MATCHING);
    // 进 match_pool 云函数 → 撮合成功回调 onMatched
  }

  static onMatched(): void {
    this.transition(BattleState.COUNTDOWN);
    // 3s 倒计时后进 BATTLE（由 MatchManager 或页面处理）
  }

  static settle(result: BattleResult): void {
    this._result = result;
    this.transition(BattleState.SETTLEMENT);
  }

  static backToIdle(): void {
    this._result = null;
    this.transition(BattleState.IDLE);
  }
}
