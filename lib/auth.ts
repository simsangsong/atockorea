import { createServerClient } from './supabase';
import { NextRequest } from 'next/server';

export type UserRole = 'customer' | 'merchant' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  merchantId?: string;
}

/**
 * Get current authenticated user from request
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    const supabase = createServerClient();
    
    // Get auth token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    // Get user profile with role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    // Get merchant_id if user is a merchant
    let merchantId: string | undefined;
    if (profile?.role === 'merchant') {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();
      merchantId = merchant?.id;
    }
    
    return {
      id: user.id,
      email: user.email || '',
      role: (profile?.role as UserRole) || 'customer',
      merchantId,
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * Get auth user from session token (for client-side)
 */
export async function getAuthUserFromToken(token: string): Promise<AuthUser | null> {
  try {
    const supabase = createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    // Get user profile with role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    // Get merchant_id if user is a merchant
    let merchantId: string | undefined;
    if (profile?.role === 'merchant') {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();
      merchantId = merchant?.id;
    }
    
    return {
      id: user.id,
      email: user.email || '',
      role: (profile?.role as UserRole) || 'customer',
      merchantId,
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require specific role - throws error if user doesn't have required role
 */
export async function requireRole(
  req: NextRequest,
  roles: UserRole[]
): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (!roles.includes(user.role)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
  return user;
}

/**
 * Require admin role
 */
export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
  return requireRole(req, ['admin']);
}

/**
 * Require merchant role
 */
export async function requireMerchant(req: NextRequest): Promise<AuthUser> {
  return requireRole(req, ['merchant', 'admin']);
}

/**
 * Get merchant ID from authenticated user
 */
export async function getMerchantId(req: NextRequest): Promise<string> {
  const user = await requireMerchant(req);
  if (!user.merchantId) {
    throw new Error('User is not associated with a merchant');
  }
  return user.merchantId;
}

