'use client';

import { useLoadScript } from '@react-google-maps/api';
import { useRef, useEffect } from 'react';
import { libraries } from '@/lib/google-maps';

type GmpSelectEvent = Event & { placePrediction?: { toPlace: () => Promise<google.maps.places.Place> } };

interface PlaceSearchProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
  countryRestriction?: string;
  types?: string[];
}

/**
 * Place search using Places API (New) PlaceAutocompleteElement.
 * Requires Places API (New) enabled in Google Cloud and script v=weekly.
 */
export default function PlaceSearch({
  onPlaceSelect,
  placeholder = 'Search for a location...',
  className = '',
  countryRestriction = 'kr',
}: PlaceSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
    version: 'weekly',
  });

  useEffect(() => {
    if (!isLoaded || !apiKey || !containerRef.current || typeof google === 'undefined') return;

    const PlacesLibrary = google.maps.places;
    const PlaceAutocompleteElement = (PlacesLibrary as unknown as { PlaceAutocompleteElement?: new (opts?: object) => HTMLElement })
      .PlaceAutocompleteElement;
    if (!PlaceAutocompleteElement) {
      return;
    }

    const container = containerRef.current;
    const el = new PlaceAutocompleteElement({
      includedRegionCodes: countryRestriction ? [countryRestriction] : undefined,
    }) as HTMLElement;
    el.id = 'place-search-autocomplete';
    container.innerHTML = '';
    container.appendChild(el);

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
        // Legacy PlaceResult-like shape for compatibility
        onPlaceSelect({
          name: (place.displayName as string) || undefined,
          formatted_address: (place.formattedAddress as string) || undefined,
          geometry: {
            location: {
              lat: () => Number(lat),
              lng: () => Number(lng),
            } as google.maps.LatLng,
          },
        } as google.maps.places.PlaceResult);
      } catch (err) {
        console.error('Place fetchFields error:', err);
      }
    };

    el.addEventListener('gmp-select', handleSelect);
    return () => {
      el.removeEventListener('gmp-select', handleSelect);
      if (container.contains(el)) container.removeChild(el);
    };
  }, [isLoaded, apiKey, countryRestriction, onPlaceSelect]);

  if (!apiKey) {
    return (
      <input
        type="text"
        placeholder="Google Maps API key not configured"
        className={className}
        disabled
      />
    );
  }

  if (loadError) {
    return (
      <input
        type="text"
        placeholder="Error loading Google Maps"
        className={className}
        disabled
      />
    );
  }

  if (!isLoaded) {
    return (
      <input
        type="text"
        placeholder="Loading..."
        className={className}
        disabled
      />
    );
  }

  return (
    <div
      className={className}
      ref={containerRef}
      style={{ minHeight: 40 }}
    />
  );
}
