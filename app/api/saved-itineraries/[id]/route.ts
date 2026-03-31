import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase';
import { getAccessTokenFromRequest, getAuthUser } from '@/lib/auth';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';
import { patchSavedItineraryBodySchema } from '@/lib/saved-itineraries';

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/saved-itineraries/[id] — single saved record (full JSON payloads)
 * PATCH — rename / favorite
 * DELETE — remove
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) {
      return ErrorResponses.validationError('Invalid id');
    }

    const token = getAccessTokenFromRequest(req);
    const user = await getAuthUser(req);
    if (!token || !user) {
      return ErrorResponses.unauthorized('Sign in to view this itinerary.');
    }

    const supabase = createUserSupabaseClient(token);
    const { data: row, error } = await supabase
      .from('saved_itineraries')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      title: row.title,
      summary: row.summary,
      isFavorite: row.is_favorite,
      requestJson: row.request_json,
      itineraryJson: row.itinerary_json,
    });
  } catch (error) {
    return handleApiError(error, req);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) {
      return ErrorResponses.validationError('Invalid id');
    }

    const token = getAccessTokenFromRequest(req);
    const user = await getAuthUser(req);
    if (!token || !user) {
      return ErrorResponses.unauthorized('Sign in to update this itinerary.');
    }

    const body = await req.json().catch(() => ({}));
    const parsed = patchSavedItineraryBodySchema.safeParse(body);
    if (!parsed.success) {
      return ErrorResponses.validationError(parsed.error.flatten().formErrors.join('; ') || 'Invalid body');
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.summary !== undefined) patch.summary = parsed.data.summary;
    if (parsed.data.isFavorite !== undefined) patch.is_favorite = parsed.data.isFavorite;

    if (Object.keys(patch).length === 0) {
      return ErrorResponses.validationError('No fields to update');
    }

    const supabase = createUserSupabaseClient(token);
    const { data: row, error } = await supabase
      .from('saved_itineraries')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, updated_at, title, summary, is_favorite')
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ saved: row });
  } catch (error) {
    return handleApiError(error, req);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) {
      return ErrorResponses.validationError('Invalid id');
    }

    const token = getAccessTokenFromRequest(req);
    const user = await getAuthUser(req);
    if (!token || !user) {
      return ErrorResponses.unauthorized('Sign in to delete this itinerary.');
    }

    const supabase = createUserSupabaseClient(token);
    const { data: row, error } = await supabase
      .from('saved_itineraries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error, req);
  }
}
