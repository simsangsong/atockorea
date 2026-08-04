/**
 * gen-skin-swatch — the skin picker's poster colours, derived from the CSS canon (UX-004).
 *
 * The SWATCH table in SkinPicker.tsx used to be ten skins' worth of hex
 * literals copied by hand from app/tour-room-theme.css. The values matched —
 * which was exactly the problem: nothing would have said anything the day
 * they stopped matching. The preview would just quietly show last month's
 * colour (UIUX-LEDGER-2026-08 UX-004).
 *
 * This script reads the canon and writes components/tour-mode/skinSwatch.gen.ts.
 * Sources, in the spirit of "축 정본을 코드에서 읽는다":
 *   - skin list:            hooks/useTourRoomSettings.ts  (TOUR_SKINS)
 *   - canvas/bubble colours: app/tour-room-theme.css       (light blocks only)
 *   - hill colours:          HILL below — original swatch art (the T-D5 horizon
 *                            hint), not a copy of anything; this file is its canon
 *
 * Parser hygiene, paid for elsewhere (NEXT-SESSION-SMARTAPP §6):
 *   - comments are stripped BEFORE brace matching — a brace inside a comment
 *     once silently emptied a different gate's token set
 *   - a var() alias is resolved against the same sheet; an unresolvable var()
 *     is a hard failure, never a skipped value
 *
 * Usage:
 *   node scripts/gen-skin-swatch.mjs           # (re)write the .gen.ts file
 *   node scripts/gen-skin-swatch.mjs --check   # exit 1 if the committed file is stale
 *   node scripts/gen-skin-swatch.mjs --check --file=<path>
 *       # check an alternate file — exists so the gate can run a positive
 *       # control (a tampered copy MUST fail) on every run, not only when a
 *       # human remembers to mutation-test
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CSS = path.join(ROOT, 'app', 'tour-room-theme.css');
const SKINS_TS = path.join(ROOT, 'hooks', 'useTourRoomSettings.ts');
const OUT = path.join(ROOT, 'components', 'tour-mode', 'skinSwatch.gen.ts');

/** Swatch-only horizon-arc art (T-D5). Authored HERE — this is not a copy of
 *  a CSS token; skins that carry a SkinScenery scene get a hint, contrast
 *  deliberately has none. */
const HILL = {
  classic: '#dbe4d8',
  sky: '#dbe7ef',
  winter: '#c9d9e9',
  forest: '#cfd8ab',
  meadow: '#c0d9cc',
  jeju: '#d3e5d0',
  seoul: '#d3d0e6',
  busan: '#b7d7e6',
  blossom: '#f0cedb',
};

// ---- skin list from the axis canon ------------------------------------------
const skinsSrc = readFileSync(SKINS_TS, 'utf8');
const skinsMatch = skinsSrc.match(/TOUR_SKINS\s*=\s*\[([^\]]+)\]/);
if (!skinsMatch) throw new Error('gen-skin-swatch: TOUR_SKINS not found in useTourRoomSettings.ts');
const SKINS = [...skinsMatch[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
if (SKINS.length < 5) throw new Error(`gen-skin-swatch: only ${SKINS.length} skins parsed — parser broken?`);

// ---- CSS light blocks -------------------------------------------------------
// Strip comments FIRST (see header), then walk top-level blocks by brace depth.
const css = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** selector → { '--tr-x': value } for every top-level block. */
const blocks = [];
{
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const selector = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    blocks.push({ selector, body: css.slice(open + 1, j - 1) });
    i = j;
  }
}

function declsOf(body) {
  const out = {};
  for (const m of body.matchAll(/(--tr-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** The light block for a selector must not sit under .dark in any part. */
const lightBlockFor = (wanted) =>
  blocks.find(({ selector }) => selector.split(',').some((s) => s.trim() === wanted && !s.includes('.dark')));

const baseBlock = lightBlockFor('.tr-root');
if (!baseBlock) throw new Error('gen-skin-swatch: base .tr-root block not found');
const base = declsOf(baseBlock.body);

const WANTED = { canvas: '--tr-canvas', bubbleIn: '--tr-bubble-in', bubbleMe: '--tr-bubble-me' };

function resolveVar(value, scope) {
  const m = value.match(/^var\((--tr-[a-z0-9-]+)\)$/);
  if (!m) return value;
  const target = scope[m[1]] ?? base[m[1]];
  if (!target) throw new Error(`gen-skin-swatch: unresolvable ${value} — an alias the parser cannot follow must fail, not skip`);
  return resolveVar(target, scope);
}

const swatch = {};
for (const skin of SKINS) {
  const block = skin === 'classic' ? { body: baseBlock.body } : lightBlockFor(`.tr-root[data-tr-skin='${skin}']`);
  if (!block) throw new Error(`gen-skin-swatch: no light block for skin '${skin}'`);
  const decls = declsOf(block.body);
  const entry = {};
  for (const [key, token] of Object.entries(WANTED)) {
    const raw = decls[token] ?? base[token];
    if (!raw) throw new Error(`gen-skin-swatch: ${token} missing for '${skin}' (no skin value, no base fallback)`);
    entry[key] = resolveVar(raw, decls);
  }
  if (HILL[skin]) entry.hill = HILL[skin];
  swatch[skin] = entry;
}

// Positive control on the parser itself: classic must come out as the base
// canvas, or the block walker is reading the wrong sheet.
if (swatch.classic.canvas !== base['--tr-canvas']) {
  throw new Error('gen-skin-swatch: self-check failed — classic swatch does not equal the base block');
}

// ---- emit -------------------------------------------------------------------
const entries = SKINS.map((skin) => {
  const e = swatch[skin];
  const hill = e.hill ? `, hill: '${e.hill}'` : '';
  return `  ${skin}: { canvas: '${e.canvas}', bubbleIn: '${e.bubbleIn}', bubbleMe: '${e.bubbleMe}'${hill} },`;
}).join('\n');

const content = `// GENERATED by scripts/gen-skin-swatch.mjs — do not edit by hand.
// Canvas/bubble colours come from app/tour-room-theme.css (light blocks);
// hill is swatch-only horizon art whose canon lives in the generator.
// Regenerate: node scripts/gen-skin-swatch.mjs   Gate: skinSwatchSync.test.ts
import type { TourSkin } from '@/hooks/useTourRoomSettings';

export const SKIN_SWATCH: Record<TourSkin, { canvas: string; bubbleIn: string; bubbleMe: string; hill?: string }> = {
${entries}
};
`;

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith('--file='));
const target = fileArg ? path.resolve(ROOT, fileArg.slice('--file='.length)) : OUT;

if (args.includes('--check')) {
  if (!existsSync(target)) {
    console.error(`skinSwatch: ${path.relative(ROOT, target)} is missing. Run: node scripts/gen-skin-swatch.mjs`);
    process.exit(1);
  }
  const committed = readFileSync(target, 'utf8');
  if (committed !== content) {
    console.error('skinSwatch.gen.ts 가 낡았다. `node scripts/gen-skin-swatch.mjs` 로 재생성할 것.');
    process.exit(1);
  }
  console.log(`skinSwatch: in sync (${SKINS.length} skins)`);
} else {
  writeFileSync(target, content);
  console.log(`wrote ${path.relative(ROOT, target)} (${SKINS.length} skins)`);
}
