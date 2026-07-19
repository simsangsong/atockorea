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
 * Google Static Maps thumbnail for an inline preview. Uses the same public key
 * as the JS SDK; needs the "Maps Static API" enabled on the Cloud project —
 * callers render an onError fallback for when it isn't.
 */
export function staticMapUrl(
  lat: number,
  lng: number,
  opts: { width?: number; height?: number; zoom?: number } = {},
): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const { width = 320, height = 150, zoom = 16 } = opts;
  const center = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const marker = `color:0xdc2626%7C${center}`;
  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${width}x${height}&scale=2&markers=${marker}&key=${key}`;
}
