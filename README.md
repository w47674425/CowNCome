# 赵云与阿斗 · 文字合成 PvP 塔防（Web 版）

> 三国题材文字合成塔防小游戏。将《赵云与阿斗》的基础循环快速落地为可玩 Web 版本，
> 纯 TypeScript + Canvas 2D 实现，**零引擎依赖**，后续可低成本迁移微信小游戏。

## 🕹️ 在线试玩

👉 **[https://w47674425.github.io/CowNCome/](https://w47674425.github.io/CowNCome/)**

（GitHub Pages 自动构建部署，每次推送 `main` 分支自动更新）

## 🎮 玩法说明

竖版 4×3 棋盘，以汉字为棋子，通过**征兵 → 合成 → 部署**构建防线，抵挡一波波敌军，保卫阿斗。

**核心循环**

```
征兵（消耗馒头，成本递增）→ 士兵进入备选槽 → 部署到棋盘 / 同类同级合成升级
→ 敌人沿 4 条道推进 → 我方单位自动攻击 → 阿斗血量归零则失败
```

**特色机制**

- **文字合成**：部署时拖放至同类型同等级单位可合成升级（如 刀兵×2 → 刀兵Lv2），收益倍增
- **备选槽（4 格）**：开局随机赠送 2~3 名 Lv.1 士兵；槽满时无法征兵，需先部署腾位
- **波次预告**：顶部面板实时预告下一波敌军的类型、数量与出兵方向，可提前布局
- **敌人类型化**：刀 / 枪 / 弓 / 骑 四类敌人，血量与移速倍率各异
- **确定性波次**：25 波固定波次计划，预告与实机 100% 一致，可研究套路

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 构建 | Vite 5 + TypeScript 5 |
| 渲染 | Canvas 2D（汉字即视觉，零图片资源） |
| 逻辑 | 纯 TS 模块，与渲染层完全解耦 |
| 测试 | 引擎冒烟测试（20 局 AI 对战，esbuild 打包运行） |

## 🚀 本地运行

```bash
npm install     # 安装依赖
npm run dev     # 启动开发服务器 http://localhost:5173
npm run build   # 构建生产产物到 dist/
npm run preview # 本地预览构建产物
```

冒烟测试（AI vs AI，20 局）：

```bash
node scripts/engine_smoke.mjs
```

## 📁 目录结构

```
src/
├── core/        # 入口与事件总线（GameApp / EventBus / Const）
├── data/        # 纯逻辑层：单位配置、征兵成本、合成/战斗规则
├── manager/     # 平台适配层（可替换，迁移小游戏只改这里）
│   ├── PlatformManager.ts   # 存储适配（Web: localStorage）
│   ├── NetworkManager.ts    # 网络适配（当前 mock）
│   └── AdManager.ts         # 广告适配（当前模拟）
├── game/
│   ├── battle/  # 战斗引擎、棋盘、征兵、AI 玩家
│   └── render/  # Canvas 渲染器（竖版 720×1280）
└── ui/          # 屏幕管理（主菜单 / 战斗 / 结算）
archive/         # Cocos Creator 版脚本（已归档，不再维护）
docs/            # 架构设计文档
scripts/         # 冒烟测试与构建脚本
```

## 🎯 设计要点

- **逻辑与渲染分离**：`src/data` 与 `src/game/battle` 为纯 TS 逻辑，无任何 DOM/Canvas 依赖，
  可用 Node 直接跑冒烟测试；渲染层仅消费逻辑状态
- **三件套可替换**：`PlatformManager / NetworkManager / AdManager` 是唯一平台耦合点，
  上微信小游戏时替换为 `wx.*` 实现即可，游戏本体零改动
- **汉字即视觉**：单位与敌人直接用汉字渲染，无需美术资源，首包极小（gzip ≈ 13KB）

## 📋 当前进度

- [x] Web 版 MVP：征兵 / 合成 / 部署 / 战斗 / 波次完整闭环
- [x] 备选槽 + 顶部波次预告
- [x] AI 对战冒烟测试（平衡接近五五开）
- [ ] 真 PvP 匹配对战
- [ ] 装备掉落系统
- [ ] 云存档
- [ ] 微信小游戏迁移

## 📄 参考文档

- [overview.md](overview.md) — 游戏产品分析（基础循环与核心玩法拆解）
- [docs/architecture-web.md](docs/architecture-web.md) — Web 版架构设计
- [docs/architecture.md](docs/architecture.md) — 小游戏架构设计（迁移路线）
