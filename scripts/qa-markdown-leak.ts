#!/usr/bin/env node
/**
 * Does authored markdown reach the guest as literal characters?
 *
 *   node --import tsx scripts/qa-markdown-leak.ts --base=http://localhost:3000 --slugs=a,b,c
 *
 * 🔴 Reads `innerText`, not the HTML source. Every tour_product_pages row
 * carries `**` somewhere in its payload, but a payload is not a screen: the
 * markers may sit in a field nothing renders, or inside the RSC payload that
 * ships in the document and is never painted. Only the text the browser lays
 * out settles whether a guest sees an asterisk, so that is what this counts.
 *
 * Exits 2 when a page could not be read at all, so an empty finding can never
 * be produced by a run that never looked.
 */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const flag = (n: string, d: string): string => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const BASE = flag('base', 'http://localhost:3000').replace(/\/$/, '');
const SLUGS = flag('slugs', '').split(',').filter(Boolean);

/** Markers that are markdown syntax rather than prose. */
const PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'bold **', re: /\*\*[^*\n]{1,80}\*\*/g },
  { name: 'italic _', re: /(?<![A-Za-z0-9_])_[^_\n]{2,60}_(?![A-Za-z0-9_])/g },
  { name: 'heading #', re: /^#{1,6}\s+\S/gm },
  { name: 'link []()', re: /\[[^\]\n]{1,60}\]\([^)\n]{1,120}\)/g },
];

type Hit = { slug: string; pattern: string; count: number; samples: string[] };

async function main(): Promise<number> {
  if (!SLUGS.length) { console.error('--slugs=<slug,slug> 가 필요하다'); return 2; }
  const browser = await chromium.launch();
  const hits: Hit[] = [];
  let read = 0, blind = 0;
  try {
    for (const slug of SLUGS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      try {
        await page.goto(`${BASE}/tour-product/${slug}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.waitForTimeout(2000);
        // 🔴 The stop descriptions — where almost all of the authored markdown
        // lives — sit inside collapsed accordions, and collapsed content is not
        // in innerText. Reading the page as it first paints therefore reports
        // "clean" for pages that are full of literal asterisks one tap away.
        // Open everything first, then read.
        // Anything that could leave the page is skipped: a nav or language
        // menu also carries aria-expanded, and clicking one navigates, which
        // destroys the context mid-sweep and reports a page as unreadable.
        const opened = await page.evaluate(() => {
          let n = 0;
          document.querySelectorAll('details:not([open])').forEach((d) => { (d as HTMLDetailsElement).open = true; n += 1; });
          document.querySelectorAll('[aria-expanded="false"]').forEach((el) => {
            const e = el as HTMLElement;
            if (e.closest('a[href]') || e.closest('nav') || e.closest('header')) return;
            if (e.tagName === 'A') return;
            try { e.click(); n += 1; } catch { /* a trigger that refuses is not our problem */ }
          });
          return n;
        }).catch(() => 0);
        if (opened) await page.waitForTimeout(1200);
        const text = await page.evaluate(() => document.body.innerText || '');
        if (text.length < 500) { console.log(`  ✗ ${slug} — 본문을 못 읽었다 (${text.length}자)`); blind += 1; continue; }
        read += 1;
        console.log(`  · ${slug} — 펼친 접힘 ${opened}개 · 본문 ${text.length}자`);
        for (const p of PATTERNS) {
          const found = text.match(p.re) ?? [];
          if (found.length) {
            hits.push({ slug, pattern: p.name, count: found.length, samples: [...new Set(found)].slice(0, 3) });
          }
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  for (const h of hits) {
    console.log(`  ✗ ${h.slug}  ${h.pattern} ×${h.count}`);
    for (const s of h.samples) console.log(`      ${s.replace(/\s+/g, ' ').slice(0, 100)}`);
  }
  console.log(`\n════ 요약 ════`);
  console.log(`  읽은 페이지 ${read} · 못 읽은 페이지 ${blind} · 마크다운이 새는 페이지 ${new Set(hits.map((h) => h.slug)).size}`);
  if (!read) { console.log('\n🔴 아무 페이지도 못 읽었다.'); return 2; }
  if (blind) return 2;
  return hits.length ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(2); });
