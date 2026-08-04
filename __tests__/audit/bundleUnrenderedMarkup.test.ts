/**
 * 상설 게이트 — 손님이 읽게 되는 문자열에 **렌더되지 않는 표기**가 있으면 실패.
 *
 * 🔴 왜 있는가: 경주 재코스(2026-08-04)가 `**bold**` 를 마크다운을 읽지 않는
 * 필드 9곳에 넣었고, 손님 화면에 **별표가 그대로 23곳** 찍혔다. 그리고 이 레포의
 * 내부 표기인 🔴 가 손님 문구 5곳에 섞여 나갔다.
 *
 * **tsc 도 jest 도 전부 초록이었다.** 브라우저로 실제 페이지를 눈으로 봐야만
 * 보이는 종류였다. 이 게이트가 그 눈 노릇을 한다.
 *
 * 판정 기준(추측이 아니라 측정): 상품 페이지에서 `**x**` 를 강조로 바꾸는
 * 컴포넌트는 **딱 하나** — `_shared/TourStopDetailDrawer.tsx`
 * ("emphasis instead of rendering literal asterisks") — 이고, 그건
 * itineraryStops 의 highlights / description / whyOnRoute / smartNotes.tip 만 본다.
 * 나머지 필드는 전부 raw 다.
 *
 * 대조군으로 확인했다: busan-top-attractions · pocheon · jeju-eastern 도 `**` 를
 * 쓰지만 **오직 저 세 필드에만** 써서 실렌더 리터럴 별표가 0 이었다. 경주만 달랐다.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BUNDLE_ROOT = path.join(ROOT, 'components', 'product-tour-static');

/** `**x**` 가 강조로 렌더되는 필드. 그 외에는 별표가 그대로 보인다. */
const MARKDOWN_RENDERED_KEYS = new Set(['highlights', 'description', 'whyOnRoute', 'tip']);

/** 이 레포의 내부 표기. 손님 화면에 있을 이유가 없다. */
const STATUS_EMOJI = /[\u{1F534}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{26A0}\u{2705}\u{274C}]/u;

/** 렌더되지 않는 내부 필드 — 변경 로그와 POI 출처 메모. */
const INTERNAL_KEYS = new Set(['_publication', '_poi_meta', '_note']);

type Leak = { file: string; where: string; kind: 'bold' | 'emoji'; sample: string };

function bundleFiles(): string[] {
  if (!fs.existsSync(BUNDLE_ROOT)) return [];
  const out: string[] = [];
  for (const dir of fs.readdirSync(BUNDLE_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_') || dir.name === 'catalog') continue;
    const full = path.join(BUNDLE_ROOT, dir.name);
    for (const f of fs.readdirSync(full)) {
      if (f.endsWith('.json')) out.push(path.join(full, f));
    }
  }
  return out;
}

function leaksIn(doc: unknown, file: string): Leak[] {
  const found: Leak[] = [];
  const walk = (value: unknown, where: string, lastKey: string) => {
    if (typeof value === 'string') {
      if (STATUS_EMOJI.test(value)) {
        found.push({ file, where, kind: 'emoji', sample: value.slice(0, 70) });
      }
      if (/\*\*[^*]+\*\*/.test(value) && !MARKDOWN_RENDERED_KEYS.has(lastKey)) {
        found.push({ file, where, kind: 'bold', sample: value.slice(0, 70) });
      }
      return;
    }
    if (Array.isArray(value)) {
      // 배열은 부모 키를 물려받는다 — `highlights[2]` 는 여전히 `highlights` 다.
      value.forEach((v, i) => walk(v, `${where}[${i}]`, lastKey));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (INTERNAL_KEYS.has(k)) continue;
        walk(v, where ? `${where}.${k}` : k, k);
      }
    }
  };
  walk(doc, '', '');
  return found;
}

