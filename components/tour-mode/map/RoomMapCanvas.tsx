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

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import {
  GOOGLE_MAPS_LOADER_ID,
  GOOGLE_MAPS_LOADER_VERSION,
  libraries as GOOGLE_MAPS_LIBRARIES,
} from '@/lib/google-maps';
import type { RoomLocation } from '@/hooks/useTourRoomChannel';

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

export default function RoomMapCanvas({
  locations,
  myParticipantId,
  spots,
  facilities,
  pickup,
  followGuide,
}: {
  locations: Record<string, RoomLocation>;
  myParticipantId: string | null;
  spots: MapSpot[];
  facilities: MapPoint[];
  pickup: MapPoint | null;
  followGuide: boolean;
}) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: GOOGLE_MAPS_LOADER_VERSION,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const fittedRef = useRef(false);

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

  if (!isLoaded) {
    return (
      <div className="tr-skeleton flex h-full min-h-[300px] items-center justify-center rounded-[var(--tr-radius-card)]">
        <span className="tr-card-text text-[var(--tr-ink-3)]">Loading map…</span>
      </div>
    );
  }

  const center = guide
    ? { lat: guide.latitude, lng: guide.longitude }
    : allPoints[0] ?? { lat: 37.5665, lng: 126.978 };

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', minHeight: '300px', borderRadius: '16px' }}
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
  );
}
