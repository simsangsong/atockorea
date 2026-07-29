/**
 * X1 — apply `.text-cjk-safe` to the CJK labels the rebuilt scanner surfaced.
 *
 * ⚠ This repo has two recorded codemod accidents (§O2/O3): one matched a colour
 * and left 51 orphaned `/40` opacity suffixes; the follow-up tried to tidy the
 * mess with a whitespace regex and flattened a file's indentation, then ate the
 * space in `from 'lucide-react'`. The lesson written down afterwards was
 * "don't tidy whitespace at all", and this script is built around it:
 *
 *   - it only ever INSERTS the token `text-cjk-safe ` at the start of a class
 *     string, or adds a whole `className="text-cjk-safe"` where none exists;
 *   - it never rewrites, reorders or reformats anything else;
 *   - it edits by character offset from LAST to FIRST so earlier offsets stay
 *     valid, rather than re-matching text it has already changed;
 *   - and it PROVES the diff: every touched line must be identical to its
 *     original once the inserted token is removed. Any line that fails that
 *     check aborts the whole file.
 *
 * Scope is deliberately narrow. Only `control` and `chip` shapes with a SHORT
 * label are touched, because `.text-cjk-safe` is `nowrap + ellipsis`: correct
 * for a button label, wrong for a sentence, where it would truncate real
 * content.
 *
 * ⚠ 2026-07-30 — the companion pass this file used to point at is gone, and so
 * is most of the reason to run this one. `.text-cjk-body` was promoted to a root
 * default in `globals.css`, so width-constrained prose is already safe and no
 * longer needs a class. What is left for `.text-cjk-safe` is the case the
 * default provably cannot fix: a label in a box narrower than its own 어절,
 * where the choice is between wrapping and truncating. That is a judgement per
 * element, not a sweep — `scripts/qa-cjk-render.mjs` says which elements are
 * actually squeezed, and source cannot.
 *
 * Usage:  npx tsx scripts/fix-cjk-labels.ts [--apply] [roots…]
 *         (dry run by default — prints what it would do)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import { scanSource, CJK_PATTERN, type CjkBreakHit } from '../lib/audit/cjkBreak';

const APPLY = process.argv.includes('--apply');
const roots = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (roots.length === 0) roots.push('components', 'app');

/** A label, not a sentence. Beyond this, nowrap+ellipsis would hide content. */
const MAX_LABEL_CJK_CHARS = 12;
const TOKEN = 'text-cjk-safe';

/**
 * 🔴 Which chip-shaped elements are really chips.
 *
 * The first run of this script applied the class to 530 elements and the
 * round-trip check passed — the edits were clean. Reading them was another
 * matter: `rounded-* + padding` is also what a card, a banner, a calendar cell
 * and an error paragraph look like, and `nowrap + ellipsis` on one of those
 * truncates real content. One of them was literally
 * `<p className="flex-1 rounded-xl px-3 py-2">불러오지 못했어요 — {error}</p>`,
 * where the class would have hidden the error message.
 *
 * A clean diff is not the same as a correct diff. Chips get the class only when
 * the element is inline-ish — a badge — and everything block-level has to come
 * in through the `control` door instead (button / a / th / role=tab), where the
 * tag itself says it is a label.
 */
const CHIP_TAGS = new Set(['span', 'li', 'em', 'strong', 'b']);

/**
 * 🔴 And which CONTROLS are safe to change mechanically.
 *
 * The scanner reports `label` and `option` as controls, correctly — the rule
 * covers them. A codemod must not touch either:
 *
 *   - `<label>` in this codebase usually WRAPS its input:
 *       <label className="block"><span>항목명</span><input …/></label>
 *     `nowrap` there stops the field from sitting under its own caption.
 *   - `<option>` is rendered by the platform's native select widget, which
 *     ignores these properties. Editing 41 of them would be pure diff noise
 *     pretending to be a fix.
 *
 * Both stay in the scan output for a human. The distinction this draws is the
 * one that matters for any codemod: "the rule applies here" and "a script can
 * apply it here" are different claims.
 */
