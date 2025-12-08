'use client';

import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { useRef, useState } from 'react';

interface PlaceSearchProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
  countryRestriction?: string; // 例如 'kr' 表示韩国
  types?: string[]; // 例如 ['establishment', 'geocode']
}

export default function PlaceSearch({
  onPlaceSelect,
  placeholder = 'Search for a location...',
  className = '',
  countryRestriction = 'kr',
  types = ['establishment', 'geocode'],
}: PlaceSearchProps) {
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: ['places'],
  });

  const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
    setAutocomplete(autocomplete);
  };

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place && place.geometry) {
        onPlaceSelect(place);
      }
    }
  };

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
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{
        types: types,
        componentRestrictions: countryRestriction ? { country: countryRestriction } : undefined,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        className={className}
      />
    </Autocomplete>
  );
}

