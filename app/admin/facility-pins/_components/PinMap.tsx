'use client';

/**
 * Interactive map for the facility-pins admin editor (W1.2).
 *
 * Shows the attraction centre + its restroom/photo pins, and click-to-add a new
 * pin. GoogleMap + Marker only (no Polyline) — safe against the repo's known
 * @react-google-maps/api Polyline crash. Loaded via dynamic(ssr:false) by the
 * page so the Maps SDK stays out of the initial admin bundle.
 */

import { useCallback, useEffect, useRef } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import {
  libraries,
  GOOGLE_MAPS_LOADER_ID,
  GOOGLE_MAPS_LOADER_VERSION,
} from '@/lib/google-maps';

export interface EditorPin {
  id: string;
  kind: 'restroom' | 'photo';
  lat: number;
  lng: number;
  is_active: boolean;
}

const KIND_FILL: Record<'restroom' | 'photo', string> = {
  restroom: '#2563eb',
  photo: '#db2777',
};

export default function PinMap({
  center,
  pins,
  selectedId,
  onSelectPin,
  onAddPin,
}: {
  center: { lat: number; lng: number };
  pins: EditorPin[];
  selectedId: string | null;
  onSelectPin: (id: string) => void;
  onAddPin: (lat: number, lng: number) => void;
}) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
    version: GOOGLE_MAPS_LOADER_VERSION,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const fittedKeyRef = useRef<string>('');

  const active = pins.filter((p) => p.is_active);

  const fit = useCallback(
    (map: google.maps.Map) => {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(center);
      active.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      if (active.length === 0) {
        map.setCenter(center);
        map.setZoom(16);
      } else {
        map.fitBounds(bounds, 64);
      }
    },
    [center, active],
  );

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      fit(map);
    },
    [fit],
  );

  // Re-fit when the POI changes (center moves) — not on every pin edit.
  useEffect(() => {
    const key = `${center.lat},${center.lng}`;
    if (mapRef.current && fittedKeyRef.current !== key) {
      fittedKeyRef.current = key;
      fit(mapRef.current);
    }
  }, [center, fit]);

  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg bg-slate-100">
        <span className="text-sm text-slate-500">지도 불러오는 중…</span>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', minHeight: '360px', borderRadius: '0.5rem' }}
      center={center}
      zoom={16}
      onLoad={onLoad}
      onUnmount={() => {
        mapRef.current = null;
      }}
      onClick={(e) => {
        if (e.latLng) onAddPin(e.latLng.lat(), e.latLng.lng());
      }}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      }}
    >
      {/* attraction centre (grey diamond) */}
      <Marker
        position={center}
        title="관광지 중심"
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#64748b',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        }}
        zIndex={1}
      />
      {active.map((p, i) => (
        <Marker
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          title={p.kind}
          onClick={() => onSelectPin(p.id)}
          label={{ text: String(i + 1), color: '#ffffff', fontSize: '11px', fontWeight: '700' }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: selectedId === p.id ? 13 : 10,
            fillColor: KIND_FILL[p.kind],
            fillOpacity: 1,
            strokeColor: selectedId === p.id ? '#111827' : '#ffffff',
            strokeWeight: selectedId === p.id ? 3 : 2,
          }}
          zIndex={selectedId === p.id ? 10 : 5}
        />
      ))}
    </GoogleMap>
  );
}
