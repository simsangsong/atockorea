import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/cart
 * Get user's cart items
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    
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

    // Fallback: get from query params
    if (!userId) {
      const { searchParams } = new URL(req.url);
      userId = searchParams.get('userId');
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required or userId parameter required' },
        { status: 401 }
      );
    }

    const { data: cartItems, error } = await supabase
      .from('cart_items')
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cart:', error);
      return NextResponse.json(
        { error: 'Failed to fetch cart', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ cartItems: cartItems || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cart
 * Add item to cart
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const { tourId, bookingDate, numberOfGuests, pickupPointId } = body;

    if (!tourId || !bookingDate || !numberOfGuests) {
      return NextResponse.json(
        { error: 'tourId, bookingDate, and numberOfGuests are required' },
        { status: 400 }
      );
    }

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

    // Get tour info for pricing
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('id, price, price_type')
      .eq('id', tourId)
      .eq('is_active', true)
      .single();

    if (tourError || !tour) {
      return NextResponse.json(
        { error: 'Tour not found' },
        { status: 404 }
      );
    }

    // Calculate prices
    const unitPrice = parseFloat(tour.price.toString());
    const totalPrice = tour.price_type === 'person' 
      ? unitPrice * numberOfGuests 
      : unitPrice;

    // Check if item already exists in cart (using booking_date or tour_date)
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id')
      .eq('user_id', userId)
      .eq('tour_id', tourId)
      .or(`booking_date.eq.${bookingDate},tour_date.eq.${bookingDate}`)
      .maybeSingle();

    if (existing) {
      // Update existing item
      const { data: cartItem, error } = await supabase
        .from('cart_items')
        .update({
          number_of_guests: numberOfGuests,
          pickup_point_id: pickupPointId || null,
          unit_price: unitPrice,
          total_price: totalPrice,
        })
        .eq('id', existing.id)
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
        throw error;
      }

      return NextResponse.json({
        cartItem,
        message: 'Cart item updated successfully',
      });
    }

    // Create new cart item
    const { data: cartItem, error } = await supabase
      .from('cart_items')
      .insert({
        user_id: userId,
        tour_id: tourId,
        booking_date: bookingDate,
        number_of_guests: numberOfGuests,
        pickup_point_id: pickupPointId || null,
        unit_price: unitPrice,
        total_price: totalPrice,
      })
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
      console.error('Error adding to cart:', error);
      return NextResponse.json(
        { error: 'Failed to add to cart', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { cartItem, message: 'Added to cart successfully' },
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

/**
 * DELETE /api/cart
 * Remove item from cart
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const cartItemId = searchParams.get('id');

    if (!cartItemId) {
      return NextResponse.json(
        { error: 'Cart item id is required' },
        { status: 400 }
      );
    }

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
      console.error('Error removing from cart:', error);
      return NextResponse.json(
        { error: 'Failed to remove from cart', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Removed from cart successfully' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

