/**
 * qa-tap-reachability — "눌렀는데 반응이 없다"를 기계로 잡는다.
 *
 * 사장님이 정의한 기능 결함(2026-08-07): *"화면이 짤리거나, 버튼이 가려지거나,
 * 눌렀는데 반응이 없거나."* 취향·밀도·크기는 안 본다.
 *
 * 1) TAP  — 컨트롤 중심에서 `elementFromPoint` 가 그 컨트롤(또는 자손)이 아니면
 *           **눌러도 안 눌린다.** 겹침 픽셀을 세는 것보다 정확하다: `pointer-events:none`
 *           오버레이는 애초에 안 잡히고, 투명해도 이벤트를 가로채는 것은 잡힌다.
 *           `qa-overlay-collisions.mjs` 는 오버레이끼리의 기하를 보고, 이쪽은
 *           **실제로 탭이 어디에 떨어지는지**를 본다 — 겹치는 질문이 아니다.
 * 2) DEAD — `href` 가 없거나 `#` 인 링크. 링크처럼 생겼는데 아무 일도 안 한다.
 *           이걸로 `/tour-product` FAQ 의 "Message us anytime" 을 잡았다(PR 참조).
 * 3) HIDDEN — **접힌 패널 안의 포커스 가능한 컨트롤에 `inert` 가 없다.**
 *           `grid-rows-[0fr]` 접기는 `display/visibility/opacity` 를 안 건드려서
 *           눈에는 안 보이는데 **Tab 은 들어간다.** 실측으로 확인했다: 상세 페이지
 *           "Best for" 헤더에서 Tab 한 번 → 접힌 패널 안 "Less ideal for" 로 포커스.
 * 4) XSCROLL — 문서가 뷰포트보다 넓다 = 가로로 짤린다.
 *
 * 🔴 이 하니스의 값은 **2단 판정**에 있다. 1단(현재 스크롤에서 가려짐)만 쓰면
 * 하단 고정 바 밑을 지나가는 모든 흐름 콘텐츠가 매 스크롤 정지마다 잡혀 60건씩
 * 나온다 — 스크롤하면 해소되므로 결함이 아니다. **가운데로 굴려도 여전히 가려지는
 * 것만** 진짜로 못 누르는 것이다.
 *
 * Usage:
 *   1) dev 를 띄운다 (WALK_BASE, 기본 :3185)
 *   2) npm run qa:tap-reachability
 *
 * ⚠ 워크트리는 HMR 이 안 먹는다 — 소스를 고쳤으면 **dev 재시작 후** 돌려라.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3185';
const OUT = path.join(process.env.SHOT_DIR ?? '.', 'functional-shots');
mkdirSync(OUT, { recursive: true });

const PROBE = () => {
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const out = { tap: [], clip: [], dead: [], hidden: [] }; // clip 은 항상 비어 있다(위 §2 참조)

  const label = (el) => {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34);
    const aria = el.getAttribute('aria-label');
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return `${el.tagName.toLowerCase()}${t ? `"${t}"` : aria ? `[${aria}]` : cls ? `.${cls}` : ''}`;
  };
  // 🔴 조상까지 봐야 한다. 언어 pill 은 **래퍼**가 opacity-0 인데 버튼 자신은
  // opacity 1 이라, 자기 스타일만 보면 "보인다"고 나온다(첫 판이 그래서 이미
  // 숨겨진 pill 을 결함으로 신고했다). checkVisibility 가 조상을 대신 훑는다.
  const visible = (el) =>
    el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });

  /** el 의 중심점에서 실제로 잡히는 것. el 자신/자손/조상이면 null(= 안 가려짐). */
  const blockerFor = (el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 1 || y < 1 || x > VW - 1 || y > VH - 1) return null;
    const hit = document.elementFromPoint(x, y);
    if (!hit) return null;
    if (el === hit || el.contains(hit) || hit.contains(el)) return null;
    // dev 전용 크롬은 프로덕션에 없다.
    if (hit.closest('nextjs-portal, #__next-build-watcher')) return null;
    // 열린 모달/다이얼로그는 **가리는 게 일**이다. 그걸 결함으로 세면 전 화면이
    // 빨개진다(첫 판이 정확히 그랬다 — 웰컴 쿠폰 팝업 하나가 60건을 만들었다).
    if (hit.closest('[role="dialog"], [aria-modal="true"], [data-welcome-popup]')) return null;
    // 챗봇 위젯(런처·티저 버블)도 같은 부류다. 티저는 idle 6초 뒤 뜨는 **닫기 버튼
    // 달린** 프로모 말풍선이라, 뒤에 뭐가 있든 잠깐 덮는 게 설계다. 이걸 결함으로
    // 세면 긴 페이지 6곳에서 푸터 Stripe 배지가 매번 잡힌다(실제로 그랬다).
    if (hit.closest('[data-tour-assistant-root]')) return null;
    return hit;
  };

  /**
   * 접힌 패널(`grid-rows-[0fr]` + `overflow-hidden`) 안에 있나.
   * 이 방식은 **보이진 않지만 DOM 에 남는다** — `display/visibility/opacity` 를
   * 안 건드리므로 `checkVisibility()` 는 "보인다"고 답하고, 브라우저는 **Tab 으로
   * 포커스를 준다.** 그래서 두 가지가 필요하다: 가려짐 판정에서 빼고(가려진 게
   * 아니라 숨겨진 것이다), `inert` 가 없으면 **그건 그것대로 결함**으로 신고한다.
   */
  const collapsedAncestor = (el) => {
    let n = el;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (cs.display === 'grid' && /(^|\s)0px(\s|$)/.test(cs.gridTemplateRows)) return n;
      n = n.parentElement;
    }
    return null;
  };

  // --- 1) TAP -------------------------------------------------------------
  // 2단이다. 1단은 "지금 이 스크롤에서 가려진" 컨트롤을 모으고, 2단은 그걸
  // **화면 한가운데로 굴려서 다시** 찍는다.
  //
  // 🔴 2단이 없으면 이 하니스는 쓸모가 없다. 하단 고정 바 밑을 지나가는 모든
  // 흐름 콘텐츠가 매 스크롤 정지마다 "가려짐"으로 잡히는데, 그건 스크롤하면
  // 해소되므로 결함이 아니다. **가운데로 굴려도 여전히 가려지는 것만** 진짜로
  // 못 누르는 것이다.
  const candidates = [];
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (r.bottom <= 0 || r.top >= VH || r.right <= 0 || r.left >= VW) continue;

    const collapsed = collapsedAncestor(el);
    if (collapsed) {
      // 접힌 패널 안이면 "가려짐"이 아니다. 다만 `inert` 가 없으면 키보드로
      // 안 보이는 컨트롤에 포커스가 들어간다 — 그건 별도 결함으로 신고한다.
      if (!el.closest('[inert]')) {
        out.hidden.push({
          control: label(el),
          panel: label(collapsed),
        });
      }
      continue;
    }

    // 중심만 본다. 모서리 3px 은 형제 버튼과의 라운딩에 걸려 오탐만 낸다
    // (스티키 CTA 의 두 버튼이 서로를 "가린다"고 나왔다).
    if (!blockerFor(el)) continue;
    candidates.push(el);
  }

  // 2단 — 가운데로 굴려서 재판정.
  const restore = window.scrollY;
  for (const el of candidates) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const blocker = blockerFor(el);
    if (!blocker) continue; // 굴리니 열렸다 = 그냥 스크롤이었다
    const r = el.getBoundingClientRect();
    out.tap.push({
      control: label(el),
      blocker: label(blocker),
      blockerZ: getComputedStyle(blocker).zIndex,
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom) },
    });
  }
  window.scrollTo(0, restore);

  // --- 2) CLIP — 뺐다. -----------------------------------------------------
  // "글자가 잘렸나"를 기계로 묻는 건 이 하니스가 감당할 수 있는 질문이 아니었다.
  // ① `scrollWidth > clientWidth` 로 재면 **일부러 넘치게 만든 장식**을 자르는
  //    `overflow:hidden`(Ken Burns 1.04배 히어로, `absolute inset-0` 그라데이션)이
  //    전부 걸린다 — 히어로 4곳이 그렇게 오탐으로 나왔다.
  // ② 그래서 "글자 잎이 상자 밖으로 나갔나"로 바꿨더니 이번엔 **접힌 아코디언**이
  //    97건 나왔다. 닫힌 패널의 내용이 상자 밖에 있는 건 접힘의 정의 그 자체다.
  // 두 판 다 진짜 결함은 0건이었다. 늑대소년을 만들 바엔 안 재는 게 낫다.

  // --- 4) DEAD ------------------------------------------------------------
  for (const a of document.querySelectorAll('a')) {
    if (!visible(a)) continue;
    const href = a.getAttribute('href');
    const r = a.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (href === null || href === '' || href === '#') {
      out.dead.push({ control: label(a), href: String(href) });
    }
  }

  return {
    ...out,
    xscroll: document.documentElement.scrollWidth > VW + 1
      ? { docW: document.documentElement.scrollWidth, vw: VW }
      : null,
  };
};

