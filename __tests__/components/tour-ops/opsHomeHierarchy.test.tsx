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
import { cleanup, render, screen } from '@testing-library/react';
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

describe('UX-006 — exactly one thing wins on this screen', () => {
  /**
   * 🔴 The measured defect: eighteen visible controls, not one of them carrying
   * the accent. Every tile was the same white card and every counter the same
   * box, so the operator had to read the whole grid to decide what to do.
   *
   * `qa-uiux-render` judges this by computed background, which only a browser
   * can do. What is pinned here is the contract that survives refactors: one
   * primary exists, it is the hero primitive the render harness recognises, and
   * what it points at follows the day.
   */
  it('renders exactly one primary, using the app hero primitive', () => {
    renderHome();
    const primary = screen.getByTestId('ops-primary');
    // `tr-cta-hero` is what qa-uiux-render counts as a primary; a hand-rolled
    // bg utility silently lost to `.tr-btn-physical`'s background shorthand and
    // measured as transparent.
    expect(primary.className).toMatch(/tr-cta-hero/);
    expect(screen.getAllByTestId('ops-primary')).toHaveLength(1);
  });

  it('points at waiting guests first, and at the morning job otherwise', () => {
    renderHome({ attention: 3 });
    expect(screen.getByTestId('ops-primary')).toHaveTextContent('응대 필요 3건');

    cleanup();
    renderHome({ attention: 0 });
    expect(screen.getByTestId('ops-primary')).toHaveTextContent('오늘 링크 · 배차 시작');
  });

  it('🔴 does not repeat a tile name — the primary is an action, not a duplicate label', () => {
    renderHome({ attention: 0 });
    // The manager tile still exists and still says its own name; the primary
    // must not say the same words, or the screen shows one instruction twice.
    expect(screen.getByTestId('ops-tile-manager')).toHaveTextContent('배정 · 룸 · 링크');
    expect(screen.getByTestId('ops-primary')).not.toHaveTextContent('배정 · 룸 · 링크');
  });

  it('groups the tools instead of presenting ten peers', () => {
    renderHome();
    for (const g of ['today', 'review', 'analysis']) {
      expect(screen.getByTestId(`ops-tile-group-${g}`)).toBeInTheDocument();
    }
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
