import { build } from 'esbuild';
await build({
  entryPoints: ['src/game/battle/AIPlayer.ts'],
  bundle: true,
  format: 'cjs',
  outfile: 'scripts/ai_bundle.cjs',
  logLevel: 'silent',
});
console.log('ai bundle built');
