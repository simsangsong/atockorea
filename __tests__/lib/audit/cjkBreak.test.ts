/**
 * X1 / U-D17 — the scanner's own tests.
 *
 * G-b's lesson, applied to itself: a scanner whose pattern has rotted reports
 * zero problems and is indistinguishable from a clean codebase. So the first
 * fixtures here are the defects the PREVIOUS scanner missed — the ops bookings
 * toolbar that collapsed to `투어일 / 기준` and `엑 / 셀` on a real screen while
 * the guard reported 22 clean-looking hits elsewhere.
 */
import { classNamesIn, scanSource, scanBreakAllOnCjk } from '@/lib/audit/cjkBreak';

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

/**
 * 🔴 A descendant's attributes are not this control's label.
 *
 * Measured on the repo: this hole was reporting 135 phantom items — 27 certain
 * and 108 suspect. Not merely noise. The codemod acts on what the scanner
 * points at, so a hit whose "label" is a child's class list sends the fix to
 * the wrong element, and a `.text-cjk-safe` on the wrong element is a nowrap
 * with an ellipsis on something that was meant to wrap.
 */
describe('the scanner reads text positions, not descendant markup', () => {
  it('does not report a child className as the label', () => {
    const src = [
      '<button type="button" onClick={handleLogout}>',
      "  <div className={cn('flex h-10 w-10 shrink-0 items-center', ICON)}>",
      '    <Icon />',
      '  </div>',
      '</button>',
    ].join('\n');
    expect(suspect(src)).toHaveLength(0);
    expect(certain(src)).toHaveLength(0);
  });

  it('does not let a descendant attribute make an ASCII control look Korean', () => {
    // The quieter half of the same hole: an aria-label or title on a CHILD made
    // the parent look like it held CJK text it does not render.
    const src = '<div className="flex-1"><button aria-label="닫기"><Icon /></button></div>';
    const hits = certain(src);
    expect(hits.map((h) => h.tag)).not.toContain('div');
  });

  it('still reports a real expression label on the control itself', () => {
    // The thing this branch exists for must survive the narrowing.
    const src = '<button className="flex-1 px-2">{t("mypage.dashboard.retry")}</button>';
    expect(suspect(src)).toHaveLength(1);
  });

  it('still reports real CJK text inside a control', () => {
    const src = '<button className="flex-1 px-2">저장하기</button>';
    expect(certain(src)).toHaveLength(1);
  });

  it('is not fooled by an arrow function before the label', () => {
    // A naive `/<[^>]*>/` stops at the `>` of `=>`, after which the remaining
    // attributes read as content. The strip walks braces instead.
    const src = '<button onClick={() => setOpen(true)} className="flex-1 px-2">닫기</button>';
    const hits = certain(src);
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toBe('닫기');
  });

  it('reads the label when it is split across children', () => {
    // Narrowing must not go so far that a real label in a <span> is lost.
    const src = '<button className="flex-1 px-2"><span>투어일</span> <span>기준</span></button>';
    expect(certain(src)).not.toHaveLength(0);
  });
});

describe('scanSource — prose is not a label', () => {
  /**
   * The third phantom class, after width-only matching and descendant
   * attributes. A JSX comment is not a tag, so it survived `stripMarkup`, and
   * `directText` then read it twice: as literal children, and as "string
   * literals inside an expression" — because an apostrophe in ordinary English
   * opens what the literal scanner takes for a quoted string.
   *
   * Measured before the fix: 12 certain + 2 suspect hits came entirely from
   * comment text, including a Cockpit <div> reported as holding `대화 전체` — a
   * chip the comment beneath it records as having been REMOVED.
   */
  it('🔴 does not read a JSX comment as the element’s label', () => {
    const src = `<div className="flex-1">
      {/* C3 added a "대화 전체" chip here and C5 removed it again — recorded
          rather than quietly reverted, because it's the reasoning that matters. */}
      <Feed />
    </div>`;
    expect(certain(src)).toHaveLength(0);
  });

  it('still sees real CJK sitting next to a comment', () => {
    const src = `<button className="flex-1 px-2">{/* label below */}저장하기</button>`;
    expect(certain(src)).toHaveLength(1);
  });
});

describe('scanSource — the native bucket', () => {
  /**
   * `<option>`/`<select>` text is drawn by the platform's own widget, which
   * ignores `word-break` and `overflow-wrap`. 82 of them sat in `certain`, where
   * they could neither be fixed nor dismissed — a floor under a number people
   * were asked to drive to zero.
   */
  it('🔴 an <option> is reported, but not as certain', () => {
    const hits = scanSource('f.tsx', '<option className="w-24">확정</option>');
    expect(hits).toHaveLength(1);
    expect(hits[0].confidence).toBe('native');
  });

  it('a <select> holding CJK options is native too', () => {
    const hits = scanSource('f.tsx', '<select className="w-24"><option>대기</option></select>');
    expect(hits.every((h) => h.confidence === 'native')).toBe(true);
  });

  it('does not swallow a real control that merely sits near a select', () => {
    const hits = scanSource('f.tsx', '<div><select className="w-24"><option>대기</option></select><button className="flex-1 px-2">저장</button></div>');
    expect(hits.filter((h) => h.confidence === 'certain').map((h) => h.tag)).toEqual(['button']);
  });
});

describe('scanBreakAllOnCjk — CLAUDE.md rule 2', () => {
  it('catches break-all on CJK', () => {
    expect(scanBreakAllOnCjk('f.tsx', '<span className="break-all">성산일출봉</span>')).toHaveLength(1);
  });

  it('allows break-all on ASCII, which is what it is for', () => {
    expect(scanBreakAllOnCjk('f.tsx', '<span className="break-all">a1b2c3d4e5f6</span>')).toEqual([]);
  });

  it('reads break-all out of a cn() call, not just a plain string', () => {
    expect(
      scanBreakAllOnCjk('f.tsx', "<span className={cn('text-xs', wrap && 'break-all')}>성산일출봉</span>"),
    ).toHaveLength(1);
  });

  it('🔴 does not fire on a comment that merely mentions break-all', () => {
    const src = '<div className="w-24">{/* break-all here would violate 성산일출봉 */}<Icon /></div>';
    expect(scanBreakAllOnCjk('f.tsx', src)).toEqual([]);
  });
});