const CODEMOD_CONTROL_TAGS = new Set(['button', 'a', 'th', 'summary']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const cjkCount = (s: string) => (s.match(new RegExp(CJK_PATTERN.source, 'g')) ?? []).length;

function eligible(hit: CjkBreakHit): boolean {
  if (hit.confidence !== 'certain') return false;
  if (hit.reason === 'width') return false; // wants text-cjk-body, not nowrap
  if (hit.reason === 'chip' && !CHIP_TAGS.has(hit.tag)) return false;
  if (hit.reason === 'control' && !CODEMOD_CONTROL_TAGS.has(hit.tag)) {
    // role="tab"/"columnheader" on a div is still a control we can safely fix.
    if (!/^(div|span)$/.test(hit.tag)) return false;
  }
  const n = cjkCount(hit.text);
  return n > 0 && n <= MAX_LABEL_CJK_CHARS;
}

/**
 * Where to insert, inside one opening tag. Returns an absolute offset and the
 * exact text to insert — never a replacement.
 */
function insertionFor(source: string, hit: CjkBreakHit): { at: number; text: string } | null {
  const tag = source.slice(hit.start, hit.openEnd);

  const plain = /className\s*=\s*"/.exec(tag);
  if (plain) return { at: hit.start + plain.index + plain[0].length, text: `${TOKEN} ` };

  const braced = /className\s*=\s*\{/.exec(tag);
  if (braced) {
    // First string literal inside the expression — for a template that is the
    // static head, for cn(…) it is the first argument. Either way the token
    // lands in a class list that is always present.
    const after = hit.start + braced.index + braced[0].length;
    const rest = source.slice(after, hit.openEnd);
    const lit = /(['"`])/.exec(rest);
    if (!lit) return null; // e.g. className={someVar} — nothing safe to edit
    return { at: after + lit.index + 1, text: `${TOKEN} ` };
  }

  // No className at all (common on <th>). Add one right after the tag name.
  const nameEnd = hit.start + 1 + hit.tag.length;
  return { at: nameEnd, text: ` className="${TOKEN}"` };
}

let filesChanged = 0;
let edits = 0;
const skipped: string[] = [];

for (const file of roots.flatMap((r) => walk(r))) {
  const original = readFileSync(file, 'utf8');
  const rel = path.relative('.', file).replace(/\\/g, '/');
  const hits = scanSource(rel, original).filter(eligible);
  if (hits.length === 0) continue;

  const insertions = hits
    .map((h) => ({ hit: h, ins: insertionFor(original, h) }))
    .filter((x): x is { hit: CjkBreakHit; ins: { at: number; text: string } } => x.ins !== null)
    .sort((a, b) => b.ins.at - a.ins.at);
  if (insertions.length !== hits.length) {
    skipped.push(`${rel}: ${hits.length - insertions.length} hit(s) had no editable className`);
  }
  if (insertions.length === 0) continue;

  let next = original;
  for (const { ins } of insertions) {
    next = next.slice(0, ins.at) + ins.text + next.slice(ins.at);
  }

  // 🔴 The proof: undo the edits at their exact recorded offsets and the result
  // must equal the input, byte for byte. Anything else means this script touched
  // something it did not intend to, and the file is left alone.
  //
  // A global "strip every occurrence of the token" version of this check was
  // wrong in a way worth remembering — it also removed `text-cjk-safe` that was
  // already in the file, so 17 correct edits reported as corruption. The offsets
  // are what make the check about THIS script's writes rather than about the
  // token. (Ascending order needs no delta: by the time we reach an offset,
  // every insertion before it has already been removed.)
  let recon = next;
  let clean = true;
  for (const { ins } of [...insertions].sort((a, b) => a.ins.at - b.ins.at)) {
    if (recon.slice(ins.at, ins.at + ins.text.length) !== ins.text) {
      clean = false;
      break;
    }
    recon = recon.slice(0, ins.at) + recon.slice(ins.at + ins.text.length);
  }
  if (!clean || recon !== original) {
    console.error(`ABORT ${rel}: round-trip check failed — file left untouched`);
    continue;
  }

  filesChanged += 1;
  edits += insertions.length;
  if (APPLY) writeFileSync(file, next);
}

console.log(`${APPLY ? 'applied' : 'would apply'}: ${edits} insertions across ${filesChanged} files`);
if (skipped.length) {
  console.log('\nnot editable automatically (className is a bare variable) — fix by hand:');
  for (const s of skipped) console.log(`  ${s}`);
}
if (!APPLY) console.log('\ndry run — pass --apply to write');
