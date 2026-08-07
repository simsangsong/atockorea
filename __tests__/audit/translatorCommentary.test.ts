/**
 * 🔴 The translation pass shipped its own working notes as guest-facing copy.
 *
 * Two shapes, both live until 2026-08-07:
 *
 *   "Comfortable shoes + layers + passport > **注：** line 4 `bg-amber-50/80`
 *    is a Tailwind class, kept untranslated"          ← commentary appended
 *   "**Photo Value** → Valor fotográfico"             ← notation kept instead
 *                                                        of the result
 *
 * PR #628 cleaned this in 2026-07 and was never merged, so both had been on the
 * site for weeks. This gate is what that PR did not leave behind.
 *
 * SCOPE — deliberately the rendered fields only.
 *
 * `page_sections` is the legacy structure the product page does not render
 * (`reference-tour-product-render-source`) and is edit-forbidden. It holds ~335
 * of the ~360 total hits, all invisible. Including it here would make this gate
 * a permanent red that nobody can honestly clear, so it is skipped and counted
 * instead — if that count starts CLIMBING, the pipeline is writing notes again
 * and the flat fields are next.
 *
 * The arrow rule is narrow because real copy uses the same arrow:
 *   "**Busan Tower 1973** → rebranded **Busan Diamond Tower 2021**"
 *   "March Tulip → April Cherry Blossom → May Wild Flower"
 * Only a WHOLE value of `**ascii** → text-without-asterisks` counts. Measured
 * against the live DB, that rule matches zero strings there — every arrow in
 * the database is prose. A rule that flagged those would be worse than the bug.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'components', 'product-tour-static');

const NOTE =
  /\*\*\s*(?:Notes?|Note|注意|注|注釈|Notas|Nota|Примечание|Hinweis|Remarque)\s*[:：]\s*\*\*/;

/**
 * 🔴 The bold-wrapped form above is not the only one. Twelve leaks were still
 * live on 2026-08-07, across six products, and this gate passed on every one:
 *
 *   "象征区（22 面旗帜）+ 纪念墙（约 20 分钟） > 注： 第 18–21 行为图片文件路径，保留原文不作翻译。"
 *   "フォローアップとおすすめ情報 > **備考：** 項目 6・9・12（`bg-emerald-50/80`…）はTailwind CSSの…"
 *   "季節時段彈性 --- **譯注：** … 第 24 行為前端 CSS 類別名稱，建議保留英文原文不譯。"
 *
 * Two gaps: the marker is not always bold (`> 注：`), and the vocabulary was
 * missing `備考` and `譯注` entirely.
 *
 * Widening the word list alone costs eight false positives — real guest copy
 * uses note words ("참고: 노포역이 세 번째 픽업 장소로 대체됩니다"). What separates a
 * translator's note from a traveller's note is that it talks about the
 * IMPLEMENTATION: a backticked Tailwind class, a source line number, an
 * instruction to keep something untranslated. Requiring both the marker and an
 * artifact matched exactly the twelve and nothing else, measured over every
 * bundle in the repo.
 */
const NOTE_WORD =
  '(?:Notes?|注意|注釈|譯注|译注|備考|备考|注|비고|참고|Nota|Notas|Hinweis|Remarque|Примечание)';
const COMMENTARY = new RegExp(`\\s(?:>|---|—)\\s*\\**\\s*${NOTE_WORD}\\s*\\**\\s*[:：]`);
const ARTIFACT =
  /`[a-z-]+-[a-z0-9/.[\]]+`|Tailwind|CSS|UI ?(?:컴포넌트|コンポーネント|component)|第\s*\d+[–\-~]?\d*\s*[行項]|\d+\s*[・,、]\s*\d+\s*(?:番|행|行|項)|保留原文|不作翻译|不译|不譯|そのまま(?:保持|維持|記載)|원문 유지|kept untranslated/i;

