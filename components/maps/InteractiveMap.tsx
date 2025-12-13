'use client';

import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { useState, useCallback } from 'react';
import { mapOptions, defaultCenter } from '@/lib/google-maps';

interface Location {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  id?: string | number;
}

interface InteractiveMapProps {
  locations: Location[];
  center?: Location;
  zoom?: number;
  height?: string;
  onLocationClick?: (location: Location) => void;
  showInfoWindow?: boolean;
}

export default function InteractiveMap({
  locations,
  center = defaultCenter,
  zoom = 13,
  height = '400px',
  onLocationClick,
  showInfoWindow = true,
}: InteractiveMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMarkerClick = (location: Location) => {
    setSelectedLocation(location);
    onLocationClick?.(location);
  };

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: ['places'],
  });

  if (!apiKey) {
    return (
      <div 
        className="w-full bg-gray-200 rounded-lg flex items-center justify-center" 
        style={{ height }}
      >
        <p className="text-gray-500">Google Maps API key not configured</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div 
        className="w-full bg-red-50 rounded-lg flex items-center justify-center border border-red-200" 
        style={{ height }}
      >
        <div className="text-center p-4">
          <p className="text-red-600 font-semibold mb-1">Error loading Google Maps</p>
          <p className="text-red-500 text-sm">{loadError.message || 'Failed to load Google Maps API'}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div 
        className="w-full bg-gray-100 rounded-lg flex items-center justify-center" 
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg overflow-hidden shadow-lg" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {locations.map((location, index) => (
          <Marker
            key={location.id || index}
            position={location}
            title={location.name}
            onClick={() => handleMarkerClick(location)}
          />
        ))}

        {showInfoWindow && selectedLocation && (
          <InfoWindow
            position={selectedLocation}
            onCloseClick={() => setSelectedLocation(null)}
          >
            <div className="p-2">
              {selectedLocation.name && (
                <h3 className="font-semibold text-gray-900 mb-1">
                  {selectedLocation.name}
                </h3>
              )}
              {selectedLocation.address && (
                <p className="text-sm text-gray-600">
                  {selectedLocation.address}
                </p>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

