/**
 * 屏幕管理器：DOM 单页切换（主菜单 / 战斗 / 结算）
 * 所有屏幕叠加在 Canvas 之上，绝对定位
 */

export class ScreenManager {
  private layer: HTMLElement;
  private current: { destroy: () => void } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
  ) {
    // 覆盖层
    this.layer = document.createElement('div');
    this.layer.style.cssText = `
      position: absolute; inset: 0;
      pointer-events: none;
      display: flex; align-items: center; justify-content: center;
      font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    `;
    canvas.parentElement?.appendChild(this.layer);
  }

  /**
   * 切换屏幕：销毁旧的，挂载新的
   * 注意：不强制覆盖 pointer-events —— 各屏幕自行声明。
   *  - MainMenu: auto（按钮可点）
   *  - BattleScreen: 根层 none + 内部按钮 auto（点击穿透到 canvas，棋盘才能响应）
   *  - ResultOverlay: 经 overlay() 挂载，强制 auto（全屏遮罩需拦截点击）
   */
  show(screen: { destroy: () => void; mount: () => HTMLElement }): void {
    this.current?.destroy();
    this.layer.innerHTML = '';
    const el = screen.mount();
    this.layer.appendChild(el);
    this.current = screen;
  }

  /** 追加一个临时弹层（结算覆盖等），返回关闭函数 */
  overlay(el: HTMLElement): () => void {
    el.style.pointerEvents = 'auto';
    this.layer.appendChild(el);
    return () => el.remove();
  }

  get element(): HTMLElement {
    return this.layer;
  }
}
