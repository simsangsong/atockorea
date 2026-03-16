'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { mapOptions, defaultCenter, libraries, geocodeAddress } from '@/lib/google-maps';
import { useTranslations } from '@/lib/i18n';

const JEJU_CENTER = { lat: 33.4996, lng: 126.5312 };
const GEOCODE_LIMIT = 20;

type GmpSelectEvent = Event & { placePrediction?: { toPlace: () => Promise<google.maps.places.Place> } };

interface SchedulePlace {
  name: string;
  address: string;
  type?: string;
}

interface DaySchedule {
  day: number;
  places: SchedulePlace[];
}

interface ItineraryMapWithSearchProps {
  schedule: DaySchedule[];
  onAddPlace: (dayIndex: number, name: string, address: string) => void;
  /** 제주 등 목적지에 맞춰 지도 중심/검색 편향 */
  destination?: 'jeju' | 'busan' | 'seoul';
}

interface MapLocation {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  id: string;
}

export default function ItineraryMapWithSearch({
  schedule,
  onAddPlace,
  destination = 'jeju',
}: ItineraryMapWithSearchProps) {
  const t = useTranslations();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [placeApiNewUnavailable, setPlaceApiNewUnavailable] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; address: string } | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [mapLocations, setMapLocations] = useState<MapLocation[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  const mapCenter = useMemo(() => {
    if (destination === 'busan') return { lat: 35.1796, lng: 129.0756 };
    if (destination === 'seoul') return defaultCenter;
    return JEJU_CENTER;
  }, [destination]);

  const allPlaces = useMemo(() => {
    const list: { name: string; address: string; day: number }[] = [];
    schedule.forEach((daySchedule, dayIndex) => {
      daySchedule.places.forEach((p) => {
        if (p.name?.trim() || p.address?.trim()) {
          list.push({ name: p.name || '', address: p.address || '', day: daySchedule.day });
        }
      });
    });
    return list;
  }, [schedule]);

  useEffect(() => {
    if (!isLoaded || allPlaces.length === 0) {
      setMapLocations([]);
      return;
    }
    let cancelled = false;
    setIsGeocoding(true);
    const run = async () => {
      const results: MapLocation[] = [];
      const toGeocode = allPlaces.slice(0, GEOCODE_LIMIT);
      for (let i = 0; i < toGeocode.length; i++) {
        if (cancelled) return;
        const p = toGeocode[i];
        const addr = p.address?.trim() || p.name?.trim();
        if (!addr) continue;
        try {
          const coords = await geocodeAddress(addr);
          if (coords) {
            results.push({
              lat: coords.lat,
              lng: coords.lng,
              name: p.name,
              address: p.address,
              id: `place-${p.day}-${i}`,
            });
          }
        } catch {
          // skip failed geocode
        }
      }
      if (!cancelled) setMapLocations(results);
      setIsGeocoding(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, allPlaces]);

  // Places API (New) only — PlaceAutocompleteElement. Legacy Autocomplete 사용 금지.
  useEffect(() => {
    if (!isLoaded || !apiKey || !searchContainerRef.current || typeof google === 'undefined') return;

    const PlacesLibrary = google.maps.places;
    const PlaceAutocompleteElement = (PlacesLibrary as unknown as { PlaceAutocompleteElement?: new (opts?: object) => HTMLElement }).PlaceAutocompleteElement;

    if (!PlaceAutocompleteElement) {
      setPlaceApiNewUnavailable(true);
      return;
    }

    const center = mapCenter;
    const container = searchContainerRef.current;
    const placeAutocomplete = new PlaceAutocompleteElement({
      locationBias: new google.maps.Circle({ center, radius: 50000 }),
      includedRegionCodes: ['kr'],
    }) as HTMLElement;

    placeAutocomplete.id = 'place-autocomplete-itinerary';
    container.innerHTML = '';
    container.appendChild(placeAutocomplete);

    const handleSelect = async (ev: Event) => {
      const e = ev as GmpSelectEvent;
      if (!e.placePrediction) return;
      try {
        const place = await e.placePrediction.toPlace();
        await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
        const name = (place.displayName as string) || '';
        const address = (place.formattedAddress as string) || '';
        if (!name && !address) return;
        setSelectedPlace({ name, address });
        const loc = place.location;
        if (map && loc) {
          const lat = typeof loc.lat === 'function' ? loc.lat() : (loc as unknown as { lat: number }).lat;
          const lng = typeof loc.lng === 'function' ? loc.lng() : (loc as unknown as { lng: number }).lng;
          map.setCenter({ lat: Number(lat), lng: Number(lng) });
          map.setZoom(15);
        }
      } catch (err) {
        console.error('Place fetchFields error:', err);
      }
    };

    placeAutocomplete.addEventListener('gmp-select', handleSelect);
    return () => {
      placeAutocomplete.removeEventListener('gmp-select', handleSelect);
      if (container.contains(placeAutocomplete)) container.removeChild(placeAutocomplete);
    };
  }, [isLoaded, apiKey, mapCenter, map]);

  const handleAddToItinerary = useCallback(() => {
    if (!selectedPlace) return;
    onAddPlace(selectedDayIndex, selectedPlace.name, selectedPlace.address);
    setSelectedPlace(null);
  }, [selectedPlace, selectedDayIndex, onAddPlace]);

  const onMapLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const onMapUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (!apiKey) {
    return (
      <div className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center">
        <p className="text-sm text-neutral-500">{t('home.customJoinTour.mapApiKeyRequired')}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{t('home.customJoinTour.mapLoadError')}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
      <div className="p-4 border-b border-neutral-100">
        <h3 className="text-sm font-bold text-neutral-900 mb-3">{t('home.customJoinTour.mapSearchTitle')}</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0 min-h-[42px]">
            {placeApiNewUnavailable ? (
              <p className="text-amber-600 text-sm py-1">Places API (New)를 사용할 수 없습니다.</p>
            ) : (
              <div className="w-full min-h-[42px]" ref={searchContainerRef} />
            )}
          </div>
          {selectedPlace && (
            <>
              <select
                value={selectedDayIndex}
                onChange={(e) => setSelectedDayIndex(Number(e.target.value))}
                className="px-3 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white min-w-[100px]"
              >
                {schedule.map((d, i) => (
                  <option key={d.day} value={i}>
                    {t('home.customJoinTour.dayLabel').replace('{{n}}', String(d.day))}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddToItinerary}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-neutral-900/90 backdrop-blur-md border border-white/10 shadow-lg shadow-black/20 hover:bg-neutral-800/95 rounded-xl whitespace-nowrap transition-colors"
              >
                {t('home.customJoinTour.addToItinerary')}
              </button>
            </>
          )}
        </div>
        {selectedPlace && (
          <p className="mt-2 text-xs text-neutral-500">
            {t('home.customJoinTour.placeToAdd')}: <span className="font-medium text-neutral-700">{selectedPlace.name || selectedPlace.address}</span>
          </p>
        )}
      </div>

      <div className="relative" style={{ height: '320px' }}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={mapCenter}
          zoom={10}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          options={mapOptions}
        >
          {mapLocations.map((loc) => (
            <Marker
              key={loc.id}
              position={{ lat: loc.lat, lng: loc.lng }}
              title={loc.name || loc.address}
            />
          ))}
        </GoogleMap>
        {isGeocoding && mapLocations.length === 0 && allPlaces.length > 0 && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-sm text-neutral-600">{t('home.customJoinTour.mapLoadingPlaces')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
