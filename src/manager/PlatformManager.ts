/**
 * 平台适配层（Web 版）
 * 统一屏蔽浏览器 / 微信小游戏 / 抖音小游戏三端差异。
 * 后续上微信小游戏：仅需将本文件替换为 wx API 实现（archive/cocos-scripts 中有参考），
 * 其余业务代码零改动。
 */

export interface UserProfile {
  openid: string;
  nickname?: string;
}

export class PlatformManager {
  private static _profile: UserProfile | null = null;

  /** 运行时环境检测：'web' | 'wechat' | 'douyin' */
  static get runtime(): 'web' | 'wechat' | 'douyin' {
    const g = globalThis as any;
    if (typeof g.wx !== 'undefined' && g.wx.getSystemInfoSync) return 'wechat';
    if (typeof g.tt !== 'undefined') return 'douyin';
    return 'web';
  }

  static init(): void {
    console.log(`[Platform] runtime: ${this.runtime}`);
  }

  /**
   * 登录：Web 版用 localStorage 匿名访客态（openid 为本地生成的 uuid）
   * 微信版：wx.login → code → login 云函数换 openid
   */
  static async login(): Promise<UserProfile> {
    if (this._profile) return this._profile;

    if (this.runtime !== 'web') {
      // 小游戏平台：wx.login 逻辑（云函数由 NetworkManager 调用）
      const g = globalThis as any;
      const loginRes = await new Promise<any>((resolve, reject) => {
        g.wx.login({ success: resolve, fail: reject });
      });
      const data = await this.callLogin(loginRes.code);
      this._profile = { openid: data.openid, nickname: data.nickname };
      return this._profile;
    }

    // Web 访客态
    let openid = localStorage.getItem('zyadou_openid');
    if (!openid) {
      openid = 'web_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('zyadou_openid', openid);
    }
    this._profile = { openid, nickname: '网页玩家' };
    return this._profile;
  }

  /** 云函数登录（小游戏平台用；Web 版 mock 返回）
   * TODO Phase2: 接真实后端后由 NetworkManager.call('login') 替代 */
  private static async callLogin(code: string): Promise<{ openid: string; nickname?: string }> {
    console.log('[Platform] wx.login code:', code);
    return { openid: 'wx_mock_' + code.slice(-6) };
  }
}
