/**
 * X1 / U-D17 — the scanner's own tests.
 *
 * G-b's lesson, applied to itself: a scanner whose pattern has rotted reports
 * zero problems and is indistinguishable from a clean codebase. So the first
 * fixtures here are the defects the PREVIOUS scanner missed — the ops bookings
 * toolbar that collapsed to `투어일 / 기준` and `엑 / 셀` on a real screen while
 * the guard reported 22 clean-looking hits elsewhere.
 */
import { classNamesIn, scanSource } from '@/lib/audit/cjkBreak';

const certain = (src: string) => scanSource('f.tsx', src).filter((h) => h.confidence === 'certain');
const suspect = (src: string) => scanSource('f.tsx', src).filter((h) => h.confidence === 'suspect');

describe('classNamesIn — every className form this repo uses', () => {
  it('reads a plain string', () => {
    expect(classNamesIn('<button className="a b">')).toContain('a b');
  });

  it('🔴 reads a template literal — the old scanner saw none of these', () => {
    expect(classNamesIn('<button className={`tr-label ${x} shrink-0`}>')).toContain('tr-label');
    expect(classNamesIn('<button className={`tr-label ${x} shrink-0`}>')).toContain('shrink-0');
  });

  it('🔴 reads literals inside cn()/clsx()', () => {
    const got = classNamesIn(`<div className={cn("rounded-full px-3", open && 'text-cjk-safe')}>`);
    expect(got).toContain('rounded-full');
    expect(got).toContain('text-cjk-safe');
  });

  it('does not mistake a template hole for a class', () => {
    expect(classNamesIn('<div className={`a ${danger} b`}>')).not.toContain('danger');
  });
});

describe('scanSource — the blind spot that mattered', () => {
  it('🔴 flags a content-sized chip in a wrap row (the G-a defect)', () => {
    // No flex-1, no w-N, no grid — width comes from the content, which is why
    // the width-class heuristic never saw it.
    const src = `<div className="flex flex-wrap gap-2">
      <button className="rounded-full px-3 py-1 text-sm">투어일 기준</button>
    </div>`;
    const hits = certain(src);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ tag: 'button', reason: 'control' });
    expect(hits[0].text).toContain('투어일');
  });

  it('accepts the same chip once it is protected', () => {
    const src = `<button className="rounded-full px-3 py-1 text-cjk-safe">투어일 기준</button>`;
    expect(certain(src)).toHaveLength(0);
  });

  it('accepts nowrap / truncate / line-clamp as protection', () => {
    for (const cls of ['whitespace-nowrap', 'truncate', 'line-clamp-2', 'text-cjk-body']) {
      expect(certain(`<button className="rounded-full px-3 ${cls}">엑셀</button>`)).toHaveLength(0);
    }
  });

  it('🔴 sees Chinese and Japanese, not only Korean', () => {
    expect(certain('<button className="rounded-full px-3">エクセル</button>')).toHaveLength(1);
    expect(certain('<button className="rounded-full px-3">导出表格</button>')).toHaveLength(1);
  });

  it('🔴 finds text more than two lines from the className', () => {
    const src = `<button
        type="button"
        onClick={handle}
        className="rounded-full px-3 py-1"
        data-testid="x"
      >
        엑셀 내려받기
      </button>`;
    expect(certain(src)).toHaveLength(1);
  });

  it('keeps the original width-constrained rule', () => {
    expect(certain('<div className="flex-1 text-sm">준비 전 상태</div>')).toHaveLength(1);
    expect(certain('<span className="w-24">빈민 유형</span>')).toHaveLength(1);
  });

  it('ignores ASCII-only controls', () => {
    expect(certain('<button className="rounded-full px-3">Export CSV</button>')).toHaveLength(0);
  });

  it('ignores unconstrained, unshaped elements — most of the app', () => {
    expect(certain('<div className="mt-4">투어 안내 문구입니다</div>')).toHaveLength(0);
  });

  it('does not descend into capitalised components', () => {
    // <DataTable> renders its own primitives and already carries the class;
    // flagging the call site would be noise the fixer cannot act on.
    expect(certain('<DataTable className="flex-1">투어일</DataTable>')).toHaveLength(0);
  });

  it('handles nesting without swallowing the parent’s siblings', () => {
    const src = `<button className="rounded-full px-3">
        <span className="hidden">아이콘</span>
        엑셀
      </button>
      <button className="rounded-full px-3 text-cjk-safe">안전</button>`;
    const hits = certain(src);
    // The inner span is width-unconstrained and unshaped, so only the outer
    // button reports — and the protected sibling stays quiet.
    expect(hits.map((h) => h.tag)).toEqual(['button']);
  });
});

describe('scanSource — the suspect bucket', () => {
  it('🔴 reports an unprotected control whose label is an expression', () => {
    // Cannot be judged from source. Calling it clean is how a guard earns
    // trust it has not got.
    const hits = suspect('<button className="rounded-full px-3">{preset.label}</button>');
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toContain('preset.label');
  });

  it('does not double-report an element that already has literal CJK', () => {
    const all = scanSource('f.tsx', '<button className="rounded-full px-3">엑셀 {n}건</button>');
    expect(all).toHaveLength(1);
    expect(all[0].confidence).toBe('certain');
  });

  it('stays quiet for a protected expression control', () => {
    expect(suspect('<button className="rounded-full px-3 text-cjk-safe">{x}</button>')).toHaveLength(0);
  });
});

describe('scanSource — labels written as expressions', () => {
  it('🔴 decides a ternary over two string literals (the ops axis toggle)', () => {
    // This is the second half of the G-a defect and it was landing in `suspect`,
    // which is where findings go to be ignored. A ternary over literals is as
    // decidable as a bare literal.
    const src = `<button className="rounded-full px-3">
        {axis === 'tour_date' ? '투어일 기준' : '예약 유입일 기준'}
      </button>`;
    const hits = certain(src);
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toContain('투어일 기준');
  });

  it('reads a template literal child', () => {
    expect(certain('<button className="rounded-full px-3">{`${n}건 선택`}</button>')).toHaveLength(1);
  });

  it('still cannot judge a variable, and says so instead of guessing', () => {
    const hits = scanSource('f.tsx', '<button className="rounded-full px-3">{preset.label}</button>');
    expect(hits).toHaveLength(1);
    expect(hits[0].confidence).toBe('suspect');
  });

  it('is not fooled by an ASCII key inside a call', () => {
    expect(certain(`<button className="rounded-full px-3">{t('export.csv')}</button>`)).toHaveLength(0);
  });
});
