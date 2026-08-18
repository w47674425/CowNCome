/** 全局常量：事件名 / 存储键 / 场景名 / 广告位 ID */
export const EVENT = {
  // 全局
  LOGIN_DONE: 'login_done',
  USER_UPDATED: 'user_updated',
  // 对局
  BATTLE_STATE_CHANGE: 'battle_state_change',
  RECRUIT_RESULT: 'recruit_result',
  UNIT_SYNTHESIZED: 'unit_synthesized',
  UNIT_ATTACK: 'unit_attack',
  ENEMY_KILLED: 'enemy_killed',
  MANTOU_CHANGED: 'mantou_changed',
  ADOU_HP_CHANGED: 'adou_hp_changed',
  RETREAT_USED: 'retreat_used',
  BATTLE_SETTLED: 'battle_settled',
  // 局外
  COINS_CHANGED: 'coins_changed',
  STAMINA_CHANGED: 'stamina_changed',
  EQUIP_UPDATED: 'equip_updated',
  COLLECTION_UPDATED: 'collection_updated',
  SHOP_REFRESHED: 'shop_refreshed',
} as const;

export const STORAGE_KEY = {
  LOGIN_TOKEN: 'login_token',
  USER_PROFILE: 'user_profile',
  NEWBIE_DONE: 'newbie_done',
  SETTINGS: 'settings',
} as const;

export const SCENE = {
  MAIN_MENU: 'MainMenu',
  MATCH: 'Match',
  BATTLE: 'Battle',
  RESULT: 'Result',
  COLLECTION: 'Collection',
  SHOP: 'Shop',
  EQUIP: 'Equip',
} as const;

export const AD_POSITION = {
  RESCUE_SHIELD: 'rescue_shield',   // 局内救阿斗
  STAMINA_REFILL: 'stamina_refill', // 体力补充
  DROP_DOUBLE: 'drop_double',       // 结算掉落翻倍
} as const;

/** 对局状态机 */
export enum BattleState {
  IDLE = 'idle',
  MATCHING = 'matching',
  COUNTDOWN = 'countdown',
  BATTLE = 'battle',
  SETTLEMENT = 'settlement',
}

/** 兵种类型（对应汉字字牌） */
export enum UnitType {
  SWORD = 'sword',   // 刀
  SPEAR = 'spear',   // 枪
  BOW = 'bow',       // 弓
  CAVALRY = 'cavalry', // 骑
}
