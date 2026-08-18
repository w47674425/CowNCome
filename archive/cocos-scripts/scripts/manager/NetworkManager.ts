import { EventBus } from '../core/EventBus';

/**
 * 网络管理器：云函数统一调用封装
 * 职责：loading 态 / 错误 toast / 登录失效重登 / 超时
 */

export class NetworkManager {
  private static _inited = false;

  static init(): void {
    if (this._inited) return;
    this._inited = true;
    console.log('[Network] init');
  }

  /**
   * 调用云函数
   * @param name 云函数名（login / user / recruit / battle / ...）
   * @param data 参数
   */
  static async call<T = any>(name: string, data: Record<string, any> = {}): Promise<T> {
    const { cloud } = require('../../env/cloud'); // 云开发初始化（env id 配置在 env/cloud.ts）

    try {
      const res = await cloud.callFunction({ name, data });
      const result = res.result;

      if (result && result.code === 0) {
        return result.data as T;
      }

      // 业务错误
      const err: any = new Error(result?.msg || '请求失败');
      err.code = result?.code;
      throw err;
    } catch (e: any) {
      // 登录失效：清登录态回主菜单
      if (e.code === 'AUTH_EXPIRED') {
        EventBus.emit('login_expired');
      }
      console.error(`[Network] ${name} failed:`, e);
      throw e;
    }
  }
}
