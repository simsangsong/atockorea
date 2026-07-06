import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getKrwPerUsd } from '@/lib/exchange/usdBasedRates.server';
import {
  tourListPricesToUsdSync,
  mapNestedTourRowsToUsd,
  mapNestedTourToUsdRow,
} from '@/lib/tour-list-price-usd.server';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/cart
 * Get current user's cart items (authentication required)
 */
export async function GET(req: NextRequest) {
  try {
    // Cart is scoped by user.id and never reads role — skip the role/merchant
    // lookup (1–2 DB round trips) that getAuthUser does by default.
    const user = await getAuthUser(req, { skipRoleLookup: true });
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const userId = user.id;

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
          price_currency,
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

    const mapped = await mapNestedTourRowsToUsd(cartItems || []);
    return NextResponse.json({ cartItems: mapped });
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
    const user = await getAuthUser(req, { skipRoleLookup: true });
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const body = await req.json();
    const { tourId, bookingDate, numberOfGuests, pickupPointId } = body;

    if (!tourId || !bookingDate || !numberOfGuests) {
      return NextResponse.json(
        { error: 'tourId, bookingDate, and numberOfGuests are required' },
        { status: 400 }
      );
    }

    const userId = user.id;

    // Get tour info for pricing
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('id, price, original_price, price_currency, price_type')
      .eq('id', tourId)
      .eq('is_active', true)
      .single();

    if (tourError || !tour) {
      return NextResponse.json(
        { error: 'Tour not found' },
        { status: 404 }
      );
    }

    const krwPerUsd = await getKrwPerUsd();
    const { priceUsd: unitPriceUsd } = tourListPricesToUsdSync(
      {
        price: tour.price,
        original_price: tour.original_price,
        price_currency: (tour as { price_currency?: string }).price_currency,
      },
      krwPerUsd
    );
    const unitPrice = parseFloat(String(unitPriceUsd));
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

      const mapped = mapNestedTourToUsdRow(cartItem, krwPerUsd);
      return NextResponse.json({
        cartItem: mapped,
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
          price_currency,
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

    const mappedNew = mapNestedTourToUsdRow(cartItem, krwPerUsd);
    return NextResponse.json(
      { cartItem: mappedNew, message: 'Added to cart successfully' },
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
    const user = await getAuthUser(req, { skipRoleLookup: true });
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const cartItemId = searchParams.get('id');

    if (!cartItemId) {
      return NextResponse.json(
        { error: 'Cart item id is required' },
        { status: 400 }
      );
    }

    const userId = user.id;

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

