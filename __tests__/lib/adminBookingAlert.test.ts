/**
 * Admin new-booking alert (2026-07-18) — stage badges, fields, recipients.
 */
import { buildAdminBookingAlertHtml } from '@/lib/email-templates/admin-booking-alert';

describe('buildAdminBookingAlertHtml', () => {
  const base = {
    bookingId: 'd8e12b1d-3c22-4361-9527-c8ff3d4b7057',
    bookingReference: 'ATC-2026-0817',
    tourTitle: 'Jeju Grand Highlights Loop',
    tourDate: '2026-08-17',
    numberOfGuests: 2,
    totalPrice: 97000,
    customerName: 'Nicoletta Airoldi',
    customerEmail: 'nicoletta@example.com',
    preferredLanguage: 'it',
  };

  it('created stage: 🆕 subject + 결제 대기 badge + follow-up note + admin CTA', () => {
    const { subject, html } = buildAdminBookingAlertHtml({ stage: 'created', ...base });
    expect(subject).toContain('🆕 새 예약 접수');
    expect(subject).toContain('2026-08-17');
    expect(html).toContain('결제 대기');
    expect(html).toContain('팔로업');
    expect(html).toContain('/admin/orders/d8e12b1d');
    expect(html).toContain('₩97,000');
    expect(html).toContain('Nicoletta Airoldi');
    expect(html).toContain('ATC-2026-0817');
  });

  it('paid stage: ✅ subject + 결제 완료 badge; authorized: 💳 홀드', () => {
    expect(buildAdminBookingAlertHtml({ stage: 'paid', ...base }).subject).toContain('✅ 결제 완료');
    expect(buildAdminBookingAlertHtml({ stage: 'authorized', ...base }).html).toContain('카드 홀드');
  });

  it('escapes hostile input and tolerates missing fields', () => {
    const { html } = buildAdminBookingAlertHtml({
      stage: 'created',
      bookingId: 'x'.repeat(36),
      tourTitle: '<script>alert(1)</script>',
      customerName: null,
      totalPrice: null,
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Guest');
  });
});
