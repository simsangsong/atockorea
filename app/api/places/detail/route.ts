import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getPlaceDetailFull, localeToPlaceLang } from '@/lib/places-lookup';

export interface PlacesDetailPostBody {
  name: string;
  address?: string;
  /** App locale: en | ko | ja | zh | zh-TW | es */
  locale?: string;
  /** 일정 보강 시 채워진 좌표 — 제목 매칭 실패 시 근접 DB 행 검색용 */
  mapx?: number | null;
  mapy?: number | null;
  /** 보강 성공 시 places.id — 있으면 id로 바로 조회 (이름 매칭 불필요) */
  place_id?: number | null;
}

/**
 * 일정 카드 "View details" — places 테이블 매칭 행 전체(embedding 제외).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlacesDetailPostBody;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 });
    }

    let supabase;
    try {
      supabase = createServerClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server configuration error.';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const langType = localeToPlaceLang(body.locale);
    const mapx = typeof body.mapx === 'number' && Number.isFinite(body.mapx) ? body.mapx : undefined;
    const mapy = typeof body.mapy === 'number' && Number.isFinite(body.mapy) ? body.mapy : undefined;
    const placeId = typeof body.place_id === 'number' ? body.place_id : undefined;
    const detail = await getPlaceDetailFull(supabase, name, address, langType, { mapx, mapy, placeId });

    return NextResponse.json({ place: detail });
  } catch (e) {
    console.error('[api/places/detail]', e);
    return NextResponse.json({ error: 'Failed to load place detail.' }, { status: 500 });
  }
}
