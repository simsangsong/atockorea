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
import type { RoomLocation } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

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
}: {
  locations: Record<string, RoomLocation>;
  myParticipantId: string | null;
  spots: MapSpot[];
  facilities: MapPoint[];
  pickup: MapPoint | null;
  followGuide: boolean;
  locale: RoomLocale;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: GOOGLE_MAPS_LOADER_VERSION,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const fittedRef = useRef(false);
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

  const people = useMemo(() => Object.values(locations), [locations]);
  const guide = people.find((p) => p.role === 'guide') ?? null;

  const allPoints = useMemo(() => {
    const pts: Array<{ lat: number; lng: number }> = [];
    for (const p of people) pts.push({ lat: p.latitude, lng: p.longitude });
    for (const s of spots) {
      if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
        pts.push({ lat: s.latitude, lng: s.longitude });
      }
    }
    if (pickup && typeof pickup.lat === 'number' && typeof pickup.lng === 'number') {
      pts.push({ lat: pickup.lat, lng: pickup.lng });
    }
    return pts;
  }, [people, spots, pickup]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (allPoints.length > 0 && !fittedRef.current) {
        fittedRef.current = true;
        const bounds = new google.maps.LatLngBounds();
        allPoints.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, 48);
      }
    },
    [allPoints],
  );
  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Follow mode: every guide frame pans the map (T3.3 AC — live distance).
  useEffect(() => {
    if (followGuide && guide && mapRef.current) {
      mapRef.current.panTo({ lat: guide.latitude, lng: guide.longitude });
    }
  }, [followGuide, guide]);

  // One-tap "recenter to me": prefer my shared marker, else ask the device
  // (works even when location sharing is off — the common case).
  const recenterToMe = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const mine = myParticipantId ? locations[myParticipantId] : null;
    if (mine) {
      map.panTo({ lat: mine.latitude, lng: mine.longitude });
      map.setZoom(16);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          map.setZoom(16);
        },
        () => {
          /* denied/unavailable — the button just no-ops */
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  }, [locations, myParticipantId]);

  // Re-fit the map to everyone + every stop (undo an accidental zoom-out).
  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || allPoints.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    allPoints.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 48);
  }, [allPoints]);

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

  if (!isLoaded) {
    return (
      <div className="tr-skeleton flex h-full min-h-[300px] items-center justify-center rounded-[var(--tr-radius-card)]">
        <span className="tr-card-text text-[var(--tr-ink-3)]">{MAP_DOWN[locale].loading}</span>
      </div>
    );
  }

  const center = guide
    ? { lat: guide.latitude, lng: guide.longitude }
    : allPoints[0] ?? { lat: 37.5665, lng: 126.978 };

  return (
    <div className="relative h-full w-full">
      {/* Map option controls — recenter to me + fit everyone (bottom-left, clear
          of the native zoom control on the right). */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={recenterToMe}
          aria-label="내 위치로"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tr-surface)] text-[var(--tr-accent-deep)] active:scale-95"
          style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
          data-testid="map-recenter-me"
        >
          <IconRecenter size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
        </button>
        <button
          type="button"
          onClick={fitAll}
          aria-label="전체 보기"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tr-surface)] text-[var(--tr-ink-2)] active:scale-95"
          style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
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
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          styles: MAP_STYLE,
        }}
      >
      {/* numbered spot pins */}
      {spots.map((spot, index) =>
        typeof spot.latitude === 'number' && typeof spot.longitude === 'number' ? (
          <Marker
            key={`spot-${spot.id}`}
            position={{ lat: spot.latitude, lng: spot.longitude }}
            title={spot.title ?? undefined}
            label={{ text: String(index + 1), color: '#ffffff', fontSize: '11px', fontWeight: '700' }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 11,
              fillColor: '#f59e0b',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
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
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 5,
              fillColor: '#9ca3af',
              fillOpacity: 0.9,
              strokeColor: '#ffffff',
              strokeWeight: 1,
            }}
          />
        ) : null,
      )}

      {/* my pickup point */}
      {pickup && typeof pickup.lat === 'number' && typeof pickup.lng === 'number' && (
        <Marker
          position={{ lat: pickup.lat, lng: pickup.lng }}
          title={pickup.name ?? 'Pickup'}
          label={{ text: 'P', color: '#ffffff', fontSize: '11px', fontWeight: '700' }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }}
        />
      )}

      {/* people */}
      {people.map((person) => {
        const isGuide = person.role === 'guide';
        const isMe = person.participant_id === myParticipantId;
        return (
          <Marker
            key={`person-${person.participant_id}`}
            position={{ lat: person.latitude, lng: person.longitude }}
            title={person.display_name ?? undefined}
            zIndex={isGuide ? 30 : isMe ? 20 : 10}
            label={
              isGuide
                ? { text: '🚌', fontSize: '16px' }
                : {
                    text: initialOf(person.display_name),
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '700',
                  }
            }
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: isGuide ? 14 : 9,
              fillColor: isGuide ? '#111827' : isMe ? '#2563eb' : '#6b7280',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        );
      })}
      </GoogleMap>
    </div>
  );
}
