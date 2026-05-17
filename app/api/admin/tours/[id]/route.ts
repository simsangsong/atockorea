import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { applyTourWriteRules } from '@/lib/admin/tour-write-rules';

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapTourGuideSpot(tourId: string, item: any, index: number) {
  return {
    tour_id: tourId,
    title: String(item?.title ?? '').trim(),
    description: item?.description ?? null,
    audio_url: item?.audio_url ?? null,
    latitude: parseNullableNumber(item?.latitude),
    longitude: parseNullableNumber(item?.longitude),
    trigger_radius_m: parseNullableNumber(item?.trigger_radius_m) ?? 80,
    sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index,
  };
}

function mapTourFacility(tourId: string, item: any, index: number) {
  const type = ['restroom', 'ticket_office', 'convenience', 'restaurant', 'other'].includes(item?.type)
    ? item.type
    : 'other';
  const details = typeof item?.details === 'object' && item.details !== null ? item.details : {};

  return {
    tour_id: tourId,
    type,
    name: String(item?.name ?? item?.title ?? '').trim(),
    latitude: parseNullableNumber(item?.latitude),
    longitude: parseNullableNumber(item?.longitude),
    details: {
      ...details,
      ...(item?.description ? { description: item.description } : {}),
      ...(item?.icon ? { icon: item.icon } : {}),
      ...(item?.image_url ? { image_url: item.image_url } : {}),
    },
    sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index,
  };
}

