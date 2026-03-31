import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase';
import { getAccessTokenFromRequest, getAuthUser } from '@/lib/auth';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';
import { saveItineraryBodySchema } from '@/lib/saved-itineraries';

/**
 * GET /api/saved-itineraries — list current user's saved itineraries (newest first)
 * POST /api/saved-itineraries — save (request_json + itinerary_json)
 */
export async function GET(req: NextRequest) {
  try {
    const token = getAccessTokenFromRequest(req);
    const user = await getAuthUser(req);
    if (!token || !user) {
      return ErrorResponses.unauthorized('Sign in to view saved itineraries.');
    }

    const supabase = createUserSupabaseClient(token);
    const { data: rows, error } = await supabase
      .from('saved_itineraries')
      .select('id, created_at, updated_at, title, summary, is_favorite, itinerary_json')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const items = (rows ?? []).map((row) => {
      const it = row.itinerary_json as Record<string, unknown> | null;
      const tourTitle = typeof it?.tourTitle === 'string' ? it.tourTitle : null;
      const stops = Array.isArray(it?.stops) ? it.stops : [];
      return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        title: row.title,
        summary: row.summary,
        isFavorite: row.is_favorite,
        tourTitle,
        stopCount: stops.length,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getAccessTokenFromRequest(req);
    const user = await getAuthUser(req);
    if (!token || !user) {
      return ErrorResponses.unauthorized('Sign in to save itineraries.');
    }

    const body = await req.json().catch(() => ({}));
    const parsed = saveItineraryBodySchema.safeParse(body);
    if (!parsed.success) {
      return ErrorResponses.validationError(parsed.error.flatten().formErrors.join('; ') || 'Invalid body');
    }

    const { title, summary, requestJson, itineraryJson, isFavorite } = parsed.data;

    const supabase = createUserSupabaseClient(token);
    const { data, error } = await supabase
      .from('saved_itineraries')
      .insert({
        user_id: user.id,
        title: title ?? null,
        summary: summary ?? null,
        request_json: requestJson,
        itinerary_json: itineraryJson,
        is_favorite: isFavorite ?? false,
      })
      .select('id, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ saved: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, req);
  }
}
