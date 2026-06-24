import {
  validateLocalePayloads,
  KNOWN_LOCALES,
  MAX_CONTENT_PAYLOAD_BYTES,
} from '@/lib/admin/content-generate-guard';

describe('validateLocalePayloads (W3.7 / AR-1)', () => {
  it('accepts a known-locale payload', () => {
    const r = validateLocalePayloads({ ko: { title: '제주' }, en: { title: 'Jeju' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.locales).toEqual(['ko', 'en']);
  });

  it('rejects a non-object / empty payload', () => {
    expect(validateLocalePayloads(null).ok).toBe(false);
    expect(validateLocalePayloads([]).ok).toBe(false);
    expect(validateLocalePayloads({}).ok).toBe(false);
  });

  it('rejects unknown locale keys (allowlist)', () => {
    const r = validateLocalePayloads({ ko: {}, klingon: {} });
    expect(r.ok).toBe(false);
  });

  it('rejects more locales than the app supports', () => {
    const payload: Record<string, unknown> = {};
    for (let i = 0; i < KNOWN_LOCALES.length + 1; i++) payload[`x${i}`] = {};
    expect(validateLocalePayloads(payload).ok).toBe(false);
  });

  it('rejects an oversized payload', () => {
    const big = 'a'.repeat(MAX_CONTENT_PAYLOAD_BYTES + 1);
    expect(validateLocalePayloads({ ko: { blob: big } }).ok).toBe(false);
  });
});
