import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/inventory
 * Get inventory for tours
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    const tourId = searchParams.get('tourId');
    const merchantId = searchParams.get('merchantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('product_inventory')
      .select(`
        *,
        tours (
          id,
          title,
          price
        )
      `)
      .order('tour_date', { ascending: true });

    if (tourId) {
      query = query.eq('tour_id', tourId);
    }

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    if (startDate) {
      query = query.gte('tour_date', startDate);
    }

    if (endDate) {
      query = query.lte('tour_date', endDate);
    }

    const { data: inventory, error } = await query;

    if (error) {
      console.error('Error fetching inventory:', error);
      return NextResponse.json(
        { error: 'Failed to fetch inventory', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ inventory: inventory || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory
 * Create or update inventory entry
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const {
      tourId,
      merchantId,
      tourDate,
      availableSpots,
      maxCapacity,
      priceOverride,
      isAvailable,
    } = body;

    if (!tourId || !tourDate) {
      return NextResponse.json(
        { error: 'tourId and tourDate are required' },
        { status: 400 }
      );
    }

    // Get merchant_id from tour if not provided
    let finalMerchantId = merchantId;
    if (!finalMerchantId) {
      const { data: tour } = await supabase
        .from('tours')
        .select('merchant_id')
        .eq('id', tourId)
        .single();

      if (tour?.merchant_id) {
        finalMerchantId = tour.merchant_id;
      }
    }

    // Check if inventory entry already exists
    const { data: existing } = await supabase
      .from('product_inventory')
      .select('id')
      .eq('tour_id', tourId)
      .eq('tour_date', tourDate)
      .single();

    if (existing) {
      // Update existing entry
      const updateData: any = {};
      if (availableSpots !== undefined) updateData.available_spots = availableSpots;
      if (maxCapacity !== undefined) updateData.max_capacity = maxCapacity;
      if (priceOverride !== undefined) updateData.price_override = priceOverride;
      if (isAvailable !== undefined) updateData.is_available = isAvailable;

      const { data: inventory, error } = await supabase
        .from('product_inventory')
        .update(updateData)
        .eq('id', existing.id)
        .select(`
          *,
          tours (
            id,
            title,
            price
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        inventory,
        message: 'Inventory updated successfully',
      });
    }

    // Create new entry
    const inventoryData: any = {
      tour_id: tourId,
      merchant_id: finalMerchantId,
      tour_date: tourDate,
      available_spots: availableSpots || 0,
      max_capacity: maxCapacity || null,
      price_override: priceOverride || null,
      is_available: isAvailable !== undefined ? isAvailable : true,
    };

    const { data: inventory, error } = await supabase
      .from('product_inventory')
      .insert(inventoryData)
      .select(`
        *,
        tours (
          id,
          title,
          price
        )
      `)
      .single();

    if (error) {
      console.error('Error creating inventory:', error);
      return NextResponse.json(
        { error: 'Failed to create inventory', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { inventory, message: 'Inventory created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}




