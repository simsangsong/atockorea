/**
 * W4.3 — SosButton: a delivered SOS reports its timestamp (onSent) and the
 * sent state shows the "connected to ops" status in every locale.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SosButton from '@/components/tour-mode/SosButton';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
});

describe('SosButton (W4.3)', () => {
  it.each(ROOM_LOCALES)('shows the connected status after sending (%s)', async (locale) => {
    render(<SosButton bookingId="booking-1" roomSession="session" locale={locale} />);
    fireEvent.click(screen.getByTestId('sos-button'));
    fireEvent.click(screen.getByTestId('sos-send'));
    await waitFor(() => expect(screen.getByTestId('sos-sent')).toBeInTheDocument());
    expect(screen.getByTestId('sos-connected')).toBeInTheDocument();
  });

  it('fires onSent with an ISO timestamp on delivery, not on failure', async () => {
    const onSent = jest.fn();
    const { unmount } = render(
      <SosButton bookingId="booking-1" roomSession="session" locale="en" onSent={onSent} />,
    );
    fireEvent.click(screen.getByTestId('sos-button'));
    fireEvent.click(screen.getByTestId('sos-send'));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(() => new Date(onSent.mock.calls[0][0]).toISOString()).not.toThrow();
    unmount();

    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) });
    const onSentFailed = jest.fn();
    render(<SosButton bookingId="booking-1" roomSession="session" locale="en" onSent={onSentFailed} />);
    fireEvent.click(screen.getByTestId('sos-button'));
    fireEvent.click(screen.getByTestId('sos-send'));
    await waitFor(() => expect(screen.getByText(/112\/1330/)).toBeInTheDocument());
    expect(onSentFailed).not.toHaveBeenCalled();
  });
});
