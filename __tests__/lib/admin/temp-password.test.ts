import { generateTempPassword } from '@/lib/admin/temp-password';

describe('generateTempPassword (W3.4 / S-F2)', () => {
  it('meets the complexity Supabase Auth requires', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword();
      expect(pw.length).toBeGreaterThanOrEqual(16);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it('is url-safe in the random core (no +/= padding chars)', () => {
    for (let i = 0; i < 50; i++) {
      const core = generateTempPassword().slice(0, 18);
      expect(core).not.toMatch(/[+/=]/);
    }
  });

  it('produces unique, high-entropy values', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateTempPassword());
    expect(seen.size).toBe(500);
  });
});
