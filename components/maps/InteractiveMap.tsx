'use client';

import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
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

  return (
    <div className="w-full rounded-lg overflow-hidden shadow-lg" style={{ height }}>
      <LoadScript
        googleMapsApiKey={apiKey}
        libraries={['places']}
      >
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
      </LoadScript>
    </div>
  );
}

