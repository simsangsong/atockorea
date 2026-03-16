'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { mapOptions, defaultCenter, libraries } from '@/lib/google-maps';
import { X, MapPin } from 'lucide-react';

type GmpSelectEvent = Event & { placePrediction?: { toPlace: () => Promise<google.maps.places.Place> } };

export interface HotelInfo {
  address: string;
  lat: number;
  lng: number;
  placeName?: string;
}

interface HotelMapPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (info: HotelInfo) => void;
}

const JEJU_CENTER = { lat: 33.4996, lng: 126.5312 };

export default function HotelMapPicker({ open, onClose, onConfirm }: HotelMapPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string; placeName?: string } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [placeApiNewUnavailable, setPlaceApiNewUnavailable] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  const onMapLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
    m.setCenter(JEJU_CENTER);
    m.setZoom(11);
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
          response.results?.[0]?.formatted_address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSelectedLocation({ lat, lng, address });
        if (map) {
          map.setCenter({ lat, lng });
          map.setZoom(15);
        }
      } catch {
        setSelectedLocation({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
      } finally {
        setIsGeocoding(false);
      }
    },
    [map]
  );

  useEffect(() => {
    if (!open) setSelectedLocation(null);
  }, [open]);

  // Places API (New) only — PlaceAutocompleteElement. Legacy Autocomplete 사용 금지.
  useEffect(() => {
    if (!open || !isLoaded || !apiKey || !searchContainerRef.current || typeof google === 'undefined') return;
    const PlacesLibrary = google.maps?.places;
    if (!PlacesLibrary) {
      setPlaceApiNewUnavailable(true);
      return;
    }
    const PlaceAutocompleteElement = (PlacesLibrary as unknown as { PlaceAutocompleteElement?: new (opts?: object) => HTMLElement }).PlaceAutocompleteElement;
    if (!PlaceAutocompleteElement) {
      setPlaceApiNewUnavailable(true);
      return;
    }
    const container = searchContainerRef.current;
    let el: HTMLElement;
    try {
      const center = new google.maps.LatLng(JEJU_CENTER.lat, JEJU_CENTER.lng);
      el = new PlaceAutocompleteElement({
        locationBias: new google.maps.Circle({ center, radius: 50000 }),
        includedRegionCodes: ['kr'],
      }) as HTMLElement;
    } catch {
      setPlaceApiNewUnavailable(true);
      return;
    }
    setPlaceApiNewUnavailable(false);
    el.id = 'place-autocomplete-hotel';
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
        const loc = place.location as unknown;
        if (!loc) return;
        const locObj = loc as { lat?: number | (() => number); lng?: number | (() => number) };
        const latVal = locObj.lat;
        const lngVal = locObj.lng;
        const lat = typeof latVal === 'number' ? latVal : typeof latVal === 'function' ? latVal() : NaN;
        const lng = typeof lngVal === 'number' ? lngVal : typeof lngVal === 'function' ? lngVal() : NaN;
        const address = (place.formattedAddress as string) ?? (place.displayName as string) ?? '';
        setSelectedLocation({ lat: Number(lat), lng: Number(lng), address, placeName: place.displayName as string | undefined });
        if (map) {
          map.setCenter({ lat: Number(lat), lng: Number(lng) });
          map.setZoom(15);
        }
      } catch (err) {
        console.error('Place fetch error:', err);
      }
    };
    el.addEventListener('gmp-select', handleSelect);
    return () => {
      el.removeEventListener('gmp-select', handleSelect);
      if (container.contains(el)) container.removeChild(el);
    };
  }, [isLoaded, apiKey, open, map]);

  const handleConfirm = useCallback(() => {
    if (!selectedLocation) return;
    onConfirm({
      address: selectedLocation.address,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      placeName: selectedLocation.placeName,
    });
    onClose();
  }, [selectedLocation, onConfirm, onClose]);

  if (typeof document === 'undefined') return null;

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0d1a2e] rounded-2xl border border-cyan-500/30 shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Hotel Information
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {!apiKey && (
                <p className="text-amber-400 text-sm py-4">Google Maps API key not configured.</p>
              )}
              {apiKey && loadError && (
                <p className="text-rose-400 text-sm py-4">{loadError.message}</p>
              )}
              {apiKey && isLoaded && (
                <>
                  <div className="mb-3">
                    {placeApiNewUnavailable ? (
                      <p className="text-amber-400 text-sm py-2">Places API (New)를 사용할 수 없습니다. Google Cloud Console에서 활성화해 주세요.</p>
                    ) : (
                      <div
                        className="[&_.gmp-place-autocomplete]:!w-full [&_.gmp-place-autocomplete]:!rounded-lg [&_.gmp-place-autocomplete]:!min-h-[44px] [&_.gmp-place-autocomplete]:!bg-white/5 [&_.gmp-place-autocomplete]:!border [&_.gmp-place-autocomplete]:!border-cyan-500/30"
                        ref={searchContainerRef}
                      />
                    )}
                  </div>
                  <div className="rounded-xl overflow-hidden border border-cyan-500/20 h-64">
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={selectedLocation ?? JEJU_CENTER}
                      zoom={selectedLocation ? 15 : 11}
                      onLoad={onMapLoad}
                      onClick={onMapClick}
                      options={mapOptions}
                    >
                      {selectedLocation && (
                        <Marker
                          position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
                          title={selectedLocation.address}
                        />
                      )}
                    </GoogleMap>
                  </div>
                  {selectedLocation && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <p className="text-xs text-cyan-300 font-medium truncate">{selectedLocation.placeName ?? selectedLocation.address}</p>
                      {selectedLocation.placeName && selectedLocation.address !== selectedLocation.placeName && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{selectedLocation.address}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-4 py-3 border-t border-white/10 flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedLocation || isGeocoding}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-cyan-500/20 border border-cyan-400 text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
