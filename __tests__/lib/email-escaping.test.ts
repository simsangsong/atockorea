/**
 * LIB-1 (W3.10): the legacy email templates must HTML-escape user-controlled
 * fields so a malicious tour title / name / company can't inject markup into a
 * transactional email.
 */
const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

describe('email template HTML escaping (LIB-1)', () => {
  beforeAll(() => {
    process.env.RESEND_API_KEY = 'test-key';
  });

  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
  });

  function lastHtml(): string {
    return mockSend.mock.calls[0][0].html as string;
  }

  it('cancellation email escapes tourTitle, customerName and bookingId', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { sendBookingCancellationEmail } = require('@/lib/email');
    await sendBookingCancellationEmail({
      to: 'guest@example.com',
      bookingId: '<img src=x onerror=alert(1)>',
      tourTitle: '<script>steal()</script>',
      bookingDate: '2026-07-01',
      refundEligible: false,
      customerName: '<b>Mallory</b>',
    });
    const html = lastHtml();
    expect(html).not.toContain('<script>steal()</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<b>Mallory</b>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('merchant welcome email escapes companyName, contactPerson and credentials', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { sendMerchantWelcomeEmail } = require('@/lib/email');
    await sendMerchantWelcomeEmail({
      to: 'merchant@example.com',
      companyName: '<script>x</script>',
      contactPerson: '<i>Eve</i>',
      loginEmail: 'a@b.com',
      temporaryPassword: 'p<svg/onload=1>',
      loginUrl: 'https://example.com/login',
    });
    const html = lastHtml();
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<i>Eve</i>');
    expect(html).not.toContain('<svg/onload=1>');
    expect(html).toContain('&lt;script&gt;');
  });
});
