import { extractFormatFingerprint } from '../format-fingerprint'

describe('format-fingerprint', () => {
  describe('spreadsheet detection', () => {
    it('hashes a tab-separated header row', () => {
      const a = extractFormatFingerprint('Name\tPhone\tDate\tPickup\nJohn\t010-1234-5678\t2026-05-26\tHotel')
      expect(a.kind).toBe('spreadsheet')
      expect(a.headerColumns).toEqual(['name', 'phone', 'date', 'pickup'])
    })

    it('produces the same fingerprint for the same shape with different data', () => {
      const a = extractFormatFingerprint('Name\tPhone\tDate\nJohn\t010-1\t2026-05-26')
      const b = extractFormatFingerprint('Name\tPhone\tDate\nJane\t010-9\t2026-05-27')
      expect(a.fingerprint).toBe(b.fingerprint)
    })

    it('treats CSV and TSV differently when columns differ', () => {
      const tsv = extractFormatFingerprint('Name\tPhone\tDate\nJohn\t1\t2')
      const csv = extractFormatFingerprint('Name,Phone,Date,Pickup\nJohn,1,2,3')
      expect(tsv.fingerprint).not.toBe(csv.fingerprint)
    })

    it('falls back to text when first line is mostly numeric (no header)', () => {
      const r = extractFormatFingerprint('123,456,789\n111,222,333')
      expect(r.kind).toBe('text')
    })
  })

  describe('text shape detection', () => {
    it('produces a token-class signature for manual_kr notes', () => {
      const r = extractFormatFingerprint(`김철수 010-1234-5678
hotel grand
2026-05-26 09:00
×2`)
      expect(r.kind).toBe('text')
      expect(r.shapeSignature).toContain('kor')
      expect(r.shapeSignature).toContain('phone')
    })

    it('same shape, different data → same fingerprint', () => {
      const a = extractFormatFingerprint('김철수 010-1234-5678\nhotel a')
      const b = extractFormatFingerprint('이영희 010-9999-1111\nhotel b')
      expect(a.fingerprint).toBe(b.fingerprint)
    })

    it('different shape → different fingerprint', () => {
      const a = extractFormatFingerprint('김철수 010-1234-5678\nhotel a')
      const b = extractFormatFingerprint('hotel a\n김철수 010-1234-5678')
      expect(a.fingerprint).not.toBe(b.fingerprint)
    })
  })
})
