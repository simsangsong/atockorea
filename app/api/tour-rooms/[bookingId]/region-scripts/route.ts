import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import { regionKeyForTour, type RegionScriptCard } from '@/lib/tour-room/regionScripts';
import { resolveDaySchedule } from '@/lib/tour-room/dayPlan';

export const dynamic = 'force-dynamic';

/**
 * 오늘 일정 탭 상단 "제주 알아보기" — 장소에 매이지 않는 지역 공통 해설.
 *
 * 도착 해설(`generated_spot_content` 등)이 "이 스팟은 무엇인가"라면 여기는
 * "이 섬은 어떤 곳인가"다. 손님은 이동 시간의 절반 이상을 차 안에서 보내는데
 * 그 시간에 읽을 것이 없었다.
 *
 * 읽기 전용, 인증된 룸 액터면 누구나(손님·가이드·기사·admin). 예약된 상품의
 * 슬러그로 지역을 고르므로 부산 상품이 들어와도 라우트는 그대로다.
 *
 * 로케일 폴백은 **en**이다. 번역이 아직 안 들어온 주제를 통째로 숨기면 손님은
 * 빈 화면을 보는데, 영어라도 읽히는 편이 낫다(룸 로케일 10종 중 무엇이든
 * 영어는 최소한의 공통분모다).
 */
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

    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('tour_date, itinerary, tours ( id, slug, schedule )')
      .eq('id', booking.id)
      .maybeSingle();
    const tourRaw = (bookingRow as { tours?: unknown } | null)?.tours;
    const tour = (Array.isArray(tourRaw) ? tourRaw[0] : tourRaw) as
      | { id?: string | null; slug?: string | null; schedule?: unknown }
      | null;

    const regionKey = regionKeyForTour(tour?.slug ?? null);
    // 지역을 못 고르면 빈 배열 — 섹션이 그냥 안 뜬다. 오류가 아니다.
    if (!regionKey) return NextResponse.json({ regionKey: null, cards: [] });

    const locale = normalizeRoomLocale(
      req.nextUrl.searchParams.get('locale'),
      normalizeRoomLocale(booking.preferred_language),
    );

    const { data, error } = await supabase
      .from('region_scripts')
      .select(
        'topic_key, icon, sensitive, image_url, image_credit, sort_order, places, sources,' +
          ' region_script_locales ( locale, title, teaser, body, fun_fact )',
      )
      .eq('region_key', regionKey)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('GET region-scripts query error:', error);
      return NextResponse.json({ regionKey, cards: [] });
    }

    type LocaleRow = {
      locale: string;
      title: string;
      teaser: string;
      body: string;
      fun_fact: string | null;
    };

    const cards: RegionScriptCard[] = [];
    // 임베드 조인이 있는 select는 supabase-js가 오류 유니온까지 포함한 타입을
    // 돌려주므로 직접 캐스팅이 막힌다 — unknown을 한 번 경유한다.
    for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      const locales = (row.region_script_locales ?? []) as LocaleRow[];
      const pick = locales.find((l) => l.locale === locale) ?? locales.find((l) => l.locale === 'en');
      // 어떤 언어로도 본문이 없으면 카드가 성립하지 않는다.
      if (!pick) continue;
      cards.push({
        topicKey: String(row.topic_key),
        icon: (row.icon as string | null) ?? null,
        sensitive: Boolean(row.sensitive),
        imageUrl: (row.image_url as string | null) ?? null,
        imageCredit: (row.image_credit as string | null) ?? null,
        title: pick.title,
        teaser: pick.teaser,
        body: pick.body,
        funFact: pick.fun_fact,
        places: Array.isArray(row.places) ? (row.places as RegionScriptCard['places']) : [],
        sources: Array.isArray(row.sources) ? (row.sources as RegionScriptCard['sources']) : [],
      });
    }

    // 오늘 스톱 좌표 — 추천 장소까지의 거리를 **참고로만** 띄우는 데 쓴다.
    // 🔴 `tourId`를 넘기지 않으면 리졸버가 단계 ②.5를 건너뛰고 poi_key 없는
    // 블롭으로 떨어진다(2026-07-29 실측: 커버리지 0). 인자 하나가 기능 부재로
    // 보이는 그 함정이라 여기서도 명시적으로 넘긴다.
    const stops: Array<{ lat: number; lng: number }> = [];
    try {
      const resolved = await resolveDaySchedule(supabase, {
        bookingId: booking.id,
        tourDate: (bookingRow as { tour_date?: string } | null)?.tour_date ?? '',
        itinerary: (bookingRow as { itinerary?: unknown } | null)?.itinerary ?? null,
        tourSchedule: tour?.schedule,
        tourId: tour?.id ?? undefined,
      });
      const poiKeys = [
        ...new Set(
          resolved.schedule
            .map((item) => (typeof item.poi_key === 'string' ? item.poi_key : null))
            .filter((k): k is string => Boolean(k)),
        ),
      ];
      if (poiKeys.length > 0) {
        const { data: pois } = await supabase
          .from('match_pois')
          .select('lat, lng')
          .in('poi_key', poiKeys);
        for (const p of (pois ?? []) as Array<{ lat: number | null; lng: number | null }>) {
          if (typeof p.lat === 'number' && typeof p.lng === 'number') {
            stops.push({ lat: p.lat, lng: p.lng });
          }
        }
      }
    } catch {
      // 좌표가 없으면 거리 줄만 빠진다 — 카드는 그대로 읽힌다.
    }

    return NextResponse.json({ regionKey, locale, cards, stops });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/region-scripts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
