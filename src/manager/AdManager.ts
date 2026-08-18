/**
 * 广告管理器（Web 版 = 模拟实现）
 * 原则：广告只做展示，奖励发放必须走服务端验证（ad-verify）。
 * Web Phase1 直接模拟"看完广告"返回 true，用于打通完整商业化流程；
 * 上微信小游戏后替换为 wx.createRewardedVideoAd 真实实现。
 */

import { AD_POSITION } from '../core/Const';

export class AdManager {
  private static _enabled = true;

  /** 模拟广告是否开启（调试可关） */
  static setEnabled(v: boolean): void {
    this._enabled = v;
  }

  /**
   * 展示激励视频（模拟）
   * @param position 广告位（rescue_shield / stamina_refill / drop_double）
   * @returns true = 完整看完可发奖
   */
  static showRewarded(position: string): Promise<boolean> {
    console.log(`[Ad] mock rewarded ad shown: ${position}`);
    return new Promise((resolve) => {
      if (!this._enabled) {
        resolve(false);
        return;
      }
      // 模拟 1.5s 观看
      setTimeout(() => resolve(true), 1500);
    });
  }

  /** 广告位配置（Phase2 由流量主后台生成后填入） */
  static UNIT_IDS: Record<string, string> = {
    [AD_POSITION.RESCUE_SHIELD]: 'mock_ad_unit_rescue',
    [AD_POSITION.STAMINA_REFILL]: 'mock_ad_unit_stamina',
    [AD_POSITION.DROP_DOUBLE]: 'mock_ad_unit_double',
  };
}