/** A note about the code, appended to a string a guest reads. */
const isImplementationNote = (s: string) => COMMENTARY.test(s) && ARTIFACT.test(s);
const ARROW = /^\s*\*\*[A-Za-z0-9 '&/().,-]{1,40}\*\*\s*(?:→|->|=>)\s*[^*\n]{1,60}\s*$/;

type Hit = { file: string; where: string; text: string };

function scan(): { rendered: Hit[]; legacy: number } {
  const rendered: Hit[] = [];
  let legacy = 0;

  const walk = (node: unknown, where: string, file: string) => {
    if (typeof node === 'string') {
      if (NOTE.test(node) || ARROW.test(node) || isImplementationNote(node)) {
        rendered.push({ file, where, text: node.slice(0, 120) });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${where}[${i}]`, file));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === 'page_sections') {
          legacy += JSON.stringify(v).split('**').length - 1 > 0 ? countIn(v) : 0;
          continue;
        }
        walk(v, where ? `${where}.${k}` : k, file);
      }
    }
  };

  const countIn = (node: unknown): number => {
    let n = 0;
    const rec = (x: unknown) => {
      if (typeof x === 'string') {
        if (NOTE.test(x) || ARROW.test(x) || isImplementationNote(x)) n++;
      } else if (Array.isArray(x)) x.forEach(rec);
      else if (x && typeof x === 'object') Object.values(x as Record<string, unknown>).forEach(rec);
    };
    rec(node);
    return n;
  };

  for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(ROOT, dir.name))) {
      if (!f.endsWith('.json')) continue;
      const p = path.join(ROOT, dir.name, f);
      let doc: unknown;
      try {
        doc = JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {
        continue;
      }
      walk(doc, '', f);
    }
  }
  return { rendered, legacy };
}

/**
 * Legacy residue as measured on 2026-08-07, after the rendered fields were
 * cleaned. A ratchet, not a target: it may fall, never rise.
 *
 * 335 → 340 the same day. Not five new notes: the detector grew an
 * implementation-note rule (see `isImplementationNote`), and it sees five more
 * inside the legacy blob than the bold-only pattern did. Re-baselined on
 * purpose, with the widening recorded — a ratchet quietly re-baselined is just
 * a number.
 */
const LEGACY_CEILING = 340;

describe('translator commentary must not reach guests', () => {
  const { rendered, legacy } = scan();

  it('reads the bundles at all (guards a silently-empty scan)', () => {
    // A collector that measures nothing reports a cheerful zero. Prove it ran.
    expect(fs.readdirSync(ROOT).length).toBeGreaterThan(30);
    expect(legacy).toBeGreaterThan(0);
  });

  it('no rendered field carries a translator note or working notation', () => {
    expect(rendered.map((h) => `${h.file} :: ${h.where} :: ${h.text}`)).toEqual([]);
  });

  it('the legacy page_sections residue does not grow', () => {
    // If this rises, the pipeline started writing notes again — and the flat
    // fields, which guests DO see, are where it lands next.
    expect(legacy).toBeLessThanOrEqual(LEGACY_CEILING);
  });

  it('leaves real copy that happens to use an arrow alone', () => {
    // Both of these are authored prose from live bundles.
    expect(ARROW.test('**Busan Tower 1973** → rebranded **Busan Diamond Tower 2021** after redevelopment')).toBe(false);
    expect(ARROW.test('March Tulip → April Cherry Blossom → May Wild Flower')).toBe(false);
    // …and still catches the notation it is for.
    expect(ARROW.test('**Photo Value** → Valor fotográfico')).toBe(true);
    expect(NOTE.test('passport > **注：** line 4 is a CSS class')).toBe(true);
  });

  it('catches the unbolded and 備考/譯注 forms that were live for weeks', () => {
    // Verbatim from the bundles, before the 2026-08-07 clean.
    expect(
      isImplementationNote('象征区（22 面旗帜）+ 纪念墙（约 20 分钟） > 注： 第 18–21 行为图片文件路径，保留原文不作翻译。'),
    ).toBe(true);
    expect(
      isImplementationNote(
        'フォローアップとおすすめ情報 > **備考：** 項目 6・9・12（`bg-emerald-50/80`）はTailwind CSSのクラス名のため、翻訳せずそのまま記載しています。',
      ),
    ).toBe(true);
    expect(
      isImplementationNote('季節時段彈性 --- **譯注：** 第 24 行為前端 CSS 類別名稱，建議保留英文原文不譯。'),
    ).toBe(true);
  });

  it('leaves a traveller-facing note that uses the same words', () => {
    // 🔴 The reason the rule needs an implementation artifact and not just a
    // note word: these are real guest copy from live bundles, and a word-only
    // rule flagged eight of them.
    expect(isImplementationNote('참고: 노포역이 세 번째 픽업 장소로 해운대를 대체합니다 (약 25분).')).toBe(false);
    expect(isImplementationNote('注：老圃站取代海云台成为第三上车地点（约需25分钟）。')).toBe(false);
    expect(isImplementationNote('**注意：機場使用1號門1樓國內入境廳**（與南部行程的3號門不同）')).toBe(false);
    // And a route arrow is not a separator.
    expect(isImplementationNote('Jagalchi Market > BIFF Square > Gukje Market')).toBe(false);
  });
});
