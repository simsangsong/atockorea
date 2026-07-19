/**
 * Location messages — driver signals (vehicle arrived / parking pin / lost-me)
 * append a `https://maps.google.com/?q=lat,lng` line to the bubble text
 * (driverSignals.googleMapsPinUrl / guestSignals). This parses those coords out
 * so the chat can render an inline map preview instead of a raw URL.
 */

export interface ParsedLocation {
  lat: number;
  lng: number;
  /** The original maps URL (tap target → native Google Maps). */
  url: string;
  /** The message text with the URL line stripped (the human context). */
  label: string;
}

// maps.google.com/?q=… , www.google.com/maps?q=… , google.com/maps/?q=…
const LOC_RE =
  /https?:\/\/(?:www\.)?(?:maps\.)?google\.com\/(?:maps)?\/?\?[^\s]*?q=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i;

export function parseLocationMessage(text: string | null | undefined): ParsedLocation | null {
  if (!text) return null;
  const m = LOC_RE.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  const label = text.replace(m[0], '').replace(/\n{2,}/g, '\n').trim();
  return { lat, lng, url: m[0], label };
}

/**
 * Static Maps thumbnail for an inline preview — routed through our server proxy
 * (`/api/maps/static`) so the API key stays server-side and browser referrer
 * restrictions don't block the image. The proxy sanitizes params + rate-limits.
 */
export function staticMapUrl(
  lat: number,
  lng: number,
  opts: { width?: number; height?: number; zoom?: number } = {},
): string {
  const { width = 320, height = 150, zoom = 16 } = opts;
  const center = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const params = new URLSearchParams({
    center,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: '2',
    markers: `color:0xdc2626|${center}`,
  });
  return `/api/maps/static?${params.toString()}`;
}
