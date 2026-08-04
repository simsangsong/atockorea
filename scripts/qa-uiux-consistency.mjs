/**
 * qa-uiux-consistency — the C axis (일관성), measured from source (U3).
 *
 * Three things, and one exclusion rule that has to come first.
 *
 * 🔴 EXCLUSIONS ARE THE WHOLE DESIGN. A naive count of hardcoded colours in
 * the smart app returns 190, and 84 of those are the SVG scenery artwork plus
 * ~15 are Google Maps style objects. A gate that counts them is red forever,
 * and the fix people reach for -- an exemption list -- is how the CJK scanner
 * grew four holes. So art and map layers are excluded structurally, by path,
 * before anything is counted.
 *
 * What it measures:
 *   1. token bypass  — hex literals and raw Tailwind palette classes in UI
 *                      chrome, where a `--tr-*` token should be used
 *   2. bare loading   — files that show a loading STRING with no skeleton and
 *                      no spinner anywhere in the file (UX-D6: a string alone
 *                      is not a state)
 *   3. empty state    — whether a shared EmptyState primitive exists at all
 *
 * These are CEILINGS, not pass lines. Demanding zero today would put a wall of
 * red in front of the next person, who would then switch the gate off -- the
 * exact path this track already walked four times on the CJK sweep. The
 * numbers ratchet down as U9 lands; they must never go up.
 *
 * Usage: node scripts/qa-uiux-consistency.mjs [--json]
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
/**
 * `--roots a,b` points the scan somewhere else. This exists so the gate can run
 * the detector over fixtures with a KNOWN answer — a positive control (a file
 * that must be flagged) and a negative control (one that must not). Mutation
 * testing only proves a gate goes red when broken; it never proves the detector
 * stays quiet on healthy input, and without that "strict enough to block
 * everything" is indistinguishable from "correctly catching".
 */
const rootsArg = process.argv.find((a) => a.startsWith('--roots='));
const ROOTS = rootsArg ? rootsArg.slice('--roots='.length).split(',') : ['components/tour-mode', 'components/tour-ops'];

/**
 * Art and map layers legitimately hold raw colour. Excluded by path, so the
 * rule is visible here rather than scattered as inline suppressions.
 */
const EXCLUDE = [
  /[\\/]scenery[\\/]/, // SVG artwork — the skin illustrations
  /Map(Canvas|Tab)\.tsx$/, // Google Maps style objects are the API's vocabulary
  /[\\/]map[\\/]/, // the whole guest map subtree
];

function walk(dir) {
  const out = [];
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(rel));
    else if (e.name.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

const all = ROOTS.flatMap(walk);
const files = all.filter((f) => !EXCLUDE.some((re) => re.test(f)));
if (files.length === 0) throw new Error('qa-uiux-consistency: 0 files after exclusion — the walker is broken');

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const PALETTE =
  /\b(?:text|bg|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
/** A loading string rendered as content, in any of the room locales. */
const LOADING_STRING = /(불러오는\s*중|확인\s*중|로딩\s*중|Loading[.…]|読み込み中|加载中|Cargando|Chargement|Caricamento|Загрузка)/;
/** LoadingHint IS the shared shape idiom (UX-003) — a file that renders it has
 *  a spinner, even though the ring's classes live in the imported component. */
const HAS_SHAPE = /animate-pulse|animate-spin|Skeleton|LoadingHint/;
/**
 * A locale/string TABLE entry (`confirming: '확인 중…',`) is data, not a wait
 * the guest is looking at — the render site is judged on its own line. Without
 * this, every localized copy table re-flags a file whose actual wait already
 * has a shape (ExtraLedgerCard after UX-003). Pinned by the negative fixture.
 */
const PROPERTY_LINE = /^\s*[\w$]+:\s*['"]/;
/** How far from the loading string a shape still counts as belonging to it. */
const PROXIMITY = 10;

const bypass = [];
const bareLoading = [];

for (const f of files) {
  const src = readFileSync(path.join(ROOT, f), 'utf8');
  const hex = (src.match(HEX) ?? []).length;
  const pal = (src.match(PALETTE) ?? []).length;
  if (hex + pal > 0) bypass.push({ file: f, hex, palette: pal });
  /**
   * 🔴 The first cut asked "does this FILE contain a skeleton anywhere", and it
   * missed UX-001 -- the very defect that motivated the check. GuideConsole has
   * an animate-pulse at line 846 (a live dot) and an animate-spin at 875 (a send
   * spinner), neither of which has anything to do with the bare '불러오는 중…'
   * its loading branch renders at line 490. A detector that reports the worst
   * known case as clean is worse than no detector.
   *
   * So proximity, not presence: a loading string counts as bare when no shape
   * appears within PROXIMITY lines of it.
   */
  const lines = src.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!LOADING_STRING.test(lines[i])) continue;
    if (PROPERTY_LINE.test(lines[i])) continue;
    const from = Math.max(0, i - PROXIMITY);
    const to = Math.min(lines.length, i + PROXIMITY + 1);
    if (!HAS_SHAPE.test(lines.slice(from, to).join('\n'))) hits.push(i + 1);
  }
  if (hits.length) bareLoading.push({ file: f, lines: hits });
}

/** A shared empty-state primitive — a component whose job IS the empty state. */
const emptyPrimitives = all.filter((f) => /(EmptyState|Placeholder)\.tsx$/.test(path.basename(f)));

const result = {
  scanned: files.length,
  excluded: all.length - files.length,
  tokenBypass: {
    total: bypass.reduce((n, b) => n + b.hex + b.palette, 0),
    files: bypass.length,
    worst: bypass.sort((a, b) => b.hex + b.palette - (a.hex + a.palette)).slice(0, 8),
  },
  bareLoading: { files: bareLoading.length, list: bareLoading },
  emptyStatePrimitive: { count: emptyPrimitives.length, list: emptyPrimitives },
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`scanned ${result.scanned} tsx (excluded ${result.excluded} art/map)`);
  console.log(`\n[C-1] token bypass: ${result.tokenBypass.total} in ${result.tokenBypass.files} files`);
  for (const b of result.tokenBypass.worst) console.log(`   ${String(b.hex + b.palette).padStart(3)}  ${b.file}`);
  console.log(`\n[C-2] bare loading string (no skeleton, no spinner in file): ${result.bareLoading.files}`);
  for (const b of result.bareLoading.list) console.log(`   ${b.file}:${b.lines.join(',')}`);
  console.log(`\n[C-3] shared EmptyState primitive: ${result.emptyStatePrimitive.count}`);
}