/**
 * PATCH /api/admin/tours/[id]
 * Update a tour (admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PATCH /api/admin/tours/[id]] Request received');
    }

    // Handle both Promise and direct params (Next.js 15 compatibility)
    const resolvedParams = await params;
    const tourId = resolvedParams.id;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[PATCH /api/admin/tours/[id]] Tour ID:', tourId);
    }
    
    // Check admin authentication
    const adminUser = await requireAdmin(req);
    const supabase = createServerClient();
    const body = await req.json();

    // Check if tour exists
    
    // translations 컬럼이 없을 수 있으므로 먼저 id만 확인
    const { data: existingTour, error: fetchError } = await supabase
      .from('tours')
      .select('id')
      .eq('id', tourId)
      .single();

    if (fetchError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[PATCH /api/admin/tours/[id]] Fetch error:', fetchError);
      }
      return NextResponse.json(
        { error: 'Tour not found', details: fetchError.message },
        { status: 404 }
      );
    }
    
    if (!existingTour) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[PATCH /api/admin/tours/[id]] Tour not found:', tourId);
      }
      return NextResponse.json(
        { error: 'Tour not found', tourId },
        { status: 404 }
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[PATCH /api/admin/tours/[id]] Tour found:', existingTour.id);
    }
    
    // translations 컬럼이 있는지 확인하기 위해 전체 데이터 가져오기
    // translations가 없으면 빈 객체로 처리
    let existingTranslations = {};
    try {
      const { data: fullTour, error: fullTourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single();
      
      if (fullTourError) {
        // translations 컬럼이 없는 경우
        if (fullTourError.message && fullTourError.message.includes('translations')) {
          console.error('❌ [PATCH /api/admin/tours/[id]] translations column missing');
          console.error('   Please run SQL: ALTER TABLE tours ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT \'{}\'::jsonb;');
          return NextResponse.json(
            { 
              error: 'Database schema error', 
              details: 'translations column does not exist',
              solution: 'Please run this SQL in Supabase SQL Editor:\n\nALTER TABLE tours\nADD COLUMN IF NOT EXISTS translations JSONB DEFAULT \'{}\'::jsonb;\n\nCREATE INDEX IF NOT EXISTS idx_tours_translations\nON tours USING GIN (translations);'
            },
            { status: 500 }
          );
        }
        throw fullTourError;
      }
      
      existingTranslations = fullTour?.translations || {};
    } catch (error: any) {
      // 다른 오류인 경우
      if (error.message && error.message.includes('translations')) {
        return NextResponse.json(
          { 
            error: 'Database schema error', 
            details: 'translations column does not exist',
            solution: 'Please run this SQL in Supabase SQL Editor:\n\nALTER TABLE tours\nADD COLUMN IF NOT EXISTS translations JSONB DEFAULT \'{}\'::jsonb;'
          },
          { status: 500 }
        );
      }
      throw error;
    }

    // Lock slug + validate price_type before assembling update payload.
    const ruleResult = applyTourWriteRules(body);
    if (!ruleResult.ok) {
      return NextResponse.json({ error: ruleResult.error, field: ruleResult.field }, { status: 400 });
    }
    if (ruleResult.warnings.length > 0) {
      console.warn('[PATCH /api/admin/tours/[id]]', ruleResult.warnings.join('; '), { tourId });
    }

    // Prepare update data
    const updateData: any = {};

    // Handle translations - merge with existing translations
    if (body.translations) {
      // Merge new translations with existing ones
      updateData.translations = {
        ...existingTranslations,
        ...body.translations
      };
    }

    // Handle other fields
    if (body.title !== undefined) updateData.title = body.title;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.price_type !== undefined) updateData.price_type = body.price_type;
    if (body.image_url !== undefined) updateData.image_url = body.image_url;
    if (body.tag !== undefined) updateData.tag = body.tag;
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.original_price !== undefined) updateData.original_price = body.original_price ? parseFloat(body.original_price) : null;
    if (body.duration !== undefined) updateData.duration = body.duration;
    if (body.lunch_included !== undefined) updateData.lunch_included = body.lunch_included;
    if (body.ticket_included !== undefined) updateData.ticket_included = body.ticket_included;
    if (body.pickup_info !== undefined) updateData.pickup_info = body.pickup_info;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.highlights !== undefined) updateData.highlights = body.highlights;
    if (body.includes !== undefined) updateData.includes = body.includes;
    if (body.excludes !== undefined) updateData.excludes = body.excludes;
    if (body.schedule !== undefined) updateData.schedule = body.schedule;
    if (body.faqs !== undefined) updateData.faqs = body.faqs;
    if (body.gallery_images !== undefined) updateData.gallery_images = body.gallery_images;
    if (body.rating !== undefined) updateData.rating = parseFloat(body.rating);
    if (body.review_count !== undefined) updateData.review_count = parseInt(body.review_count);
    if (body.pickup_points_count !== undefined) updateData.pickup_points_count = parseInt(body.pickup_points_count);
    if (body.dropoff_points_count !== undefined) updateData.dropoff_points_count = parseInt(body.dropoff_points_count);
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;

    let updatedTour: any = existingTour;
    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabase
        .from('tours')
        .update(updateData)
        .eq('id', tourId)
        .select()
        .single();

      if (error) {
        console.error('Error updating tour:', error);
        return NextResponse.json(
          { error: 'Failed to update tour', details: error.message },
          { status: 400 }
        );
      }
      updatedTour = data;
    } else {
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single();
      if (error) throw error;
      updatedTour = data;
    }

    let tourGuideSpots = null;
    if (body.tour_guide_spots !== undefined) {
      if (!Array.isArray(body.tour_guide_spots)) {
        return NextResponse.json({ error: 'tour_guide_spots must be an array' }, { status: 400 });
      }

      const rows = body.tour_guide_spots
        .map((item: any, index: number) => mapTourGuideSpot(tourId, item, index))
        .filter((item: { title: string }) => item.title.length > 0);
      const invalidGeo = rows.find((item: { latitude: number | null; longitude: number | null }) => (
        item.latitude === null || item.longitude === null
      ));
      if (invalidGeo) {
        return NextResponse.json(
          { error: 'Each tour_guide_spots item requires latitude and longitude' },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabase
        .from('tour_guide_spots')
        .delete()
        .eq('tour_id', tourId);
      if (deleteError) throw deleteError;

      if (rows.length > 0) {
        const { data, error: insertError } = await supabase
          .from('tour_guide_spots')
          .insert(rows)
          .select()
          .order('sort_order', { ascending: true });
        if (insertError) throw insertError;
        tourGuideSpots = data ?? [];
      } else {
        tourGuideSpots = [];
      }
    }

    let tourFacilities = null;
    if (body.tour_facilities !== undefined) {
      if (!Array.isArray(body.tour_facilities)) {
        return NextResponse.json({ error: 'tour_facilities must be an array' }, { status: 400 });
      }

      const rows = body.tour_facilities
        .map((item: any, index: number) => mapTourFacility(tourId, item, index))
        .filter((item: { name: string }) => item.name.length > 0);
      const invalidGeo = rows.find((item: { latitude: number | null; longitude: number | null }) => (
        item.latitude === null || item.longitude === null
      ));
      if (invalidGeo) {
        return NextResponse.json(
          { error: 'Each tour_facilities item requires latitude and longitude' },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabase
        .from('tour_facilities')
        .delete()
        .eq('tour_id', tourId);
      if (deleteError) throw deleteError;

      if (rows.length > 0) {
        const { data, error: insertError } = await supabase
          .from('tour_facilities')
          .insert(rows)
          .select()
          .order('sort_order', { ascending: true });
        if (insertError) throw insertError;
        tourFacilities = data ?? [];
      } else {
        tourFacilities = [];
      }
    }

    return NextResponse.json(
      {
        data: {
          ...updatedTour,
          ...(tourGuideSpots !== null ? { tour_guide_spots: tourGuideSpots } : {}),
          ...(tourFacilities !== null ? { tour_facilities: tourFacilities } : {}),
        },
        message: 'Tour updated successfully',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating tour:', error);
    
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tours/[id]
 * Delete a tour (admin only). Removes pickup_points first, then the tour.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const resolvedParams = await params;
    const tourId = resolvedParams.id;
    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from('tours')
      .select('id')
      .eq('id', tourId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 });
    }

    await supabase.from('pickup_points').delete().eq('tour_id', tourId);
    const { error } = await supabase.from('tours').delete().eq('id', tourId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete tour', details: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, message: 'Tour deleted' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/tours/[id]
 * Get a single tour (admin only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin authentication
    await requireAdmin(req);
    
    // Handle both Promise and direct params (Next.js 15 compatibility)
    const resolvedParams = await params;
    
    const supabase = createServerClient();
    const tourId = resolvedParams.id;

    const { data: tour, error } = await supabase
      .from('tours')
      .select('*')
      .eq('id', tourId)
      .single();

    if (error || !tour) {
      return NextResponse.json(
        { error: 'Tour not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: tour });
  } catch (error: any) {
    console.error('Error fetching tour:', error);
    
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
