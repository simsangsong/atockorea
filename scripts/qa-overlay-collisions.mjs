/**
 * qa-overlay-collisions — 고정 오버레이끼리의 겹침을 잰다.
 *
 * 왜 별도 하니스인가: `qa-chrome-overlap.mjs` 는 **`position:fixed` 요소를 일부러
 * 건너뛴다**(`:102` "오버레이는 이 컨테이너 소유가 아니다"). 그 하니스가 묻는 건
 * "스크롤 내용이 크롬 밑에 남는가"뿐이고, **오버레이 대 오버레이**는 그 질문에
 * 안 걸린다. 그래서 2026-08-07 에 홈 스티키 CTA(`bottom-3`, z-40)가 `BottomNav`
 * (z-50, 60px+safe) 밑에 깔린 채로 배포돼 있었다 — 56px 중 49px 가림, 게이트는
 * 전부 초록이었다(PR #738).
 *
 * 판정: **낮은 z 오버레이가 높은 z 오버레이에 THRESHOLD px 이상 덮이면 버그다.**
 * 둘 다 고정이라 스크롤로 치울 수 없다 — 그냥 안 보이는 것이다.
 *
 * 🔴 **노치 패스가 본론이다.** Chromium 은 `env(safe-area-inset-*)` 를 항상 0 으로
 * 준다 — 위 결함도 inset 0 에서는 7px 이 삐져나와 "조금 겹치네"로 보였지만 실제
 * 노치 기기에선 **통째로** 사라졌다(사장님 보고 = "아무것도 안 보여"). 그래서 매
 * 표면을 flat(0) 과 notch(34) 두 번 돈다.
 *
 * Usage:
 *   1) dev 를 띄운다 (WALK_BASE, 기본 :3185)
 *   2) npm run qa:overlay-collisions
 *   앱(tour-mode/ops) 표면까지 보려면:
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts  → 픽스처가 생기면 자동 포함.
 *
 * ⚠ **워크트리에서는 HMR 이 안 먹는다.** 소스를 고친 뒤 dev 를 재시작하지 않으면
 * 이 하니스는 **옛 빌드를 재고 자신 있게 FAIL 을 뱉는다** — 이 파일을 만들면서
 * 정확히 한 번 속았다(고쳐 놓고 4건 FAIL). 고쳤으면 재시작하고 돌려라.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3185';
const OUT = path.join(process.env.SHOT_DIR ?? '.', 'overlay-collision-shots');
mkdirSync(OUT, { recursive: true });

/** 이만큼 넘게 덮이면 실패. 1-3px 은 반올림·헤어라인이라 노이즈다. */
const THRESHOLD = Number(process.env.OVERLAY_THRESHOLD ?? 4);

/** iPhone 14 Pro 인셋. */
const NOTCH = [59, 34];

let fx = null;
try {
  fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
} catch {
  /* 픽스처 없으면 공개 사이트 표면만 돈다 */
}

/**
 * Chromium 의 `env(safe-area-inset-*)` 는 항상 0 이다. 값을 주입할 방법이 없으니
 * 그 값을 쓰는 두 경로를 직접 치환한다 — (a) 인라인 style 의 env() 리터럴,
 * (b) 스타일시트 규칙(Tailwind arbitrary value 가 여기 산다).
 *
 * 🔴 (b) 에 함정이 있다: **최신 Chromium 은 CSS 중첩 때문에 평범한 `CSSStyleRule`
 * 에도 `cssRules` 프로퍼티가 있다.** `if (rule.cssRules)` 로 그룹 여부를 판단하면
 * 모든 리프 규칙이 재귀 가지로 빨려 들어가 **치환 0건인데 조용히 성공**한다
 * (이 하니스의 첫 판이 정확히 그랬다 — 4,537 규칙 스캔, 히트 0). `.length` 를 봐라.
 *
 * @media 조건은 보존해야 한다(`md:` 변형이 여기 산다). @layer 는 일부러 벗긴다 —
 * 언레이어 선언이 레이어 선언을 이기므로 그래야 치환본이 원본을 덮는다.
 */
