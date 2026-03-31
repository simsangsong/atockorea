'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { mapOptions, defaultCenter, libraries } from '@/lib/google-maps';
import { X, MapPin } from 'lucide-react';

/** Basic UI Kit autocomplete — `gmp-select` carries the selected Place (not PlacePrediction). */
type GmpBasicPlaceSelectEvent = Event & { place?: google.maps.places.Place };

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
  /** `brandDark` = cyan/navy (custom tour). `glassLight` = frosted light panel aligned with small-group detail. */
  uiTone?: 'brandDark' | 'glassLight';
  /** Modal title (defaults by tone). */
  title?: string;
  /** Backdrop + modal stacking (e.g. `z-[120]` above mobile sheets). */
  zIndexClass?: string;
  cancelLabel?: string;
  confirmLabel?: string;
}

const JEJU_CENTER = { lat: 33.4996, lng: 126.5312 };

export default function HotelMapPicker({
  open,
  onClose,
  onConfirm,
  uiTone = 'brandDark',
  title,
  zIndexClass,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
}: HotelMapPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string; placeName?: string } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [placeApiNewUnavailable, setPlaceApiNewUnavailable] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
    version: 'weekly',
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

  // Places UI Kit — BasicPlaceAutocompleteElement (dropdown under field). Full PlaceAutocompleteElement opens fullscreen on small viewports.
  useEffect(() => {
    if (!open || !isLoaded || !apiKey || !searchContainerRef.current || typeof google === 'undefined') return;
    const PlacesLibrary = google.maps?.places;
    if (!PlacesLibrary) {
      setPlaceApiNewUnavailable(true);
      return;
    }
    const BasicPlaceAutocompleteElement = (PlacesLibrary as unknown as {
      BasicPlaceAutocompleteElement?: new (opts?: object) => HTMLElement;
    }).BasicPlaceAutocompleteElement;
    if (!BasicPlaceAutocompleteElement) {
      setPlaceApiNewUnavailable(true);
      return;
    }
    const container = searchContainerRef.current;
    let el: HTMLElement;
    try {
      const center = new google.maps.LatLng(JEJU_CENTER.lat, JEJU_CENTER.lng);
      el = new BasicPlaceAutocompleteElement({
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
      const e = ev as GmpBasicPlaceSelectEvent;
      const place = e.place;
      if (!place) return;
      try {
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

  const isLight = uiTone === 'glassLight';
  const stackZ = zIndexClass ?? (isLight ? 'z-[120]' : 'z-[100]');
  const heading =
    title ??
    (isLight ? 'Find your hotel' : 'Hotel Information');

  const backdropCls = isLight
    ? `fixed inset-0 ${stackZ} flex items-center justify-center p-4 bg-black/45 backdrop-blur-[3px]`
    : `fixed inset-0 ${stackZ} flex items-center justify-center p-4 bg-black/60`;

  const panelCls = isLight
    ? 'hotel-map-picker-glass rounded-[1.25rem] border border-white/75 bg-white/92 backdrop-blur-2xl shadow-[0_24px_64px_-16px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.9)_inset] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col'
    : 'bg-[#0d1a2e] rounded-2xl border border-cyan-500/30 shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col';

  const headerBorder = isLight ? 'border-b border-stone-200/80' : 'border-b border-white/10';
  const titleCls = isLight
    ? 'text-[15px] font-semibold tracking-tight text-[var(--dp-fg,oklch(0.12_0.01_30))] flex items-center gap-2'
    : 'text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2';

  const closeBtnCls = isLight
    ? 'p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100/90 transition'
    : 'p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition';

  const searchWrapCls = isLight
    ? '[&_gmp-basic-place-autocomplete]:!block [&_gmp-basic-place-autocomplete]:!w-full [&_gmp-basic-place-autocomplete]:!min-h-[44px] [&_gmp-basic-place-autocomplete]:!rounded-xl [&_gmp-basic-place-autocomplete]:!bg-white/90 [&_gmp-basic-place-autocomplete]:!border [&_gmp-basic-place-autocomplete]:!border-stone-200/90 [&_gmp-basic-place-autocomplete]:!shadow-sm [&_.gmp-place-autocomplete]:!w-full [&_.gmp-place-autocomplete]:!rounded-xl [&_.gmp-place-autocomplete]:!min-h-[44px] [&_.gmp-place-autocomplete]:!bg-white/90 [&_.gmp-place-autocomplete]:!border [&_.gmp-place-autocomplete]:!border-stone-200/90 [&_.gmp-place-autocomplete]:!shadow-sm'
    : '[&_gmp-basic-place-autocomplete]:!block [&_gmp-basic-place-autocomplete]:!w-full [&_gmp-basic-place-autocomplete]:!min-h-[44px] [&_gmp-basic-place-autocomplete]:!rounded-lg [&_gmp-basic-place-autocomplete]:!bg-white/5 [&_gmp-basic-place-autocomplete]:!border [&_gmp-basic-place-autocomplete]:!border-cyan-500/30 [&_.gmp-place-autocomplete]:!w-full [&_.gmp-place-autocomplete]:!rounded-lg [&_.gmp-place-autocomplete]:!min-h-[44px] [&_.gmp-place-autocomplete]:!bg-white/5 [&_.gmp-place-autocomplete]:!border [&_.gmp-place-autocomplete]:!border-cyan-500/30';

  const mapFrameCls = isLight
    ? 'rounded-xl overflow-hidden border border-stone-200/80 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.12)] h-64'
    : 'rounded-xl overflow-hidden border border-cyan-500/20 h-64';

  const selectedBoxCls = isLight
    ? 'mt-3 px-3 py-2.5 rounded-xl bg-stone-50/95 border border-stone-200/80'
    : 'mt-3 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20';

  const selectedPrimaryCls = isLight
    ? 'text-[13px] font-semibold text-stone-900 truncate'
    : 'text-xs text-cyan-300 font-medium truncate';

  const selectedSecondaryCls = isLight ? 'text-[11px] text-stone-500 truncate mt-0.5' : 'text-[11px] text-gray-400 truncate mt-0.5';

  const footerBorder = isLight ? 'border-t border-stone-200/80 bg-white/60 backdrop-blur-md' : 'border-t border-white/10';

  const cancelBtnCls = isLight
    ? 'px-4 py-2.5 rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-100/90 transition'
    : 'px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 transition';

  const confirmBtnCls = isLight
    ? 'px-4 py-2.5 rounded-xl text-sm font-bold bg-neutral-950/90 text-white border border-white/10 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] hover:bg-neutral-950 transition disabled:opacity-45 disabled:cursor-not-allowed'
    : 'px-4 py-2 rounded-lg text-sm font-bold bg-cyan-500/20 border border-cyan-400 text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed';

  const warnCls = isLight ? 'text-amber-700 text-sm py-4' : 'text-amber-400 text-sm py-4';
  const errCls = isLight ? 'text-rose-600 text-sm py-4' : 'text-rose-400 text-sm py-4';
  const kitErrCls = isLight ? 'text-amber-800 text-sm py-2' : 'text-amber-400 text-sm py-2';

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }}
          className={backdropCls}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }}
            className={`${panelCls}${isLight ? ' tour-detail-premium sg-dp-theme' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-4 py-3 ${headerBorder}`}>
              <h3 className={titleCls}>
                <MapPin className={`w-4 h-4 ${isLight ? 'text-[var(--dp-primary,oklch(0.28_0.045_170))]' : ''}`} />
                {heading}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className={closeBtnCls}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto overflow-x-hidden">
              {!apiKey && <p className={warnCls}>Google Maps API key not configured.</p>}
              {apiKey && loadError && <p className={errCls}>{loadError.message}</p>}
              {apiKey && isLoaded && (
                <>
                  <div className="mb-3 relative z-[1] overflow-visible">
                    {placeApiNewUnavailable ? (
                      <p className={kitErrCls}>
                        Places UI Kit(Basic) 자동완성을 불러올 수 없습니다. Maps JavaScript API(weekly)와 Places UI Kit 설정을 확인해 주세요.
                      </p>
                    ) : (
                      <div className={searchWrapCls} ref={searchContainerRef} />
                    )}
                  </div>
                  <div className={mapFrameCls}>
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
                    <div className={selectedBoxCls}>
                      <p className={selectedPrimaryCls}>{selectedLocation.placeName ?? selectedLocation.address}</p>
                      {selectedLocation.placeName && selectedLocation.address !== selectedLocation.placeName && (
                        <p className={selectedSecondaryCls}>{selectedLocation.address}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={`px-4 py-3 ${footerBorder} flex gap-2 justify-end`}>
              <button type="button" onClick={onClose} className={cancelBtnCls}>
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedLocation || isGeocoding}
                className={confirmBtnCls}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
