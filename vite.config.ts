import { defineConfig } from 'vite';

// Web 版小游戏：零框架依赖，Canvas 2D + TS
// 后续上微信小游戏：把 src/manager 的适配层换成 wx API 实现即可
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