/**
 * 손님이 실제로 닿는 공개 표면. admin/merchant/mockup/test 는 제외한다.
 * `SURFACES=home,cart` 로 일부만 돌릴 수 있다.
 */
const ALL_SURFACES = [
  ['home', '/', '[data-home-hero]'],
  ['tours-list', '/tours/list', 'body'],
  ['tours-small-group', '/tours/small-group', 'body'],
  ['search', '/search', 'body'],
  ['match', '/match', 'body'],
  ['hub-jeju', '/jeju', 'body'],
  ['hub-seoul', '/seoul', 'body'],
  ['hub-busan', '/busan', 'body'],
  ['cart', '/cart', 'body'],
  ['checkout', '/checkout', 'body'],
  ['mypage', '/mypage', 'body'],
  ['signin', '/signin', 'body'],
  ['signup', '/signup', 'body'],
  ['forgot-password', '/forgot-password', 'body'],
  ['about', '/about', 'body'],
  ['contact', '/contact', 'body'],
  ['support', '/support', 'body'],
  ['reviews', '/reviews', 'body'],
  ['for-agents', '/for-agents', 'body'],
  ['legal', '/legal', 'body'],
  ['terms', '/terms', 'body'],
  ['privacy', '/privacy', 'body'],
  ['cookies', '/cookies', 'body'],
  ['refund-policy', '/refund-policy', 'body'],
  ['dsa', '/dsa', 'body'],
];

