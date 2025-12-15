import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * PUT /api/inventory/[id]
 * Update inventory entry
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const inventoryId = params.id;
    const body = await req.json();

    const {
      availableSpots,
      reservedSpots,
      maxCapacity,
      priceOverride,
      isAvailable,
    } = body;

    const updateData: any = {};
    if (availableSpots !== undefined) updateData.available_spots = availableSpots;
    if (reservedSpots !== undefined) updateData.reserved_spots = reservedSpots;
    if (maxCapacity !== undefined) updateData.max_capacity = maxCapacity;
    if (priceOverride !== undefined) updateData.price_override = priceOverride;
    if (isAvailable !== undefined) updateData.is_available = isAvailable;

    const { data: inventory, error } = await supabase
      .from('product_inventory')
      .update(updateData)
      .eq('id', inventoryId)
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
      console.error('Error updating inventory:', error);
      return NextResponse.json(
        { error: 'Failed to update inventory', details: error.message },
        { status: 500 }
      );
    }

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ inventory, message: 'Inventory updated successfully' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inventory/[id]
 * Get single inventory entry
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const inventoryId = params.id;

    const { data: inventory, error } = await supabase
      .from('product_inventory')
      .select(`
        *,
        tours (
          id,
          title,
          price
        )
      `)
      .eq('id', inventoryId)
      .single();

    if (error || !inventory) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Inventory not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch inventory', details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ inventory });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}



