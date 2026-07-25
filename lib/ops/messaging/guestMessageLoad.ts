/**
 * 손님 안내 메시지의 서버측 조립 — M1~M3.
 *
 * 라우트 두 개(미리보기 / 발송)가 **정확히 같은 데이터**를 봐야 한다. 갈라지면
 * 화면에서 확인한 것과 다른 메시지가 나가고, 그 사고는 손님에게 직접 노출된다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { OPS_TENANT_ID } from '@/lib/ops/tenant';
import { getPreset, presetBodyForLocale, type WaPresetKey } from '@/lib/ops/whatsapp/presets';
import { fetchDailyForecast, type DailyForecast } from '@/lib/ops/weather/forecast';
import { resolveTemplate, type MessageChannel, type ResolvedTemplate } from './guestMessage';

/**
 * 예보를 캐시 우선으로 가져온다.
 *
 * 🔴 **실패는 캐시하지 않는다.** "조회 실패"를 저장하면 다음 시도까지 막히고,
 * 안내 문구에서 날씨가 조용히 사라진 채로 굳는다.
 */
export async function getForecastCached(
  supabase: SupabaseClient,
  city: string | null | undefined,
  date: string,
  opts: { maxAgeMs?: number } = {},
): Promise<DailyForecast | null> {
  if (!city) return null;
  const maxAge = opts.maxAgeMs ?? 3 * 60 * 60 * 1000; // 3시간 — 하루 전 예보는 그 정도면 충분히 신선하다.

  const { data: cached } = await supabase
    .from('ops_weather_cache')
    .select('payload, fetched_at')
    .eq('city', city)
    .eq('date', date)
    .maybeSingle();

  if (cached) {
    const row = cached as { payload: DailyForecast; fetched_at: string };
    const age = Date.now() - new Date(row.fetched_at).getTime();
    if (age < maxAge) return row.payload;
  }

  const fresh = await fetchDailyForecast(city, date);
  if (!fresh) return cached ? (cached as { payload: DailyForecast }).payload : null;

  // upsert 실패는 무시한다 — 캐시를 못 써도 예보 자체는 유효하다.
  await supabase
    .from('ops_weather_cache')
    .upsert({ city: fresh.city, date, payload: fresh, fetched_at: new Date().toISOString() }, { onConflict: 'city,date' })
    .then(
      () => undefined,
      () => undefined,
    );

  return fresh;
}

/**
 * (투어, 프리셋, 로케일, 채널) 템플릿 해석.
 *
 * 세 층을 모두 한 번에 읽고 순수 함수에 넘긴다 — 우선순위 판단이 조회 순서에
 * 섞이면 "어느 층이 이겼는지"를 나중에 설명할 수 없다.
 */
export async function loadTemplate(
  supabase: SupabaseClient,
  args: { tourId: string | null; presetKey: WaPresetKey; locale: string; channel: MessageChannel },
): Promise<ResolvedTemplate> {
  const preset = getPreset(args.presetKey);
  const codeBody = preset ? presetBodyForLocale(preset, args.locale) : '';

  const [tourRes, tenantRes] = await Promise.all([
    args.tourId
      ? supabase
          .from('ops_tour_message_templates')
          .select('body, subject')
          .eq('tenant_id', OPS_TENANT_ID)
          .eq('tour_id', args.tourId)
          .eq('preset_key', args.presetKey)
          .eq('locale', args.locale)
          .eq('channel', args.channel)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('ops_whatsapp_templates')
      .select('body')
      .eq('preset_key', args.presetKey)
      .eq('locale', args.locale)
      .maybeSingle(),
  ]);

  return resolveTemplate({
    tour: (tourRes.data as { body: string; subject: string | null } | null) ?? null,
    tenant: (tenantRes.data as { body: string } | null) ?? null,
    code: codeBody,
  });
}

/**
 * 예약별 **개인** 투어룸 링크 (§K B0.3).
 *
 * 링크 발급이 실패하면 그 사람은 null로 남고, 상위가 "필수 변수 누락"으로 걸러
 * 발송에서 뺀다 — 링크 없는 안내 메일은 안 보낸 것보다 나쁘다(손님은 받았다고
 * 생각하고 기다린다).
 */
export async function issueRoomLinks(
  supabase: SupabaseClient,
  bookingIds: string[],
  issue: (bookingId: string) => Promise<string | null>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const id of bookingIds) {
    try {
      const url = await issue(id);
      if (url) out.set(id, url);
    } catch {
      /* 이 사람은 링크 없이 남는다 — 상위가 발송에서 뺀다 */
    }
  }
  return out;
}

/** 발송·오픈 기록 1행. 채널이 달라도 로그는 한 벌이다(M3). */
export function sendLogRow(entry: {
  bookingId: string;
  presetKey: string;
  locale: string | null;
  channel: MessageChannel;
  subject?: string | null;
  renderedMessage?: string | null;
  waUrl?: string | null;
  status: 'opened' | 'sent' | 'failed' | 'skipped';
  error?: string | null;
  createdBy?: string | null;
  tourId?: string | null;
  tourDate?: string | null;
}): Record<string, unknown> {
  return {
    tenant_id: OPS_TENANT_ID,
    booking_id: entry.bookingId,
    preset_key: entry.presetKey,
    locale: entry.locale,
    channel: entry.channel,
    subject: entry.subject ?? null,
    rendered_message: entry.renderedMessage ?? null,
    wa_url: entry.waUrl ?? null,
    status: entry.status,
    error: entry.error ?? null,
    created_by: entry.createdBy ?? null,
    tour_id: entry.tourId ?? null,
    tour_date: entry.tourDate ?? null,
    ...(entry.status === 'sent' ? { marked_sent_at: new Date().toISOString() } : {}),
  };
}