const SAFE_AREA_SHIM = ([top, bottom]) => {
  const sub = (text) =>
    text
      .replace(/env\(\s*safe-area-inset-top\s*(?:,[^)]*)?\)/g, `${top}px`)
      .replace(/env\(\s*safe-area-inset-bottom\s*(?:,[^)]*)?\)/g, `${bottom}px`)
      .replace(/env\(\s*safe-area-inset-(?:left|right)\s*(?:,[^)]*)?\)/g, '0px');

  let inline = 0;
  for (const el of document.querySelectorAll('[style*="safe-area-inset"]')) {
    el.setAttribute('style', sub(el.getAttribute('style')));
    inline += 1;
  }

  const patched = [];
  const collect = (list, open, close) => {
    for (const rule of list) {
      const text = rule.cssText || '';
      if (!text.includes('safe-area-inset')) continue;
      const kids = rule.cssRules;
      if (kids && kids.length) {
        const head = text.slice(0, text.indexOf('{') + 1);
        // @layer 는 벗긴다(언레이어가 이긴다). @media/@supports 는 유지한다.
        const keep = !/^\s*@layer/i.test(head);
        collect(kids, keep ? open + head : open, keep ? close + '}' : close);
      } else if (rule.style) {
        patched.push(open + sub(text) + close);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      collect(sheet.cssRules, '', '');
    } catch {
      /* cross-origin */
    }
  }
  if (patched.length) {
    const style = document.createElement('style');
    style.id = '__safe-area-shim';
    style.textContent = patched.join('\n');
    document.head.appendChild(style);
  }
  return { rules: patched.length, inline };
};

/**
 * 페이지 안에서 도는 판정기. 질문은 딱 하나 —
 * **"낮은 z 오버레이의 글자나 컨트롤이, 높은 z 오버레이의 불투명한 면에 덮이는가."**
 *
 * 🔴 이 문장의 두 조건이 둘 다 필요하다. 첫 판에서 하나씩 빼먹고 둘 다 틀렸다:
 *
 * ① **덮이는 쪽은 글자·컨트롤만 센다.** 배경 이미지까지 잉크로 세면 히어로 사진이
 *    반투명 헤더 밑으로 6px 물리는 걸 결함이라고 외친다 — 그건 편집 디자인이고,
 *    `qa-chrome-overlap.mjs:103-105` 가 같은 이유로 이미 거부해 둔 것이다
 *    ("늑대소년이 되어 아무도 안 본다"). 첫 판이 정확히 그 오탐을 냈다.
 * ② **덮는 쪽은 불투명해야 한다.** 투명한 래퍼는 z 가 아무리 높아도 아무것도
 *    안 가린다. 챗봇 FAB 래퍼(`pointer-events-none`, 배경 없음)가 그런 경우인데,
 *    그 **안의 버튼**은 불투명하므로 자손까지 훑어야 놓치지 않는다.
 */
