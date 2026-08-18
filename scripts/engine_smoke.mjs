// 冒烟测试：模拟 300s 对局 x20，验证引擎不崩、能结算
import { build } from 'esbuild';

await build({
  entryPoints: ['src/game/battle/BattleEngine.ts'],
  bundle: true,
  format: 'cjs',
  outfile: 'scripts/engine_bundle.cjs',
  logLevel: 'silent',
});
const mod = await import('./engine_bundle.cjs');
const BattleEngine = mod.BattleEngine ?? mod.default?.BattleEngine;
const aiMod = await import('./ai_bundle.cjs');
const AIPlayer = aiMod.AIPlayer ?? aiMod.default?.AIPlayer;

let games = 0, wins = 0, loses = 0, draws = 0, errors = 0;
for (let g = 0; g < 20; g++) {
  const eng = new BattleEngine();
  // 玩家侧也挂 AI 做平衡对照（真实对局由真人操作）
  const playerAI = new AIPlayer(eng.playerSide);
  let t = 0;
  const dt = 1 / 30;
  try {
    while (!eng.winner && t < 300) {
      eng.update(dt);
      playerAI.think(dt);
      t += dt;
      if (eng.playerSide.adouHp < -50 || eng.enemySide.adouHp < -50) throw new Error('hp out of range');
      if (eng.playerSide.mantou < 0) throw new Error('negative mantou');
    }
  } catch (e) {
    errors++;
    console.error('game', g, 'error:', e);
    continue;
  }
  games++;
  if (eng.winner === 'player') wins++;
  else if (eng.winner === 'enemy') loses++;
  else if (eng.winner === 'draw') draws++;
  else errors++;
  if (g < 3 || g >= 17) {
    console.log(`game ${g}: winner=${eng.winner} t=${t.toFixed(0)}s playerHp=${eng.playerSide.adouHp} enemyHp=${eng.enemySide.adouHp} playerWave=${eng.playerSide.wave} mantou=${eng.playerSide.mantou} units=${eng.playerSide.board.allUnits().length}`);
  }
}
console.log(`\n=== RESULT ===  finished=${games} win=${wins} lose=${loses} draw=${draws} error=${errors}`);
