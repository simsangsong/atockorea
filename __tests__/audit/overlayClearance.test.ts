/**
 * @jest-environment node
 *
 * 🔴 사이트 셸의 하단 고정 오버레이는 `BottomNav` 를 비켜간다.
 *
 * 왜 테스트인가: 2026-08-07 에 홈 스티키 CTA(`StickyHomeCta`, `bottom-3`, z-40)가
 * `BottomNav`(z-50, 60px + safe-area) 밑에 깔린 채로 라이브였다. 56px 중 49px 가림,
 * 노치 기기에선 **전부** 가림. 사장님이 스크린샷으로 보고할 때까지 아무 게이트도
 * 안 울렸다(PR #738).
 *
 * 왜 아무 게이트도 안 울렸나: `scripts/qa-chrome-overlap.mjs:102` 가 `position:fixed`
 * 요소를 **일부러 건너뛴다**("오버레이는 이 컨테이너 소유가 아니다"). 그 하니스는
 * *스크롤 내용*이 크롬 밑에 남는지만 묻고, **오버레이 대 오버레이**는 아무도 안 봤다.
 *
 * 이 파일은 소스에서 잡을 수 있는 절반이다. 나머지 절반 — 실제 렌더에서 픽셀이
 * 겹치는지 — 는 `scripts/qa-overlay-collisions.mjs` 가 잰다(노치 인셋 포함).
 * 둘 다 필요하다: 소스는 `npm run gate` 안에서 항상 돌지만 계산된 className 을
 * 못 보고, 실렌더는 정확하지만 dev 서버가 있어야 한다.
 *
 * 계약: `SitePageShell(showBottomNav)` 아래 렌더되는 파일이 뷰포트 하단에 고정
 * 오버레이를 놓으면, 모바일 오프셋이 `BottomNav` 높이 이상이어야 한다. 예외는
 * 등록부에 **사유와 함께** 적는다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

/**
 * 🔴 주석을 먼저 지운다. 이 규칙을 설명하는 주석에는 `bottom-3` 같은 반례가
 * 그대로 적혀 있다(바로 위 §왜 테스트인가, 그리고 `StickyHomeCta` 의 헤더 주석).
 * 안 지우면 게이트가 **자기 설명문을 결함으로 신고한다** — 이 레포에서 이미 한 번
 * 밟은 함정이다.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Tailwind 하단 유틸리티만. `bottom-sheet`·`bottom-right` 같은 남의 단어는 거른다. */
const BOTTOM_TOKEN = /(?:^|[\s"'`{(])(?:(sm|md|lg|xl|2xl):)?bottom-(\[[^\]]*\]|\d+(?:\.\d+)?|px|full|auto)/g;

/**
 * 클래스 값을 "뷰포트 바닥에서 몇 px" 로 푼다. 못 풀면 null.
 * `env(safe-area-inset-bottom,…)` 항은 0 으로 친다 — 인셋은 `BottomNav` 도 똑같이
 * 받으므로 둘의 상대 간격에 영향이 없다(그래서 이 비교가 인셋과 무관하게 성립한다).
 */
function toPx(value: string): number | null {
  if (value === 'px') return 1;
  if (value === 'auto' || value === 'full') return null;
  if (/^\d/.test(value)) return parseFloat(value) * 4; // Tailwind 스페이싱 = 0.25rem
  const inner = value.slice(1, -1); // [ … ]
  const expr = inner.replace(/env\([^)]*\)/g, '0px').replace(/_/g, ' ');
  let total = 0;
  let seen = false;
  for (const m of expr.matchAll(/(\d+(?:\.\d+)?)(px|rem)/g)) {
    total += parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1);
    seen = true;
  }
  return seen ? total : null;
}

/**
 * 파일 안에서 반응형 접두사 없는(=모바일에 적용되는) 하단 오프셋들.
 *
 * 문자열 리터럴 단위로 본다. 리터럴에 `absolute` 가 있으면 뷰포트가 아니라 조상
 * 기준이라 나비게이션과 무관하다 — 이걸 안 거르면 카드 안의 그라데이션 오버레이
 * (`absolute inset-x-0 bottom-0`)까지 후보로 끌려온다. 반대로 `fixed` 와 `bottom-*`
 * 이 **다른 리터럴에** 흩어져 있는 경우(cn() 분할·`bottomClass` 변수 조립)는 반드시
 * 잡아야 한다 — 챗봇 FAB 이 정확히 그 모양이고, 한 리터럴 안에서만 찾던 첫 스캐너는
 * 그걸 통째로 못 봤다.
 */
function mobileBottomOffsets(src: string): { raw: string; px: number | null }[] {
  const clean = stripComments(src);
  const out: { raw: string; px: number | null }[] = [];
  for (const lit of clean.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
    const text = lit[1] ?? lit[2] ?? lit[3] ?? '';
    if (/\babsolute\b/.test(text)) continue;
    for (const m of text.matchAll(BOTTOM_TOKEN)) {
      if (m[1]) continue; // sm:/md:/… 는 데스크톱 — BottomNav 는 md:hidden 이다
      out.push({ raw: `bottom-${m[2]}`, px: toPx(m[2]) });
    }
  }
  return out;
}

