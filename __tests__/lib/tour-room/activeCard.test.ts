/**
 * W2.5 — Tier-0 secondary card resolver (P-D8 ladder tail).
 */
import { secondaryCard } from '@/lib/tour-room/activeCard';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const NOW = Date.UTC(2026, 6, 17, 3, 0, 0);

const msg = (metadata: Record<string, unknown>, agoMin: number, id?: string): RoomMessage => ({
  id: id ?? `m-${agoMin}-${JSON.stringify(metadata).length}`,
  sender_role: 'system',
  source_text: 'x',
  created_at: new Date(NOW - agoMin * 60 * 1000).toISOString(),
  metadata,
});

describe('secondaryCard', () => {
  it('delay outranks vehicle and settlement', () => {
    const card = secondaryCard(
      [
        msg({ kind: 'extra_ledger', extra_id: 'e1', status: 'logged', amount_krw: 5000 }, 5),
        msg({ kind: 'driver_parking_pin', lat: 33.5, lng: 126.5 }, 4),
        msg({ kind: 'driver_delay', minutes: 10 }, 3),
      ],
      NOW,
    );
    expect(card).toMatchObject({ kind: 'delay', minutes: 10 });
  });

  it('vehicle pin surfaces with a maps url; expires after 60min', () => {
    const fresh = secondaryCard([msg({ kind: 'driver_vehicle_arrived', lat: 33.5, lng: 126.5 }, 10)], NOW);
    expect(fresh).toMatchObject({ kind: 'vehicle', pin: 'vehicle_arrived' });
    expect((fresh as { mapsUrl: string }).mapsUrl).toContain('maps.google.com');
    const stale = secondaryCard([msg({ kind: 'driver_parking_pin', lat: 33.5, lng: 126.5 }, 90)], NOW);
    expect(stale).toBeNull();
  });

  it('settlement counts only extras whose NEWEST capsule is still logged', () => {
    const card = secondaryCard(
      [
        msg({ kind: 'extra_ledger', extra_id: 'e1', status: 'logged', amount_krw: 10000 }, 30, 'a'),
        msg({ kind: 'extra_ledger', extra_id: 'e1', status: 'settled', amount_krw: 10000 }, 5, 'b'),
        msg({ kind: 'extra_ledger', extra_id: 'e2', status: 'logged', amount_krw: 7000 }, 2, 'c'),
      ],
      NOW,
    );
    expect(card).toMatchObject({ kind: 'settlement', count: 1, totalKrw: 7000 });
  });

  it('returns null with nothing actionable (delay expired too)', () => {
    expect(secondaryCard([msg({ kind: 'driver_delay', minutes: 5 }, 50)], NOW)).toBeNull();
    expect(secondaryCard([], NOW)).toBeNull();
  });
});
