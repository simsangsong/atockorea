'use client';

/**
 * W3.4 — the all-tours map canvas: every room's live participants/guides on
 * one Google Map, colored by the room's stable hue (T6.2 roomHue) so markers
 * from different rooms never read as one group. Tapping any marker opens
 * that room's drawer. Modeled on RoomMapCanvas (same loader constants, same
 * dynamic-import split so the Maps SDK stays out of the initial bundle).
 */

import { useCallback, useMemo, useRef } from 'react';
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

export interface OpsMapRoom {
  roomId: string;
  label: string;
  hue: number;
  sos: boolean;
  locations: RoomLocation[];
}

export default function OpsMapCanvas({
  rooms,
  onSelectRoom,
}: {
  rooms: OpsMapRoom[];
  onSelectRoom: (roomId: string) => void;
}) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: GOOGLE_MAPS_LOADER_VERSION,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const fittedRef = useRef(false);

  const allPoints = useMemo(() => {
    const pts: Array<{ lat: number; lng: number }> = [];
    for (const room of rooms) {
      for (const location of room.locations) pts.push({ lat: location.latitude, lng: location.longitude });
    }
    return pts;
  }, [rooms]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (allPoints.length > 0 && !fittedRef.current) {
        fittedRef.current = true;
        const bounds = new google.maps.LatLngBounds();
        allPoints.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, 48);
      }
    },
    [allPoints],
  );
  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl bg-slate-900">
        <span className="text-[13px] text-slate-500">지도를 불러오는 중…</span>
      </div>
    );
  }

  const center = allPoints[0] ?? { lat: 37.5665, lng: 126.978 };

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', minHeight: '300px', borderRadius: '16px' }}
      center={center}
      zoom={12}
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
      {rooms.map((room) =>
        room.locations.map((person) => {
          const isGuide = person.role === 'guide';
          return (
            <Marker
              key={`${room.roomId}-${person.participant_id}`}
              position={{ lat: person.latitude, lng: person.longitude }}
              title={`${room.label}${person.display_name ? ` · ${person.display_name}` : ''}`}
              zIndex={room.sos ? 40 : isGuide ? 30 : 10}
              onClick={() => onSelectRoom(room.roomId)}
              label={
                isGuide
                  ? { text: '🚌', fontSize: '15px' }
                  : room.sos
                    ? { text: '!', color: '#ffffff', fontSize: '12px', fontWeight: '700' }
                    : undefined
              }
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: isGuide ? 13 : 8,
                fillColor: room.sos ? '#ef4444' : `hsl(${room.hue} 60% 50%)`,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
            />
          );
        }),
      )}
    </GoogleMap>
  );
}
