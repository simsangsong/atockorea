/**
 * 손님 안내 보내기 (가이드) — wa.me/mailto 원버튼 프리필.
 * bulk-message GET을 가이드 토큰 + mint=1로 부르고, 서버가 렌더한 본문을
 * 그대로 딥링크에 싣는다는 계약을 고정한다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GuideAnnouncePanel from '@/components/tour-mode/staff/GuideAnnouncePanel';

const RECIPIENTS = [
  {
    bookingId: 'b1',
    guestName: 'Massimo',
    locale: 'en',
    subject: '[AtoC Korea] Jeju — pickup',
    body: 'Hi Massimo!\nPickup 08:00 — Lotte Hotel\nhttps://atockorea.com/tour-mode/room/b1?rt=tok1',
    missing: [],
    email: 'massimo@example.com',
    phone: '+39 333 111 2222',
    whatsapp: null,
  },
  {
    bookingId: 'b2',
    guestName: '田中',
    locale: 'ja',
    subject: null,
    body: 'こんにちは',
    missing: ['{roomLink}'],
    email: null,
    phone: null,
    whatsapp: '821012345678',
  },
];

function mockAnnounce() {
  const urls: string[] = [];
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input);
    urls.push(url);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tourTitle: 'Jeju', forecast: null, recipients: RECIPIENTS }),
    } as Response);
  }) as unknown as typeof fetch;
  return urls;
}

describe('GuideAnnouncePanel', () => {
  it('fetches with the guide token + mint=1 and prefills wa.me / mailto per recipient', async () => {
    const urls = mockAnnounce();
    render(<GuideAnnouncePanel token="gtok" tourId="t1" tourDate="2026-07-28" />);
    await waitFor(() => expect(screen.getAllByTestId('announce-recipient')).toHaveLength(2));

    expect(urls[0]).toContain('/api/admin/tour-ops/manifest/bulk-message?');
    expect(urls[0]).toContain('rt=gtok');
    expect(urls[0]).toContain('mint=1');
    expect(urls[0]).toContain('tourId=t1');
    expect(urls[0]).toContain('date=2026-07-28');

    // b1: phone digits → wa.me with the server-rendered body URL-encoded.
    // (b2 carries an OTA whatsapp number, so BOTH rows render the button.)
    const waButtons = screen.getAllByTestId('announce-wa') as HTMLAnchorElement[];
    expect(waButtons).toHaveLength(2);
    expect(waButtons[0].href).toContain('https://wa.me/393331112222?text=');
    expect(waButtons[0].href).toContain(encodeURIComponent('Pickup 08:00'));
    expect(waButtons[1].href).toContain('https://wa.me/821012345678?text=');

    const mail = screen.getByTestId('announce-mail') as HTMLAnchorElement;
    expect(mail.href).toContain('mailto:massimo@example.com?');
    expect(mail.href).toContain(encodeURIComponent('[AtoC Korea] Jeju — pickup'));
    expect(mail.href).not.toContain('+'); // spaces must be %20, not '+'

    // b2: no email → 메일 없음 placeholder; missing vars → badge.
    expect(screen.getByText('메일 없음')).toBeInTheDocument();
    expect(screen.getByTestId('announce-missing')).toBeInTheDocument();
  });

  it('re-fetches when the preset chip changes', async () => {
    const urls = mockAnnounce();
    render(<GuideAnnouncePanel token="gtok" tourId="t1" tourDate="2026-07-28" />);
    await waitFor(() => expect(screen.getAllByTestId('announce-recipient')).toHaveLength(2));
    fireEvent.click(screen.getByTestId('announce-preset-room_invite'));
    await waitFor(() => expect(urls.some((u) => u.includes('preset=room_invite'))).toBe(true));
  });
});
