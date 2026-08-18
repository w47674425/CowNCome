/**
 * 本地存储封装：存档 / 设置 / 用户态
 * 统一 key 前缀，避免污染 localStorage
 */

const PREFIX = 'zyadou_';

export class StorageManager {
  static get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  static set(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('[Storage] set failed:', key, e);
    }
  }

  static remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  }

  /** 存档结构（Phase1 本地；Phase2 迁移云端） */
  static loadSave(): PlayerSave {
    return this.get<PlayerSave>('save', {
      coins: 0,
      stamina: 20,
      maxStamina: 20,
      lastStaminaAt: Date.now(),
      wins: 0,
      totalBattles: 0,
      collection: {},
      equipDrops: [],
    });
  }

  static save(data: PlayerSave): void {
    this.set('save', data);
  }
}

export interface PlayerSave {
  coins: number;
  stamina: number;
  maxStamina: number;
  lastStaminaAt: number;
  wins: number;
  totalBattles: number;
  /** 图鉴：已点亮武将 key 列表（值 = 点亮次数） */
  collection: Record<string, number>;
  /** 装备碎片掉落记录 */
  equipDrops: string[];
}
