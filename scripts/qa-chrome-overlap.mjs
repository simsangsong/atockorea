/**
 * qa-chrome-overlap — R9. "헤더랑 바텀내비바가 내용을 가린다"를 측정한다.
 *
 * 이 증상은 2026-07-27에 세 번 보고됐고(itinerary → 서랍 → **앱 전반**), 매번
 * 한 화면씩 눈으로 찾아 고쳤다. 눈은 스크롤을 끝까지 안 내려 보고, 스크린샷은
 * 마지막 한 줄이 가려진 걸 "원래 그 자리"처럼 보여준다. 그래서 판정을 기계에
 * 맡긴다.
 *
 * 판정: **스크롤을 끝까지 굴렸는데도 내용이 크롬 밑에 남아 있으면 버그다.**
 *   위: scrollTop=0 에서 첫 내용의 top < 상단 크롬의 bottom
 *   아래: scrollTop=max 에서 마지막 내용의 bottom > 하단 크롬의 top
 * 스크롤해서 치울 수 있으면 정상이다(그건 그냥 스크롤이다).
 *
 * 크롬은 하드코딩하지 않고 런타임에 찾는다 — position fixed/sticky, 불투명,
 * 뷰포트 폭 대부분을 차지, 위나 아래에 붙어 있음. 셸이 바뀌어도 따라간다.
 *
 * Usage:
 *   1) dev on :3161  2) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *   3) SHOT_DIR=<out> node scripts/qa-chrome-overlap.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import path from 'path';

const OUT = path.join(process.env.SHOT_DIR ?? '.', 'overlap-shots');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.WALK_BASE ?? 'http://localhost:3161';

let fx;
try {
  fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
} catch {
  console.error('🔴 픽스처 없음 — ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts');
  process.exit(2);
}

/** 브라우저 안에서 도는 판정기. 페이지마다 주입한다. */
const PROBE = () => {
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const EDGE = 6;

  const opaque = (cs) => {
    const bg = cs.backgroundColor;
    if (!bg || bg === 'transparent') return false;
    const m = /rgba?\(([^)]+)\)/.exec(bg);
    if (!m) return false;
    const parts = m[1].split(',').map((n) => parseFloat(n));
    return parts.length < 4 || parts[3] > 0.5;
  };

  // --- 1) 크롬 찾기 -------------------------------------------------------
  const chromes = { top: null, bottom: null };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (!opaque(cs)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < VW * 0.6 || r.height < 8 || r.height > VH * 0.5) continue;
    if (r.top <= EDGE && (!chromes.top || r.bottom > chromes.top.rect.bottom)) {
      chromes.top = { el, rect: { top: r.top, bottom: r.bottom } };
    }
    if (r.bottom >= VH - EDGE && (!chromes.bottom || r.top < chromes.bottom.rect.top)) {
      chromes.bottom = { el, rect: { top: r.top, bottom: r.bottom } };
    }
  }
  if (!chromes.top && !chromes.bottom) return { chrome: false, findings: [] };

  // --- 2) 스크롤 컨테이너 찾기 -------------------------------------------
  const scrollers = [];
  const doc = document.scrollingElement || document.documentElement;
  if (doc.scrollHeight > doc.clientHeight + 4) scrollers.push(doc);
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowY)) continue;
    if (el.scrollHeight <= el.clientHeight + 4) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 80 || r.width < VW * 0.4) continue;
    scrollers.push(el);
  }

  const label = (el) => {
    if (!el) return 'none';
    const id = el.getAttribute?.('data-testid');
    return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}`;
  };

  // 내용의 실제 경계. 컨테이너 자체가 아니라 **보이는 자손 중 가장 위/아래**를
  // 쓴다. 패딩만 넉넉하고 자식이 삐져나오는 경우를 놓치지 않기 위해서다.
  const chromeEls = [chromes.top?.el, chromes.bottom?.el].filter(Boolean);
  const contentEdges = (scroller) => {
    let minTop = Infinity;
    let maxBottom = -Infinity;
    for (const el of scroller.querySelectorAll('*')) {
      // 🔴 문서 스크롤러에서는 헤더·탭바가 이 컨테이너의 **자손**이다. 크롬의
      //    자기 글자를 "가려진 내용"으로 세면 모든 페이지가 무조건 실패한다
      //    (이 하니스의 첫 실행이 정확히 그랬다).
      if (chromeEls.some((c) => c === el || c.contains(el))) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (cs.position === 'fixed') continue; // 오버레이는 이 컨테이너 소유가 아니다
      // 글자와 컨트롤만 실패 기준이다. 히어로 사진이 반투명 헤더 밑으로 몇 px
      // 물리는 건 편집 디자인이고(마케팅 페이지 3곳이 정확히 그랬다), 그걸
      // 버그로 세면 이 하니스는 늑대소년이 되어 아무도 안 본다.
      const isText = el.childElementCount === 0 && (el.textContent || '').trim().length > 0;
      const isControl = /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
      if (!isText && !isControl) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      minTop = Math.min(minTop, r.top);
      maxBottom = Math.max(maxBottom, r.bottom);
    }
    return { minTop, maxBottom };
  };

  const findings = [];
  for (const scroller of scrollers) {
    const max = scroller.scrollHeight - scroller.clientHeight;

    scroller.scrollTop = 0;
    const atTop = contentEdges(scroller);
    if (chromes.top && atTop.minTop < chromes.top.rect.bottom - 1) {
      findings.push({
        scroller: label(scroller),
        edge: 'top',
        hiddenPx: Math.round(chromes.top.rect.bottom - atTop.minTop),
        chrome: label(chromes.top.el),
      });
    }

    scroller.scrollTop = max;
    const atBottom = contentEdges(scroller);
    if (chromes.bottom && atBottom.maxBottom > chromes.bottom.rect.top + 1) {
      findings.push({
        scroller: label(scroller),
        edge: 'bottom',
        hiddenPx: Math.round(atBottom.maxBottom - chromes.bottom.rect.top),
        chrome: label(chromes.bottom.el),
      });
    }
    scroller.scrollTop = 0;
  }

  return {
    chrome: true,
    top: chromes.top ? label(chromes.top.el) : null,
    bottom: chromes.bottom ? label(chromes.bottom.el) : null,
    findings,
  };
};


/**
 * 노치 아이폰 시뮬레이터. Chromium 은 `env(safe-area-inset-*)` 을 항상 0 으로
 * 준다 — 그래서 **브라우저 QA 로는 이 결함을 절대 재현할 수 없고**, 실제로
 * 2026-07-27 하루에 세 번 보고될 때까지 walk 하니스가 매번 초록이었다.
 * env() 를 덮어쓸 방법은 없으니 그 값을 쓰는 두 경로를 직접 치환한다:
 * `.tr-safe-*` 유틸리티(스타일시트)와 인라인 style 의 env() 리터럴.
 */
const SAFE_AREA_SHIM = ([top, bottom]) => {
  const style = document.createElement('style');
  style.textContent =
    `.tr-safe-top{padding-top:${top}px !important}` +
    `.tr-safe-bottom{padding-bottom:${bottom}px !important}`;
  document.head.appendChild(style);
  for (const el of document.querySelectorAll('[style*="safe-area-inset"]')) {
    el.style.cssText = el.style.cssText
      .replace(/env\(\s*safe-area-inset-top[^)]*\)/g, `${top}px`)
      .replace(/env\(\s*safe-area-inset-bottom[^)]*\)/g, `${bottom}px`);
  }
};
const INSETS = process.env.SAFE_AREA === '0' ? null : [59, 34]; // iPhone 14 Pro

const browser = await chromium.launch();
const results = [];

async function newCtx({ admin = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('tr_manual_seen_v2', String(Date.now()));
    } catch {
      /* ignore */
    }
  });
  if (admin) {
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
      cookies.map((c) => ({
        ...c,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      })),
    );
  }
  return ctx;
}

async function inspect(name, url, { admin = false, ready, steps = [] } = {}) {
  const ctx = await newCtx({ admin });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (ready) await page.waitForSelector(ready, { timeout: 90000 });
    await page.addStyleTag({ content: 'nextjs-portal{display:none !important}' });
    if (INSETS) await page.evaluate(SAFE_AREA_SHIM, INSETS);
    await page.waitForTimeout(1800);

    const run = async (suffix) => {
      const res = await page.evaluate(PROBE);
      const key = suffix ? `${name}/${suffix}` : name;
      results.push({ surface: key, ...res });
      for (const f of res.findings) {
        await page.screenshot({ path: path.join(OUT, `${key.replace(/\W+/g, '-')}-${f.edge}.png`) });
      }
    };

    await run('');
    for (const [suffix, selector] of steps) {
      const target = page.locator(selector);
      if (!(await target.count())) continue;
      await target.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1400);
      await run(suffix);
    }
  } catch (error) {
    results.push({ surface: name, error: String(error).slice(0, 120) });
  } finally {
    await ctx.close();
  }
}

const roomTabs = [
  ['chat', '[data-testid="room-tabbar"] button:nth-child(2)'],
  ['today', '[data-testid="room-tabbar"] button:nth-child(3)'],
  ['more', '[data-testid="room-tabbar"] button:nth-child(4)'],
];

await inspect('guest-room', fx.room1Url, {
  ready: '[data-testid="room-tabbar"]',
  steps: roomTabs,
});
await inspect('guide-console', fx.guideUrl, {
  ready: 'nav',
  steps: [
    ['t2', 'nav button:nth-child(2)'],
    ['t3', 'nav button:nth-child(3)'],
    ['t4', 'nav button:nth-child(4)'],
  ],
});
await inspect('plan-editor', `/tour-mode/plan/${fx.booking1}${fx.room1Url.slice(fx.room1Url.indexOf('?'))}`, {
  ready: 'body',
});
await inspect('ops-center', '/admin/tour-ops', {
  admin: true,
  ready: '[data-testid="ops-tab-home"]',
  steps: [
    ['dashboard', '[data-testid="ops-tab-dashboard"]'],
    ['bookings', '[data-testid="ops-tab-bookings"]'],
    ['sos', '[data-testid="ops-tab-sos"]'],
    ['settings', '[data-testid="ops-tab-settings"]'],
  ],
});

await inspect('tour-mode-entry', '/tour-mode', { ready: 'body' });
await inspect('checkin', `/tour-mode/checkin/${fx.booking1}`, { ready: 'body' });
await inspect('driver', '/tour-mode/driver', { ready: 'body' });

// 앱에서 손님이 실제로 도달하는 **공개 사이트** 표면. 앱 셸은 flex 컬럼이라
// 브라우저에서 크롬이 내용을 덮을 수 없지만, 마케팅 페이지는 sticky 헤더 +
// 문서 스크롤이라 규칙이 다르다. 앱 안에서 링크를 누르면 여기로 온다.
for (const [name, url] of [
  ['site-home', '/'],
  ['site-tours', '/tours/list'],
  ['site-tour-detail', '/tour-product/jeju-grand-highlights-loop'],
  ['site-mypage', '/mypage'],
]) {
  await inspect(name, url, { ready: 'body' });
}

await browser.close();

let bad = 0;
console.log('\n--- R9 chrome overlap ---');
for (const r of results) {
  if (r.error) {
    console.log(`ERR   ${r.surface}: ${r.error}`);
    bad += 1;
    continue;
  }
  if (!r.chrome) {
    console.log(`skip  ${r.surface} (고정 크롬 없음)`);
    continue;
  }
  if (!r.findings.length) {
    console.log(`ok    ${r.surface}  [top=${r.top} bottom=${r.bottom}]`);
    continue;
  }
  bad += r.findings.length;
  for (const f of r.findings) {
    console.log(
      `🔴 ${r.surface}  ${f.edge} 가림 ${f.hiddenPx}px  scroller=${f.scroller}  chrome=${f.chrome}`,
    );
  }
}
console.log(`\n${bad === 0 ? 'PASS' : `FAIL — ${bad}건`}   shots → ${OUT}`);
process.exit(bad === 0 ? 0 : 1);
