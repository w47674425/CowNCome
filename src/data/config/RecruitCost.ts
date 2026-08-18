/**
 * 召唤成本递增曲线
 * Rationale: 递增成本制造"等一波还是现在抽"的节奏决策，
 * 避免玩家攒够一次就无脑连抽，破坏局内资源张力
 */

/** 单次召唤成本（干草）：index = 已召唤次数 */
export const RECRUIT_COST: number[] = [10, 15, 22, 32, 46, 66, 94, 134, 190, 270];

/**
 * 召唤掉落概率表（服务端权威，客户端仅展示）
 * 权重制：总权重 = 100
 * 伙伴 76 / 动物字牌 20 / 铲子 4
 * Rationale: 字牌 20% 保证"赌神兽"的欲望常在但不高频；
 * 铲子 4% 使扩格成为稀缺资源而非常规成长
 */
export const RECRUIT_WEIGHTS = {
  unit: 76,
  heroChar: 20,
  shovel: 4,
} as const;

/**
 * 动物字牌保底（防体验断裂，对应风险清单"召唤随机性过大"）
 * [PLACEHOLDER: 假设连续 12 次未出字牌，第 13 次必出；playtest 后调]
 */
export const HERO_PITY_COUNT = 12;

/** 获取第 n 次召唤的成本（超出表尾用最后一项，防御式） */
export function getRecruitCost(count: number): number {
  const idx = Math.min(count, RECRUIT_COST.length - 1);
  return RECRUIT_COST[idx];
}