const PROBE = (threshold) => {
  const VW = window.innerWidth;
  const VH = window.innerHeight;

  const invisible = (cs) =>
    cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) <= 0.05;

  /** 뒤를 가릴 만큼 불투명한가. `qa-chrome-overlap.mjs:43-50` 과 같은 기준. */
  const opaque = (cs) => {
    const bg = cs.backgroundColor;
    if (!bg || bg === 'transparent') return false;
    const m = /rgba?\(([^)]+)\)/.exec(bg);
    if (!m) return false;
    const parts = m[1].split(',').map((n) => parseFloat(n));
    return parts.length < 4 || parts[3] > 0.5;
  };

  const label = (el) => {
    const testid = el.getAttribute('data-testid');
    const aria = el.getAttribute('aria-label');
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return `${el.tagName.toLowerCase()}${
      testid ? `[${testid}]` : aria ? `[${aria}]` : text ? `"${text}"` : cls ? `.${cls}` : ''
    }`;
  };

  const rectOf = (el) => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
  };

  /** 덮는 면들 — 자기+자손 중 불투명한 것. */
  const occluders = (root) => {
    const out = [];
    const visit = (el) => {
      const cs = getComputedStyle(el);
      if (invisible(cs)) return;
      if (opaque(cs)) {
        const r = rectOf(el);
        if (r.width >= 8 && r.height >= 8) out.push(r);
      }
      for (const child of el.children) visit(child);
    };
    visit(root);
    return out;
  };

  /** 덮이면 안 되는 것들 — 글자와 컨트롤만. */
  const contents = (root) => {
    const out = [];
    const visit = (el) => {
      const cs = getComputedStyle(el);
      if (invisible(cs)) return;
      const isLeafText = el.childElementCount === 0 && (el.textContent || '').trim().length > 0;
      const isControl = /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
      if (isLeafText || isControl) {
        const r = rectOf(el);
        if (r.width >= 8 && r.height >= 8) out.push({ el, r });
      }
      for (const child of el.children) visit(child);
    };
    visit(root);
    return out;
  };

  const overlays = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (invisible(cs)) continue;
    const r = rectOf(el);
    if (r.width < 8 || r.height < 8) continue;
    // 전면 모달/스크림은 "덮는 게 일"이다.
    if (r.width >= VW * 0.95 && r.height >= VH * 0.9) continue;
    overlays.push({ el, r, z: Number(cs.zIndex) || 0, occ: occluders(el), items: contents(el) });
  }

  const findings = [];
  for (let i = 0; i < overlays.length; i += 1) {
    for (let j = i + 1; j < overlays.length; j += 1) {
      const a = overlays[i];
      const b = overlays[j];
      // 조상-자손은 겹치는 게 정상이다(패널 안의 버튼 등).
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.z === b.z) continue; // 같은 z 는 형제 레이아웃이고 DOM 순서가 정한다
      const [lo, hi] = a.z < b.z ? [a, b] : [b, a];

      for (const item of lo.items) {
        let worst = null;
        for (const o of hi.occ) {
          const ix = Math.min(item.r.right, o.right) - Math.max(item.r.left, o.left);
          const iy = Math.min(item.r.bottom, o.bottom) - Math.max(item.r.top, o.top);
          if (ix <= threshold || iy <= threshold) continue;
          const pct = Math.round(((ix * iy) / (item.r.width * item.r.height)) * 100);
          if (!worst || pct > worst.pct) worst = { pct, overlapH: Math.round(iy) };
        }
        // 20% 미만은 모서리 스침이다. 그 위부터 "안 보인다"고 부를 수 있다.
        if (!worst || worst.pct < 20) continue;
        findings.push({
          hidden: label(item.el),
          owner: label(lo.el),
          hiddenZ: lo.z,
          by: label(hi.el),
          byZ: hi.z,
          coveredPct: worst.pct,
          overlapH: worst.overlapH,
          hiddenRect: { top: Math.round(item.r.top), bottom: Math.round(item.r.bottom) },
        });
      }
    }
  }
  findings.sort((x, y) => y.coveredPct - x.coveredPct);
  return { overlays: overlays.map((o) => `${label(o.el)}(z${o.z})`), findings };
};

const browser = await chromium.launch();
const results = [];

