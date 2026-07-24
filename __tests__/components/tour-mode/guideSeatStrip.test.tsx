/**
 * 가이드 채팅 좌석 스트립 B1 — AtoC 플랜 §11.B / Q6. 미지정 게스트 회색 칩.
 * 네트워크 0 (fetch mock, channelTopic=null → useSeatChannel no-op).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import GuideSeatStrip from '@/components/tour-mode/guide/GuideSeatStrip';

function mb(id: string, name: string) {
  return {
    id,
    contactName: name,
    contactPhone: null,
    contactEmail: null,
    whatsapp: null,
    partySize: 1,
    preferredLanguage: 'en',
    status: 'confirmed',
    source: 'gyg',
    externalBookingId: null,
    pickupName: null,
    pickupTime: null,
    specialRequests: null,
  };
}

const MANIFEST = {
  tour: { id: 't1', title: 'Jeju', city: 'Jeju' },
  tourDate: '2026-08-17',
  anchorRoomId: 'anchor1',
  channelTopic: null,
  started: false,
  bookings: [mb('b1', 'Massimo C.'), mb('b2', 'Sofia R.'), mb('b3', 'Tanaka Y.')],
  vehicles: [{ roomVehicleId: 'v1', model: 'bus_45', plateNumber: null, totalSeats: 45, layout: null }],
  assignments: [
    { seatNumber: 3, roomVehicleId: 'v1', bookingId: 'b1', guestLabel: null, checkedInAt: null, absentAt: null, locked: false },
    { seatNumber: 4, roomVehicleId: 'v1', bookingId: 'b2', guestLabel: null, checkedInAt: 't', absentAt: null, locked: false },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(MANIFEST) } as Response),
  ) as unknown as typeof fetch;
});

describe('GuideSeatStrip (B1 / Q6)', () => {
  it('renders seat chips and a grey unseated chip, opens the guest card', async () => {
    render(<GuideSeatStrip bookingId="b1" token="gtok" fallbackTitle="Jeju" />);

    await screen.findByTestId('seat-strip');
    const seated = screen.getAllByTestId('seat-chip');
    expect(seated).toHaveLength(2);
    expect(seated[0]).toHaveTextContent('3번 Massimo C.');
    expect(seated[1]).toHaveTextContent('4번 Sofia R.');

    // Q6 — 좌석 미지정 게스트는 "－ 이름" 회색 칩
    const unseated = screen.getByTestId('seat-chip-unseated');
    expect(unseated).toHaveTextContent('Tanaka Y.');

    // chip tap → guest card
    fireEvent.click(seated[0]);
    expect(await screen.findByTestId('guest-card')).toHaveTextContent('Massimo C.');
  });

  it('falls back to the tour title before data loads', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch; // never resolves
    render(<GuideSeatStrip bookingId="b1" token="gtok" fallbackTitle="Jeju Grand Tour" />);
    expect(screen.getByTestId('seat-strip-fallback')).toHaveTextContent('Jeju Grand Tour');
  });
});
