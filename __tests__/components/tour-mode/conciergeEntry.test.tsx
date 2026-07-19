/**
 * A1 — Smart Guide discoverability: the chat-tab entry row and the header
 * first-visit pulse (localStorage-gated), plus the chat render-prop wiring
 * that lets the entry row open the shell-owned concierge sheet.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ConciergeEntryRow from '@/components/tour-mode/ConciergeEntryRow';
import ConciergeInlineAnswer from '@/components/tour-mode/ConciergeInlineAnswer';
import OperatorAssist from '@/components/tour-mode/guide/OperatorAssist';
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

describe('ConciergeInlineAnswer (C)', () => {
  const answer = { id: 1, question: '화장실 어디?', text: '가장 가까운 화장실은 정문 옆에 있어요.' };

  it('shows the AI label + answer and wires open / dismiss', () => {
    const onOpen = jest.fn();
    const onDismiss = jest.fn();
    render(<ConciergeInlineAnswer answer={answer} locale="ko" onOpen={onOpen} onDismiss={onDismiss} />);
    const banner = screen.getByTestId('concierge-inline-answer');
    expect(banner).toHaveTextContent(CONCIERGE_COPY.ko.aiLabel);
    expect(banner).toHaveTextContent(answer.text);
    fireEvent.click(screen.getByTestId('concierge-inline-more'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('concierge-inline-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('OperatorAssist (B)', () => {
  it('renders the staff intro, suggestions and the ask input', () => {
    render(<OperatorAssist bookingId="bk-1" token="tok" />);
    expect(screen.getByTestId('operator-assist')).toHaveTextContent('손님에게 답하거나');
    expect(screen.getByTestId('operator-assist-suggestions')).toBeInTheDocument();
    expect(screen.getByTestId('operator-assist-input')).toBeInTheDocument();
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
