'use client';

import { useState, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Autocomplete } from '@react-google-maps/api';
import { mapOptions, defaultCenter } from '@/lib/google-maps';

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
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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

      // 反向地理编码获取地址
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

  const onAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    setAutocomplete(autocomplete);
  };

  const onPlaceChanged = useCallback(async () => {
    if (!autocomplete) return;

    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || place.name || '';

    const location = { lat, lng, address };
    setSelectedLocation(location);
    onLocationSelect(location);

    // 移动地图到选中位置
    if (map) {
      map.setCenter({ lat, lng });
      map.setZoom(15);
    }
  }, [autocomplete, map, onLocationSelect]);

  if (!apiKey) {
    return (
      <div className={`w-full bg-gray-200 rounded-lg flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-gray-500">Google Maps API key not configured</p>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <LoadScript 
        googleMapsApiKey={apiKey} 
        libraries={['places']}
        loadingElement={<div style={{ height: '100%' }}>Loading...</div>}
      >
        {/* 搜索框 */}
        <div className="mb-4">
          <Autocomplete
            onLoad={onAutocompleteLoad}
            onPlaceChanged={onPlaceChanged}
            options={{
              types: ['establishment', 'geocode'],
              componentRestrictions: { country: 'kr' }, // 限制为韩国
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索地点或在地图上点击选择..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </Autocomplete>
        </div>

        {/* 地图 */}
        <div 
          className="rounded-lg overflow-hidden shadow-lg border border-gray-200" 
          style={{ height, minHeight: '200px' }}
          data-map-container
        >
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%', minHeight: '200px' }}
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
      </LoadScript>

      {/* 选中位置信息 */}
      {selectedLocation && (
        <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">选中的接送点：</p>
              <p className="text-sm text-gray-900 font-semibold">{selectedLocation.address}</p>
              <p className="text-xs text-gray-500 mt-1">
                坐标: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
            {isGeocoding && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
            )}
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <p className="mt-2 text-xs text-gray-500">
        💡 提示：在地图上点击选择位置，或使用搜索框搜索地点
      </p>
    </div>
  );
}

