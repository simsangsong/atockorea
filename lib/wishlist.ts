import { supabase } from './supabase';

/**
 * Check if a tour is in user's wishlist
 */
export async function isInWishlist(tourId: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
    
    if (!session) {
      return false;
    }

    const response = await fetch('/api/wishlist', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const wishlist = data.wishlist || [];
    return wishlist.some((item: any) => item.tour_id === tourId);
  } catch (error) {
    console.error('Error checking wishlist:', error);
    return false;
  }
}

/**
 * Add tour to wishlist
 */
export async function addToWishlist(tourId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
    
    if (!session) {
      return { success: false, error: 'Please sign in to add to wishlist' };
    }

    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tourId }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || 'Failed to add to wishlist' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error adding to wishlist:', error);
    return { success: false, error: error.message || 'Failed to add to wishlist' };
  }
}

/**
 * Remove tour from wishlist
 */
export async function removeFromWishlist(tourId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
    
    if (!session) {
      return { success: false, error: 'Please sign in to remove from wishlist' };
    }

    const response = await fetch(`/api/wishlist?tourId=${tourId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || 'Failed to remove from wishlist' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error removing from wishlist:', error);
    return { success: false, error: error.message || 'Failed to remove from wishlist' };
  }
}

/**
 * Toggle wishlist status
 */
export async function toggleWishlist(tourId: string, currentStatus: boolean): Promise<{ success: boolean; isInWishlist: boolean; error?: string }> {
  if (currentStatus) {
    const result = await removeFromWishlist(tourId);
    return { ...result, isInWishlist: false };
  } else {
    const result = await addToWishlist(tourId);
    return { ...result, isInWishlist: true };
  }
}








