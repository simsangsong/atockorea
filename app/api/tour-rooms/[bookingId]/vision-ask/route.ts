import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { chatCompletion } from '@/lib/ai/router';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';

export const dynamic = 'force-dynamic';

/**
 * T4.7 — "what is this?" photo questions.
 *
 * Traveller snaps food / a sign / a relic → one §M-1 vision call (Gemini
 * Flash-Lite image input) answers in their locale, with the current spot
 * name injected as location context. Private by default ("나만 보기") — the
 * answer returns to the asker only; `share=true` additionally posts a room
 * message. The `preset=menu` prompt turns the same route into a menu
 * translator (§H P2 #11).
 *
 * Budget: 10 asks / participant / day + an hourly room cap (O-12 spirit).
 */

/**
 * 🔴 Was 8MB, which was a limit this route could never actually enforce.
 *
 * A serverless request body is capped well below that by the platform, so a
 * 5-8MB photo was rejected BEFORE this function ran — no log, no meter row, no
 * way to tell it apart from an AI outage. `ops_ai_usage` holds 1,898 rows and
 * not one has purpose='vision': the feature has never once completed in
 * production, and the number in this constant is why nobody could see that.
 *
 * 2MB is comfortably inside the platform limit even after multipart overhead,
 * and the client now downscales to ~1.2MB before sending, so a guest should
 * never meet this at all. When they do, it answers 413 rather than 400 —
 * "too large" is a different fact from "malformed request", and the composer
 * now says so in the guest’s language.
 */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Vision costs more than text: the image is base64-inflated by 4/3 on the way
 * to the provider and the model reads it before answering. Without this the
 * platform default (10-15s) could kill the function mid-call — the same shape
 * K1a found on the SSE route.
 */
export const maxDuration = 30;
const PHOTOS_BUCKET = process.env.SUPABASE_TOUR_ROOM_PHOTOS_BUCKET || 'tour-room-photos';

// 9 room locales (5 → 9 expansion, 2026-07-27). A missing entry silently
// answered a French guest's photo question in English — the prompt language
// must follow ROOM_LOCALES, not a stale copy of it.
const LOCALE_NAME: Record<string, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  es: 'Spanish',
  zh: 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  fr: 'French',
  de: 'German',
  ru: 'Russian',
  it: 'Italian',
};

function promptFor(preset: string | null, locale: string, question: string, context: string): string {
  const language = LOCALE_NAME[locale] ?? 'English';
  const base =
    preset === 'menu'
      ? `Translate this menu into ${language}. List each item with its price and a one-line description of the dish. Flag common allergens (peanut, shellfish, egg, dairy, gluten) when recognizable.`
      : `You are a friendly Korea tour guide. Identify what is in the photo and explain it in 2-4 short sentences in ${language}. If it is food, say how it is eaten; if a sign, translate it; if a cultural site or object, give the one interesting fact a traveller would enjoy.`;
  const contextLine = context ? ` The traveller is currently near: ${context}.` : '';
  const questionLine = question ? ` The traveller also asks: "${question}".` : '';
  return `${base}${contextLine}${questionLine} Answer in ${language} only.`;
}

async function ensurePhotosBucket(supabase: ReturnType<typeof createServerClient>): Promise<string> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((bucket) => bucket.name === PHOTOS_BUCKET)) {
    await supabase.storage.createBucket(PHOTOS_BUCKET, { public: true, fileSizeLimit: MAX_IMAGE_BYTES });
  }
  return PHOTOS_BUCKET;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'multipart/form-data with an image is required' }, { status: 400 });
    }
    const form = await req.formData();
    const image = form.get('image');
    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: 'image file is required' }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_BYTES) {
      // 413, not 400: the client can act on "too large" and cannot act on
      // "malformed". Collapsing them is how this failure stayed invisible.
      return NextResponse.json(
        { error: 'image_too_large', maxBytes: MAX_IMAGE_BYTES, gotBytes: image.size },
        { status: 413 },
      );
    }
    /**
     * HEIC is what an iPhone writes by default and no provider in the ladder
     * accepts it. Rejecting it here with a usable reason beats letting it reach
     * the model and come back as a generic failure — and the client's downscale
     * pass re-encodes it to JPEG, so this should only ever catch a bypass.
     */
    if (/heic|heif/i.test(image.type)) {
      return NextResponse.json({ error: 'unsupported_image_format', got: image.type }, { status: 415 });
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;

    // 10/day per participant (session) — IP-keyed for other actor kinds.
    const gateKey =
      actor.kind === 'session' ? `participant:${actor.sessionPayload.participantId}` : clientIpKey(req.headers);
    const [daily, roomGate] = await Promise.all([
      requestGate({ namespace: 'tour_room_vision', key: gateKey, perMinute: 3, perHour: 10 }),
      requestGate({ namespace: 'tour_room_vision_room', key: `booking:${booking.id}`, perMinute: 6, perHour: 30 }),
    ]);
    if (!daily.allowed || !roomGate.allowed) {
      const retryAfterMs = Math.max(daily.retryAfterMs ?? 0, roomGate.retryAfterMs ?? 0);
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }

    const locale = normalizeRoomLocale(form.get('locale'), normalizeRoomLocale(booking.preferred_language));
    const question = String(form.get('question') || '').trim().slice(0, 300);
    const context = String(form.get('context') || '').trim().slice(0, 120);
    const preset = form.get('preset') === 'menu' ? 'menu' : null;
    const share = String(form.get('share') || '') === 'true';

    const bytes = Buffer.from(await image.arrayBuffer());
    const mime = image.type || 'image/jpeg';

    const completion = await chatCompletion(
      'vision',
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptFor(preset, locale, question, context) },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${bytes.toString('base64')}` } },
          ],
        },
      ],
      { maxOutputTokens: 800, temperature: 0.4, usage: { bookingId: booking.id } },
    );
    const answer = completion.content.trim();

    let imageUrl: string | null = null;
    let message: Record<string, unknown> | null = null;
    if (share) {
      const room = await ensureRoom(supabase, booking);
      const bucket = await ensurePhotosBucket(supabase);
      const extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const path = `${room.id}/${randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (!uploadError) {
        imageUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      }

      const { data } = await supabase
        .from('tour_room_messages')
        .insert({
          room_id: room.id,
          booking_id: booking.id,
          sender_user_id: authUserId,
          sender_role: 'system',
          input_kind: 'text',
          source_text: answer,
          source_locale: locale,
          translations: { [locale]: answer },
          target_locales: [locale],
          metadata: {
            kind: 'vision_answer',
            image_url: imageUrl,
            question: question || null,
            preset,
            asked_by_role: actor.role,
          },
        })
        .select()
        .single();
      if (data) {
        message = data;
        await broadcastToRoom(room, 'message', { message: data });
      }
    }

    return NextResponse.json(
      { answer, locale, imageUrl, shared: Boolean(message), provider: completion.provider },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/vision-ask error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
