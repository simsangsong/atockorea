/**
 * Guest booking-confirmation email (premium polish 2026-07-18) — subject,
 * summary fields, payment-note variants, conditional sections, escaping.
 */
import { buildBookingConfirmationEmailHtml } from '@/lib/email';

describe('buildBookingConfirmationEmailHtml', () => {
  const base = {
    to: 'guest@example.com',
    bookingId: 'd8e12b1d-3c22-4361-9527-c8ff3d4b7057',
    tourTitle: 'Jeju Grand Highlights Loop Small Group Day Tour',
    bookingDate: '2026-08-17',
    numberOfGuests: 2,
    totalPrice: 144,
    paymentMethod: 'stripe',
    customerName: 'Nicoletta Airoldi',
    tourId: '6d4741e0-5181-47df-8e10-98d714896c26',
    tourImageUrl: 'https://www.atockorea.com/images/tours/example.webp',
  } as const;

  it('renders subject, reference, summary values, and the review link', () => {
    const { subject, html } = buildBookingConfirmationEmailHtml({
      ...base,
      paymentStatus: 'authorized',
    });
    expect(subject).toBe(`Booking Confirmed: ${base.tourTitle}`);
    expect(html).toContain('ATK-D8E12B1D');
    expect(html).toContain('Nicoletta Airoldi');
    expect(html).toContain('$144.00');
    expect(html).toContain('Monday, August 17, 2026');
    expect(html).toContain('/mypage/mybookings');
    expect(html).toContain('/mypage/reviews/write?tourId=');
    expect(html).toContain(base.tourImageUrl);
    // premium shell: ink header + gold accents
    expect(html).toContain('#181511');
    expect(html).toContain('#c9a75c');
  });

  it('payment note follows paymentStatus (authorized vs paid vs pending)', () => {
    expect(buildBookingConfirmationEmailHtml({ ...base, paymentStatus: 'authorized' }).html).toContain(
      'charged automatically at 10:00 AM Korea time',
    );
    expect(buildBookingConfirmationEmailHtml({ ...base, paymentStatus: 'paid' }).html).toContain(
      'Your payment has been completed.',
    );
    expect(buildBookingConfirmationEmailHtml({ ...base }).html).toContain(
      'Your booking is being processed',
    );
  });

  it('pickup row and hero image are conditional', () => {
    const withPickup = buildBookingConfirmationEmailHtml({ ...base, pickupPoint: 'Lotte Hotel Jeju' });
    expect(withPickup.html).toContain('Lotte Hotel Jeju');

    const noHero = buildBookingConfirmationEmailHtml({ ...base, tourImageUrl: undefined });
    expect(noHero.html).not.toContain('object-fit:cover');
  });

  it('escapes hostile input', () => {
    const { html } = buildBookingConfirmationEmailHtml({
      ...base,
      tourTitle: '<script>alert(1)</script>',
      customerName: '<img onerror=x>',
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img onerror');
  });
});
