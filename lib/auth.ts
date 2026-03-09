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
 * Supports both Authorization header and cookie-based authentication
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    const supabase = createServerClient();
    let user: any = null;
    
    // Method 1: Try Authorization header (for API clients)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
      if (!error && authUser) {
        user = authUser;
      }
    }
    
    // Method 2: Try cookie-based authentication (for browser requests)
    if (!user) {
      // Get all cookies
      const cookies = req.cookies;
      
      // Try to find Supabase auth token in cookies
      // Supabase stores session in cookies with pattern: sb-<project-ref>-auth-token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      const isDev = process.env.NODE_ENV === 'development';

      if (projectRef) {
        // Try different cookie name patterns
        const cookieNames = [
          `sb-${projectRef}-auth-token`,
          `sb-${projectRef}-auth-token-code-verifier`,
          `sb-${projectRef}-auth-token.0`,
          `sb-${projectRef}-auth-token.1`,
        ];

        // Collect all matching cookies (may be split into multiple parts)
        const matchingCookies: Array<{ name: string; value: string }> = [];
        for (const cookieName of cookieNames) {
          const cookie = cookies.get(cookieName);
          if (cookie) {
            matchingCookies.push({ name: cookieName, value: cookie.value });
          }
        }

        // Try to combine split cookies or parse individually
        if (matchingCookies.length > 0) {
          // Sort by name to ensure correct order for split cookies
          matchingCookies.sort((a, b) => a.name.localeCompare(b.name));

          // Try combined value first (for split cookies like .0, .1, etc.)
          const combinedValue = matchingCookies.map(c => c.value).join('');

          try {
            const sessionData = JSON.parse(combinedValue);
            const accessToken = sessionData?.access_token || sessionData?.accessToken || sessionData?.session?.access_token;

            if (accessToken) {
              const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
              if (!error && authUser) {
                user = authUser;
              } else if (isDev) {
                console.warn('[getAuthUser] Token validation failed:', error?.message);
              }
            }
          } catch (e: any) {
            if (isDev) {
              console.warn('[getAuthUser] Cookie parse error:', e.message);
            }
            
            // Try each cookie individually
            for (const cookie of matchingCookies) {
              try {
                const sessionData = JSON.parse(cookie.value);
                const accessToken = sessionData?.access_token || sessionData?.accessToken;

                if (accessToken) {
                  const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
                  if (!error && authUser) {
                    user = authUser;
                    break;
                  }
                }
              } catch {
                // Not JSON, try as direct token
                try {
                  const { data: { user: authUser }, error } = await supabase.auth.getUser(cookie.value);
                  if (!error && authUser) {
                    user = authUser;
                    break;
                  }
                } catch {
                  // Skip this cookie
                }
              }
            }
          }
        }
      }

      // Fallback: Try common cookie names for auth tokens
      if (!user && projectRef) {
        const fallbackCookieNames = [
          'sb-auth-token',
          'supabase-auth-token',
          'auth-token',
        ];
        
        for (const cookieName of fallbackCookieNames) {
          const cookie = cookies.get(cookieName);
          if (cookie) {
            try {
              const parsed = JSON.parse(cookie.value);
              const accessToken = parsed?.access_token || parsed?.accessToken;
              if (accessToken) {
                const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
                if (!error && authUser) {
                  user = authUser;
                  break;
                }
              }
            } catch (e) {
              // Not JSON, skip
            }
          }
        }
      }
      
    }
    
    if (!user) {
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
    if (process.env.NODE_ENV === 'development') {
      console.error('[getAuthUser] Error:', error);
    }
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
    if (process.env.NODE_ENV === 'development') {
      console.error('[getAuthUserFromToken] Error:', error);
    }
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

