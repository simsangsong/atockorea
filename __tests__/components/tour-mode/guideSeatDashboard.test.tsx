/**
 * 가이드 명단·체크인 대시보드 §5.4b + 시작 게이트 C-16 — 카운터·그룹핑·양방향
 * 하이라이트·게이트 활성 조건·좌석 액션. 네트워크 0 (fetch mock).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GuideSeatDashboard from '@/components/tour-mode/guide/GuideSeatDashboard';
import { VEHICLE_LAYOUT_SEEDS } from '@/lib/ops/seating/layouts';

function mb(over: { id: string; name: string; party?: number; pickup?: string | null; time?: string | null; needs?: string | null; source?: string }) {
  return {
    id: over.id,
    contactName: over.name,
    contactPhone: null,
    contactEmail: null,
    whatsapp: null,
    partySize: over.party ?? 1,
    preferredLanguage: 'en',
    status: 'confirmed',
    source: over.source ?? 'gyg',
    externalBookingId: null,
    pickupName: over.pickup ?? null,
    pickupTime: over.time ?? null,
    specialRequests: over.needs ?? null,
  };
}

function manifest(assignments: unknown[], started = false) {
  return {
    tour: { id: 't1', title: 'Jeju', city: 'Jeju' },
    tourDate: '2026-08-17',
    anchorRoomId: 'anchor1',
    channelTopic: null,
    started,
    bookings: [
      mb({ id: 'b1', name: 'Massimo C.', party: 2, pickup: 'Lotte Hotel', time: '08:00', needs: 'vegan' }),
      mb({ id: 'b2', name: 'Tanaka Y.', party: 1, source: 'klook' }),
    ],
    vehicles: [{ roomVehicleId: 'v1', model: 'bus_45', plateNumber: '123가', totalSeats: 45, layout: VEHICLE_LAYOUT_SEEDS.bus_45.layout }],
    assignments,
  };
}

const PARTIAL = [
  { seatNumber: 1, roomVehicleId: 'v1', bookingId: 'b1', guestLabel: null, checkedInAt: 't', absentAt: null, locked: false },
  { seatNumber: 2, roomVehicleId: 'v1', bookingId: 'b1', guestLabel: null, checkedInAt: null, absentAt: null, locked: false },
];

function mockManifest(body: unknown) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const reply = (b: unknown, s = 200) => Promise.resolve({ ok: s < 400, status: s, json: () => Promise.resolve(b) } as Response);
    if (url.includes('/manifest') && method === 'GET') return reply(body);
    return reply({ ok: true }); // mutations
  }) as unknown as typeof fetch;
}

describe('GuideSeatDashboard (§5.4b / C-16)', () => {
  it('shows counter bar, pickup grouping and the gate blocked with N unchecked', async () => {
    mockManifest(manifest(PARTIAL));
    render(<GuideSeatDashboard token="gtok" bookingId="b1" />);

    // 총 3명·2팀 | 체크인 1 | 대기 2 | 노쇼 0 (데이터 로드 대기)
    await waitFor(() => expect(screen.getByTestId('count-checkedin')).toHaveTextContent('1'));
    expect(screen.getByTestId('count-waiting')).toHaveTextContent('2');
    expect(screen.getByTestId('count-absent')).toHaveTextContent('0');

    // pickup 그룹 (Lotte + 미지정)
    expect(screen.getAllByTestId('pickup-group').length).toBeGreaterThanOrEqual(2);
    // 특이사항 하이라이트 뱃지
    expect(screen.getAllByTestId('row-highlight').length).toBeGreaterThanOrEqual(1);

    // 게이트 비활성 + "1명 미체크인"
    const gate = screen.getByTestId('start-gate-btn');
    expect(gate).toBeDisabled();
    expect(gate).toHaveTextContent('1명 미체크인');
  });

  it('highlights seat-board seats when a roster row is hovered (bidirectional)', async () => {
    mockManifest(manifest(PARTIAL));
    const { container } = render(<GuideSeatDashboard token="gtok" bookingId="b1" />);
    const rows = await screen.findAllByTestId('roster-row');
    fireEvent.mouseEnter(rows[0]); // b1 → seats 1,2
    await waitFor(() => expect(container.querySelector('[data-seat="1"]')!.getAttribute('class')).toContain('sm-seat--hl'));
    expect(container.querySelector('[data-seat="2"]')!.getAttribute('class')).toContain('sm-seat--hl');
  });

  it('opens the seat action sheet with check-in / no-show on an assigned seat', async () => {
    mockManifest(manifest(PARTIAL));
    const { container } = render(<GuideSeatDashboard token="gtok" bookingId="b1" />);
    await waitFor(() => expect(container.querySelector('[data-seat="2"]')).toBeInTheDocument());
    fireEvent.click(container.querySelector('[data-seat="2"]')!); // assigned, not checked
    await screen.findByTestId('seat-action-sheet');
    expect(screen.getByTestId('act-checkin')).toBeInTheDocument();
    expect(screen.getByTestId('act-absent')).toBeInTheDocument();
  });

  it('enables the gate when every assigned seat is resolved', async () => {
    const resolved = [
      { seatNumber: 1, roomVehicleId: 'v1', bookingId: 'b1', guestLabel: null, checkedInAt: 't', absentAt: null, locked: false },
      { seatNumber: 2, roomVehicleId: 'v1', bookingId: 'b1', guestLabel: null, checkedInAt: null, absentAt: 't', locked: false },
    ];
    mockManifest(manifest(resolved));
    render(<GuideSeatDashboard token="gtok" bookingId="b1" />);
    const gate = await screen.findByTestId('start-gate-btn');
    await waitFor(() => expect(gate).not.toBeDisabled());
    expect(gate).toHaveTextContent('투어 시작');
  });
});
