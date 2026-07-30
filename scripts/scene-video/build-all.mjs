/**
 * Render every film × every locale in one pass.
 *
 * v3 builds one file per market: English is the copy, the locale line beneath it
 * is that market's reading (owner brief §V3-A). English renders with no gloss —
 * the headline already IS English.
 *
 * Usage:
 *   node scripts/scene-video/build-all.mjs [--locales en,ko,ja] [--theme ink] [--wide]
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const argOf = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const SPECS = [
  'scripts/scene-video/specs/app-guide-join.mjs',
  'scripts/scene-video/specs/app-guide-private.mjs',
];
const LOCALES = argOf('locales', 'en,ko,ja,zh,zh-TW,es,fr,de,ru,it').split(',').map((s) => s.trim());
const THEME = argOf('theme', 'ink');
const WIDE = args.includes('--wide');

const built = [];
const failed = [];

for (const spec of SPECS) {
  for (const locale of LOCALES) {
    const argv = ['scripts/scene-video/build.mjs', spec, '--locale', locale, '--theme', THEME];
    if (WIDE) argv.push('--wide');
    const r = spawnSync(process.execPath, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = r.stdout?.toString() ?? '';
    const line = out.split('\n').find((l) => l.includes('✅'));
    if (r.status === 0 && line) {
      built.push(line.trim());
      console.log(`  ${line.trim()}`);
    } else {
      // Print the gate that stopped it — a locale whose sentence is too long is
      // a copy problem, and the message names the scene.
      const why = (out + (r.stderr?.toString() ?? '')).split('\n').find((l) => l.includes('🔴')) ?? 'unknown';
      failed.push(`${path.basename(spec)} ${locale}: ${why.trim()}`);
      console.log(`  🔴 ${path.basename(spec)} ${locale} — ${why.trim()}`);
    }
  }
}

console.log(`\n  ${built.length} built · ${failed.length} failed`);
if (failed.length) {
  fs.writeFileSync('scripts/scene-video/.out/failures.txt', failed.join('\n'));
  process.exit(1);
}
