/**
 * 사장님 2026-08-07 — emoticons get one door: an emoji button beside the "+".
 *
 * The assertions that matter are the ones a source review cannot make: that the
 * glyph lands at the CARET (not appended), that the tray survives a pick so a
 * run of emoji costs one tap each, and that it cannot be docked at the same
 * time as the "+" tray — both open would push the input off a short phone.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import Composer from '@/components/tour-mode/Composer';
import { COMPOSER_EMOJI, EMOJI_GROUPS } from '@/lib/tour-room/emoji';

function mount(over: Partial<React.ComponentProps<typeof Composer>> = {}) {
  return render(
    <Composer
      locale="ko"
      onSendText={jest.fn()}
      onSendPreset={jest.fn()}
      onSendAttachment={jest.fn().mockResolvedValue(true)}
      {...over}
    />,
  );
}

const input = () => screen.getByPlaceholderText('메시지 보내기') as HTMLTextAreaElement;

describe('composer emoji picker', () => {
  it('opens from the button beside "+" and carries the whole set', () => {
    mount();
    expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('composer-emoji-toggle'));
    const picker = screen.getByTestId('emoji-picker');
    expect(picker.querySelectorAll('button')).toHaveLength(COMPOSER_EMOJI.length);
    for (const emoji of COMPOSER_EMOJI) {
      expect(screen.getByTestId(`emoji-${emoji}`)).toBeInTheDocument();
    }
  });

  /** Shelves are labelled in the viewer's language, not just English. */
  it('labels every shelf in the room locale', () => {
    mount();
    fireEvent.click(screen.getByTestId('composer-emoji-toggle'));
    for (const group of EMOJI_GROUPS) {
      expect(screen.getByTestId(`emoji-group-${group.key}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('emoji-group-travel')).toHaveTextContent('여행');
  });

  it('inserts at the caret, not at the end, and stays open for the next pick', () => {
    mount();
    fireEvent.change(input(), { target: { value: '점심 먹어요' } });
    input().setSelectionRange(2, 2); // 점심| 먹어요
    fireEvent.click(screen.getByTestId('composer-emoji-toggle'));

    fireEvent.click(screen.getByTestId('emoji-🍜'));
    expect(input().value).toBe('점심🍜 먹어요');
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
  });

  it('replaces the selected range', () => {
    mount();
    fireEvent.change(input(), { target: { value: 'good' } });
    input().setSelectionRange(0, 4);
    fireEvent.click(screen.getByTestId('composer-emoji-toggle'));
    fireEvent.click(screen.getByTestId('emoji-👍'));
    expect(input().value).toBe('👍');
  });

  /** maxLength guards typing and paste; setState walks straight past it. */
  it('refuses to push the draft past the 2000-char message cap', () => {
    mount();
    const full = 'ㄱ'.repeat(2000);
    fireEvent.change(input(), { target: { value: full } });
    fireEvent.click(screen.getByTestId('composer-emoji-toggle'));
    fireEvent.click(screen.getByTestId('emoji-🎉'));
    expect(input().value).toBe(full);
  });

  it('is still reachable once a draft exists (the "+" is not)', () => {
    mount();
    fireEvent.change(input(), { target: { value: '안녕' } });
    expect(screen.queryByTestId('composer-actions-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('composer-emoji-toggle')).toBeInTheDocument();
  });

  it('never docks both trays at once', () => {
    mount();
    fireEvent.click(screen.getByTestId('composer-emoji-toggle'));
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('composer-actions-toggle'));
    expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-grid')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('composer-emoji-toggle'));
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
    expect(screen.queryByTestId('action-grid')).not.toBeInTheDocument();
  });

  it('closes on send, so the next message starts on a clean bar', () => {
    const onSendText = jest.fn();
    mount({ onSendText });
    fireEvent.click(screen.getByTestId('composer-emoji-toggle'));
    fireEvent.click(screen.getByTestId('emoji-🎉'));
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSendText).toHaveBeenCalledWith('🎉');
    expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
  });
});
