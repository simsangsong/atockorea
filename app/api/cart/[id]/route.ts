import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * PUT /api/cart/[id]
 * Update cart item
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const cartItemId = params.id;
    const body = await req.json();

    const { numberOfGuests, bookingDate, pickupPointId } = body;

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get existing cart item
    const { data: existingItem, error: fetchError } = await supabase
      .from('cart_items')
      .select(`
        user_id,
        tour_id,
        unit_price,
        number_of_guests,
        tours!inner (
          price_type
        )
      `)
      .eq('id', cartItemId)
      .single();

    if (fetchError || !existingItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      );
    }

    if (existingItem.user_id !== userId) {
      return NextResponse.json(
        { error: 'You can only update your own cart items' },
        { status: 403 }
      );
    }

    // Calculate new total price
    const unitPrice = parseFloat(existingItem.unit_price.toString());
    const guests = numberOfGuests !== undefined ? numberOfGuests : (existingItem.number_of_guests || 1);
    const tour = existingItem.tours as any;
    const totalPrice = tour?.price_type === 'person'
      ? unitPrice * guests
      : unitPrice;

    // Update cart item
    const updateData: any = {
      total_price: totalPrice,
    };

    if (numberOfGuests !== undefined) {
      updateData.number_of_guests = numberOfGuests;
    }
    if (bookingDate !== undefined) {
      updateData.booking_date = bookingDate;
    }
    if (pickupPointId !== undefined) {
      updateData.pickup_point_id = pickupPointId || null;
    }

    const { data: cartItem, error } = await supabase
      .from('cart_items')
      .update(updateData)
      .eq('id', cartItemId)
      .select(`
        *,
        tours (
          id,
          title,
          city,
          price,
          original_price,
          price_type,
          image_url,
          images,
          duration
        ),
        pickup_points (
          id,
          name,
          address
        )
      `)
      .single();

    if (error) {
      console.error('Error updating cart item:', error);
      return NextResponse.json(
        { error: 'Failed to update cart item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ cartItem, message: 'Cart item updated successfully' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cart/[id]
 * Delete cart item
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const cartItemId = params.id;

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify cart item belongs to user
    const { data: cartItem, error: fetchError } = await supabase
      .from('cart_items')
      .select('user_id')
      .eq('id', cartItemId)
      .single();

    if (fetchError || !cartItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      );
    }

    if (cartItem.user_id !== userId) {
      return NextResponse.json(
        { error: 'You can only delete your own cart items' },
        { status: 403 }
      );
    }

    // Delete cart item
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);

    if (error) {
      console.error('Error deleting cart item:', error);
      return NextResponse.json(
        { error: 'Failed to delete cart item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Cart item deleted successfully' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

