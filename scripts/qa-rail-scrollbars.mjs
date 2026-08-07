#!/usr/bin/env node
/**
 * qa-rail-scrollbars — 실렌더로 "손님이 가로 레일을 데스크톱에서 스크롤할 수 있는가" 를 잰다.
 *
 * 🔴 왜 실렌더인가: 소스 게이트(`__tests__/audit/railScrollbar.test.ts`)는 클래스 이름만
 * 본다. 계산된 className, 조건부 렌더, 부모가 덧씌운 CSS 는 못 본다. 2026-08-07 에
 * 라이브에서 `/tours/list` 선반이 **1748px** 을 숨긴 채 스크롤바가 꺼져 있었던 것도
 * 소스만으로는 "얼마나 숨겼는지" 를 알 수 없었다.
 *
 * 판정 규칙
 *   데스크톱(마우스, hasTouch=false): 가로로 넘치는 레일은 **스크롤바가 보여야 한다**.
 *       세로 휠은 가로 레일을 안 굴린다(랩 실측). 화살표 버튼도 없다. 그래서 스크롤바가
 *       없으면 마우스 손님은 숨은 카드에 **도달할 방법이 없다**.
 *   모바일(터치, hasTouch=true): 같은 레일에서 스크롤바가 **숨어 있어야 한다**.
 *       스와이프로 닿으므로 바는 화면만 어지럽힌다(프리미엄 톤 유지).
 *
 * 사용법
 *   node scripts/qa-rail-scrollbars.mjs                # http://localhost:3180
 *   node scripts/qa-rail-scrollbars.mjs --base https://www.atockorea.com
 *   node scripts/qa-rail-scrollbars.mjs --paths /tours/list,/
 *
 * exit 0 = 통과 · 1 = 결함 · 2 = 판정 불가(서버 없음 / 페이지 0개) — 조용한 0 금지.
 */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const BASE = (argOf('--base', process.env.BASE || 'http://localhost:3180')).replace(/\/$/, '');
const DEFAULT_PATHS = [
  '/',
  '/tours/list',
  '/tour-product/busan-top-attractions-day-tour',
  '/tour-product/jeju-eastern-unesco-spots-day-tour',
];
const rawPaths = argOf('--paths', '').split(',').filter(Boolean);
// ⚠ Git Bash(MSYS)는 `--paths /,/tours/list` 의 맨 앞 `/` 를 `C:/Program Files/Git/` 로
// 바꿔서 넘긴다. 조용히 "로드 실패" 로 흘려보내지 말고 여기서 잡아 준다.
for (const p of rawPaths) {
  if (!p.startsWith('/') || /^[A-Za-z]:/.test(p)) {
    console.error(
      `잘못된 경로: "${p}" — 사이트 경로는 "/tours/list" 처럼 슬래시로 시작해야 한다.\n` +
        `  (Git Bash 라면 MSYS 경로 변환이다: MSYS_NO_PATHCONV=1 를 앞에 붙이거나 PowerShell 로 실행하라.)`,
    );
    process.exit(2);
  }
}
const PATHS = rawPaths.length ? rawPaths : DEFAULT_PATHS;

/** 넘침이 이 폭 미만이면 무시 — 서브픽셀 반올림. */
const MIN_OVERFLOW = 8;

