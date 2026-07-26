/**
 * "안 채운 인자" 사냥 — 오늘 세 번 나온 결함 유형.
 *
 * 찾는 모양: 컴포넌트가 선택적 prop 을 받고, 그 prop 이 있을 때만 기능을
 * 렌더한다. 구현도 타입도 테스트도 맞는데 **호출부가 그 인자를 안 채우면**
 * 기능이 조용히 사라진다(예: GuideConsole 이 Cockpit 에 roomToken 미전달 →
 * 가이드에게 명단·좌석 타일이 사라짐).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.tsx$/.test(e.name)) files.push(f);
  }
};
walk('components');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const gated = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const optional = [...src.matchAll(/^\s{2,}(\w+)\?:\s/gm)].map((m) => m[1]);
  if (optional.length === 0) continue;
  for (const p of new Set(optional)) {
    const e = esc(p);
    // 그 prop 이 "있을 때만 렌더/추가"하는 게이트로 쓰이는가
    const gate = new RegExp(`\\.\\.\\.\\(\\s*${e}\\s*\\?|\\b${e}\\s*&&\\s*[({<]|\\b${e}\\s*\\?\\s*\\(`);
    if (gate.test(src)) gated.push({ file: f, prop: p });
  }
}

const compName = (f) => path.basename(f, '.tsx');
const byComp = new Map();
for (const g of gated) {
  const c = compName(g.file);
  if (!byComp.has(c)) byComp.set(c, { file: g.file, props: new Set() });
  byComp.get(c).props.add(g.prop);
}

const allSrc = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
let hits = 0;
console.log('게이트 prop 을 안 넘기는 호출부:\n');
for (const [c, { file, props }] of byComp) {
  const lines = [];
  for (const [f, src] of allSrc) {
    if (f === file) continue;
    const re = new RegExp(`<${esc(c)}\\b[\\s\\S]{0,1200}?/>`, 'g');
    for (const m of src.matchAll(re)) {
      const tag = m[0];
      const missing = [...props].filter((p) => !new RegExp(`\\b${esc(p)}\\s*=`).test(tag));
      if (missing.length > 0) lines.push(`${path.relative('components', f)} → ${missing.join(', ')}`);
    }
  }
  if (lines.length > 0) {
    hits += lines.length;
    console.log(`  ${c}  [${[...props].join(', ')}]`);
    for (const l of lines) console.log(`      ${l}`);
  }
}
console.log(`\n총 ${hits}건`);
