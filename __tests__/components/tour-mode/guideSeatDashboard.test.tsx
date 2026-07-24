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

function mockManifest(body: unknown, opts: { evidenceStatus?: number; evidenceBody?: unknown } = {}) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ url, method, body: init?.body });
    const reply = (b: unknown, s = 200) => Promise.resolve({ ok: s < 400, status: s, json: () => Promise.resolve(b) } as Response);
    if (url.includes('/manifest') && method === 'GET') return reply(body);
    if (url.includes('/no-show-evidence')) {
      return reply(opts.evidenceBody ?? { ok: true, evidenceId: 'ev-1' }, opts.evidenceStatus ?? 200);
    }
    return reply({ ok: true }); // mutations
  }) as unknown as typeof fetch;
  return calls;
}

/** 좌석판 2번 좌석(배정·미체크인) 탭 → 액션 시트 → [노쇼 처리] → 증거 시트. */
async function openEvidenceSheet(container: HTMLElement) {
  await waitFor(() => expect(container.querySelector('[data-seat="2"]')).toBeInTheDocument());
  fireEvent.click(container.querySelector('[data-seat="2"]')!);
  fireEvent.click(await screen.findByTestId('act-absent'));
  return screen.findByTestId('no-show-evidence-sheet');
}

function attachPhoto() {
  const input = screen.getByTestId('evidence-photo-input') as HTMLInputElement;
  const file = new File(['x'], 'IMG_1.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
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

  it('opens the evidence sheet instead of marking absent directly (D12 friction)', async () => {
    const calls = mockManifest(manifest(PARTIAL));
    const { container } = render(<GuideSeatDashboard token="gtok" bookingId="b1" />);
    await openEvidenceSheet(container);

    // 사진도 GPS 사유도 없으니 제출 불가 — absent는 아직 호출되지 않았다.
    expect(screen.getByTestId('evidence-submit')).toBeDisabled();
    expect(calls.some((c) => c.url.includes('/absent'))).toBe(false);

    // jsdom엔 geolocation이 없다 → 사유 입력이 필수로 열린다.
    expect(screen.getByTestId('evidence-gps-reason')).toBeInTheDocument();
  });

  it('uploads evidence first, then marks absent with the returned evidenceId', async () => {
    const calls = mockManifest(manifest(PARTIAL));
    const { container } = render(<GuideSeatDashboard token="gtok" bookingId="b1" />);
    await openEvidenceSheet(container);

    attachPhoto();
    fireEvent.change(screen.getByTestId('evidence-gps-reason'), { target: { value: '실내 주차장' } });
    await waitFor(() => expect(screen.getByTestId('evidence-submit')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('evidence-submit'));

    await waitFor(() => expect(calls.some((c) => c.url.includes('/absent'))).toBe(true));
    const evidenceCall = calls.find((c) => c.url.includes('/no-show-evidence'));
    expect(evidenceCall?.body).toBeInstanceOf(FormData);
    const absentCall = calls.find((c) => c.url.includes('/absent'));
    expect(JSON.parse(String(absentCall?.body))).toMatchObject({
      action: 'mark',
      seatNumber: 2,
      evidenceId: 'ev-1',
    });
  });

  it('never marks absent when the evidence upload fails', async () => {
    const calls = mockManifest(manifest(PARTIAL), {
      evidenceStatus: 400,
      evidenceBody: { error: 'gps_reason_required', message: '위치를 받지 못했다면 그 이유를 적어주세요.' },
    });
    const { container } = render(<GuideSeatDashboard token="gtok" bookingId="b1" />);
    await openEvidenceSheet(container);

    attachPhoto();
    fireEvent.change(screen.getByTestId('evidence-gps-reason'), { target: { value: '실내 주차장' } });
    fireEvent.click(screen.getByTestId('evidence-submit'));

    await screen.findByTestId('evidence-error');
    expect(calls.some((c) => c.url.includes('/absent'))).toBe(false);
    // 시트는 열린 채로 남아 재시도 가능.
    expect(screen.getByTestId('no-show-evidence-sheet')).toBeInTheDocument();
  });

  it('paints seat borders with the pickup-group colour, keeping state on the fill (§5.4b)', async () => {
    mockManifest(manifest(PARTIAL));
    const { container } = render(<GuideSeatDashboard token="gtok" bookingId="b1" />);
    await waitFor(() => expect(container.querySelector('[data-seat="1"]')).toBeInTheDocument());

    const rectOf = (n: number) => container.querySelector(`[data-seat="${n}"] rect`)!;
    const strokeBefore = rectOf(1).getAttribute('stroke');
    const fillBefore = rectOf(1).getAttribute('fill');

    fireEvent.click(screen.getByTestId('pickup-colors-btn'));
    await screen.findByTestId('pickup-legend');

    // b1 = "Lotte Hotel" 그룹 → 테두리가 그룹색으로 바뀐다.
    const groupStroke = rectOf(1).getAttribute('stroke');
    expect(groupStroke).not.toBe(strokeBefore);
    expect(groupStroke).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // 좌석 1은 체크인 상태 — 채움(=상태)은 절대 그룹색에 밀리지 않는다.
    expect(rectOf(1).getAttribute('fill')).toBe(fillBefore);
    expect(rectOf(1).getAttribute('fill')).toContain('--tr-seat-green');
    // 같은 팀의 미체크인 좌석은 같은 테두리, 다른 채움.
    expect(rectOf(2).getAttribute('stroke')).toBe(groupStroke);
    expect(rectOf(2).getAttribute('fill')).not.toBe(fillBefore);
    // 색맹 대비 번호 배지가 함께 찍힌다.
    expect(container.querySelector('[data-seat="1"]')!.getAttribute('data-accent')).toBe('1');

    // 하이라이트(명단 hover)는 그룹 테두리마저 덮는다 — 일시적 의도가 우선.
    fireEvent.mouseEnter((await screen.findAllByTestId('roster-row'))[0]);
    await waitFor(() => expect(rectOf(1).getAttribute('stroke')).toContain('--tr-seat-hl'));
  });

  it('gives the unassigned pickup bucket no colour and says so in the legend', async () => {
    mockManifest(manifest([...PARTIAL, { seatNumber: 9, roomVehicleId: 'v1', bookingId: 'b2', guestLabel: null, checkedInAt: null, absentAt: null, locked: false }]));
    const { container } = render(<GuideSeatDashboard token="gtok" bookingId="b1" />);
    await waitFor(() => expect(container.querySelector('[data-seat="9"]')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('pickup-colors-btn'));
    await screen.findByTestId('pickup-legend');

    // b2는 픽업 미지정 → 액센트 없음(기존 상태 테두리 그대로).
    expect(container.querySelector('[data-seat="9"]')!.getAttribute('data-accent')).toBeNull();
    const items = screen.getAllByTestId('pickup-legend-item');
    const unassigned = items.find((li) => li.getAttribute('data-pickup-key') === 'unassigned')!;
    expect(unassigned).toHaveTextContent('색 없음');
    expect(unassigned.getAttribute('data-pickup-color')).toBe('');
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
