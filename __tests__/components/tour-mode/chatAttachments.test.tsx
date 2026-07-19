/**
 * Kakao-grade chat (Phase 2a) — photo/file attachments: ChatFeed image/file
 * bubbles + lightbox, and the Composer attach flow.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import Composer from '@/components/tour-mode/Composer';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const AT = '2026-07-19T10:00:00.000Z';

function imageMsg(over: Partial<RoomMessage> = {}): RoomMessage {
  return {
    id: 'img-1',
    sender_role: 'guide',
    input_kind: 'image',
    source_text: '',
    translations: {},
    metadata: { kind: 'attachment_image', attachment: { url: 'https://cdn.test/p.jpg', mime: 'image/jpeg', name: 'p.jpg', size: 2048 } },
    created_at: AT,
    ...over,
  };
}

describe('ChatFeed attachments', () => {
  it('renders an image message as a thumbnail that opens the lightbox', () => {
    render(<ChatFeed messages={[imageMsg()]} viewerLocale="en" viewerRole="customer" />);
    const thumb = screen.getByTestId('chat-image');
    expect(thumb).toBeInTheDocument();
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
    fireEvent.click(thumb);
    expect(screen.getByTestId('lightbox')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('lightbox-close'));
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
  });

  it('shows a translated caption under an image in the viewer locale', () => {
    render(
      <ChatFeed
        messages={[imageMsg({ source_text: 'nice view', translations: { ko: '멋진 경치' } })]}
        viewerLocale="ko"
        viewerRole="customer"
      />,
    );
    expect(screen.getByText('멋진 경치')).toBeInTheDocument();
  });

  it('renders a file message as a download chip with name and size', () => {
    const fileMsg: RoomMessage = {
      id: 'file-1',
      sender_role: 'customer',
      input_kind: 'file',
      source_text: '',
      translations: {},
      metadata: { kind: 'attachment_file', attachment: { url: 'https://cdn.test/itinerary.pdf', mime: 'application/pdf', name: 'itinerary.pdf', size: 1024 * 1024 } },
      created_at: AT,
    };
    render(<ChatFeed messages={[fileMsg]} viewerLocale="en" viewerRole="customer" />);
    const chip = screen.getByTestId('chat-file');
    expect(chip).toHaveTextContent('itinerary.pdf');
    expect(chip).toHaveTextContent('1.0 MB');
    expect(chip).toHaveAttribute('href', 'https://cdn.test/itinerary.pdf');
  });
});

describe('Composer attach flow', () => {
  beforeEach(() => {
    // jsdom lacks object URLs; the image preview needs them.
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = jest.fn(() => 'blob:preview');
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = jest.fn();
  });

  it('hides the attach button without an onSendAttachment handler', () => {
    render(<Composer locale="en" onSendText={jest.fn()} onSendPreset={jest.fn()} />);
    expect(screen.queryByTestId('attach-button')).not.toBeInTheDocument();
  });

  it('picks a photo → preview + caption → send calls onSendAttachment', async () => {
    const onSendAttachment = jest.fn(async () => true);
    render(<Composer locale="en" onSendText={jest.fn()} onSendPreset={jest.fn()} onSendAttachment={onSendAttachment} />);

    const input = screen.getByTestId('attach-file-input');
    const file = new File([new Uint8Array(16)], 'view.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    const panel = await screen.findByTestId('attach-panel');
    expect(panel).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('attach-caption'), { target: { value: 'east gate' } });
    fireEvent.click(screen.getByTestId('attach-send'));

    await waitFor(() => expect(onSendAttachment).toHaveBeenCalledWith(file, 'east gate'));
    await waitFor(() => expect(screen.queryByTestId('attach-panel')).not.toBeInTheDocument());
  });

  it('rejects an oversized file with a note and no send', async () => {
    const onSendAttachment = jest.fn(async () => true);
    render(<Composer locale="ko" onSendText={jest.fn()} onSendPreset={jest.fn()} onSendAttachment={onSendAttachment} />);
    const big = new File([new Uint8Array(4)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    fireEvent.change(screen.getByTestId('attach-file-input'), { target: { files: [big] } });
    expect(await screen.findByText('파일이 너무 커요.')).toBeInTheDocument();
    expect(screen.queryByTestId('attach-panel')).not.toBeInTheDocument();
    expect(onSendAttachment).not.toHaveBeenCalled();
  });
});
