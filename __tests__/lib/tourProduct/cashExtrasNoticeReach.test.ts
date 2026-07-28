/**
 * L2 — the cash line has to reach the guest AFTER they book.
 *
 * L1 put it on the listing. But a guest does not re-read a listing once they
 * have paid; what they open on the day is the confirmation email and the
 * voucher. Both of those are where a guide is about to ask them for money, and
 * both were silent.
 *
 * 🔴 Live shape (2026-07-28): every booking on a charter product came from an
 * OTA — GetYourGuide 3, Klook 2, Viator 1, direct ZERO. So the entire
 * population that can be charged on the day is the population reading OUR
 * email rather than our listing.
 *
 * The invariant these tests hold is one constant, three surfaces, one gate.
 * A second copy of this sentence would drift within a release — this repo has
 * that failure recorded twice — and a second copy of the gate would let the
 * listing promise and the billing condition diverge without anything failing.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CASH_EXTRAS_NOTICE, cashExtrasNoticeFor } from '@/lib/tour-product/cashExtrasNotice';
import { buildInviteEmail } from '@/lib/ops/seating/inviteEmailCopy';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

const BASE = {
  guestName: 'Marta',
  tourTitle: 'Jeju East Charter',
  tourDate: '2026-08-04',
  inviteUrl: 'https://example.com/tour-mode/room/abc?rt=tok',
};

describe('the notice itself', () => {
  it('covers every room locale, so nobody reads it in a language they did not pick', () => {
    for (const locale of ROOM_LOCALES) {
      const line = CASH_EXTRAS_NOTICE[locale];
      expect({ locale, ok: typeof line === 'string' && line.length > 20 }).toEqual({ locale, ok: true });
    }
    expect(Object.keys(CASH_EXTRAS_NOTICE).sort()).toEqual([...ROOM_LOCALES].sort());
  });

  it('says all three things in every locale: optional, cash, on the day', () => {
    // Checked as distinct translations rather than as substrings of English —
    // the failure this guards is a locale added by copying the English row.
    const english = CASH_EXTRAS_NOTICE.en;
    for (const locale of ROOM_LOCALES) {
      if (locale === 'en') continue;
      expect({ locale, sameAsEnglish: CASH_EXTRAS_NOTICE[locale] === english }).toEqual({
        locale,
        sameAsEnglish: false,
      });
    }
  });

  it('is gated on the condition that actually bills, not on a copy of it', () => {
    expect(cashExtrasNoticeFor('vehicle', 'de')).toBe(CASH_EXTRAS_NOTICE.de);
    expect(cashExtrasNoticeFor('per_person', 'de')).toBeNull();
    expect(cashExtrasNoticeFor(null, 'de')).toBeNull();
    expect(cashExtrasNoticeFor(undefined, 'de')).toBeNull();

    // The gate lives in one comparison, and the listing renderer plus both
    // post-booking surfaces reach it through this function. If extras are ever
    // opened to per-person tours, this line is the change — no caller repeats
    // the condition, so none of them can be forgotten.
    const src = readFileSync(path.join(process.cwd(), 'lib/tour-product/cashExtrasNotice.ts'), 'utf8');
    const comparisons = src
      .split(/\r?\n/)
      .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
      .join('\n')
      .match(/(?:!==|===)\s*'vehicle'/g);
    expect(comparisons).toHaveLength(1);

    for (const caller of [
      'lib/ops/seating/inviteEmailCopy.ts',
      'app/api/bookings/[id]/receipt/route.ts',
    ]) {
      const callerSrc = readFileSync(path.join(process.cwd(), caller), 'utf8');
      expect({ caller, restatesGate: /(?:!==|===)\s*'vehicle'/.test(callerSrc) }).toEqual({
        caller,
        restatesGate: false,
      });
    }
  });
});

describe('confirmation email', () => {
  it('carries the line for a charter booking, in the guest locale', () => {
    const de = buildInviteEmail('de', { ...BASE, priceType: 'vehicle' });
    expect(de.text).toContain(CASH_EXTRAS_NOTICE.de);
    expect(de.html).toContain('bar an Ihre Reiseleitung');
    // HTML and text must agree — a guest reading either gets the same promise.
    const ru = buildInviteEmail('ru', { ...BASE, priceType: 'vehicle' });
    expect(ru.text).toContain(CASH_EXTRAS_NOTICE.ru);
    expect(ru.html).toContain('наличными');
  });

  it('says nothing when the product cannot bill on the day', () => {
    const perPerson = buildInviteEmail('en', { ...BASE, priceType: 'per_person' });
    expect(perPerson.text).not.toContain('cash');
    expect(perPerson.html).not.toContain('cash');
  });

  it('stays silent when the caller does not know the price type', () => {
    // Absent is not "probably charter". Telling a per-person guest to bring
    // cash for something that cannot happen is its own kind of wrong.
    const unknown = buildInviteEmail('en', BASE);
    expect(unknown.text).not.toContain('cash');
  });

  it('does not disturb the rest of the mail', () => {
    const withNotice = buildInviteEmail('en', { ...BASE, priceType: 'vehicle' });
    const without = buildInviteEmail('en', BASE);
    for (const mail of [withNotice, without]) {
      expect(mail.subject).toContain('Jeju East Charter');
      expect(mail.text).toContain(BASE.inviteUrl);
      expect(mail.html).toContain(BASE.inviteUrl);
    }
    expect(withNotice.subject).toBe(without.subject);
  });

  it('goes through the same escaper as every other line in the mail', () => {
    const src = readFileSync(path.join(process.cwd(), 'lib/ops/seating/inviteEmailCopy.ts'), 'utf8');
    expect(src).toMatch(/\$\{escapeHtml\(cashNotice\)\}/);
    const mail = buildInviteEmail('fr', { ...BASE, priceType: 'vehicle' });
    expect(mail.html).not.toContain('<script');
  });
});

describe('voucher', () => {
  const src = readFileSync(
    path.join(process.cwd(), 'app/api/bookings/[id]/receipt/route.ts'),
    'utf8',
  );

  it('uses the shared helper rather than its own sentence', () => {
    expect(src).toContain("from '@/lib/tour-product/cashExtrasNotice'");
    expect(src).toContain('cashExtrasNoticeFor(');
    // No hand-written copy of the promise.
    expect(src).not.toMatch(/paid in cash to your guide/);
  });

  it('renders it through the same escaper as every other field', () => {
    expect(src).toMatch(/\$\{escape\(cashNotice\)\}/);
  });

  it('speaks the language the booking recorded', () => {
    expect(src).toContain('normalizeRoomLocale(booking.preferred_language)');
  });
});
