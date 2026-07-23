/**
 * A1 regression (plan §11.A) — the Smart Guide (concierge) sheet ate keyboard
 * input on real devices: Sheet's focus effect depended on [open, onClose] and
 * every caller passes an inline arrow for onClose, so ANY parent re-render
 * while the sheet was open re-ran the effect and stole focus back to the
 * panel div, blurring the text input. On mobile the loop was deterministic
 * (input tap → keyboard opens → visualViewport resize → RoomShell re-render →
 * focus stolen → keyboard closes), so guests could never type a question.
 *
 * These tests pin the fix: focus is grabbed once per open, survives parent
 * re-renders with a fresh onClose identity, and Escape still calls the
 * LATEST onClose.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import Sheet from '@/components/tour-mode/Sheet';

function Harness({ onClose }: { onClose: () => void }) {
  const [, setTick] = useState(0);
  return (
    <div>
      <button type="button" data-testid="rerender" onClick={() => setTick((t) => t + 1)}>
        rerender
      </button>
      {/* Inline arrow — a NEW identity every render, like RoomShell's
          onClose={() => setConciergeOpen(false)}. */}
      <Sheet open onClose={() => onClose()} title="Smart Guide">
        <input data-testid="sheet-input" type="text" placeholder="Ask anything" />
      </Sheet>
    </div>
  );
}

describe('Sheet focus stability (A1)', () => {
  it('keeps focus on an input inside the sheet across parent re-renders', () => {
    render(<Harness onClose={jest.fn()} />);

    const input = screen.getByTestId('sheet-input');
    input.focus();
    expect(document.activeElement).toBe(input);

    // Parent re-render → onClose gets a new identity. Before the fix the
    // focus effect re-ran and panelRef.focus() stole focus from the input.
    fireEvent.click(screen.getByTestId('rerender'));
    expect(document.activeElement).toBe(input);

    // Typing-driven re-renders (e.g. visualViewport → useKeyboardOpen state
    // flips) must not blur either — simulate a few consecutive re-renders.
    fireEvent.click(screen.getByTestId('rerender'));
    fireEvent.click(screen.getByTestId('rerender'));
    expect(document.activeElement).toBe(input);
  });

  it('typed value survives parent re-renders', () => {
    render(<Harness onClose={jest.fn()} />);
    const input = screen.getByTestId('sheet-input') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '화장실 어디예요?' } });
    fireEvent.click(screen.getByTestId('rerender'));
    expect(input.value).toBe('화장실 어디예요?');
    expect(document.activeElement).toBe(input);
  });

  it('Escape still closes via the latest onClose', () => {
    const onClose = jest.fn();
    render(<Harness onClose={onClose} />);
    // Re-render first so the ref must be pointing at the freshest closure.
    fireEvent.click(screen.getByTestId('rerender'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
