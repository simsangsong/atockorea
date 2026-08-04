import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { isSafePreviewUrl, parsePreviewHtml, type LinkPreviewData } from '@/lib/tour-room/linkPreview';

export const dynamic = 'force-dynamic';

/**
 * §5-4 — GET ?url=… → { url, host, title, description } (text only, see
 * lib/tour-room/linkPreview.ts for the SSRF stance and the no-image rule).
 *
 * Room-session gated: only people in a room can make this server touch a URL,
 * and the per-room gate keeps a scripted guest from turning it into a
 * fetch-anything proxy. Failures are honest nulls — a chat link without a
 * preview card is fine; a spinner that never resolves is not.
 */
const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 120 * 1024;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_CAP = 200;

const cache = new Map<string, { at: number; data: LinkPreviewData }>();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking } = resolved;

    const url = req.nextUrl.searchParams.get('url') ?? '';
    if (!isSafePreviewUrl(url)) {
      return NextResponse.json({ error: 'Unsupported url' }, { status: 400 });
    }

    const cached = cache.get(url);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, { status: 200 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_link_preview',
      key: `booking:${booking.id}`,
      perMinute: 10,
      perHour: 60,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    let data: LinkPreviewData = { url, host: new URL(url).hostname.replace(/^www\./, ''), title: null, description: null };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { accept: 'text/html', 'user-agent': 'AtoCKorea-LinkPreview/1.0' },
      });
      clearTimeout(timer);
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.includes('text/html') && res.body) {
        // Read only the head of the page — og tags live early, and an
        // unbounded read of a hostile page is its own denial-of-service.
        const reader = res.body.getReader();
        let html = '';
        let bytes = 0;
        const decoder = new TextDecoder();
        while (bytes < MAX_HTML_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          html += decoder.decode(value, { stream: true });
        }
        void reader.cancel().catch(() => undefined);
        data = parsePreviewHtml(url, html);
      }
    } catch {
      /* honest nulls */
    }

    if (cache.size >= CACHE_CAP) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(url, { at: Date.now(), data });
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/link-preview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
