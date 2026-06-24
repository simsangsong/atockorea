import { NextRequest, NextResponse } from "next/server";
import { sanitizeStaticMapSearch } from "@/lib/maps-proxy";
import { mapsStaticRateLimit } from "@/lib/rate-limit";

/**
 * Proxy for Google Maps Static API.
 * Forwards requests server-side so browser referrer restrictions on the key don't block the image.
 * Usage: /api/maps/static?<google_static_maps_params_without_key>
 *
 * Two-key fallback: prefer the server-only `GOOGLE_MAPS_API_KEY` (intended to be
 * IP-restricted in GCP). If that key isn't authorized for the Static Maps API
 * (a 403 the user can hit even when the JS key works fine), retry with the
 * public `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — exposing the same key the browser
 * already loads, but unblocking the pickup-detail card while the server key's
 * GCP enablement is fixed.
 */
async function fetchStaticMap(search: string, key: string) {
  const mapsUrl = `https://maps.googleapis.com/maps/api/staticmap${search}&key=${key}`;
  return fetch(mapsUrl, {
    headers: { "User-Agent": "atockorea-server/1.0" },
  });
}

export async function GET(req: NextRequest) {
  // N19: throttle per-IP — this proxy spends our billable Maps key and is public.
  const limited = mapsStaticRateLimit(req);
  if (limited) return limited;

  // N19: only forward known Static Maps parameters (and never a caller `key`).
  const sanitized = sanitizeStaticMapSearch(req.nextUrl.search);
  if (!sanitized.ok) {
    return new NextResponse("Invalid map request", { status: 400 });
  }
  const search = sanitized.search; // includes the leading ?, no API key

  const serverKey = process.env.GOOGLE_MAPS_API_KEY;
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const keysToTry = [serverKey, publicKey].filter(
    (k): k is string => typeof k === "string" && k.length > 0,
  );
  if (keysToTry.length === 0) {
    return new NextResponse("Maps API key not configured", { status: 500 });
  }

  let lastStatus = 500;
  let lastError = "";
  for (const key of keysToTry) {
    const upstream = await fetchStaticMap(search, key);
    if (upstream.ok) {
      const imageBuffer = await upstream.arrayBuffer();
      const contentType = upstream.headers.get("content-type") ?? "image/png";
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
    lastStatus = upstream.status;
    lastError = await upstream.text();
    console.warn(
      `[maps/static] key rejected (status=${upstream.status}); trying next key if any.`,
    );
  }

  console.error("[maps/static] all keys rejected:", lastStatus, lastError);
  return new NextResponse(`Maps API error: ${lastError}`, { status: lastStatus });
}
