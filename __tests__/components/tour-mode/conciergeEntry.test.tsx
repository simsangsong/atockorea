/**
 * A1 — Smart Guide discoverability: the chat-tab entry row and the header
 * first-visit pulse (localStorage-gated), plus the chat render-prop wiring
 * that lets the entry row open the shell-owned concierge sheet.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ConciergeEntryRow from '@/components/tour-mode/ConciergeEntryRow';
import RoomShell from '@/components/tour-mode/RoomShell';
import { CONCIERGE_COPY } from '@/lib/tour-room/concierge';

beforeEach(() => {
  window.localStorage.clear();
});

describe('ConciergeEntryRow', () => {
  it('renders the entry label and opens on tap', () => {
    const onOpen = jest.fn();
    render(<ConciergeEntryRow locale="ko" onOpen={onOpen} />);
    expect(screen.getByTestId('concierge-entry-row')).toHaveTextContent(CONCIERGE_COPY.ko.entryRow);
    fireEvent.click(screen.getByTestId('concierge-entry-row'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('RoomShell concierge discoverability', () => {
  const base = {
    title: 'Busan Signature',
    lifecycle: 'live' as const,
    connection: 'realtime' as const,
    locale: 'ko' as const,
    schedule: [],
    settings: <div>settings-content</div>,
    concierge: <div>concierge-content</div>,
  };

  it('pulses + hints on first visit, retires the pulse and persists after opening', () => {
    render(<RoomShell {...base} chat={<div>chat-content</div>} />);
    // First visit — no seen flag yet.
    expect(screen.getByTestId('concierge-hint')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('concierge-open'));
    // Sheet opens…
    expect(screen.getByText('concierge-content')).toBeInTheDocument();
    // …hint is gone and the device flag is set.
    expect(screen.queryByTestId('concierge-hint')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('tour_mode_concierge_seen')).toBe('1');
  });

  it('does not pulse once the guest has opened it before', () => {
    window.localStorage.setItem('tour_mode_concierge_seen', '1');
    render(<RoomShell {...base} chat={<div>chat-content</div>} />);
    expect(screen.queryByTestId('concierge-hint')).not.toBeInTheDocument();
  });

  it('chat render-prop can open the concierge sheet', () => {
    render(
      <RoomShell
        {...base}
        chat={(api) => (
          <button type="button" data-testid="chat-open-concierge" onClick={api.openConcierge}>
            open
          </button>
        )}
      />,
    );
    // Chat is the default tab (no home prop) — the render-prop button is present.
    fireEvent.click(screen.getByTestId('chat-open-concierge'));
    expect(screen.getByText('concierge-content')).toBeInTheDocument();
  });
});
