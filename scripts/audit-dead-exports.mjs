#!/usr/bin/env node
/**
 * A4.3 — unused value-export scan (dead-code candidates).
 *
 * Reports exported functions/consts/classes/enums in the target lib surfaces
 * that no OTHER source file references by name, split into:
 *   · TRULY DEAD   — the identifier appears exactly once in the whole repo
 *                    (its declaration): genuinely unreferenced.
 *   · over-exported — used only inside its own file: should probably drop the
 *                    `export`, but not dead.
 *
 * 🔴 Deliberately scans VALUE exports only. Unused exported *types* have zero
 *    runtime cost and are usually intentional public surface — including them
 *    produced 432 hits that were almost all noise (see A4-code-health.md). A
 *    check that cries wolf gets ignored (A4.2).
 *
 * 🔴 A "truly dead" hit is NOT automatically deletable. Some are intentional
 *    latent API (e.g. `excludeSim`, provided by A0.1 for query sites not yet
 *    converted) or test hooks. Removal needs per-symbol product judgement.
 *
 * Usage: node scripts/audit-dead-exports.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['lib/tour-room', 'lib/ops', 'lib/ai', 'lib/audit'];
const SCAN_ROOTS = ['app', 'components', 'lib', 'hooks', 'scripts', '__tests__'];
const FRAMEWORK = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'default']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const files = SCAN_ROOTS.flatMap((r) => {
  try {
    return walk(join(ROOT, r));
  } catch {
    return [];
  }
});
const texts = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const big = [...texts.values()].join('\n');

const valRe = /^export\s+(?:async\s+)?(?:function|const|class|enum)\s+([A-Za-z0-9_]+)/gm;
const wb = (name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);

const trulyDead = [];
const overExported = [];
for (const [f, text] of texts) {
  const rel = relative(ROOT, f).replaceAll('\\', '/');
  if (!TARGET_DIRS.some((d) => rel.startsWith(d + '/'))) continue;
  if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
  const names = new Set([...text.matchAll(valRe)].map((m) => m[1]));
  for (const name of names) {
    if (FRAMEWORK.has(name)) continue;
    const re = wb(name);
    const usedElsewhere = [...texts].some(([g, t]) => g !== f && re.test(t));
    if (usedElsewhere) continue;
    const occ = (big.match(new RegExp(re, 'g')) || []).length;
    if (occ <= 1) trulyDead.push(`${rel}: ${name}`);
    else overExported.push(`${rel}: ${name} (own-file only)`);
  }
}

console.log(`# TRULY DEAD (declaration only): ${trulyDead.length}`);
for (const l of trulyDead.sort()) console.log('  ' + l);
console.log(`\n# over-exported (own-file only): ${overExported.length}`);
