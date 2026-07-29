/**
 * @jest-environment node
 *
 * SG-2 — the firing derivation and the departed window math.
 *
 * The v1.1 P0 under permanent guard here: activeNotice nulls at exactly
 * T+GRACE, so the firing derivation must SURVIVE past it (width > 0), know
 * the same promotion/cancel rules, and refuse a backdated notice — the
 * 2차 P0's client half (the server re-derives independently).
 */
import {
  RALLY_FIRE_WINDOW_MS,
  RALLY_GRACE_MS,
  activeNotice,
  rallyResolution,
} from '@/lib/tour-room/notices';
import { departedPhaseAllowed } from '@/lib/tour-room/rallyCrossing';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const TOUR_DATE = '2026-07-28';
const TARGET = Date.UTC(2026, 6, 28, 3, 0, 0); // 12:00 KST
const MIN = 60_000;

const notice = (metadata: Record<string, unknown>, createdAtMs: number, id = 'n1'): RoomMessage =>
  ({
    id,
    sender_role: 'system',
    created_at: new Date(createdAtMs).toISOString(),
    source_text: '',
    metadata,
  }) as unknown as RoomMessage;

const timer = (createdAtMs: number, id = 'n1') =>
  notice({ kind: 'free_time_timer', until_time: '12:00' }, createdAtMs, id);

describe('rallyResolution (SG-D6)', () => {
  it('🔴 survives past T+GRACE where activeNotice nulls — the width-zero P0', () => {
    const msgs = [timer(TARGET - 30 * MIN)];
    const at = TARGET + RALLY_GRACE_MS + MIN; // T+16
    expect(activeNotice([...msgs], TOUR_DATE, at)).toBeNull();
    const res = rallyResolution(msgs, TOUR_DATE, at);
    expect(res).toEqual({ noticeId: 'n1', targetMs: TARGET, phase: 'window' });
  });

  it('phases: pending before GRACE, window for FIRE_WINDOW, closed after', () => {
    const msgs = [timer(TARGET - 30 * MIN)];
    expect(rallyResolution(msgs, TOUR_DATE, TARGET + RALLY_GRACE_MS - MIN)?.phase).toBe('pending');
    expect(rallyResolution(msgs, TOUR_DATE, TARGET + RALLY_GRACE_MS)?.phase).toBe('window');
    expect(
      rallyResolution(msgs, TOUR_DATE, TARGET + RALLY_GRACE_MS + RALLY_FIRE_WINDOW_MS)?.phase,
    ).toBe('window');
    expect(
      rallyResolution(msgs, TOUR_DATE, TARGET + RALLY_GRACE_MS + RALLY_FIRE_WINDOW_MS + MIN)?.phase,
    ).toBe('closed');
  });

  it('a cancelled notice never fires', () => {
    const msgs = [
      timer(TARGET - 30 * MIN),
      notice({ kind: 'free_time_timer', cancelled: true }, TARGET - 5 * MIN, 'n2'),
    ];
    expect(rallyResolution(msgs, TOUR_DATE, TARGET + RALLY_GRACE_MS + MIN)).toBeNull();
  });

  it('🔴 a BACKDATED notice never fires — created after its own target', () => {
    // Staff typo at 12:20 announcing "12:00": firing instantly would be the
    // instant-capsule P0.
    const msgs = [timer(TARGET + 20 * MIN)];
    expect(rallyResolution(msgs, TOUR_DATE, TARGET + RALLY_GRACE_MS + MIN)).toBeNull();
  });

  it('shares the bundle promotion rule with activeNotice', () => {
    const msgs = [
      notice({ kind: 'arrival_bundle', meeting_time: '12:00' }, TARGET - 40 * MIN, 'b1'),
    ];
    const res = rallyResolution(msgs, TOUR_DATE, TARGET + RALLY_GRACE_MS + MIN);
    expect(res?.noticeId).toBe('b1');
    // A bundle WITHOUT a meeting time is not a notice at all.
    const photoStop = [notice({ kind: 'arrival_bundle' }, TARGET - 40 * MIN, 'b2')];
    expect(rallyResolution(photoStop, TOUR_DATE, TARGET + RALLY_GRACE_MS + MIN)).toBeNull();
  });
});

describe('departedPhaseAllowed (server window, SG-2b-α)', () => {
  it('auto crossings need GRACE±slack; manual only needs the target passed', () => {
    expect(departedPhaseAllowed(TARGET + RALLY_GRACE_MS, TARGET, false)).toBe(true);
    expect(departedPhaseAllowed(TARGET + 5 * MIN, TARGET, false)).toBe(false);
    expect(departedPhaseAllowed(TARGET + RALLY_GRACE_MS + RALLY_FIRE_WINDOW_MS + 2 * MIN, TARGET, false)).toBe(false);
    expect(departedPhaseAllowed(TARGET + MIN, TARGET, true)).toBe(true);
    expect(departedPhaseAllowed(TARGET - MIN, TARGET, true)).toBe(false);
  });
});
