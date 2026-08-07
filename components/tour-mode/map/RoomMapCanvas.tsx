'use client';

/**
 * T3.3 — the actual Google Maps canvas for the room map tab.
 *
 * Split out so RoomMapTab can `dynamic(ssr:false)` it: importing this file
 * pulls @react-google-maps/api + the Maps JS SDK, which must stay out of the
 * room's initial bundle (§O-1 ② — the chat screen renders first, the map
 * loads on tab entry). Uses the shared loader constants (quarterly pin) that
 * the production tour pages already run on.
 *
 * Markers: guide 🚌 · me/you initial dots · numbered spot pins · pickup 🅿 ·
 * facility dots. Follow mode pans with every guide frame.
 *
 * 🔴 `center` and `options` MUST stay referentially stable.
 *
 * @react-google-maps/api diffs props by identity (`nextValue !== prevProps[key]`
 * in `applyUpdaterToNextProps`) and its `center` updater is a bare
 * `map.setCenter(center)`. Both used to be object literals built during render,
 * so EVERY re-render re-applied the center — measured: 1 call at mount, +1 per
 * re-render. While the guest is sharing, `useGeoWatcher` sets `lastPosition` on
 * every `watchPosition` frame, which re-renders TourRoomClient → this canvas,
 * so the map snapped back to the guide (or to the hardcoded Seoul fallback)
 * about as fast as anyone could pan it. "Recenter to me", follow mode and the
 * guest's own finger were all being undone within a frame or two.
 *
 * Everything that MOVES the map is imperative from here on (`panTo`,
 * `fitBounds`, `setZoom`); `center` is only the pre-fit value handed over once
 * at mount. Guarded by `__tests__/components/tour-mode/mapCanvasFocus.test.tsx`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { IconRecenter, IconFitAll } from '@/components/tour-mode/icons';
import { TR_ICON, TR_STROKE } from '@/components/tour-mode/icons';
import {
  GOOGLE_MAPS_LOADER_ID,
  GOOGLE_MAPS_LOADER_VERSION,
  libraries as GOOGLE_MAPS_LIBRARIES,
} from '@/lib/google-maps';
import {
  basemapStyle,
  companionDot,
  facilityDot,
  myLocationDot,
  pickupPin,
  stopPin,
  vehiclePin,
  type MarkerArt,
} from '@/lib/tour-room/mapMarkers';
import { useResolvedTourTheme } from '@/hooks/useResolvedTourTheme';
import type { RoomLocation } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface MapSpot {
  id: string;
  title?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface MapPoint {
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
}

function initialOf(name: string | undefined): string {
  return ((name ?? '').trim()[0] ?? '•').toUpperCase();
}

/** Last-resort view when the room has nothing to show yet (central Seoul). */
const FALLBACK_CENTER = { lat: 37.5665, lng: 126.978 } as const;
/** Zoom used whenever we deliberately put ONE point on screen. */
const FOCUS_ZOOM = 16;

/**
 * The two map controls are the only strings in this file that were English-free
 * but not locale-aware: both `aria-label`s were hardcoded Korean, so every
 * non-Korean guest's screen reader announced "내 위치로" / "전체 보기".
 */
const MAP_CONTROL: Record<RoomLocale, { recenter: string; fitAll: string }> = {
  en: { recenter: 'Center on my location', fitAll: 'Show everything' },
  ko: { recenter: '내 위치로', fitAll: '전체 보기' },
  ja: { recenter: '現在地に移動', fitAll: '全体表示' },
  es: { recenter: 'Centrar en mi ubicación', fitAll: 'Ver todo' },
  zh: { recenter: '回到我的位置', fitAll: '查看全部' },
  'zh-TW': { recenter: '回到我的位置', fitAll: '檢視全部' },
  fr: { recenter: 'Centrer sur ma position', fitAll: 'Tout afficher' },
  de: { recenter: 'Auf meinen Standort zentrieren', fitAll: 'Alles anzeigen' },
  ru: { recenter: 'Центрировать на мне', fitAll: 'Показать всё' },
  it: { recenter: 'Centra sulla mia posizione', fitAll: 'Mostra tutto' },
};

