/**
 * Remove translator commentary from guest-facing bundle strings.
 *
 * The translation pass wrote its own working notes into whatever string it was
 * finishing — "…Comfortable shoes + layers + passport > **注：** line 4
 * `bg-amber-50/80` is a Tailwind class, kept untranslated" — and elsewhere left
 * its notation in place of the result: "**Photo Value** → Valor fotográfico".
 * PR #628 cleaned this and was never merged, so it has been on the site since.
 *
 * 🔴 Two deliberate restrictions.
 *
 * `page_sections` is skipped. It is the legacy structure the product page does
 * not render (see `reference-tour-product-render-source`), it is edit-forbidden,
 * and it holds roughly 335 of the ~360 hits. Rewriting it would be a large
 * diff of things nobody reads, and a first attempt at exactly that produced
 * invalid JSON on one row.
 *
 * The arrow rule only fires when the WHOLE value is `**English** → translation`
 * with an ASCII left side and no `**` on the right. Real copy uses the same
 * arrow — "**Busan Tower 1973** → rebranded **Busan Diamond Tower 2021**",
 * "March Tulip → April Cherry Blossom" — and must survive untouched. Measured:
 * the narrow rule matches 0 strings in the live DB, where every arrow is prose.
 *
 * Usage: node scripts/strip-translator-notes.mjs [--write]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "components", "product-tour-static");
const WRITE = process.argv.includes("--write");

/** The appended-commentary marker, in every language the pass wrote in. */
const NOTE =
  /\s*(?:>|-|–|—)*\s*\*\*\s*(?:Notes?|Note|注意|注|注釈|Notas|Nota|Примечание|Hinweis|Remarque)\s*[:：]\s*\*\*[\s\S]*$/;

/** Whole-value working notation. Narrow on purpose — see the header. */
const ARROW = /^\s*\*\*([A-Za-z0-9 '&/().,-]{1,40})\*\*\s*(?:→|->|=>)\s*([^*\n]{1,60})\s*$/;

function cleanString(s) {
  const arrow = ARROW.exec(s);
  if (arrow) return arrow[2].trim();
  if (NOTE.test(s)) return s.replace(NOTE, "").trim();
  return s;
}

/** Walk in place. `page_sections` is not descended into. */
function walk(node, key, stats) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (typeof node[i] === "string") {
        const next = cleanString(node[i]);
        if (next !== node[i]) {
          stats.changed++;
          node[i] = next;
        }
      } else {
        walk(node[i], key, stats);
      }
    }
    return node;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) {
      if (k === "page_sections") {
        stats.legacySkipped++;
        continue;
      }
      const v = node[k];
      if (typeof v === "string") {
        const next = cleanString(v);
        if (next !== v) {
          stats.changed++;
          node[k] = next;
        }
      } else {
        walk(v, k, stats);
      }
    }
  }
  return node;
}

let totalChanged = 0;
const touched = [];
for (const dir of readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const f of readdirSync(path.join(ROOT, dir.name)).filter((x) => x.endsWith(".json"))) {
    const p = path.join(ROOT, dir.name, f);
    const raw = readFileSync(p, "utf8");
    let doc;
    try {
      doc = JSON.parse(raw);
    } catch {
      continue;
    }
    const stats = { changed: 0, legacySkipped: 0 };
    walk(doc, "", stats);
    if (!stats.changed) continue;
    totalChanged += stats.changed;
    touched.push(`${f}: ${stats.changed}`);
    if (WRITE) {
      writeFileSync(p, JSON.stringify(doc, null, 2) + (raw.endsWith("\n") ? "\n" : ""), "utf8");
    }
  }
}

console.log(`${WRITE ? "cleaned" : "would clean"} ${totalChanged} strings in ${touched.length} files`);
for (const t of touched) console.log(`   ${t}`);
if (!WRITE) console.log("\n(dry run — pass --write to apply)");
