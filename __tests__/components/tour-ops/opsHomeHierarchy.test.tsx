/**
 * I4 — the ops home under I2's rules (U-D18/U-D19), which are two claims worth
 * pinning because a screenshot only shows one of them at a time.
 *
 * G-l, from a real capture: five KPI in five identical white boxes, so SOS
 * carried the same visual weight as "rooms today". Only the number changed
 * colour — and a number is what you read AFTER something has caught your eye.
 * Risk has to look like risk.
 *
 * G-m: two of the ten tiles led to destinations that are permanently one tap
 * away on the bottom bar. A tile that duplicates a tab does not add a place to
 * go; it adds something to read on the way past.
 *
 * The colour rule is deliberately narrow (U-D19): danger, attention, neutral.
 * Nothing here is decoration — a dashboard that is red all the time is a
 * dashboard nobody looks at.
 */
import { render, screen } from '@testing-library/react';
import OpsHomeTab from '@/components/tour-ops/OpsHomeTab';
import type { OpsRoom, SosInfo } from '@/components/tour-ops/opsShared';
import type { AttentionItem } from '@/lib/tour-ops/attention';

function renderHome(over: { sos?: number; attention?: number } = {}) {
  const sosRooms = new Map<string, SosInfo>();
  for (let i = 0; i < (over.sos ?? 0); i += 1) {
    sosRooms.set(`room-${i}`, { metadata: {}, created_at: new Date().toISOString() } as unknown as SosInfo);
  }
  const attention: AttentionItem[] = Array.from({ length: over.attention ?? 0 }, (_, i) => ({
    roomId: `room-${i}`,
    bookingId: `bk-${i}`,
    title: 'x',
    reason: 'unanswered',
  })) as unknown as AttentionItem[];

  return render(
    <OpsHomeTab
      rooms={[] as OpsRoom[]}
      sosRooms={sosRooms}
      attention={attention}
      unreadTotal={0}
      onNavigate={() => {}}
      onOpenManager={() => {}}
      onOpenInbox={() => {}}
    />,
  );
}

describe('I4 — ops home hierarchy (U-D19)', () => {
  it('🔴 a live SOS makes its KPI look different, not just count differently', () => {
    renderHome({ sos: 2 });
    expect(screen.getByTestId('ops-kpi-SOS')).toHaveAttribute('data-kpi-tone', 'red');
  });

  it('🔴 and it goes back to neutral at zero — a permanently red board is ignored', () => {
    renderHome({ sos: 0 });
    expect(screen.getByTestId('ops-kpi-SOS')).toHaveAttribute('data-kpi-tone', 'none');
  });

  it('응대 필요 gets attention weight, not danger weight', () => {
    renderHome({ attention: 3 });
    expect(screen.getByTestId('ops-kpi-응대 필요')).toHaveAttribute('data-kpi-tone', 'amber');
  });

  it('the ordinary counters stay neutral even when non-zero', () => {
    // "Rooms today" being 12 is not news. Only the two that mean someone has to
    // act are allowed to shout.
    renderHome({ sos: 1, attention: 1 });
    expect(screen.getByTestId('ops-kpi-오늘 룸')).toHaveAttribute('data-kpi-tone', 'none');
    expect(screen.getByTestId('ops-kpi-LIVE')).toHaveAttribute('data-kpi-tone', 'none');
  });
});

describe('I4 — the tab bar wins (U-D24)', () => {
  it('🔴 no tile duplicates a bottom tab', () => {
    renderHome();
    // dashboard and map are permanent tabs; as tiles they were something extra
    // to read on the way to the same place.
    expect(screen.queryByTestId('ops-tile-monitor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ops-tile-map')).not.toBeInTheDocument();
  });

  it('every tile that is NOT a tab survived — this removed duplicates, not features', () => {
    renderHome();
    for (const key of ['manager', 'inbox', 'review', 'messaging', 'autopilot', 'room-history', 'schedule']) {
      expect(screen.getByTestId(`ops-tile-${key}`)).toBeInTheDocument();
    }
  });
});
