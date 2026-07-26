/**
 * CJK 글자 단위 줄바꿈 수색 (CLAUDE.md 불변 규칙 P1-5).
 *
 * 한국어는 띄어쓰기가 없어 CSS 기본값(`word-break: normal`)만으로도 글자 단위로
 * 쪼개진다. 폭이 제한된 컨테이너에 든 CJK 라벨에는 `.text-cjk-safe`(라벨·버튼·
 * 뱃지·탭) 또는 `.text-cjk-body`(본문)가 반드시 붙어야 한다.
 *
 * 위험 신호: 폭 제한(flex-1 / w-N / min-w-0 / grid) 안의 한국어인데
 *   - text-cjk-safe / text-cjk-body 도 없고
 *   - truncate / whitespace-nowrap / line-clamp 도 없다
 * → 이 조합이 `빈민 / 유형 / 준비전` 같은 세로 붕괴를 만든다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('components');

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.tsx$/.test(e.name)) files.push(f);
  }
};
for (const r of roots) walk(r);

const HANGUL = /[가-힣]/;
const CONSTRAINED = /\b(flex-1|min-w-0|w-\d|w-\[|grid-cols|max-w-\[|truncate)\b/;
const PROTECTED = /text-cjk-(safe|body)|truncate|whitespace-nowrap|line-clamp-/;

const hits = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = /className="([^"]*)"/.exec(line);
    if (!m) continue;
    const cls = m[1];
    if (!CONSTRAINED.test(cls) || PROTECTED.test(cls)) continue;
    // 같은 줄이나 바로 다음 두 줄에 한글 리터럴이 있는가 (JSX 자식)
    const near = [line, lines[i + 1] ?? '', lines[i + 2] ?? ''].join('\n');
    // 주석·import 는 제외
    if (/^\s*(\/\/|\*|import )/.test(line)) continue;
    const korean = near.match(/>[^<>{}]*[가-힣][^<>{}]*</);
    if (!korean) continue;
    if (!HANGUL.test(korean[0])) continue;
    hits.push({ file: path.relative('.', f), line: i + 1, text: korean[0].slice(1, -1).trim().slice(0, 40), cls: cls.slice(0, 70) });
  }
}

console.log(`폭 제한 컨테이너 안의 무방비 한국어: ${hits.length}건\n`);
const byFile = new Map();
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}
for (const [f, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${f}  (${list.length})`);
  for (const h of list.slice(0, 4)) console.log(`      :${h.line}  "${h.text}"   ← ${h.cls}`);
}
