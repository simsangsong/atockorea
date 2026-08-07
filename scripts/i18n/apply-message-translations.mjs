/**
 * i18n — `messages/<locale>.json` 값 채우기.
 *
 *   node scripts/i18n/apply-message-translations.mjs <batch.json>
 *
 * 🔴 사장님 상시 규칙: **API 를 쓰지 않는다.** 번역은 Claude Code 가 직접 하고, 이 스크립트는
 *    그 결과를 파일에 **안전하게 꽂기만** 한다. 여기에 LLM 호출을 넣지 마라.
 *
 * batch.json 모양:
 *   { "<locale>": { "<dot.key>": "<번역>", ... }, ... }
 *
 * 지키는 것:
 *   1. **키를 만들지 않는다.** `messages/en.json` 에 없는 키는 거부한다 — 과거에 번역
 *      스크립트가 EN 키를 관리 서브셋으로 덮어써 키를 날린 적이 있다.
 *   2. **구조를 보존한다.** 중첩 객체 그대로, 키 순서 그대로, 들여쓰기 2칸 + 끝 개행.
 *   3. **덮어쓰지 않는다.** 대상 로케일 값이 영어와 다르면 이미 번역된 것으로 보고 건너뛴다
 *      (`--force` 로만 덮는다). 배치를 두 번 돌려도 안전하다.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [batchPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FORCE = process.argv.includes('--force');
if (!batchPath) {
  console.error('사용법: node scripts/i18n/apply-message-translations.mjs <batch.json> [--force]');
  process.exit(1);
}

const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
const en = JSON.parse(readFileSync('messages/en.json', 'utf8'));

function getAt(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

/** 중간 경로가 없으면 만들지 않는다 — 키 신설 금지(불변식 1). */
function setAt(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const k of parts.slice(0, -1)) {
    if (!cur || typeof cur !== 'object' || !(k in cur)) return false;
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  if (!cur || typeof cur !== 'object' || !(last in cur)) return false;
  cur[last] = value;
  return true;
}

let applied = 0;
let skipped = 0;
const rejected = [];

for (const [locale, entries] of Object.entries(batch)) {
  const path = `messages/${locale}.json`;
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  let n = 0;

  for (const [key, translation] of Object.entries(entries)) {
    const source = getAt(en, key);
    if (typeof source !== 'string') {
      rejected.push(`${locale} ${key} — en.json 에 없는 키`);
      continue;
    }
    const current = getAt(doc, key);
    if (typeof current !== 'string') {
      rejected.push(`${locale} ${key} — 대상 로케일에 키 없음`);
      continue;
    }
    if (!FORCE && current !== source) {
      skipped += 1; // 이미 번역돼 있다
      continue;
    }
    if (!setAt(doc, key, translation)) {
      rejected.push(`${locale} ${key} — 경로 없음`);
      continue;
    }
    n += 1;
  }

  if (n > 0) writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`${locale}: ${n}건 적용`);
  applied += n;
}

console.log(`\n적용 ${applied} · 건너뜀(이미 번역됨) ${skipped} · 거부 ${rejected.length}`);
for (const r of rejected) console.log(`  ✗ ${r}`);
if (rejected.length > 0) process.exit(1);
