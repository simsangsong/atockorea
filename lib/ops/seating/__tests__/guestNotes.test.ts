/**
 * §K B4 — 명단 메모 순수부.
 *
 * 이 스위트가 지키는 계약:
 *   1. 메모를 비우면 삭제된다 (운전 중에 되는 동작이어야 한다).
 *   2. 출처(누가·언제)가 절대 사라지지 않는다 — 메모는 사실이 아니라 관찰이다.
 *   3. 손님은 메모를 쓸 수 없다.
 */

import {
  GUEST_NOTE_MAX,
  hasNote,
  noteAttribution,
  noteRoleFor,
  noteSummary,
  normalizeNote,
} from '../guestNotes';

describe('normalizeNote', () => {
  it('앞뒤 공백을 지운다', () => {
    expect(normalizeNote('  무릎이 안 좋으심  ')).toBe('무릎이 안 좋으심');
  });

  it('빈 값은 삭제 의도다 — 지우기 버튼을 따로 만들지 않는다', () => {
    expect(normalizeNote('')).toBeNull();
    expect(normalizeNote('   ')).toBeNull();
    expect(normalizeNote('\n\n')).toBeNull();
  });

  it('문자열이 아니면 null', () => {
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
    expect(normalizeNote(42)).toBeNull();
  });

  it('과한 줄바꿈을 접는다 — 명단 행이 무너지지 않게', () => {
    expect(normalizeNote('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('길이 상한을 넘기지 않는다 (DB CHECK와 같은 값)', () => {
    const long = 'x'.repeat(GUEST_NOTE_MAX + 200);
    expect(normalizeNote(long)).toHaveLength(GUEST_NOTE_MAX);
  });
});

describe('noteSummary — 명단 행은 한 줄이어야 한다', () => {
  it('짧으면 그대로', () => {
    expect(noteSummary('무릎')).toBe('무릎');
  });

  it('길면 말줄임', () => {
    const s = noteSummary('무릎이 안 좋으셔서 계단이 많은 코스는 피해야 합니다', 12);
    expect(s).toHaveLength(12);
    expect(s.endsWith('…')).toBe(true);
  });

  it('줄바꿈을 공백으로 눕힌다 — 행이 두 줄이 되면 명단이 한눈에 안 들어온다', () => {
    expect(noteSummary('첫줄\n둘째줄')).toBe('첫줄 둘째줄');
  });

  it('없으면 빈 문자열', () => {
    expect(noteSummary(null)).toBe('');
    expect(noteSummary('   ')).toBe('');
  });
});

describe('hasNote', () => {
  it('공백만 있는 메모는 메모가 아니다 — 빈 아이콘이 명단에 뜨면 안 된다', () => {
    expect(hasNote('  ')).toBe(false);
    expect(hasNote('')).toBe(false);
    expect(hasNote(null)).toBe(false);
    expect(hasNote('메모')).toBe(true);
  });
});

describe('noteAttribution — 출처는 지우지 않는다', () => {
  const NOW = Date.parse('2026-08-17T03:00:00Z');

  it('이름이 있으면 역할 + 이름', () => {
    expect(
      noteAttribution(
        { updatedByRole: 'guide', updatedByName: '박', updatedAt: '2026-08-17T02:59:30Z' },
        NOW,
      ),
    ).toBe('가이드 박 · 방금');
  });

  it('이름이 없어도 역할은 남는다', () => {
    expect(
      noteAttribution({ updatedByRole: 'driver', updatedByName: null, updatedAt: '2026-08-17T02:00:00Z' }, NOW),
    ).toBe('기사 · 1시간 전');
  });

  it('시간 단위가 자연스럽게 올라간다', () => {
    const at = (iso: string) =>
      noteAttribution({ updatedByRole: 'admin', updatedByName: null, updatedAt: iso }, NOW);
    expect(at('2026-08-17T02:30:00Z')).toBe('운영 · 30분 전');
    expect(at('2026-08-16T03:00:00Z')).toBe('운영 · 1일 전');
  });

  it('메모가 없으면 빈 문자열', () => {
    expect(noteAttribution(null)).toBe('');
  });

  it('시각이 깨져 있어도 역할은 보인다', () => {
    expect(noteAttribution({ updatedByRole: 'guide', updatedByName: '박', updatedAt: 'nonsense' }, NOW)).toBe(
      '가이드 박',
    );
  });
});

describe('noteRoleFor — 🔴 손님은 메모를 쓸 수 없다', () => {
  it('운영자 3역할만 통과', () => {
    expect(noteRoleFor('guide')).toBe('guide');
    expect(noteRoleFor('driver')).toBe('driver');
    expect(noteRoleFor('admin')).toBe('admin');
  });

  it('손님·동행자·미상은 거부', () => {
    expect(noteRoleFor('customer')).toBeNull();
    expect(noteRoleFor('companion')).toBeNull();
    expect(noteRoleFor(null)).toBeNull();
    expect(noteRoleFor('')).toBeNull();
    expect(noteRoleFor('system')).toBeNull();
  });
});
