import { GameApp } from './core/GameApp';

// 入口：初始化游戏（页面加载后自动执行）
GameApp.init().catch((e) => {
  console.error('[main] init failed:', e);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div style="color:#fff;padding:20px;font-family:sans-serif;">初始化失败：${String(e)}</div>`,
  );
});
