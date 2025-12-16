import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';
import { requireAdmin } from '@/lib/auth';

/**
 * POST /api/admin/tours
 * Create a new tour (Admin only)
 * 
 * Required fields:
 * - title, slug, city, price, price_type, image_url
 * 
 * Optional fields:
 * - original_price, tag, subtitle, description, duration, etc.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [POST /api/admin/tours] Request received');
    
    // Check admin authentication using requireAdmin
    // This handles cookie-based authentication properly
    let user;
    try {
      user = await requireAdmin(request);
      console.log('✅ [POST /api/admin/tours] User authenticated:', user.id, user.role);
    } catch (authError: any) {
      console.error('❌ [POST /api/admin/tours] Auth error:', authError.message);
      if (authError.message === 'Unauthorized') {
        return ErrorResponses.unauthorized('Authentication required');
      }
      if (authError.message.includes('Forbidden')) {
        return ErrorResponses.forbidden('Admin access required');
      }
      return ErrorResponses.unauthorized(authError.message || 'Authentication failed');
    }
    
    const supabase = createServerClient();

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['title', 'slug', 'city', 'price', 'price_type', 'image_url'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return ErrorResponses.validationError(`Missing required field: ${field}`);
      }
    }

    // Prepare tour data
    const tourData = {
      title: body.title,
      slug: body.slug,
      city: body.city,
      tag: body.tag || null,
      subtitle: body.subtitle || null,
      description: body.description || null,
      price: parseFloat(body.price),
      original_price: body.original_price ? parseFloat(body.original_price) : null,
      price_type: body.price_type, // 'person' or 'group'
      image_url: body.image_url,
      gallery_images: body.gallery_images || [],
      duration: body.duration || null,
      lunch_included: body.lunch_included || false,
      ticket_included: body.ticket_included || false,
      pickup_info: body.pickup_info || null,
      notes: body.notes || null,
      highlights: body.highlights || [],
      includes: body.includes || [],
      excludes: body.excludes || [],
      schedule: body.schedule || [],
      faqs: body.faqs || [],
      rating: body.rating ? parseFloat(body.rating) : 0,
      review_count: body.review_count || 0,
      pickup_points_count: body.pickup_points_count || 0,
      dropoff_points_count: body.dropoff_points_count || 0,
      is_active: body.is_active !== undefined ? body.is_active : true,
      is_featured: body.is_featured || false,
    };

    // Insert tour
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .insert(tourData)
      .select()
      .single();

    if (tourError) {
      return handleApiError(tourError);
    }

    // Insert pickup points if provided
    if (body.pickup_points && Array.isArray(body.pickup_points) && body.pickup_points.length > 0) {
      const pickupPoints = body.pickup_points.map((pp: any) => ({
        tour_id: tour.id,
        name: pp.name,
        address: pp.address || '',
        lat: pp.lat ? parseFloat(pp.lat) : null,
        lng: pp.lng ? parseFloat(pp.lng) : null,
        pickup_time: pp.pickup_time || null,
      }));

      const { error: ppError } = await supabase
        .from('pickup_points')
        .insert(pickupPoints);

      if (ppError) {
        // Log error but don't fail the request
        console.error('Error inserting pickup points:', ppError);
      }
    }

    return NextResponse.json({
      success: true,
      data: tour,
      message: 'Tour created successfully',
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/admin/tours
 * Get all tours (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication using requireAdmin
    // This handles cookie-based authentication properly
    const user = await requireAdmin(request);
    
    const supabase = createServerClient();

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('is_active');
    const city = searchParams.get('city');

    let query = supabase
      .from('tours')
      .select(`
        *,
        pickup_points (*)
      `)
      .order('created_at', { ascending: false });

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (city) {
      query = query.eq('city', city);
    }

    const { data: tours, error } = await query;

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({
      success: true,
      data: tours,
    });

  } catch (error) {
    return handleApiError(error);
  }
}