/**
 * 등록부. `SitePageShell` 아래에서 뷰포트 바닥에 고정 오버레이를 놓는 파일 전부.
 *
 * `clearsWith` = 나비게이션을 비켜가는 **그 클래스를 그대로** 적는다. 파일 안의
 * 아무 `bottom-*` 이나 검사하면 안 된다 — 패널 안쪽 배지(`bottom-1.5`) 같은 무관한
 * 토큰까지 걸려 오탐이 난다(첫 판이 그랬다). 계약을 못 박아 두면 값을 바꿀 때
 * 여기도 같이 고치게 되고, 그 순간이 리뷰 지점이다.
 *
 * `exempt` = 비켜갈 필요가 없는 사유.
 */
const REGISTRY: Record<string, { clearsWith: string } | { exempt: string }> = {
  'components/BottomNav.tsx': { exempt: '이것이 그 크롬이다 — 자기 자신을 비켜갈 수는 없다' },

  'components/home/v2/StickyHomeCta.tsx': {
    clearsWith: 'bottom-[calc(env(safe-area-inset-bottom,0px)+72px)]',
  },
  'components/FloatingLanguageToggle.tsx': {
    clearsWith: 'bottom-[calc(env(safe-area-inset-bottom,0px)+80px)]',
  },
  'components/product-tour-static/_shared/TourProductAiAssistantWidget.tsx': {
    // 이 위젯은 두 배치를 갖는다. 사이트 전역(`placement !== 'tour'`)만 BottomNav 와
    // 같은 화면에 뜬다 — /tour-product 쪽 9.5rem 변형은 showBottomNav={false} 표면이다.
    clearsWith: 'bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))]',
  },

  'components/home/v2/MatcherBottomSheet.tsx': {
    exempt: '바텀시트 — 뷰포트 하단에서 올라와 나비게이션을 덮는 것이 동작 자체다(z-50, 스크림 동반)',
  },
  'src/components/ui/bottom-sheet.tsx': { exempt: '위와 같은 프리미티브' },
  'app/(marketing)/tours/list/ToursListClient.tsx': {
    exempt: '필터 바텀시트 — 열려 있는 동안 나비게이션을 덮는 것이 의도다',
  },
  'app/(marketing)/signup/page.tsx': {
    exempt: 'z-[101] 로 나비게이션(z-50) **위에** 뜬다 — 가려지는 쪽이 아니라 가리는 쪽이다',
  },
  'components/product-tour-static/_shared/TourStopDetailDrawer.tsx': {
    exempt: 'top-0/bottom-0 전높이 사이드 드로어(z-[71]) — 바닥 앵커가 아니라 세로 스트레치다',
  },
};

/** 이 트리들은 `BottomNav` 가 아예 안 뜨거나 다른 셸을 쓴다. */
const OUT_OF_SHELL = [
  'components/tour-mode/',
  'components/tour-ops/',
  'components/admin/',
  'src/components/v0-skin/',
  'app/(app)/',
  'app/admin/',
  'app/(marketing)/admin/',
  'app/(marketing)/merchant/',
  'app/(marketing)/mockup/',
  // /tour-product 는 showBottomNav={false} 로 셸을 부른다 — 아래에서 그 사실을 따로 못박는다.
  'components/product-tour-static/east-signature-nature-core/',
];

function walk(dir: string): string[] {
  const full = path.join(ROOT, dir);
  return readdirSync(full).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.next') return [];
    const rel = `${dir}/${entry}`;
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : rel.endsWith('.tsx') ? [rel] : [];
  });
}

/** 사이트 셸 스코프에서 "뷰포트 하단 고정 오버레이"를 선언한 파일들. */
function candidates(): string[] {
  const files = [...walk('components'), ...walk('src/components'), ...walk('app')];
  return files
    .filter((f) => !OUT_OF_SHELL.some((prefix) => f.startsWith(prefix)))
    .filter((f) => {
      const clean = stripComments(read(f));
      if (!/\bfixed\b/.test(clean)) return false;
      return mobileBottomOffsets(clean).length > 0;
    })
    .sort();
}

/** `BottomNav` 가 실제로 차지하는 높이를 소스에서 뽑는다 — 하드코딩하면 드리프트한다. */
function bottomNavHeightPx(): number {
  const src = read('components/BottomNav.tsx');
  const m = /h-\[(\d+)px\]/.exec(src);
  if (!m) throw new Error('BottomNav 의 h-[Npx] 를 못 찾았다 — 이 게이트의 기준값이 사라졌다');
  return Number(m[1]);
}

