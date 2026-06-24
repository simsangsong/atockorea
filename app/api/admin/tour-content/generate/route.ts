import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { generateCoursePayload, generateSpeechMp3 } from '@/lib/openai-server';
import { validateLocalePayloads } from '@/lib/admin/content-generate-guard';

export const dynamic = 'force-dynamic';

const AUDIO_LOCALES = new Set(['ko', 'zh', 'ja', 'en', 'es']);

type LocalePayloadMap = Record<string, unknown>;

function getStops(course: Record<string, unknown>): Array<Record<string, unknown>> {
  const stops = course.stops;
  return Array.isArray(stops) ? (stops as Array<Record<string, unknown>>) : [];
}

async function ensureAudioBucket(supabase: ReturnType<typeof createServerClient>) {
  const bucket = process.env.SUPABASE_TOUR_AUDIO_BUCKET || 'tour-audio';
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: 20 * 1024 * 1024 });
  }
  return bucket;
}

async function uploadAudio(
  supabase: ReturnType<typeof createServerClient>,
  bucket: string,
  path: string,
  bytes: ArrayBuffer,
) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, Buffer.from(bytes), { contentType: 'audio/mpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  let jobId: string | null = null;

  try {
    const admin = await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as {
      tourId?: string;
      sourceSlug?: string;
      localePayloads?: LocalePayloadMap;
    };

    const localePayloads = body.localePayloads;
    // AR-1: cap locale count, allowlist locale keys, and limit payload size so a
    // single request can't fan out into an unbounded OpenAI/TTS bill.
    const validation = validateLocalePayloads(localePayloads);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const requestedLocales = validation.locales;
    const payloads = localePayloads as LocalePayloadMap;

    const audioLocales = requestedLocales.filter((locale) => AUDIO_LOCALES.has(locale));
    const textOnlyLocales = requestedLocales.filter((locale) => !AUDIO_LOCALES.has(locale));

    const { data: job, error: jobError } = await supabase
      .from('tour_content_jobs')
      .insert({
        tour_id: body.tourId ?? null,
        source_slug: body.sourceSlug ?? null,
        status: 'processing',
        requested_locales: requestedLocales,
        audio_locales: audioLocales,
        text_only_locales: textOnlyLocales,
        created_by: admin.id,
      })
      .select()
      .single();

    if (jobError) throw jobError;
    jobId = job.id;

    const bucket = audioLocales.length > 0 ? await ensureAudioBucket(supabase) : null;
    const courses: unknown[] = [];
    const audioAssets: unknown[] = [];

    for (const locale of requestedLocales) {
      const generated = await generateCoursePayload(locale, payloads[locale]);
      const { data: courseRow, error: courseError } = await supabase
        .from('tour_generated_courses')
        .insert({
          job_id: job.id,
          tour_id: body.tourId ?? null,
          locale,
          source_payload: payloads[locale] as Record<string, unknown>,
          generated_course: generated.course,
          description_presets: generated.description_presets,
        })
        .select()
        .single();
      if (courseError) throw courseError;
      courses.push(courseRow);

      for (const stop of getStops(generated.course)) {
        const stopKey = String(stop.key || stop.id || stop.sort_order || audioAssets.length + 1);
        const narration = String(stop.narration_text || stop.description || '').trim();
        if (!narration) continue;

        if (!AUDIO_LOCALES.has(locale)) {
          const { data: asset } = await supabase
            .from('tour_audio_assets')
            .insert({
              job_id: job.id,
              tour_id: body.tourId ?? null,
              locale,
              course_stop_key: stopKey,
              text: narration,
              status: 'skipped',
            })
            .select()
            .single();
          if (asset) audioAssets.push(asset);
          continue;
        }

        try {
          const audio = await generateSpeechMp3(narration, locale);
          const path = `${job.id}/${locale}/${stopKey}.mp3`;
          const audioUrl = await uploadAudio(supabase, bucket!, path, audio);
          const { data: asset, error: assetError } = await supabase
            .from('tour_audio_assets')
            .insert({
              job_id: job.id,
              tour_id: body.tourId ?? null,
              locale,
              course_stop_key: stopKey,
              text: narration,
              audio_url: audioUrl,
              status: 'completed',
            })
            .select()
            .single();
          if (assetError) throw assetError;
          audioAssets.push(asset);
        } catch (error) {
          const { data: asset } = await supabase
            .from('tour_audio_assets')
            .insert({
              job_id: job.id,
              tour_id: body.tourId ?? null,
              locale,
              course_stop_key: stopKey,
              text: narration,
              status: 'failed',
              error_message: error instanceof Error ? error.message : String(error),
            })
            .select()
            .single();
          if (asset) audioAssets.push(asset);
        }
      }
    }

    await supabase
      .from('tour_content_jobs')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    return NextResponse.json({ job: { ...job, status: 'completed' }, courses, audioAssets }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/tour-content/generate error:', error);
    if (jobId) {
      await supabase
        .from('tour_content_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
    return NextResponse.json(
      { error: 'Failed to generate tour content', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
