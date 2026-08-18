/**
 * 全局事件总线：模块解耦的唯一通道
 * 约束：跨层通信只走 EventBus，禁止组件间直接引用
 */
type Handler = (...args: any[]) => void;

export class EventBus {
  private static _handlers: Map<string, Set<Handler>> = new Map();

  static on(event: string, handler: Handler): () => void {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event)!.add(handler);
    // 返回取消订阅函数，避免内存泄漏
    return () => this.off(event, handler);
  }

  static off(event: string, handler: Handler): void {
    this._handlers.get(event)?.delete(handler);
  }

  static emit(event: string, ...args: any[]): void {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    // 复制一份，防止回调中修改集合导致遍历错乱
    [...handlers].forEach((h) => {
      try {
        h(...args);
      } catch (e) {
        console.error(`[EventBus] handler error on ${event}:`, e);
      }
    });
  }

  /** 清空全部（场景切换/退出登录时调用） */
  static clear(): void {
    this._handlers.clear();
  }
}
