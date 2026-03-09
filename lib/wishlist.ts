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

// --- localStorage wishlist (MVP: no auth required; later sync with database) ---

const WISHLIST_STORAGE_KEY = 'atockorea_wishlist_ids';

function getStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function setStorage(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

/** Get tour IDs saved in localStorage wishlist */
export function getWishlistIdsLocal(): string[] {
  return getStorage();
}

/** Check if tour is in localStorage wishlist (client-only) */
export function isInWishlistLocal(tourId: string): boolean {
  return getStorage().includes(String(tourId));
}

/** Toggle tour in localStorage wishlist; returns new saved state (true = now saved) */
export function toggleWishlistLocal(tourId: string): boolean {
  const id = String(tourId);
  const ids = getStorage();
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    setStorage(ids);
    return false;
  }
  ids.push(id);
  setStorage(ids);
  return true;
}













