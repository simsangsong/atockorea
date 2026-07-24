/**
 * A1.1 P2 — the chat-core icon-only controls had English-fixed aria-labels, so
 * a ko/ja/zh/es guest using a screen reader heard every control in English
 * while the visible copy was localized. These pin them to the viewer locale.
 */

import { render, screen } from '@testing-library/react';
import Lightbox from '@/components/tour-mode/Lightbox';
import ReplyPreview from '@/components/tour-mode/ReplyPreview';
import type { ReplySnapshot } from '@/lib/tour-room/reply';

describe('Lightbox aria-labels follow the locale', () => {
  it('labels close/download in Korean for a ko viewer', () => {
    render(<Lightbox url="https://example.com/a.jpg" name="a.jpg" locale="ko" onClose={() => {}} />);
    expect(screen.getByTestId('lightbox-close')).toHaveAttribute('aria-label', '닫기');
    expect(screen.getByTestId('lightbox-download')).toHaveAttribute('aria-label', '다운로드');
  });

  it('defaults to English when no locale is passed', () => {
    render(<Lightbox url="https://example.com/a.jpg" onClose={() => {}} />);
    expect(screen.getByTestId('lightbox-close')).toHaveAttribute('aria-label', 'Close');
  });
});

describe('ReplyPreview cancel label follows the locale', () => {
  const snapshot = {
    message_id: 'm1',
    sender_role: 'guide',
    sender_name: 'Kim',
    input_kind: 'text',
    excerpt: 'hello',
  } as unknown as ReplySnapshot;

  it('labels the cancel button in Japanese for a ja viewer', () => {
    render(<ReplyPreview snapshot={snapshot} locale="ja" variant="bar" onClose={() => {}} />);
    expect(screen.getByLabelText('返信をキャンセル')).toBeInTheDocument();
  });
});
