import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for Google Maps Static API.
 * Forwards requests server-side so browser referrer restrictions on the key don't block the image.
 * Usage: /api/maps/static?<google_static_maps_params_without_key>
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new NextResponse("Maps API key not configured", { status: 500 });
  }

  const search = req.nextUrl.search; // already includes the leading ?
  const mapsUrl = `https://maps.googleapis.com/maps/api/staticmap${search}&key=${apiKey}`;

  const upstream = await fetch(mapsUrl, {
    headers: { "User-Agent": "atockorea-server/1.0" },
  });

  if (!upstream.ok) {
    return new NextResponse("Maps API error", { status: upstream.status });
  }

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
