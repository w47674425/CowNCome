import { EventBus } from './EventBus';
import { PlatformManager } from '../manager/PlatformManager';
import { NetworkManager } from '../manager/NetworkManager';
import { StorageManager } from '../manager/StorageManager';
import { ScreenManager } from '../ui/ScreenManager';
import { MainMenu } from '../ui/MainMenu';
import { BattleScreen } from '../ui/BattleScreen';
import { ResultOverlay } from '../ui/ResultOverlay';
import { BattleEngine } from '../game/battle/BattleEngine';

/**
 * 全局入口（Web 版）
 * 启动流程: PlatformManager.init → NetworkManager.init → login → 主菜单
 * 后续上微信小游戏：仅替换 PlatformManager/NetworkManager/AdManager 三个适配层
 */
export class GameApp {
  private static _canvas: HTMLCanvasElement;
  private static _sm: ScreenManager;
  private static _inited = false;

  static async init(): Promise<void> {
    if (this._inited) return;
    this._inited = true;

    PlatformManager.init();
    NetworkManager.init();

    this._canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!this._canvas) throw new Error('#gameCanvas not found');

    this._sm = new ScreenManager(this._canvas);

    try {
      const user = await PlatformManager.login();
      console.log('[GameApp] login ok:', user.openid);
    } catch (e) {
      console.warn('[GameApp] login failed, continue as guest:', e);
    }

    this.showMainMenu();
  }

  static showMainMenu(): void {
    this._sm.show(new MainMenu(() => this.startBattle()));
  }

  static startBattle(): void {
    // 重建 BattleScreen：内部创建全新 engine + renderer
    const battle = new BattleScreen(this._canvas, (engine, winner) => {
      this.showResult(engine, winner);
    });
    this._sm.show(battle);
  }

  static showResult(engine: BattleEngine, winner: 'player' | 'enemy' | 'draw'): void {
    // 更新存档
    const save = StorageManager.loadSave();
    save.totalBattles++;
    let coinGain = 15;
    if (winner === 'player') {
      save.wins++;
      coinGain = 50;
    } else if (winner === 'draw') {
      coinGain = 30;
    }
    save.coins += coinGain;
    StorageManager.save(save);

    // 结算面板（覆盖在战斗画面之上，关闭后回到菜单或重开）
    const overlay = new ResultOverlay(
      winner,
      coinGain,
      save.wins,
      () => {
        this.startBattle();
      },
      () => {
        this.showMainMenu();
      },
    );
    this._sm.overlay(overlay.mount());
  }
}
