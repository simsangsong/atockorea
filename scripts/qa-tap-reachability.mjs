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
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** 어드민 표면용 세션. 없으면 어드민은 통째로 건너뛴다. */
let fx = null;
try {
  fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
} catch {
  /* 공개 표면만 돈다 */
}

const BASE = process.env.WALK_BASE ?? 'http://localhost:3185';
const OUT = path.join(process.env.SHOT_DIR ?? '.', 'functional-shots');
mkdirSync(OUT, { recursive: true });

const PROBE = async () => {
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

  // 2단 — 가운데로 굴려서 재판정. 그래도 막혀 있으면 **한 박자 쉬고 한 번 더** 본다.
  //
  // 🔴 3단이 필요한 이유: 크로스페이드처럼 **계속 도는 애니메이션**은 전환 도중
  // 두 카드가 같은 자리에 겹친다. 나가는 카드는 아직 opacity 0.08 이라 "보인다"로
  // 잡히고, 들어오는 카드의 그라데이션이 그 위를 덮는다. 실측으로 확인했다 —
  // 그 상태에서도 **손님 눈에 보이는 카드는 3/3 정상으로 클릭돼 이동한다.**
  // 스크롤로 해소되는 겹침을 결함으로 안 세듯, 한 사이클이면 풀리는 겹침도 아니다.
  const restore = window.scrollY;
  for (const el of candidates) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    let blocker = blockerFor(el);
    if (!blocker) continue; // 굴리니 열렸다 = 그냥 스크롤이었다
    await new Promise((r) => setTimeout(r, 1200));
    blocker = blockerFor(el);
    if (!blocker) continue; // 한 박자 뒤 풀렸다 = 전환 중이었다
    if (!visible(el)) continue; // 그 사이 사라졌다(크로스페이드 아웃)
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

/**
 * 어드민. 클라이언트 가드(`decideAdminGuard`)가 Supabase 세션을 보므로 쿠키가
 * 필요하다 — 픽스처가 없으면 통째로 건너뛴다(로그인 화면을 35번 재는 건 무의미).
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts   → scripts/.sim-fixtures.json
 *   npx tsx scripts/sim-tour-day.ts --cleanup          → 끝나면 되돌린다
 * 동적 세그먼트([id]/[period])는 실제 ID 가 필요해 뺐다.
 */
const ADMIN_SURFACES = [
  ['admin-home', '/admin'],
  ['admin-orders', '/admin/orders'],
  ['admin-products', '/admin/products'],
  ['admin-merchants', '/admin/merchants'],
  ['admin-merchants-create', '/admin/merchants/create'],
  ['admin-analytics', '/admin/analytics'],
  ['admin-analytics-product', '/admin/analytics/product'],
  ['admin-analytics-events', '/admin/analytics/product/events'],
  ['admin-analytics-funnels', '/admin/analytics/product/funnels'],
  ['admin-analytics-experiments', '/admin/analytics/product/experiments'],
  ['admin-analytics-retention', '/admin/analytics/product/retention'],
  ['admin-analytics-sessions', '/admin/analytics/product/sessions'],
  ['admin-analytics-health', '/admin/analytics/product/health'],
  ['admin-chatbot-analytics', '/admin/chatbot-analytics'],
  ['admin-cms', '/admin/cms'],
  ['admin-contacts', '/admin/contacts'],
  ['admin-dining-cache', '/admin/dining-cache'],
  ['admin-emails', '/admin/emails'],
  ['admin-external-reviews', '/admin/external-reviews'],
  ['admin-facility-pins', '/admin/facility-pins'],
  ['admin-guide-settlements', '/admin/guide-settlements'],
  ['admin-guides', '/admin/guides'],
  ['admin-inbox', '/admin/inbox'],
  ['admin-match-pois', '/admin/match-pois'],
  ['admin-meeting-photos', '/admin/meeting-photos'],
  ['admin-ops-finance', '/admin/ops-finance'],
  ['admin-ops-finance-filings', '/admin/ops-finance/filings'],
  ['admin-ops-finance-periods', '/admin/ops-finance/periods'],
  ['admin-parse-rules', '/admin/parse-rules'],
  ['admin-pickup-dictionary', '/admin/pickup-dictionary'],
  ['admin-poi-content-locales', '/admin/poi-content-locales'],
  ['admin-poi-videos', '/admin/poi-videos'],
  ['admin-qa-review', '/admin/qa-review'],
  ['admin-settings', '/admin/settings'],
  ['admin-support', '/admin/support'],
  ['admin-tour-mode-spots', '/admin/tour-mode-spots'],
  ['admin-tour-ops', '/admin/tour-ops'],
  ['admin-tour-ops-card-sets', '/admin/tour-ops/card-sets'],
  ['admin-tour-ops-reclaims', '/admin/tour-ops/reclaims'],
  ['admin-travel-matrix', '/admin/travel-matrix'],
  ['admin-upload', '/admin/upload'],
  ['admin-vehicle-layouts', '/admin/vehicle-layouts'],
].map(([name, url]) => [name, url, 'body', true]);

/**
 * 스마트앱(투어모드). 룸/가이드 토큰이 필요해 어드민과 같은 픽스처를 쓴다.
 *
 * 🔴 탭은 **각각 다른 화면**이다. 룸 탭바 4개·가이드 4개를 안 누르면 이 앱의 3/4 를
 * 안 본 것이다. 탭마다 표면을 따로 두고(누르고 나서 잰다) 매번 새로 로드한다 —
 * 한 컨텍스트에서 탭을 연달아 누르는 것보다 느리지만 상태가 안 섞인다.
 */
const tourModeSurfaces = () => {
  if (!fx) return [];
  const roomTab = (n) => `[data-testid="room-tabbar"] button:nth-child(${n})`;
  const guideTab = (n) => `nav button:nth-child(${n})`;
  const ROOM = '[data-testid="room-tabbar"]';
  return [
    ['tm-entry', '/tour-mode', 'body', false, null],
    ['tm-driver', fx.driverUrl ?? '/tour-mode/driver', 'body', false, null],
    ['tm-join', fx.joinUrl, 'body', false, null],
    ['tm-companion', fx.companionUrl, 'body', false, null],
    ['tm-plan', fx.planEditableUrl, 'body', false, null],
    ['tm-room', fx.room1Url, ROOM, false, null],
    ['tm-room-chat', fx.room1Url, ROOM, false, roomTab(2)],
    ['tm-room-today', fx.room1Url, ROOM, false, roomTab(3)],
    ['tm-room-more', fx.room1Url, ROOM, false, roomTab(4)],
    ['tm-room2', fx.room2Url, ROOM, false, null],
    ['tm-guide', fx.guideUrl, 'nav', false, null],
    ['tm-guide-t2', fx.guideUrl, 'nav', false, guideTab(2)],
    ['tm-guide-t3', fx.guideUrl, 'nav', false, guideTab(3)],
    ['tm-guide-t4', fx.guideUrl, 'nav', false, guideTab(4)],
  ];
};

const only = (process.env.SURFACES ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const VIEWPORTS = [
  ['mobile', 390, 844, true],
  ['desktop', 1280, 900, false],
];

/** 로케일. 한국어는 라벨 길이가 달라 레이아웃이 다르게 깨진다 — 중립 브라우저는 회귀를 숨긴다. */
const LOCALES = (process.env.LOCALES ?? 'en-US').split(',').map((s) => s.trim()).filter(Boolean);
/**
 * 🔴 `/tour-mode`·`/admin` 은 **로케일 세그먼트가 없는 라우트다.** `/ko` 를 붙이면
 * 404 를 재게 되고, 404 페이지에는 가려진 버튼이 없으니 스윕이 조용히 초록이 된다.
 * 접두사는 공개 마케팅 경로에만 붙인다. (앱 언어는 룸 토큰이 정하지 브라우저가 아니다.)
 */
const localePrefix = (loc, url) =>
  loc.startsWith('ko') && !/^\/(tour-mode|admin)(\/|$)/.test(url) ? '/ko' : '';

/**
 * 🔴 고정 sleep 이 아니라 **정착**을 기다린다. 단, "안 변한다"만으로는 부족하다.
 *
 * 붙박이 `waitForTimeout` 으로 재면 마운트 중인 화면을 잰다 — `/admin/ops-finance`
 * 가 6초에 41자, 22초엔 494자였다. 그래서 길이가 안 변할 때까지 기다리게 고쳤는데
 * **그것도 틀렸다**: 어드민 셸은 인증을 기다리며 **17자에서 한참 머문다.** 정지한
 * 상태라 "정착"으로 통과했고, 오탐이 3건에서 9건으로 늘었다(매번 다른 표면 —
 * 무작위성이야말로 이게 결함이 아니라 타이밍이라는 증거였다).
 *
 * 그래서 **바닥값**을 같이 요구한다: 안 변하고 **동시에** FLOOR 이상이어야 정착이다.
 * 끝까지 바닥에 못 닿으면 그건 진짜 빈 화면이고, BLANK 가 정당하게 운다.
 */
const SETTLE_FLOOR = 150;
async function waitSettled(page, { max = 25000, step = 700 } = {}) {
  let last = -1;
  let stable = 0;
  const until = Date.now() + max;
  while (Date.now() < until) {
    const len = await page.evaluate(() => document.body.innerText.trim().length).catch(() => -1);
    if (len === last && len >= SETTLE_FLOOR) {
      stable += 1;
      if (stable >= 2) return len;
    } else {
      stable = 0;
    }
    last = len;
    await page.waitForTimeout(step);
  }
  return last;
}

const browser = await chromium.launch();
const all = [];
let adminSkipped = false;

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

/** SCOPE=public|admin|smartapp|all (기본 all). */
const scope = process.env.SCOPE ?? 'all';
const wantPublic = scope === 'all' || scope === 'public';
const wantAdmin = scope === 'all' || scope === 'admin';
const wantSmartApp = scope === 'all' || scope === 'smartapp';

const slugs = only.length || !wantPublic ? [] : await discoverTourSlugs();
/**
 * 🔴 발견이 0건이면 **조용히 2표면이 사라진다.** 실제로 한 번 그랬다: 공개 스윕이
 * 27→25 표면으로 줄어든 채 `PASS 50` 을 찍었고, 줄었다는 사실은 로그 어디에도 없었다.
 * 커버리지가 조용히 깎이는 것이 이 하니스가 거짓말하는 방식이라, 크게 적고 표시한다.
 */
let slugsMissing = false;
if (wantPublic && !only.length && slugs.length === 0) {
  console.log(
    [
      '',
      '🔴 상세 페이지 슬러그를 못 찾았다 — tour-detail 표면 2개가 빠진다.',
      '   /tours/list 가 느리거나 카드가 안 뜬 것이다. dev 서버를 확인하고 다시 돌려라.',
      '',
    ].join('\n'),
  );
  slugsMissing = true;
}
const SURFACES = [
  ...(wantPublic ? ALL_SURFACES : []),
  ...slugs.map((href, i) => [`tour-detail-${i + 1}`, href, 'body']),
  ...(fx && wantAdmin ? ADMIN_SURFACES : []),
  ...(wantSmartApp ? tourModeSurfaces() : []),
].filter(([name]) => !only.length || only.includes(name));
console.log(`표면 ${SURFACES.length}개 × 뷰포트 ${VIEWPORTS.length} × 로케일 ${LOCALES.length}`);
if (slugs.length) console.log(`  상세 슬러그 자동 발견: ${slugs.join(' , ')}`);
console.log(
  fx
    ? `  어드민 ${ADMIN_SURFACES.length}개 포함 (sim 세션)`
    : '  ⚠ 어드민 건너뜀 — ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts',
);

/**
 * 🔴 어드민 프리플라이트. 한 표면만 먼저 찔러 보고 세션이 죽었으면 어드민 블록을
 * **통째로 뺀다.**
 *
 * 왜: sim 어드민 세션은 오래 못 간다. supabase-js 가 세션을 갱신하면 서버가 옛
 * 리프레시 토큰을 폐기하는데, 모든 컨텍스트가 픽스처의 **같은** 세션을 재생하므로
 * 한 번 회전한 뒤엔 전부 `/signin` 으로 튕긴다(실측: 갓 시드한 세션이 7표면까지
 * 통과하고 8번째부터 무너졌다). 그대로 두면 **똑같은 에러 84줄**이 쏟아져 진짜
 * 결함을 덮는다. 한 줄로 줄이고, 할 일을 알려준다.
 *
 * ⚠ 그래서 어드민 스윕은 **시드 직후에** 돌려야 한다. 공개/스마트앱과 한 번에
 * 묶어 돌리면 어드민 차례가 올 때쯤 세션이 이미 죽어 있다.
 */
async function adminSessionAlive() {
  const probe = SURFACES.find(([, , , isAdmin]) => isAdmin);
  if (!probe) return true;
  const res = await measure('preflight', probe[1], probe[2], true, 'desktop', 1280, 900, false, 'en-US', null);
  return !res.error;
}

/**
 * 한 표면 한 번 재기. 결과를 `all` 에 밀어넣지 않고 **돌려준다** — 재시도가
 * 실패분을 버릴 수 있어야 하기 때문이다.
 */
async function measure(name, url, ready, admin, vpName, w, h, mobile, locale, click) {
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
    if (admin && fx) {
      // 세션은 쿠키로 넣는다. 3180자를 넘으면 Supabase 는 `.0`/`.1` 로 쪼개 읽으므로
      // 여기서도 같은 규칙으로 쪼갠다 (qa-chrome-overlap.mjs 와 동일).
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
    const page = await ctx.newPage();
    const key = `${vpName}/${name}`;
    try {
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForSelector(ready, { timeout: 120000 });
      await page.addStyleTag({ content: 'nextjs-portal{display:none !important}' });
      await waitSettled(page);

      // 🔴 어드민은 클라이언트 가드가 늦게 튕긴다. 세션이 죽었는데도 로그인 화면을
      // 조용히 재고 "ok" 를 뱉으면 이 스윕은 0 을 초록으로 읽는 것이다.
      //
      // ⚠ 판정은 **경로만** 본다. 가드가 실패하면 `/signin?redirect=/admin` 으로
      // 밀어내므로(`admin/layout.tsx`) 경로가 곧 답이다. 본문에서 "로그인/비밀번호"
      // 같은 낱말을 찾던 첫 판은 **머천트 생성 폼의 비밀번호 필드**와 리텐션
      // 분석의 지표 이름을 로그인 화면으로 오인해 3표면을 헛짚었다 —
      // 게이트 어휘로 상태를 추측하지 말고 상태 자체를 봐라.
      if (admin) {
        await page.waitForTimeout(1500); // 클라이언트 가드가 튕길 시간
        await waitSettled(page);
        const gate = await page.evaluate(() => ({
          path: location.pathname,
          text: document.body.innerText.trim().length,
        }));
        if (!gate.path.startsWith('/admin')) {
          return { surface: key, error: `어드민 세션 불통 (→ ${gate.path}) — 픽스처 재생성 필요` };
        }
        // 렌더는 됐는데 사실상 빈 화면이면 그건 세션 문제가 아니라 **그 페이지의 결함**이다.
        if (gate.text < 40) {
          return { surface: key, blank: gate.text };
        }
      }

      if (click) {
        const target = page.locator(click).first();
        if (!(await target.count())) {
          return { surface: key, error: `탭 셀렉터가 없다: ${click} — 탭바가 바뀌었나` };
        }
        await target.click({ force: true });
        await page.waitForTimeout(1600);
      }

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
      return { surface: key, ...findings };
    } catch (error) {
      return { surface: key, error: String(error).slice(0, 130) };
    } finally {
      await ctx.close();
    }
}

if (SURFACES.some(([, , , isAdmin]) => isAdmin) && !(await adminSessionAlive())) {
  console.log(
    [
      '',
      '🔴 어드민 세션이 죽었다 — 어드민 표면을 건너뛴다 (초록으로 오해하지 말 것).',
      '   고치는 법: npx tsx scripts/sim-tour-day.ts --cleanup && ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts',
      '   그리고 어드민은 SCOPE=admin 으로 **시드 직후 단독** 실행하라.',
      '',
    ].join('\n'),
  );
  for (let i = SURFACES.length - 1; i >= 0; i -= 1) if (SURFACES[i][3]) SURFACES.splice(i, 1);
  adminSkipped = true;
}

for (const locale of LOCALES)
for (const [vpName, w, h, mobile] of VIEWPORTS) {
  for (const [rawName, rawUrl, ready, admin, click] of SURFACES) {
    const name = LOCALES.length > 1 ? `${locale.slice(0, 2)}:${rawName}` : rawName;
    const url = localePrefix(locale, rawUrl) + rawUrl;
    // dev 서버는 첫 방문에 라우트를 컴파일하고 그 사이 네비게이션이 한 번 튄다
    // ("Execution context was destroyed"). 재시도 한 번이면 warm 이라 통과한다 —
    // 안 그러면 매 스윕마다 무작위 표면 하나가 가짜 ERR 로 뜬다.
    let res;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      res = await measure(name, url, ready, admin, vpName, w, h, mobile, locale, click);
      if (!res.error) break;
    }
    all.push(res);
  }
}
await browser.close();

let bad = 0;
for (const r of all) {
  if (r.blank !== undefined) {
    console.log(`🔴 ${r.surface}
   BLANK  본문 글자 ${r.blank}자 — 사실상 빈 화면`);
    bad += 1;
    continue;
  }
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
// 🔴 어드민을 빼고 통과했다면 그 사실이 PASS 옆에 붙어야 한다. 안 붙이면 이
// 요약 한 줄이 "다 봤다"는 뜻으로 읽힌다 — 스윕이 거짓말하는 가장 흔한 방식이다.
console.log(
  `\n${bad === 0 ? 'PASS' : `FAIL — ${bad}건`}   표면 ${all.length}개` +
    (adminSkipped ? '   ⚠ 어드민 제외 — 이 결과는 어드민을 포함하지 않는다' : '') +
    (slugsMissing ? '   ⚠ tour-detail 2표면 누락' : ''),
);
