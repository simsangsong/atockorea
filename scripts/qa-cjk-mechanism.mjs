/**
 * Deterministic proof of the mechanism, in a real engine — no dev server.
 *
 * Two questions reading cannot answer:
 *   1. does the default stop the character-level collapse in the squeeze cases
 *      CLAUDE.md names (table header / flex-1 button / badge)?
 *   2. how much does `keep-all` raise a CJK run's min-content width? That is the
 *      blast radius — a flex item that used to shrink to one glyph now refuses
 *      to shrink below its longest 어절, which can widen a tight row.
 */
import { chromium } from 'playwright';

const CASES = `
<style>
  body { margin: 0; font: 14px/1.4 system-ui, sans-serif; }
  /* the squeeze: a flex row too narrow for its items, items allowed to shrink */
  .row { display: flex; gap: 4px; outline: 1px solid #06c; margin: 8px; }
  .row > * { min-width: 0; outline: 1px dashed #999; }
  .w120 { width: 120px; }
  table { table-layout: auto; border-collapse: collapse; margin: 8px; }
  th, td { border: 1px solid #999; padding: 2px; }
</style>

<!-- three labels sharing 120px: the classic 표 헤더 / 탭 squeeze -->
<div class="row w120" id="tabs"><span id="t1">준비전</span><span id="t2">빈민 유형</span><span id="t3">확정</span></div>

<!-- flex-1 label next to a fixed sibling: the classic button squeeze -->
<div class="row w120" id="btnrow"><span id="b1" style="flex:1">가이드에게 가기</span><span style="width:70px">70px</span></div>

<!-- a narrow table with Korean headers -->
<table id="tbl" style="width:150px"><tr><th id="h1">빈민 유형</th><th id="h2">준비 상태</th><th id="h3">담당자</th></tr>
<tr><td id="c1">제주 동부 해안도로를 따라 이동합니다</td><td>2</td><td>3</td></tr></table>

<!-- min-content probe: how wide does the browser think this text must be? -->
<div style="width:min-content; outline:1px solid #0a0; margin:8px" id="mc">가이드에게 가기</div>
<div style="width:min-content; outline:1px solid #0a0; margin:8px" id="mczh">濟州島東部海岸公路</div>
`;

const RULE = process.env.VARIANT === 'cells'
  ? 'html { word-break: keep-all; overflow-wrap: break-word; } td, th { overflow-wrap: anywhere; }'
  : process.env.VARIANT === 'safe'
    ? 'html { word-break: keep-all; overflow-wrap: break-word; }' +
      '#t1,#t2,#t3,#b1,#h1,#h2,#h3 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; overflow-wrap: normal; }'
    : 'html { word-break: keep-all; overflow-wrap: break-word; }';

const probe = () => {
  const linesOf = (el) => {
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    return Math.round(el.getBoundingClientRect().height / lh);
  };
  const out = {};
  for (const id of ['t1', 't2', 't3', 'b1', 'h1', 'h2', 'h3', 'c1']) {
    const el = document.getElementById(id);
    out[id] = { lines: linesOf(el), w: Math.round(el.getBoundingClientRect().width) };
  }
  out.mc = Math.round(document.getElementById('mc').getBoundingClientRect().width);
  out.mczh = Math.round(document.getElementById('mczh').getBoundingClientRect().width);
  out.tblW = Math.round(document.getElementById('tbl').getBoundingClientRect().width);
  out.docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  return out;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

await page.setContent(CASES);
const before = await page.evaluate(probe);
await page.setContent(`<style>${RULE}</style>${CASES}`);
const after = await page.evaluate(probe);
await browser.close();

const label = {
  t1: '탭 "준비전"',
  t2: '탭 "빈민 유형"',
  t3: '탭 "확정"',
  b1: 'flex-1 버튼 "가이드에게 가기"',
  h1: 'th "빈민 유형"',
  h2: 'th "준비 상태"',
  h3: 'th "담당자"',
  c1: 'td 본문 문장',
};
console.log('== squeeze cases — "lines" is how many rows the label collapsed into ==');
for (const k of Object.keys(label)) {
  const b = before[k];
  const a = after[k];
  const flag = a.lines < b.lines ? '  <= FIXED' : a.lines > b.lines ? '  <= WORSE' : '';
  console.log(`  ${label[k].padEnd(28)} lines ${b.lines} -> ${a.lines}   width ${b.w} -> ${a.w}${flag}`);
}
console.log('\n== min-content width (the blast radius) ==');
console.log(`  "가이드에게 가기"    ${before.mc}px -> ${after.mc}px`);
console.log(`  "濟州島東部海岸公路"  ${before.mczh}px -> ${after.mczh}px`);
console.log(`\n== 150px table ==\n  rendered width ${before.tblW}px -> ${after.tblW}px`);
console.log(`  document overflows horizontally: ${before.docOverflow} -> ${after.docOverflow}`);
