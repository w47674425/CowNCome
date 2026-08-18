/**
 * 结算面板：胜负文案 / 金币奖励 / 再来一局 / 回主菜单
 */
export class ResultOverlay {
  constructor(
    private winner: 'player' | 'enemy' | 'draw',
    private coinGain: number,
    private wins: number,
    private onRestart: () => void,
    private onMenu: () => void,
  ) {}

  mount(): HTMLElement {
    const root = document.createElement('div');
    const isWin = this.winner === 'player';
    const title = isWin ? '🎉 胜 利' : this.winner === 'draw' ? '🤝 平 局' : '💀 败 北';
    const color = isWin ? '#7fd052' : this.winner === 'draw' ? '#ffd166' : '#e05252';

    root.style.cssText = `
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.55); backdrop-filter: blur(2px);
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      width:380px; padding:30px 34px; border-radius:16px; text-align:center;
      background:rgba(24,16,8,0.95); border:1px solid rgba(230,180,90,0.3);
      color:#f5e9d0; box-shadow:0 12px 50px rgba(0,0,0,0.6);
    `;
    panel.innerHTML = `
      <div style="font-size:42px; font-weight:bold; color:${color}; letter-spacing:4px;">${title}</div>
      <div style="margin:16px 0; font-size:16px; color:#ffd166;">
        +${this.coinGain} 🪙 金币（胜场 ${this.wins}）
      </div>
      <div style="font-size:13px; color:#9a8a66; margin-bottom:20px;">
        MVP 阶段 PvE 练习赛 · 段位与装备系统 Phase2 上线
      </div>
      <button id="btn-again" style="width:100%; padding:12px 0; font-size:17px; font-weight:bold;
          border:none; border-radius:10px; cursor:pointer; color:#2a1503;
          background:linear-gradient(180deg,#ffd166,#e8a33d);">再 来 一 局</button>
      <button id="btn-menu" style="width:100%; margin-top:10px; padding:10px 0; font-size:15px;
          border:1px solid rgba(230,180,90,0.4); border-radius:10px; cursor:pointer; color:#e8d5ac;
          background:transparent;">返回主菜单</button>
    `;
    root.appendChild(panel);

    root.querySelector('#btn-again')!.addEventListener('click', this.onRestart);
    root.querySelector('#btn-menu')!.addEventListener('click', this.onMenu);
    return root;
  }
}
