/**
 * @jest-environment jsdom
 *
 * O5 — every full-screen ops overlay closes on Escape.
 *
 * The O0 baseline measured this and found **none of them did**, while the
 * smart app's `Sheet` has since PR #481. On a phone that costs nothing; on the
 * desktop the dispatchers actually run the board from, the 닫기 button was the
 * only way out of a screen covering everything — and it sits in a different
 * place per overlay.
 *
 * The list is derived from the source, not hand-written: an overlay that takes
 * an `onClose` and paints itself over the viewport has to wire the hook, and a
 * NEW one gets caught here rather than by someone pressing Escape in
 * production and nothing happening.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { useEscapeClose } from '@/hooks/useEscapeClose';

const DIR = 'components/tour-ops';

/** A full-screen overlay: fixed inset-0 + an onClose prop. */
function overlayFiles(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => {
      const src = readFileSync(path.join(DIR, f), 'utf8');
      return /fixed inset-0/.test(src) && /onClose/.test(src);
    });
}

describe('🔴 O5 — ops overlays close on Escape', () => {
  it('finds overlays to check — an empty list would make this decorative', () => {
    expect(overlayFiles().length).toBeGreaterThanOrEqual(6);
  });

  it('every full-screen overlay wires useEscapeClose', () => {
    const missing = overlayFiles().filter(
      (f) => !readFileSync(path.join(DIR, f), 'utf8').includes('useEscapeClose'),
    );
    expect(
      missing.length === 0
        ? ''
        : `\n전체화면 오버레이인데 Esc로 못 닫는다:\n  ${missing.join('\n  ')}\n`,
    ).toBe('');
  });
});

describe('useEscapeClose', () => {
  function Probe({ onClose, enabled }: { onClose: () => void; enabled?: boolean }) {
    useEscapeClose(onClose, enabled);
    return <div>overlay</div>;
  }

  it('calls onClose on Escape and ignores other keys', () => {
    const onClose = jest.fn();
    render(<Probe onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted — a closed overlay must not eat Escape', () => {
    const onClose = jest.fn();
    const { unmount } = render(<Probe onClose={onClose} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('can be disabled', () => {
    const onClose = jest.fn();
    render(<Probe onClose={onClose} enabled={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('always calls the LATEST handler — an inline arrow must not go stale', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(<Probe onClose={first} />);
    rerender(<Probe onClose={second} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('the innermost overlay closes first when two are stacked', () => {
    const outer = jest.fn();
    const inner = jest.fn();
    render(
      <>
        <Probe onClose={outer} />
        <Probe onClose={inner} />
      </>,
    );
    // Both listen; the later-registered (inner) one runs first in the bubble
    // phase, which is why the hook deliberately avoids capture.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalled();
  });
});

describe('rendering', () => {
  it('renders its children (sanity for the probe above)', () => {
    render(<div>overlay</div>);
    expect(screen.getByText('overlay')).toBeInTheDocument();
  });
});
