/**
 * O4 / U-D5 — the shared chat-list row.
 *
 * The guide console and the ops center had grown this row twice. They looked
 * alike, which is the trap: two implementations that agree today and drift on
 * the next change, where every fix has to be made in both or it is only half
 * made. What is locked here is the shape they must keep sharing, plus the
 * differences that are real (dot vs count, link vs drawer, SOS strip).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import ChatListRow from '@/components/tour-mode/chatlist/ChatListRow';

describe('ChatListRow', () => {
  it('renders the guide shape: link, dot indicator, trailing action', () => {
    const onAction = jest.fn();
    render(
      <ChatListRow
        testId="room-card"
        linkTestId="room-chat"
        href="/tour-mode/room/b1"
        hue={200}
        avatar="A"
        title="Alex"
        meta="2명"
        preview="hello"
        previewEmphasised
        time="18:23"
        indicator={<span data-testid="room-unread-dot" />}
        action={
          <button type="button" data-testid="room-more" onClick={onAction}>
            ⋯
          </button>
        }
      />,
    );

    const row = screen.getByTestId('room-card');
    expect(within(row).getByTestId('room-chat')).toHaveAttribute('href', '/tour-mode/room/b1');
    expect(within(row).getByText('Alex')).toBeInTheDocument();
    expect(within(row).getByText('2명')).toBeInTheDocument();
    expect(within(row).getByText('18:23')).toBeInTheDocument();
    expect(within(row).getByTestId('room-unread-dot')).toBeInTheDocument();

    // 🔴 the ⋯ sits OUTSIDE the tap target — inside it, every tap on the row's
    // right edge would open the sheet instead of the room.
    expect(within(screen.getByTestId('room-chat')).queryByTestId('room-more')).toBeNull();
    fireEvent.click(screen.getByTestId('room-more'));
    expect(onAction).toHaveBeenCalled();
  });

  it('renders the ops shape: button, count indicator, SOS strip inside the card', () => {
    const onOpen = jest.fn();
    render(
      <ChatListRow
        testId="ops-room-card"
        linkTestId="ops-room-open"
        onClick={onOpen}
        alarm
        hue={10}
        avatar="🆘"
        title="Mia"
        meta="4명 · en"
        preview="lost"
        time="17:22"
        indicator={<span data-testid="unread-count">3</span>}
        footer={<p data-testid="sos-strip">SOS 발생</p>}
      />,
    );

    fireEvent.click(screen.getByTestId('ops-room-open'));
    expect(onOpen).toHaveBeenCalled();

    // The SOS text must live INSIDE the card element: the ops dashboard test
    // asserts on the card's textContent to check SOS pinning.
    const card = screen.getByTestId('ops-room-card');
    expect(within(card).getByTestId('sos-strip')).toBeInTheDocument();
    expect(card.textContent).toContain('lost');
    expect(within(card).getByTestId('unread-count')).toBeInTheDocument();
  });

  it('keeps a long name from pushing the time off-screen (P1-5)', () => {
    render(
      <ChatListRow
        linkTestId="row"
        onClick={() => {}}
        hue={100}
        avatar="김"
        title="김아주아주긴이름을가진손님입니다"
        preview="…"
        time="09:00"
      />,
    );
    // The title truncates; the middle column can shrink below its content.
    const title = screen.getByText('김아주아주긴이름을가진손님입니다');
    expect(title.className).toContain('truncate');
    expect(title.parentElement?.parentElement?.className).toContain('min-w-0');
    expect(screen.getByText('09:00')).toBeInTheDocument();
  });

  it('omits the right column entirely when there is no time and no indicator', () => {
    render(
      <ChatListRow linkTestId="row" onClick={() => {}} hue={1} avatar="G" title="Guest" preview="…" />,
    );
    expect(screen.queryByText('09:00')).toBeNull();
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });
});
