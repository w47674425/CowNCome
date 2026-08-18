"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/game/battle/AIPlayer.ts
var AIPlayer_exports = {};
__export(AIPlayer_exports, {
  AIPlayer: () => AIPlayer
});
module.exports = __toCommonJS(AIPlayer_exports);
var AIPlayer = class {
  constructor(side) {
    this.side = side;
  }
  _thinkTimer = 0;
  _thinkInterval = 0.55;
  think(dt) {
    if (this.side.adouHp <= 0) return;
    this._thinkTimer -= dt;
    if (this._thinkTimer > 0) return;
    this._thinkTimer = this._thinkInterval;
    const s = this.side;
    for (let i = 0; i < 6; i++) {
      let acted = false;
      const pair = s.board.findSynthesisPair();
      if (pair) {
        s.board.synthesizePair(pair.a, pair.b);
        acted = true;
      }
      if (!acted) {
        let cell = s.board.firstEmptyCell();
        if (!cell) {
          const next = s.board.nextExpandCell();
          if (next) {
            s.board.expandGrid();
            cell = next;
          }
        }
        if (cell) {
          const idx = s.bench.findIndex((u) => u !== null);
          if (idx >= 0) {
            const u = s.bench[idx];
            s.bench[idx] = null;
            s.board.placeUnit(u, cell.x, cell.y);
            acted = true;
          }
        }
      }
      if (!acted) {
        const cost = s.board.nextCost;
        if (cost > 0 && cost <= 120 && s.mantou >= cost) {
          s.mantou -= cost;
          s.board.expandGrid();
          acted = true;
        }
      }
      if (!acted) {
        const cost = s.recruit.currentCost;
        const hasSpace = !!s.board.firstEmptyCell() || !!s.board.nextExpandCell() || !s.benchFull();
        if (s.mantou >= cost && hasSpace) {
          s.mantou -= cost;
          const res = s.recruit.roll();
          if (res.kind === "unit") {
            const cell = s.board.firstEmptyCell();
            if (cell) s.board.placeUnit(res.unit, cell.x, cell.y);
            else s.addToBench(res.unit);
          } else if (res.kind === "shovel") {
            s.board.expandGrid();
          }
          acted = true;
        }
      }
      if (!acted) break;
    }
    if (!s.retreatUsed && s.adouHp < 20 && s.enemies.length >= 3) {
      s.retreatUsed = true;
      s.enemies = [];
    }
  }
};
