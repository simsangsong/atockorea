import { AVATAR_PALETTE, avatarColorFor, avatarColorIndex, avatarInitial } from '@/lib/tour-room/avatarColor';

describe('avatarColorIndex', () => {
  it('is deterministic and in palette range', () => {
    for (const seed of ['Alice', '김민준', '佐藤', 'José', '王小明', '']) {
      const index = avatarColorIndex(seed);
      expect(index).toBe(avatarColorIndex(seed));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(AVATAR_PALETTE.length);
    }
  });

  it('spreads different names across the palette', () => {
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy'];
    const distinct = new Set(names.map((n) => avatarColorIndex(n)));
    expect(distinct.size).toBeGreaterThan(2);
  });

  it('returns a bg/ink pair', () => {
    const color = avatarColorFor('Alice');
    expect(color.bg).toMatch(/^#/);
    expect(color.ink).toMatch(/^#/);
  });
});

describe('avatarInitial', () => {
  it('uppercases the first visible character', () => {
    expect(avatarInitial('alice')).toBe('A');
    expect(avatarInitial('  bob')).toBe('B');
    expect(avatarInitial('김민준')).toBe('김');
  });

  it('falls back to ? when empty', () => {
    expect(avatarInitial('')).toBe('?');
    expect(avatarInitial(null)).toBe('?');
    expect(avatarInitial(undefined)).toBe('?');
  });
});
