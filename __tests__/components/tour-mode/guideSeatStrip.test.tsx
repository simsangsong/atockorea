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

/**
 * 🔴 헤더 칩으로 연 카드는 명단에서 연 것과 **같은 카드**인데, 메모를 읽지
 * 않고 열었다. 메모 블록은 조건부가 아니라 항상 렌더되므로 결과는 "메모 없음"이
 * 아니라 **"운영 메모: (비어 있음)"이라는 단언**이었다 — 알레르기나 무릎 같은
 * 것이 적혀 있어도 이 입구로 들어온 가이드에게는 없는 것이 된다.
 * 대시보드 쪽 주석이 이미 "두 곳에서 따로 부르면 반드시 어긋난다"고 경고하고
 * 있었고, 세 번째 표면이 정확히 그렇게 어긋났다.
 */
describe('GuideSeatStrip — 운영 메모 (§K B4-D4)', () => {
  const NOTE = { bookingId: 'b1', note: '무릎이 안 좋아 계단 최소화', updatedByRole: 'guide', updatedByName: null, updatedAt: '2026-08-17T00:00:00Z' };

  function mockWithNotes() {
    global.fetch = jest.fn((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(String(url).includes('/notes') ? { notes: [NOTE] } : MANIFEST),
      } as Response),
    ) as unknown as typeof fetch;
  }

  it('명단과 같은 소스에서 메모를 읽어 카드에 보여준다', async () => {
    mockWithNotes();
    render(<GuideSeatStrip bookingId="b1" token="gtok" fallbackTitle="Jeju" />);
    fireEvent.click((await screen.findAllByTestId('seat-chip'))[0]);
    expect(await screen.findByTestId('guest-card')).toHaveTextContent('무릎이 안 좋아 계단 최소화');
  });

  it('메모 조회 자체를 한다 — 안 부르면 "비어 있음"을 단언하게 된다', async () => {
    mockWithNotes();
    render(<GuideSeatStrip bookingId="b1" token="gtok" fallbackTitle="Jeju" />);
    await screen.findAllByTestId('seat-chip');
    const called = (global.fetch as jest.Mock).mock.calls.some(([u]) => String(u).includes('/notes'));
    expect(called).toBe(true);
  });

  it('메모 조회가 실패해도 좌석 칩은 그대로 뜬다', async () => {
    global.fetch = jest.fn((url: string) =>
      String(url).includes('/notes')
        ? Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response)
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(MANIFEST) } as Response),
    ) as unknown as typeof fetch;
    render(<GuideSeatStrip bookingId="b1" token="gtok" fallbackTitle="Jeju" />);
    expect((await screen.findAllByTestId('seat-chip')).length).toBeGreaterThan(0);
  });
});
