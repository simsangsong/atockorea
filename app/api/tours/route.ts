import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withErrorHandler, AppError } from '@/lib/error-handler';
import { createServerLogger } from '@/lib/logger';

/**
 * GET /api/tours
 * Get all tours with optional filtering (server-side)
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const logger = createServerLogger(req);
  const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    // Query parameters
    const city = searchParams.get('city');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const isActive = searchParams.get('isActive') !== 'false'; // Default to true
    
    // New filter parameters
    const destinations = searchParams.get('destinations'); // Comma-separated cities
    const durations = searchParams.get('durations'); // Comma-separated duration keywords
    const features = searchParams.get('features'); // Comma-separated feature keywords
    const sortBy = searchParams.get('sortBy') || 'created_at'; // created_at, price, rating
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('tours')
      .select(`
        *,
        pickup_points (
          id,
          name,
          address,
          lat,
          lng,
          pickup_time
        )
      `)
      .eq('is_active', isActive);

    // Apply filters
    if (city) {
      query = query.eq('city', city);
    }

    // Multiple destinations filter
    if (destinations) {
      const destinationList = destinations.split(',').map(d => d.trim()).filter(Boolean);
      if (destinationList.length > 0) {
        query = query.in('city', destinationList);
      }
    }

    // Price range filter
    if (minPrice) {
      query = query.gte('price', parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.lte('price', parseFloat(maxPrice));
    }

    // Search filter (title, description, city)
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,city.ilike.%${search}%`);
    }

    // Duration filter (search in duration field)
    if (durations) {
      const durationList = durations.split(',').map(d => d.trim()).filter(Boolean);
      if (durationList.length > 0) {
        // Build OR conditions for duration matching
        const durationConditions = durationList.map(duration => {
          // Match duration keywords like "Half day", "Full day", "3-4 hours", "2 Days"
          const normalizedDuration = duration.toLowerCase();
          return `duration.ilike.%${normalizedDuration}%`;
        }).join(',');
        query = query.or(durationConditions);
      }
    }

    // Features filter (search in badges or includes field)
    if (features) {
      const featureList = features.split(',').map(f => f.trim()).filter(Boolean);
      if (featureList.length > 0) {
        // For each feature, check if it exists in badges JSONB array
        // We'll filter in JavaScript after fetching, or use JSONB contains
        // For now, we'll use a more flexible approach with multiple OR conditions
        const featureConditions = featureList.map(feature => {
          const normalizedFeature = feature.toLowerCase();
          // Check in badges (JSONB array)
          return `badges.cs.["${feature}"]`;
        }).join(',');
        
        // Since Supabase doesn't support complex JSONB queries easily, we'll filter after fetch
        // But we can still try to use JSONB contains
        // For simplicity, we'll filter in the transformation step
      }
    }

    // Sorting
    const ascending = sortOrder === 'asc';
    if (sortBy === 'price') {
      query = query.order('price', { ascending });
    } else if (sortBy === 'rating') {
      query = query.order('rating', { ascending });
    } else {
      query = query.order('created_at', { ascending });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: tours, error } = await query;

    if (error) {
      logger.error('Error fetching tours', undefined, { error: error.message });
      throw new AppError('Failed to fetch tours', 500, 'TOURS_FETCH_ERROR', error.message);
    }

    // Transform data to match frontend expectations
    let transformedTours = tours?.map((tour) => ({
      id: tour.id,
      title: tour.title,
      location: tour.city,
      city: tour.city,
      price: parseFloat(tour.price.toString()),
      originalPrice: tour.original_price ? parseFloat(tour.original_price.toString()) : null,
      priceType: tour.price_type,
      image: tour.image_url || (tour.images && Array.isArray(tour.images) && tour.images[0]) || '',
      images: tour.images || [],
      rating: tour.rating ? parseFloat(tour.rating.toString()) : 0,
      reviewCount: tour.review_count || 0,
      duration: tour.duration || '',
      difficulty: tour.difficulty || '',
      groupSize: tour.group_size || '',
      highlight: tour.highlight || '',
      badges: tour.badges || [],
      description: tour.description || '',
      location_detail: tour.location || '',
      pickupPoints: tour.pickup_points || [],
      pickupPointsCount: tour.pickup_points_count || 0,
      dropoffPointsCount: tour.dropoff_points_count || 0,
      lunchIncluded: tour.lunch_included || false,
      ticketIncluded: tour.ticket_included || false,
      includes: tour.includes || [],
      excludes: tour.excludes || [],
      schedule: tour.schedule || [],
      pickupInfo: tour.pickup_info || '',
      notes: tour.notes || '',
      isActive: tour.is_active,
      createdAt: tour.created_at,
      updatedAt: tour.updated_at,
    })) || [];

    // Apply features filter in JavaScript (since JSONB queries are complex)
    if (features) {
      const featureList = features.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
      if (featureList.length > 0) {
        transformedTours = transformedTours.filter((tour) => {
          // Check if any feature matches in badges or description
          const tourBadges = (tour.badges || []).map((b: string) => b.toLowerCase());
          const tourDescription = (tour.description || '').toLowerCase();
          
          return featureList.some(feature => {
            // Check in badges
            if (tourBadges.some((badge: string) => badge.includes(feature))) {
              return true;
            }
            // Check in description (for features like "Tickets Included", "Meals Included")
            if (tourDescription.includes(feature)) {
              return true;
            }
            return false;
          });
        });
      }
    }

    logger.info('Tours fetched successfully', { count: transformedTours.length });

    return NextResponse.json({ 
      tours: transformedTours,
      total: transformedTours.length,
      limit,
      offset,
    });
  });
