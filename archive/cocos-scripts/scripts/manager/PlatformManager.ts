/**
 * 平台适配层：屏蔽微信/抖音双端 API 差异
 * 后续如需上抖音小游戏，只改本文件
 */

declare const wx: any;

export interface UserProfile {
  openid: string;
  nickname?: string;
}

export class PlatformManager {
  private static _profile: UserProfile | null = null;

  static get isWeChat(): boolean {
    return typeof wx !== 'undefined';
  }

  static init(): void {
    console.log(`[Platform] runtime: ${this.isWeChat ? 'wechat' : 'unknown'}`);
  }

  /** 登录：wx.login → code，换 openid 由 login 云函数完成 */
  static async login(): Promise<UserProfile> {
    if (this._profile) return this._profile;

    const loginRes: any = await new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject,
      });
    });

    // 云函数调用由 NetworkManager 完成，这里只返回 code
    const { NetworkManager } = require('./NetworkManager');
    const data = await NetworkManager.call('login', { code: loginRes.code });

    this._profile = { openid: data.openid, nickname: data.nickname };
    return this._profile;
  }

  /** 激励视频广告（AdManager 使用） */
  static createRewardedAd(adUnitId: string): any {
    if (!this.isWeChat) return null;
    return wx.createRewardedVideoAd({ adUnitId });
  }
}
