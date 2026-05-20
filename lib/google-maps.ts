/**
 * Google Maps 配置和工具函数
 */

export const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// 默认中心点（首尔）
export const defaultCenter = {
  lat: 37.5665,
  lng: 126.9780,
};

// 地图选项
export const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

// 需要加载的库
// IMPORTANT: This array MUST be a module-level constant so its reference identity
// is stable across all useJsApiLoader call sites. `@react-google-maps/api` compares
// `libraries` by reference; if any consumer passes a new array on every render
// (or a different array than another consumer), the loader treats them as a
// mismatch — the second `useJsApiLoader` stays stuck on `isLoaded = false`.
//
// `marker` is required by POICatalogMap (AdvancedMarkerElement). It's harmless
// for callers that only use the legacy Marker, so we ship it for everyone to
// keep one shared `<script>` element across the app.
export const libraries: ("places" | "marker" | "drawing" | "geometry" | "visualization")[] = ['places', 'marker'];

/**
 * Single source of truth for Google Maps JS loader options.
 *
 * Every `useJsApiLoader` / `useLoadScript` call in the app MUST spread this
 * (and pass the same `id`) so they share a single `<script>` tag. Two callers
 * with different `libraries` or `version` cause `@react-google-maps/api` to
 * reload the script — which leaves one of them permanently stuck on the
 * "Loading map…" placeholder.
 */
export const GOOGLE_MAPS_LOADER_ID = 'google-map-script';
// Channel choice: `weekly` re-rolls every week (a moving target — a fresh
// weekly build can regress AdvancedMarkerElement / loader behavior, which is
// what broke the builder map after the loader was pinned to it). `quarterly`
// is the stable, still-current production channel Google recommends for apps
// that don't want weekly churn — NOT a legacy/old version. AdvancedMarkerElement
// is fully supported on quarterly.
export const GOOGLE_MAPS_LOADER_VERSION = 'quarterly';

/**
 * 格式化地址为坐标
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Google Maps API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * 格式化坐标为地址
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Google Maps API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=ko`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

