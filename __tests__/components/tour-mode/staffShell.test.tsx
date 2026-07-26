/**
 * W2 (U4-D1/D2) — the staff shell: 4 bottom tabs in RoomShell grammar.
 * The old console was one tall scroll with no tabs and no theme control;
 * these tests pin the new frame's contract.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import StaffShell from '@/components/tour-mode/staff/StaffShell';

function mount(extra: Partial<React.ComponentProps<typeof StaffShell>> = {}) {
  return render(
    <StaffShell
      title="제주 프라이빗 투어"
      lifecycle="live"
      subtitle="2026-07-27 · 예약 2"
      chat={<p>chat-pane</p>}
      seats={<p>seats-pane</p>}
      ops={<p>ops-pane</p>}
      settings={<p>settings-pane</p>}
      {...extra}
    />,
  );
}

beforeAll(() => {
  // jsdom has no matchMedia; the shell's 'system' theme resolution reads it.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  window.localStorage.clear();
});

describe('StaffShell', () => {
  it('renders the 4-tab bar and defaults to the 대화 tab', () => {
    mount();
    expect(screen.getByTestId('staff-tabbar')).toBeInTheDocument();
    for (const key of ['chat', 'seats', 'ops', 'settings']) {
      expect(screen.getByTestId(`staff-tab-btn-${key}`)).toBeInTheDocument();
    }
    expect(screen.getByText('chat-pane')).toBeInTheDocument();
    expect(screen.queryByText('seats-pane')).not.toBeInTheDocument();
  });

  it('switches panes on tab tap (좌석·명단 — the seat roster ask)', () => {
    mount();
    fireEvent.click(screen.getByTestId('staff-tab-btn-seats'));
    expect(screen.getByText('seats-pane')).toBeInTheDocument();
    expect(screen.queryByText('chat-pane')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('staff-tab-btn-ops'));
    expect(screen.getByText('ops-pane')).toBeInTheDocument();
  });

  it('shows the reply badge on the 대화 tab', () => {
    mount({ chatBadge: 3 });
    expect(screen.getByTestId('staff-tab-badge-chat')).toHaveTextContent('3');
  });

  it('caps the badge at 9+', () => {
    mount({ chatBadge: 12 });
    expect(screen.getByTestId('staff-tab-badge-chat')).toHaveTextContent('9+');
  });

  it('cycles the theme and applies the room-scoped dark wrapper', () => {
    const { container } = mount();
    const toggle = screen.getByTestId('staff-theme-toggle');
    // default 'system' → cycle: system → light → dark
    fireEvent.click(toggle); // → light
    expect(container.querySelector('.dark')).toBeNull();
    fireEvent.click(toggle); // → dark
    expect(container.querySelector('.dark')).not.toBeNull();
  });

  it('renders lifecycle badge and overlay INSIDE the themed root (transparent-sheet regression)', () => {
    const { container } = mount({
      overlay: <div data-testid="an-overlay">sheet</div>,
    });
    expect(screen.getByTestId('staff-lifecycle-badge')).toHaveTextContent('LIVE');
    const root = container.querySelector('.tr-root');
    expect(root).not.toBeNull();
    expect(root!.contains(screen.getByTestId('an-overlay'))).toBe(true);
  });
});
