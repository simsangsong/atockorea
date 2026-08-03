/**
 * qa-bundle-inspect — 번들 애널라이저 산출물에서 "무엇이 크냐"를 표로 뽑는다.
 *
 * `npm run analyze` 는 `.next/analyze/client.html` 을 만드는데, 그건 브라우저로 열어
 * 마우스를 얹어 보는 트리맵이다. 헤드리스 세션에서는 쓸 수 없고, 눈으로 보는 것은
 * 원장에 인용할 수도 없다. 이 스크립트는 그 HTML 에 박힌 `window.chartData` 를 읽어
 * **청크별·모듈별 크기**를 숫자로 낸다.
 *
 * 사용:
 *   node scripts/qa-bundle-inspect.mjs [--chunk room] [--top 20]
 *     --chunk : 청크 이름에 포함될 문자열(기본: 전체 청크 요약)
 *     --top   : 모듈 상위 N
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const CHUNK = flag('chunk', null);
const TOP = Math.max(1, Number(flag('top', '20')));
const FILE = flag('file', '.next/analyze/client.html');

let html;
try {
  html = readFileSync(FILE, 'utf8');
} catch {
  console.error(`${FILE} 이 없다. 먼저: npm run analyze`);
  process.exit(1);
}

// 애널라이저는 `window.chartData = <json>;` 형태로 심는다.
const m = html.match(/window\.chartData\s*=\s*(\[[\s\S]*?\]);/);
if (!m) {
  console.error('FAIL: chartData 를 못 찾았다 — 애널라이저 출력 형식이 바뀌었을 수 있다.');
  process.exit(1);
}
let data;
try {
  data = JSON.parse(m[1]);
} catch (e) {
  console.error('FAIL: chartData 파싱 실패 — ' + String(e).slice(0, 120));
  process.exit(1);
}
if (!Array.isArray(data) || !data.length) {
  console.error('FAIL: chartData 가 비었다 — 0개를 재고 초록으로 끝내지 않는다.');
  process.exit(1);
}

const kb = (n) => +(n / 1024).toFixed(1);

/** 트리를 훑어 leaf(실제 모듈)만 모은다. */
function leaves(node, out = []) {
  if (node.groups?.length) {
    for (const g of node.groups) leaves(g, out);
  } else if (node.path || node.label) {
    out.push({ path: node.path ?? node.label, size: node.parsedSize ?? node.statSize ?? 0 });
  }
  return out;
}

const chunks = data.map((c) => ({
  label: c.label,
  parsed: c.parsedSize ?? 0,
  gzip: c.gzipSize ?? 0,
  node: c,
}));

if (!CHUNK) {
  console.log(`\n청크 ${chunks.length}개 · parsed 합계 ${kb(chunks.reduce((a, c) => a + c.parsed, 0))} KB\n`);
  console.table(
    chunks
      .sort((a, b) => b.parsed - a.parsed)
      .slice(0, TOP)
      .map((c) => ({ 청크: c.label.slice(0, 70), 'parsed KB': kb(c.parsed), 'gzip KB': kb(c.gzip) })),
  );
  console.log('\n특정 청크의 내용: --chunk <이름 일부>');
  process.exit(0);
}

const matched = chunks.filter((c) => c.label.includes(CHUNK));
if (!matched.length) {
  console.error(`FAIL: '${CHUNK}' 를 포함하는 청크가 없다. 이름 목록은 --chunk 없이 실행.`);
  process.exit(1);
}

for (const c of matched) {
  const mods = leaves(c.node).sort((a, b) => b.size - a.size);
  const total = mods.reduce((a, x) => a + x.size, 0);
  console.log(`\n[${c.label}]  parsed ${kb(c.parsed)} KB · gzip ${kb(c.gzip)} KB · 모듈 ${mods.length}개`);
  console.table(
    mods.slice(0, TOP).map((x) => ({
      KB: kb(x.size),
      '비중%': +((x.size / total) * 100).toFixed(1),
      모듈: x.path.replace(/^\.\//, '').slice(0, 88),
    })),
  );
}