async function context({ admin }) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('tr_manual_seen_v2', String(Date.now()));
    } catch {
      /* ignore */
    }
  });
  if (admin && fx) {
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
      cookies.map((c) => ({ ...c, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' })),
    );
  }
  return ctx;
}

async function once(name, url, opts, pass, insets) {
  const { admin = false, ready = 'body', scroll = 0, waitFor } = opts;
  const ctx = await context({ admin });
  const page = await ctx.newPage();
  const key = `${name}/${pass}`;
  try {
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForSelector(ready, { timeout: 120000 });
    if (waitFor) await page.waitForFunction(waitFor, { timeout: 120000 });
    await page.addStyleTag({ content: 'nextjs-portal{display:none !important}' });
    await page.waitForTimeout(2200);
    if (insets) {
      const applied = await page.evaluate(SAFE_AREA_SHIM, insets);
      // 🔴 치환 0건이면 이 패스는 flat 과 똑같다 — 초록이어도 아무것도 안 잰 것이다.
      if (!applied.rules && !applied.inline) {
        return { surface: key, error: 'safe-area shim 미적용 (치환 0건) — 이 패스는 무의미' };
      }
      await page.waitForTimeout(500);
    }
    if (scroll) {
      await page.evaluate((y) => window.scrollTo(0, y), scroll);
      await page.waitForTimeout(1500);
    }
    const res = await page.evaluate(PROBE, THRESHOLD);
    if (res.findings.length) {
      await page.screenshot({ path: path.join(OUT, `${key.replace(/\W+/g, '-')}.png`) });
    }
    return { surface: key, ...res };
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function inspect(name, url, opts = {}) {
  for (const [pass, insets] of [
    ['flat', null],
    ['notch', NOTCH],
  ]) {
    let last;
    // dev 서버는 첫 방문에 라우트를 컴파일하고 그 사이 네비게이션이 한 번 튄다
    // ("Execution context was destroyed"). 재시도 한 번이면 warm 이라 통과한다.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        last = await once(name, url, opts, pass, insets);
        if (!last.error) break;
      } catch (error) {
        last = { surface: `${name}/${pass}`, error: String(error).slice(0, 140) };
      }
    }
    results.push(last);
  }
}

// --- 공개 사이트 (BottomNav 가 사는 곳 — 이 결함의 원산지) ------------------
// 홈은 스크롤 위치마다 오버레이 구성이 다르다(StickyHomeCta 는 히어로를 지나야
// 뜨고, 언어 pill 은 그때 숨는다). 두 지점을 따로 본다.
await inspect('site-home-top', '/', { ready: '[data-home-hero]' });
await inspect('site-home-scrolled', '/', {
  ready: '[data-home-hero]',
  waitFor: () => (document.querySelector('[data-home-hero]')?.getBoundingClientRect().height ?? 0) > 100,
  scroll: 1200,
});
await inspect('site-tours-top', '/tours/list');
await inspect('site-tours-scrolled', '/tours/list', { scroll: 900 });
await inspect('site-tour-detail', '/tour-product/jeju-grand-highlights-loop', { scroll: 1200 });
await inspect('site-cart', '/cart');
await inspect('site-mypage', '/mypage');
// `/itinerary-builder` 는 `ITINERARY_BUILDER_ENABLED=false` 라 `/tours/list` 로
// 리다이렉트된다(`builder-visibility.ts:18`). 표면으로 넣어 봐야 위와 같은 것을
// 두 번 재는 것뿐이라 뺐다. 플래그를 켜면 여기 되살려라.

// --- 앱 표면 (픽스처가 있을 때만) ------------------------------------------
if (fx) {
  await inspect('guest-room', fx.room1Url, { ready: '[data-testid="room-tabbar"]' });
  await inspect('guide-console', fx.guideUrl, { ready: 'nav' });
  await inspect('ops-center', '/admin/tour-ops', { admin: true, ready: '[data-testid="ops-tab-home"]' });
} else {
  results.push({ surface: 'app-surfaces', skipped: '픽스처 없음 — ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts' });
}

await browser.close();

let bad = 0;
let ran = 0;
let notchRan = 0;
console.log('\n--- 고정 오버레이 겹침 (390x844, flat=inset0 / notch=inset34) ---');
for (const r of results) {
  if (r.skipped) {
    console.log(`skip  ${r.surface}: ${r.skipped}`);
    continue;
  }
  if (r.error) {
    console.log(`ERR   ${r.surface}: ${r.error}`);
    bad += 1;
    continue;
  }
  ran += 1;
  if (r.surface.endsWith('/notch')) notchRan += 1;
  if (!r.findings.length) {
    console.log(`ok    ${r.surface}  [${r.overlays.join(' ')}]`);
    continue;
  }
  bad += r.findings.length;
  for (const f of r.findings) {
    console.log(
      `🔴 ${r.surface}\n      ${f.hidden}  (안: ${f.owner} z${f.hiddenZ}, top ${f.hiddenRect.top}/bot ${f.hiddenRect.bottom})` +
        `\n      ←덮임 ${f.coveredPct}% (높이 ${f.overlapH}px)  by ${f.by}(z${f.byZ})`,
    );
  }
}

// 🔴 0 을 초록으로 읽지 않기 위한 자기검사. 아무것도 안 돌았거나 노치 패스가
// 통째로 빠졌으면 그건 PASS 가 아니라 "안 쟀음"이다.
if (ran === 0) {
  console.log('\n🔴 판정한 표면이 0개다 — dev 서버가 떴는지 확인하라. PASS 아님.');
  process.exit(2);
}
if (notchRan === 0) {
  console.log('\n🔴 노치 패스가 한 번도 안 돌았다 — 이 하니스의 존재 이유가 빠졌다. PASS 아님.');
  process.exit(2);
}
console.log(`\n${bad === 0 ? 'PASS' : `FAIL — ${bad}건`}   표면 ${ran}개(노치 ${notchRan}) 판정   shots → ${OUT}`);
process.exit(bad === 0 ? 0 : 1);
