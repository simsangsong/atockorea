/**
 * W2.4 — ExtraLedgerCard confirm flow + QuickSignalBar one-tap signals.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExtraLedgerCard from '@/components/tour-mode/ExtraLedgerCard';
import QuickSignalBar from '@/components/tour-mode/QuickSignalBar';

describe('ExtraLedgerCard (LEDGER, P-D2)', () => {
  const meta = { extra_id: 'e-1', item: '입장권 4매', amount_krw: 48000, extra_kind: 'advance', status: 'logged' };

  it('renders amount + cash note and confirms on tap', async () => {
    const onConfirm = jest.fn(async () => true);
    render(<ExtraLedgerCard meta={meta} locale="ko" canConfirm onConfirm={onConfirm} />);
    expect(screen.getByTestId('extra-ledger-card')).toHaveTextContent('₩48,000');
    expect(screen.getByTestId('extra-ledger-card')).toHaveTextContent('당일 가이드에게 현금 정산');
    fireEvent.click(screen.getByTestId('extra-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('e-1');
    await waitFor(() => expect(screen.queryByTestId('extra-confirm')).not.toBeInTheDocument());
    expect(screen.getByTestId('extra-ledger-card')).toHaveTextContent('확인됨');
  });

  it('hides the button off the newest capsule / for settled extras', () => {
    render(<ExtraLedgerCard meta={{ ...meta, status: 'settled' }} locale="en" canConfirm={false} />);
    expect(screen.queryByTestId('extra-confirm')).not.toBeInTheDocument();
    expect(screen.getByTestId('extra-ledger-card')).toHaveTextContent('Settled in cash');
  });
});

describe('QuickSignalBar (SIGNAL, W2.4)', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
  });

  it('fires the signals endpoint with the session header', async () => {
    render(<QuickSignalBar bookingId="b-1" roomSession="sess" locale="ko" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('signal-rest_stop'));
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tour-rooms/b-1/signals',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-tour-room-auth': 'sess' }),
        body: JSON.stringify({ type: 'rest_stop' }),
      }),
    );
    await waitFor(() => expect(screen.getByText(/가이드에게 전달됐어요/)).toBeInTheDocument());
  });

  it('renders the three fixed signals (no free text)', () => {
    render(<QuickSignalBar bookingId="b-1" roomSession="sess" locale="en" />);
    expect(screen.getByTestId('signal-running_late')).toBeInTheDocument();
    expect(screen.getByTestId('signal-rest_stop')).toBeInTheDocument();
    expect(screen.getByTestId('signal-lost')).toBeInTheDocument();
  });
});
