import { EventBus } from './EventBus';
import { PlatformManager } from '../manager/PlatformManager';
import { NetworkManager } from '../manager/NetworkManager';
import { UIManager } from '../manager/UIManager';

/**
 * 全局入口：初始化顺序固定，失败可重试
 * 启动流程: PlatformManager.login → NetworkManager 初始化 → UIManager 进主菜单
 */
export class GameApp {
  private static _inited = false;

  static init(): void {
    if (this._inited) return;
    this._inited = true;

    console.log('[GameApp] init start');
    EventBus.clear();

    // 平台适配必须在最前（决定后续走微信还是抖音 API）
    PlatformManager.init();
    NetworkManager.init();
    UIManager.init();

    this.bootstrap();
  }

  private static async bootstrap(): Promise<void> {
    try {
      const user = await PlatformManager.login();
      console.log('[GameApp] login ok:', user.openid);
      EventBus.emit('login_done', user);
      UIManager.enterMainMenu();
    } catch (e) {
      console.error('[GameApp] bootstrap failed:', e);
      // 登录失败：弹重试（弱网/授权拒绝场景）
      UIManager.showLoginRetry(() => this.bootstrap());
    }
  }
}
