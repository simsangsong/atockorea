/**
 * RoomMapCanvas — the map has to obey the guest, and it has to know where they are.
 *
 * 🔴 Why this suite renders the REAL component against the REAL
 * @react-google-maps/api (only `window.google.maps` is stubbed): the bug these
 * tests pin was a property of the LIBRARY's prop diffing, not of our code read
 * in isolation. `applyUpdaterToNextProps` compares by identity
 * (`nextValue !== prevProps[key]`) and `center`'s updater is a bare
 * `map.setCenter(center)`. RoomMapCanvas built `center` and `options` as object
 * literals during render, so every re-render re-applied them — measured before
 * the fix as 1 setCenter at mount plus one per re-render. A mocked GoogleMap
 * would have been green through all of it.
 *
 * While sharing is on, `useGeoWatcher` setStates on every `watchPosition`
 * frame, which re-renders TourRoomClient → RoomMapTab → this canvas. So the
 * map was snapping back to the guide (or the hardcoded Seoul fallback) faster
 * than anyone could pan it: "recenter to me" and follow mode both landed and
 * were undone within a frame.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomMapCanvas from '@/components/tour-mode/map/RoomMapCanvas';
import type { RoomLocation } from '@/hooks/useTourRoomChannel';

const calls = {
  setCenter: [] as unknown[],
  setOptions: [] as unknown[],
  panTo: [] as unknown[],
  setZoom: [] as number[],
  fitBounds: [] as unknown[],
};

class FakeBounds {
  points: unknown[] = [];
  extend(p: unknown) {
    this.points.push(p);
  }
}

class FakeMap {
  setCenter(c: unknown) {
    calls.setCenter.push(c);
  }
  setOptions(o: unknown) {
    calls.setOptions.push(o);
  }
  panTo(c: unknown) {
    calls.panTo.push(c);
  }
  setZoom(z: number) {
    calls.setZoom.push(z);
  }
  fitBounds(b: unknown) {
    calls.fitBounds.push(b);
  }
  setClickableIcons() {}
  setMapTypeId() {}
  setStreetView() {}
  setTilt() {}
  setHeading() {}
  addListener() {
    return { remove() {} };
  }
}

beforeAll(() => {
  (window as unknown as { google: unknown }).google = {
    maps: {
      Map: FakeMap,
      LatLngBounds: FakeBounds,
      SymbolPath: { CIRCLE: 0 },
      // Marker art turns `MarkerArt` into `google.maps.Icon`, which needs these.
      Size: class {
        constructor(
          public width: number,
          public height: number,
        ) {}
      },
      Point: class {
        constructor(
          public x: number,
          public y: number,
        ) {}
      },
      // Markers are not what is under test; absorb every setter the library
      // reaches for rather than chasing its updater map.
      Marker: function FakeMarker() {
        return new Proxy(
          {},
          {
            get: (_t, prop) =>
              prop === 'addListener' ? () => ({ remove() {} }) : () => undefined,
          },
        );
      },
      /**
       * The library wires every `onX` prop through `google.maps.event`, so the
       * honest way to simulate a guest dragging the map is to fire the handler
       * the component actually registered — not to poke its internals.
       */
      event: {
        addListener: (_i: unknown, name: string, handler: () => void) => {
          const entry = { name, handler };
          listeners.push(entry);
          return entry;
        },
        removeListener: (entry: { name: string }) => {
          const i = listeners.findIndex((l) => l === entry);
          if (i >= 0) listeners.splice(i, 1);
        },
        clearInstanceListeners: () => {
          listeners.length = 0;
        },
      },
    },
  };
});

const listeners: Array<{ name: string; handler: () => void }> = [];
function fireMapEvent(name: string) {
  [...listeners].filter((l) => l.name === name).forEach((l) => l.handler());
}

/**
 * `useJsApiLoader` would try to inject Google's script tag. The loader is not
 * what is under test — the diffing of the GoogleMap component is — so it is
 * short-circuited to "loaded" and everything below it stays real.
 */
jest.mock('@react-google-maps/api', () => {
  const actual = jest.requireActual('@react-google-maps/api');
  return { ...actual, useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }) };
});

beforeEach(() => {
  calls.setCenter.length = 0;
  calls.setOptions.length = 0;
  calls.panTo.length = 0;
  calls.setZoom.length = 0;
  calls.fitBounds.length = 0;
  listeners.length = 0;
});

