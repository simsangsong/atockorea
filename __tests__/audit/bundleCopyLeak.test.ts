/**
 * Standing gate — translator/developer working-notes must not reach guest fields.
 *
 * 🔴 Why this file exists at all.
 *
 * This defect class has now escaped twice, and the second escape happened
 * *inside the fix for the first one*.
 *
 * Round 1 found `sticky_booking_bar.note` shipping a developer comment
 * ("checkout_tour_id resolves at runtime…") as guest-facing booking copy on 23
 * products. Round 2, sweeping for the translator notes that came with it,
 * grepped one Spanish phrasing — `*(código CSS — no se traduce)*` — declared the
 * live-field leak count 0, and shipped. A stricter detector run against the
 * merged tree found 38 more corrupted values and 2 more notes, in six phrasings
 * the grep never had: `sin traducción`, `clase CSS`, `código técnico`,
 * `*(CSS 类名，保留原文)*`, `*(UIクラス名・翻訳対象外)*`, `> **注：**`, plus values
 * wrapped in `**bold**` or backticks. One had the colour word itself translated:
 * `bg-ámbar-50/80`.
 *
 * The lesson is the shape of the check, not the list of phrasings. Grepping for
 * annotation text is unbounded — a translator can always invent a seventh way to
 * say "this is code". Asking "does this CSS-class field still look like a class
 * list?" is bounded, and that is what the first assertion below does.
 *
 * Why it mattered: `iconBg` is emitted straight into `className`. A corrupted
 * value is not text noise on screen, it is an icon rendering with no background
 * at all — a visual bug that no copy review would catch.
 *
 * What this gate does NOT claim: that guest copy is free of working notes in
 * general. Prose leaks need prose judgement — `**Note**: Anti-base activists…`
 * on the Gangjeong cruise tour looks exactly like a translator note and is
 * genuine guest advisory copy. Only the narrow, decidable half is enforced here;
 * the rest is a human read.
 *
 * page_sections.* / _publication / matching_metadata are excluded on purpose:
 * lib/i18n/pipeline/segments.ts marks page_sections DEAD and a test asserts the
 * render path never reads it, _publication is our own changelog, and
 * matching_metadata documents the recommender.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'components/product-tour-static');

/** Fields whose value is emitted into `className` — must stay a bare class list. */
const CLASS_FIELD = /(^|\.)(iconBg|iconColor|bgClass|className|textClass|borderClass)$/;
/**
 * Permissive enough for real Tailwind, including arbitrary values like
 * `w-[calc(100%-2rem)]` and `text-[#FFF]` — an earlier draft of this gate
 * rejected those, which would have been a false alarm waiting to happen.
 * What it still excludes is what every observed corruption carried: `*`
 * (markdown emphasis and the `*(…)*` annotation wrapper), a backtick, `>`,
 * and any non-ASCII character — which is how `bg-ámbar-50/80` is caught.
 */
const CLASS_SHAPED = /^[-A-Za-z0-9/:.,()[\]%_#&+! ]+$/;

/** The one annotation form that is unambiguous: a "> **Note on line N:**" suffix. */
const LINE_NOTE = / > \*\*Notes? on line \d+:\*\*/;

/** Dev comment that is never legitimate guest copy, in any language. */
const DEV_COMMENT = /checkout_tour_id/;

const DEAD_TOP = new Set(['page_sections', '_publication']);
const isDead = (p: string) => DEAD_TOP.has(p.split('.')[0]) || p.includes('matching_metadata');

type Hit = { file: string; jsonPath: string; value: string };

function collect() {
  const classBroken: Hit[] = [];
  const lineNotes: Hit[] = [];
  const devComments: Hit[] = [];
  let filesScanned = 0;
  let stringsScanned = 0;

  for (const dir of readdirSync(ROOT)) {
    const abs = path.join(ROOT, dir);
    if (!statSync(abs).isDirectory()) continue;
    for (const file of readdirSync(abs).filter((f) => f.endsWith('.json'))) {
      filesScanned += 1;
      const json = JSON.parse(readFileSync(path.join(abs, file), 'utf8'));
      const walk = (node: unknown, p: string): void => {
        if (typeof node === 'string') {
          stringsScanned += 1;
          if (isDead(p)) return;
          const hit = { file, jsonPath: p, value: node };
          if (CLASS_FIELD.test(p) && node.trim() && !CLASS_SHAPED.test(node)) classBroken.push(hit);
          if (LINE_NOTE.test(node)) lineNotes.push(hit);
          if (DEV_COMMENT.test(node)) devComments.push(hit);
          return;
        }
        if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${p}.${i}`));
        if (node && typeof node === 'object')
          return Object.entries(node).forEach(([k, v]) => walk(v, p ? `${p}.${k}` : k));
      };
      walk(json, '');
    }
  }
  return { classBroken, lineNotes, devComments, filesScanned, stringsScanned };
}

const scan = collect();

const show = (hits: Hit[]) =>
  hits.map((h) => `\n  ${h.file}\n    ${h.jsonPath}\n    ${JSON.stringify(h.value).slice(0, 180)}`).join('');

describe('guest-facing bundle copy', () => {
  // 🔴 Non-vacuous first. A scanner that walks nothing reports zero of everything,
  // and zero is the exact answer this gate exists to distrust.
  it('actually scanned the bundle corpus', () => {
    expect(scan.filesScanned).toBeGreaterThan(150);
    expect(scan.stringsScanned).toBeGreaterThan(50_000);
  });

  it('has no CSS-class field that stopped looking like a class list', () => {
    expect(show(scan.classBroken)).toBe('');
  });

  it('has no "> **Note on line N:**" translator suffix in a live field', () => {
    expect(show(scan.lineNotes)).toBe('');
  });

  it('never shows a guest the checkout_tour_id developer comment', () => {
    expect(show(scan.devComments)).toBe('');
  });
});

describe('the detector itself', () => {
  // Mutation tests: a gate nobody has watched fail is a gate nobody knows works.
  it('rejects every phrasing that got past the greps', () => {
    for (const corrupted of [
      'bg-amber-50/80 *(código CSS — no se traduce)*',
      'bg-amber-50/80 *(clase CSS — sin traducción)*',
      'bg-emerald-50/80 *(código técnico — sin traducción)*',
      'bg-sky-50/80 *(CSS 类名，保留原文)*',
      'bg-emerald-50/80 *(UIクラス名・翻訳対象外)*',
      'bg-amber-50/80 > **注：** 属技术代码，保持原文不译。',
      '**bg-amber-50/80**',
      '`bg-emerald-50/80`',
      'bg-ámbar-50/80',
    ])
      expect(CLASS_SHAPED.test(corrupted)).toBe(false);
  });

  it('accepts the class lists the codebase actually uses', () => {
    for (const good of [
      'bg-amber-50/80',
      'text-amber-600',
      'bg-emerald-50/80',
      'bg-white/70 backdrop-blur',
      'md:bg-slate-50/80',
      'w-[calc(100%-2rem)]',
    ])
      expect(CLASS_SHAPED.test(good)).toBe(true);
  });

  it('leaves genuine guest advisory copy alone', () => {
    // Real copy on the Gangjeong cruise tour. Reads like a translator note; is not one.
    const real =
      "**Note**: Anti-base activists hold daily Catholic mass + 100-bow protests at the main gate.";
    expect(LINE_NOTE.test(real)).toBe(false);
    expect(DEV_COMMENT.test(real)).toBe(false);
  });
});
