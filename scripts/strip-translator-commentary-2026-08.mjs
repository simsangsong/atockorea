#!/usr/bin/env node
/**
 * Cuts translator working notes back off the strings guests read.
 *
 * 🔴 What this is. The translation pass appended its own notes to the value it
 * had just translated, separated by ` > ` or ` --- `:
 *
 *   "象征区（22 面旗帜）+ 纪念墙（约 20 分钟） > 注： 第 18–21 行为图片文件路径，保留原文不作翻译。"
 *   "フォローアップとおすすめ情報 > **備考：** 項目 6・9・12（`bg-emerald-50/80`…）はTailwind CSSの…"
 *   "季節時段彈性 --- **譯注：** … 第 24 行為前端 CSS 類別名稱，建議保留英文原文不譯。"
 *
 * Tailwind class names and source line numbers, on the product page, in six
 * products. `__tests__/audit/translatorCommentary.test.ts` was written for this
 * exact bug and missed all twelve: its pattern required the marker to be
 * **bold-wrapped**, and its vocabulary had neither `備考` nor `譯注`.
 *
 * The cut is anchored: a separator IMMEDIATELY followed by a note marker. Prose
 * uses ` > ` for routes ("Jagalchi > BIFF > Gukje") and real guest copy uses
 * note words ("참고: 노포역이 세 번째 픽업 장소로…"), so neither alone is enough —
 * measured, the pair matches exactly the twelve and nothing else.
 *
 *   node scripts/strip-translator-commentary-2026-08.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry-run");
const ROOT = "components/product-tour-static";

/** Note markers, including the two the original gate did not know. */
const NOTE_WORD =
  "(?:Notes?|注意|注釈|譯注|译注|備考|备考|注|비고|참고|Nota|Notas|Hinweis|Remarque|Примечание)";

/** `<content> <separator> <marker>:` — the separator alone is not a signal. */
const COMMENTARY = new RegExp(`\\s*(?:>|---|—)\\s*\\**\\s*${NOTE_WORD}\\s*\\**\\s*[:：][\\s\\S]*$`);

/**
 * Only cut when the note actually talks about implementation. A guest-facing
 * "Note: Nopo Station replaces Haeundae" must survive untouched, and it does —
 * it has no separator and no artifact.
 */
const ARTIFACT =
  /`[a-z-]+-[a-z0-9/.[\]]+`|Tailwind|CSS|UI ?(?:컴포넌트|コンポーネント|component)|第\s*\d+[–\-~]?\d*\s*[行項]|\d+\s*[・,、]\s*\d+\s*(?:番|행|行|項)|保留原文|不作翻译|不译|不譯|そのまま(?:保持|維持|記載)|원문 유지|kept untranslated/i;

const SKIP_ROOT = new Set(["page_sections"]);

function clean(value) {
  if (typeof value !== "string") return value;
  if (!COMMENTARY.test(value) || !ARTIFACT.test(value)) return value;
  const cut = value.replace(COMMENTARY, "").trim();
  // Never leave a field empty: if the "content" half was the note, keep the
  // original rather than blanking a rendered string.
  return cut.length > 0 ? cut : value;
}

let files = 0;
const changes = [];

for (const dir of readdirSync(ROOT, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name.startsWith("_") || dir.name === "catalog") continue;
  const dirPath = path.join(ROOT, dir.name);
  for (const file of readdirSync(dirPath)) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(dirPath, file);
    if (!statSync(full).isFile()) continue;
    const raw = readFileSync(full, "utf8");
    const doc = JSON.parse(raw);

    const walk = (node, where, isRoot) => {
      if (Array.isArray(node)) {
        node.forEach((v, i) => {
          const next = clean(v);
          if (next !== v) {
            node[i] = next;
            changes.push(`${file} ${where}[${i}]`);
          } else walk(v, `${where}[${i}]`, false);
        });
        return;
      }
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          if (isRoot && SKIP_ROOT.has(k)) continue;
          const next = clean(v);
          if (next !== v) {
            node[k] = next;
            changes.push(`${file} ${where ? `${where}.${k}` : k}`);
          } else walk(v, where ? `${where}.${k}` : k, false);
        }
      }
    };
    walk(doc, "", true);

    const out = `${JSON.stringify(doc, null, 2)}\n`;
    if (out !== raw) {
      files += 1;
      if (!DRY) writeFileSync(full, out);
    }
  }
}

console.log(changes.length ? changes.join("\n") : "(no commentary found)");
console.log(`\n${DRY ? "[dry-run] would rewrite" : "rewrote"} ${files} file(s), ${changes.length} field(s)`);