describe('🔴 하단 고정 오버레이는 BottomNav 를 비켜간다', () => {
  const NAV_H = bottomNavHeightPx();

  it('전제 — BottomNav 는 여전히 뷰포트 바닥 고정 + md:hidden + safe-area 패딩이다', () => {
    // 이 셋 중 하나라도 바뀌면 아래 계산의 근거가 사라진다. 조용히 틀리느니
    // 여기서 알려준다.
    const src = read('components/BottomNav.tsx');
    expect(src).toMatch(/fixed[^"]*inset-x-0[^"]*bottom-0/);
    expect(src).toContain('md:hidden');
    expect(src).toContain('padding-bottom:env(safe-area-inset-bottom)');
    expect(NAV_H).toBeGreaterThanOrEqual(44); // 터치 타깃보다 작아질 리 없다
  });

  it('전제 — /tour-product 는 showBottomNav={false} 다 (그래서 스코프 밖이다)', () => {
    // 이게 true 로 바뀌면 그 트리의 스티키 예약 바가 즉시 이 계약의 대상이 된다.
    expect(read('app/(marketing)/tour-product/layout.tsx')).toContain('showBottomNav={false}');
  });

  it('스캔이 실제로 뭔가를 본다 — 0건이면 이 게이트는 장식이다', () => {
    expect(candidates().length).toBeGreaterThanOrEqual(5);
  });

  it('주석은 스캔에서 빠진다 — 안 그러면 이 규칙의 설명문이 반례로 잡힌다', () => {
    // 이 레포에서 이미 밟은 함정: 수정을 설명하는 주석에 옛 값이 그대로 적혀 있다.
    const withComment = `/* 예전엔 bottom-3 이었다 */ const a = "fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)]";`;
    expect(mobileBottomOffsets(withComment).map((o) => o.raw)).toEqual([
      'bottom-[calc(env(safe-area-inset-bottom,0px)+72px)]',
    ]);
  });

  it('값 해석기가 실제 표기들을 푼다', () => {
    expect(toPx('3')).toBe(12);
    expect(toPx('5')).toBe(20);
    expect(toPx('[calc(env(safe-area-inset-bottom,0px)+72px)]')).toBe(72);
    expect(toPx('[calc(8.5rem+env(safe-area-inset-bottom,0px))]')).toBe(136);
    expect(toPx('auto')).toBeNull();
  });

  it('🔴 등록된 오버레이는 전부 나비게이션 높이 이상 띄운다', () => {
    const offenders: string[] = [];
    for (const [file, rule] of Object.entries(REGISTRY)) {
      if ('exempt' in rule) continue;
      const clean = stripComments(read(file));
      if (!clean.includes(rule.clearsWith)) {
        offenders.push(
          `${file}\n    등록된 클래스가 소스에 없다: ${rule.clearsWith}\n` +
            `    (실제로 쓰인 모바일 오프셋: ${mobileBottomOffsets(clean).map((o) => o.raw).join(', ') || '없음'})`,
        );
        continue;
      }
      const value = /bottom-(\[[^\]]*\]|[\w.]+)/.exec(rule.clearsWith)![1];
      const px = toPx(value);
      if (px === null || px < NAV_H) {
        offenders.push(`${file}  ${rule.clearsWith} → ${px}px  (BottomNav ${NAV_H}px 밑에 깔린다)`);
      }
    }
    expect(
      offenders.length === 0
        ? ''
        : `\n모바일에서 BottomNav 에 가려지는 오버레이:\n  ${offenders.join('\n  ')}\n` +
            `고치는 법: 모바일 오프셋을 bottom-[calc(env(safe-area-inset-bottom,0px)+NNpx)] 로 주되 NN >= ${NAV_H}.\n` +
            `데스크톱은 md:bottom-* 로 따로 둔다 (BottomNav 는 md:hidden).\n` +
            `값을 바꿨으면 이 파일의 REGISTRY 도 같이 고쳐라 — 그게 리뷰 지점이다.\n`,
    ).toBe('');
  });

  it('🔴 새 하단 오버레이는 등록부를 거쳐야 한다', () => {
    const unregistered = candidates().filter((f) => !(f in REGISTRY));
    expect(
      unregistered.length === 0
        ? ''
        : `\n등록되지 않은 하단 고정 오버레이:\n  ${unregistered.join('\n  ')}\n` +
            `__tests__/audit/overlayClearance.test.ts 의 REGISTRY 에 추가하라 —\n` +
            `나비게이션을 비켜가면 { clears: true }, 덮는 게 의도면 { exempt: '사유' }.\n`,
    ).toBe('');
  });

  it('🔴 실렌더 하니스가 존재하고 npm 으로 부를 수 있다', () => {
    // FA-008 의 교훈: 아무도 안 부르는 하니스는 없는 것과 같다.
    const harness = 'scripts/qa-overlay-collisions.mjs';
    expect(() => read(harness)).not.toThrow();
    const scripts = JSON.parse(read('package.json')).scripts ?? {};
    const entry = Object.values(scripts).find((cmd) => String(cmd).includes(harness));
    expect(entry).toBeDefined();
  });
});
