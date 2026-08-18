import { PlatformManager } from './PlatformManager';
import { AD_POSITION } from '../core/Const';

/**
 * 广告管理器：激励视频 / 插屏 / Banner
 * 原则：广告只做展示；所有奖励发放必须由 ad-verify 云函数验证服务端回调
 */

interface AdSlot {
  adUnitId: string;
  ad: any;
  loading: boolean;
}

export class AdManager {
  private static _slots: Map<string, AdSlot> = new Map();

  /** 广告位 ID 由微信流量主后台生成后填入 env/ad-ids.ts */
  private static _unitIds: Record<string, string> = {};

  static init(unitIds: Record<string, string>): void {
    this._unitIds = unitIds;
    // 预加载激励视频（对局中频繁触发，提前加载降低等待）
    this.preload(AD_POSITION.RESCUE_SHIELD);
  }

  private static preload(position: string): void {
    const id = this._unitIds[position];
    if (!id || this._slots.has(position)) return;

    const ad = PlatformManager.createRewardedAd(id);
    if (!ad) return;

    this._slots.set(position, { ad, loading: true });
    ad.load().then(() => {
      const slot = this._slots.get(position);
      if (slot) slot.loading = false;
    }).catch(() => {
      const slot = this._slots.get(position);
      if (slot) slot.loading = false;
    });
  }

  /**
   * 展示激励视频
   * @returns true = 用户完整看完（可发奖）
   */
  static showRewarded(position: string): Promise<boolean> {
    return new Promise((resolve) => {
      const slot = this._slots.get(position);
      if (!slot || !slot.ad) {
        resolve(false);
        return;
      }

      slot.ad.show().then(() => {
        // 关闭回调：确认看完（部分平台需在 onClose 中判断 isEnded）
        slot.ad.onClose((res: any) => {
          resolve(!!(res && res.isEnded));
          // 触发下一次预加载
          this.preload(position);
        });
      }).catch(() => {
        resolve(false);
      });
    });
  }
}