const only = (process.env.SURFACES ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const VIEWPORTS = [
  ['mobile', 390, 844, true],
  ['desktop', 1280, 900, false],
];

/** 로케일. 한국어는 라벨 길이가 달라 레이아웃이 다르게 깨진다 — 중립 브라우저는 회귀를 숨긴다. */
const LOCALES = (process.env.LOCALES ?? 'en-US').split(',').map((s) => s.trim()).filter(Boolean);
const localePrefix = (loc) => (loc.startsWith('ko') ? '/ko' : '');

const browser = await chromium.launch();
const all = [];

/**
 * 상세 페이지 슬러그는 하드코딩하지 않는다 — 카탈로그가 바뀌면 조용히 404 를
 * 재게 된다. 목록에서 실제 링크를 뽑아 앞 두 개를 표면으로 추가한다.
 */
async function discoverTourSlugs() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + '/tours/list', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForSelector('a[href*="/tour-product/"]', { timeout: 120000 });
    await page.waitForTimeout(1500);
    return await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('a[href*="/tour-product/"]')]
        .map((a) => (a.getAttribute('href') || '').split('?')[0])
        .filter((h) => h.split('/').filter(Boolean).length === 2))].slice(0, 2),
    );
  } catch {
    return [];
  } finally {
    await ctx.close();
  }
}