/**
 * 🔴 What a guest saw when the map did not come up (UX walk, 2026-07-28):
 *
 *   "Oops! Something went wrong. This page didn't load Google Maps correctly.
 *    See the JavaScript console for technical details."
 *
 * Google paints that inside our container, in English, to a tourist, with an
 * instruction to open a developer console. And the OTHER failure — the script
 * never loading at all, which on a mobile network is the common one — left the
 * skeleton saying "Loading map…" forever, because only `isLoaded` was read and
 * `loadError` was dropped on the floor.
 *
 * Both now land on the same fallback: say the map is unavailable in the
 * guest's language, and hand them the one thing the map was for — the place,
 * openable in whatever map app their phone already has.
 */
const MAP_DOWN: Record<RoomLocale, { title: string; body: string; open: string; loading: string }> = {
  en: { title: 'Map unavailable', body: 'It should come back on its own. Meanwhile you can open the place in your own map app.', open: 'Open in maps', loading: 'Loading map…' },
  ko: { title: '지도를 불러올 수 없습니다', body: '잠시 후 다시 연결됩니다. 그동안은 지도 앱에서 바로 열 수 있습니다.', open: '지도 앱에서 열기', loading: '지도를 불러오는 중…' },
  ja: { title: '地図を読み込めません', body: 'しばらくすると復帰します。それまでは地図アプリで開けます。', open: '地図アプリで開く', loading: '地図を読み込み中…' },
  es: { title: 'Mapa no disponible', body: 'Debería volver solo. Mientras tanto puedes abrir el lugar en tu app de mapas.', open: 'Abrir en mapas', loading: 'Cargando el mapa…' },
  zh: { title: '地图暂时无法加载', body: '稍后会自动恢复。在此期间可以用手机的地图应用打开。', open: '在地图应用中打开', loading: '正在加载地图…' },
  'zh-TW': { title: '地圖暫時無法載入', body: '稍後會自動恢復。在此期間可以用手機的地圖應用程式開啟。', open: '在地圖應用程式開啟', loading: '正在載入地圖…' },
  fr: { title: 'Carte indisponible', body: "Elle devrait revenir d'elle-même. En attendant, vous pouvez ouvrir le lieu dans votre application de cartes.", open: 'Ouvrir dans Plans', loading: 'Chargement de la carte…' },
  de: { title: 'Karte nicht verfügbar', body: 'Sie kommt von selbst zurück. Solange können Sie den Ort in Ihrer Karten-App öffnen.', open: 'In Karten öffnen', loading: 'Karte wird geladen…' },
  ru: { title: 'Карта недоступна', body: 'Она восстановится сама. А пока место можно открыть в вашем приложении карт.', open: 'Открыть в картах', loading: 'Загрузка карты…' },
  it: { title: 'Mappa non disponibile', body: 'Tornerà da sola. Nel frattempo puoi aprire il luogo nella tua app di mappe.', open: 'Apri nelle mappe', loading: 'Caricamento della mappa…' },
};

