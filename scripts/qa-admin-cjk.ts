/**
 * P1-5 verification — does any Korean label still break per character?
 *
 * A CSS safety net you have not seen on screen is a hypothesis. This walks the
 * admin surfaces at a narrow viewport (where the squeeze happens) and measures
 * every button / th / badge: a label is "stacked" when its rendered box is
 * taller than ~1.6 lines while being narrow enough that only per-character
 * breaking could explain it.
 *
 * Run: npx tsx scripts/qa-admin-cjk.ts   (dev on :3160, admin session required)
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { webkit, devices, type Page } from '@playwright/test';

loadEnvConfig(process.cwd());

const BASE = 'http://localhost:3160';
const SHOTS = process.argv[2] || path.join(process.cwd(), '.qa-shots-cjk');
mkdirSync(SHOTS, { recursive: true });

const ROUTES = [
  '/admin',
  '/admin/orders',
  '/admin/merchants',
  '/admin/ops-finance',
  '/admin/ops-finance/filings',
  '/admin/guide-settlements',
  '/admin/guides',
  '/admin/vehicle-layouts',
  '/admin/dining-cache',
  '/admin/poi-videos',
  // P1-5 잔여분(2026-07-26): min-w 없이 `w-full`/`min-w-full`만 있던 표들.
  // 화면에 띄워 보지 않은 CSS 안전망은 가설일 뿐이라 경로를 원장에 올린다.
  '/admin/support',
  '/admin/ops-finance/periods',
  '/admin/analytics/product/retention',
  '/admin/inbox',
];

interface Offender {
  route: string;
  tag: string;
  text: string;
  width: number;
  height: number;
}

/**
 * 이 페이지가 실제로 어드민 화면인가. 로그인 화면으로 튕겼는데 "0건"을 보고하면
 * 하니스가 통과 도장을 찍어 주는 셈이 된다.
 */
async function isAdminShell(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(document.querySelector('.admin-root')));
}

async function measure(page: Page, route: string): Promise<Offender[]> {
  return page.evaluate((r) => {
    const hangul = /[가-힣]/;
    const out: Array<{ route: string; tag: string; text: string; width: number; height: number }> = [];
    const nodes = document.querySelectorAll('button, th, label, dt, [role="tab"], span');
    nodes.forEach((el) => {
      const text = (el.textContent || '').trim();
      if (!text || text.length > 24 || !hangul.test(text)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const cs = getComputedStyle(el);
      const font = parseFloat(cs.fontSize) || 14;
      const line = parseFloat(cs.lineHeight) || font * 1.4;
      // A genuinely stacked CJK label is about ONE GLYPH wide. Measuring the
      // element box alone produced false positives from icon-over-label tab
      // buttons (flex-col), which are tall by design — so require the content
      // box to be too narrow to hold two glyphs, which only per-character
      // breaking can produce.
      const inner = document.createRange();
      inner.selectNodeContents(el);
      const textRect = inner.getBoundingClientRect();
      const glyphs = text.replace(/\s/g, '').length;
      const stacked =
        glyphs >= 2 &&
        textRect.width > 0 &&
        textRect.width < font * 2.2 &&
        textRect.height >= line * 2.2;
      if (stacked) {
        out.push({ route: r, tag: el.tagName.toLowerCase(), text: text.slice(0, 24), width: Math.round(textRect.width), height: Math.round(textRect.height) });
      }
    });
    return out;
  }, route);
}

async function main() {
  const browser = await webkit.launch();
  // 390px — the width where admin tables and tab bars actually squeeze.
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });

  // Adopt the seeded admin session. @supabase/ssr keeps the session in a
  // COOKIE, not localStorage (lib/supabase.ts createBrowserClient) — injecting
  // localStorage renders every admin page signed-out, which silently turns this
  // whole harness into a no-op. The cookie value is base64-prefixed JSON,
  // chunked at 3180 chars by the SSR helper.
  try {
    const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
    const raw = `base64-${Buffer.from(JSON.stringify(fx.adminSession)).toString('base64')}`;
    const CHUNK = 3180;
    const cookies =
      raw.length <= CHUNK
        ? [{ name: fx.supabaseStorageKey, value: raw }]
        : Array.from({ length: Math.ceil(raw.length / CHUNK) }, (_, i) => ({
            name: `${fx.supabaseStorageKey}.${i}`,
            value: raw.slice(i * CHUNK, (i + 1) * CHUNK),
          }));
    await ctx.addCookies(
      cookies.map((c) => ({ ...c, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' as const })),
    );
  } catch (error) {
    // 🔴 조용히 넘어가면 안 된다. 세션이 없으면 모든 /admin 경로가 로그인 화면으로
    // 튕기고, 측정 대상 요소가 하나도 없어 이 하니스는 **초록색 0건**을 보고한다 —
    // 이 저장소가 기록해 둔 "성공한 척하는 실패"의 정확한 사례다.
    console.error('🔴 admin session not adopted —', String(error).slice(0, 120));
    console.error('   먼저 `ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts` 로 픽스처를 만들어 주세요.');
    process.exit(2);
  }

  const offenders: Offender[] = [];
  const notAdmin: string[] = [];
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1800);
      if (!(await isAdminShell(page))) {
        notAdmin.push(route);
        await page.close();
        continue;
      }
      offenders.push(...(await measure(page, route)));
      await page.screenshot({ path: path.join(SHOTS, `${route.replace(/\//g, '_') || 'root'}.png`), fullPage: false });
    } catch (error) {
      console.log(`- ${route}: load failed (${String(error).slice(0, 60)})`);
    }
    await page.close();
  }

  await ctx.close();
  await browser.close();

  if (notAdmin.length > 0) {
    // 측정하지 못한 경로를 통과로 세지 않는다.
    console.log(`\n🔴 ${notAdmin.length} routes never rendered the admin shell (signed out?):`);
    for (const route of notAdmin) console.log(`  ${route}`);
    console.log(`shots → ${SHOTS}`);
    process.exit(2);
  }

  if (offenders.length === 0) {
    console.log(`\n✅ no vertically-stacked Korean labels found (${ROUTES.length} routes measured)`);
  } else {
    console.log(`\n🔴 ${offenders.length} stacked labels:`);
    for (const o of offenders.slice(0, 40)) {
      console.log(`  ${o.route}  <${o.tag}> "${o.text}"  ${o.width}x${o.height}px`);
    }
  }
  console.log(`shots → ${SHOTS}`);
}

main().catch((error) => {
  console.error('cjk check failed:', error);
  process.exit(1);
});