describe('🔴 손님 문구에 렌더되지 않는 표기가 없어야 한다', () => {
  const files = bundleFiles();
  const parsed = files.map((f) => ({
    file: path.relative(BUNDLE_ROOT, f).split(path.sep).join('/'),
    doc: JSON.parse(fs.readFileSync(f, 'utf8')) as unknown,
  }));

  it('번들을 실제로 읽었다 (비-공허)', () => {
    // 0 개를 재면서 초록이 되는 게이트를 이 레포에서 여러 번 겪었다.
    expect(parsed.length).toBeGreaterThan(30);
    const bolds = parsed.flatMap(({ doc }) => {
      const out: string[] = [];
      const walk = (v: unknown, lastKey: string) => {
        if (typeof v === 'string') {
          if (/\*\*[^*]+\*\*/.test(v) && MARKDOWN_RENDERED_KEYS.has(lastKey)) out.push(v);
          return;
        }
        if (Array.isArray(v)) return v.forEach((x) => walk(x, lastKey));
        if (v && typeof v === 'object') {
          for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, k);
        }
      };
      walk(doc, '');
      return out;
    });
    // `**` 자체는 이 레포의 정상 관례다. 하나도 못 찾았다면 파서가 죽은 것이다.
    expect(bolds.length).toBeGreaterThan(100);
  });

  /**
   * 🔴 이 게이트를 처음 돌리자 **1,533건 / 약 165파일**이 나왔다 — 경주보다 훨씬
   * 오래된 부채다. 세 가지 모양이었다:
   *   · PLAIN-BOLD          1,045 — raw 필드의 `**x**`
   *   · TRANSLATION-ARROW     318 — `**Walking** → Caminata` 처럼 LLM 번역기가
   *                                 원문→번역을 **표시 문자열에 그대로** 남긴 것
   *   · TRANSLATOR-NOTE       170 — `**注：** … bg-emerald-50/80 …` 번역기 메타노트
   * 뒤 둘은 [[project_tour_product_translation_debt]] (PR #628)가 절반만 걷어낸
   * 바로 그 결함이다. 한 세션에 다 고칠 일이 아니라 **별도 트랙**이다.
   *
   * 그래서 여기선 두 가지만 강제한다:
   *   ① 이번에 정리한 경주는 **하드 0**
   *   ② 전체는 **상한 래칫** — 늘어나면 실패한다. 숫자는 줄어드는 방향으로만.
   * 🔴 이 숫자를 올리지 말 것. 올려야 한다면 그건 새 누수를 넣었다는 뜻이다.
   */
  const BOLD_CEILING = 1533;
  const CLEANED_SLUG_PREFIX = 'from-busan-gyeongju-ancient-capital-day-tour/';

  it('정리한 상품(경주)은 raw 필드 bold 가 0 이다', () => {
    const bad = parsed
      .filter(({ file }) => file.startsWith(CLEANED_SLUG_PREFIX))
      .flatMap(({ file, doc }) => leaksIn(doc, file))
      .filter((l) => l.kind === 'bold')
      .map((l) => `${l.file} → ${l.where}: ${l.sample}`);
    // 경주 6로케일을 실제로 스캔했는지도 같이 확인한다.
    expect(parsed.filter(({ file }) => file.startsWith(CLEANED_SLUG_PREFIX))).toHaveLength(6);
    expect(bad).toEqual([]);
  });

  it('전체 raw 필드 bold 는 상한을 넘지 않는다 (래칫)', () => {
    const total = parsed
      .flatMap(({ file, doc }) => leaksIn(doc, file))
      .filter((l) => l.kind === 'bold').length;
    expect(total).toBeLessThanOrEqual(BOLD_CEILING);
  });

  it('손님 문구에 내부 상태 이모지가 없다', () => {
    const bad = parsed
      .flatMap(({ file, doc }) => leaksIn(doc, file))
      .filter((l) => l.kind === 'emoji')
      .map((l) => `${l.file} → ${l.where}: ${l.sample}`);
    expect(bad).toEqual([]);
  });

  it('뮤테이션 — 검사기가 두 누수를 실제로 잡는다', () => {
    const clean = {
      itineraryStops: [{ highlights: ['**this one renders bold**'], name: 'Plain' }],
      staticQuestions: [{ answer: 'No markup here.' }],
    };
    expect(leaksIn(clean, 'synthetic.json')).toEqual([]);

    // ① 마크다운 안 읽는 필드의 bold — 손님이 별표를 읽는다
    const boldLeak = {
      ...clean,
      staticQuestions: [{ answer: 'The morning is **two places reached by road**.' }],
    };
    const b = leaksIn(boldLeak, 'synthetic.json');
    expect(b).toHaveLength(1);
    expect(b[0].kind).toBe('bold');
    expect(b[0].where).toBe('staticQuestions[0].answer');

    // ② 내부 표기 이모지
    const emojiLeak = {
      ...clean,
      itineraryStops: [{ highlights: ['🔴 **Busan Station means Exit 4**'] }],
    };
    const e = leaksIn(emojiLeak, 'synthetic.json');
    expect(e).toHaveLength(1);
    expect(e[0].kind).toBe('emoji');

    // ③ 내부 필드는 면제된다 — `_publication` 은 변경 로그고 렌더되지 않는다
    expect(leaksIn({ _publication: { note: '🔴 old course was **10.5h**' } }, 'x.json')).toEqual([]);
  });
});