const PROBE = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue;
    const dx = el.scrollWidth - el.clientWidth;
    if (dx < ${MIN_OVERFLOW}) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) continue;
    const sb = getComputedStyle(el, '::-webkit-scrollbar');
    const h = parseFloat(sb.height);
    out.push({
      cls: String(el.className || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
      dx,
      // 스크롤바가 실제로 그려지는가. 셋 중 하나라도 "끔" 이면 마우스 손님은 못 닿는다.
      firefox: cs.scrollbarWidth,                  // none | thin | auto
      webkitDisplay: sb.display,                   // none | block | …
      webkitHeight: Number.isFinite(h) ? h : null, // 0 도 숨김이다
    });
  }
  return out;
})()`;

const visible = (r) =>
  r.firefox !== 'none' && r.webkitDisplay !== 'none' && r.webkitHeight !== 0;

function fail(msg) {
  console.error(msg);
}

const browser = await chromium.launch();

const contexts = {
  desktop: await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    isMobile: false,
    locale: 'en-US',
  }),
  mobile: await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
    locale: 'en-US',
  }),
};

let judged = 0;
const defects = [];

for (const [mode, ctx] of Object.entries(contexts)) {
  const page = await ctx.newPage();
  for (const p of PATHS) {
    const url = BASE + p;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (err) {
      // 🔴 로드 실패를 그냥 넘기면 "레일 0개 → 통과" 가 된다. 이 레포가 여러 번 밟은
      // 조용한 초록이다(UX-000). 못 읽은 페이지는 결함으로 센다.
      fail(`  ✗ ${mode} ${p} — 로드 실패: ${err.message.split('\n')[0]}`);
      defects.push(`[${p}] ${mode} 로드 실패 — 판정 못 했다: ${err.message.split('\n')[0]}`);
      continue;
    }
    // 지연 마운트 섹션을 깨우려면 페이지를 한 번 훑어야 한다.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 150));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(900);

    const rails = await page.evaluate(PROBE);
    judged += 1;
    console.log(`\n${mode.toUpperCase()} ${p} — 넘치는 레일 ${rails.length}개`);

    // ── 화살표 ────────────────────────────────────────────────────────────
    // 데스크톱에선 눌러서 실제로 움직여야 하고, 터치에선 아예 없어야 한다
    // (`display:none` — 안 그러면 안 보이는 버튼이 탭 순서에 남는다).
    const arrows = page.locator('.rail-arrow');
    const arrowCount = await arrows.count();
    const visibleArrows = [];
    for (let i = 0; i < arrowCount; i += 1) {
      if (await arrows.nth(i).isVisible()) visibleArrows.push(i);
    }
    console.log(`  화살표: DOM ${arrowCount}개 · 보이는 것 ${visibleArrows.length}개`);

    if (mode === 'mobile' && visibleArrows.length > 0) {
      defects.push(`[${p}] 터치에서 화살표가 보인다 (${visibleArrows.length}개)`);
    }

    if (mode === 'desktop' && visibleArrows.length > 0) {
      /*
       * 가장 많이 숨긴 레일의 "다음" 화살표를 눌러 실제로 움직이는지 잰다.
       * 🔴 `element.click()` 로 직접 부른다 — Playwright 의 `.click()` 은 가림/안정성
       * 검사에 걸려 타임아웃 나는데, 그건 이 하니스가 묻는 질문이 아니다(가림은
       * `qa-tap-reachability` 담당). 여기서 묻는 건 "핸들러가 레일을 굴리는가" 다.
       * 그리고 실패를 `.catch(()=>{})` 로 삼키면 조용한 초록이 된다.
       */
      const result = await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const rails = [...document.querySelectorAll('*')].filter((e) => {
          const cs = getComputedStyle(e);
          return (
            (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
            e.scrollWidth - e.clientWidth > 200 &&
            e.parentElement?.querySelector('.rail-arrow')
          );
        });
        if (!rails.length) return { skipped: 'no rail with arrows over 200px' };
        rails.sort((a, b) => b.scrollWidth - b.clientWidth - (a.scrollWidth - a.clientWidth));
        const rail = rails[0];
        // 마지막 화살표 = "다음" (아직 안 굴렸으면 그것 하나뿐이다).
        const candidates = [...rail.parentElement.querySelectorAll('.rail-arrow')];
        const target = candidates[candidates.length - 1];
        if (!target) return { skipped: 'rail has no arrow sibling' };
        const before = rail.scrollLeft;
        target.click();
        await wait(800);
        return { before, after: rail.scrollLeft, hidden: rail.scrollWidth - rail.clientWidth };
      });
      if (result.skipped) {
        console.log(`  화살표 클릭: 건너뜀 (${result.skipped})`);
      } else {
        const moved = result.after !== result.before;
        console.log(
          `  화살표 클릭: ${result.hidden}px 숨긴 레일에서 scrollLeft ${result.before} → ${result.after} ${moved ? '✓' : '✗'}`,
        );
        if (!moved) {
          defects.push(
            `[${p}] 화살표를 눌러도 레일이 안 움직인다 (scrollLeft ${result.before} → ${result.after})`,
          );
        }
      }
    }

    for (const r of rails) {
      const isVisible = visible(r);
      const wanted = mode === 'desktop';
      const ok = isVisible === wanted;
      const bar = `firefox:${r.firefox} webkit:${r.webkitDisplay}/${r.webkitHeight}`;
      console.log(`  ${ok ? '✓' : '✗'} ${String(r.dx).padStart(5)}px 숨김 | ${bar}\n      ${r.cls}`);
      if (!ok) {
        defects.push(
          mode === 'desktop'
            ? `[${p}] 마우스로 도달 불가 — ${r.dx}px 숨긴 레일에 스크롤바가 없다 (${bar}) :: ${r.cls}`
            : `[${p}] 터치에서 스크롤바가 보인다 (${bar}) :: ${r.cls}`,
        );
      }
    }
  }
}

await browser.close();

if (judged === 0) {
  fail(`\n판정 불가 — ${BASE} 에서 페이지를 한 장도 못 읽었다. dev 서버를 먼저 띄워라.`);
  process.exit(2);
}

if (defects.length) {
  console.error(`\n결함 ${defects.length}건:`);
  for (const d of defects) console.error('  · ' + d);
  process.exit(1);
}

console.log(`\n통과 — ${judged}개 표면에서 가로 레일 스크롤바 계약 성립.`);
process.exit(0);
