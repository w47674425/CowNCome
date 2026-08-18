import { StorageManager } from '../manager/StorageManager';

/**
 * 主菜单：标题 / 玩法说明 / 战绩 / 开始
 */
export class MainMenu {
  constructor(private onStart: () => void) {}

  mount(): HTMLElement {
    const save = StorageManager.loadSave();
    const collected = Object.keys(save.collection);

    const root = document.createElement('div');
    root.style.cssText = `
      width: 520px; padding: 28px 32px; border-radius: 16px;
      background: rgba(24,16,8,0.88); border: 1px solid rgba(230,180,90,0.3);
      color: #f5e9d0; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      pointer-events: auto;
    `;

    root.innerHTML = `
      <div style="font-size:44px; font-weight:bold; letter-spacing:6px; color:#ffd166;
                  text-shadow:0 0 20px rgba(255,209,102,0.4);">牛与来</div>
      <div style="font-size:14px; color:#c9b58a; margin-top:6px;">
        牧场文字合成 · 双人竞速塔防（Web MVP）
      </div>

      <div style="margin:20px 0; padding:14px 18px; border-radius:10px;
                  background:rgba(255,255,255,0.05); text-align:left; font-size:14px; line-height:1.9; color:#d8c9a8;">
        <div style="color:#ffd166; font-weight:bold; margin-bottom:6px;">🐄 玩法速览</div>
        <div>🌾 击退牛群掉落<strong>干草</strong>，召唤动物伙伴（犬/狼/鹰/马）</div>
        <div>🔢 同类同级伙伴放到同格 = <strong>合成升级</strong>（最高 5 级）</div>
        <div>🔒 点锁定格<strong>消耗干草解锁</strong>棋盘，花费递增</div>
        <div>🛡️ 牛群漏到牛犊扣血，<strong>先死的一方输</strong></div>
        <div>🚩 每局 <strong>1 次驱牛</strong>，清空场上牛群救命</div>
        <div>📺 危急时<strong>看广告救牛犊</strong> +30 血（每局 1 次）</div>
      </div>

      <div style="display:flex; justify-content:space-around; margin:14px 0; font-size:15px; color:#c9b58a;">
        <div>🏆 胜场 <strong style="color:#ffd166;font-size:18px;">${save.wins}</strong></div>
        <div>⚔️ 对局 <strong style="color:#ffd166;font-size:18px;">${save.totalBattles}</strong></div>
        <div>🪙 金币 <strong style="color:#ffd166;font-size:18px;">${save.coins}</strong></div>
      </div>

      <div style="margin:10px 0 18px; font-size:13px; color:#9a8a66; min-height:22px;">
        ${collected.length ? `📖 图鉴已收集：${collected.join(' ')}` : '📖 图鉴：召唤集齐动物字牌'}
      </div>

      <button id="btn-start" style="
        width:100%; padding:14px 0; font-size:20px; font-weight:bold; letter-spacing:4px;
        border:none; border-radius:10px; cursor:pointer;
        background:linear-gradient(180deg,#e8a33d,#c97f1e); color:#2a1503;
        box-shadow:0 4px 14px rgba(200,127,30,0.4);
      ">开 始 战 斗</button>
      <div style="font-size:11px; color:#7a6a4a; margin-top:12px;">
        Web MVP · 广告为模拟实现 · PvP 对战与云存档 Phase2
      </div>
    `;

    root.querySelector('#btn-start')!.addEventListener('click', this.onStart);
    return root;
  }

  destroy(): void {
    /* DOM 由 ScreenManager 清空 */
  }
}