const slugs = only.length ? [] : await discoverTourSlugs();
const SURFACES = [
  ...ALL_SURFACES,
  ...slugs.map((href, i) => [`tour-detail-${i + 1}`, href, 'body']),
].filter(([name]) => !only.length || only.includes(name));
console.log(`표면 ${SURFACES.length}개 × 뷰포트 ${VIEWPORTS.length} × 로케일 ${LOCALES.length}`);
if (slugs.length) console.log(`  상세 슬러그 자동 발견: ${slugs.join(' , ')}`);

for (const locale of LOCALES)
for (const [vpName, w, h, mobile] of VIEWPORTS) {
  for (const [rawName, rawUrl, ready] of SURFACES) {
    const name = LOCALES.length > 1 ? `${locale.slice(0, 2)}:${rawName}` : rawName;
    const url = localePrefix(locale) + rawUrl;
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      isMobile: mobile,
      hasTouch: mobile,
      locale,
    });
    // 웰컴 쿠폰 팝업을 미리 재운다 (`lib/welcome-coupon/config.ts`). 안 그러면
    // 스윕 도중 떠서 뒤에 있는 모든 컨트롤을 "가려짐"으로 만든다 — 정상 동작이지
    // 결함이 아니다. 팝업 자체를 보려면 이 줄을 지우고 따로 돌려라.
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('atoc_welcome_claimed', '1');
      } catch {
        /* ignore */
      }
    });
    const page = await ctx.newPage();
    const key = `${vpName}/${name}`;
    try {
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForSelector(ready, { timeout: 120000 });
      await page.addStyleTag({ content: 'nextjs-portal{display:none !important}' });
      await page.waitForTimeout(2500);

      const docH = await page.evaluate(() => document.documentElement.scrollHeight);
      const stops = [];
      for (let y = 0; y < docH; y += Math.round(h * 0.75)) stops.push(y);

      const seen = new Set();
      const findings = { tap: [], clip: [], dead: [], hidden: [], xscroll: null };
      for (const y of stops) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(500);
        const r = await page.evaluate(PROBE);
        if (r.xscroll) findings.xscroll = r.xscroll;
        for (const kind of ['tap', 'clip', 'dead', 'hidden']) {
          for (const f of r[kind]) {
            const id = kind + '|' + (f.control ?? f.el) + '|' + (f.blocker ?? f.href ?? f.panel ?? '');
            if (seen.has(id)) continue;
            seen.add(id);
            findings[kind].push({ ...f, scrollY: y });
          }
        }
      }
      all.push({ surface: key, ...findings });
    } catch (error) {
      all.push({ surface: key, error: String(error).slice(0, 130) });
    } finally {
      await ctx.close();
    }
  }
}
await browser.close();

let bad = 0;
for (const r of all) {
  if (r.error) {
    console.log(`ERR   ${r.surface}: ${r.error}`);
    bad += 1;
    continue;
  }
  const n = r.tap.length + r.clip.length + r.dead.length + r.hidden.length + (r.xscroll ? 1 : 0);
  if (!n) {
    console.log(`ok    ${r.surface}`);
    continue;
  }
  bad += n;
  console.log(`\n🔴 ${r.surface}`);
  for (const f of r.tap) {
    console.log(
      `   TAP    ${f.control}  가운데로 굴려도 가려짐` +
        `  ← ${f.blocker}(z${f.blockerZ})  @scrollY ${f.scrollY} top ${f.rect.top}`,
    );
  }
  for (const f of r.clip) {
    console.log(
      `   CLIP   ${f.el}  글자 넘침 x${f.overflowX}/y${f.overflowY}px  "${f.text}"  ← ${f.clippedBy}  @scrollY ${f.scrollY}`,
    );
  }
  for (const f of r.dead) console.log(`   DEAD   ${f.control}  href=${f.href}`);
  for (const f of r.hidden)
    console.log(`   HIDDEN ${f.control}  접힌 패널 안인데 inert 가 없다 — 키보드가 안 보이는 컨트롤에 들어간다  ← ${f.panel}`);
  if (r.xscroll) console.log(`   XSCROLL 문서 ${r.xscroll.docW}px > 뷰포트 ${r.xscroll.vw}px`);
}
console.log(`\n${bad === 0 ? 'PASS' : `FAIL — ${bad}건`}   표면 ${all.length}개`);
