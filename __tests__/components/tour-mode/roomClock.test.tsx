/**
 * SG-0c — one clock for the whole room.
 *
 * The provider derives a single offset from the snapshot's server stamp and
 * every consumer reads the corrected clock; outside a provider the hook
 * falls back to the device clock (which is what every pre-SG-0c mount and
 * test already assumed). ±60s device skew is the WBS's own acceptance case.
 */
import { render } from '@testing-library/react';
import { RoomClockProvider, useRoomClock } from '@/components/tour-mode/roomClock';

function Probe({ onRead }: { onRead: (nowMs: number) => void }) {
  const nowFn = useRoomClock();
  onRead(nowFn());
  return null;
}

describe('RoomClockProvider (SG-D4)', () => {
  it('corrects a device running 60s behind the server', () => {
    const device = 1_000_000_000;
    const server = device + 60_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(device);
    try {
      let read = 0;
      render(
        <RoomClockProvider serverNowMs={server}>
          <Probe onRead={(v) => (read = v)} />
        </RoomClockProvider>,
      );
      expect(read).toBe(server);
    } finally {
      spy.mockRestore();
    }
  });

  it('corrects a device running 60s ahead of the server', () => {
    const device = 1_000_000_000;
    const server = device - 60_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(device);
    try {
      let read = 0;
      render(
        <RoomClockProvider serverNowMs={server}>
          <Probe onRead={(v) => (read = v)} />
        </RoomClockProvider>,
      );
      expect(read).toBe(server);
    } finally {
      spy.mockRestore();
    }
  });

  it('falls back to the device clock without a provider or a stamp', () => {
    const device = 1_000_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(device);
    try {
      let bare = 0;
      render(<Probe onRead={(v) => (bare = v)} />);
      expect(bare).toBe(device);

      let unstamped = 0;
      render(
        <RoomClockProvider serverNowMs={undefined}>
          <Probe onRead={(v) => (unstamped = v)} />
        </RoomClockProvider>,
      );
      expect(unstamped).toBe(device);
    } finally {
      spy.mockRestore();
    }
  });

  it('anchors the offset once — a re-render does not re-derive it', () => {
    const device = 1_000_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(device);
    try {
      const reads: number[] = [];
      const { rerender } = render(
        <RoomClockProvider serverNowMs={device + 60_000}>
          <Probe onRead={(v) => reads.push(v)} />
        </RoomClockProvider>,
      );
      // Device clock advances 10s; a re-render with the SAME stamp must ride
      // the original offset (+60s), not re-anchor to a fresh one.
      spy.mockReturnValue(device + 10_000);
      rerender(
        <RoomClockProvider serverNowMs={device + 60_000}>
          <Probe onRead={(v) => reads.push(v)} />
        </RoomClockProvider>,
      );
      expect(reads[reads.length - 1]).toBe(device + 10_000 + 60_000);
    } finally {
      spy.mockRestore();
    }
  });
});