const BASE = {
  locations: {} as Record<string, RoomLocation>,
  myParticipantId: 'me-1',
  spots: [],
  facilities: [],
  pickup: null,
  followGuide: false,
  locale: 'en' as const,
};

const SEOUL = { latitude: 37.5665, longitude: 126.978 };

/** The person a guest is waiting for, wherever they currently are. */
function guideAt(lat: number, lng: number): Record<string, RoomLocation> {
  return {
    'guide-1': {
      participant_id: 'guide-1',
      role: 'guide',
      display_name: 'Kim',
      latitude: lat,
      longitude: lng,
      recorded_at: new Date().toISOString(),
    } as RoomLocation,
  };
}

describe('RoomMapCanvas — the map does not fight the guest', () => {
  it('applies center exactly once, no matter how many times it re-renders', () => {
    const { rerender } = render(<RoomMapCanvas {...BASE} />);
    expect(calls.setCenter).toHaveLength(1); // mount

    // Three unrelated re-renders — what one second of `watchPosition` does.
    rerender(<RoomMapCanvas {...BASE} />);
    rerender(<RoomMapCanvas {...BASE} />);
    rerender(<RoomMapCanvas {...BASE} />);

    expect(calls.setCenter).toHaveLength(1);
    expect(calls.setOptions).toHaveLength(1);
  });

  it('a manual recenter survives the re-renders that follow it', () => {
    const { rerender } = render(<RoomMapCanvas {...BASE} myPosition={SEOUL} sharing />);
    calls.setCenter.length = 0;
    calls.panTo.length = 0;

    fireEvent.click(screen.getByTestId('map-recenter-me'));
    expect(calls.panTo).toHaveLength(1);

    rerender(<RoomMapCanvas {...BASE} myPosition={{ latitude: 37.5666, longitude: 126.9781 }} sharing />);
    // Nothing re-centered the map out from under the pan.
    expect(calls.setCenter).toHaveLength(0);
  });
});

describe('RoomMapCanvas — where am I', () => {
  it('recenters from this device even when nothing has been published to the room', () => {
    // locations is empty: the publish path drops fixes coarser than 100m, so
    // the room legitimately has no echo of me.
    render(<RoomMapCanvas {...BASE} myPosition={SEOUL} />);
    calls.panTo.length = 0;
    calls.setZoom.length = 0;

    fireEvent.click(screen.getByTestId('map-recenter-me'));

    expect(calls.panTo).toEqual([{ lat: 37.5665, lng: 126.978 }]);
    expect(calls.setZoom).toEqual([16]);
  });

  it('falls back to a one-off device fix when the watcher has nothing', () => {
    const getCurrentPosition = jest.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 35.1, longitude: 129.0 } } as GeolocationPosition),
    );
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    render(<RoomMapCanvas {...BASE} />);
    calls.panTo.length = 0;
    fireEvent.click(screen.getByTestId('map-recenter-me'));

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(calls.panTo).toEqual([{ lat: 35.1, lng: 129.0 }]);
  });
});