export default function RoomMapCanvas({
  locations,
  myParticipantId,
  spots,
  facilities,
  pickup,
  followGuide,
  locale,
  myPosition = null,
  sharing = false,
  isOperator = false,
}: {
  locations: Record<string, RoomLocation>;
  myParticipantId: string | null;
  spots: MapSpot[];
  facilities: MapPoint[];
  pickup: MapPoint | null;
  followGuide: boolean;
  locale: RoomLocale;
  /**
   * 🔴 This device's own live fix, straight from the watcher — NOT the server echo.
   *
   * The canvas used to learn where "me" is only from `locations[myParticipantId]`,
   * i.e. after a ping round-tripped through `POST /location` → broadcast. That
   * publish is gated on `isAccurateEnough` (accuracy ≤ 100 m) AND throttled to
   * one ping per 15 s, so on any device geolocating by Wi-Fi the ping is never
   * sent at all: sharing reads "Sharing live", and the map still has no idea
   * where the guest is — no dot, and "recenter to me" with nothing to center on.
   */
  myPosition?: { latitude: number; longitude: number } | null;
  /** Opting in should take the guest to their own dot — see the effect below. */
  sharing?: boolean;
  /**
   * Staff see the whole picture; a guest opens the map to find one thing.
   * 사장님 2026-08-07: "아침에 고객이 맵을 켰을 때 실시간 가이드 위치를 볼 수 있도록."
   */
  isOperator?: boolean;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: GOOGLE_MAPS_LOADER_VERSION,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const theme = useResolvedTourTheme();
  /**
   * A fresh literal here re-runs `map.setOptions` every render — see header.
   * Keyed on the theme only, which is the one thing that legitimately restyles
   * the tiles (a white map inside a dark room is the eyesore this avoids).
   */
  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      styles: basemapStyle(theme),
    }),
    [theme],
  );
  /**
   * `loadError` only catches the SCRIPT failing. When the script loads but
   * Google rejects the key (referer not allowed, billing, quota) it paints its
   * own English developer error into our container instead — the failure the
   * UX walk actually caught. `gm_authFailure` is Google's documented hook for
   * exactly that, and it is the only way to get in front of it.
   */
  const [authFailed, setAuthFailed] = useState(false);
  useEffect(() => {
    const w = window as Window & { gm_authFailure?: () => void };
    const prev = w.gm_authFailure;
    w.gm_authFailure = () => {
      setAuthFailed(true);
      prev?.();
    };
    return () => {
      w.gm_authFailure = prev;
    };
  }, []);

  /**
   * Marker art, built once the SDK exists — `Size`/`Point` are SDK classes, so
   * this cannot be module scope. `MarkerArt` itself is pure and pre-tested.
   */
  const icons = useMemo(() => {
    if (!isLoaded || typeof google === 'undefined') return null;
    const toIcon = (art: MarkerArt): google.maps.Icon => ({
      url: art.url,
      scaledSize: new google.maps.Size(art.width, art.height),
      anchor: new google.maps.Point(art.anchorX, art.anchorY),
      labelOrigin: new google.maps.Point(art.labelX, art.labelY),
    });
    return {
      vehicle: toIcon(vehiclePin()),
      me: toIcon(myLocationDot()),
      companion: toIcon(companionDot()),
      stop: toIcon(stopPin()),
      pickup: toIcon(pickupPin()),
      facility: toIcon(facilityDot()),
    };
  }, [isLoaded]);

  const people = useMemo(() => Object.values(locations), [locations]);
  /**
   * 🔴 The operator a guest is looking for may be a guide OR a driver. This
   * only ever looked for 'guide', so on a driver-run tour follow mode had no
   * target — while `RoomMapTab` (which does fall back to the driver) happily
   * showed the follow button. The button was there and did nothing.
   */
  const guide =
    people.find((p) => p.role === 'guide') ?? people.find((p) => p.role === 'driver') ?? null;

  /** Where I am, freshest source first: my own watcher, then the server echo. */
  const myEcho = myParticipantId ? locations[myParticipantId] ?? null : null;
  const myLat = myPosition?.latitude ?? myEcho?.latitude ?? null;
  const myLng = myPosition?.longitude ?? myEcho?.longitude ?? null;
  const myPoint = useMemo(
    () => (myLat !== null && myLng !== null ? { lat: myLat, lng: myLng } : null),
    [myLat, myLng],
  );

  const allPoints = useMemo(() => {
    const pts: Array<{ lat: number; lng: number }> = [];
    // Exactly one point per person — mirrors the markers below, where my own
    // row rides `myPoint` and the standalone "me" marker only exists when the
    // room has no echo of me. Pushing both would put me in twice and collapse
    // fitBounds onto a ~zero-size box.
    for (const p of people) {
      const isMine = p.participant_id === myParticipantId;
      pts.push(isMine && myPoint ? myPoint : { lat: p.latitude, lng: p.longitude });
    }
    if (!myEcho && myPoint) pts.push(myPoint);
    for (const s of spots) {
      if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
        pts.push({ lat: s.latitude, lng: s.longitude });
      }
    }
    if (pickup && typeof pickup.lat === 'number' && typeof pickup.lng === 'number') {
      pts.push({ lat: pickup.lat, lng: pickup.lng });
    }
    return pts;
  }, [people, myParticipantId, myEcho, myPoint, spots, pickup]);

  /**
   * The one and only value the map ever receives as `center`.
   *
   * A lazy `useState` initializer, not a render-time literal: it is computed on
   * the first render and then never changes identity, so the library's
   * identity diff sees no change and `map.setCenter` is never re-applied. From
   * here the view moves only where the code says so — `onLoad`'s fit, the
   * first-points fit, follow mode, the two control buttons.
   */
  const [center] = useState<{ lat: number; lng: number }>(
    () =>
      (guide ? { lat: guide.latitude, lng: guide.longitude } : null) ??
      myPoint ??
      allPoints[0] ??
      FALLBACK_CENTER,
  );

  /**
   * `fitBounds` over a single point zooms to the maximum level — a street-tile
   * void. One point is a "focus", not a "fit".
   */
  const fitTo = useCallback((points: Array<{ lat: number; lng: number }>) => {
    const map = mapRef.current;
    if (!map) return;
    // Coincident points (the pickup point that IS the first stop, two phones on
    // the same bench) would otherwise make a zero-size box.
    const unique = Array.from(new Map(points.map((p) => [`${p.lat},${p.lng}`, p])).values());
    if (unique.length === 0) return;
    if (unique.length === 1) {
      map.panTo(unique[0]);
      map.setZoom(FOCUS_ZOOM);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    unique.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 48);
  }, []);

  /**
   * The opening frame — what the map looks at before anyone touches it.
   *
   * 사장님 2026-08-07: "아침에 고객이 맵을 켰을 때 실시간 가이드 위치를 볼 수 있도록."
   * A guest opens this to answer one question — where is my ride — so the first
   * frame is the vehicle, plus the guest themselves when we know where they
   * are. Fitting every itinerary stop instead (which is what the [전체 보기]
   * button is for) shrinks the van to a speck among the whole day. Staff are
   * looking AT the group rather than FOR it, so they keep the wide view.
   */
  const openingTargets = useMemo(() => {
    if (isOperator) return allPoints;
    const vehicle = guide ? { lat: guide.latitude, lng: guide.longitude } : null;
    const focus = [vehicle, myPoint].filter((p): p is { lat: number; lng: number } => p !== null);
    return focus.length > 0 ? focus : allPoints;
  }, [isOperator, allPoints, guide, myPoint]);

  /**
   * Auto-framing runs at most twice and then never again:
   *   'none'    — nothing has been framed yet
   *   'partial' — framed, but without the vehicle a guest is waiting for
   *   'final'   — done; the view now belongs to whoever asked for it last
   *
   * 'partial' exists because positions arrive over the channel while stops come
   * from the snapshot: without it, a guest who opens the map two seconds before
   * the guide's first ping gets framed on the itinerary and the vehicle never
   * earns the screen. With it, the vehicle gets exactly one chance to claim the
   * frame — and loses it the moment the guest drags the map (`touchedRef`) or
   * presses anything.
   */
  const autoFrameRef = useRef<'none' | 'partial' | 'final'>('none');
  const touchedRef = useRef(false);
  const onDragStart = useCallback(() => {
    touchedRef.current = true;
    autoFrameRef.current = 'final';
  }, []);

  const autoFrame = useCallback(() => {
    if (autoFrameRef.current === 'final' || touchedRef.current) return;
    if (!mapRef.current || openingTargets.length === 0) return;
    autoFrameRef.current = !isOperator && !guide ? 'partial' : 'final';
    fitTo(openingTargets);
  }, [openingTargets, isOperator, guide, fitTo]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      autoFrame();
    },
    [autoFrame],
  );
  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  /**
   * Flipping "Share my location" ON takes the guest to their own dot. That is
   * what the switch reads as a promise, and nothing was doing it.
   *
   * One shot per opt-in, and only for a real OFF→ON transition: the ref seeds
   * from the mount-time value, so re-entering the map tab while already sharing
   * leaves the view alone. Continuous re-centering is `followGuide`'s job, and
   * making it implicit here would be the same "map fights your finger" bug in a
   * new costume.
   *
   * Declared BEFORE the auto-frame effect on purpose — effects run in order, so
   * a deliberate opt-in claims the frame ('final') before anything automatic can
   * take it for the same commit.
   */
  const focusedForSharingRef = useRef(sharing);
  useEffect(() => {
    if (!sharing) {
      focusedForSharingRef.current = false;
      return;
    }
    if (focusedForSharingRef.current) return;
    const map = mapRef.current;
    if (!map || !myPoint) return; // the first fix takes a moment — retry on the next frame
    focusedForSharingRef.current = true;
    autoFrameRef.current = 'final';
    map.panTo(myPoint);
    map.setZoom(FOCUS_ZOOM);
  }, [sharing, myPoint]);

  // People arrive over the realtime channel, so at mount there is often nothing
  // to frame. Re-run as targets land; `autoFrame` decides whether it may act.
  useEffect(() => {
    autoFrame();
  }, [autoFrame]);

  // Follow mode: every guide frame pans the map (T3.3 AC — live distance).
  useEffect(() => {
    if (followGuide && guide && mapRef.current) {
      autoFrameRef.current = 'final';
      mapRef.current.panTo({ lat: guide.latitude, lng: guide.longitude });
    }
  }, [followGuide, guide]);

  // One-tap "recenter to me": my live fix if the watcher has one, else ask the
  // device directly (works even when location sharing is off — the common case).
  const recenterToMe = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    autoFrameRef.current = 'final'; // an explicit ask ends automatic framing
    if (myPoint) {
      map.panTo(myPoint);
      map.setZoom(FOCUS_ZOOM);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          map.setZoom(FOCUS_ZOOM);
        },
        () => {
          /* denied/unavailable — the button just no-ops */
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  }, [myPoint]);

  // Re-fit the map to everyone + every stop (undo an accidental zoom-out).
  const fitAll = useCallback(() => {
    autoFrameRef.current = 'final';
    fitTo(allPoints);
  }, [allPoints, fitTo]);

  if (loadError || authFailed) {
    const copy = MAP_DOWN[locale];
    const target = pickup && typeof pickup.lat === 'number' && typeof pickup.lng === 'number'
      ? { lat: pickup.lat, lng: pickup.lng, name: pickup.name ?? null }
      : allPoints[0]
        ? { ...allPoints[0], name: null }
        : null;
    return (
      <div
        className="tr-card flex h-full min-h-[300px] flex-col items-center justify-center gap-2 px-6 text-center"
        data-testid="map-unavailable"
      >
        <IconFitAll size={TR_ICON.action} className="text-[var(--tr-ink-3)]" aria-hidden />
        <p className="tr-card-text text-cjk-body font-bold text-[var(--tr-ink)]">{copy.title}</p>
        <p className="tr-meta text-cjk-body text-[var(--tr-ink-2)]">{copy.body}</p>
        {target && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`}
            target="_blank"
            rel="noreferrer"
            className="tr-label tr-press text-cjk-safe mt-1 rounded-full bg-[var(--tr-accent)] px-4 py-2 font-bold text-[var(--tr-on-accent)]"
            data-testid="map-unavailable-open"
          >
            {copy.open}
          </a>
        )}
      </div>
    );
  }

  if (!isLoaded || !icons) {
    return (
      <div className="tr-skeleton flex h-full min-h-[300px] items-center justify-center rounded-[var(--tr-radius-card)]">
        <span className="tr-card-text text-[var(--tr-ink-3)]">{MAP_DOWN[locale].loading}</span>
      </div>
    );
  }

  const control = MAP_CONTROL[locale];

  return (
    <div className="relative h-full w-full">
      {/* Map controls — one card with a hairline between the buttons rather than
          two loose bubbles, which is how Kakao and Naver stack theirs. Bottom
          LEFT keeps them clear of the native zoom control on the right. */}
      <div
        className="absolute bottom-3 left-3 z-10 overflow-hidden rounded-[14px] bg-[var(--tr-surface)]"
        style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
      >
        <button
          type="button"
          onClick={recenterToMe}
          aria-label={control.recenter}
          className="flex h-11 w-11 items-center justify-center text-[var(--tr-accent-deep)] active:bg-[var(--tr-bubble-system)]"
          data-testid="map-recenter-me"
        >
          <IconRecenter size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
        </button>
        <div className="mx-2 h-px bg-[var(--tr-hairline)]" aria-hidden />
        <button
          type="button"
          onClick={fitAll}
          aria-label={control.fitAll}
          className="flex h-11 w-11 items-center justify-center text-[var(--tr-ink-2)] active:bg-[var(--tr-bubble-system)]"
          data-testid="map-fit-all"
        >
          <IconFitAll size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
        </button>
      </div>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%', minHeight: '300px', borderRadius: 'var(--tr-radius-card)' }}
        center={center}
        zoom={14}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onDragStart={onDragStart}
        options={mapOptions}
      >
      {/* numbered spot pins */}
      {spots.map((spot, index) =>
        typeof spot.latitude === 'number' && typeof spot.longitude === 'number' ? (
          <Marker
            key={`spot-${spot.id}`}
            position={{ lat: spot.latitude, lng: spot.longitude }}
            title={spot.title ?? undefined}
            label={{ text: String(index + 1), color: '#ffffff', fontSize: '11px', fontWeight: '700' }}
            icon={icons.stop}
          />
        ) : null,
      )}

      {/* facilities (subtle) */}
      {facilities.map((f, i) =>
        typeof f.lat === 'number' && typeof f.lng === 'number' ? (
          <Marker
            key={`facility-${i}`}
            position={{ lat: f.lat, lng: f.lng }}
            title={f.name ?? undefined}
            icon={icons.facility}
          />
        ) : null,
      )}

      {/* my pickup point */}
      {pickup && typeof pickup.lat === 'number' && typeof pickup.lng === 'number' && (
        <Marker
          position={{ lat: pickup.lat, lng: pickup.lng }}
          title={pickup.name ?? 'Pickup'}
          label={{ text: 'P', color: '#ffffff', fontSize: '11px', fontWeight: '700' }}
          icon={icons.pickup}
        />
      )}

      {/* Me, from this device — only when the room has no echo of me yet. The
          publish path drops samples coarser than 100 m and throttles to 15 s,
          so "sharing is live but I am not on the map" was the normal state on
          any Wi-Fi fix, not an edge case. */}
      {!myEcho && myPoint && <Marker position={myPoint} zIndex={20} icon={icons.me} />}

      {/* people */}
      {people.map((person) => {
        // 🔴 Guide AND driver both get the vehicle pin. On a driver-run tour the
        // person the guest is waiting for has role 'driver', and they used to be
        // drawn as an anonymous grey initial among the other travellers.
        const isVehicle = person.role === 'guide' || person.role === 'driver';
        const isMe = person.participant_id === myParticipantId;
        return (
          <Marker
            key={`person-${person.participant_id}`}
            /* My own echo is up to 15s stale by design (§O-5 throttle); the
               watcher's fix is current, so my dot rides that instead. */
            position={isMe && myPoint ? myPoint : { lat: person.latitude, lng: person.longitude }}
            title={person.display_name ?? undefined}
            zIndex={isVehicle ? 30 : isMe ? 20 : 10}
            /* The vehicle carries its glyph inside the pin art (사장님: 자동차
               아이콘) and "me" is the blue dot every phone map has taught people
               to read — neither wants a letter stamped on it. Other travellers
               keep an initial so a group of six stays readable. */
            label={
              isVehicle || isMe
                ? undefined
                : {
                    text: initialOf(person.display_name),
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '700',
                  }
            }
            icon={isVehicle ? icons.vehicle : isMe ? icons.me : icons.companion}
          />
        );
      })}
      </GoogleMap>
    </div>
  );
}
