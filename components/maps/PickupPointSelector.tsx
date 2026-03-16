'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { mapOptions, defaultCenter, libraries } from '@/lib/google-maps';

// Places API (New) PlaceAutocompleteElement - gmp-select event type
type GmpSelectEvent = Event & { placePrediction?: { toPlace: () => Promise<google.maps.places.Place> } };

interface PickupPointSelectorProps {
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  initialLocation?: { lat: number; lng: number; address?: string };
  height?: string;
  className?: string;
}

export default function PickupPointSelector({
  onLocationSelect,
  initialLocation,
  height = '400px',
  className = '',
}: PickupPointSelectorProps) {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(
    initialLocation
      ? {
          lat: initialLocation.lat,
          lng: initialLocation.lng,
          address: initialLocation.address || '',
        }
      : null
  );
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [placeApiNewUnavailable, setPlaceApiNewUnavailable] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onMapUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const onMapClick = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;

      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      setIsGeocoding(true);
      try {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });

        const address =
          response.results && response.results.length > 0
            ? response.results[0].formatted_address
            : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        const location = { lat, lng, address };
        setSelectedLocation(location);
        onLocationSelect(location);
      } catch (error) {
        console.error('Geocoding error:', error);
        const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        const location = { lat, lng, address };
        setSelectedLocation(location);
        onLocationSelect(location);
      } finally {
        setIsGeocoding(false);
      }
    },
    [onLocationSelect]
  );

  // Places API (New) only — PlaceAutocompleteElement. Legacy Autocomplete 사용 금지.
  useEffect(() => {
    if (!isLoaded || !apiKey || !autocompleteContainerRef.current || typeof google === 'undefined') return;

    const PlacesLibrary = google.maps.places;
    const PlaceAutocompleteElement = (PlacesLibrary as unknown as { PlaceAutocompleteElement?: new (opts?: object) => HTMLElement })
      .PlaceAutocompleteElement;

    if (!PlaceAutocompleteElement) {
      setPlaceApiNewUnavailable(true);
      return;
    }

    const container = autocompleteContainerRef.current;
    const placeAutocomplete = new PlaceAutocompleteElement({
      locationBias: new google.maps.Circle({
        center: defaultCenter,
        radius: 50000,
      }),
      includedRegionCodes: ['kr'],
    }) as HTMLElement;

    placeAutocomplete.id = 'place-autocomplete-pickup';
    container.innerHTML = '';
    container.appendChild(placeAutocomplete);

    const handleSelect = async (ev: Event) => {
      const e = ev as GmpSelectEvent;
      if (!e.placePrediction) return;
      try {
        const place = await e.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
        const loc = place.location;
        if (!loc) return;
        const lat = typeof loc.lat === 'function' ? loc.lat() : (loc as unknown as { lat: number }).lat;
        const lng = typeof loc.lng === 'function' ? loc.lng() : (loc as unknown as { lng: number }).lng;
        const address =
          (place.formattedAddress as string) || (place.displayName as string) || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        const location = { lat: Number(lat), lng: Number(lng), address };
        setSelectedLocation(location);
        onLocationSelect(location);
        if (map) {
          map.setCenter({ lat: location.lat, lng: location.lng });
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
  }, [isLoaded, apiKey, onLocationSelect, map]);

  if (!apiKey) {
    return (
      <div className={`w-full bg-gray-200 rounded-lg flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-gray-500">Google Maps API key not configured</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`w-full bg-red-50 rounded-lg flex items-center justify-center border border-red-200 ${className}`} style={{ height }}>
        <div className="text-center p-4">
          <p className="text-red-600 font-semibold mb-1">Error loading Google Maps</p>
          <p className="text-red-500 text-sm">{loadError.message || 'Failed to load Google Maps API'}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`w-full bg-gray-100 rounded-lg flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4">
        {placeApiNewUnavailable ? (
          <p className="text-amber-600 text-sm py-2">Places API (New)를 사용할 수 없습니다. Google Cloud Console에서 활성화해 주세요.</p>
        ) : (
          <div
            className="[&_.gmp-place-autocomplete]:!w-full [&_.gmp-place-autocomplete]:!rounded-lg [&_.gmp-place-autocomplete]:!border [&_.gmp-place-autocomplete]:!border-gray-300 [&_.gmp-place-autocomplete]:!min-h-[48px]"
            ref={autocompleteContainerRef}
          />
        )}
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden shadow-lg border border-gray-200" style={{ height }}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={selectedLocation || defaultCenter}
          zoom={selectedLocation ? 15 : 13}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          onClick={onMapClick}
          options={mapOptions}
        >
          {selectedLocation && (
            <Marker
              position={selectedLocation}
              title={selectedLocation.address}
              draggable={true}
              onDragEnd={async (e) => {
                if (!e.latLng) return;
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();

                setIsGeocoding(true);
                try {
                  const geocoder = new google.maps.Geocoder();
                  const response = await geocoder.geocode({ location: { lat, lng } });

                  const address =
                    response.results && response.results.length > 0
                      ? response.results[0].formatted_address
                      : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

                  const location = { lat, lng, address };
                  setSelectedLocation(location);
                  onLocationSelect(location);
                } catch (error) {
                  console.error('Geocoding error:', error);
                  const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                  const location = { lat, lng, address };
                  setSelectedLocation(location);
                  onLocationSelect(location);
                } finally {
                  setIsGeocoding(false);
                }
              }}
            />
          )}
        </GoogleMap>
      </div>

      {selectedLocation && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">Selected Pickup Point:</p>
              <p className="text-sm text-gray-900 font-semibold">{selectedLocation.address}</p>
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
            {isGeocoding && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            )}
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-500">
        💡 Tip: Click on the map to select a location, or use the search box to find a place
      </p>
    </div>
  );
}