describe('RoomMapCanvas — initial view', () => {
  const echoOfMe: Record<string, RoomLocation> = {
    'me-1': {
      participant_id: 'me-1',
      role: 'customer',
      display_name: 'Alex',
      latitude: 37.5665,
      longitude: 126.978,
      recorded_at: new Date().toISOString(),
    } as RoomLocation,
  };

  it('focuses instead of fitting when I am the only point, echo and live fix both present', () => {
    // My echo and my watcher fix are the SAME person. Counting both would make
    // fitBounds collapse onto a zero-size box and zoom into a street-tile void.
    render(<RoomMapCanvas {...BASE} locations={echoOfMe} myPosition={SEOUL} />);

    expect(calls.fitBounds).toHaveLength(0);
    expect(calls.panTo).toEqual([{ lat: 37.5665, lng: 126.978 }]);
    // `zoom={14}` is applied once by the library at mount; the focus wins after.
    expect(calls.setZoom.at(-1)).toBe(16);
  });

  it('staff open on the whole picture — everyone plus every stop', () => {
    render(
      <RoomMapCanvas
        {...BASE}
        isOperator
        locations={echoOfMe}
        spots={[{ id: 's1', title: 'Stop', latitude: 35.1, longitude: 129.0 }]}
      />,
    );
    expect(calls.fitBounds).toHaveLength(1);
    expect((calls.fitBounds[0] as FakeBounds).points).toHaveLength(2);
  });

  /**
   * 사장님 2026-08-07 — "아침에 고객이 맵을 켰을 때 실시간 가이드 위치를 볼 수 있도록."
   * A guest opening on the whole itinerary is what makes the van a speck.
   */
  it('a guest opens framed on the vehicle and themselves, not on the itinerary', () => {
    render(
      <RoomMapCanvas
        {...BASE}
        locations={{ ...echoOfMe, ...guideAt(37.57, 126.99) }}
        spots={[{ id: 's1', title: 'Far away stop', latitude: 35.1, longitude: 129.0 }]}
      />,
    );
    expect(calls.fitBounds).toHaveLength(1);
    const framed = (calls.fitBounds[0] as FakeBounds).points as Array<{ lat: number; lng: number }>;
    expect(framed).toHaveLength(2); // vehicle + me
    expect(framed.some((p) => p.lat === 35.1)).toBe(false); // the far stop is not in it
  });

  it('waits for the vehicle rather than settling on the stops', () => {
    const spots = [{ id: 's1', title: 'Stop', latitude: 35.1, longitude: 129.0 }];
    // Opens before the guide's first ping: framing the itinerary is allowed…
    const { rerender } = render(<RoomMapCanvas {...BASE} spots={spots} />);
    expect(calls.fitBounds.length + calls.panTo.length).toBeGreaterThan(0);
    calls.fitBounds.length = 0;
    calls.panTo.length = 0;

    // …but the vehicle still gets to claim the frame when it arrives.
    rerender(<RoomMapCanvas {...BASE} spots={spots} locations={guideAt(37.57, 126.99)} />);
    expect(calls.panTo).toEqual([{ lat: 37.57, lng: 126.99 }]);

    // And only once — later pings do not keep yanking the view.
    calls.panTo.length = 0;
    rerender(<RoomMapCanvas {...BASE} spots={spots} locations={guideAt(37.58, 126.99)} />);
    expect(calls.panTo).toHaveLength(0);
  });

  it('a guest who has dragged the map keeps it, even when the vehicle shows up', () => {
    const spots = [{ id: 's1', title: 'Stop', latitude: 35.1, longitude: 129.0 }];
    const { rerender } = render(<RoomMapCanvas {...BASE} spots={spots} />);
    act(() => fireMapEvent('dragstart'));
    calls.fitBounds.length = 0;
    calls.panTo.length = 0;

    rerender(<RoomMapCanvas {...BASE} spots={spots} locations={guideAt(37.57, 126.99)} />);
    expect(calls.panTo).toHaveLength(0);
    expect(calls.fitBounds).toHaveLength(0);
  });
});

describe('RoomMapCanvas — turning sharing on', () => {
  it('focuses my location when the switch goes on and the first fix lands', () => {
    const { rerender } = render(<RoomMapCanvas {...BASE} sharing={false} myPosition={null} />);
    calls.panTo.length = 0;
    calls.setZoom.length = 0;

    // The guest flips the switch; the fix has not arrived yet.
    rerender(<RoomMapCanvas {...BASE} sharing myPosition={null} />);
    expect(calls.panTo).toHaveLength(0);

    // First fix from the watcher.
    act(() => {
      rerender(<RoomMapCanvas {...BASE} sharing myPosition={SEOUL} />);
    });

    expect(calls.panTo).toEqual([{ lat: 37.5665, lng: 126.978 }]);
    expect(calls.setZoom).toEqual([16]);
  });

  it('does it once, then leaves the map alone as fixes keep arriving', () => {
    const { rerender } = render(<RoomMapCanvas {...BASE} sharing={false} myPosition={null} />);
    rerender(<RoomMapCanvas {...BASE} sharing myPosition={SEOUL} />);
    calls.panTo.length = 0;

    rerender(<RoomMapCanvas {...BASE} sharing myPosition={{ latitude: 37.5675, longitude: 126.979 }} />);
    rerender(<RoomMapCanvas {...BASE} sharing myPosition={{ latitude: 37.5685, longitude: 126.98 }} />);

    // Continuous re-centering is `followGuide`'s job, not the sharing switch's.
    expect(calls.panTo).toHaveLength(0);
  });

  it('leaves the view alone when the map is opened with sharing already on', () => {
    render(<RoomMapCanvas {...BASE} sharing myPosition={SEOUL} />);
    // Only the one-shot initial fit (a single point ⇒ focus), never a yank
    // triggered by the switch, which the guest did not just touch.
    expect(calls.panTo).toHaveLength(1);
    calls.panTo.length = 0;

    // Subsequent fixes must not move it.
    expect(calls.panTo).toHaveLength(0);
  });
});
