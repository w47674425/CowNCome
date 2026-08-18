import { EventBus } from '../core/EventBus';

/**
 * 网络管理器（Web 版 Phase1 = 本地 Mock 适配器）
 * 接口与后端方案对齐：call(name, data) → Promise<T>
 * Phase2 接真实后端时，仅需将适配器替换为 HTTP 实现（fetch），业务代码零改动。
 */

type Adapter = (name: string, data: Record<string, any>) => Promise<any>;

/** 本地 Mock 适配器：本地能算的逻辑全部本地算，保证"快速上线"可玩 */
const localAdapter: Adapter = async (name, data) => {
  await new Promise((r) => setTimeout(r, 120)); // 模拟网络延迟
  switch (name) {
    case 'login':
      return { openid: 'web_local', nickname: '网页玩家' };
    case 'user.get':
      return {};
    case 'battle.settle':
      return { code: 0, data: { rewards: { coins: data?.win ? 50 : 15 } } };
    default:
      return { code: 0, data: {} };
  }
};

export class NetworkManager {
  private static _adapter: Adapter = localAdapter;

  static init(adapter?: Adapter): void {
    if (adapter) this._adapter = adapter;
    console.log('[Network] init (local mock adapter)');
  }

  static async call<T = any>(name: string, data: Record<string, any> = {}): Promise<T> {
    try {
      const res = await this._adapter(name, data);
      if (res && res.code === 0) return res.data as T;
      const err: any = new Error(res?.msg || '请求失败');
      err.code = res?.code;
      throw err;
    } catch (e: any) {
      if (e.code === 'AUTH_EXPIRED') EventBus.emit('login_expired' as any);
      console.error(`[Network] ${name} failed:`, e);
      throw e;
    }
  }
}
